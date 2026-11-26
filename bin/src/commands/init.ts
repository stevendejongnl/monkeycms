import { copyFile, mkdir, readdir, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'


export const TEMPLATE = fileURLToPath(new URL('../../../templates/init/', import.meta.url))

// The files of the template, as paths under the template folder.
const filesIn = async (folder: string, prefix = ''): Promise<string[]> => {
    const entries = await readdir(join(folder, prefix), { withFileTypes: true })
    const nested = await Promise.all(entries.map(async (entry) =>
        entry.isDirectory() ? filesIn(folder, join(prefix, entry.name)) : [join(prefix, entry.name)]))

    return nested.flat().sort()
}

const exists = (path: string): Promise<boolean> => stat(path).then(() => true, () => false)

// Writes a sample project in a folder: an index.html and a mapping config. It never replaces
// a file. When one of the files is already there, it writes nothing and returns the names of
// the files in the way.
export const init = async (directory: string): Promise<{ written: string[], blocked: string[] }> => {
    const target = resolve(directory)
    const files = await filesIn(TEMPLATE)
    const blocked = (await Promise.all(files.map(async (file) => await exists(join(target, file)) ? file : undefined)))
        .filter((file): file is string => file !== undefined)

    if (blocked.length > 0) {
        return { written: [], blocked }
    }

    for (const file of files) {
        await mkdir(dirname(join(target, file)), { recursive: true })
        await copyFile(join(TEMPLATE, file), join(target, file))
    }

    return { written: files, blocked: [] }
}
