import type { CollectionConfig, MonkeyConfig, Operation } from '../config/main.ts'
import { endpointOf, entryResponseOf, errorsOf, headersOf, listResponseOf, paginationOf } from '../config/main.ts'
import type { EndpointMapping, RequestDescription } from '../mapping/main.ts'
import { buildRequest, firstPage, MappingError, nextPage, pageQuery, readEntry, readError, readList } from '../mapping/main.ts'
import { Failure, failure } from './failure.ts'
import { send } from './transport.ts'
import type { Fetcher, HttpResponse } from './transport.ts'
import type { ApiClient, ErrorKind, ListPage, Result } from './types.ts'


export interface ClientOptions {
    // Defaults to the global fetch. Pass another one in tests.
    readonly fetch?: Fetcher
    readonly timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 15_000

interface Call {
    readonly operation: Operation
    readonly collection: string
    readonly vars?: Record<string, unknown>
    readonly entry?: Record<string, unknown>
    readonly extraQuery?: Record<string, string>
    readonly pageUrl?: string
    readonly signal?: AbortSignal
}

interface Exchange {
    readonly collection: CollectionConfig
    readonly response: HttpResponse
}

// Runs a mapping step. A mapping error means the config and the data do not fit, so it is
// reported as the kind that says where the misfit is.
const guard = <T>(kind: ErrorKind, step: () => T): T => {
    try {
        return step()
    } catch (error) {
        throw error instanceof MappingError ? failure(kind, error.message) : error
    }
}

// Turns a Failure into the error of a Result. Any other error is a bug, not an API problem,
// so it is not hidden.
const toResult = async <T>(work: () => Promise<T>): Promise<Result<T>> => {
    try {
        return { ok: true, value: await work() }
    } catch (error) {
        if (error instanceof Failure) {
            return { ok: false, error: error.error }
        }

        throw error
    }
}

const orFail = <T>(value: T | undefined, problem: () => Failure): T => {
    if (value === undefined) {
        throw problem()
    }

    return value
}

const collectionOf = (config: MonkeyConfig, name: string): CollectionConfig =>
    orFail(Object.hasOwn(config.collections, name) ? config.collections[name] : undefined,
        () => failure('unsupported', `There is no collection "${name}"`))

const endpointFor = (collection: CollectionConfig, call: Call): EndpointMapping =>
    orFail(endpointOf(collection, call.operation),
        () => failure('unsupported', `The collection "${call.collection}" has no ${call.operation} endpoint`))

// A client for the API that the config describes. It has no API-specific code: the config
// says how to build each request and how to read each response. No method throws. Every
// method returns a Result with the data or one error shape.
export const createClient = (config: MonkeyConfig, options: ClientOptions = {}): ApiClient => {
    const fetcher: Fetcher = options.fetch ?? ((url, init) => fetch(url, init))
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

    const exchange = async (call: Call): Promise<Exchange> => {
        const collection = collectionOf(config, call.collection)
        const request: RequestDescription = guard('request', () => buildRequest({
            baseUrl: config.baseUrl,
            endpoint: endpointFor(collection, call),
            headers: headersOf(config, collection, call.operation),
            ...(call.vars === undefined ? {} : { vars: call.vars }),
            ...(call.entry === undefined ? {} : { entry: call.entry }),
            ...(call.extraQuery === undefined ? {} : { extraQuery: call.extraQuery }),
            ...(call.pageUrl === undefined ? {} : { pageUrl: call.pageUrl }),
        }))
        const response = await send(fetcher, request, { timeoutMs, ...(call.signal === undefined ? {} : { signal: call.signal }) })

        if (!response.ok) {
            const { message, fieldErrors } = readError(response.status, response.body, errorsOf(config))

            throw failure('http', message, response.status, fieldErrors)
        }

        return { collection, response }
    }

    const entryCall = (operation: 'get' | 'create' | 'update', collection: string, rest: Omit<Call, 'operation' | 'collection'>) =>
        toResult(async () => {
            const { collection: found, response } = await exchange({ operation, collection, ...rest })

            return guard('invalid-response', () =>
                readEntry(response.body, entryResponseOf(found, found[operation] as NonNullable<CollectionConfig['get']>)))
        })

    return {
        list: (collection, { page = firstPage, vars, signal } = {}) =>
            toResult<ListPage>(async () => {
                const found = collectionOf(config, collection)
                const pagination = paginationOf(config, found)
                const { response } = await exchange({
                    operation: 'list',
                    collection,
                    extraQuery: pageQuery(pagination, page),
                    ...(vars === undefined ? {} : { vars: { ...vars } }),
                    ...(page.url === undefined ? {} : { pageUrl: page.url }),
                    ...(signal === undefined ? {} : { signal }),
                })

                return guard('invalid-response', () => {
                    const { items, total } = readList(response.body, listResponseOf(found))
                    const next = nextPage(pagination, page, {
                        body: response.body,
                        headers: response.headers,
                        itemCount: items.length,
                        ...(total === undefined ? {} : { total }),
                    }, config.baseUrl)

                    return { items, next, ...(total === undefined ? {} : { total }) }
                })
            }),

        get: (collection, id, { signal } = {}) =>
            entryCall('get', collection, { vars: { id }, ...(signal === undefined ? {} : { signal }) }),

        create: (collection, values, { signal } = {}) =>
            entryCall('create', collection, { entry: values, ...(signal === undefined ? {} : { signal }) }),

        update: (collection, id, values, { signal } = {}) =>
            entryCall('update', collection, { vars: { id }, entry: values, ...(signal === undefined ? {} : { signal }) }),

        remove: (collection, id, { signal } = {}) =>
            toResult(async () => {
                await exchange({ operation: 'delete', collection, vars: { id }, ...(signal === undefined ? {} : { signal }) })
            }),
    }
}
