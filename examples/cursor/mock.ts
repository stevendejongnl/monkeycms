import type { Mock, MockRequest, MockResponse } from '../mock/mock.ts'
import { Posts, number } from '../mock/posts.ts'


// A cursor API: "items" and an opaque "next_cursor", which is null on the last page. There is
// no total and no page number. An error answer has a plain "error" text.
export const createMock = (): Mock => {
    const posts = new Posts()
    const invalid = (error: string): MockResponse => ({ status: 422, body: { error } })

    // The cursor is the offset, written so that it looks like something that is not a number.
    const encode = (offset: number): string => btoa(`offset:${offset}`)
    const decode = (cursor: string | null): number => {
        const offset = Number(/^offset:(\d+)$/.exec(cursor === null ? '' : atob(cursor))?.[1])

        return Number.isInteger(offset) ? offset : 0
    }

    const handler = ({ method, url, body }: MockRequest): MockResponse => {
        const id = /^\/v1\/posts\/([^/]+)$/.exec(url.pathname)?.[1]

        if (url.pathname === '/v1/posts' && method === 'GET') {
            const found = posts.search(url.searchParams.get('q'))
            const offset = decode(url.searchParams.get('cursor'))
            const limit = number(url.searchParams.get('limit'), 10)

            return { status: 200, body: { items: found.slice(offset, offset + limit), next_cursor: offset + limit < found.length ? encode(offset + limit) : null } }
        }

        if (url.pathname === '/v1/posts' && method === 'POST') {
            const problem = posts.problem((body ?? {}) as object)

            return problem === undefined ? { status: 201, body: posts.add(body as object) } : invalid(problem)
        }

        const post = id === undefined ? undefined : posts.find(id)

        if (post === undefined) {
            return { status: 404, body: { error: 'Post not found' } }
        }

        if (method === 'GET') {
            return { status: 200, body: post }
        }

        if (method === 'PATCH') {
            const problem = posts.problem({ title: post.title, ...(body as object) })

            return problem === undefined ? { status: 200, body: posts.change(post, body as object) } : invalid(problem)
        }

        posts.remove(post)

        return { status: 204 }
    }

    return { baseUrl: 'https://cursor.example.com/v1', handler }
}
