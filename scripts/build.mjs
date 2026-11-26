import { build } from 'esbuild'

// The command line. One file for node, with the shared code of src/ inside it.
await build({
  entryPoints: ['bin/src/cli.ts'],
  outfile: 'bin/dist/cli.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node26',
  logLevel: 'info',
})

await build({
  entryPoints: ['src/main.ts', 'src/main.css'],
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  target: 'es2024',
  minify: true,
  sourcemap: true,
  logLevel: 'info',
})
