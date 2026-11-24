import { MappingError } from './mapping-error.ts'
import type { Json, Transform } from './types.ts'


export type Direction = 'read' | 'write'

// A transform is a pair of conversions. "read" goes from API data to the internal model,
// "write" goes the other way. All transforms come from this fixed list, so the config
// cannot run code.
interface Codec {
    read: (value: unknown) => unknown
    write: (value: unknown) => unknown
}

type Parameterized<T extends string> = Extract<Transform, { type: T }>

const isMissing = (value: unknown): value is null | undefined => value === undefined || value === null

const fail = (transform: string, value: unknown): never => {
    throw new MappingError(`Cannot apply "${transform}" to ${JSON.stringify(value)}`)
}

const symmetric = (convert: (value: unknown) => unknown): Codec => ({ read: convert, write: convert })

const asString = (value: unknown): unknown =>
    ['string', 'number', 'boolean'].includes(typeof value) ? String(value) : fail('string', value)

const asNumber = (value: unknown): unknown => {
    const number = typeof value === 'string' && value.trim() === '' ? Number.NaN : Number(value)

    return (typeof value === 'string' || typeof value === 'number') && Number.isFinite(number) ? number : fail('number', value)
}

const BOOLEANS: Record<string, boolean> = { true: true, 1: true, false: false, 0: false }

const asBoolean = (value: unknown): unknown =>
    typeof value === 'boolean' ? value : BOOLEANS[String(value).toLowerCase()] ?? fail('boolean', value)

const asIsoDate = (value: unknown): unknown => {
    const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : new Date(Number.NaN)

    return Number.isNaN(date.getTime()) ? fail('date', value) : date.toISOString()
}

const join = (separator: string) => (value: unknown): unknown =>
    Array.isArray(value) ? value.join(separator) : fail('join', value)

const split = (separator: string) => (value: unknown): unknown =>
    typeof value === 'string' ? value.split(separator) : fail('split', value)

const simple: Record<Extract<Transform, string>, Codec> = {
    string: symmetric(asString),
    number: symmetric(asNumber),
    boolean: symmetric(asBoolean),
    date: symmetric(asIsoDate),
}

const parameterized: { [T in Exclude<Transform, string>['type']]: (transform: Parameterized<T>) => Codec } = {
    join: ({ separator }) => ({ read: join(separator), write: split(separator) }),
    split: ({ separator }) => ({ read: split(separator), write: join(separator) }),
    default: ({ value }) => symmetric(fallback(value)),
}

const fallback = (replacement: Json) => (value: unknown): unknown => isMissing(value) ? replacement : value

const codecFor = (transform: Transform): Codec =>
    typeof transform === 'string'
        ? simple[transform]
        : (parameterized[transform.type] as (transform: Transform) => Codec)(transform)

// Missing values pass through every transform, except "default", which fills them in.
const skipsMissing = (transform: Transform): boolean => typeof transform === 'string' || transform.type !== 'default'

export const applyTransform = (value: unknown, transform: Transform | undefined, direction: Direction): unknown =>
    transform === undefined || (isMissing(value) && skipsMissing(transform))
        ? value
        : codecFor(transform)[direction](value)
