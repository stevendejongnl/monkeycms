import type { ErrorMapping, Json, Pagination, Transform } from '../mapping/main.ts'


export const CONFIG_VERSION = 1

export type FieldType = 'text' | 'longtext' | 'number' | 'boolean' | 'date' | 'select'

export type Operation = 'list' | 'get' | 'create' | 'update' | 'delete'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

// How the client signs in. The config never holds a secret: the person enters the
// credentials at runtime, and the session is kept in memory unless persist is "session".
// "session" keeps the session (the token or the key, never a password) in sessionStorage,
// so it survives a reload of the tab but can be read by any script on the page.
export type Persist = 'memory' | 'session'

interface AuthBase {
    readonly persist?: Persist
}

// Where to send the credentials, and how the body looks.
interface LoginBody {
    // Path template under baseUrl.
    readonly path: string
    readonly method?: 'POST' | 'PUT'
    // The JSON keys of the body. They default to "username" and "password".
    readonly usernameField?: string
    readonly passwordField?: string
}

export interface NoAuth {
    readonly type: 'none'
}

// The person enters a token. It is sent as "Authorization: Bearer <token>".
export interface BearerAuth extends AuthBase {
    readonly type: 'bearer'
}

// The person enters a key. It is sent in a header or in the query.
export interface ApiKeyAuth extends AuthBase {
    readonly type: 'apiKey'
    readonly name: string
    readonly in: 'header' | 'query'
}

// The person enters a username and a password. They are sent as "Authorization: Basic ...".
export interface BasicAuth extends AuthBase {
    readonly type: 'basic'
}

// The browser keeps the session in a cookie, and requests are sent with credentials. With a
// path, the person signs in there and the API sets the cookie. Without a path, the session
// already exists, for example because the user signed in somewhere else on the same site.
export interface CookieAuth extends AuthBase, Partial<LoginBody> {
    readonly type: 'cookie'
}

// The person signs in at an endpoint that returns a token.
export interface LoginAuth extends AuthBase, LoginBody {
    readonly type: 'login'
    // Where the token is in the response.
    readonly tokenPath: string
    // Where the lifetime of the token in seconds is in the response. Without it the token
    // does not expire on the client.
    readonly expiresInPath?: string
    // The header that carries the token. Defaults to "authorization".
    readonly header?: string
    // The word before the token. Defaults to "Bearer". An empty string sends the bare token.
    readonly scheme?: string
}

export type AuthConfig = NoAuth | BearerAuth | ApiKeyAuth | BasicAuth | CookieAuth | LoginAuth

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
    // The query parameter that carries a search term. Without it the collection has no search.
    readonly searchParam?: string
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

// Which field of a collection holds its status, for the tabs and the bulk Publish of the list.
export interface StatusConfig {
    // A select field of the collection.
    readonly field: string
    // The query parameter of the list endpoint that filters by status. Without it there are no tabs.
    readonly param?: string
    // The value that bulk Publish writes to the field. Without it there is no Publish button.
    readonly publish?: string
}

// The side drawer that shows one entry of the list.
export interface PreviewConfig {
    // Names of fields of the collection, in the order to show them. A long text shows in full.
    readonly fields: readonly string[]
}

export interface CollectionConfig {
    readonly label?: string
    // Path of the id in one API item. Defaults to "id".
    readonly idPath?: string
    readonly fields: Readonly<Record<string, FieldConfig>>
    readonly status?: StatusConfig
    readonly preview?: PreviewConfig
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
