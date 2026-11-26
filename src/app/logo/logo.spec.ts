import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'


const mount = (page: Page, attributes: Record<string, string> = {}, style = '') =>
    page.evaluate(([attrs, css]) => {
        const logo = document.createElement('monkey-logo')

        Object.entries(attrs as Record<string, string>).forEach(([key, value]) => logo.setAttribute(key, value))
        logo.setAttribute('style', `block-size: 3rem; ${css}`)
        document.body.replaceChildren(logo)
    }, [attributes, style] as const)

const fillOf = (page: Page, selector: string) =>
    page.locator('monkey-logo').locator(selector).first().evaluate((path) => getComputedStyle(path).fill)

test.beforeEach(async ({ page }) => {
    await page.goto('/public/index.html')
})

test.describe('monkey-logo', () => {
    test('should be an image with the name of the product', async ({ page }) => {
        await mount(page)

        await expect(page.getByRole('img', { name: 'MonkeyCMS' })).toBeVisible()
    })

    test('should use another name when it has one', async ({ page }) => {
        await mount(page, { label: 'Home' })

        await expect(page.getByRole('img', { name: 'Home' })).toBeVisible()
    })

    test('should show the monkey and the name, or the monkey alone', async ({ page }) => {
        await mount(page)
        const full = await page.locator('monkey-logo').boundingBox()

        await mount(page, { mark: '' })
        const mark = await page.locator('monkey-logo').boundingBox()

        expect(full?.width).toBeGreaterThan((mark?.width ?? 0) * 3)
        expect(mark?.height).toBe(full?.height)
    })

    test('should follow the colours of the theme', async ({ page }) => {
        await mount(page, {}, '--monkey-color: rgb(1, 2, 3); --monkey-accent-color: rgb(4, 5, 6)')

        expect(await fillOf(page, 'path.ink')).toBe('rgb(1, 2, 3)')
        expect(await fillOf(page, 'path.accent')).toBe('rgb(4, 5, 6)')
    })

    test('should take its own colours when a page sets them', async ({ page }) => {
        await mount(page, {}, '--monkey-logo-ink-color: rgb(7, 8, 9); --monkey-logo-accent-color: rgb(10, 11, 12)')

        expect(await fillOf(page, 'path.ink')).toBe('rgb(7, 8, 9)')
        expect(await fillOf(page, 'path.accent')).toBe('rgb(10, 11, 12)')
    })
})
