import { expect, test } from '@playwright/test'


test.describe('SetUp', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/public/index.html')
    })

    test('should render', async ({ page }) => {
        await expect(page.locator('monkey-set-up')).toHaveText('yes')
        expect(await page.evaluate(() => customElements.get('monkey-set-up') !== undefined)).toBe(true)
    })

    test('should store some set-up data', async ({ page }) => {
        await expect.poll(() => page.evaluate(() => localStorage.getItem('SET_UP_STORE')))
            .toBe(JSON.stringify({ 'some-key': 'some-value' }))
    })
})
