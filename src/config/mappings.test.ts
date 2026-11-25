import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildRequest, firstPage, mapEntry, nextPage, pageQuery, readError, readList } from '../mapping/main.ts'
import { blogConfig } from './fixtures.ts'
import { bodyMappingOf, endpointOf, entryMappingOf, errorsOf, headersOf, listResponseOf, paginationOf } from './mappings.ts'
import type { CollectionConfig } from './types.ts'


const posts = blogConfig.collections['posts'] as CollectionConfig

const without = (collection: CollectionConfig, key: keyof CollectionConfig): CollectionConfig =>
    Object.fromEntries(Object.entries(collection).filter(([name]) => name !== key)) as unknown as CollectionConfig

describe('mappings from the config', () => {
    it('should default the id path and the field paths', () => {
        const mapping = entryMappingOf({ fields: { name: { type: 'text' } }, list: { path: '/x' } })

        assert.deepEqual(mapping, { id: 'id', fields: { name: {} } })
    })

    it('should take the method from the operation, unless the config sets one', () => {
        assert.equal(endpointOf(posts, 'list')?.method, 'GET')
        assert.equal(endpointOf(posts, 'create')?.method, 'POST')
        assert.equal(endpointOf(posts, 'update')?.method, 'PATCH')
        assert.equal(endpointOf(posts, 'delete')?.method, 'DELETE')
    })

    it('should return nothing for an operation the collection does not have', () => {
        assert.equal(endpointOf(without(posts, 'delete'), 'delete'), undefined)
    })

    it('should leave read-only fields out of the request body', () => {
        const mapping = bodyMappingOf(posts, posts.create as NonNullable<typeof posts.create>)

        assert.deepEqual(Object.keys(mapping.fields), ['title', 'body', 'status', 'tags'])
        assert.equal(mapping.wrap, 'data')
    })

    it('should send a body for create and update, not for list, get or delete', () => {
        assert.ok(endpointOf(posts, 'create')?.body)
        assert.ok(endpointOf(posts, 'update')?.body)
        assert.equal(endpointOf(posts, 'list')?.body, undefined)
        assert.equal(endpointOf(posts, 'get')?.body, undefined)
        assert.equal(endpointOf(posts, 'delete')?.body, undefined)
    })

    it('should use the pagination of the collection, then of the config, then none', () => {
        assert.equal(paginationOf(blogConfig, posts).type, 'page')
        assert.equal(paginationOf({ ...blogConfig, pagination: undefined } as never, posts).type, 'none')
        assert.equal(paginationOf(blogConfig, { ...posts, list: { ...posts.list, pagination: { type: 'none' } } }).type, 'none')
    })

    it('should merge the headers of the config and the endpoint', () => {
        const collection = { ...posts, get: { path: '/posts/{id}', headers: { 'x-extra': '1' } } } as CollectionConfig

        assert.deepEqual(headersOf(blogConfig, collection, 'get'), { 'x-client': 'monkeycms', 'x-extra': '1' })
        assert.deepEqual(headersOf(blogConfig, posts, 'list'), { 'x-client': 'monkeycms' })
    })
})

// The config and the engine together, the way the API client will use them.
describe('config with the mapping engine', () => {
    const baseUrl = blogConfig.baseUrl

    it('should build the list request and read the response', () => {
        const endpoint = endpointOf(posts, 'list')!
        const pagination = paginationOf(blogConfig, posts)
        const request = buildRequest({ baseUrl, endpoint, extraQuery: pageQuery(pagination, firstPage), headers: headersOf(blogConfig, posts, 'list') })

        assert.equal(request.url, 'https://api.example.com/v1/posts?sort=-created_at&page=1&per_page=20')
        assert.equal(request.headers['x-client'], 'monkeycms')

        const body = {
            data: [{ id: 1, attributes: { title: 'Hi', tags: ['a', 'b'], created_at: '2026-11-24T10:00:00Z' } }],
            meta: { total: 45 },
        }
        const result = readList(body, listResponseOf(posts))

        assert.deepEqual(result.items[0], {
            id: '1',
            values: { title: 'Hi', tags: 'a, b', createdAt: '2026-11-24T10:00:00.000Z' },
        })
        assert.deepEqual(nextPage(pagination, firstPage, { body, headers: {}, itemCount: 1, total: 45 }, baseUrl), { index: 1 })
    })

    it('should build the create request in the JSON:API shape', () => {
        const request = buildRequest({ baseUrl, endpoint: endpointOf(posts, 'create')!, entry: { title: 'Hi', tags: 'a, b', createdAt: 'ignored' } })

        assert.equal(request.method, 'POST')
        assert.deepEqual(JSON.parse(request.body ?? ''), { data: { type: 'posts', attributes: { title: 'Hi', tags: ['a', 'b'] } } })
    })

    it('should build the update request with the id in the path', () => {
        const request = buildRequest({ baseUrl, endpoint: endpointOf(posts, 'update')!, vars: { id: 7 }, entry: { title: 'New' } })

        assert.equal(request.method, 'PATCH')
        assert.equal(request.url, 'https://api.example.com/v1/posts/7')
    })

    it('should read an error response', () => {
        const error = readError(422, { error: { message: 'Invalid', fields: { title: ['required'] } } }, errorsOf(blogConfig))

        assert.deepEqual(error, { status: 422, message: 'Invalid', fieldErrors: { title: 'required' } })
    })

    it('should read one entry', () => {
        assert.equal(mapEntry({ id: 'x', attributes: { title: 'T' } }, entryMappingOf(posts)).values['title'], 'T')
    })
})
