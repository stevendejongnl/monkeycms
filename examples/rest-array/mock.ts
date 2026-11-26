import type { Mock, MockRequest, MockResponse } from '../mock/mock.ts'
import { Posts, number, slice } from '../mock/posts.ts'


// Plain REST: a JSON array for a list, the item itself for one entry, page and limit in the
// query, no total. An error answer has a message and the errors per field.
export const createMock = (): Mock => {
    const posts = new Posts()
    const invalid = (title: string): MockResponse => ({ status: 422, body: { message: 'Validation failed', errors: { title } } })

    const handler = ({ method, url, body }: MockRequest): MockResponse => {
        const id = /^\/posts\/([^/]+)$/.exec(url.pathname)?.[1]

        if (url.pathname === '/posts' && method === 'GET') {
            const found = posts.search(url.searchParams.get('q'))

            return { status: 200, body: slice(found, number(url.searchParams.get('_page'), 1), number(url.searchParams.get('_limit'), 10)) }
        }

        if (url.pathname === '/posts' && method === 'POST') {
            const problem = posts.problem((body ?? {}) as object)

            return problem === undefined ? { status: 201, body: posts.add(body as object) } : invalid(problem)
        }

        const post = id === undefined ? undefined : posts.find(id)

        if (post === undefined) {
            return { status: 404, body: { message: 'Post not found' } }
        }

        if (method === 'GET') {
            return { status: 200, body: post }
        }

        if (method === 'PUT' || method === 'PATCH') {
            const problem = posts.problem({ title: post.title, ...(body as object) })

            return problem === undefined ? { status: 200, body: posts.change(post, body as object) } : invalid(problem)
        }

        posts.remove(post)

        return { status: 204 }
    }

    return { baseUrl: 'https://rest.example.com', handler }
}
