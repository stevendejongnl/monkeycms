import { getPath } from './path.ts'
import { isUnderBaseUrl } from './template.ts'
import type { Pagination } from './types.ts'


export interface PageState {
    // Zero-based number of the page.
    readonly index: number
    readonly cursor?: string
    // Set for the link-header strategy: the full URL of this page.
    readonly url?: string
}

export const firstPage: PageState = { index: 0 }

export interface PageResult {
    readonly body: unknown
    readonly headers: Readonly<Record<string, string>>
    readonly itemCount: number
    readonly total?: number
}

// Every way of paging is one strategy. A strategy knows how to ask for a page, and how to
// find the page after a result.
interface Strategy<P extends Pagination> {
    query: (pagination: P, state: PageState) => Record<string, string>
    next: (pagination: P, state: PageState, result: PageResult, baseUrl: string) => PageState | null
}

type StrategyFor<T extends Pagination['type']> = Strategy<Extract<Pagination, { type: T }>>

const optional = (key: string | undefined, value: string | undefined): Record<string, string> =>
    key === undefined || value === undefined ? {} : { [key]: value }

// Splits a Link header into relation and URL, for example { next: 'https://...' }.
export const parseLinkHeader = (header: string): Record<string, string> =>
    Object.fromEntries(
        [...header.matchAll(/<([^>]*)>([^,<]*)/g)].flatMap(([, url, parameters]) =>
            (/;\s*rel\s*=\s*"?([^";]+)"?/i.exec(parameters ?? '')?.[1]?.split(/\s+/) ?? [])
                .map((relation) => [relation.toLowerCase(), url ?? ''] as const)
        )
    )

const headerValue = (headers: Readonly<Record<string, string>>, name: string): string =>
    Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1] ?? ''

const hasMore = (pageSize: number, state: PageState, result: PageResult): boolean =>
    result.itemCount > 0 && (result.total === undefined ? result.itemCount >= pageSize : (state.index + 1) * pageSize < result.total)

const following = (state: PageState, more: boolean): PageState | null => more ? { index: state.index + 1 } : null

const cursorOf = (value: unknown): string | undefined =>
    (typeof value === 'string' || typeof value === 'number') && String(value) !== '' ? String(value) : undefined

const strategies: { [T in Pagination['type']]: StrategyFor<T> } = {
    none: {
        query: () => ({}),
        next: () => null,
    },
    page: {
        query: (p, state) => ({
            [p.pageParam]: String((p.startPage ?? 1) + state.index),
            [p.limitParam]: String(p.pageSize),
        }),
        next: (p, state, result) => following(state, hasMore(p.pageSize, state, result)),
    },
    offset: {
        query: (p, state) => ({
            [p.offsetParam]: String(state.index * p.pageSize),
            [p.limitParam]: String(p.pageSize),
        }),
        next: (p, state, result) => following(state, hasMore(p.pageSize, state, result)),
    },
    cursor: {
        query: (p, state) => ({
            ...optional(p.cursorParam, state.cursor),
            ...optional(p.limitParam, String(p.pageSize)),
        }),
        next: (p, state, result) => {
            const cursor = cursorOf(getPath(result.body, p.nextCursorPath))

            return cursor === undefined ? null : { index: state.index + 1, cursor }
        },
    },
    'link-header': {
        // After the first page the Link header gives the whole URL.
        query: (p, state) => optional(p.limitParam, state.url === undefined ? String(p.pageSize) : undefined),
        // A Link header that points outside baseUrl is not followed.
        next: (_p, state, result, baseUrl) => {
            const url = parseLinkHeader(headerValue(result.headers, 'link'))['next']

            return url !== undefined && isUnderBaseUrl(url, baseUrl) ? { index: state.index + 1, url } : null
        },
    },
}

const strategyOf = (pagination: Pagination): Strategy<Pagination> => strategies[pagination.type] as Strategy<Pagination>

// The query parameters to ask for one page.
export const pageQuery = (pagination: Pagination, state: PageState): Record<string, string> =>
    strategyOf(pagination).query(pagination, state)

// The state of the next page, or null when this was the last page.
export const nextPage = (pagination: Pagination, state: PageState, result: PageResult, baseUrl: string): PageState | null =>
    strategyOf(pagination).next(pagination, state, result, baseUrl)
