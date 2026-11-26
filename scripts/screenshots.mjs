// Takes screenshots of the screens of MonkeyCMS, in light and in dark.
//
//   node scripts/screenshots.mjs [root] [outDir]
//
// root is a built checkout of the project (default: this one), and outDir is where the PNG
// files go. Run it on a checkout of main and on a branch to get a before and an after.
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'

const root = resolve(process.argv[2] ?? '.')
const out = resolve(process.argv[3] ?? 'docs/screenshots')
const port = 4300 + Math.floor(Math.random() * 500)
const origin = `http://127.0.0.1:${port}`

const config = (auth) => ({
  configVersion: 1,
  baseUrl: 'https://api.example.com',
  auth,
  errors: { messagePath: 'message', fieldErrorsPath: 'errors' },
  pagination: { type: 'page', pageParam: 'page', limitParam: 'limit', pageSize: 10 },
  collections: {
    posts: {
      label: 'Posts',
      fields: {
        title: { type: 'text', label: 'Title', required: true },
        status: { type: 'select', label: 'Status', options: ['draft', 'published'] },
        readingTime: { type: 'number', label: 'Reading time (minutes)' },
        body: { type: 'longtext', label: 'Body' },
      },
      list: { path: '/posts', itemsPath: 'data', totalPath: 'total', searchParam: 'q' },
      get: { path: '/posts/{id}', itemPath: 'data' },
      create: { path: '/posts', itemPath: 'data' },
      update: { path: '/posts/{id}', itemPath: 'data' },
      delete: { path: '/posts/{id}' },
    },
    pages: { label: 'Pages', fields: { title: { type: 'text' } }, list: { path: '/pages', itemsPath: 'data' } },
  },
})

const posts = [
  { id: 1, title: 'Opening hours over the holidays', status: 'published', readingTime: 3 },
  { id: 2, title: 'A new spring menu', status: 'draft', readingTime: 5 },
  { id: 3, title: 'Coffee tasting night', status: 'published', readingTime: 2 },
]

const open = async (page, hash, auth) => {
  await page.route('https://api.example.com/**', (route) => {
    const { pathname } = new URL(route.request().url())

    return route.fulfill({ json: pathname === '/posts' ? { data: posts, total: posts.length } : { data: [] } })
  })
  await page.goto(`${origin}/public/index.html${hash}`)
  await page.evaluate((json) => {
    const setUp = document.createElement('monkey-set-up')

    setUp.setAttribute('config', JSON.stringify(json))
    document.body.append(setUp, document.createElement('monkey-app'))
  }, config(auth))
  await page.locator('monkey-set-up[config]').getByRole('status').waitFor()
  // The demo page prints the state of the set-up above the app. Leave that out of the pictures.
  await page.addStyleTag({ content: 'monkey-set-up { display: none }' })
}

const screens = {
  list: async (page) => {
    await open(page, '#/posts', { type: 'none' })
    await page.getByRole('cell', { name: 'Coffee tasting night', exact: true }).waitFor()
  },
  editor: async (page) => {
    await open(page, '#/posts/new', { type: 'none' })
    // An untouched text field shows "undefined" in both versions, so type in the fields and
    // empty them again to keep that out of the pictures.
    for (const label of ['Title', 'Body']) {
      await page.getByLabel(label).first().fill('x')
      await page.getByLabel(label).first().fill('')
    }
    await page.getByRole('button', { name: 'Save' }).click()
    await page.getByRole('alert').first().waitFor()
  },
  'sign-in': async (page) => {
    await open(page, '', { type: 'basic' })
    await page.getByLabel('Username').fill('steven')
  },
}

const server = spawn('node', [join(root, 'scripts/static-server.mjs')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' })

try {
  await mkdir(out, { recursive: true })
  await new Promise((done) => setTimeout(done, 800))

  const browser = await chromium.launch()

  for (const scheme of ['light', 'dark']) {
    for (const [name, prepare] of Object.entries(screens)) {
      const page = await browser.newPage({ viewport: { width: 1100, height: 640 }, colorScheme: scheme })

      await prepare(page)
      await page.screenshot({ path: join(out, `${name}-${scheme}.png`), fullPage: true })
      await page.close()
    }
  }

  await browser.close()
} finally {
  server.kill()
}
