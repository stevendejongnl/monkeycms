import { createReadStream, existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { RequestListener, Server } from 'node:http'
import { extname, join, posix, resolve, sep } from 'node:path'
import { packageRoot } from '../root.ts'


// The built files of MonkeyCMS itself. A project that has no dist folder is served from here.
const PACKAGE_DIST = join(packageRoot(), 'dist')

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

// The request listener of a static file server for a project: it serves the files in the
// "public" and "dist" folders of root, and nothing else. The address has the folder in it,
// like /public/index.html. When root has no dist folder, dist is the one of the MonkeyCMS
// package.
export const staticHandler = (root: string): RequestListener => {
    const base = resolve(root)
    const dist = existsSync(join(base, 'dist')) ? join(base, 'dist') : PACKAGE_DIST
    const folders: Record<string, string> = { public: join(base, 'public'), dist }

    return async (request, response) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405, { allow: 'GET, HEAD' }).end('Method not allowed')

            return
        }

        let address: string

        try {
            address = posix.normalize(decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname))
        } catch {
            response.writeHead(400).end('Bad request')

            return
        }

        const [, name = '', ...rest] = address.split('/')
        const folder = Object.hasOwn(folders, name) ? folders[name] : undefined
        const file = folder === undefined ? undefined : join(folder, ...rest)

        if (folder === undefined || file === undefined || (file !== folder && !file.startsWith(folder + sep))) {
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
    }
}

export const createStaticServer = (root: string): Server => createServer(staticHandler(root))

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
