import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { init } from './init.ts'


let folder = ''

beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'monkeycms-init-'))
})

afterEach(() => rm(folder, { recursive: true, force: true }))

describe('init', () => {
    it('should write the sample files', async () => {
        const { written, blocked } = await init(folder)

        assert.deepEqual(written, ['public/index.html', 'public/monkey.config.json'])
        assert.deepEqual(blocked, [])
        assert.match(await readFile(join(folder, 'public/index.html'), 'utf8'), /<monkey-app>/)
        assert.equal(JSON.parse(await readFile(join(folder, 'public/monkey.config.json'), 'utf8')).configVersion, 1)
    })

    it('should write nothing and keep the file when one exists already', async () => {
        await mkdir(join(folder, 'public'))
        await writeFile(join(folder, 'public/index.html'), 'mine')

        const { written, blocked } = await init(folder)

        assert.deepEqual(written, [])
        assert.deepEqual(blocked, ['public/index.html'])
        assert.equal(await readFile(join(folder, 'public/index.html'), 'utf8'), 'mine')
        await assert.rejects(readFile(join(folder, 'public/monkey.config.json')))
    })

    it('should make the folder when it is not there', async () => {
        const { written } = await init(join(folder, 'new', 'site'))

        assert.equal(written.length, 2)
    })
})
