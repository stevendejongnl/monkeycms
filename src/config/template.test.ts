import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { it } from 'node:test'
import { validateConfig } from './validate.ts'


it('should accept the sample config of monkeycms init', async () => {
    const config = JSON.parse(await readFile(new URL('../../templates/init/public/monkey.config.json', import.meta.url), 'utf8'))
    const result = validateConfig(config)

    assert.ok(result.ok, result.ok ? '' : JSON.stringify(result.issues))
})
