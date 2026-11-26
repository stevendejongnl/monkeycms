import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'


// Adds an element to the page. The properties are set after the attributes. Every
// "monkey-change" event that reaches the page is saved in window.changes.
const mount = (page: Page, tag: string, attributes: Record<string, string> = {}, properties: Record<string, unknown> = {}) =>
    page.evaluate(([name, attrs, props]) => {
        const element = document.createElement(name as string)

        Object.entries(attrs as Record<string, string>).forEach(([key, value]) => element.setAttribute(key, value))
        Object.assign(element, props)
        document.body.replaceChildren(element)
    }, [tag, attributes, properties] as const)

const changes = (page: Page) => page.evaluate(() => (window as unknown as { changes: unknown[] }).changes)

test.beforeEach(async ({ page }) => {
    await page.goto('/public/index.html')
    await page.evaluate(() => {
        const log: unknown[] = []

        Object.assign(window, { changes: log })
        document.addEventListener('monkey-change', (event) => log.push((event as CustomEvent).detail))
    })
})

// The contract of every input: the same label, error, required and disabled behavior.
const inputs = [
    { tag: 'monkey-text-field', control: 'textbox' },
    { tag: 'monkey-longtext-field', control: 'textbox' },
    { tag: 'monkey-richtext-field', control: 'textbox' },
    { tag: 'monkey-number-field', control: 'spinbutton' },
    { tag: 'monkey-boolean-field', control: 'checkbox' },
    { tag: 'monkey-date-field', control: undefined },
    { tag: 'monkey-select-field', control: 'combobox' },
] as const

for (const { tag } of inputs) {
    test.describe(tag, () => {
        test('should tie the label to the control', async ({ page }) => {
            await mount(page, tag, { name: 'title', label: 'Post title' })

            await expect(page.locator(tag).getByLabel('Post title')).toBeVisible()
        })

        test('should use the name when there is no label', async ({ page }) => {
            await mount(page, tag, { name: 'title' })

            await expect(page.locator(tag).getByLabel('title')).toBeVisible()
        })

        test('should mark a required field without making the label longer for a screen reader', async ({ page }) => {
            await mount(page, tag, { name: 'title', label: 'Title', required: '' })

            await expect(page.locator(tag).locator('label span')).toHaveAttribute('aria-hidden', 'true')
            await expect(page.locator(tag).getByLabel('Title')).toHaveAccessibleName('Title')
        })

        test('should show an error, announce it and link it to the control', async ({ page }) => {
            await mount(page, tag, { name: 'title', label: 'Title', error: 'Title is too short' })

            const control = page.locator(tag).getByLabel('Title')

            await expect(page.locator(tag).getByRole('alert')).toHaveText('Title is too short')
            await expect(control).toHaveAttribute('aria-invalid', 'true')
            await expect(control).toHaveAccessibleDescription('Title is too short')
        })

        test('should show no error when there is none', async ({ page }) => {
            await mount(page, tag, { name: 'title', label: 'Title' })

            await expect(page.locator(tag).getByRole('alert')).toHaveCount(0)
            await expect(page.locator(tag).getByLabel('Title')).toHaveAttribute('aria-invalid', 'false')
        })

        test('should be disabled when asked', async ({ page }) => {
            await mount(page, tag, { name: 'title', label: 'Title', disabled: '' })

            await expect(page.locator(tag).getByLabel('Title')).toBeDisabled()
        })
    })
}

test.describe('monkey-text-field', () => {
    test('should show the value and send the changes', async ({ page }) => {
        await mount(page, 'monkey-text-field', { name: 'title', label: 'Title' }, { value: 'Hello' })

        const input = page.getByLabel('Title')

        await expect(input).toHaveValue('Hello')
        await input.fill('Hello world')

        expect(await changes(page)).toEqual([{ name: 'title', value: 'Hello world' }])
        expect(await page.locator('monkey-text-field').evaluate((element) => (element as unknown as { value: string }).value)).toBe('Hello world')
    })

    test('should not accept typing when read only', async ({ page }) => {
        await mount(page, 'monkey-text-field', { name: 'title', label: 'Title', readonly: '' }, { value: 'Fixed' })

        await expect(page.getByLabel('Title')).not.toBeEditable()
    })

    test('should follow a new value from outside', async ({ page }) => {
        await mount(page, 'monkey-text-field', { name: 'title', label: 'Title' }, { value: 'One' })
        await page.locator('monkey-text-field').evaluate((element) => { (element as unknown as { value: string }).value = 'Two' })

        await expect(page.getByLabel('Title')).toHaveValue('Two')
    })
})

test.describe('monkey-longtext-field', () => {
    test('should be a multi-line text box and keep line breaks', async ({ page }) => {
        await mount(page, 'monkey-longtext-field', { name: 'body', label: 'Body' })
        await page.getByLabel('Body').fill('one\ntwo')

        // Some browsers send one input event for each line.
        expect((await changes(page)).at(-1)).toEqual({ name: 'body', value: 'one\ntwo' })
        expect(await page.getByLabel('Body').evaluate((element) => element.tagName)).toBe('TEXTAREA')
    })
})

test.describe('monkey-number-field', () => {
    test('should send a number, also a decimal one', async ({ page }) => {
        await mount(page, 'monkey-number-field', { name: 'price', label: 'Price' })
        await page.getByLabel('Price').fill('12.5')

        expect(await changes(page)).toEqual([{ name: 'price', value: 12.5 }])
    })

    test('should send undefined when it is emptied', async ({ page }) => {
        await mount(page, 'monkey-number-field', { name: 'price', label: 'Price' }, { value: 3 })
        await page.getByLabel('Price').fill('')

        expect(await changes(page)).toEqual([{ name: 'price', value: undefined }])
    })

    test('should show zero as zero', async ({ page }) => {
        await mount(page, 'monkey-number-field', { name: 'price', label: 'Price' }, { value: 0 })

        await expect(page.getByLabel('Price')).toHaveValue('0')
    })

    test('should step with the arrow keys', async ({ page }) => {
        await mount(page, 'monkey-number-field', { name: 'price', label: 'Price' }, { value: 1 })
        await page.getByLabel('Price').press('ArrowUp')

        expect(await changes(page)).toEqual([{ name: 'price', value: 2 }])
    })
})

test.describe('monkey-boolean-field', () => {
    test('should show the value and send the changes', async ({ page }) => {
        await mount(page, 'monkey-boolean-field', { name: 'featured', label: 'Featured' }, { value: true })

        const box = page.getByLabel('Featured')

        await expect(box).toBeChecked()
        await box.uncheck()

        expect(await changes(page)).toEqual([{ name: 'featured', value: false }])
    })

    test('should toggle with the space key', async ({ page }) => {
        await mount(page, 'monkey-boolean-field', { name: 'featured', label: 'Featured' })
        await page.getByLabel('Featured').press('Space')

        expect(await changes(page)).toEqual([{ name: 'featured', value: true }])
    })

    test('should not change when read only', async ({ page }) => {
        await mount(page, 'monkey-boolean-field', { name: 'featured', label: 'Featured', readonly: '' })

        await expect(page.getByLabel('Featured')).toBeDisabled()
    })
})

test.describe('monkey-date-field', () => {
    test('should show the day of an ISO date', async ({ page }) => {
        await mount(page, 'monkey-date-field', { name: 'day', label: 'Day' }, { value: '2026-11-25T08:30:00.000Z' })

        await expect(page.getByLabel('Day')).toHaveValue('2026-11-25')
    })

    test('should send the chosen day as midnight UTC', async ({ page }) => {
        await mount(page, 'monkey-date-field', { name: 'day', label: 'Day' })
        await page.getByLabel('Day').fill('2026-12-01')

        expect(await changes(page)).toEqual([{ name: 'day', value: '2026-12-01T00:00:00.000Z' }])
    })

    test('should send undefined when it is cleared', async ({ page }) => {
        await mount(page, 'monkey-date-field', { name: 'day', label: 'Day' }, { value: '2026-11-25T00:00:00.000Z' })
        await page.getByLabel('Day').fill('')

        expect(await changes(page)).toEqual([{ name: 'day', value: undefined }])
    })
})

test.describe('monkey-select-field', () => {
    const options = ['draft', 'published']

    test('should list the options and show the value', async ({ page }) => {
        await mount(page, 'monkey-select-field', { name: 'status', label: 'Status' }, { options, value: 'published' })

        await expect(page.getByLabel('Status')).toHaveValue('published')
        await expect(page.getByLabel('Status').getByRole('option')).toHaveText(['', 'draft', 'published'])
    })

    test('should send the chosen option, and undefined for the empty choice', async ({ page }) => {
        await mount(page, 'monkey-select-field', { name: 'status', label: 'Status' }, { options })
        await page.getByLabel('Status').selectOption('draft')
        await page.getByLabel('Status').selectOption('')

        expect(await changes(page)).toEqual([{ name: 'status', value: 'draft' }, { name: 'status', value: undefined }])
    })

    test('should hide the empty choice when the field is required', async ({ page }) => {
        await mount(page, 'monkey-select-field', { name: 'status', label: 'Status', required: '' }, { options })

        await expect(page.getByLabel('Status').getByRole('option')).toHaveText(['draft', 'published'])
    })
})

test.describe('monkey-richtext-field', () => {
    const editor = (page: Page) => page.getByRole('textbox', { name: 'Body' })

    const draw = (page: Page, value: string, format = 'html') =>
        mount(page, 'monkey-richtext-field', { name: 'body', label: 'Body', format }, { value })

    // Types a letter at the end of the text, so the field sends its value.
    const touch = async (page: Page) => {
        await editor(page).click()
        await page.keyboard.press('Control+End')
        await page.keyboard.type('!')
    }

    test('should show the value as formatted text', async ({ page }) => {
        await draw(page, '<h2>Title</h2><p>Some <strong>bold</strong> and <em>italic</em> text</p><ul><li>one</li></ul>')

        await expect(editor(page).getByRole('heading', { name: 'Title' })).toBeVisible()
        await expect(editor(page).locator('strong')).toHaveText('bold')
        await expect(editor(page).getByRole('listitem')).toHaveText(['one'])
    })

    test('should have a toolbar with the formats', async ({ page }) => {
        await draw(page, '')

        const buttons = page.getByRole('toolbar', { name: 'Formatting' }).getByRole('button')

        await expect(buttons).toHaveCount(6)
        expect(await buttons.evaluateAll((all) => all.map((button) => button.getAttribute('aria-label'))))
            .toEqual(['Heading', 'Bold', 'Italic', 'Bulleted list', 'Quote', 'Paragraph'])
    })

    test('should make the selected text bold, and send the HTML', async ({ page }) => {
        await draw(page, '<p>Hello world</p>')
        await editor(page).click()
        await editor(page).locator('p').selectText()
        await page.getByRole('button', { name: 'Bold' }).click()

        await expect(editor(page).locator('b, strong')).toHaveText('Hello world')
        expect((await changes(page)).at(-1)).toEqual({ name: 'body', value: '<p><strong>Hello world</strong></p>' })
    })

    test('should make a block a heading, a list or a quote', async ({ page }) => {
        await draw(page, '<p>One</p><p>Two</p><p>Three</p>')
        await editor(page).getByText('One').click()
        await page.getByRole('button', { name: 'Heading', exact: true }).click()
        await editor(page).getByText('Two').click()
        await page.getByRole('button', { name: 'Bulleted list' }).click()
        await editor(page).getByText('Three').click()
        await page.getByRole('button', { name: 'Quote' }).click()

        expect((await changes(page)).at(-1)).toEqual({ name: 'body', value: '<h2>One</h2><ul><li>Two</li></ul><blockquote>Three</blockquote>' })
    })

    test('should send the typed text in a paragraph', async ({ page }) => {
        await draw(page, '')
        await editor(page).click()
        await page.keyboard.type('Plain text')

        expect((await changes(page)).at(-1)).toEqual({ name: 'body', value: '<p>Plain text</p>' })
    })

    test('should send an empty string when the text is gone', async ({ page }) => {
        await draw(page, '<p>x</p>')
        await editor(page).click()
        await page.keyboard.press('Control+A')
        await page.keyboard.press('Delete')

        expect((await changes(page)).at(-1)).toEqual({ name: 'body', value: '' })
    })

    test('should remove scripts, handlers, attributes and unknown tags from the value', async ({ page }) => {
        await draw(page, '<p onclick="x()" style="color:red">Hi <a href="javascript:x">link</a><img src=x onerror="window.hacked=1"></p><script>window.hacked=1</script><div><h4>Deep</h4></div><iframe src="x"></iframe>')
        await touch(page)

        expect((await changes(page)).at(-1)).toEqual({ name: 'body', value: '<p>Hi link</p><h3>Deep!</h3>' })
        expect(await page.evaluate(() => (window as unknown as { hacked?: number }).hacked)).toBeUndefined()
        await expect(editor(page).locator('script, img, iframe, a, [onclick], [style]')).toHaveCount(0)
    })

    test('should keep the text that a pasted block of other tags has', async ({ page }) => {
        await draw(page, '<div>One<br>Two</div><table><tr><td>Cell</td></tr></table>')
        await touch(page)

        expect((await changes(page)).at(-1)).toEqual({ name: 'body', value: '<p>One<br>Two</p><p>Cell!</p>' })
    })

    test('should store Markdown with the format markdown, and show it formatted', async ({ page }) => {
        await draw(page, '## Title\n\nSome **bold** text\n\n- one\n- two', 'markdown')

        await expect(editor(page).getByRole('heading', { name: 'Title' })).toBeVisible()
        await expect(editor(page).locator('strong')).toHaveText('bold')
        await expect(editor(page).getByRole('listitem')).toHaveText(['one', 'two'])

        await touch(page)

        expect((await changes(page)).at(-1)).toEqual({ name: 'body', value: '## Title\n\nSome **bold** text\n\n- one\n- two!' })
    })

    test('should not run HTML in a Markdown value', async ({ page }) => {
        await draw(page, '<img src=x onerror="window.hacked=1"> <script>window.hacked=1</script>', 'markdown')

        await expect(editor(page).locator('img, script')).toHaveCount(0)
        await expect(editor(page)).toContainText('<script>')
        expect(await page.evaluate(() => (window as unknown as { hacked?: number }).hacked)).toBeUndefined()
    })

    test('should take a new value from outside, and keep the cursor while the person types', async ({ page }) => {
        await draw(page, '<p>First</p>')
        await page.locator('monkey-richtext-field').evaluate((element) => { (element as unknown as { value: string }).value = '<p>Second</p>' })

        await expect(editor(page)).toHaveText('Second')

        await editor(page).click()
        await page.keyboard.press('Control+End')
        await page.keyboard.type('abc')

        await expect(editor(page)).toHaveText('Secondabc')
    })

    test('should not change, and have a disabled toolbar, when it is read-only', async ({ page }) => {
        await mount(page, 'monkey-richtext-field', { name: 'body', label: 'Body', readonly: '' }, { value: '<p>Fixed</p>' })

        await expect(editor(page)).toHaveAttribute('contenteditable', 'false')
        await expect(page.getByRole('button', { name: 'Bold' })).toBeDisabled()
    })

    test('should move the focus to the editor', async ({ page }) => {
        await draw(page, '')
        await page.locator('monkey-richtext-field').evaluate((element) => (element as HTMLElement).focus())

        await expect(editor(page)).toBeFocused()
    })
})

test.describe('monkey-field', () => {
    const draw = (page: Page, field: object, value?: unknown, attributes: Record<string, string> = {}) =>
        mount(page, 'monkey-field', { name: 'x', ...attributes }, { field, value })

    test('should draw the right input for each type', async ({ page }) => {
        const tags: Record<string, string> = {
            text: 'monkey-text-field',
            longtext: 'monkey-longtext-field',
            richtext: 'monkey-richtext-field',
            number: 'monkey-number-field',
            boolean: 'monkey-boolean-field',
            date: 'monkey-date-field',
            select: 'monkey-select-field',
        }

        for (const [type, tag] of Object.entries(tags)) {
            await draw(page, { type })

            await expect(page.locator(`monkey-field ${tag}`)).toHaveCount(1)
        }
    })

    test('should pass the label, required mark, options and value on', async ({ page }) => {
        await draw(page, { type: 'select', label: 'Status', required: true, options: ['a', 'b'] }, 'b')

        await expect(page.getByLabel('Status')).toHaveValue('b')
        await expect(page.getByLabel('Status')).toBeVisible()
        await expect(page.getByLabel('Status').getByRole('option')).toHaveText(['a', 'b'])
    })

    test('should use the name as the label when the field has none', async ({ page }) => {
        await draw(page, { type: 'text' }, '', { name: 'title' })

        await expect(page.getByLabel('title')).toBeVisible()
    })

    test('should keep a read-only field from changing', async ({ page }) => {
        await draw(page, { type: 'text', label: 'Created', readOnly: true }, 'yesterday')

        await expect(page.getByLabel('Created')).not.toBeEditable()
    })

    test('should show an error and send the change with the name of the field', async ({ page }) => {
        await mount(page, 'monkey-field', { name: 'title', error: 'Too short' }, { field: { type: 'text', label: 'Title' } })
        await page.getByLabel('Title').fill('Hi')

        await expect(page.getByRole('alert')).toHaveText('Too short')
        expect(await changes(page)).toEqual([{ name: 'title', value: 'Hi' }])
    })

    test('should draw nothing without a field', async ({ page }) => {
        await mount(page, 'monkey-field', { name: 'title' })

        await expect(page.locator('monkey-field *')).toHaveCount(0)
    })
})

for (const tag of ['monkey-text-field', 'monkey-longtext-field']) {
    test(`${tag} should show an empty control when the value is undefined`, async ({ page }) => {
        await mount(page, tag, { name: 'title', label: 'Title' }, { value: undefined })

        await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('')
    })
}
