import { getPath } from './path.ts'
import type { ApiError, ErrorMapping } from './types.ts'


const valueAt = (body: unknown, path: string | undefined): unknown =>
    path === undefined ? undefined : getPath(body, path)

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const messagesOf = (value: unknown): string[] =>
    [value].flat().filter((item): item is string => typeof item === 'string')

const joined = (entries: (readonly [string, string[]])[]): Record<string, string> =>
    Object.fromEntries(
        entries
            .filter(([, messages]) => messages.length > 0)
            .map(([field, messages]) => [field, messages.join(', ')])
    )

const fieldErrorsOfObject = (raw: Record<string, unknown>): Record<string, string> =>
    joined(Object.entries(raw).map(([field, value]) => [field, messagesOf(value)] as const))

// The name is the last part of a JSON Pointer or a dotted path.
const lastPart = (name: unknown): string =>
    typeof name === 'string' ? (name.split(/[/.]/).filter((part) => part !== '').at(-1) ?? '') : ''

const fieldErrorsOfArray = (raw: unknown[], { fieldNamePath, fieldMessagePath }: ErrorMapping): Record<string, string> => {
    const grouped = new Map<string, string[]>()

    for (const item of raw) {
        const field = lastPart(valueAt(item, fieldNamePath))
        const messages = messagesOf(fieldMessagePath === undefined ? item : valueAt(item, fieldMessagePath))

        grouped.set(field, [...(grouped.get(field) ?? []), ...messages])
    }

    grouped.delete('')

    return joined([...grouped])
}

const fieldErrorsOf = (raw: unknown, mapping: ErrorMapping): Record<string, string> => {
    if (Array.isArray(raw)) {
        return mapping.fieldNamePath === undefined ? {} : fieldErrorsOfArray(raw, mapping)
    }

    return isPlainObject(raw) ? fieldErrorsOfObject(raw) : {}
}

// Turns an error response into one shape. The message falls back to the HTTP status.
export const readError = (status: number, body: unknown, mapping: ErrorMapping = {}): ApiError => {
    const message = valueAt(body, mapping.messagePath)

    return {
        status,
        message: typeof message === 'string' && message !== '' ? message : `HTTP ${status}`,
        fieldErrors: fieldErrorsOf(valueAt(body, mapping.fieldErrorsPath), mapping),
    }
}
