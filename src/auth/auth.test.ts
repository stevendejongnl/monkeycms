import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { createClient } from '../client/main.ts'
import type { Fetcher } from '../client/transport.ts'
import { blogConfig } from '../config/fixtures.ts'
import type { AuthConfig, MonkeyConfig } from '../config/main.ts'
import { createAuth, SESSION_KEY } from './auth.ts'


interface Call {
    readonly url: string
    readonly method: string
    readonly headers: Headers
    readonly credentials: RequestCredentials | undefined
    readonly body: unknown
}

const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const fake = (handler: (call: Call) => Response) => {
    const calls: Call[] = []
    const fetcher: Fetcher = async (url, init) => {
        const call = {
            url,
            method: init.method ?? 'GET',
            headers: new Headers(init.headers),
            credentials: init.credentials,
            body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
        }

        calls.push(call)

        return handler(call)
    }

    return { fetcher, calls }
}

const withAuth = (auth: AuthConfig): MonkeyConfig => ({ ...blogConfig, auth })

const emptyList = (): Response => json({ data: [], meta: { total: 0 } })

// A tiny in-memory sessionStorage, for the persist tests.
const memoryStorage = (): Storage => {
    const items = new Map<string, string>()

    return {
        get length() { return items.size },
        clear: () => items.clear(),
        getItem: (key) => items.get(key) ?? null,
        key: (index) => Array.from(items.keys())[index] ?? null,
        removeItem: (key) => { items.delete(key) },
        setItem: (key, value) => { items.set(key, String(value)) },
    }
}

describe('fields', () => {
    const fieldNames = (auth: AuthConfig) => createAuth(withAuth(auth)).fields.map(({ name }) => name)

    it('should ask for what each type needs', () => {
        assert.deepEqual(fieldNames({ type: 'none' }), [])
        assert.deepEqual(fieldNames({ type: 'bearer' }), ['token'])
        assert.deepEqual(fieldNames({ type: 'apiKey', name: 'k', in: 'header' }), ['key'])
        assert.deepEqual(fieldNames({ type: 'basic' }), ['username', 'password'])
        assert.deepEqual(fieldNames({ type: 'login', path: '/l', tokenPath: 't' }), ['username', 'password'])
        assert.deepEqual(fieldNames({ type: 'cookie', path: '/l' }), ['username', 'password'])
        assert.deepEqual(fieldNames({ type: 'cookie' }), [])
    })

    it('should hide the secrets and show the username', () => {
        const fields = createAuth(withAuth({ type: 'basic' })).fields

        assert.deepEqual(fields.map(({ secret }) => secret), [false, true])
    })
})

describe('no auth', () => {
    it('should send requests as they are', async () => {
        const { fetcher, calls } = fake(emptyList)
        const client = createClient(blogConfig, { fetch: fetcher, auth: createAuth(blogConfig) })

        assert.ok((await client.list('posts')).ok)
        assert.equal(calls[0]?.headers.get('authorization'), null)
        assert.equal(calls[0]?.credentials, undefined)
    })
})

describe('bearer, API key and basic', () => {
    const run = async (auth: AuthConfig, values: Record<string, string>) => {
        const config = withAuth(auth)
        const { fetcher, calls } = fake(emptyList)
        const session = createAuth(config)
        const result = await session.signIn(values)
        const client = createClient(config, { fetch: fetcher, auth: session })

        await client.list('posts')

        return { result, call: calls[0] as Call, session }
    }

    it('should send a bearer token', async () => {
        const { result, call } = await run({ type: 'bearer' }, { token: 'abc' })

        assert.ok(result.ok)
        assert.equal(call.headers.get('authorization'), 'Bearer abc')
    })

    it('should send an API key in a header', async () => {
        const { call } = await run({ type: 'apiKey', name: 'x-api-key', in: 'header' }, { key: 'k1' })

        assert.equal(call.headers.get('x-api-key'), 'k1')
    })

    it('should send an API key in the query, and encode it', async () => {
        const { call } = await run({ type: 'apiKey', name: 'key', in: 'query' }, { key: 'a b&c' })

        assert.equal(new URL(call.url).searchParams.get('key'), 'a b&c')
        assert.equal(call.headers.get('key'), null)
    })

    it('should send basic credentials, also with non-ASCII characters', async () => {
        const { call } = await run({ type: 'basic' }, { username: 'zoë', password: 'p:w' })
        const [scheme, encoded] = (call.headers.get('authorization') ?? '').split(' ')

        assert.equal(scheme, 'Basic')
        assert.equal(Buffer.from(encoded ?? '', 'base64').toString('utf8'), 'zoë:p:w')
    })

    it('should let the session win over a header with the same name in the config', async () => {
        const config: MonkeyConfig = { ...withAuth({ type: 'bearer' }), headers: { authorization: 'Bearer stale' } }
        const { fetcher, calls } = fake(emptyList)
        const session = createAuth(config)

        await session.signIn({ token: 'fresh' })
        await createClient(config, { fetch: fetcher, auth: session }).list('posts')

        assert.equal(calls[0]?.headers.get('authorization'), 'Bearer fresh')
    })

    it('should not send anything before sign-in', async () => {
        const config = withAuth({ type: 'bearer' })
        const { fetcher, calls } = fake(emptyList)
        const result = await createClient(config, { fetch: fetcher, auth: createAuth(config) }).list('posts')

        assert.equal(result.ok, false)
        assert.equal((result as { error: { kind: string } }).error.kind, 'unauthenticated')
        assert.equal(calls.length, 0)
    })

    it('should refuse a sign-in with a missing value, and say which one', async () => {
        const result = await createAuth(withAuth({ type: 'basic' })).signIn({ username: 'a' })

        assert.equal(result.ok, false)
        assert.equal((result as { error: { message: string } }).error.message, 'Password is required')
    })

    it('should forget the session on sign-out', async () => {
        const { session } = await run({ type: 'bearer' }, { token: 'abc' })

        assert.ok(session.isSignedIn())
        session.signOut()
        assert.equal(session.isSignedIn(), false)
        assert.equal(session.prepare({ method: 'GET', url: 'https://api.example.com/v1/posts', headers: {} }), undefined)
    })
})

describe('401 from the API', () => {
    it('should end the session, so the person signs in again', async () => {
        const config = withAuth({ type: 'bearer' })
        const session = createAuth(config)
        const { fetcher } = fake(() => json({ error: { message: 'Token expired' } }, 401))

        await session.signIn({ token: 'old' })

        const result = await createClient(config, { fetch: fetcher, auth: session }).list('posts')

        assert.equal(result.ok ? undefined : result.error.status, 401)
        assert.equal(session.isSignedIn(), false)
    })

    it('should keep the session on other errors', async () => {
        const config = withAuth({ type: 'bearer' })
        const session = createAuth(config)
        const { fetcher } = fake(() => json({}, 500))

        await session.signIn({ token: 'abc' })
        await createClient(config, { fetch: fetcher, auth: session }).list('posts')

        assert.ok(session.isSignedIn())
    })
})

describe('login endpoint', () => {
    const login: AuthConfig = { type: 'login', path: '/auth/login', tokenPath: 'data.token', expiresInPath: 'data.expires_in' }
    const answer = (call: Call): Response =>
        call.url.endsWith('/auth/login')
            ? Object.values(call.body as object).includes('right') ? json({ data: { token: 'T1', expires_in: 60 } }) : json({ error: { message: 'Bad password' } }, 401)
            : emptyList()

    it('should post the credentials and use the token it gets', async () => {
        const config = withAuth(login)
        const { fetcher, calls } = fake(answer)
        const session = createAuth(config, { fetch: fetcher })

        assert.ok((await session.signIn({ username: 'ann', password: 'right' })).ok)
        assert.deepEqual(calls[0]?.body, { username: 'ann', password: 'right' })
        assert.equal(calls[0]?.url, 'https://api.example.com/v1/auth/login')

        await createClient(config, { fetch: fetcher, auth: session }).list('posts')
        assert.equal(calls[1]?.headers.get('authorization'), 'Bearer T1')
    })

    it('should use the field names, method, header and scheme of the config', async () => {
        const config = withAuth({ ...login, method: 'PUT', usernameField: 'email', passwordField: 'pw', header: 'x-token', scheme: '' })
        const { fetcher, calls } = fake(answer)
        const session = createAuth(config, { fetch: fetcher })

        await session.signIn({ username: 'a@b.c', password: 'right' })
        await createClient(config, { fetch: fetcher, auth: session }).list('posts')

        assert.equal(calls[0]?.method, 'PUT')
        assert.deepEqual(calls[0]?.body, { email: 'a@b.c', pw: 'right' })
        assert.equal(calls[1]?.headers.get('x-token'), 'T1')
        assert.equal(calls[1]?.headers.get('authorization'), null)
    })

    it('should report a refused login with the message of the API, and stay signed out', async () => {
        const { fetcher } = fake(answer)
        const session = createAuth(withAuth(login), { fetch: fetcher })
        const result = await session.signIn({ username: 'ann', password: 'wrong' })

        assert.deepEqual(result.ok ? undefined : { kind: result.error.kind, status: result.error.status, message: result.error.message }, {
            kind: 'http',
            status: 401,
            message: 'Bad password',
        })
        assert.equal(session.isSignedIn(), false)
    })

    it('should report an answer without a token as an invalid response', async () => {
        const session = createAuth(withAuth(login), { fetch: fake(() => json({ data: {} })).fetcher })
        const result = await session.signIn({ username: 'a', password: 'b' })

        assert.equal(result.ok ? undefined : result.error.kind, 'invalid-response')
        assert.equal(session.isSignedIn(), false)
    })

    it('should report a network failure', async () => {
        const session = createAuth(withAuth(login), { fetch: async () => { throw new TypeError('offline') } })
        const result = await session.signIn({ username: 'a', password: 'b' })

        assert.equal(result.ok ? undefined : result.error.kind, 'network')
    })

    it('should treat the session as expired when the time is up', async () => {
        let time = 1_000_000
        const { fetcher } = fake(answer)
        const session = createAuth(withAuth(login), { fetch: fetcher, now: () => time })

        await session.signIn({ username: 'ann', password: 'right' })
        assert.ok(session.isSignedIn())

        time += 59_000
        assert.ok(session.isSignedIn())

        time += 1_000
        assert.equal(session.isSignedIn(), false)
        assert.equal(session.session(), undefined)
    })

    it('should not keep the session expiry when the API gives none', async () => {
        const session = createAuth(withAuth({ ...login, expiresInPath: 'data.nothing' }), { fetch: fake(answer).fetcher, now: () => 0 })

        await session.signIn({ username: 'ann', password: 'right' })

        assert.equal(session.session()?.expiresAt, undefined)
    })

    it('should not keep the password anywhere in the session', async () => {
        const session = createAuth(withAuth(login), { fetch: fake(answer).fetcher })

        await session.signIn({ username: 'ann', password: 'right' })

        assert.ok(!JSON.stringify(session.session()).includes('right'))
    })
})

describe('cookie session', () => {
    it('should send credentials with every request when there is no login endpoint', async () => {
        const config = withAuth({ type: 'cookie' })
        const { fetcher, calls } = fake(emptyList)
        const session = createAuth(config)

        assert.ok(session.isSignedIn())
        await createClient(config, { fetch: fetcher, auth: session }).list('posts')

        assert.equal(calls[0]?.credentials, 'include')
    })

    it('should sign in at the endpoint with credentials included', async () => {
        const config = withAuth({ type: 'cookie', path: '/session' })
        const { fetcher, calls } = fake((call) => call.url.endsWith('/session') ? json({}) : emptyList())
        const session = createAuth(config, { fetch: fetcher })

        assert.equal(session.isSignedIn(), false)
        assert.ok((await session.signIn({ username: 'a', password: 'b' })).ok)
        assert.equal(calls[0]?.credentials, 'include')

        await createClient(config, { fetch: fetcher, auth: session }).list('posts')
        assert.equal(calls[1]?.credentials, 'include')
    })
})

describe('persist', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')

    afterEach(() => {
        original === undefined ? Reflect.deleteProperty(globalThis, 'sessionStorage') : Object.defineProperty(globalThis, 'sessionStorage', original)
    })

    const install = (storage: Storage): void => {
        Object.defineProperty(globalThis, 'sessionStorage', { value: storage, configurable: true })
    }

    it('should keep the session only in memory by default', async () => {
        const storage = memoryStorage()

        install(storage)
        await createAuth(withAuth({ type: 'bearer' })).signIn({ token: 'abc' })

        assert.equal(storage.length, 0)
        assert.equal(createAuth(withAuth({ type: 'bearer' })).isSignedIn(), false)
    })

    it('should keep the session in sessionStorage when asked, and restore it', async () => {
        const storage = memoryStorage()
        const config = withAuth({ type: 'bearer', persist: 'session' })

        install(storage)
        await createAuth(config).signIn({ token: 'abc' })

        assert.ok(storage.getItem(SESSION_KEY)?.includes('Bearer abc'))
        assert.equal(createAuth(config).session()?.headers['authorization'], 'Bearer abc')
    })

    it('should clear the stored session on sign-out', async () => {
        const storage = memoryStorage()
        const session = createAuth(withAuth({ type: 'bearer', persist: 'session' }))

        install(storage)
        await session.signIn({ token: 'abc' })
        session.signOut()

        assert.equal(createAuth(withAuth({ type: 'bearer', persist: 'session' })).isSignedIn(), false)
    })

    it('should ignore a stored session of the wrong shape', () => {
        const storage = memoryStorage()

        storage.setItem(SESSION_KEY, JSON.stringify({ headers: 'x' }))
        install(storage)

        assert.equal(createAuth(withAuth({ type: 'bearer', persist: 'session' })).isSignedIn(), false)
    })
})
