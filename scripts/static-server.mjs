import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const served = ['public', 'dist'].map((directory) => join(root, directory) + sep)
const port = Number(process.env.PORT ?? 8080)

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost')
  const file = join(root, normalize(decodeURIComponent(pathname)))

  if (!served.some((directory) => file.startsWith(directory))) {
    response.writeHead(403).end('Forbidden')
    return
  }

  try {
    if (!(await stat(file)).isFile()) throw new Error('not a file')
  } catch {
    response.writeHead(404).end('Not found')
    return
  }

  response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).pipe(response)
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} on http://127.0.0.1:${port}/public/index.html`)
})
