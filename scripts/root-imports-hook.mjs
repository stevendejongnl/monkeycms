import { existsSync } from 'node:fs'

const ROOT = new URL('../', import.meta.url)
const SRC = new URL('src/', ROOT)

const fileOf = (specifier) =>
  [new URL(specifier, ROOT), new URL(specifier, SRC)].find((url) => /^examples\//.test(specifier) === url.href.startsWith(ROOT.href + 'examples/') && existsSync(url))

// Node calls this for every import. A bare specifier that is a file of src/ or examples/ is
// read as a path from there. Everything else (packages, node:, relative) goes the normal way.
export const resolve = (specifier, context, next) => {
  const file = /^(\.|\/|node:|#)/.test(specifier) ? undefined : fileOf(specifier)

  return next(file === undefined ? specifier : file.href, context)
}
