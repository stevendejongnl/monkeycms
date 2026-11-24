import { MappingError } from './mapping-error.ts'


const UNSAFE_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])
const INDEX = /^\d+$/

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const pointerSegments = (path: string): string[] =>
    path.slice(1).split('/').map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))

const dotSegments = (path: string): string[] => {
    const segments = path.replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '').split('.')

    return segments.includes('') ? fail(`Invalid path "${path}"`) : segments
}

const fail = (message: string): never => {
    throw new MappingError(message)
}

// Two syntaxes: dot notation ("data.items[0].name") and JSON Pointer ("/data/items/0/name").
export const parsePath = (path: string): string[] =>
    path === '' ? [] : path.startsWith('/') ? pointerSegments(path) : dotSegments(path)

const child = (parent: unknown, segment: string): unknown =>
    Array.isArray(parent)
        ? (INDEX.test(segment) ? parent[Number(segment)] : undefined)
        : isRecord(parent) && Object.hasOwn(parent, segment) ? parent[segment] : undefined

export const getPath = (value: unknown, path: string): unknown =>
    parsePath(path).reduce<unknown>(child, value)

const assertWritable = (path: string, segment: string, parent: unknown): void => {
    if (UNSAFE_SEGMENTS.has(segment)) {
        fail(`Path "${path}" contains the forbidden segment "${segment}"`)
    }

    if (Array.isArray(parent) && !INDEX.test(segment)) {
        fail(`Path "${path}" uses "${segment}" on an array`)
    }
}

const emptyContainerFor = (segment: string | undefined): unknown[] | Record<string, unknown> =>
    INDEX.test(segment ?? '') ? [] : {}

// Returns a copy of node with the value written at segments. Nothing is changed in place.
const assoc = (node: unknown, segments: string[], value: unknown, path: string): unknown => {
    const [head, ...rest] = segments

    if (head === undefined) {
        return value
    }

    const container = isRecord(node) ? node : emptyContainerFor(head)

    assertWritable(path, head, container)

    const copy = Array.isArray(container) ? [...container] : { ...container }

    return Object.assign(copy, { [head]: assoc(child(container, head), rest, value, path) })
}

// Creates the objects and arrays on the way. The paths come from a config, so the
// segments that could change an object prototype are refused.
export const setPath = (target: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> => {
    const segments = parsePath(path)

    return segments.length === 0
        ? fail('Cannot set an empty path')
        : assoc(target, segments, value, path) as Record<string, unknown>
}
