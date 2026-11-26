// Makes static snapshots of the design boards, for the tests in src/design.
//
//   node scripts/design-snapshot.mjs <design-dir> <runtime.js> [outDir]
//
// design-dir has the *.dc.html files of the design (the "project" folder of the design) and
// runtime.js is the runtime of the design (the "support.js" that the boards load). The script
// draws each board in a browser, clicks to the states that the tests need, and saves the HTML
// of each state. The snapshots do not need the runtime, and they have no font: the tests set
// one font for the design and for the app, so the text takes the same room in both.
import { chromium } from '@playwright/test'
import { copyFile, cp, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'

const [designDir, runtime, outArg] = process.argv.slice(2)
const out = resolve(outArg ?? 'src/design/boards')

if (designDir === undefined || runtime === undefined) {
  throw new Error('Usage: node scripts/design-snapshot.mjs <design-dir> <runtime.js> [outDir]')
}

const site = await mkdtemp(join(tmpdir(), 'monkeycms-design-'))

await cp(resolve(designDir), site, { recursive: true })
await copyFile(resolve(runtime), join(site, 'support.js'))

const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' }
const server = createServer(async (request, response) => {
  try {
    const body = await readFile(join(site, new URL(request.url, 'http://x').pathname))

    response.writeHead(200, { 'content-type': types[extname(request.url)] ?? 'text/plain' }).end(body)
  } catch {
    response.writeHead(404).end()
  }
})

await new Promise((done) => server.listen(0, '127.0.0.1', done))

const origin = `http://127.0.0.1:${server.address().port}`

const closePreview = (page) => page.locator('button[aria-label="Close the preview"]').last().click()

// Each state: the board, the name of the snapshot and what to click first.
const states = [
  { board: 'Tokens', name: 'tokens' },
  { board: 'ShellAB', name: 'shell' },
  { board: 'ShellAB', name: 'shell-folded', click: (page) => page.getByRole('button', { name: 'Collapse' }).click() },
  // The board opens with the preview drawer, so the other states close it first.
  { board: 'ListAB', name: 'list-preview' },
  { board: 'ListAB', name: 'list', click: closePreview },
  { board: 'ListAB', name: 'list-cards', click: async (page) => { await closePreview(page); await page.getByRole('button', { name: 'Card view' }).click() } },
  { board: 'EditorBC', name: 'editor' },
  { board: 'EditorBC', name: 'editor-preview', click: (page) => page.getByRole('button', { name: 'Preview', exact: true }).click() },
  { board: 'LoginB', name: 'login' },
  { board: 'ThemeBC', name: 'theme' },
]

const browser = await chromium.launch()

await mkdir(out, { recursive: true })

for (const { board, name, click } of states) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort())
  await page.goto(`${origin}/${board}.dc.html`)
  await page.locator('body > div').first().waitFor()
  await page.waitForTimeout(800)
  await click?.(page)
  await page.waitForTimeout(300)

  const html = await page.evaluate(() => {
    // The styles of the board are small. The runtime has the large ones.
    const styles = [...document.head.querySelectorAll('style')].map((style) => style.textContent ?? '').filter((css) => css.length < 2000 && !css.includes('x-dc'))
    const body = document.querySelector('body > div')

    return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<style>\n${styles.join('\n')}\n</style>\n</head>\n<body>\n${body.outerHTML}\n</body>\n</html>\n`
  })

  // No font in the snapshot. The test sets "--monkey-font" for the design and the app.
  await writeFile(join(out, `${name}.html`), html.replace(/--monkey-font: [^;"]+;\s*/g, ''))
  await page.close()
  console.log(`${name}.html`)
}

await browser.close()
server.close()
