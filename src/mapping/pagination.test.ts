import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { firstPage, nextPage, pageQuery, parseLinkHeader } from './pagination.ts'
import type { Pagination } from './types.ts'


const baseUrl = 'https://api.example.com'
const result = (itemCount: number, extra = {}) => ({ body: {}, headers: {}, itemCount, ...extra })

describe('pageQuery', () => {
    it('should ask for a page and a limit', () => {
        const pagination: Pagination = { type: 'page', pageParam: 'page', limitParam: 'per_page', pageSize: 20 }

        assert.deepEqual(pageQuery(pagination, firstPage), { page: '1', per_page: '20' })
        assert.deepEqual(pageQuery(pagination, { index: 2 }), { page: '3', per_page: '20' })
    })

    it('should support pages that start at zero', () => {
        const pagination: Pagination = { type: 'page', pageParam: 'p', limitParam: 'n', pageSize: 5, startPage: 0 }

        assert.deepEqual(pageQuery(pagination, { index: 1 }), { p: '1', n: '5' })
    })

    it('should ask for an offset and a limit', () => {
        const pagination: Pagination = { type: 'offset', offsetParam: 'offset', limitParam: 'limit', pageSize: 25 }

        assert.deepEqual(pageQuery(pagination, { index: 2 }), { offset: '50', limit: '25' })
    })

    it('should send the cursor only after the first page', () => {
        const pagination: Pagination = { type: 'cursor', cursorParam: 'after', limitParam: 'limit', nextCursorPath: 'next', pageSize: 10 }

        assert.deepEqual(pageQuery(pagination, firstPage), { limit: '10' })
        assert.deepEqual(pageQuery(pagination, { index: 1, cursor: 'abc' }), { after: 'abc', limit: '10' })
    })

    it('should send nothing for none, and for link-header pages after the first', () => {
        assert.deepEqual(pageQuery({ type: 'none' }, firstPage), {})
        assert.deepEqual(pageQuery({ type: 'link-header', pageSize: 10, limitParam: 'limit' }, firstPage), { limit: '10' })
        assert.deepEqual(pageQuery({ type: 'link-header', pageSize: 10, limitParam: 'limit' }, { index: 1, url: 'https://x' }), {})
    })
})

describe('nextPage', () => {
    const page: Pagination = { type: 'page', pageParam: 'page', limitParam: 'limit', pageSize: 10 }

    it('should stop for none', () => {
        assert.equal(nextPage({ type: 'none' }, firstPage, result(5), baseUrl), null)
    })

    it('should use the total when the API gives one', () => {
        assert.deepEqual(nextPage(page, firstPage, result(10, { total: 25 }), baseUrl), { index: 1 })
        assert.deepEqual(nextPage(page, { index: 1 }, result(10, { total: 25 }), baseUrl), { index: 2 })
        assert.equal(nextPage(page, { index: 2 }, result(5, { total: 25 }), baseUrl), null)
        assert.equal(nextPage(page, { index: 1 }, result(10, { total: 20 }), baseUrl), null)
    })

    it('should guess from the page size when there is no total', () => {
        assert.deepEqual(nextPage(page, firstPage, result(10), baseUrl), { index: 1 })
        assert.equal(nextPage(page, firstPage, result(9), baseUrl), null)
        assert.equal(nextPage(page, firstPage, result(0), baseUrl), null)
    })

    it('should use the same logic for offsets', () => {
        const offset: Pagination = { type: 'offset', offsetParam: 'o', limitParam: 'l', pageSize: 10 }

        assert.deepEqual(nextPage(offset, firstPage, result(10, { total: 11 }), baseUrl), { index: 1 })
        assert.equal(nextPage(offset, { index: 1 }, result(1, { total: 11 }), baseUrl), null)
    })

    it('should follow the cursor from the body', () => {
        const cursor: Pagination = { type: 'cursor', cursorParam: 'after', nextCursorPath: 'meta.next', pageSize: 10 }

        assert.deepEqual(nextPage(cursor, firstPage, result(10, { body: { meta: { next: 'abc' } } }), baseUrl), { index: 1, cursor: 'abc' })
        assert.deepEqual(nextPage(cursor, firstPage, result(10, { body: { meta: { next: 42 } } }), baseUrl), { index: 1, cursor: '42' })
        assert.equal(nextPage(cursor, firstPage, result(10, { body: { meta: { next: null } } }), baseUrl), null)
        assert.equal(nextPage(cursor, firstPage, result(10, { body: { meta: { next: '' } } }), baseUrl), null)
        assert.equal(nextPage(cursor, firstPage, result(10, { body: {} }), baseUrl), null)
    })

    it('should follow the next link', () => {
        const link: Pagination = { type: 'link-header', pageSize: 10 }
        const headers = { Link: '<https://api.example.com/posts?page=2>; rel="next", <https://api.example.com/posts?page=9>; rel="last"' }

        assert.deepEqual(nextPage(link, firstPage, result(10, { headers }), baseUrl), { index: 1, url: 'https://api.example.com/posts?page=2' })
        assert.equal(nextPage(link, firstPage, result(10), baseUrl), null)
    })

    it('should not follow a next link to another host', () => {
        const link: Pagination = { type: 'link-header', pageSize: 10 }
        const headers = { link: '<https://evil.com/posts?page=2>; rel="next"' }

        assert.equal(nextPage(link, firstPage, result(10, { headers }), baseUrl), null)
    })
})

describe('parseLinkHeader', () => {
    it('should read relations and URLs', () => {
        assert.deepEqual(
            parseLinkHeader('<https://a.test/?page=2>; rel="next", <https://a.test/?page=1>; rel=prev'),
            { next: 'https://a.test/?page=2', prev: 'https://a.test/?page=1' }
        )
    })

    it('should handle several relations on one link, other parameters and URLs with commas', () => {
        assert.deepEqual(
            parseLinkHeader('<https://a.test/x?ids=1,2>; title="t"; rel="next last"'),
            { next: 'https://a.test/x?ids=1,2', last: 'https://a.test/x?ids=1,2' }
        )
    })

    it('should return nothing for an empty or odd header', () => {
        assert.deepEqual(parseLinkHeader(''), {})
        assert.deepEqual(parseLinkHeader('nonsense'), {})
        assert.deepEqual(parseLinkHeader('<https://a.test>'), {})
    })
})
