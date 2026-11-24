import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MappingError } from './mapping-error.ts'
import { buildUrl, interpolate, isUnderBaseUrl } from './template.ts'


describe('interpolate', () => {
    it('should fill in variables', () => {
        assert.equal(interpolate('/posts/{id}?page={page}', { id: 5, page: 2 }), '/posts/5?page=2')
    })

    it('should read nested variables and trim spaces', () => {
        assert.equal(interpolate('{ user.name }', { user: { name: 'Ada' } }), 'Ada')
    })

    it('should encode values when asked', () => {
        assert.equal(interpolate('{q}', { q: 'a b/c?d' }, true), 'a%20b%2Fc%3Fd')
    })

    it('should keep false and zero', () => {
        assert.equal(interpolate('{a}-{b}', { a: 0, b: false }), '0-false')
    })

    it('should name the missing variable', () => {
        assert.throws(() => interpolate('/posts/{id}', {}), (error: Error) =>
            error instanceof MappingError && error.message.includes('"id"') && error.message.includes('/posts/{id}'))
        assert.throws(() => interpolate('{id}', { id: null }), MappingError)
    })

    it('should refuse objects', () => {
        assert.throws(() => interpolate('{a}', { a: { b: 1 } }), MappingError)
    })

    it('should leave text without placeholders alone', () => {
        assert.equal(interpolate('/posts', {}), '/posts')
    })
})

describe('buildUrl', () => {
    const base = 'https://api.example.com/v1/'

    it('should place the path under the base URL', () => {
        assert.equal(buildUrl(base, '/posts/{id}', { id: 7 }), 'https://api.example.com/v1/posts/7')
    })

    it('should add query templates and extra query parameters', () => {
        const url = buildUrl(base, 'posts', { search: 'a b' }, { q: '{search}' }, { page: '2', limit: '20' })

        assert.equal(url, 'https://api.example.com/v1/posts?q=a+b&page=2&limit=20')
    })

    it('should encode path variables so they cannot add segments or change the host', () => {
        assert.equal(buildUrl(base, 'posts/{id}', { id: '../admin' }), 'https://api.example.com/v1/posts/..%2Fadmin')
        assert.equal(buildUrl(base, 'posts/{id}', { id: '@evil.com' }), 'https://api.example.com/v1/posts/%40evil.com')
    })

    it('should not let the path leave the base URL', () => {
        assert.equal(buildUrl(base, '//evil.com/x'), 'https://api.example.com/v1/evil.com/x')
        assert.equal(buildUrl(base, 'https://evil.com/x'), 'https://api.example.com/v1/https%3A//evil.com/x'.replace('%3A', ':'))
    })
})

describe('isUnderBaseUrl', () => {
    it('should compare the origin', () => {
        assert.equal(isUnderBaseUrl('https://api.example.com/x?page=2', 'https://api.example.com/v1'), true)
        assert.equal(isUnderBaseUrl('https://evil.com/x', 'https://api.example.com/v1'), false)
        assert.equal(isUnderBaseUrl('http://api.example.com/x', 'https://api.example.com/v1'), false)
        assert.equal(isUnderBaseUrl('not a url', 'https://api.example.com/v1'), false)
    })
})
