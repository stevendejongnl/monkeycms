import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { createAuth } from '../src/auth/auth.ts'
import { createClient } from '../src/client/client.ts'
import type { ApiClient, Result } from '../src/client/types.ts'
import { parseConfig } from '../src/config/main.ts'
import { createMock as cursor } from './cursor/mock.ts'
import { createMock as envelope } from './envelope/mock.ts'
import { createMock as jsonapi } from './jsonapi/mock.ts'
import { fetcherFor } from './mock/mock.ts'
import type { Mock } from './mock/mock.ts'
import { createMock as restArray } from './rest-array/mock.ts'
import { createMock as wordpress } from './wordpress/mock.ts'


interface Example {
    readonly folder: string
    readonly mock: () => Mock
    // The name of the long text field, and a value of the select field.
    readonly textField: string
    readonly total: boolean
    // Whether the API says which field an error belongs to.
    readonly fieldErrors: boolean
}

const EXAMPLES: Example[] = [
    { folder: 'rest-array', mock: restArray, textField: 'body', total: false, fieldErrors: true },
    { folder: 'envelope', mock: envelope, textField: 'body', total: true, fieldErrors: true },
    { folder: 'jsonapi', mock: jsonapi, textField: 'body', total: true, fieldErrors: false },
    { folder: 'cursor', mock: cursor, textField: 'body', total: false, fieldErrors: false },
    { folder: 'wordpress', mock: wordpress, textField: 'content', total: false, fieldErrors: true },
]

const valueOf = <T>(result: Result<T>): T => {
    assert.ok(result.ok, result.ok ? '' : `${result.error.kind}: ${result.error.message}`)

    return result.value
}

// Every page of a list, until the API says there is no next page.
const everything = async (client: ApiClient, search = ''): Promise<{ ids: string[], totals: (number | undefined)[] }> => {
    const ids: string[] = []
    const totals: (number | undefined)[] = []
    let page = valueOf(await client.list('posts', { search }))

    for (let count = 0; count < 20; count++) {
        ids.push(...page.items.map(({ id }) => id))
        totals.push(page.total)

        if (page.next === null) {
            return { ids, totals }
        }

        page = valueOf(await client.list('posts', { search, page: page.next }))
    }

    throw new Error('The list does not end')
}

for (const example of EXAMPLES) {
    describe(`example: ${example.folder}`, () => {
        const load = async () => {
            const json = JSON.parse(await readFile(new URL(`./${example.folder}/monkey.config.json`, import.meta.url), 'utf8'))
            const config = parseConfig(json)
            const mock = example.mock()
            const fetch = fetcherFor(mock)
            const auth = createAuth(config, { fetch })

            assert.equal(config.baseUrl, mock.baseUrl)

            if (config.auth?.type === 'basic') {
                valueOf(await auth.signIn({ username: 'editor', password: 'application password' }))
            }

            return createClient(config, { fetch, auth })
        }

        it('should have a config that passes the validation', async () => {
            await load()
        })

        it('should list every page, and give the total when the API has one', async () => {
            const { ids, totals } = await everything(await load())

            assert.deepEqual(ids, Array.from({ length: 25 }, (_, index) => String(index + 1)))
            assert.deepEqual(totals[0], example.total ? 25 : undefined)
        })

        it('should search', async () => {
            const { ids } = await everything(await load(), 'post 2')

            assert.deepEqual(ids, ['2', '20', '21', '22', '23', '24', '25'])
        })

        it('should get, create, update and delete an entry', async () => {
            const client = await load()

            assert.equal(valueOf(await client.get('posts', '1')).values['title'], 'Post 1')

            const created = valueOf(await client.create('posts', { title: 'Hello', [example.textField]: 'World' }))

            assert.equal(created.id, '26')
            assert.equal(created.values['title'], 'Hello')
            assert.equal(valueOf(await client.get('posts', '26')).values[example.textField], 'World')

            const updated = valueOf(await client.update('posts', '26', { title: 'Hello again' }))

            assert.equal(updated.values['title'], 'Hello again')
            valueOf(await client.remove('posts', '26'))

            const gone = await client.get('posts', '26')

            assert.ok(!gone.ok)
            assert.equal(gone.error.status, 404)
        })

        it('should show the message of the API, and the field that it belongs to', async () => {
            const result = await (await load()).create('posts', { title: '' })

            assert.ok(!result.ok)
            assert.match(result.error.message, example.fieldErrors ? /Validation failed|Invalid parameter/ : /Title is required/)
            assert.deepEqual(Object.keys(result.error.fieldErrors), example.fieldErrors ? ['title'] : [])
        })
    })
}

describe('example: wordpress, without a sign-in', () => {
    it('should not send a request when nobody is signed in', async () => {
        const json = JSON.parse(await readFile(new URL('./wordpress/monkey.config.json', import.meta.url), 'utf8'))
        const config = parseConfig(json)
        const fetch = fetcherFor(wordpress())
        const result = await createClient(config, { fetch, auth: createAuth(config, { fetch }) }).list('posts')

        assert.ok(!result.ok)
        assert.equal(result.error.kind, 'unauthenticated')
    })
})
