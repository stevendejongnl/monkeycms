// Lets node resolve imports like 'config/main.ts' (from src/) and 'examples/mock/mock.ts' from
// the root of the project, the way the tsconfig "paths" and esbuild do.
// Use it with: node --import ./scripts/root-imports.mjs
import { register } from 'node:module'

register('./root-imports-hook.mjs', import.meta.url)
