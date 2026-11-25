import { createSessionStorageSignal, createSignal } from '../base/signals/signals.ts'
import { failure, toResult } from '../client/failure.ts'
import { send } from '../client/transport.ts'
import type { Fetcher } from '../client/transport.ts'
import type { MonkeyConfig } from '../config/main.ts'
import { MappingError, readError } from '../mapping/main.ts'
import type { RequestDescription } from '../mapping/main.ts'
import { credentialFields } from './credentials.ts'
import { loginRequest, readLogin } from './login.ts'
import type { LoginEndpointAuth } from './login.ts'
import { applySession, initialSession, isExpired, isLocalType, isSession, localSession } from './session.ts'
import type { Auth, Prepared, Session } from './types.ts'


export interface AuthOptions {
    readonly fetch?: Fetcher
    readonly timeoutMs?: number
    // The time in milliseconds. Pass another one in tests.
    readonly now?: () => number
}

export const SESSION_KEY = 'monkeycms.session'

const DEFAULT_TIMEOUT_MS = 15_000

const hasLoginEndpoint = (auth: MonkeyConfig['auth']): auth is LoginEndpointAuth =>
    auth !== undefined && (auth.type === 'login' || (auth.type === 'cookie' && auth.path !== undefined))

// Signs in as the auth block of the config says, and keeps the session. By default the
// session lives in memory, so a reload signs the person out. With persist "session" it lives
// in sessionStorage. Passwords are used for the sign-in request and are not kept.
export const createAuth = (config: MonkeyConfig, options: AuthOptions = {}): Auth => {
    const auth = config.auth ?? { type: 'none' as const }
    const fetcher: Fetcher = options.fetch ?? ((url, init) => fetch(url, init))
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const now = options.now ?? (() => Date.now())
    const fields = credentialFields(auth)
    const fallback = initialSession(auth)
    const persisted = 'persist' in auth && auth.persist === 'session'
    const [stored, setStored] = persisted
        ? createSessionStorageSignal<Session | undefined>(SESSION_KEY, fallback, (value): value is Session | undefined => value === undefined || isSession(value))
        : createSignal<Session | undefined>(fallback)

    // An expired session counts as no session.
    const session = (): Session | undefined => {
        const current = stored()

        return current !== undefined && isExpired(current, now()) ? undefined : current
    }

    const missing = (values: Readonly<Record<string, string>>): string | undefined =>
        fields.find(({ name }) => (values[name] ?? '') === '')?.label

    const remote = async (endpoint: LoginEndpointAuth, values: Readonly<Record<string, string>>, signal?: AbortSignal): Promise<Session> => {
        const request: RequestDescription = loginRequest(config.baseUrl, endpoint, values)
        const response = await send(fetcher, request, {
            timeoutMs,
            ...(signal === undefined ? {} : { signal }),
            ...(endpoint.type === 'cookie' ? { credentials: 'include' as const } : {}),
        })

        if (!response.ok) {
            const { message, fieldErrors } = readError(response.status, response.body, config.errors)

            throw failure('http', message, response.status, fieldErrors)
        }

        try {
            return readLogin(response.body, endpoint, now())
        } catch (error) {
            throw error instanceof MappingError ? failure('invalid-response', error.message) : error
        }
    }

    const signIn: Auth['signIn'] = (values, { signal } = {}) =>
        toResult(async () => {
            const absent = missing(values)

            if (absent !== undefined) {
                throw failure('request', `${absent} is required`)
            }

            setStored(
                hasLoginEndpoint(auth)
                    ? await remote(auth, values, signal)
                    : isLocalType(auth) ? localSession(auth, values) : fallback
            )
        })

    const prepare = (request: RequestDescription): Prepared | undefined => {
        const current = session()

        return auth.type === 'none'
            ? { request }
            : current === undefined ? undefined : applySession(request, current)
    }

    return {
        fields,
        session,
        isSignedIn: () => auth.type === 'none' || session() !== undefined,
        signIn,
        // A cookie session without a login endpoint stays, because the API owns it.
        signOut: () => setStored(fallback),
        prepare,
    }
}
