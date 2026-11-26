import type { Mock, MockRequest, MockResponse } from '../mock/mock.ts'
import { Posts, number, slice } from '../mock/posts.ts'


// An envelope: the list is in "data" with the total in "meta.total", one entry is in "data"
// too, and an error answer has "error.message" and "error.fields" with a list per field.
export const createMock = (): Mock => {
    const posts = new Posts()
    const invalid = (title: string): MockResponse => ({ status: 422, body: { error: { message: 'Validation failed', fields: { title: [title] } } } })

    const handler = ({ method, url, body }: MockRequest): MockResponse => {
        const id = /^\/api\/posts\/([^/]+)$/.exec(url.pathname)?.[1]

        if (url.pathname === '/api/posts' && method === 'GET') {
            const found = posts.search(url.searchParams.get('search'))
            const data = slice(found, number(url.searchParams.get('page'), 1), number(url.searchParams.get('per_page'), 10))

            return { status: 200, body: { data, meta: { total: found.length } } }
        }

        if (url.pathname === '/api/posts' && method === 'POST') {
            const problem = posts.problem((body ?? {}) as object)

            return problem === undefined ? { status: 201, body: { data: posts.add(body as object) } } : invalid(problem)
        }

        const post = id === undefined ? undefined : posts.find(id)

        if (post === undefined) {
            return { status: 404, body: { error: { message: 'Post not found' } } }
        }

        if (method === 'GET') {
            return { status: 200, body: { data: post } }
        }

        if (method === 'PUT' || method === 'PATCH') {
            const problem = posts.problem({ title: post.title, ...(body as object) })

            return problem === undefined ? { status: 200, body: { data: posts.change(post, body as object) } } : invalid(problem)
        }

        posts.remove(post)

        return { status: 200, body: { data: null } }
    }

    return { baseUrl: 'https://envelope.example.com/api', handler }
}
