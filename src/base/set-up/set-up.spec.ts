import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'


const config = {
    configVersion: 1,
    baseUrl: 'https://api.example.com',
    collections: {
        posts: { fields: { title: { type: 'text' } }, list: { path: '/posts' } },
        pages: { fields: { title: { type: 'text' } }, list: { path: '/pages' } },
    },
}

// Adds a monkey-set-up element to the page with the given attributes.
const addSetUp = (page: Page, attributes: Record<string, string>) =>
    page.evaluate((attrs) => {
        const element = document.createElement('monkey-set-up')

        Object.entries(attrs).forEach(([name, value]) => element.setAttribute(name, value))
        document.body.append(element)
    }, attributes)

test.describe('SetUp', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/public/index.html')
    })

    test('should be defined', async ({ page }) => {
        expect(await page.evaluate(() => customElements.get('monkey-set-up') !== undefined)).toBe(true)
    })

    test('should say there is no config when it has no source', async ({ page }) => {
        await expect(page.locator('monkey-set-up').first().getByRole('alert')).toContainText('No config found')
    })

    test('should load the config from the endpoint', async ({ page }) => {
        await page.route('**/api/config', (route) => route.fulfill({ json: config }))
        await addSetUp(page, { 'get-set-up-endpoint': '/api/config' })

        await expect(page.locator('monkey-set-up[get-set-up-endpoint]').getByRole('status')).toHaveText('Config loaded: posts, pages')
    })

    test('should load an inline config', async ({ page }) => {
        await addSetUp(page, { config: JSON.stringify(config) })

        await expect(page.locator('monkey-set-up[config]').getByRole('status')).toHaveText('Config loaded: posts, pages')
    })

    test('should send an event with the config', async ({ page }) => {
        const detail = page.evaluate(() => new Promise((resolve) =>
            document.addEventListener('monkey-config-ready', (event) => resolve((event as CustomEvent).detail), { once: true })))

        await addSetUp(page, { config: JSON.stringify(config) })

        expect(await detail).toEqual(config)
    })

    test('should show the status of a failed request', async ({ page }) => {
        await page.route('**/api/config', (route) => route.fulfill({ status: 404, body: 'missing' }))
        await addSetUp(page, { 'get-set-up-endpoint': '/api/config' })

        await expect(page.locator('monkey-set-up[get-set-up-endpoint]').getByRole('alert')).toContainText('HTTP 404')
    })

    test('should show which key of the config is wrong', async ({ page }) => {
        const broken = { ...config, collections: { posts: { fields: { title: { type: 'richtext' } }, list: { path: '/posts' } } } }

        await addSetUp(page, { config: JSON.stringify(broken) })

        await expect(page.locator('monkey-set-up[config]').getByRole('alert')).toContainText('collections.posts.fields.title.type')
    })

    test('should not save the config in the browser', async ({ page }) => {
        await addSetUp(page, { config: JSON.stringify(config) })
        await expect(page.locator('monkey-set-up[config]').getByRole('status')).toHaveText(/Config loaded/)

        expect(await page.evaluate(() => localStorage.length)).toBe(0)
    })
})
