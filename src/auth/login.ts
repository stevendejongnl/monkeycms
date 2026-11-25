import type { CookieAuth, LoginAuth } from '../config/main.ts'
import { buildUrl, getPath, MappingError } from '../mapping/main.ts'
import type { RequestDescription } from '../mapping/main.ts'
import { cookieSession } from './session.ts'
import type { Session } from './types.ts'


export type LoginEndpointAuth = LoginAuth | (CookieAuth & { readonly path: string })

// The request that sends the credentials. The path is placed under baseUrl.
export const loginRequest = (baseUrl: string, auth: LoginEndpointAuth, values: Readonly<Record<string, string>>): RequestDescription => ({
    method: auth.method ?? 'POST',
    url: buildUrl(baseUrl, auth.path),
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
        [auth.usernameField ?? 'username']: values['username'] ?? '',
        [auth.passwordField ?? 'password']: values['password'] ?? '',
    }),
})

const tokenSession = (auth: LoginAuth, token: string, expiresAt: number | undefined): Session => ({
    headers: { [auth.header ?? 'authorization']: auth.scheme === '' ? token : `${auth.scheme ?? 'Bearer'} ${token}` },
    query: {},
    ...(expiresAt === undefined ? {} : { expiresAt }),
})

const expiresAtOf = (body: unknown, auth: LoginAuth, now: number): number | undefined => {
    const seconds = auth.expiresInPath === undefined ? Number.NaN : Number(getPath(body, auth.expiresInPath))

    return Number.isFinite(seconds) && seconds > 0 ? now + seconds * 1000 : undefined
}

// The session from a successful login answer. A login answer without a token is an error.
export const readLogin = (body: unknown, auth: LoginEndpointAuth, now: number): Session => {
    if (auth.type === 'cookie') {
        return cookieSession()
    }

    const token = getPath(body, auth.tokenPath)

    if (typeof token !== 'string' || token === '') {
        throw new MappingError(`No token found at "${auth.tokenPath}"`)
    }

    return tokenSession(auth, token, expiresAtOf(body, auth, now))
}
