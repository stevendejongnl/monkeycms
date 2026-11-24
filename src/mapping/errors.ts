import { getPath } from './path.ts'
import type { ApiError, ErrorMapping } from './types.ts'


// Turns an error response into one shape. The message falls back to the HTTP status.
export const readError = (status: number, body: unknown, mapping: ErrorMapping = {}): ApiError => {
    const message = mapping.messagePath === undefined ? undefined : getPath(body, mapping.messagePath)
    const raw = mapping.fieldErrorsPath === undefined ? undefined : getPath(body, mapping.fieldErrorsPath)
    const fieldErrors: Record<string, string> = {}

    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
        for (const [field, value] of Object.entries(raw)) {
            const messages = (Array.isArray(value) ? value : [value]).filter((item) => typeof item === 'string')

            if (messages.length > 0) {
                fieldErrors[field] = messages.join(', ')
            }
        }
    }

    return {
        status,
        message: typeof message === 'string' && message !== '' ? message : `HTTP ${status}`,
        fieldErrors,
    }
}
