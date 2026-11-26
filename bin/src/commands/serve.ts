import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'


export const SERVED_FOLDERS = ['public', 'dist']

const TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
}

// A static file server for a project: it serves the files in the "public" and "dist" folders
// of root, and nothing else. The address has the folder in it, like /public/index.html.
export const createStaticServer = (root: string): Server => {
    const folders = SERVED_FOLDERS.map((folder) => join(resolve(root), folder) + sep)

    return createServer(async (request, response) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405, { allow: 'GET, HEAD' }).end('Method not allowed')

            return
        }

        let file: string

        try {
            const { pathname } = new URL(request.url ?? '/', 'http://localhost')

            file = join(resolve(root), normalize(decodeURIComponent(pathname)))
        } catch {
            response.writeHead(400).end('Bad request')

            return
        }

        if (!folders.some((folder) => file.startsWith(folder))) {
            response.writeHead(403).end('Forbidden')

            return
        }

        try {
            if (!(await stat(file)).isFile()) {
                throw new Error('Not a file')
            }
        } catch {
            response.writeHead(404).end('Not found')

            return
        }

        response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })

        if (request.method === 'HEAD') {
            response.end()
        } else {
            createReadStream(file).pipe(response)
        }
    })
}

// Starts the server on the loopback address and says where it is.
export const serve = (root: string, port: number): Promise<Server> =>
    new Promise((done, fail) => {
        const server = createStaticServer(root)

        server.once('error', fail)
        server.listen(port, '127.0.0.1', () => {
            const address = server.address()
            const actual = typeof address === 'object' && address !== null ? address.port : port

            console.log(`Serving ${resolve(root)} on http://127.0.0.1:${actual}/public/index.html`)
            done(server)
        })
    })
