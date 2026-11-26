import { readFile } from 'node:fs/promises'
import { createClient } from 'client/main.ts'
import type { ApiClient, ListPage } from 'client/main.ts'
import type { Fetcher } from 'client/transport.ts'
import { describeIssue, validateConfig } from 'config/main.ts'
import type { MonkeyConfig } from 'config/main.ts'


// One line of the report. A failed line makes the check fail.
export interface Line {
    readonly ok: boolean
    readonly text: string
}

const line = (ok: boolean, text: string): Line => ({ ok, text })

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`

export const readConfigFile = async (file: string): Promise<unknown> => {
    try {
        return JSON.parse(await readFile(file, 'utf8'))
    } catch (error) {
        throw new Error(`Cannot read ${file}: ${(error as Error).message}`)
    }
}

// Checks the config against the schema and the rules. Every bad key is one line, with its path.
export const checkConfig = (input: unknown): { config: MonkeyConfig | undefined, lines: Line[] } => {
    const result = validateConfig(input)

    return result.ok
        ? { config: result.config, lines: [line(true, 'The config is valid')] }
        : { config: undefined, lines: result.issues.map((issue) => line(false, describeIssue(issue))) }
}

const fieldLine = (page: ListPage, fields: MonkeyConfig['collections'][string]['fields']): Line[] => {
    const count = page.items.length

    return Object.keys(fields).map((name) => {
        const found = page.items.filter((entry) => entry.values[name] !== undefined).length

        return line(found > 0, `field ${name}: found in ${found} of ${plural(count, 'item')}`)
    })
}

const nextLine = async (client: ApiClient, name: string, first: ListPage): Promise<Line[]> => {
    if (first.next === null) {
        return [line(true, 'pagination: this is the last page')]
    }

    const second = await client.list(name, { page: first.next })

    if (!second.ok) {
        return [line(false, `pagination: the next page failed: ${second.error.message}`)]
    }

    const moved = second.value.items[0]?.id !== first.items[0]?.id

    return [line(moved, `pagination: page 2 has ${plural(second.value.items.length, 'item')}${moved ? '' : ', the same as page 1'}`)]
}

// Asks the first page of the list endpoint of a collection, and then the second page. It
// sends GET requests only, without a sign-in. It says what the mapping found in the answer.
const probeCollection = async (client: ApiClient, config: MonkeyConfig, name: string): Promise<Line[]> => {
    const result = await client.list(name)

    if (!result.ok) {
        const status = result.error.status === 0 ? '' : ` (HTTP ${result.error.status})`

        return [line(false, `list: ${result.error.kind}${status}: ${result.error.message}`)]
    }

    const page = result.value
    const count = page.items.length
    const total = page.total === undefined ? '' : `, total ${page.total}`

    return [
        line(count > 0, `list: ${plural(count, 'item')} with an id${total}`),
        ...(count === 0 ? [] : fieldLine(page, config.collections[name]?.fields ?? {})),
        ...await nextLine(client, name, page),
    ]
}

export interface Probe {
    readonly collection: string
    readonly lines: Line[]
}

export const probe = async (config: MonkeyConfig, fetch?: Fetcher): Promise<Probe[]> => {
    const client = createClient(config, fetch === undefined ? {} : { fetch })

    return Promise.all(Object.keys(config.collections).map(async (collection) =>
        ({ collection, lines: await probeCollection(client, config, collection) })))
}
