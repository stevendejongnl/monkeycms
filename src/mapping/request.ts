import { MappingError } from './mapping-error.ts'
import { setPath } from './path.ts'
import { buildUrl, isUnderBaseUrl } from './template.ts'
import { applyTransform } from './transforms.ts'
import type { EndpointMapping, FieldMapping, RequestBodyMapping } from './types.ts'


export interface RequestDescription {
    readonly method: string
    readonly url: string
    readonly headers: Readonly<Record<string, string>>
    readonly body?: string
}

export interface BuildRequestOptions {
    baseUrl: string
    endpoint: EndpointMapping
    // Values for {name} in the path and query templates, for example { id: '5', search: 'x' }.
    vars?: Record<string, unknown>
    // The entry values to send, as field name to value. Needs endpoint.body.
    entry?: Record<string, unknown>
    // Extra query parameters, for example from pageQuery().
    extraQuery?: Record<string, string>
    // A full URL to use instead of the endpoint path, for example from a Link header.
    // It must be under baseUrl.
    pageUrl?: string
    headers?: Record<string, string>
}

type Write = readonly [path: string, value: unknown]

const apiPath = (mapping: RequestBodyMapping, name: string, field: FieldMapping): string => {
    const path = field.path ?? name

    if (mapping.wrap === undefined) {
        return path
    }

    if (path.startsWith('/')) {
        throw new MappingError(`Field "${name}" uses a JSON Pointer path, which cannot be combined with wrap`)
    }

    return `${mapping.wrap}.${path}`
}

const fieldWrites = (mapping: RequestBodyMapping, entry: Record<string, unknown>): Write[] =>
    Object.entries(mapping.fields)
        .filter(([name]) => Object.hasOwn(entry, name))
        .map(([name, field]) => [apiPath(mapping, name, field), applyTransform(entry[name], field.transform, 'write')])

export const mapEntryToBody = (mapping: RequestBodyMapping, entry: Record<string, unknown>): Record<string, unknown> =>
    [...fieldWrites(mapping, entry), ...Object.entries(mapping.static ?? {})]
        .reduce<Record<string, unknown>>((body, [path, value]) => setPath(body, path, value), {})

const urlOf = (options: BuildRequestOptions): string => {
    const { baseUrl, endpoint, vars, extraQuery, pageUrl } = options

    if (pageUrl === undefined) {
        return buildUrl(baseUrl, endpoint.path, vars, endpoint.query, extraQuery)
    }

    if (!isUnderBaseUrl(pageUrl, baseUrl)) {
        throw new MappingError(`Page URL "${pageUrl}" is not under the base URL "${baseUrl}"`)
    }

    return pageUrl
}

export const buildRequest = (options: BuildRequestOptions): RequestDescription => {
    const { endpoint, entry, headers } = options
    const body = endpoint.body === undefined ? undefined : JSON.stringify(mapEntryToBody(endpoint.body, entry ?? {}))

    return {
        method: endpoint.method,
        url: urlOf(options),
        headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), accept: 'application/json', ...headers },
        ...(body === undefined ? {} : { body }),
    }
}
