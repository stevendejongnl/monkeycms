import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validateSchema } from './json-schema.ts'


const messages = (schema: Record<string, unknown>, value: unknown) =>
    validateSchema(schema, value).map(({ path, message }) => `${path}|${message}`)

describe('validateSchema', () => {
    it('should check types', () => {
        assert.deepEqual(messages({ type: 'string' }, 5), ['|must be a string'])
        assert.deepEqual(messages({ type: 'integer' }, 1.5), ['|must be an integer'])
        assert.deepEqual(messages({ type: 'object' }, []), ['|must be an object'])
        assert.deepEqual(messages({ type: 'number' }, 1), [])
    })

    it('should report the path of nested keys and array items', () => {
        const schema = { properties: { list: { items: { properties: { n: { type: 'number' } } } } } }

        assert.deepEqual(messages(schema, { list: [{ n: 1 }, { n: 'x' }] }), ['list[1].n|must be a number'])
    })

    it('should report missing and unknown keys', () => {
        const schema = { required: ['a'], properties: { a: {} }, additionalProperties: false }

        assert.deepEqual(messages(schema, { b: 1 }), ['a|is required', 'b|is not a known key'])
    })

    it('should validate the values of additionalProperties', () => {
        assert.deepEqual(messages({ additionalProperties: { type: 'string' } }, { a: 'x', b: 1 }), ['b|must be a string'])
    })

    it('should check enum, const, pattern and the minimums', () => {
        assert.deepEqual(messages({ enum: ['a', 'b'] }, 'c'), ['|must be one of: "a", "b"'])
        assert.deepEqual(messages({ const: 1 }, 2), ['|must be 1'])
        assert.deepEqual(messages({ pattern: '^a' }, 'b'), ['|must match the pattern ^a'])
        assert.deepEqual(messages({ minLength: 1 }, ''), ['|must not be empty'])
        assert.deepEqual(messages({ minimum: 1 }, 0), ['|must be at least 1'])
        assert.deepEqual(messages({ minItems: 2 }, [1]), ['|must have at least 2 items'])
        assert.deepEqual(messages({ minProperties: 1 }, {}), ['|must have at least 1 key'])
    })

    it('should check property names', () => {
        assert.deepEqual(messages({ propertyNames: { pattern: '^[a-z]+$' } }, { ok: 1, Bad: 2 }), ['Bad|the name "Bad" is not allowed'])
    })

    it('should follow local references', () => {
        const schema = { $defs: { name: { type: 'string' } }, properties: { a: { $ref: '#/$defs/name' } } }

        assert.deepEqual(messages(schema, { a: 1 }), ['a|must be a string'])
    })

    it('should accept a value that matches one branch', () => {
        const schema = { oneOf: [{ type: 'string' }, { type: 'number' }] }

        assert.deepEqual(messages(schema, 1), [])
    })

    it('should report the errors of the intended branch only', () => {
        const schema = {
            oneOf: [
                { type: 'object', required: ['k', 'a'], properties: { type: { const: 'x' }, a: { type: 'string' } } },
                { type: 'object', required: ['k', 'b'], properties: { type: { const: 'y' }, b: { type: 'string' } } },
            ],
        }

        assert.deepEqual(messages(schema, { type: 'y', b: 1 }), ['k|is required', 'b|must be a string'])
        assert.deepEqual(messages(schema, { type: 'z' }), ['|does not match any allowed shape'])
    })

    it('should ignore keywords it does not know', () => {
        assert.deepEqual(messages({ title: 'x', description: 'y', type: 'string' }, 'a'), [])
    })
})
