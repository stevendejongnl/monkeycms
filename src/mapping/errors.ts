import { getPath } from './path.ts'
import type { ApiError, ErrorMapping } from './types.ts'


const valueAt = (body: unknown, path: string | undefined): unknown =>
    path === undefined ? undefined : getPath(body, path)

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const messagesOf = (value: unknown): string[] =>
    [value].flat().filter((item): item is string => typeof item === 'string')

const fieldErrorsOf = (raw: unknown): Record<string, string> =>
    Object.fromEntries(
        Object.entries(isPlainObject(raw) ? raw : {})
            .map(([field, value]) => [field, messagesOf(value)] as const)
            .filter(([, messages]) => messages.length > 0)
            .map(([field, messages]) => [field, messages.join(', ')])
    )

// Turns an error response into one shape. The message falls back to the HTTP status.
export const readError = (status: number, body: unknown, mapping: ErrorMapping = {}): ApiError => {
    const message = valueAt(body, mapping.messagePath)

    return {
        status,
        message: typeof message === 'string' && message !== '' ? message : `HTTP ${status}`,
        fieldErrors: fieldErrorsOf(valueAt(body, mapping.fieldErrorsPath)),
    }
}
