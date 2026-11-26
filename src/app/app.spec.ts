import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'


interface Post {
    id: number
    title: string
    status?: string
    body?: string
}

const config = (auth: object = { type: 'none' }, theme?: object, body: object = { type: 'longtext', label: 'Body' }) => ({
    configVersion: 1,
    ...(theme === undefined ? {} : { theme }),
    baseUrl: 'https://api.example.com',
    auth,
    errors: { messagePath: 'message', fieldErrorsPath: 'errors' },
    pagination: { type: 'page', pageParam: 'page', limitParam: 'limit', pageSize: 2 },
    collections: {
        posts: {
            label: 'Posts',
            fields: {
                title: { type: 'text', label: 'Title', required: true },
                status: { type: 'select', label: 'Status', options: ['draft', 'published'] },
                body,
            },
            status: { field: 'status', param: 'status', publish: 'published' },
            preview: { fields: ['title', 'status', 'body'] },
            sections: [{ title: 'Content', fields: ['title', 'body'] }, { title: 'Publishing', fields: ['status'] }],
            list: { path: '/posts', itemsPath: 'data', totalPath: 'total', searchParam: 'q' },
            get: { path: '/posts/{id}', itemPath: 'data' },
            create: { path: '/posts', itemPath: 'data' },
            update: { path: '/posts/{id}', itemPath: 'data' },
            delete: { path: '/posts/{id}' },
        },
        notes: {
            fields: { text: { type: 'text' } },
            list: { path: '/notes', itemsPath: 'data' },
        },
    },
})

// An API in the page: keeps the posts in memory and records each request.
const serve = async (page: Page, posts: Post[], requests: string[] = []) => {
    let nextId = 100

    await page.route('https://api.example.com/**', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        const id = Number(url.pathname.split('/')[2])

        requests.push(`${request.method()} ${url.pathname}${url.search}`)

        if (url.pathname === '/notes') {
            return route.fulfill({ json: { data: [] } })
        }

        if (request.method() === 'GET' && Number.isNaN(id)) {
            const term = url.searchParams.get('q') ?? ''
            const size = Number(url.searchParams.get('limit'))
            const start = (Number(url.searchParams.get('page')) - 1) * size
            const status = url.searchParams.get('status') ?? ''
            const found = posts.filter((post) => post.title.includes(term) && (status === '' || post.status === status))

            return route.fulfill({ json: { data: found.slice(start, start + size), total: found.length } })
        }

        if (request.method() === 'GET') {
            return route.fulfill({ json: { data: posts.find((post) => post.id === id) } })
        }

        if (request.method() === 'DELETE') {
            posts.splice(posts.findIndex((post) => post.id === id), 1)

            return route.fulfill({ status: 204, body: '' })
        }

        const body = request.postDataJSON() as Omit<Post, 'id'>

        if (body.title === 'taken') {
            return route.fulfill({ status: 422, json: { message: 'Not saved', errors: { title: 'This title is taken' } } })
        }

        const saved = request.method() === 'POST' ? { id: nextId++, ...body } : { ...posts.find((post) => post.id === id), ...body, id }

        request.method() === 'POST' ? posts.push(saved) : posts.splice(posts.findIndex((post) => post.id === id), 1, saved)

        return route.fulfill({ json: { data: saved } })
    })
}

const open = async (page: Page, hash = '', auth?: object, theme?: object, body?: object) => {
    await page.goto(`/public/index.html${hash}`)
    await page.evaluate((json) => {
        const setUp = document.createElement('monkey-set-up')

        setUp.setAttribute('config', JSON.stringify(json))
        document.body.append(setUp, document.createElement('monkey-app'))
    }, config(auth, theme, body))
    await expect(page.locator('monkey-set-up[config]').getByRole('status')).toBeVisible()
}

const threePosts = (): Post[] => [
    { id: 1, title: 'First post', status: 'draft', body: 'long text one' },
    { id: 2, title: 'Second post', status: 'published', body: 'long text two' },
    { id: 3, title: 'Third thing' },
]

const app = (page: Page) => page.locator('monkey-app')

test.describe('collection list', () => {
    test('should show the entries in a table with the labels of the fields', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts')

        await expect(app(page).getByRole('heading', { name: 'Posts', exact: true })).toBeVisible()
        await expect(app(page).getByRole('columnheader')).toHaveText(['', 'Title', 'Status', 'Actions'])
        await expect(app(page).getByRole('row')).toHaveCount(3)
        await expect(app(page).getByRole('cell', { name: 'First post', exact: true })).toBeVisible()
        await expect(app(page).getByText('3 entries')).toBeVisible()
        await expect(app(page).getByText('long text one')).toHaveCount(0)
    })

    test('should page forward and back', async ({ page }) => {
        const requests: string[] = []

        await serve(page, threePosts(), requests)
        await open(page, '#/posts')

        const previous = app(page).getByRole('button', { name: 'Previous' })
        const next = app(page).getByRole('button', { name: 'Next' })

        await expect(previous).toBeDisabled()
        await next.click()
        await expect(app(page).getByRole('cell', { name: 'Third thing', exact: true })).toBeVisible()
        await expect(next).toBeDisabled()
        await previous.click()
        await expect(app(page).getByRole('cell', { name: 'First post', exact: true })).toBeVisible()
        expect(requests.map((request) => request.match(/page=\d/)?.[0])).toEqual(['page=1', 'page=2', 'page=1'])
    })

    test('should search, and say when nothing is found', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts')
        await app(page).getByRole('searchbox', { name: 'Search' }).fill('Second')
        await page.keyboard.press('Enter')

        await expect(app(page).getByRole('row')).toHaveCount(2)

        await app(page).getByRole('searchbox', { name: 'Search' }).fill('nothing like it')
        await page.keyboard.press('Enter')

        await expect(app(page).getByRole('status')).toHaveText('No entries found')
    })

    test('should have no search for a collection without a searchParam', async ({ page }) => {
        await serve(page, [])
        await open(page, '#/notes')

        await expect(app(page).getByRole('status')).toHaveText('No entries yet')
        await expect(app(page).getByRole('searchbox')).toHaveCount(0)
        await expect(app(page).getByRole('link', { name: 'New' })).toHaveCount(0)
    })

    test('should delete only after a confirmation', async ({ page }) => {
        const requests: string[] = []

        await serve(page, threePosts(), requests)
        await open(page, '#/posts')
        await app(page).getByRole('button', { name: 'Delete First post' }).click()
        await app(page).getByRole('button', { name: 'Cancel' }).click()

        expect(requests.some((request) => request.startsWith('DELETE'))).toBe(false)

        await app(page).getByRole('button', { name: 'Delete First post' }).click()
        await app(page).getByRole('button', { name: 'Confirm delete' }).click()

        await expect(app(page).getByRole('cell', { name: 'First post', exact: true })).toHaveCount(0)
        expect(requests).toContain('DELETE /posts/1')
    })

    test('should filter by status with the tabs', async ({ page }) => {
        const requests: string[] = []

        await serve(page, threePosts(), requests)
        await open(page, '#/posts')
        await app(page).getByRole('button', { name: 'published' }).click()

        await expect(app(page).getByRole('row')).toHaveCount(2)
        await expect(app(page).getByRole('button', { name: 'published' })).toHaveAttribute('aria-pressed', 'true')
        expect(requests.at(-1)).toContain('status=published')

        await app(page).getByRole('button', { name: 'All' }).click()

        await expect(app(page).getByRole('row')).toHaveCount(3)
    })

    test('should switch to cards and remember it for the collection', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts')
        await app(page).getByRole('button', { name: 'Card view' }).click()

        await expect(app(page).getByRole('table')).toHaveCount(0)
        await expect(app(page).getByRole('list', { name: 'Posts' }).getByRole('listitem')).toHaveCount(2)

        await page.reload()
        await open(page, '#/posts')

        await expect(app(page).getByRole('list', { name: 'Posts' }).getByRole('listitem')).toHaveCount(2)

        await app(page).getByRole('button', { name: 'Table view' }).click()

        await expect(app(page).getByRole('table')).toBeVisible()
    })

    test('should publish the selected entries', async ({ page }) => {
        const requests: string[] = []

        await serve(page, threePosts(), requests)
        await open(page, '#/posts')
        await expect(app(page).getByRole('region', { name: 'Bulk actions' })).toHaveCount(0)
        await app(page).getByRole('checkbox', { name: 'Select First post' }).check()
        await app(page).getByRole('checkbox', { name: 'Select Second post' }).check()

        await expect(app(page).getByText('2 selected')).toBeVisible()

        await app(page).getByRole('button', { name: 'Publish', exact: true }).click()

        await expect(app(page).getByText('2 selected')).toHaveCount(0)
        expect(requests).toContain('PUT /posts/1')
        expect(requests).toContain('PUT /posts/2')
        expect(requests.filter((request) => request.startsWith('PUT'))).toHaveLength(2)
    })

    test('should delete the selected entries only after a confirmation', async ({ page }) => {
        const requests: string[] = []

        await serve(page, threePosts(), requests)
        await open(page, '#/posts')
        await app(page).getByRole('checkbox', { name: 'Select all' }).check()
        await app(page).getByRole('button', { name: 'Delete', exact: true }).click()
        await app(page).getByRole('button', { name: 'Cancel' }).click()

        expect(requests.some((request) => request.startsWith('DELETE'))).toBe(false)

        await app(page).getByRole('button', { name: 'Delete', exact: true }).click()
        await app(page).getByRole('button', { name: 'Confirm delete 2' }).click()

        await expect(app(page).getByRole('cell', { name: 'Third thing', exact: true })).toBeVisible()
        await expect(app(page).getByRole('cell', { name: 'First post', exact: true })).toHaveCount(0)
        expect(requests.filter((request) => request.startsWith('DELETE'))).toEqual(['DELETE /posts/1', 'DELETE /posts/2'])
    })

    test('should show the entry in a drawer, and close it with Escape, the button and the scrim', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts')
        await app(page).getByRole('button', { name: 'Preview First post' }).click()

        const drawer = app(page).getByRole('dialog', { name: 'Preview First post' })

        await expect(drawer).toBeVisible()
        await expect(drawer.getByText('long text one')).toBeVisible()
        await expect(drawer.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '#/posts/1')

        await page.keyboard.press('Escape')

        await expect(drawer).toHaveCount(0)
        await expect(app(page).getByRole('button', { name: 'Preview First post' })).toBeFocused()

        await app(page).getByRole('button', { name: 'Preview Second post' }).click()

        const second = app(page).getByRole('dialog', { name: 'Preview Second post' })

        await second.getByRole('button', { name: 'Close' }).click()

        await expect(second).toHaveCount(0)

        await app(page).getByRole('button', { name: 'Preview First post' }).click()
        await page.mouse.click(5, 300)

        await expect(drawer).toHaveCount(0)
    })

    test('should keep the page behind the drawer out of the tab order', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts')
        await app(page).getByRole('button', { name: 'Preview First post' }).click()
        await expect(app(page).getByRole('dialog')).toBeVisible()

        for (let step = 0; step < 6; step++) {
            await page.keyboard.press('Tab')
            await expect(app(page).locator('table :focus, nav[aria-label="Collections"] :focus')).toHaveCount(0)
        }
    })

    test('should say when the API fails', async ({ page }) => {
        await page.route('https://api.example.com/**', (route) => route.fulfill({ status: 500, json: { message: 'Database is down' } }))
        await open(page, '#/posts')

        await expect(app(page).getByRole('alert')).toHaveText('Database is down')
    })

    test('should say when the collection does not exist', async ({ page }) => {
        await serve(page, [])
        await open(page, '#/nothing')

        await expect(app(page).getByRole('alert')).toContainText('There is no collection "nothing"')
    })
})

test.describe('navigation', () => {
    test('should show the menu, mark the active collection and switch', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts')

        await expect(app(page).getByRole('link', { name: 'Posts' })).toHaveAttribute('aria-current', 'page')
        await app(page).getByRole('link', { name: 'notes' }).click()

        await expect(app(page).getByRole('heading', { name: 'notes', exact: true })).toBeVisible()
        expect(page.url()).toMatch(/#\/notes$/)
    })

    test('should follow the back button', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts')
        await app(page).getByRole('link', { name: 'notes' }).click()
        await page.goBack()

        await expect(app(page).getByRole('heading', { name: 'Posts', exact: true })).toBeVisible()
    })

    test('should open the editor from a link in the list', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts')
        await app(page).getByRole('link', { name: 'Edit Second post' }).click()

        await expect(app(page).getByLabel('Title')).toHaveValue('Second post')
        await expect(app(page).getByLabel('Status')).toHaveValue('published')
        await expect(app(page).getByLabel('Body')).toHaveValue('long text two')
        expect(page.url()).toMatch(/#\/posts\/2$/)
    })

    test('should show only the sign-in until the person has signed in', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts', { type: 'bearer' })

        await expect(app(page).getByLabel('Token')).toBeVisible()
        await expect(app(page).getByRole('navigation')).toHaveCount(0)

        await app(page).getByLabel('Token').fill('abc')
        await app(page).getByRole('button', { name: 'Sign in' }).click()

        await expect(app(page).getByRole('heading', { name: 'Posts', exact: true })).toBeVisible()
    })
})

test.describe('sidebar', () => {
    test('should show the logo, and the monkey alone when it is folded', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts')

        const logo = app(page).locator('monkey-sidebar monkey-logo')
        const width = () => logo.evaluate((element) => element.getBoundingClientRect().width)

        await expect(logo.getByRole('img', { name: 'MonkeyCMS' })).toBeVisible()

        const full = await width()

        await app(page).getByRole('button', { name: 'Collapse' }).click()

        await expect(app(page).getByRole('button', { name: 'Expand' })).toBeVisible()
        expect(await width()).toBeLessThan(full / 3)
    })

    test('should show the count of a collection once its list is loaded', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts')

        const nav = app(page).getByRole('navigation', { name: 'Collections' })

        await expect(nav.getByRole('link', { name: 'Posts' })).toContainText('3')
        await expect(nav.getByRole('link', { name: 'notes' })).not.toContainText(/\d/)
    })

    test('should fold to a rail of icons, keep the names for screen readers, and remember it', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts')

        const nav = app(page).getByRole('navigation', { name: 'Collections' })
        const toggle = app(page).getByRole('button', { name: 'Collapse' })
        const width = () => app(page).locator('monkey-sidebar').evaluate((element) => element.getBoundingClientRect().width)

        const open_ = await width()

        await toggle.click()

        await expect(app(page).getByRole('button', { name: 'Expand' })).toHaveAttribute('aria-expanded', 'false')
        await expect(nav.getByRole('link', { name: 'Posts' })).toBeVisible()
        expect(await width()).toBeLessThan(open_ / 2)

        await page.reload()
        await open(page, '#/posts')

        await expect(app(page).getByRole('button', { name: 'Expand' })).toBeVisible()

        await app(page).getByRole('button', { name: 'Expand' }).click()

        expect(await width()).toBe(open_)
    })

    test('should have Sign out only when the API needs a sign-in, and go back to the sign-in with it', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts')

        await expect(app(page).getByRole('button', { name: 'Sign out' })).toHaveCount(0)

        await page.reload()
        await open(page, '#/posts', { type: 'bearer' })
        await app(page).getByLabel('Token').fill('abc')
        await app(page).getByRole('button', { name: 'Sign in' }).click()
        await app(page).getByRole('button', { name: 'Sign out' }).click()

        await expect(app(page).getByLabel('Token')).toBeVisible()
        await expect(app(page).getByRole('navigation', { name: 'Collections' })).toHaveCount(0)
    })
})

test.describe('rich-text field', () => {
    const richtext = { type: 'richtext', label: 'Body', format: 'markdown' }

    test('should edit a Markdown value as formatted text, and show it as plain text in the preview', async ({ page }) => {
        await serve(page, [{ id: 1, title: 'First post', body: '## Heading\n\nSome **bold** text' }])
        await open(page, '#/posts/1', undefined, undefined, richtext)

        const editor = app(page).getByRole('textbox', { name: 'Body' })

        await expect(editor.getByRole('heading', { name: 'Heading' })).toBeVisible()
        await expect(editor.locator('strong')).toHaveText('bold')

        await app(page).getByRole('button', { name: 'Preview', exact: true }).click()

        await expect(app(page).getByRole('button', { name: /Body/ })).toContainText('Heading Some bold text')
    })

    test('should not be a column in the list, and show as plain text in the drawer', async ({ page }) => {
        await serve(page, [{ id: 1, title: 'First post', body: '<h2>Heading</h2><p>Some <em>text</em></p>' }])
        await open(page, '#/posts', undefined, undefined, { type: 'richtext', label: 'Body' })

        await expect(app(page).getByRole('columnheader', { name: 'Body' })).toHaveCount(0)

        await app(page).getByRole('button', { name: 'Preview First post' }).click()

        await expect(app(page).getByRole('dialog', { name: 'Preview First post' })).toContainText('Heading Some text')
    })
})

test.describe('theme and settings', () => {
    const token = (page: Page, name: string) => page.evaluate((property) => document.documentElement.style.getPropertyValue(property), name)

    test('should turn the theme of the config into tokens', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts', undefined, { preset: 'teal', mode: 'dark', radius: 'round' })

        expect(await token(page, '--monkey-accent-color')).toBe('#0f766e')
        expect(await token(page, '--monkey-radius')).toBe('1rem')
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    })

    test('should change the look at once, keep the choice, and go back to the config on reset', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts', undefined, { preset: 'teal' })
        await app(page).getByRole('link', { name: 'Settings' }).click()

        await expect(app(page).getByRole('heading', { name: 'Settings' })).toBeVisible()
        await expect(app(page).getByRole('button', { name: 'teal' })).toHaveAttribute('aria-pressed', 'true')

        await app(page).getByRole('button', { name: 'rose' }).click()

        expect(await token(page, '--monkey-accent-color')).toBe('#be123c')
        await app(page).getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'dark' }).click()
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

        await page.reload()
        await open(page, '#/settings', undefined, { preset: 'teal' })

        expect(await token(page, '--monkey-accent-color')).toBe('#be123c')

        await app(page).getByRole('button', { name: 'Reset to the config' }).click()

        expect(await token(page, '--monkey-accent-color')).toBe('#0f766e')
        await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
    })

    test('should show the choice as config and as CSS in the code tab', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/settings')
        await app(page).getByRole('button', { name: 'forest' }).click()
        await app(page).getByRole('button', { name: 'Code' }).click()

        await expect(app(page).getByText('"accent": "#166534"')).toBeVisible()
        await expect(app(page).getByText('--monkey-accent-color: #166534;')).toBeVisible()
    })
})

test.describe('entry editor', () => {
    test('should check the values before it sends anything', async ({ page }) => {
        const requests: string[] = []

        await serve(page, threePosts(), requests)
        await open(page, '#/posts/new')
        await app(page).getByRole('button', { name: 'Save' }).click()

        await expect(app(page).getByText('This field is required', { exact: true })).toBeVisible()
        await expect(app(page).getByLabel('Title')).toHaveAttribute('aria-invalid', 'true')
        expect(requests.filter((request) => request.startsWith('POST'))).toEqual([])
    })

    test('should list the problems, and move the focus to a field from the list', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts/new')
        await app(page).getByRole('button', { name: 'Save' }).click()

        const list = app(page).getByRole('list', { name: 'Fields to fix' })

        await expect(list.getByRole('listitem')).toHaveText(['Title: This field is required'])

        await list.getByRole('button', { name: 'Title' }).click()

        await expect(app(page).getByLabel('Title')).toBeFocused()
    })

    test('should group the fields in sections, with an outline that jumps to one', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts/new')

        await expect(app(page).getByRole('heading', { level: 3 })).toHaveText(['Content', 'Publishing'])
        await expect(app(page).getByRole('navigation', { name: 'Sections' }).getByRole('button')).toHaveText(['Content', 'Publishing'])

        await app(page).getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Publishing' }).click()

        await expect(app(page).getByRole('heading', { name: 'Publishing' })).toBeFocused()
        expect(page.url()).toMatch(/#\/posts\/new$/)
    })

    test('should show in the save bar whether there are unsaved changes', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts/1')

        const bar = app(page).locator('.bar')

        await expect(bar.getByRole('status')).toHaveText('No changes')

        await app(page).getByLabel('Title').fill('Changed')

        await expect(bar.getByRole('status')).toHaveText('Unsaved changes')

        await app(page).getByLabel('Title').fill('First post')

        await expect(bar.getByRole('status')).toHaveText('No changes')
    })

    test('should swap the form for a preview of the values, and go back to a field', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts/1')
        await app(page).getByLabel('Title').fill('A live title')
        await app(page).getByRole('button', { name: 'Preview', exact: true }).click()

        await expect(app(page).getByLabel('Title')).toHaveCount(0)
        await expect(app(page).getByRole('button', { name: /A live title/ })).toBeVisible()
        await expect(app(page).getByRole('button', { name: /long text one/ })).toBeVisible()
        await expect(app(page).getByRole('navigation', { name: 'Sections' })).toHaveCount(0)

        await app(page).getByRole('button', { name: /long text one/ }).click()

        await expect(app(page).getByLabel('Body')).toBeFocused()
        await expect(app(page).getByLabel('Title')).toHaveValue('A live title')
    })

    test('should clear the error of a field when the person changes it', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts/new')
        await app(page).getByRole('button', { name: 'Save' }).click()
        await app(page).getByLabel('Title').fill('x')

        await expect(app(page).getByLabel('Title')).toHaveAttribute('aria-invalid', 'false')
    })

    test('should create an entry, and go back to the list', async ({ page }) => {
        const posts = threePosts()

        await serve(page, posts)
        await open(page, '#/posts/new')
        await app(page).getByLabel('Title').fill('Brand new')
        await app(page).getByLabel('Status').selectOption('draft')
        await app(page).getByRole('button', { name: 'Save' }).click()

        await expect(app(page).getByRole('heading', { name: 'Posts', exact: true })).toBeVisible()
        expect(page.url()).toMatch(/#\/posts$/)
        expect(posts.at(-1)).toMatchObject({ title: 'Brand new', status: 'draft' })
    })

    test('should update an entry', async ({ page }) => {
        const posts = threePosts()

        await serve(page, posts)
        await open(page, '#/posts/1')
        await app(page).getByLabel('Title').fill('First, changed')
        await app(page).getByRole('button', { name: 'Save' }).click()

        await expect(app(page).getByRole('heading', { name: 'Posts', exact: true })).toBeVisible()
        expect(posts[0]).toMatchObject({ id: 1, title: 'First, changed', body: 'long text one' })
    })

    test('should show an error of the API at its field', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts/new')
        await app(page).getByLabel('Title').fill('taken')
        await app(page).getByRole('button', { name: 'Save' }).click()

        await expect(app(page).getByLabel('Title')).toHaveAccessibleDescription('This title is taken')
        await expect(app(page).getByRole('alert').filter({ hasText: 'Not saved' })).toBeVisible()
        await expect(app(page).getByRole('heading', { name: /New/ })).toBeVisible()
    })

    test('should say when the entry does not exist', async ({ page }) => {
        await page.route('https://api.example.com/**', (route) => route.fulfill({ status: 404, json: { message: 'No such post' } }))
        await open(page, '#/posts/99')

        await expect(app(page).getByRole('alert')).toHaveText('No such post')
    })
})

test.describe('unsaved changes', () => {
    test('should ask before it leaves a changed entry, and stay when the person says no', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts/1')
        await app(page).getByLabel('Title').fill('Changed')

        const questions: string[] = []

        // The click waits for the dialog, so the dialog is handled by a listener.
        page.once('dialog', (dialog) => { questions.push(dialog.message()); void dialog.dismiss() })
        await app(page).getByRole('link', { name: 'Cancel' }).click()

        await expect.poll(() => questions).toEqual(['You have unsaved changes. Leave without saving?'])
        await expect(app(page).getByLabel('Title')).toHaveValue('Changed')
        await expect.poll(() => page.url()).toMatch(/#\/posts\/1$/)
    })

    test('should leave when the person says yes', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts/1')
        await app(page).getByLabel('Title').fill('Changed')
        page.once('dialog', (dialog) => { void dialog.accept() })
        await app(page).getByRole('link', { name: 'Cancel' }).click()

        await expect(app(page).getByRole('heading', { name: 'Posts', exact: true })).toBeVisible()
    })

    test('should not ask when nothing changed, or when the change is put back', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts/1')

        let asked = false

        page.on('dialog', (dialog) => { asked = true; void dialog.dismiss() })
        await app(page).getByLabel('Title').fill('Changed')
        await app(page).getByLabel('Title').fill('First post')
        await app(page).getByRole('link', { name: 'Cancel' }).click()

        await expect(app(page).getByRole('heading', { name: 'Posts', exact: true })).toBeVisible()
        expect(asked).toBe(false)
    })

    test('should not ask after a save', async ({ page }) => {
        await serve(page, threePosts())
        await open(page, '#/posts/1')

        let asked = false

        page.on('dialog', (dialog) => { asked = true; void dialog.dismiss() })
        await app(page).getByLabel('Title').fill('Changed')
        await app(page).getByRole('button', { name: 'Save' }).click()

        await expect(app(page).getByRole('heading', { name: 'Posts', exact: true })).toBeVisible()
        expect(asked).toBe(false)
    })
})
