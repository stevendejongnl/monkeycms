import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { createStaticServer } from './serve.ts'


let root = ''
let server: Server
let origin = ''

before(async () => {
    root = await mkdtemp(join(tmpdir(), 'monkeycms-serve-'))
    await mkdir(join(root, 'public'))
    await mkdir(join(root, 'dist'))
    await writeFile(join(root, 'public', 'index.html'), '<h1>Hi</h1>')
    await writeFile(join(root, 'dist', 'main.js'), 'export {}')
    await writeFile(join(root, 'secret.txt'), 'no')

    server = createStaticServer(root)
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))

    const address = server.address()

    origin = `http://127.0.0.1:${typeof address === 'object' && address !== null ? address.port : 0}`
})

after(async () => {
    server.close()
    await rm(root, { recursive: true, force: true })
})

describe('static server', () => {
    it('should serve a file of the public folder with its type', async () => {
        const response = await fetch(`${origin}/public/index.html`)

        assert.equal(response.status, 200)
        assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8')
        assert.equal(await response.text(), '<h1>Hi</h1>')
    })

    it('should serve a file of the dist folder', async () => {
        const response = await fetch(`${origin}/dist/main.js`)

        assert.equal(response.status, 200)
        assert.equal(response.headers.get('content-type'), 'text/javascript; charset=utf-8')
    })

    it('should send no body for HEAD', async () => {
        const response = await fetch(`${origin}/public/index.html`, { method: 'HEAD' })

        assert.equal(response.status, 200)
        assert.equal(await response.text(), '')
    })

    it('should answer 404 for a file that is not there, and for a folder', async () => {
        assert.equal((await fetch(`${origin}/public/nothing.html`)).status, 404)
        assert.equal((await fetch(`${origin}/public/`)).status, 404)
    })

    it('should answer 403 outside the served folders', async () => {
        assert.equal((await fetch(`${origin}/secret.txt`)).status, 403)
        assert.equal((await fetch(`${origin}/public/..%2Fsecret.txt`)).status, 403)
    })

    it('should answer 400 for a broken address', async () => {
        assert.equal((await fetch(`${origin}/public/%E0%A4%A`)).status, 400)
    })

    it('should answer 405 for a method that changes things', async () => {
        const response = await fetch(`${origin}/public/index.html`, { method: 'POST' })

        assert.equal(response.status, 405)
        assert.equal(response.headers.get('allow'), 'GET, HEAD')
    })
})
