import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { blogConfig } from './fixtures.ts'
import { describeFailure, loadConfig } from './load.ts'
import type { LoadFailure } from './load.ts'


const respond = (body: string, status = 200) => async () => new Response(body, { status })

const failureOf = async (...args: Parameters<typeof loadConfig>): Promise<LoadFailure> => {
    const result = await loadConfig(...args)

    assert.equal(result.ok, false)

    return (result as { failure: LoadFailure }).failure
}

describe('loadConfig', () => {
    it('should load the config from an endpoint', async () => {
        const requests: string[] = []
        const result = await loadConfig({ endpoint: '/config.json' }, async (url, init) => {
            requests.push(`${url} ${new Headers(init?.headers).get('accept')}`)

            return new Response(JSON.stringify(blogConfig))
        })

        assert.ok(result.ok)
        assert.equal(result.config.baseUrl, blogConfig.baseUrl)
        assert.deepEqual(requests, ['/config.json application/json'])
    })

    it('should load an inline config without a request', async () => {
        const result = await loadConfig({ inline: JSON.stringify(blogConfig) }, async () => assert.fail('no request expected'))

        assert.ok(result.ok)
    })

    it('should prefer the inline config when both are set', async () => {
        const result = await loadConfig({ endpoint: '/x', inline: JSON.stringify(blogConfig) }, async () => assert.fail('no request expected'))

        assert.ok(result.ok)
    })

    it('should fail when there is no source', async () => {
        assert.deepEqual(await failureOf({}), { kind: 'no-source' })
        assert.deepEqual(await failureOf({ endpoint: ' ', inline: '' }), { kind: 'no-source' })
    })

    it('should report a network error', async () => {
        const failure = await failureOf({ endpoint: '/x' }, async () => { throw new TypeError('fetch failed') })

        assert.deepEqual(failure, { kind: 'network', message: 'fetch failed' })
    })

    it('should report an HTTP error status', async () => {
        assert.deepEqual(await failureOf({ endpoint: '/x' }, respond('nope', 404)), { kind: 'http', status: 404 })
        assert.deepEqual(await failureOf({ endpoint: '/x' }, respond('', 500)), { kind: 'http', status: 500 })
    })

    it('should report text that is not JSON', async () => {
        assert.equal((await failureOf({ endpoint: '/x' }, respond('<html>'))).kind, 'not-json')
        assert.equal((await failureOf({ inline: '{ broken' })).kind, 'not-json')
    })

    it('should report every bad key of an invalid config', async () => {
        const failure = await failureOf({ inline: JSON.stringify({ configVersion: 1, baseUrl: 'ftp://x', collections: {} }) })

        assert.deepEqual(failure, {
            kind: 'invalid',
            issues: [{ path: 'collections', message: 'must have at least 1 key' }],
        })
    })
})

describe('describeFailure', () => {
    it('should give a line of text for each problem', () => {
        assert.deepEqual(describeFailure({ kind: 'http', status: 404 }), ['The config endpoint answered with HTTP 404.'])
        assert.deepEqual(describeFailure({ kind: 'invalid', issues: [{ path: 'a.b', message: 'is required' }, { path: '', message: 'must be an object' }] }), [
            'The config is not valid:',
            'a.b is required',
            '(root) must be an object',
        ])
    })
})
