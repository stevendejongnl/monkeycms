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

const config = (auth, body = { type: 'longtext', label: 'Body' }) => ({
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
        body,
      },
      status: { field: 'status', param: 'status', publish: 'published' },
      sections: [{ title: 'Content', fields: ['title', 'body'] }, { title: 'Publishing', fields: ['status', 'readingTime'] }],
      preview: { fields: ['title', 'status', 'readingTime', 'body'] },
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
  { id: 2, title: 'A new spring menu', status: 'draft', readingTime: 5, body: 'Asparagus, wild garlic and rhubarb arrive in April.\nThe menu changes every two weeks.' },
  { id: 3, title: 'Coffee tasting night', status: 'published', readingTime: 2 },
]

const open = async (page, hash, auth, body) => {
  await page.route('https://api.example.com/**', (route) => {
    const { pathname } = new URL(route.request().url())

    return route.fulfill({ json: pathname === '/posts' ? { data: posts, total: posts.length } : { data: [] } })
  })
  await page.goto(`${origin}/public/index.html${hash}`)
  await page.evaluate((json) => {
    const setUp = document.createElement('monkey-set-up')

    setUp.setAttribute('config', JSON.stringify(json))
    document.body.append(setUp, document.createElement('monkey-app'))
  }, config(auth, body))
  await page.locator('monkey-set-up[config]').getByRole('status').waitFor()
  // The demo page prints the state of the set-up above the app. Leave that out of the pictures.
  await page.addStyleTag({ content: 'monkey-set-up { display: none }' })
}

const screens = {
  list: async (page) => {
    await open(page, '#/posts', { type: 'none' })
    await page.getByRole('cell', { name: 'Coffee tasting night', exact: true }).waitFor()
  },
  'list-preview': async (page) => {
    // The scrim and the drawer fill the viewport, so make the viewport as tall as the page.
    await page.setViewportSize({ width: 1100, height: 760 })
    await open(page, '#/posts', { type: 'none' })
    await page.getByRole('button', { name: 'Preview A new spring menu' }).click()
    await page.getByRole('dialog').waitFor()
  },
  'list-signed-in': async (page) => {
    await open(page, '#/posts', { type: 'bearer' })
    await page.getByLabel('Token').fill('abc')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByRole('cell', { name: 'Coffee tasting night', exact: true }).waitFor()
  },
  'list-folded': async (page) => {
    await open(page, '#/posts', { type: 'none' })
    await page.getByRole('cell', { name: 'Coffee tasting night', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Collapse' }).click()
    await page.getByRole('button', { name: 'Expand' }).waitFor()
  },
  settings: async (page) => {
    await page.setViewportSize({ width: 1100, height: 900 })
    await open(page, '#/settings', { type: 'none' })
    await page.getByRole('button', { name: 'teal' }).click()
  },
  'settings-code': async (page) => {
    await page.setViewportSize({ width: 1100, height: 1000 })
    await open(page, '#/settings', { type: 'none' })
    await page.getByRole('button', { name: 'forest' }).click()
    await page.getByRole('button', { name: 'Code' }).click()
    await page.getByText('--monkey-accent-color: #166534;').waitFor()
  },
  'list-cards': async (page) => {
    await open(page, '#/posts', { type: 'none' })
    await page.getByRole('button', { name: 'Card view' }).click()
    await page.getByRole('heading', { name: 'Coffee tasting night' }).waitFor()
  },
  'list-selected': async (page) => {
    await open(page, '#/posts', { type: 'none' })
    await page.getByRole('checkbox', { name: 'Select A new spring menu' }).check()
    await page.getByRole('checkbox', { name: 'Select Coffee tasting night' }).check()
    await page.getByText('2 selected').waitFor()
  },
  editor: async (page) => {
    // The save bar sticks to the bottom of the viewport, so make the viewport as tall as the page.
    await page.setViewportSize({ width: 1100, height: 1250 })
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
  'new-entry': async (page) => {
    await page.setViewportSize({ width: 1100, height: 900 })
    await open(page, '#/posts/new', { type: 'none' })
    await page.getByLabel('Title').first().waitFor()
  },
  richtext: async (page) => {
    await page.setViewportSize({ width: 1100, height: 1000 })
    await open(page, '#/posts/new', { type: 'none' }, { type: 'richtext', label: 'Body', format: 'markdown' })
    await page.getByLabel('Title').first().fill('A new spring menu')

    const editor = page.getByRole('textbox', { name: 'Body' })

    await editor.click()
    await page.getByRole('button', { name: 'Heading', exact: true }).click()
    await page.keyboard.type('Spring is here')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Paragraph' }).click()
    await page.getByRole('button', { name: 'Bold' }).click()
    await page.keyboard.type('Asparagus')
    await page.getByRole('button', { name: 'Bold' }).click()
    await page.keyboard.type(' and wild garlic arrive in April.')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Bulleted list' }).click()
    await page.keyboard.type('Soup of the day')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Rhubarb tart')
    await page.getByLabel('Title').first().click()
  },
  'editor-preview': async (page) => {
    await page.setViewportSize({ width: 1100, height: 800 })
    await open(page, '#/posts/new', { type: 'none' })
    await page.getByLabel('Title').first().fill('A new spring menu')
    await page.getByLabel('Body').first().fill('Asparagus, wild garlic and rhubarb arrive in April.')
    await page.getByLabel('Status').first().selectOption('draft')
    await page.getByRole('button', { name: 'Preview', exact: true }).click()
    await page.getByRole('button', { name: /A new spring menu/ }).waitFor()
  },
  'sign-in': async (page) => {
    await open(page, '', { type: 'basic' })
    await page.getByLabel('Username').fill('steven')
  },
}

const server = spawn('node', [join(import.meta.dirname, '../bin/dist/cli.js'), 'serve', '--port', String(port)], { cwd: root, stdio: 'ignore' })

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
