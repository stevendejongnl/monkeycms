import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MappingError } from './mapping-error.ts'
import { applyTransform } from './transforms.ts'


describe('applyTransform', () => {
    it('should return the value when there is no transform', () => {
        assert.equal(applyTransform('x', undefined, 'read'), 'x')
    })

    it('should pass null and undefined through', () => {
        for (const transform of ['string', 'number', 'boolean', 'date'] as const) {
            assert.equal(applyTransform(undefined, transform, 'read'), undefined)
            assert.equal(applyTransform(null, transform, 'read'), null)
        }
    })

    it('should convert to string', () => {
        assert.equal(applyTransform(12, 'string', 'read'), '12')
        assert.equal(applyTransform(true, 'string', 'read'), 'true')
        assert.throws(() => applyTransform({}, 'string', 'read'), MappingError)
    })

    it('should convert to number', () => {
        assert.equal(applyTransform('12.5', 'number', 'read'), 12.5)
        assert.equal(applyTransform(3, 'number', 'write'), 3)
        for (const bad of ['', '  ', 'abc', true, [], {}]) {
            assert.throws(() => applyTransform(bad, 'number', 'read'), MappingError, JSON.stringify(bad))
        }
    })

    it('should convert to boolean', () => {
        assert.equal(applyTransform('TRUE', 'boolean', 'read'), true)
        assert.equal(applyTransform('0', 'boolean', 'read'), false)
        assert.equal(applyTransform(1, 'boolean', 'read'), true)
        assert.equal(applyTransform(false, 'boolean', 'read'), false)
        assert.throws(() => applyTransform('yes', 'boolean', 'read'), MappingError)
    })

    it('should convert dates to ISO strings', () => {
        assert.equal(applyTransform('2026-11-24T10:00:00+01:00', 'date', 'read'), '2026-11-24T09:00:00.000Z')
        assert.equal(applyTransform(0, 'date', 'read'), '1970-01-01T00:00:00.000Z')
        assert.throws(() => applyTransform('not a date', 'date', 'read'), MappingError)
        assert.throws(() => applyTransform(true, 'date', 'read'), MappingError)
    })

    it('should join on read and split on write', () => {
        const join = { type: 'join', separator: ', ' } as const

        assert.equal(applyTransform(['a', 'b'], join, 'read'), 'a, b')
        assert.deepEqual(applyTransform('a, b', join, 'write'), ['a', 'b'])
        assert.throws(() => applyTransform('a', join, 'read'), MappingError)
    })

    it('should split on read and join on write', () => {
        const split = { type: 'split', separator: ',' } as const

        assert.deepEqual(applyTransform('a,b', split, 'read'), ['a', 'b'])
        assert.equal(applyTransform(['a', 'b'], split, 'write'), 'a,b')
        assert.throws(() => applyTransform(5, split, 'read'), MappingError)
    })

    it('should fill in a default for missing values only', () => {
        const fallback = { type: 'default', value: 'none' } as const

        assert.equal(applyTransform(undefined, fallback, 'read'), 'none')
        assert.equal(applyTransform(null, fallback, 'read'), 'none')
        assert.equal(applyTransform('', fallback, 'read'), '')
        assert.equal(applyTransform(0, fallback, 'read'), 0)
    })
})
