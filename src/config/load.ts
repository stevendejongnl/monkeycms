import { validateConfig } from './validate.ts'
import type { Issue } from './json-schema.ts'
import { describeIssue } from './json-schema.ts'
import type { MonkeyConfig } from './types.ts'


export interface ConfigSource {
    // A URL that returns the config as JSON.
    readonly endpoint?: string
    // The config as a JSON string. Wins over the endpoint when both are set.
    readonly inline?: string
}

export type LoadFailure =
    | { readonly kind: 'no-source' }
    | { readonly kind: 'network', readonly message: string }
    | { readonly kind: 'http', readonly status: number }
    | { readonly kind: 'not-json', readonly message: string }
    | { readonly kind: 'invalid', readonly issues: readonly Issue[] }

export type LoadResult =
    | { readonly ok: true, readonly config: MonkeyConfig }
    | { readonly ok: false, readonly failure: LoadFailure }

type Outcome<T> = { readonly ok: true, readonly value: T } | { readonly ok: false, readonly failure: LoadFailure }

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

const TIMEOUT_MS = 10_000

const succeed = <T>(value: T): Outcome<T> => ({ ok: true, value })

const fail = (failure: LoadFailure): Outcome<never> => ({ ok: false, failure })

const messageOf = (error: unknown): string => error instanceof Error ? error.message : String(error)

const fetchText = async (endpoint: string, fetcher: Fetcher): Promise<Outcome<string>> => {
    try {
        const response = await fetcher(endpoint, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) })

        return response.ok ? succeed(await response.text()) : fail({ kind: 'http', status: response.status })
    } catch (error) {
        return fail({ kind: 'network', message: messageOf(error) })
    }
}

const sourceText = (source: ConfigSource, fetcher: Fetcher): Promise<Outcome<string>> | Outcome<string> =>
    source.inline !== undefined && source.inline.trim() !== ''
        ? succeed(source.inline)
        : source.endpoint !== undefined && source.endpoint.trim() !== ''
            ? fetchText(source.endpoint, fetcher)
            : fail({ kind: 'no-source' })

const parseJson = (text: string): Outcome<unknown> => {
    try {
        return succeed(JSON.parse(text))
    } catch (error) {
        return fail({ kind: 'not-json', message: messageOf(error) })
    }
}

const check = (json: unknown): Outcome<MonkeyConfig> => {
    const result = validateConfig(json)

    return result.ok ? succeed(result.config) : fail({ kind: 'invalid', issues: result.issues })
}

// Gets the config from its source, parses it and validates it. It never throws: every
// problem comes back as a failure that says what went wrong.
export const loadConfig = async (source: ConfigSource, fetcher: Fetcher = (url, init) => fetch(url, init)): Promise<LoadResult> => {
    const text = await sourceText(source, fetcher)
    const json = text.ok ? parseJson(text.value) : text
    const config = json.ok ? check(json.value) : json

    return config.ok ? { ok: true, config: config.value } : { ok: false, failure: config.failure }
}

type Describe = { [K in LoadFailure['kind']]: (failure: Extract<LoadFailure, { kind: K }>) => string[] }

const descriptions: Describe = {
    'no-source': () => ['No config found. Set the get-set-up-endpoint or the config attribute.'],
    network: ({ message }) => [`Could not reach the config endpoint: ${message}`],
    http: ({ status }) => [`The config endpoint answered with HTTP ${status}.`],
    'not-json': ({ message }) => [`The config is not valid JSON: ${message}`],
    invalid: ({ issues }) => ['The config is not valid:', ...issues.map(describeIssue)],
}

// Lines of text for a person, one line per problem.
export const describeFailure = (failure: LoadFailure): string[] =>
    (descriptions[failure.kind] as (failure: LoadFailure) => string[])(failure)
