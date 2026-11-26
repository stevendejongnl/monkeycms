import type { Mock, MockRequest, MockResponse } from '../mock/mock.ts'
import { Posts, number, slice } from '../mock/posts.ts'
import type { Post } from '../mock/posts.ts'


const resource = ({ id, title, body, status }: Post) => ({ id: String(id), type: 'posts', attributes: { title, body, status } })

const attributesOf = (body: unknown): object =>
    ((body as { data?: { attributes?: object } } | undefined)?.data?.attributes) ?? {}

// JSON:API: resources with "attributes" in "data", the total in "meta.total", page[number] and
// page[size] in the query, and an "errors" array. A write has the resource in "data".
export const createMock = (): Mock => {
    const posts = new Posts()
    const invalid = (detail: string): MockResponse => ({
        status: 422,
        body: { errors: [{ status: '422', title: 'Invalid attribute', detail, source: { pointer: '/data/attributes/title' } }] },
    })

    const handler = ({ method, url, body }: MockRequest): MockResponse => {
        const id = /^\/posts\/([^/]+)$/.exec(url.pathname)?.[1]

        if (url.pathname === '/posts' && method === 'GET') {
            const found = posts.search(url.searchParams.get('filter[title]'))
            const data = slice(found, number(url.searchParams.get('page[number]'), 1), number(url.searchParams.get('page[size]'), 10))

            return { status: 200, body: { data: data.map(resource), meta: { total: found.length } } }
        }

        if (url.pathname === '/posts' && method === 'POST') {
            const problem = posts.problem(attributesOf(body))

            return problem === undefined ? { status: 201, body: { data: resource(posts.add(attributesOf(body))) } } : invalid(problem)
        }

        const post = id === undefined ? undefined : posts.find(id)

        if (post === undefined) {
            return { status: 404, body: { errors: [{ status: '404', title: 'Not found', detail: 'Post not found' }] } }
        }

        if (method === 'GET') {
            return { status: 200, body: { data: resource(post) } }
        }

        if (method === 'PATCH') {
            const problem = posts.problem({ title: post.title, ...attributesOf(body) })

            return problem === undefined ? { status: 200, body: { data: resource(posts.change(post, attributesOf(body))) } } : invalid(problem)
        }

        posts.remove(post)

        return { status: 204 }
    }

    return { baseUrl: 'https://jsonapi.example.com', handler }
}
