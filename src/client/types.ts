import type { ApiError, Entry, PageState } from '../mapping/main.ts'


// What went wrong, in one word:
//   http              the API answered with an error status
//   network           the request did not reach the API
//   timeout           the API did not answer in time
//   aborted           the caller cancelled the request
//   request           the config and the values could not make a request
//   invalid-response  the API answered with data that the config does not describe
//   unsupported       the collection does not have this operation
//   unauthenticated   the API needs a sign-in and there is no session, so nothing was sent
export type ErrorKind = 'http' | 'network' | 'timeout' | 'aborted' | 'request' | 'invalid-response' | 'unsupported' | 'unauthenticated'

// The one shape of every error. Status is 0 when there was no HTTP answer.
export interface ClientError extends ApiError {
    readonly kind: ErrorKind
}

export type Result<T> =
    | { readonly ok: true, readonly value: T }
    | { readonly ok: false, readonly error: ClientError }

export interface ListPage {
    readonly items: readonly Entry[]
    readonly total?: number
    // The state to ask for the next page with, or null on the last page.
    readonly next: PageState | null
}

export interface CallOptions {
    readonly signal?: AbortSignal
}

export interface ListOptions extends CallOptions {
    readonly page?: PageState
    // Values for the {name} placeholders in the query of the list endpoint, for example a search term.
    readonly vars?: Readonly<Record<string, unknown>>
    // A search term. It is sent in the searchParam of the list endpoint, and only when it is not empty.
    readonly search?: string
    // A status value. It is sent in the status param of the collection, and only when it is not empty.
    readonly status?: string
}

export interface ApiClient {
    list: (collection: string, options?: ListOptions) => Promise<Result<ListPage>>
    get: (collection: string, id: string, options?: CallOptions) => Promise<Result<Entry>>
    create: (collection: string, values: Record<string, unknown>, options?: CallOptions) => Promise<Result<Entry>>
    update: (collection: string, id: string, values: Record<string, unknown>, options?: CallOptions) => Promise<Result<Entry>>
    remove: (collection: string, id: string, options?: CallOptions) => Promise<Result<void>>
}
