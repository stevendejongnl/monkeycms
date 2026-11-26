import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { createMock as cursor } from 'examples/cursor/mock.ts'
import { createMock as envelope } from 'examples/envelope/mock.ts'
import { createMock as jsonapi } from 'examples/jsonapi/mock.ts'
import { fetcherFor } from 'examples/mock/mock.ts'
import type { Mock } from 'examples/mock/mock.ts'
import { createMock as restArray } from 'examples/rest-array/mock.ts'
import { createMock as wordpress } from 'examples/wordpress/mock.ts'
import { checkConfig, probe, readConfigFile } from './check.ts'


const exampleConfig = async (folder: string) => {
    const config = checkConfig(await readConfigFile(new URL(`../../../examples/${folder}/monkey.config.json`, import.meta.url).pathname)).config

    assert.ok(config !== undefined)

    return config
}

const texts = async (folder: string, mock: Mock, change: (config: Record<string, any>) => void = () => {}) => {
    const config = await exampleConfig(folder)

    change(config)

    return (await probe(config, fetcherFor(mock))).map(({ collection, lines }) => ({ collection, lines }))
}

describe('checkConfig', () => {
    it('should accept a valid config', async () => {
        const { config, lines } = checkConfig(await readConfigFile(new URL('../../../templates/init/public/monkey.config.json', import.meta.url).pathname))

        assert.ok(config !== undefined)
        assert.deepEqual(lines, [{ ok: true, text: 'The config is valid' }])
    })

    it('should list every bad key with its path', () => {
        const { config, lines } = checkConfig({ configVersion: 1, baseUrl: 'x', collections: { posts: { fields: {}, list: { path: '/posts', searchParam: 'a b' } } } })

        assert.equal(config, undefined)
        assert.ok(lines.length > 0)
        assert.ok(lines.every(({ ok }) => !ok))
        assert.ok(lines.some(({ text }) => text.includes('searchParam') || text.includes('baseUrl')))
    })

    it('should say when the file cannot be read', async () => {
        await assert.rejects(readConfigFile('/does/not/exist.json'), /Cannot read \/does\/not\/exist\.json/)
    })
})

describe('probe', () => {
    for (const [folder, mock] of [['rest-array', restArray], ['envelope', envelope], ['jsonapi', jsonapi], ['cursor', cursor]] as const) {
        it(`should find the items, the fields and the next page in the ${folder} example`, async () => {
            const [{ lines }] = await texts(folder, mock())

            assert.ok(lines?.every(({ ok }) => ok), JSON.stringify(lines))
            assert.match(lines?.[0]?.text ?? '', /^list: 10 items with an id/)
            assert.ok(lines?.some(({ text }) => text === 'field title: found in 10 of 10 items'))
            assert.ok(lines?.some(({ text }) => text === 'pagination: page 2 has 10 items'))
        })
    }

    it('should say that the API needs a sign-in', async () => {
        const [{ lines }] = await texts('wordpress', wordpress())

        assert.deepEqual(lines?.map(({ ok }) => ok), [false])
        assert.match(lines?.[0]?.text ?? '', /HTTP 401/)
    })

    it('should fail when the items path does not fit the answer', async () => {
        const [{ lines }] = await texts('envelope', envelope(), (config) => { config['collections'].posts.list.itemsPath = 'rows' })

        assert.equal(lines?.[0]?.ok, false)
        assert.match(lines?.[0]?.text ?? '', /invalid-response/)
    })

    it('should fail for a field that is not in any item', async () => {
        const [{ lines }] = await texts('rest-array', restArray(), (config) => { config['collections'].posts.fields.title.path = 'headline' })

        assert.ok(lines?.some(({ ok, text }) => !ok && text === 'field title: found in 0 of 10 items'))
    })

    it('should fail when the next page is the same as the first', async () => {
        const [{ lines }] = await texts('rest-array', restArray(), (config) => { config['pagination'].pageParam = 'nothing' })

        assert.ok(lines?.some(({ ok, text }) => !ok && text.endsWith(', the same as page 1')))
    })
})
