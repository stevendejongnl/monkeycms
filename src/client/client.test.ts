import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { blogConfig } from '../config/fixtures.ts'
import type { MonkeyConfig } from '../config/main.ts'
import { createClient } from './client.ts'
import type { Fetcher } from './transport.ts'
import type { ApiClient, ClientError, Result } from './types.ts'


interface Call {
    readonly method: string
    readonly url: string
    readonly headers: Headers
    readonly body: unknown
}

const json = (body: unknown, init: ResponseInit = {}): Response =>
    new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', ...init.headers }, ...init })

// A fetch that records the calls and answers with the handler.
const fake = (handler: (call: Call, number: number) => Response | Promise<Response>) => {
    const calls: Call[] = []
    const fetcher: Fetcher = async (url, init) => {
        const call = {
            method: init.method ?? 'GET',
            url,
            headers: new Headers(init.headers),
            body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
        }

        calls.push(call)

        return handler(call, calls.length)
    }

    return { fetcher, calls }
}

// Like the real fetch: never answers, and rejects with the reason when the signal aborts,
// also when it was aborted already.
const waitsForAbort: Fetcher = (_url, init) => new Promise((_resolve, reject) => {
    const signal = init.signal as AbortSignal

    return signal.aborted ? reject(signal.reason) : signal.addEventListener('abort', () => reject(signal.reason))
})

const valueOf = <T>(result: Result<T>): T => {
    assert.ok(result.ok, result.ok ? '' : `${result.error.kind}: ${result.error.message}`)

    return result.value
}

const errorOf = <T>(result: Result<T>): ClientError => {
    assert.equal(result.ok, false)

    return (result as { error: ClientError }).error
}

describe('API style: JSON:API with page and limit', () => {
    const clientFor = (handler: Parameters<typeof fake>[0]) => {
        const { fetcher, calls } = fake(handler)

        return { client: createClient(blogConfig, { fetch: fetcher }), calls }
    }

    const item = (id: number) => ({ id, attributes: { title: `Post ${id}`, tags: ['a'], created_at: '2026-11-24T10:00:00Z' } })

    it('should list a page and give the next page', async () => {
        const { client, calls } = clientFor(() => json({ data: [item(1), item(2)], meta: { total: 45 } }))
        const page = valueOf(await client.list('posts'))

        assert.equal(calls[0]?.url, 'https://api.example.com/v1/posts?sort=-created_at&page=1&per_page=20')
        assert.equal(calls[0]?.headers.get('x-client'), 'monkeycms')
        assert.equal(calls[0]?.headers.get('accept'), 'application/json')
        assert.deepEqual(page.items.map(({ id, values }) => [id, values['title']]), [['1', 'Post 1'], ['2', 'Post 2']])
        assert.equal(page.total, 45)
        assert.deepEqual(page.next, { index: 1 })
    })

    it('should ask for the page that it is given, and stop on the last one', async () => {
        const { client, calls } = clientFor(() => json({ data: Array.from({ length: 5 }, (_, n) => item(n)), meta: { total: 45 } }))
        const page = valueOf(await client.list('posts', { page: { index: 2 } }))

        assert.match(calls[0]?.url ?? '', /page=3&per_page=20$/)
        assert.equal(page.next, null)
    })

    it('should get one entry', async () => {
        const { client, calls } = clientFor(() => json({ data: item(7) }))
        const entry = valueOf(await client.get('posts', '7'))

        assert.equal(calls[0]?.url, 'https://api.example.com/v1/posts/7')
        assert.equal(entry.id, '7')
    })

    it('should create an entry in the JSON:API body shape and leave read-only fields out', async () => {
        const { client, calls } = clientFor(() => json({ data: item(8) }, { status: 201 }))
        const entry = valueOf(await client.create('posts', { title: 'New', tags: 'a, b', createdAt: 'x' }))

        assert.equal(calls[0]?.method, 'POST')
        assert.deepEqual(calls[0]?.body, { data: { type: 'posts', attributes: { title: 'New', tags: ['a', 'b'] } } })
        assert.equal(calls[0]?.headers.get('content-type'), 'application/json')
        assert.equal(entry.id, '8')
    })

    it('should update with the method of the config', async () => {
        const { client, calls } = clientFor(() => json({ data: item(7) }))

        valueOf(await client.update('posts', '7', { title: 'Changed' }))

        assert.equal(calls[0]?.method, 'PATCH')
        assert.equal(calls[0]?.url, 'https://api.example.com/v1/posts/7')
        assert.deepEqual(calls[0]?.body, { data: { attributes: { title: 'Changed' } } })
    })

    it('should delete, also when the API answers with no content', async () => {
        const { client, calls } = clientFor(() => new Response(null, { status: 204 }))

        assert.equal(valueOf(await client.remove('posts', '7')), undefined)
        assert.equal(calls[0]?.method, 'DELETE')
        assert.equal(calls[0]?.body, undefined)
    })

    it('should map an error response, with the errors per field', async () => {
        const { client } = clientFor(() => json({ error: { message: 'Invalid', fields: { title: ['required'] } } }, { status: 422 }))

        assert.deepEqual(errorOf(await client.create('posts', { title: '' })), {
            kind: 'http',
            status: 422,
            message: 'Invalid',
            fieldErrors: { title: 'required' },
        })
    })

    it('should encode an id so that it cannot change the path', async () => {
        const { client, calls } = clientFor(() => json({ data: item(1) }))

        await client.get('posts', '../admin')

        assert.equal(calls[0]?.url, 'https://api.example.com/v1/posts/..%2Fadmin')
    })
})

describe('API style: GitHub, a root array with the Link header', () => {
    const config: MonkeyConfig = {
        configVersion: 1,
        baseUrl: 'https://api.github.com',
        headers: { accept: 'application/vnd.github+json' },
        pagination: { type: 'link-header', pageSize: 30, limitParam: 'per_page' },
        errors: { messagePath: 'message' },
        collections: {
            issues: {
                idPath: 'number',
                fields: { title: { type: 'text' }, body: { type: 'longtext' }, state: { type: 'select', options: ['open', 'closed'] } },
                list: { path: '/repos/acme/app/issues', query: { state: 'all' } },
                get: { path: '/repos/acme/app/issues/{id}' },
                create: { path: '/repos/acme/app/issues' },
                update: { method: 'PATCH', path: '/repos/acme/app/issues/{id}' },
            },
        },
    }

    it('should read a root array and send a plain body', async () => {
        const { fetcher, calls } = fake((call) =>
            call.method === 'GET' ? json([{ number: 3, title: 'Bug', state: 'open' }]) : json({ number: 4, title: 'New', state: 'open' }, { status: 201 }))
        const client = createClient(config, { fetch: fetcher })

        const page = valueOf(await client.list('issues'))

        assert.equal(calls[0]?.url, 'https://api.github.com/repos/acme/app/issues?state=all&per_page=30')
        assert.equal(calls[0]?.headers.get('accept'), 'application/vnd.github+json')
        assert.deepEqual(page.items[0], { id: '3', values: { title: 'Bug', state: 'open' } })

        valueOf(await client.create('issues', { title: 'New', state: 'open' }))

        assert.deepEqual(calls[1]?.body, { title: 'New', state: 'open' })
    })

    it('should follow the next link, and stop when there is none', async () => {
        const next = 'https://api.github.com/repositories/1/issues?state=all&page=2'
        const { fetcher, calls } = fake((_call, number) =>
            number === 1
                ? json([{ number: 1, title: 'A' }], { headers: { link: `<${next}>; rel="next", <https://api.github.com/x?page=9>; rel="last"` } })
                : json([{ number: 2, title: 'B' }]))
        const client = createClient(config, { fetch: fetcher })

        const first = valueOf(await client.list('issues'))

        assert.deepEqual(first.next, { index: 1, url: next })

        const second = valueOf(await client.list('issues', { page: first.next as NonNullable<typeof first.next> }))

        assert.equal(calls[1]?.url, next)
        assert.equal(second.next, null)
    })

    it('should not follow a next link to another host', async () => {
        const { fetcher } = fake(() => json([{ number: 1, title: 'A' }], { headers: { link: '<https://evil.example/steal>; rel="next"' } }))
        const page = valueOf(await createClient(config, { fetch: fetcher }).list('issues'))

        assert.equal(page.next, null)
    })

    it('should use the message of the API for an error', async () => {
        const { fetcher } = fake(() => json({ message: 'Not Found' }, { status: 404 }))

        assert.deepEqual(errorOf(await createClient(config, { fetch: fetcher }).get('issues', '99')), {
            kind: 'http', status: 404, message: 'Not Found', fieldErrors: {},
        })
    })
})

describe('API style: DummyJSON, an envelope with offset and limit', () => {
    const config: MonkeyConfig = {
        configVersion: 1,
        baseUrl: 'https://dummyjson.com',
        pagination: { type: 'offset', offsetParam: 'skip', limitParam: 'limit', pageSize: 2 },
        errors: { messagePath: 'message' },
        collections: {
            products: {
                fields: { title: { type: 'text' }, price: { type: 'number', transform: 'number' } },
                list: { path: '/products', itemsPath: 'products', totalPath: 'total' },
                get: { path: '/products/{id}' },
                create: { path: '/products/add' },
                update: { method: 'PUT', path: '/products/{id}' },
                delete: { path: '/products/{id}' },
            },
        },
    }

    it('should page with an offset until the total is reached', async () => {
        const all = [1, 2, 3].map((id) => ({ id, title: `P${id}`, price: String(id * 10) }))
        const { fetcher, calls } = fake((call) => {
            const skip = Number(new URL(call.url).searchParams.get('skip'))

            return json({ products: all.slice(skip, skip + 2), total: 3, skip, limit: 2 })
        })
        const client = createClient(config, { fetch: fetcher })

        const first = valueOf(await client.list('products'))
        const second = valueOf(await client.list('products', { page: first.next as NonNullable<typeof first.next> }))

        assert.deepEqual(calls.map(({ url }) => url), [
            'https://dummyjson.com/products?skip=0&limit=2',
            'https://dummyjson.com/products?skip=2&limit=2',
        ])
        assert.deepEqual(second.items.map(({ values }) => values['price']), [30])
        assert.deepEqual(first.items.map(({ values }) => values['price']), [10, 20])
        assert.equal(second.next, null)
    })

    it('should send the method of the config for an update, and delete', async () => {
        const { fetcher, calls } = fake(() => json({ id: 1, title: 'X', price: 5 }))
        const client = createClient(config, { fetch: fetcher })

        valueOf(await client.update('products', '1', { title: 'X', price: 5 }))
        valueOf(await client.remove('products', '1'))

        assert.deepEqual(calls.map(({ method }) => method), ['PUT', 'DELETE'])
    })
})

describe('API style: cursor, as Slack does it', () => {
    const config: MonkeyConfig = {
        configVersion: 1,
        baseUrl: 'https://slack.com/api',
        pagination: { type: 'cursor', cursorParam: 'cursor', nextCursorPath: 'response_metadata.next_cursor', limitParam: 'limit', pageSize: 2 },
        errors: { messagePath: 'error' },
        collections: {
            members: { fields: { name: { type: 'text' } }, list: { path: '/users.list', itemsPath: 'members' } },
        },
    }

    it('should pass the cursor on, and stop on an empty cursor', async () => {
        const { fetcher, calls } = fake((call) =>
            new URL(call.url).searchParams.has('cursor')
                ? json({ members: [{ id: 'U3', name: 'c' }], response_metadata: { next_cursor: '' } })
                : json({ members: [{ id: 'U1', name: 'a' }, { id: 'U2', name: 'b' }], response_metadata: { next_cursor: 'dXNlcjpVMw==' } }))
        const client = createClient(config, { fetch: fetcher })

        const first = valueOf(await client.list('members'))
        const second = valueOf(await client.list('members', { page: first.next as NonNullable<typeof first.next> }))

        assert.deepEqual(calls.map(({ url }) => url), [
            'https://slack.com/api/users.list?limit=2',
            'https://slack.com/api/users.list?cursor=dXNlcjpVMw%3D%3D&limit=2',
        ])
        assert.equal(second.next, null)
    })
})

describe('problems that every API style has', () => {
    const clientFor = (handler: Parameters<typeof fake>[0], timeoutMs?: number): ApiClient =>
        createClient(blogConfig, { fetch: fake(handler).fetcher, ...(timeoutMs === undefined ? {} : { timeoutMs }) })

    it('should report a collection that does not exist', async () => {
        const error = errorOf(await clientFor(() => json({})).list('nope'))

        assert.deepEqual([error.kind, error.message], ['unsupported', 'There is no collection "nope"'])
        assert.equal(errorOf(await clientFor(() => json({})).list('toString')).kind, 'unsupported')
    })

    it('should report an operation that the collection does not have', async () => {
        const config: MonkeyConfig = { ...blogConfig, collections: { posts: { ...blogConfig.collections['posts'], delete: undefined } as never } }
        const { fetcher, calls } = fake(() => json({}))
        const error = errorOf(await createClient(config, { fetch: fetcher }).remove('posts', '1'))

        assert.deepEqual([error.kind, error.message], ['unsupported', 'The collection "posts" has no delete endpoint'])
        assert.equal(calls.length, 0)
    })

    it('should report a request that the config cannot build, without sending it', async () => {
        const config: MonkeyConfig = {
            ...blogConfig,
            collections: { posts: { ...blogConfig.collections['posts'], list: { path: '/posts', itemsPath: 'data', query: { q: '{search}' } } } as never },
        }
        const { fetcher, calls } = fake(() => json({ data: [] }))
        const client = createClient(config, { fetch: fetcher })

        const error = errorOf(await client.list('posts'))

        assert.equal(error.kind, 'request')
        assert.match(error.message, /Missing variable "search"/)
        assert.equal(calls.length, 0)

        assert.ok((await client.list('posts', { vars: { search: 'x' } })).ok)
        assert.match(calls[0]?.url ?? '', /q=x/)
    })

    it('should report an answer that the config does not describe', async () => {
        const error = errorOf(await clientFor(() => json({ data: 'not a list' })).list('posts'))

        assert.equal(error.kind, 'invalid-response')
        assert.match(error.message, /No array found at "data"/)
        assert.equal(errorOf(await clientFor(() => json({ data: {} })).get('posts', '1')).kind, 'invalid-response')
        assert.equal(errorOf(await clientFor(() => new Response('<html>')).get('posts', '1')).kind, 'invalid-response')
    })

    it('should fall back to the HTTP status for an error answer that is not JSON', async () => {
        const error = errorOf(await clientFor(() => new Response('<h1>Bad gateway</h1>', { status: 502 })).list('posts'))

        assert.deepEqual(error, { kind: 'http', status: 502, message: 'HTTP 502', fieldErrors: {} })
    })

    it('should report a network error', async () => {
        const error = errorOf(await clientFor(() => { throw new TypeError('fetch failed') }).list('posts'))

        assert.deepEqual(error, { kind: 'network', status: 0, message: 'fetch failed', fieldErrors: {} })
    })

    it('should report a timeout', async () => {
        const slow = waitsForAbort
        const error = errorOf(await createClient(blogConfig, { fetch: slow, timeoutMs: 20 }).list('posts'))

        assert.deepEqual([error.kind, error.status], ['timeout', 0])
        assert.match(error.message, /20 ms/)
    })

    it('should stop when the caller cancels, before or during the request', async () => {
        const slow = waitsForAbort
        const client = createClient(blogConfig, { fetch: slow })
        const controller = new AbortController()
        const pending = client.list('posts', { signal: controller.signal })

        controller.abort()

        assert.equal(errorOf(await pending).kind, 'aborted')
        assert.equal(errorOf(await client.get('posts', '1', { signal: AbortSignal.abort() })).kind, 'aborted')
    })

    it('should not hide a bug in the code of the caller as an API error', async () => {
        const client = createClient(blogConfig, { fetch: () => { throw new Error('boom') } })

        assert.equal(errorOf(await client.list('posts')).kind, 'network')
    })
})
