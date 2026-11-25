import type {
    EndpointMapping, EntryMapping, EntryResponseMapping, ErrorMapping, FieldMapping,
    ListResponseMapping, Pagination, RequestBodyMapping,
} from '../mapping/main.ts'
import type { CollectionConfig, FieldConfig, HttpMethod, ItemEndpointConfig, MonkeyConfig, Operation } from './types.ts'


// The bridge from the config to the mapping engine. The config is written for people, the
// engine wants small mappings. Each function here turns a part of the config into one.

const DEFAULT_METHODS: Record<Operation, HttpMethod> = {
    list: 'GET',
    get: 'GET',
    create: 'POST',
    update: 'PUT',
    delete: 'DELETE',
}

const defined = <K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } =>
    (value === undefined ? {} : { [key]: value }) as { [P in K]?: V }

const fieldMapping = ({ path, transform }: FieldConfig): FieldMapping => ({
    ...defined('path', path),
    ...defined('transform', transform),
})

export const entryMappingOf = (collection: CollectionConfig): EntryMapping => ({
    id: collection.idPath ?? 'id',
    fields: Object.fromEntries(Object.entries(collection.fields).map(([name, field]) => [name, fieldMapping(field)])),
})

export const listResponseOf = (collection: CollectionConfig): ListResponseMapping => ({
    ...defined('itemsPath', collection.list.itemsPath),
    ...defined('totalPath', collection.list.totalPath),
    entry: entryMappingOf(collection),
})

export const entryResponseOf = (collection: CollectionConfig, endpoint: ItemEndpointConfig): EntryResponseMapping => ({
    ...defined('itemPath', endpoint.itemPath),
    entry: entryMappingOf(collection),
})

// The fields that the API takes: everything that is not read-only.
export const bodyMappingOf = (collection: CollectionConfig, endpoint: ItemEndpointConfig): RequestBodyMapping => ({
    ...defined('wrap', endpoint.body?.wrap),
    ...defined('static', endpoint.body?.static),
    fields: Object.fromEntries(
        Object.entries(collection.fields)
            .filter(([, field]) => field.readOnly !== true)
            .map(([name, field]) => [name, fieldMapping(field)])
    ),
})

const WRITES: readonly Operation[] = ['create', 'update']

// The request shape of one operation. Returns undefined when the collection does not have it.
export const endpointOf = (collection: CollectionConfig, operation: Operation): EndpointMapping | undefined => {
    const endpoint = collection[operation]

    return endpoint === undefined
        ? undefined
        : {
            method: endpoint.method ?? DEFAULT_METHODS[operation],
            path: endpoint.path,
            ...defined('query', endpoint.query),
            ...(WRITES.includes(operation) ? { body: bodyMappingOf(collection, endpoint as ItemEndpointConfig) } : {}),
        }
}

// The headers of one operation: the headers of the whole config, then the endpoint's own.
export const headersOf = (config: MonkeyConfig, collection: CollectionConfig, operation: Operation): Record<string, string> => ({
    ...config.headers,
    ...collection[operation]?.headers,
})

export const paginationOf = (config: MonkeyConfig, collection: CollectionConfig): Pagination =>
    collection.list.pagination ?? config.pagination ?? { type: 'none' }

export const errorsOf = (config: MonkeyConfig): ErrorMapping => config.errors ?? {}
