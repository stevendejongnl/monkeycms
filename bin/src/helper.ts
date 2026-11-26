import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { packageRoot } from './root.ts'

export const help = `
    Usage
    $ monkeycms <command>
    $ monkeycms init [folder]
    $ monkeycms check [config] [--probe]

    Commands
    help    [h]   Display help
    serve   [s]   Serve the public and dist folders
    build   [b]   Build the project
    init    [i]   Write a sample index.html and mapping config
    check   [c]   Validate a mapping config (default public/monkey.config.json)

    Options
    --port,    -p   Port for serve (default 8080)
    --probe         With check: ask the list endpoint of each collection (GET only)
    --help,    -h   Display help
    --version, -v   Display the version
`

export const version = (): string => {
    return JSON.parse(readFileSync(join(packageRoot(), 'package.json'), 'utf8')).version
}

export const parse = () => parseArgs({
    allowPositionals: true,
    options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
        port: { type: 'string', short: 'p' },
        probe: { type: 'boolean' },
    },
})
