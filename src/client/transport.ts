import type { RequestDescription } from '../mapping/main.ts'
import { failure } from './failure.ts'


export type Fetcher = (url: string, init: RequestInit) => Promise<Response>

export interface HttpResponse {
    readonly status: number
    readonly ok: boolean
    readonly headers: Readonly<Record<string, string>>
    // The parsed JSON, or undefined when the body is empty or is not JSON.
    readonly body: unknown
}

export interface SendOptions {
    readonly timeoutMs: number
    readonly signal?: AbortSignal
    // "include" sends and accepts cookies, also on another origin.
    readonly credentials?: RequestCredentials
}

const parseJson = (text: string): unknown => {
    try {
        return JSON.parse(text)
    } catch {
        return undefined
    }
}

const messageOf = (error: unknown): string => error instanceof Error ? error.message : String(error)

// Sends one request. The request ends when the API answers, when the time is up, or when the
// caller cancels. Anything that goes wrong is thrown as a Failure.
export const send = async (fetcher: Fetcher, request: RequestDescription, { timeoutMs, signal, credentials }: SendOptions): Promise<HttpResponse> => {
    const limit = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal === undefined ? [] : [signal])])

    try {
        const response = await fetcher(request.url, {
            method: request.method,
            headers: request.headers as Record<string, string>,
            signal: limit,
            ...(credentials === undefined ? {} : { credentials }),
            ...(request.body === undefined ? {} : { body: request.body }),
        })
        const text = await response.text()

        return {
            status: response.status,
            ok: response.ok,
            headers: Object.fromEntries(response.headers),
            body: text === '' ? undefined : parseJson(text),
        }
    } catch (error) {
        throw !limit.aborted
            ? failure('network', messageOf(error))
            : (limit.reason as Error | undefined)?.name === 'TimeoutError'
                ? failure('timeout', `The API did not answer in ${timeoutMs} ms`)
                : failure('aborted', 'The request was cancelled')
    }
}
