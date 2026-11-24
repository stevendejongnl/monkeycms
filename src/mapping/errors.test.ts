import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readError } from './errors.ts'


describe('readError', () => {
    it('should read the message and the field errors', () => {
        const body = { error: { message: 'Invalid', fields: { title: ['too short', 'required'], slug: 'taken', bad: 5 } } }

        assert.deepEqual(readError(422, body, { messagePath: 'error.message', fieldErrorsPath: 'error.fields' }), {
            status: 422,
            message: 'Invalid',
            fieldErrors: { title: 'too short, required', slug: 'taken' },
        })
    })

    it('should fall back to the HTTP status', () => {
        assert.equal(readError(500, 'oops').message, 'HTTP 500')
        assert.equal(readError(404, { message: 5 }, { messagePath: 'message' }).message, 'HTTP 404')
        assert.equal(readError(404, { message: '' }, { messagePath: 'message' }).message, 'HTTP 404')
        assert.equal(readError(404, null, { messagePath: 'message' }).message, 'HTTP 404')
    })

    it('should ignore field errors that are not an object', () => {
        assert.deepEqual(readError(400, { errors: ['a'] }, { fieldErrorsPath: 'errors' }).fieldErrors, {})
        assert.deepEqual(readError(400, {}, { fieldErrorsPath: 'errors' }).fieldErrors, {})
    })
})
