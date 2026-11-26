import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

export const help = `
    Usage
    $ monkeycms <command>
    $ monkeycms init [folder]

    Commands
    help    [h]   Display help
    serve   [s]   Serve the public and dist folders
    build   [b]   Build the project
    init    [i]   Write a sample index.html and mapping config

    Options
    --port,    -p   Port for serve (default 8080)
    --help,    -h   Display help
    --version, -v   Display the version
`

export const version = (): string => {
    const packageJson = new URL('../../package.json', import.meta.url)

    return JSON.parse(readFileSync(packageJson, 'utf8')).version
}

export const parse = () => parseArgs({
    allowPositionals: true,
    options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
        port: { type: 'string', short: 'p' },
    },
})
