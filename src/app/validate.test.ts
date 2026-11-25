import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { displayValue } from './display.ts'
import { emptyEntry, hasChanged, validateEntry } from './validate.ts'
import type { CollectionConfig } from '../config/main.ts'


const fields: CollectionConfig['fields'] = {
    title: { type: 'text', required: true },
    price: { type: 'number' },
    status: { type: 'select', options: ['draft', 'published'] },
    featured: { type: 'boolean', required: true },
    created: { type: 'date', required: true, readOnly: true },
}

describe('validateEntry', () => {
    it('should accept a good entry', () => {
        assert.deepEqual(validateEntry(fields, { title: 'Hi', price: 0, status: 'draft', featured: false }), {})
    })

    it('should ask for a required field, also when it is an empty string', () => {
        assert.deepEqual(validateEntry(fields, { title: '' }), { title: 'This field is required' })
        assert.deepEqual(validateEntry(fields, {}), { title: 'This field is required' })
    })

    it('should not ask for a switch, and not check a read-only field', () => {
        assert.deepEqual(validateEntry(fields, { title: 'Hi' }), {})
    })

    it('should refuse a value that is not a number or not an option', () => {
        assert.deepEqual(validateEntry(fields, { title: 'Hi', price: Number.NaN, status: 'archived' }), {
            price: 'Enter a number',
            status: 'Choose one of the options',
        })
    })

    it('should start a new entry with a switch that is off', () => {
        assert.deepEqual(emptyEntry(fields), { title: undefined, price: undefined, status: undefined, featured: false, created: undefined })
    })
})

describe('hasChanged', () => {
    it('should see a changed value, and ignore other keys', () => {
        assert.equal(hasChanged(fields, { title: 'a' }, { title: 'b' }), true)
        assert.equal(hasChanged(fields, { title: 'a', other: 1 }, { title: 'a', other: 2 }), false)
    })

    it('should treat undefined, null and an empty string as the same', () => {
        assert.equal(hasChanged(fields, { title: undefined }, { title: '' }), false)
        assert.equal(hasChanged(fields, { price: 0 }, { price: undefined }), true)
    })
})

describe('displayValue', () => {
    it('should show each type as text', () => {
        assert.equal(displayValue({ type: 'boolean' }, true), 'Yes')
        assert.equal(displayValue({ type: 'boolean' }, false), 'No')
        assert.equal(displayValue({ type: 'date' }, '2026-11-25T08:30:00.000Z'), '2026-11-25')
        assert.equal(displayValue({ type: 'text' }, ['a', 'b']), 'a, b')
        assert.equal(displayValue({ type: 'number' }, 0), '0')
        assert.equal(displayValue({ type: 'text' }, undefined), '')
        assert.equal(displayValue({ type: 'text' }, { a: 1 }), '{"a":1}')
    })
})
