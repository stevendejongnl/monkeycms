import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'


// The tests in this file compare the app with the snapshots of the design in src/design/boards
// (made with scripts/design-snapshot.mjs). Both pages get the same font, so that text takes
// the same room in the design and in the app. The sizes are in pixels and can be 1px off.

test.skip(({ browserName }) => browserName !== 'chromium', 'The sizes are the same in each engine, so one engine is enough.')

const SAME_FONT = '* { font-family: Arial, Helvetica, sans-serif !important }'

const config = (auth: object = { type: 'none' }) => ({
    configVersion: 1,
    baseUrl: 'https://api.example.com',
    auth,
    collections: {
        posts: {
            label: 'Posts',
            fields: { title: { type: 'text', label: 'Title' } },
            list: { path: '/posts', itemsPath: 'data' },
            create: { path: '/posts', itemPath: 'data' },
        },
        pages: { label: 'Pages', fields: { title: { type: 'text' } }, list: { path: '/pages', itemsPath: 'data' } },
    },
})

const design = async (page: Page, name: string): Promise<void> => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.setContent(await readFile(new URL(`./boards/${name}.html`, import.meta.url), 'utf8'))
    await page.addStyleTag({ content: SAME_FONT })
}

const app = async (page: Page, hash: string, auth?: object): Promise<void> => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.route('https://api.example.com/**', (route) => route.fulfill({ json: { data: [{ id: 1, title: 'Opening hours' }] } }))
    await page.goto(`/public/index.html${hash}`)
    await page.evaluate((json) => {
        const setUp = document.createElement('monkey-set-up')

        setUp.setAttribute('config', JSON.stringify(json))
        document.body.append(setUp, document.createElement('monkey-app'))
    }, config(auth))
    await page.locator('monkey-set-up[config]').getByRole('status').waitFor()
    await page.addStyleTag({ content: `${SAME_FONT}; monkey-set-up { display: none }` })
}

const PROPERTIES = ['fontSize', 'fontWeight', 'borderRadius', 'paddingTop', 'paddingLeft', 'backgroundColor', 'color'] as const

type Measured = Record<typeof PROPERTIES[number], string> & { width: number, height: number }

// The size and a few styles of an element.
const measure = (locator: Locator): Promise<Measured> => locator.evaluate((element, properties) => {
    const box = element.getBoundingClientRect()
    const style = getComputedStyle(element)

    // A colour can be in any format (rgb, oklch, oklab), so read it back as pixel values.
    const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
    const pixel = (color: string): string => {
        context.clearRect(0, 0, 1, 1)
        context.fillStyle = color
        context.fillRect(0, 0, 1, 1)

        return `rgba(${context.getImageData(0, 0, 1, 1).data.join(', ')})`
    }
    const value = (name: (typeof properties)[number]): string => (name === 'color' || name === 'backgroundColor' ? pixel(style[name]) : style[name])

    return { width: Math.round(box.width), height: Math.round(box.height), ...Object.fromEntries(properties.map((name) => [name, value(name)])) } as Measured
}, PROPERTIES)

test.describe('shell', () => {
    test('the sidebar', async ({ page }) => {
        await design(page, 'shell')
        const wanted = await measure(page.locator('aside'))
        await app(page, '#/posts')
        const found = await measure(page.locator('monkey-sidebar aside'))

        expect(found.width).toBe(wanted.width)
    })

    test('the active item of the menu', async ({ page }) => {
        await design(page, 'shell')
        const wanted = await measure(page.getByRole('link', { name: 'Posts' }).first())
        await app(page, '#/posts')
        const found = await measure(page.locator('monkey-sidebar').getByRole('link', { name: /Posts/ }))

        expect(found).toMatchObject({ height: wanted.height, borderRadius: wanted.borderRadius, fontWeight: wanted.fontWeight, backgroundColor: wanted.backgroundColor, color: wanted.color })
    })

    test('an item of the menu', async ({ page }) => {
        await design(page, 'shell')
        const wanted = await measure(page.getByRole('link', { name: 'Pages' }))
        await app(page, '#/posts')
        const found = await measure(page.locator('monkey-sidebar').getByRole('link', { name: /Pages/ }))

        expect(found).toMatchObject({ height: wanted.height, borderRadius: wanted.borderRadius, fontWeight: wanted.fontWeight, backgroundColor: wanted.backgroundColor })
    })

    test('the folded sidebar', async ({ page }) => {
        await design(page, 'shell-folded')
        const wanted = await measure(page.locator('aside'))
        await app(page, '#/posts')
        await page.getByRole('button', { name: 'Collapse' }).click()
        const found = await measure(page.locator('monkey-sidebar aside'))

        expect(found.width).toBe(wanted.width)
    })
})

test.describe('list', () => {
    test('the title of the page', async ({ page }) => {
        await design(page, 'list')
        const wanted = await measure(page.getByRole('heading', { name: 'Posts', exact: true }))
        await app(page, '#/posts')
        const found = await measure(page.getByRole('heading', { name: 'Posts', exact: true }))

        expect(found).toMatchObject({ fontSize: wanted.fontSize, fontWeight: wanted.fontWeight })
    })

    test('the button to add an entry', async ({ page }) => {
        await design(page, 'list')
        const wanted = await measure(page.getByRole('link', { name: /^New post/ }))
        await app(page, '#/posts')
        const found = await measure(page.getByRole('link', { name: /^New/ }))

        expect(found).toMatchObject({ height: wanted.height, borderRadius: wanted.borderRadius, fontWeight: wanted.fontWeight, backgroundColor: wanted.backgroundColor })
    })
})

test.describe('sign in', () => {
    const both = async (page: Page, wantedLocator: (page: Page) => Locator, foundLocator: (page: Page) => Locator): Promise<[Measured, Measured]> => {
        await design(page, 'login')
        const wanted = await measure(wantedLocator(page))
        await app(page, '', { type: 'basic' })

        return [wanted, await measure(foundLocator(page))]
    }

    test('the button', async ({ page }) => {
        const [wanted, found] = await both(page, (p) => p.getByRole('button', { name: 'Sign in' }), (p) => p.getByRole('button', { name: 'Sign in' }))

        expect(found).toMatchObject({ height: wanted.height, width: wanted.width, borderRadius: wanted.borderRadius, fontWeight: wanted.fontWeight, fontSize: wanted.fontSize, backgroundColor: wanted.backgroundColor })
    })

    test('the title', async ({ page }) => {
        const [wanted, found] = await both(page, (p) => p.getByRole('heading', { name: 'Sign in' }), (p) => p.getByRole('heading', { name: 'Sign in' }))

        expect(found).toMatchObject({ fontSize: wanted.fontSize, fontWeight: wanted.fontWeight })
    })

    test('the colour side', async ({ page }) => {
        const [wanted, found] = await both(page, (p) => p.locator('aside'), (p) => p.locator('monkey-login aside'))

        expect(found).toMatchObject({ width: wanted.width, paddingTop: wanted.paddingTop, color: wanted.color })
    })

    test('the headline of the colour side', async ({ page }) => {
        const [wanted, found] = await both(page, (p) => p.getByRole('heading', { name: 'Edit content for any API.' }), (p) => p.getByRole('heading', { name: 'Edit content for any API.' }))

        expect(found).toMatchObject({ fontSize: wanted.fontSize, fontWeight: wanted.fontWeight, width: wanted.width })
    })

    test('a field', async ({ page }) => {
        const [wanted, found] = await both(page, (p) => p.getByLabel('Username'), (p) => p.getByLabel('Username'))

        expect(found).toMatchObject({ width: wanted.width, height: wanted.height, borderRadius: wanted.borderRadius, paddingLeft: wanted.paddingLeft, backgroundColor: wanted.backgroundColor })
    })

    test('the field of the password', async ({ page }) => {
        const [wanted, found] = await both(page, (p) => p.locator('input[type=password]').locator('..'), (p) => p.locator('monkey-login .secret'))

        expect(found).toMatchObject({ width: wanted.width, height: wanted.height, borderRadius: wanted.borderRadius })
    })
})
