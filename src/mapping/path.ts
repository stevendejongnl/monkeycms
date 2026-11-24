import { MappingError } from './mapping-error.ts'


const UNSAFE_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])
const INDEX = /^\d+$/

// Two syntaxes: dot notation ("data.items[0].name") and JSON Pointer ("/data/items/0/name").
export const parsePath = (path: string): string[] => {
    if (path === '') {
        return []
    }

    if (path.startsWith('/')) {
        return path.slice(1).split('/').map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
    }

    const segments = path.replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '').split('.')

    if (segments.includes('')) {
        throw new MappingError(`Invalid path "${path}"`)
    }

    return segments
}

export const getPath = (value: unknown, path: string): unknown => {
    let current = value

    for (const segment of parsePath(path)) {
        if (Array.isArray(current)) {
            if (!INDEX.test(segment)) {
                return undefined
            }
            current = current[Number(segment)]
        } else if (typeof current === 'object' && current !== null) {
            if (!Object.hasOwn(current, segment)) {
                return undefined
            }
            current = (current as Record<string, unknown>)[segment]
        } else {
            return undefined
        }
    }

    return current
}

// Writes a value and creates the objects and arrays on the way. The paths come from a
// config, so the segments that could change an object prototype are refused.
export const setPath = (target: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> => {
    const segments = parsePath(path)

    if (segments.length === 0) {
        throw new MappingError('Cannot set an empty path')
    }

    let current: Record<string, unknown> = target

    segments.forEach((segment, index) => {
        if (UNSAFE_SEGMENTS.has(segment)) {
            throw new MappingError(`Path "${path}" contains the forbidden segment "${segment}"`)
        }

        if (Array.isArray(current) && !INDEX.test(segment)) {
            throw new MappingError(`Path "${path}" uses "${segment}" on an array`)
        }

        if (index === segments.length - 1) {
            current[segment] = value
            return
        }

        let next = Object.hasOwn(current, segment) ? current[segment] : undefined

        if (typeof next !== 'object' || next === null) {
            next = INDEX.test(segments[index + 1] ?? '') ? [] : {}
            current[segment] = next
        }

        current = next as Record<string, unknown>
    })

    return target
}
