import type { ApiKeyAuth, AuthConfig } from '../config/main.ts'
import type { RequestDescription } from '../mapping/main.ts'
import type { Prepared, Session } from './types.ts'


const COOKIE_SESSION: Session = { headers: {}, query: {}, credentials: 'include' }

const base64 = (text: string): string =>
    btoa(Array.from(new TextEncoder().encode(text), (byte) => String.fromCharCode(byte)).join(''))

const apiKeySession = ({ name, in: place }: ApiKeyAuth, key: string): Session =>
    place === 'header' ? { headers: { [name]: key }, query: {} } : { headers: {}, query: { [name]: key } }

type Builder<T extends AuthConfig['type']> = (auth: Extract<AuthConfig, { type: T }>, values: Readonly<Record<string, string>>) => Session | undefined

// The session for the types that need no request to sign in. The login and cookie types get
// their session from the API, so they are not here.
const builders: { [T in 'bearer' | 'apiKey' | 'basic']: Builder<T> } = {
    bearer: (_auth, { token = '' }) => ({ headers: { authorization: `Bearer ${token}` }, query: {} }),
    apiKey: (auth, { key = '' }) => apiKeySession(auth, key),
    basic: (_auth, { username = '', password = '' }) => ({ headers: { authorization: `Basic ${base64(`${username}:${password}`)}` }, query: {} }),
}

export const isLocalType = (auth: AuthConfig): auth is Extract<AuthConfig, { type: keyof typeof builders }> =>
    auth.type in builders

export const localSession = (auth: Extract<AuthConfig, { type: keyof typeof builders }>, values: Readonly<Record<string, string>>): Session | undefined =>
    (builders[auth.type] as Builder<AuthConfig['type'] & keyof typeof builders>)(auth as never, values)

// The session that exists without a sign-in: a cookie session on the same site.
export const initialSession = (auth: AuthConfig): Session | undefined =>
    auth.type === 'cookie' && auth.path === undefined ? COOKIE_SESSION : undefined

export const cookieSession = (): Session => COOKIE_SESSION

// Puts the session in the request. The session wins over a header of the same name in the
// config, so a stale key in the config cannot replace the one the person entered.
export const applySession = (request: RequestDescription, session: Session): Prepared => {
    const url = new URL(request.url)

    Object.entries(session.query).forEach(([name, value]) => url.searchParams.set(name, value))

    return {
        request: { ...request, url: url.href, headers: { ...request.headers, ...session.headers } },
        ...(session.credentials === undefined ? {} : { credentials: session.credentials }),
    }
}

export const isExpired = (session: Session, now: number): boolean =>
    session.expiresAt !== undefined && session.expiresAt <= now

const isStringMap = (value: unknown): boolean =>
    typeof value === 'object' && value !== null && Object.values(value).every((item) => typeof item === 'string')

// A check for a session that was read from the storage.
export const isSession = (value: unknown): value is Session => {
    const session = value as Partial<Record<keyof Session, unknown>> | null

    return typeof session === 'object' && session !== null
        && isStringMap(session.headers) && isStringMap(session.query)
        && (session.credentials === undefined || session.credentials === 'include')
        && (session.expiresAt === undefined || typeof session.expiresAt === 'number')
        && session.headers !== undefined && session.query !== undefined
}
