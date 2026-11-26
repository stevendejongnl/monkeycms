import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'


// The folder of the MonkeyCMS package, found by going up from a file until there is a
// package.json. It gives the same answer from the sources and from the bundle in bin/dist.
export const packageRoot = (from: string = import.meta.url): string => {
    const find = (folder: string): string => {
        if (existsSync(join(folder, 'package.json'))) {
            return folder
        }

        if (folder === dirname(folder)) {
            throw new Error('The folder of the MonkeyCMS package was not found')
        }

        return find(dirname(folder))
    }

    return find(dirname(fileURLToPath(from)))
}
