import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MappingError } from './mapping-error.ts'
import { mapEntry, readEntry, readList } from './response.ts'
import type { EntryMapping } from './types.ts'


const entry: EntryMapping = {
    id: 'id',
    fields: {
        title: { path: 'title.rendered' },
        views: { transform: 'number' },
        tags: { transform: { type: 'join', separator: ', ' } },
        status: { transform: { type: 'default', value: 'draft' } },
    },
}

describe('mapEntry', () => {
    it('should map the id and the fields', () => {
        assert.deepEqual(mapEntry({ id: 7, title: { rendered: 'Hi' }, views: '3', tags: ['a', 'b'] }, entry), {
            id: '7',
            values: { title: 'Hi', views: 3, tags: 'a, b', status: 'draft' },
        })
    })

    it('should leave out fields that are missing', () => {
        assert.deepEqual(mapEntry({ id: 'a' }, entry).values, { status: 'draft' })
    })

    it('should refuse an item without an id', () => {
        assert.throws(() => mapEntry({ title: {} }, entry), (error: Error) => error instanceof MappingError && error.message.includes('"id"'))
        assert.throws(() => mapEntry({ id: { a: 1 } }, entry), MappingError)
    })

    it('should refuse a value that the transform cannot handle', () => {
        assert.throws(() => mapEntry({ id: 1, views: 'many' }, entry), MappingError)
    })
})

describe('readList', () => {
    it('should read items and total from an envelope', () => {
        const body = { data: [{ id: 1 }, { id: 2 }], meta: { total: '12' } }
        const result = readList(body, { itemsPath: 'data', totalPath: 'meta.total', entry })

        assert.deepEqual(result.items.map((item) => item.id), ['1', '2'])
        assert.equal(result.total, 12)
    })

    it('should read a root array', () => {
        const result = readList([{ id: 1 }], { entry })

        assert.equal(result.items.length, 1)
        assert.equal(result.total, undefined)
    })

    it('should ignore a total that is not a number', () => {
        assert.equal(readList({ data: [], total: 'x' }, { itemsPath: 'data', totalPath: 'total', entry }).total, undefined)
        assert.equal(readList({ data: [] }, { itemsPath: 'data', totalPath: 'total', entry }).total, undefined)
    })

    it('should refuse a response without an array', () => {
        assert.throws(() => readList({ data: {} }, { itemsPath: 'data', entry }), MappingError)
        assert.throws(() => readList(null, { entry }), MappingError)
    })
})

describe('readEntry', () => {
    it('should read one item, wrapped or not', () => {
        assert.equal(readEntry({ data: { id: 3 } }, { itemPath: 'data', entry }).id, '3')
        assert.equal(readEntry({ id: 4 }, { entry }).id, '4')
    })
})
