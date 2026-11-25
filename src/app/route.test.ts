import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hrefOf, parseRoute } from './route.ts'


describe('parseRoute', () => {
    it('should read each view', () => {
        assert.deepEqual(parseRoute(''), { view: 'home' })
        assert.deepEqual(parseRoute('#/'), { view: 'home' })
        assert.deepEqual(parseRoute('#/posts'), { view: 'list', collection: 'posts' })
        assert.deepEqual(parseRoute('#/posts/new'), { view: 'new', collection: 'posts' })
        assert.deepEqual(parseRoute('#/posts/12'), { view: 'edit', collection: 'posts', id: '12' })
    })

    it('should decode what the href encoded', () => {
        assert.deepEqual(parseRoute('#/posts/a%2Fb%20c'), { view: 'edit', collection: 'posts', id: 'a/b c' })
    })

    it('should treat a hash that means nothing as home', () => {
        assert.deepEqual(parseRoute('#/posts/1/extra'), { view: 'home' })
        assert.deepEqual(parseRoute('#posts'), { view: 'list', collection: 'posts' })
        assert.deepEqual(parseRoute('#/posts/%E0%A4%A'), { view: 'edit', collection: 'posts', id: '%E0%A4%A' })
    })
})

describe('hrefOf', () => {
    it('should give the hash of each view, and parseRoute reads it back', () => {
        const routes = [
            { view: 'home' },
            { view: 'list', collection: 'posts' },
            { view: 'new', collection: 'posts' },
            { view: 'edit', collection: 'posts', id: 'a/b c?' },
        ] as const

        routes.forEach((route) => assert.deepEqual(parseRoute(hrefOf(route)), route))
        assert.equal(hrefOf({ view: 'edit', collection: 'posts', id: 'a/b' }), '#/posts/a%2Fb')
    })
})
