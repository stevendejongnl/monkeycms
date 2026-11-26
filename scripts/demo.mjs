// Runs MonkeyCMS against the mock API of one example, on one port.
//
//   node scripts/demo.mjs [example] [--port 8080]
//
// The examples are the folders in examples/. The page, the built files and the mock API share
// one origin, so there is nothing to set up and no CORS. Run `npm run build` first.
import { createServer } from 'node:http'
import { readdir, readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { staticHandler } from '../bin/src/commands/serve.ts'

const root = new URL('..', import.meta.url)
const { positionals, values } = parseArgs({ allowPositionals: true, options: { port: { type: 'string', short: 'p' } } })
const names = (await readdir(new URL('examples/', root), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && entry.name !== 'mock')
  .map((entry) => entry.name)
const name = positionals[0] ?? 'rest-array'

if (!names.includes(name)) {
  console.error(`There is no example "${name}". The examples are: ${names.join(', ')}`)
  process.exit(1)
}

const port = Number(values.port ?? 8080)
const origin = `http://127.0.0.1:${port}`
const { createMock } = await import(new URL(`examples/${name}/mock.ts`, root))
const mock = createMock()
const config = JSON.parse(await readFile(new URL(`examples/${name}/monkey.config.json`, root), 'utf8'))

// The same API path, on this server instead of the made-up host.
config.baseUrl = origin + new URL(config.baseUrl).pathname.replace(/\/$/, '')

const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')

const page = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MonkeyCMS demo: ${escape(name)}</title>
    <link rel="stylesheet" href="/dist/main.css">
</head>
<body>
    <monkey-set-up config="${escape(JSON.stringify(config))}"></monkey-set-up>
    <monkey-app></monkey-app>
    <script type="module" src="/dist/main.js"></script>
</body>
</html>
`

const files = staticHandler(new URL('.', root).pathname)

createServer((request, response) => {
  const url = new URL(request.url ?? '/', origin)

  if (url.pathname === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page)
  } else if (url.pathname.startsWith('/dist/')) {
    files(request, response)
  } else {
    const chunks = []

    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      let body

      try {
        body = text === '' ? undefined : JSON.parse(text)
      } catch {
        body = undefined
      }

      const answer = mock.handler({ method: request.method ?? 'GET', url, headers: new Headers(request.headers), body })

      response.writeHead(answer.status, {
        ...(answer.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...answer.headers,
      })
      response.end(answer.body === undefined ? undefined : JSON.stringify(answer.body))
    })
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Demo "${name}": ${origin}/`)

  if (config.auth?.type === 'basic') {
    console.log('Sign in with any username and password.')
  }
})
