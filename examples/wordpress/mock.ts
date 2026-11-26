import type { Mock, MockRequest, MockResponse } from '../mock/mock.ts'
import { Posts, number, slice } from '../mock/posts.ts'
import type { Post, PostInput } from '../mock/posts.ts'


const BASE = 'https://wp.example.com/wp-json/wp/v2'

const wrapped = (raw: string) => ({ raw, rendered: `<p>${raw}</p>` })

const post = ({ id, title, body, status }: Post) =>
    ({ id, title: wrapped(title), content: wrapped(body), status: status === 'published' ? 'publish' : 'draft' })

// WordPress accepts a field as a text or as an object with "raw".
const raw = (value: unknown): unknown =>
    typeof value === 'object' && value !== null && 'raw' in value ? (value as { raw: unknown }).raw : value

const input = (body: unknown): PostInput => {
    const { title, content, status } = (body ?? {}) as Record<string, unknown>

    return { title: raw(title), body: raw(content), status: status === 'publish' ? 'published' : status }
}

// A WordPress-style API: fields wrapped in { raw, rendered }, the next page in the Link header,
// and a sign-in with an application password (Basic). An error has a code and a message, and
// the invalid parameters in "data.params".
export const createMock = (): Mock => {
    const posts = new Posts()
    const invalid = (title: string): MockResponse => ({
        status: 400,
        body: { code: 'rest_invalid_param', message: 'Invalid parameter(s): title', data: { status: 400, params: { title } } },
    })

    const handler = ({ method, url, headers, body }: MockRequest): MockResponse => {
        if (!(headers.get('authorization') ?? '').startsWith('Basic ')) {
            return { status: 401, body: { code: 'rest_forbidden', message: 'Sorry, you are not allowed to do that.', data: { status: 401 } } }
        }

        const id = /^\/wp-json\/wp\/v2\/posts\/([^/]+)$/.exec(url.pathname)?.[1]

        if (url.pathname === '/wp-json/wp/v2/posts' && method === 'GET') {
            const found = posts.search(url.searchParams.get('search'))
            const size = number(url.searchParams.get('per_page'), 10)
            const page = number(url.searchParams.get('page'), 1)
            const headers: Record<string, string> = { 'x-wp-total': String(found.length) }

            if (page * size < found.length) {
                const next = new URL(url)

                next.searchParams.set('page', String(page + 1))
                headers['link'] = `<${next.href}>; rel="next"`
            }

            return { status: 200, headers, body: slice(found, page, size).map(post) }
        }

        if (url.pathname === '/wp-json/wp/v2/posts' && method === 'POST') {
            const problem = posts.problem(input(body))

            return problem === undefined ? { status: 201, body: post(posts.add(input(body))) } : invalid(problem)
        }

        const found = id === undefined ? undefined : posts.find(id)

        if (found === undefined) {
            return { status: 404, body: { code: 'rest_post_invalid_id', message: 'Invalid post ID.', data: { status: 404 } } }
        }

        if (method === 'GET') {
            return { status: 200, body: post(found) }
        }

        if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
            const problem = posts.problem({ title: found.title, ...Object.fromEntries(Object.entries(input(body)).filter(([, value]) => value !== undefined)) })

            return problem === undefined ? { status: 200, body: post(posts.change(found, input(body))) } : invalid(problem)
        }

        posts.remove(found)

        return { status: 200, body: { deleted: true, previous: post(found) } }
    }

    return { baseUrl: BASE, handler }
}
