import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

export const help = `
    Usage
    $ monkeycms <command>

    Commands
    help    [h]   Display help
    serve   [s]   Serve the public and dist folders
    build   [b]   Build the project
    test    [t]   Test the project
    publish [p]   Publish the project

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
