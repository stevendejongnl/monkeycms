import { MappingError } from './mapping-error.ts'
import { getPath } from './path.ts'
import { applyTransform } from './transforms.ts'
import type { Entry, EntryMapping, EntryResponseMapping, ListResponseMapping } from './types.ts'


export const mapEntry = (raw: unknown, mapping: EntryMapping): Entry => {
    const id = getPath(raw, mapping.id)

    if (typeof id !== 'string' && typeof id !== 'number') {
        throw new MappingError(`No id found at "${mapping.id}"`)
    }

    const values: Record<string, unknown> = {}

    for (const [name, field] of Object.entries(mapping.fields)) {
        const value = applyTransform(getPath(raw, field.path ?? name), field.transform, 'read')

        if (value !== undefined) {
            values[name] = value
        }
    }

    return { id: String(id), values }
}

export interface ListResult {
    items: Entry[]
    total?: number
}

export const readList = (body: unknown, mapping: ListResponseMapping): ListResult => {
    const raw = mapping.itemsPath === undefined ? body : getPath(body, mapping.itemsPath)

    if (!Array.isArray(raw)) {
        throw new MappingError(`No array found at "${mapping.itemsPath ?? '(root)'}"`)
    }

    const result: ListResult = { items: raw.map((item) => mapEntry(item, mapping.entry)) }

    if (mapping.totalPath !== undefined) {
        const total = Number(getPath(body, mapping.totalPath))

        if (Number.isFinite(total)) {
            result.total = total
        }
    }

    return result
}

export const readEntry = (body: unknown, mapping: EntryResponseMapping): Entry =>
    mapEntry(mapping.itemPath === undefined ? body : getPath(body, mapping.itemPath), mapping.entry)
