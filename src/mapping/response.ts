import { MappingError } from './mapping-error.ts'
import { getPath } from './path.ts'
import { applyTransform } from './transforms.ts'
import type { Entry, EntryMapping, EntryResponseMapping, ListResponseMapping } from './types.ts'


const fail = (message: string): never => {
    throw new MappingError(message)
}

const identity = (raw: unknown, path: string): string => {
    const id = getPath(raw, path)

    return typeof id === 'string' || typeof id === 'number' ? String(id) : fail(`No id found at "${path}"`)
}

export const mapEntry = (raw: unknown, mapping: EntryMapping): Entry => ({
    id: identity(raw, mapping.id),
    values: Object.fromEntries(
        Object.entries(mapping.fields)
            .map(([name, field]) => [name, applyTransform(getPath(raw, field.path ?? name), field.transform, 'read')] as const)
            .filter(([, value]) => value !== undefined)
    ),
})

export interface ListResult {
    readonly items: readonly Entry[]
    readonly total?: number
}

const arrayAt = (body: unknown, path: string | undefined): unknown[] => {
    const raw = path === undefined ? body : getPath(body, path)

    return Array.isArray(raw) ? raw : fail(`No array found at "${path ?? '(root)'}"`)
}

const totalAt = (body: unknown, path: string | undefined): number | undefined => {
    const total = path === undefined ? Number.NaN : Number(getPath(body, path))

    return Number.isFinite(total) ? total : undefined
}

export const readList = (body: unknown, mapping: ListResponseMapping): ListResult => {
    const total = totalAt(body, mapping.totalPath)

    return {
        items: arrayAt(body, mapping.itemsPath).map((item) => mapEntry(item, mapping.entry)),
        ...(total === undefined ? {} : { total }),
    }
}

export const readEntry = (body: unknown, mapping: EntryResponseMapping): Entry =>
    mapEntry(mapping.itemPath === undefined ? body : getPath(body, mapping.itemPath), mapping.entry)
