import { MappingError } from './mapping-error.ts'
import type { Transform } from './types.ts'


export type Direction = 'read' | 'write'

const isPrimitive = (value: unknown): value is string | number | boolean =>
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'

const fail = (transform: string, value: unknown): never => {
    throw new MappingError(`Cannot apply "${transform}" to ${JSON.stringify(value)}`)
}

const toDate = (value: unknown): string => {
    const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : new Date(Number.NaN)

    return Number.isNaN(date.getTime()) ? fail('date', value) : date.toISOString()
}

// Each transform comes from a fixed list. There is no way to run code from the config.
// "read" goes from API data to the internal model, "write" goes the other way.
export const applyTransform = (value: unknown, transform: Transform | undefined, direction: Direction): unknown => {
    if (transform === undefined) {
        return value
    }

    if (typeof transform === 'object' && transform.type === 'default') {
        return value === undefined || value === null ? transform.value : value
    }

    if (value === undefined || value === null) {
        return value
    }

    if (typeof transform === 'object') {
        const joining = (transform.type === 'join') === (direction === 'read')

        if (joining) {
            return Array.isArray(value) ? value.join(transform.separator) : fail(transform.type, value)
        }

        return typeof value === 'string' ? value.split(transform.separator) : fail(transform.type, value)
    }

    switch (transform) {
        case 'string':
            return isPrimitive(value) ? String(value) : fail(transform, value)
        case 'number': {
            const number = typeof value === 'string' && value.trim() === '' ? Number.NaN : Number(value)

            return (typeof value === 'string' || typeof value === 'number') && Number.isFinite(number) ? number : fail(transform, value)
        }
        case 'boolean': {
            if (typeof value === 'boolean') {
                return value
            }

            const text = String(value).toLowerCase()

            if (text === 'true' || text === '1') {
                return true
            }

            return text === 'false' || text === '0' ? false : fail(transform, value)
        }
        case 'date':
            return toDate(value)
    }
}
