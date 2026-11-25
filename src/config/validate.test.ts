import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { blogConfig } from './fixtures.ts'
import { ConfigError, parseConfig, validateConfig } from './validate.ts'


const issuesOf = (config: unknown): string[] => {
    const result = validateConfig(config)

    return result.ok ? [] : result.issues.map(({ path, message }) => `${path}|${message}`)
}

// A copy of the blog config with one change, given as a function on the copy.
const changed = (change: (config: any) => void): unknown => {
    const copy = structuredClone(blogConfig)

    change(copy)

    return copy
}

describe('validateConfig', () => {
    it('should accept a full config', () => {
        const result = validateConfig(blogConfig)

        assert.ok(result.ok)
        assert.equal(result.config.baseUrl, 'https://api.example.com/v1')
    })

    it('should accept the smallest config', () => {
        const minimal = {
            configVersion: 1,
            baseUrl: 'http://localhost:3000',
            collections: { notes: { fields: { text: { type: 'text' } }, list: { path: '/notes' } } },
        }

        assert.deepEqual(issuesOf(minimal), [])
    })

    it('should refuse input that is not an object', () => {
        assert.deepEqual(issuesOf(null), ['|must be an object'])
        assert.deepEqual(issuesOf('{}'), ['|must be an object'])
    })

    it('should report missing top level keys', () => {
        assert.deepEqual(issuesOf({}), ['configVersion|is required', 'baseUrl|is required', 'collections|is required'])
    })

    it('should refuse another config version', () => {
        assert.deepEqual(issuesOf(changed((c) => { c.configVersion = 2 })), ['configVersion|must be 1'])
    })

    it('should refuse unknown keys, so a typo is not silently ignored', () => {
        assert.deepEqual(issuesOf(changed((c) => { c.collections.posts.list.itemspath = 'data' })), [
            'collections.posts.list.itemspath|is not a known key',
        ])
    })

    it('should give the path of a bad field', () => {
        assert.deepEqual(issuesOf(changed((c) => { c.collections.posts.fields.title.type = 'richtext' })), [
            'collections.posts.fields.title.type|must be one of: "text", "longtext", "number", "boolean", "date", "select"',
        ])
    })

    it('should refuse bad collection and field names', () => {
        assert.deepEqual(issuesOf(changed((c) => { c.collections['Bad Name'] = c.collections.posts })), [
            'collections.Bad Name|the name "Bad Name" is not allowed',
        ])
        assert.deepEqual(issuesOf(changed((c) => { c.collections.posts.fields['1st'] = { type: 'text' } })), [
            'collections.posts.fields.1st|the name "1st" is not allowed',
        ])
    })

    it('should refuse an empty list of collections or fields', () => {
        assert.deepEqual(issuesOf(changed((c) => { c.collections = {} })), ['collections|must have at least 1 key'])
        assert.deepEqual(issuesOf(changed((c) => { c.collections.posts.fields = {} })), ['collections.posts.fields|must have at least 1 key'])
    })

    it('should check the pagination shape of its type', () => {
        assert.deepEqual(issuesOf(changed((c) => { c.pagination = { type: 'page', pageParam: 'p', pageSize: 0 } })), [
            'pagination.limitParam|is required',
            'pagination.pageSize|must be at least 1',
        ])
        assert.deepEqual(issuesOf(changed((c) => { c.pagination = { type: 'infinite' } })), ['pagination|does not match any allowed shape'])
    })

    it('should accept every pagination type', () => {
        const all = [
            { type: 'none' },
            { type: 'page', pageParam: 'p', limitParam: 'l', pageSize: 10, startPage: 0 },
            { type: 'offset', offsetParam: 'o', limitParam: 'l', pageSize: 10 },
            { type: 'cursor', cursorParam: 'after', nextCursorPath: 'meta.next', pageSize: 10 },
            { type: 'link-header', pageSize: 10 },
        ]

        all.forEach((pagination) => assert.deepEqual(issuesOf(changed((c) => { c.pagination = pagination })), [], pagination.type))
    })

    it('should check transforms', () => {
        assert.deepEqual(issuesOf(changed((c) => { c.collections.posts.fields.tags.transform = 'uppercase' })), [
            'collections.posts.fields.tags.transform|must be one of: "string", "number", "boolean", "date"',
        ])
        assert.deepEqual(issuesOf(changed((c) => { c.collections.posts.fields.tags.transform = { type: 'join' } })), [
            'collections.posts.fields.tags.transform.separator|is required',
        ])
        assert.deepEqual(issuesOf(changed((c) => { c.collections.posts.fields.tags.transform = { type: 'eval', code: '1' } })), [
            'collections.posts.fields.tags.transform|does not match any allowed shape',
        ])
    })

    it('should check types of header and query values', () => {
        assert.deepEqual(issuesOf(changed((c) => { c.headers['x-n'] = 5 })), ['headers.x-n|must be a string'])
        assert.deepEqual(issuesOf(changed((c) => { c.collections.posts.list.query.sort = true })), ['collections.posts.list.query.sort|must be a string'])
    })

    it('should accept only http and https base URLs', () => {
        assert.deepEqual(issuesOf(changed((c) => { c.baseUrl = 'ftp://example.com' })), ['baseUrl|must be an http or https URL'])
        assert.deepEqual(issuesOf(changed((c) => { c.baseUrl = 'javascript:alert(1)' })), ['baseUrl|must be an http or https URL'])
        assert.deepEqual(issuesOf(changed((c) => { c.baseUrl = 'api.example.com' })), ['baseUrl|must be an http or https URL'])
    })

    it('should report an invalid path with its place in the config', () => {
        assert.deepEqual(issuesOf(changed((c) => { c.collections.posts.list.itemsPath = 'data..items' })), [
            'collections.posts.list.itemsPath|is not a valid path: Invalid path "data..items"',
        ])
        assert.deepEqual(issuesOf(changed((c) => { c.collections.posts.fields.title.path = 'a.' })), [
            'collections.posts.fields.title.path|is not a valid path: Invalid path "a."',
        ])
        assert.deepEqual(issuesOf(changed((c) => { c.collections.posts.create.body.wrap = '.x.' })).length, 1)
    })

    it('should need {id} in the paths of get, update and delete', () => {
        assert.deepEqual(issuesOf(changed((c) => { c.collections.posts.get.path = '/posts' })), ['collections.posts.get.path|must contain {id}'])
        assert.deepEqual(issuesOf(changed((c) => { c.collections.posts.delete.path = '/posts/x' })), ['collections.posts.delete.path|must contain {id}'])
        assert.deepEqual(issuesOf(changed((c) => { c.collections.posts.create.path = '/posts' })), [])
    })

    it('should need options for select fields, and only for select fields', () => {
        assert.deepEqual(issuesOf(changed((c) => { delete c.collections.posts.fields.status.options })), [
            'collections.posts.fields.status.options|is required for a select field',
        ])
        assert.deepEqual(issuesOf(changed((c) => { c.collections.posts.fields.title.options = ['a'] })), [
            'collections.posts.fields.title.options|is only allowed for a select field',
        ])
    })

    it('should accept a search parameter and refuse a bad one', () => {
        assert.deepEqual(issuesOf(changed((c) => { c.collections.posts.list.searchParam = 'q' })), [])
        assert.deepEqual(issuesOf(changed((c) => { c.collections.posts.list.searchParam = 'a b' })), [
            'collections.posts.list.searchParam|must match the pattern ^[A-Za-z0-9_.-]+$',
        ])
    })

    it('should accept every auth type', () => {
        const all = [
            { type: 'none' },
            { type: 'bearer', persist: 'session' },
            { type: 'apiKey', name: 'x-api-key', in: 'header' },
            { type: 'apiKey', name: 'key', in: 'query' },
            { type: 'basic' },
            { type: 'cookie' },
            { type: 'cookie', path: '/session', usernameField: 'email' },
            { type: 'login', path: '/login', tokenPath: 'data.token', expiresInPath: 'data.expires_in', header: 'x-token', scheme: '' },
        ]

        all.forEach((auth) => assert.deepEqual(issuesOf(changed((c) => { c.auth = auth })), [], JSON.stringify(auth)))
    })

    it('should refuse an auth type that does not exist', () => {
        assert.deepEqual(issuesOf(changed((c) => { c.auth = { type: 'oauth' } })), ['auth|does not match any allowed shape'])
    })

    it('should report what is missing or wrong in an auth block', () => {
        assert.deepEqual(issuesOf(changed((c) => { c.auth = { type: 'login', path: '/login' } })), ['auth.tokenPath|is required'])
        assert.deepEqual(issuesOf(changed((c) => { c.auth = { type: 'apiKey', name: 'k' } })), ['auth.in|is required'])
        assert.deepEqual(issuesOf(changed((c) => { c.auth = { type: 'apiKey', name: 'bad name', in: 'cookie' } })), [
            'auth.name|must match the pattern ^[A-Za-z0-9_.-]+$',
            'auth.in|must be one of: "header", "query"',
        ])
        assert.deepEqual(issuesOf(changed((c) => { c.auth = { type: 'bearer', persist: 'forever' } })), [
            'auth.persist|must be one of: "memory", "session"',
        ])
    })

    it('should not take a secret in the config', () => {
        assert.deepEqual(issuesOf(changed((c) => { c.auth = { type: 'bearer', token: 'secret' } })), ['auth.token|is not a known key'])
        assert.deepEqual(issuesOf(changed((c) => { c.auth = { type: 'basic', password: 'secret' } })), ['auth.password|is not a known key'])
    })

    it('should check the token paths of a login', () => {
        assert.deepEqual(issuesOf(changed((c) => { c.auth = { type: 'login', path: '/l', tokenPath: 'a..b' } })), [
            'auth.tokenPath|is not a valid path: Invalid path "a..b"',
        ])
    })

    it('should not run the other rules when the shape is wrong', () => {
        assert.deepEqual(issuesOf(changed((c) => { c.baseUrl = 5 })), ['baseUrl|must be a string'])
    })
})

describe('parseConfig', () => {
    it('should return the config', () => {
        assert.equal(parseConfig(blogConfig).collections['posts']?.label, 'Posts')
    })

    it('should throw one error that lists every bad key', () => {
        assert.throws(() => parseConfig({}), (error: Error) =>
            error instanceof ConfigError
            && error.issues.length === 3
            && error.message.includes('baseUrl is required')
            && error.message.includes('collections is required'))
    })
})
