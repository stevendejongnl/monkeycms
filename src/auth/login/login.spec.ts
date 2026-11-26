import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'


const configWith = (auth: object) => ({
    configVersion: 1,
    baseUrl: 'https://api.example.com',
    auth,
    errors: { messagePath: 'message' },
    collections: { posts: { fields: { title: { type: 'text' } }, list: { path: '/posts' } } },
})

// Sets up the page with a config, and adds the login element.
const open = async (page: Page, auth: object) => {
    await page.goto('/public/index.html')
    await page.evaluate((config) => {
        const setUp = document.createElement('monkey-set-up')

        setUp.setAttribute('config', JSON.stringify(config))
        document.body.append(setUp, document.createElement('monkey-login'))
    }, configWith(auth))
    await expect(page.locator('monkey-set-up[config]').getByRole('status')).toBeVisible()
}

const login = (page: Page) => page.locator('monkey-login')

test.describe('Login', () => {
    test('should show nothing when the API needs no sign-in', async ({ page }) => {
        await open(page, { type: 'none' })

        await expect(login(page).getByRole('button')).toHaveCount(0)
        await expect(login(page).locator('input')).toHaveCount(0)
    })

    test('should ask for a token with a hidden input', async ({ page }) => {
        await open(page, { type: 'bearer' })

        await expect(login(page).getByLabel('Token')).toHaveAttribute('type', 'password')
    })

    test('should ask for a username and password, and let a browser fill them in', async ({ page }) => {
        await open(page, { type: 'basic' })

        await expect(login(page).getByLabel('Username')).toHaveAttribute('autocomplete', 'username')
        await expect(login(page).getByLabel('Username')).toHaveAttribute('type', 'text')
        await expect(login(page).getByLabel('Password')).toHaveAttribute('autocomplete', 'current-password')
    })

    test('should sign in with a token, tell the page, and offer sign-out', async ({ page }) => {
        await open(page, { type: 'bearer' })

        const signedIn = page.evaluate(() => new Promise((resolve) => document.addEventListener('monkey-signed-in', () => resolve(true), { once: true })))

        await login(page).getByLabel('Token').fill('abc')
        await login(page).getByRole('button', { name: 'Sign in' }).click()

        expect(await signedIn).toBe(true)
        await expect(login(page).getByRole('status')).toContainText('Signed in')
        await expect(login(page).locator('input')).toHaveCount(0)
    })

    test('should sign out and show the form again', async ({ page }) => {
        await open(page, { type: 'bearer' })
        await login(page).getByLabel('Token').fill('abc')
        await login(page).getByRole('button', { name: 'Sign in' }).click()
        await login(page).getByRole('button', { name: 'Sign out' }).click()

        await expect(login(page).getByLabel('Token')).toHaveValue('')
    })

    test('should show the message of the API when the login is refused', async ({ page }) => {
        await page.route('**/auth/login', (route) => route.fulfill({ status: 401, json: { message: 'Bad password' } }))
        await open(page, { type: 'login', path: '/auth/login', tokenPath: 'token' })
        await login(page).getByLabel('Username').fill('ann')
        await login(page).getByLabel('Password').fill('wrong')
        await login(page).getByRole('button', { name: 'Sign in' }).click()

        await expect(login(page).getByRole('alert')).toContainText('Bad password')
        await expect(login(page).getByLabel('Password')).toBeVisible()
    })

    test('should sign in at the login endpoint, and clear the password from the page', async ({ page }) => {
        const bodies: unknown[] = []

        await page.route('**/auth/login', (route) => {
            bodies.push(route.request().postDataJSON())

            return route.fulfill({ json: { token: 'T1' } })
        })
        await open(page, { type: 'login', path: '/auth/login', tokenPath: 'token' })
        await login(page).getByLabel('Username').fill('ann')
        await login(page).getByLabel('Password').fill('right')
        await login(page).getByRole('button', { name: 'Sign in' }).click()

        await expect(login(page).getByRole('status')).toContainText('Signed in')
        expect(bodies).toEqual([{ username: 'ann', password: 'right' }])
        expect(await page.evaluate(() => document.body.innerHTML.includes('right'))).toBe(false)
    })

    test('should show nothing for a cookie session without a login endpoint', async ({ page }) => {
        await open(page, { type: 'cookie' })

        await expect(login(page).locator('input')).toHaveCount(0)
        await expect(login(page).getByRole('button')).toHaveCount(0)
    })
})
