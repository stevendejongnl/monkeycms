export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

export type Transform =
    | 'string'
    | 'number'
    | 'boolean'
    | 'date'
    | { type: 'join', separator: string }
    | { type: 'split', separator: string }
    | { type: 'default', value: Json }

export interface FieldMapping {
    // Where the value lives in the API data. Defaults to the field name.
    path?: string
    transform?: Transform
}

export type FieldMappings = Record<string, FieldMapping>

export interface EntryMapping {
    // Path of the id in one API item.
    id: string
    fields: FieldMappings
}

export interface RequestBodyMapping {
    // Dot path that all field paths sit under, for example "data.attributes".
    wrap?: string
    fields: FieldMappings
    // Constant values, as API path to value. The paths do not use wrap.
    static?: Record<string, Json>
}

export interface EndpointMapping {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    // Path template under the base URL, for example "/posts/{id}".
    path: string
    // Query templates, for example { "q": "{search}" }.
    query?: Record<string, string>
    body?: RequestBodyMapping
}

export interface ListResponseMapping {
    // Path of the items array. Leave out when the body is the array.
    itemsPath?: string
    totalPath?: string
    entry: EntryMapping
}

export interface EntryResponseMapping {
    // Path of the item. Leave out when the body is the item.
    itemPath?: string
    entry: EntryMapping
}

export interface ErrorMapping {
    messagePath?: string
    // Path of an object that maps field names to a message or a list of messages.
    fieldErrorsPath?: string
}

export type Pagination =
    | { type: 'none' }
    | { type: 'page', pageParam: string, limitParam: string, pageSize: number, startPage?: number }
    | { type: 'offset', offsetParam: string, limitParam: string, pageSize: number }
    | { type: 'cursor', cursorParam: string, nextCursorPath: string, pageSize: number, limitParam?: string }
    | { type: 'link-header', pageSize: number, limitParam?: string }

// An entry in the internal model. The UI only sees this shape.
export interface Entry {
    id: string
    values: Record<string, unknown>
}

export interface ApiError {
    status: number
    message: string
    fieldErrors: Record<string, string>
}
