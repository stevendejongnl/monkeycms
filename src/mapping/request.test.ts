import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MappingError } from './mapping-error.ts'
import { buildRequest, mapEntryToBody } from './request.ts'
import type { EndpointMapping, RequestBodyMapping } from './types.ts'


const baseUrl = 'https://api.example.com'

describe('mapEntryToBody', () => {
    it('should rename and nest fields', () => {
        const mapping: RequestBodyMapping = {
            fields: { title: { path: 'post_title' }, author: { path: 'meta.author' }, views: {} },
        }

        assert.deepEqual(mapEntryToBody(mapping, { title: 'Hi', author: 'Ada', views: 3 }), {
            post_title: 'Hi',
            meta: { author: 'Ada' },
            views: 3,
        })
    })

    it('should wrap fields and add static values (JSON:API)', () => {
        const mapping: RequestBodyMapping = {
            wrap: 'data.attributes',
            fields: { title: {}, tags: { transform: { type: 'join', separator: ',' } } },
            static: { 'data.type': 'posts' },
        }

        assert.deepEqual(mapEntryToBody(mapping, { title: 'Hi', tags: 'a,b' }), {
            data: { type: 'posts', attributes: { title: 'Hi', tags: ['a', 'b'] } },
        })
    })

    it('should skip fields that the entry does not have', () => {
        assert.deepEqual(mapEntryToBody({ fields: { a: {}, b: {} } }, { a: 1 }), { a: 1 })
    })

    it('should keep false, zero and null values', () => {
        assert.deepEqual(mapEntryToBody({ fields: { a: {}, b: {}, c: {} } }, { a: false, b: 0, c: null }), { a: false, b: 0, c: null })
    })

    it('should refuse a JSON Pointer path together with wrap', () => {
        assert.throws(() => mapEntryToBody({ wrap: 'data', fields: { a: { path: '/x' } } }, { a: 1 }), MappingError)
    })

    it('should refuse paths that could change a prototype', () => {
        assert.throws(() => mapEntryToBody({ fields: { a: { path: '__proto__.x' } } }, { a: 1 }), MappingError)
    })
})

describe('buildRequest', () => {
    it('should build a read request', () => {
        const endpoint: EndpointMapping = { method: 'GET', path: '/posts/{id}' }

        assert.deepEqual(buildRequest({ baseUrl, endpoint, vars: { id: 5 } }), {
            method: 'GET',
            url: 'https://api.example.com/posts/5',
            headers: { accept: 'application/json' },
        })
    })

    it('should build a write request with a JSON body', () => {
        const endpoint: EndpointMapping = {
            method: 'POST',
            path: '/posts',
            body: { fields: { title: {} } },
        }
        const request = buildRequest({ baseUrl, endpoint, entry: { title: 'Hi' }, headers: { authorization: 'Bearer t' } })

        assert.equal(request.method, 'POST')
        assert.equal(request.body, '{"title":"Hi"}')
        assert.deepEqual(request.headers, { 'content-type': 'application/json', accept: 'application/json', authorization: 'Bearer t' })
    })

    it('should add the query templates and the pagination query', () => {
        const endpoint: EndpointMapping = { method: 'GET', path: '/posts', query: { search: '{search}' } }
        const request = buildRequest({ baseUrl, endpoint, vars: { search: 'cms' }, extraQuery: { page: '2' } })

        assert.equal(request.url, 'https://api.example.com/posts?search=cms&page=2')
    })

    it('should use a page URL under the base URL', () => {
        const endpoint: EndpointMapping = { method: 'GET', path: '/posts' }
        const request = buildRequest({ baseUrl, endpoint, pageUrl: 'https://api.example.com/posts?page=3' })

        assert.equal(request.url, 'https://api.example.com/posts?page=3')
    })

    it('should refuse a page URL outside the base URL', () => {
        const endpoint: EndpointMapping = { method: 'GET', path: '/posts' }

        assert.throws(() => buildRequest({ baseUrl, endpoint, pageUrl: 'https://evil.com/posts' }), MappingError)
    })

    it('should report a missing path variable', () => {
        assert.throws(() => buildRequest({ baseUrl, endpoint: { method: 'GET', path: '/posts/{id}' } }), MappingError)
    })
})
