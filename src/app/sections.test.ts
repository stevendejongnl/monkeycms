import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { FieldConfig } from '../config/main.ts'
import { sectionsOf } from './sections.ts'


const text: FieldConfig = { type: 'text' }
const fields = { title: text, body: text, status: text, tags: text }

const shape = (result: ReturnType<typeof sectionsOf>) => result.map(({ title, fields: entries }) => [title, entries.map(([name]) => name)])

describe('sectionsOf', () => {
    it('should give one group without a title when there are no sections', () => {
        assert.deepEqual(shape(sectionsOf({ fields })), [['', ['title', 'body', 'status', 'tags']]])
    })

    it('should keep the order of the sections and of the fields in them', () => {
        assert.deepEqual(shape(sectionsOf({ fields, sections: [{ title: 'Publishing', fields: ['status', 'tags'] }, { title: 'Content', fields: ['body', 'title'] }] })), [
            ['Publishing', ['status', 'tags']],
            ['Content', ['body', 'title']],
        ])
    })

    it('should put the fields that are in no section in a last group', () => {
        assert.deepEqual(shape(sectionsOf({ fields, sections: [{ title: 'Content', fields: ['title'] }] })), [
            ['Content', ['title']],
            ['Other', ['body', 'status', 'tags']],
        ])
    })
})
