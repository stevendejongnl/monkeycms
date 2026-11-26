import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { Fetcher } from 'client/transport.ts'


// The part of a request that a mock API looks at.
export interface MockRequest {
    readonly method: string
    readonly url: URL
    readonly headers: Headers
    readonly body: unknown
}

export interface MockResponse {
    readonly status: number
    readonly headers?: Readonly<Record<string, string>>
    // Sent as JSON. Leave out for no content.
    readonly body?: unknown
}

// A mock API is one function. The same function runs in the tests, through a fake fetch, and
// in the demo, behind a real HTTP server.
export type MockHandler = (request: MockRequest) => MockResponse

export interface Mock {
    // The base URL of the API, as the config of the example has it.
    readonly baseUrl: string
    readonly handler: MockHandler
}

const parse = (text: string): unknown => {
    try {
        return text === '' ? undefined : JSON.parse(text)
    } catch {
        return undefined
    }
}

const toResponse = ({ status, headers = {}, body }: MockResponse): Response =>
    body === undefined
        ? new Response(null, { status, headers })
        : new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

// A fetch that answers from the mock and does not touch the network.
export const fetcherFor = ({ handler }: Mock): Fetcher => async (url, init) => {
    const text = typeof init.body === 'string' ? init.body : ''

    return toResponse(handler({ method: init.method ?? 'GET', url: new URL(url), headers: new Headers(init.headers), body: parse(text) }))
}

// Serves the mock on a real port, for a browser. It allows any origin, because it is a demo.
export const listen = ({ handler }: Mock, port: number): Promise<Server> =>
    new Promise((done, fail) => {
        const server = createServer((request, response) => {
            const chunks: Buffer[] = []

            request.on('data', (chunk: Buffer) => chunks.push(chunk))
            request.on('end', () => {
                const cors = {
                    'access-control-allow-origin': '*',
                    'access-control-allow-headers': '*',
                    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                    'access-control-expose-headers': 'link',
                }

                if (request.method === 'OPTIONS') {
                    response.writeHead(204, cors).end()

                    return
                }

                const headers = new Headers()

                for (const [name, value] of Object.entries(request.headers)) {
                    headers.set(name, Array.isArray(value) ? value.join(', ') : value ?? '')
                }

                const { status, headers: extra = {}, body } = handler({
                    method: request.method ?? 'GET',
                    url: new URL(request.url ?? '/', `http://127.0.0.1:${port}`),
                    headers,
                    body: parse(Buffer.concat(chunks).toString('utf8')),
                })

                response.writeHead(status, { ...cors, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...extra })
                response.end(body === undefined ? undefined : JSON.stringify(body))
            })
        })

        server.once('error', fail)
        server.listen(port, '127.0.0.1', () => done(server))
    })
