import { expect, test } from '@playwright/test'


// The whole flow in a browser: the config, the mapping, the list, the editor and the API. The
// demo server runs the "envelope" example, see playwright.config.mjs.
test.describe('demo app', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://127.0.0.1:4174/#/posts')
        await expect(page.getByRole('heading', { name: 'Posts' })).toBeVisible()
    })

    test('should list the posts with their total', async ({ page }) => {
        await expect(page.getByRole('cell', { name: 'Post 1', exact: true })).toBeVisible()
        await expect(page.getByText(/\d+ entries/)).toBeVisible()
        await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled()
    })

    test('should go to the next page and back', async ({ page }) => {
        await page.getByRole('button', { name: 'Next' }).click()
        await expect(page.getByRole('cell', { name: 'Post 11', exact: true })).toBeVisible()
        await page.getByRole('button', { name: 'Previous' }).click()
        await expect(page.getByRole('cell', { name: 'Post 1', exact: true })).toBeVisible()
    })

    test('should search', async ({ page }) => {
        await page.getByLabel('Search').fill('Post 21')
        await page.keyboard.press('Enter')
        await expect(page.getByRole('cell', { name: 'Post 21', exact: true })).toBeVisible()
        await expect(page.getByRole('cell', { name: 'Post 1', exact: true })).toHaveCount(0)
    })

    test('should create, change and delete a post', async ({ page }) => {
        const title = `Demo ${Date.now()}-${test.info().workerIndex}`

        await page.getByRole('link', { name: 'New' }).click()
        await page.getByRole('button', { name: 'Save' }).click()
        await expect(page.getByText('This field is required', { exact: true })).toBeVisible()

        await page.getByLabel('Title').fill(title)
        await page.getByRole('button', { name: 'Save' }).click()
        await expect(page.getByRole('heading', { name: 'Posts' })).toBeVisible()

        const find = async (term: string) => {
            await page.getByLabel('Search').fill(term)
            await page.keyboard.press('Enter')
        }

        await find(title)
        await expect(page.getByRole('cell', { name: title, exact: true })).toBeVisible()

        await page.getByRole('link', { name: `Edit ${title}` }).click()
        await page.getByLabel('Title').fill(`${title} changed`)
        await page.getByRole('button', { name: 'Save' }).click()

        await find(title)
        await expect(page.getByRole('cell', { name: `${title} changed`, exact: true })).toBeVisible()

        await page.getByRole('button', { name: `Delete ${title} changed` }).click()
        await page.getByRole('button', { name: 'Confirm delete' }).click()
        await expect(page.getByText('No entries found')).toBeVisible()
    })
})
