import type { AuthConfig } from '../config/main.ts'
import type { CredentialField } from './types.ts'


const USERNAME: CredentialField = { name: 'username', label: 'Username', secret: false }
const PASSWORD: CredentialField = { name: 'password', label: 'Password', secret: true }

const fieldsByType: { [T in AuthConfig['type']]: (auth: Extract<AuthConfig, { type: T }>) => CredentialField[] } = {
    none: () => [],
    bearer: () => [{ name: 'token', label: 'Token', secret: true }],
    apiKey: () => [{ name: 'key', label: 'API key', secret: true }],
    basic: () => [USERNAME, PASSWORD],
    cookie: ({ path }) => path === undefined ? [] : [USERNAME, PASSWORD],
    login: () => [USERNAME, PASSWORD],
}

export const credentialFields = (auth: AuthConfig): CredentialField[] =>
    (fieldsByType[auth.type] as (auth: AuthConfig) => CredentialField[])(auth)
