import meow from 'meow'

// export const helper with meow
// use command serve, build, test, publish

export const helper = meow(`
    Usage
    $ monkeycms <command>

    Commands
    help    [h]   Display help
    serve   [s]   Start the server
    build   [b]   Build the project
    test    [t]   Test the project
    publish [p]   Publish the project
`, {
    importMeta: import.meta,
    flags: {
        help: {
            type: 'boolean',
            shortFlag: 'h'
        },
        serve: {
            type: 'boolean',
            shortFlag: 's'
        },
        build: {
            type: 'boolean',
            shortFlag: 'b'
        },
        test: {
            type: 'boolean',
            shortFlag: 't'
        },
        publish: {
            type: 'boolean',
            shortFlag: 'p'
        }
    }
})
