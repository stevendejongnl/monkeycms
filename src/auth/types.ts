import type { RequestDescription } from '../mapping/main.ts'
import type { Result } from '../client/types.ts'


// What a request needs to be allowed. It holds the result of a sign-in (a token, a key),
// never the password that was used to get it.
export interface Session {
    readonly headers: Readonly<Record<string, string>>
    readonly query: Readonly<Record<string, string>>
    // "include" for a cookie session.
    readonly credentials?: 'include'
    // Milliseconds since the epoch. Without it the session does not expire on the client.
    readonly expiresAt?: number
}

// One value that the person has to enter to sign in. A component shows one input for each.
export interface CredentialField {
    readonly name: string
    readonly label: string
    // The input must hide what is typed.
    readonly secret: boolean
}

export interface Prepared {
    readonly request: RequestDescription
    readonly credentials?: 'include'
}

export interface Auth {
    // The values that signIn needs. Empty when the API needs no sign-in.
    readonly fields: readonly CredentialField[]
    // The session, or undefined when signed out or expired. Reading it in an effect follows changes.
    readonly session: () => Session | undefined
    readonly isSignedIn: () => boolean
    // Needs one value for each of the fields. Never throws. The values are not kept.
    readonly signIn: (values: Readonly<Record<string, string>>, options?: { signal?: AbortSignal }) => Promise<Result<void>>
    readonly signOut: () => void
    // Adds the session to a request. Returns undefined when a session is needed and there is none.
    readonly prepare: (request: RequestDescription) => Prepared | undefined
}
