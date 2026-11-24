import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getPath, parsePath, setPath } from './path.ts'
import { MappingError } from './mapping-error.ts'


describe('parsePath', () => {
    it('should split dot notation and array indexes', () => {
        assert.deepEqual(parsePath('data.items[0].name'), ['data', 'items', '0', 'name'])
        assert.deepEqual(parsePath('[0].name'), ['0', 'name'])
    })

    it('should read JSON Pointer with escapes', () => {
        assert.deepEqual(parsePath('/data/a~1b/c~0d'), ['data', 'a/b', 'c~d'])
    })

    it('should treat an empty path as the root', () => {
        assert.deepEqual(parsePath(''), [])
    })

    it('should refuse an empty segment', () => {
        assert.throws(() => parsePath('a..b'), MappingError)
        assert.throws(() => parsePath('a.'), MappingError)
    })
})

describe('getPath', () => {
    const body = { data: { items: [{ name: 'one' }, { name: 'two' }] }, 'a.b': 1, nothing: null }

    it('should read nested values and array items', () => {
        assert.equal(getPath(body, 'data.items[1].name'), 'two')
        assert.equal(getPath(body, '/data/items/0/name'), 'one')
        assert.equal(getPath(body, 'data.items.0.name'), 'one')
    })

    it('should return the whole value for the root path', () => {
        assert.equal(getPath(body, ''), body)
    })

    it('should return undefined for anything missing', () => {
        assert.equal(getPath(body, 'data.nope.deeper'), undefined)
        assert.equal(getPath(body, 'data.items[5]'), undefined)
        assert.equal(getPath(body, 'data.items.name'), undefined)
        assert.equal(getPath(body, 'nothing.deeper'), undefined)
        assert.equal(getPath(undefined, 'a'), undefined)
    })

    it('should reach a key that contains a dot with JSON Pointer', () => {
        assert.equal(getPath(body, '/a.b'), 1)
    })

    it('should not read inherited properties', () => {
        assert.equal(getPath({}, 'constructor'), undefined)
        assert.equal(getPath({}, '__proto__'), undefined)
        assert.equal(getPath([], 'length'), undefined)
    })
})

describe('setPath', () => {
    it('should create nested objects', () => {
        assert.deepEqual(setPath({}, 'data.attributes.title', 'x'), { data: { attributes: { title: 'x' } } })
    })

    it('should create arrays for numeric segments', () => {
        const tags = setPath({}, 'tags[1]', 'b')['tags']

        assert.ok(Array.isArray(tags))
        assert.equal(tags.length, 2)
        assert.equal(tags[1], 'b')
    })

    it('should keep existing values next to the new one', () => {
        assert.deepEqual(setPath({ data: { type: 'post' } }, 'data.id', '5'), { data: { type: 'post', id: '5' } })
    })

    it('should overwrite a value that is not an object on the way', () => {
        assert.deepEqual(setPath({ a: 'text' }, 'a.b', 1), { a: { b: 1 } })
    })

    it('should refuse an empty path', () => {
        assert.throws(() => setPath({}, '', 1), MappingError)
    })

    it('should refuse paths that could change a prototype', () => {
        for (const path of ['__proto__.polluted', 'a.__proto__.polluted', 'constructor.prototype.polluted', '/__proto__/polluted']) {
            assert.throws(() => setPath({}, path, true), MappingError, path)
        }
        assert.equal(({} as Record<string, unknown>)['polluted'], undefined)
    })

    it('should refuse a name segment on an array', () => {
        assert.throws(() => setPath({ list: [] }, 'list.name', 1), MappingError)
    })
})
