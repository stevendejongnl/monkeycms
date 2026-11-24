import { getPath } from './path.ts'
import { isUnderBaseUrl } from './template.ts'
import type { Pagination } from './types.ts'


export interface PageState {
    // Zero-based number of the page.
    index: number
    cursor?: string
    // Set for the link-header strategy: the full URL of this page.
    url?: string
}

export const firstPage: PageState = { index: 0 }

export interface PageResult {
    body: unknown
    headers: Record<string, string>
    itemCount: number
    total?: number
}

// The query parameters to ask for one page.
export const pageQuery = (pagination: Pagination, state: PageState): Record<string, string> => {
    switch (pagination.type) {
        case 'none':
            return {}
        case 'page':
            return {
                [pagination.pageParam]: String((pagination.startPage ?? 1) + state.index),
                [pagination.limitParam]: String(pagination.pageSize),
            }
        case 'offset':
            return {
                [pagination.offsetParam]: String(state.index * pagination.pageSize),
                [pagination.limitParam]: String(pagination.pageSize),
            }
        case 'cursor':
            return {
                ...(state.cursor === undefined ? {} : { [pagination.cursorParam]: state.cursor }),
                ...(pagination.limitParam === undefined ? {} : { [pagination.limitParam]: String(pagination.pageSize) }),
            }
        case 'link-header':
            // After the first page the Link header gives the whole URL.
            return state.url !== undefined || pagination.limitParam === undefined
                ? {}
                : { [pagination.limitParam]: String(pagination.pageSize) }
    }
}

// Splits a Link header into relation and URL, for example { next: 'https://...' }.
export const parseLinkHeader = (header: string): Record<string, string> => {
    const links: Record<string, string> = {}

    for (const [, url, parameters] of header.matchAll(/<([^>]*)>([^,<]*)/g)) {
        const relation = /;\s*rel\s*=\s*"?([^";]+)"?/i.exec(parameters ?? '')?.[1]

        for (const name of relation?.split(/\s+/) ?? []) {
            links[name.toLowerCase()] = url ?? ''
        }
    }

    return links
}

const header = (headers: Record<string, string>, name: string): string | undefined =>
    Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1]

// The state of the next page, or null when this was the last page. A Link header that
// points outside baseUrl is not followed.
export const nextPage = (pagination: Pagination, state: PageState, result: PageResult, baseUrl: string): PageState | null => {
    const index = state.index + 1

    switch (pagination.type) {
        case 'none':
            return null
        case 'page':
        case 'offset': {
            const more = result.total === undefined
                ? result.itemCount >= pagination.pageSize
                : index * pagination.pageSize < result.total

            return more && result.itemCount > 0 ? { index } : null
        }
        case 'cursor': {
            const cursor = getPath(result.body, pagination.nextCursorPath)

            return (typeof cursor === 'string' || typeof cursor === 'number') && String(cursor) !== ''
                ? { index, cursor: String(cursor) }
                : null
        }
        case 'link-header': {
            const url = parseLinkHeader(header(result.headers, 'link') ?? '')['next']

            return url !== undefined && isUnderBaseUrl(url, baseUrl) ? { index, url } : null
        }
    }
}
