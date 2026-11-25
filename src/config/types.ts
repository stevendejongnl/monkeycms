import type { ErrorMapping, Json, Pagination, Transform } from '../mapping/main.ts'


export const CONFIG_VERSION = 1

export type FieldType = 'text' | 'longtext' | 'number' | 'boolean' | 'date' | 'select'

export type Operation = 'list' | 'get' | 'create' | 'update' | 'delete'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

// Authentication is added in MONKY-21. Until then the only type is "none".
export interface AuthConfig {
    readonly type: 'none'
}

export interface FieldConfig {
    readonly type: FieldType
    readonly label?: string
    readonly required?: boolean
    // The API never accepts this field, so it is not sent on create and update.
    readonly readOnly?: boolean
    // Where the value lives in the API data. Defaults to the field name.
    readonly path?: string
    readonly transform?: Transform
    // The choices of a select field.
    readonly options?: readonly string[]
}

interface EndpointConfig {
    // The default depends on the operation: GET, GET, POST, PUT and DELETE.
    readonly method?: HttpMethod
    // Path template under baseUrl, for example "/posts/{id}".
    readonly path: string
    readonly query?: Readonly<Record<string, string>>
    readonly headers?: Readonly<Record<string, string>>
}

export interface ListEndpointConfig extends EndpointConfig {
    readonly itemsPath?: string
    readonly totalPath?: string
    readonly pagination?: Pagination
}

export interface BodyConfig {
    // Where the item sits in the request body, for example "data". The field paths sit under
    // it, the same way as in a response. Leave out when the body is the item.
    readonly wrap?: string
    // Constant values, as API path to value.
    readonly static?: Readonly<Record<string, Json>>
}

export interface ItemEndpointConfig extends EndpointConfig {
    // Where the item lives in the response. Leave out when the body is the item.
    readonly itemPath?: string
    // How create and update build the request body. The fields come from the collection.
    readonly body?: BodyConfig
}

export interface DeleteEndpointConfig extends EndpointConfig {}

export interface CollectionConfig {
    readonly label?: string
    // Path of the id in one API item. Defaults to "id".
    readonly idPath?: string
    readonly fields: Readonly<Record<string, FieldConfig>>
    readonly list: ListEndpointConfig
    readonly get?: ItemEndpointConfig
    readonly create?: ItemEndpointConfig
    readonly update?: ItemEndpointConfig
    readonly delete?: DeleteEndpointConfig
}

export interface MonkeyConfig {
    readonly configVersion: typeof CONFIG_VERSION
    readonly baseUrl: string
    readonly auth?: AuthConfig
    // Sent with every request.
    readonly headers?: Readonly<Record<string, string>>
    // Used by every list that does not set its own.
    readonly pagination?: Pagination
    readonly errors?: ErrorMapping
    readonly collections: Readonly<Record<string, CollectionConfig>>
}
