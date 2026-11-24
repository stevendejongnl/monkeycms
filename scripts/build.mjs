import { build } from 'esbuild'

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
