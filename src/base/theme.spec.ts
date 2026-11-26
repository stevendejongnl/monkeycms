import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'


type Rgb = [number, number, number]

// The colour that the browser draws for a CSS colour: the page goes through a canvas, so the
// result does not depend on how a browser writes a colour as text.
const colourOf = (page: Page, property: string): Promise<Rgb> =>
    page.evaluate((name) => {
        const probe = document.createElement('div')

        probe.style.color = `var(${name})`
        document.body.append(probe)

        const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })

        if (context === null) {
            throw new Error('No canvas')
        }

        context.fillStyle = getComputedStyle(probe).color
        context.fillRect(0, 0, 1, 1)
        probe.remove()

        const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data

        return [red, green, blue] as Rgb
    }, property)

const LIGHT_BACKGROUND: Rgb = [247, 246, 251]
const DARK_BACKGROUND: Rgb = [18, 16, 42]
const WHITE: Rgb = [255, 255, 255]

test.describe('theme tokens', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/public/index.html')
    })

    test('should be light by default', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'light' })

        expect(await colourOf(page, '--monkey-background-color')).toEqual(LIGHT_BACKGROUND)
    })

    test('should follow a system that asks for dark', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'dark' })

        expect(await colourOf(page, '--monkey-background-color')).toEqual(DARK_BACKGROUND)
        expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(18, 16, 42)')
    })

    test('should keep light when the page says light, also on a dark system', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'dark' })
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))

        expect(await colourOf(page, '--monkey-background-color')).toEqual(LIGHT_BACKGROUND)
    })

    test('should go dark when the page says dark, also on a light system', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'light' })
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))

        expect(await colourOf(page, '--monkey-background-color')).toEqual(DARK_BACKGROUND)
    })

    test('should take the colour of a token that the page sets', async ({ page }) => {
        await page.evaluate(() => document.documentElement.style.setProperty('--monkey-accent-color', '#0f766e'))

        expect(await colourOf(page, '--monkey-accent-color')).toEqual([15, 118, 110])
    })

    test('should put white text on a dark accent and dark text on a light accent', async ({ page }) => {
        await page.evaluate(() => document.documentElement.style.setProperty('--monkey-accent-color', '#5b4bdb'))
        expect(await colourOf(page, '--monkey-accent-contrast-color')).toEqual(WHITE)

        await page.evaluate(() => document.documentElement.style.setProperty('--monkey-accent-color', '#38bdf8'))

        const [red, green, blue] = await colourOf(page, '--monkey-accent-contrast-color')

        expect(red + green + blue).toBeLessThan(150)
    })
})
