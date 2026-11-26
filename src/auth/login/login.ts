import { LitElement, css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { effect } from '../../base/signals/signals.ts'
import { alertStyles, buttonStyles, controlStyles } from '../../base/styles.ts'
import { getAuth } from '../store.ts'
import type { Auth, CredentialField } from '../types.ts'


export const SIGNED_IN = 'monkey-signed-in'
export const SIGNED_OUT = 'monkey-signed-out'

// Browsers fill in saved passwords only when they know what an input is for.
const autocompleteOf = ({ name }: CredentialField): string =>
    ({ username: 'username', password: 'current-password' })[name] ?? 'off'

// Shows the sign-in form for the auth type of the config, and a sign-out button when the
// person is signed in. It shows nothing when the API needs no sign-in. Sends
// "monkey-signed-in" and "monkey-signed-out". It also shows the form again when the client
// gets a 401, because the client then ends the session.
@customElement('monkey-login')
export class MonkeyLogin extends LitElement {
    static override styles = [controlStyles, buttonStyles, alertStyles, css`
        :host {
            display: grid;
        }

        form {
            display: grid;
            gap: 1.25rem;
            box-sizing: border-box;
            inline-size: min(26rem, 100%);
            margin: 2rem auto;
            padding: clamp(1.5rem, 5vw, 2.25rem);
            background: var(--monkey-surface-color);
            border: 1px solid var(--monkey-border-color);
            border-radius: calc(var(--monkey-radius) + 0.625rem);
        }

        label {
            display: grid;
            gap: var(--monkey-field-gap);
            font-weight: 600;
        }

        form button {
            min-block-size: 3.25rem;
        }

        p[role='status'] {
            display: grid;
            grid-auto-flow: column;
            justify-content: end;
            gap: 0.75rem;
            align-items: center;
            margin: 0;
            padding: 0.5rem clamp(1rem, 4vw, 3rem) 0;
            color: var(--monkey-muted-color);
        }

        p[role='status'] button {
            min-block-size: 2.75rem;
        }
    `]

    @state()
    private busy = false

    @state()
    private message = ''

    private stop: (() => void) | undefined

    private cancel: AbortController | undefined

    override connectedCallback(): void {
        super.connectedCallback()
        // The effect reads the auth and its session, so the element redraws when either changes.
        this.stop = effect(() => {
            const auth = getAuth()

            auth?.session()
            this.requestUpdate()
        })
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback()
        this.stop?.()
        this.cancel?.abort()
    }

    private async signIn(auth: Auth, event: SubmitEvent): Promise<void> {
        event.preventDefault()

        const form = event.currentTarget as HTMLFormElement
        const data = new FormData(form)
        const values = Object.fromEntries(auth.fields.map(({ name }) => [name, String(data.get(name) ?? '')]))

        this.cancel?.abort()
        this.cancel = new AbortController()
        this.busy = true
        this.message = ''

        const result = await auth.signIn(values, { signal: this.cancel.signal })

        this.busy = false

        if (result.ok) {
            // The password must not stay in the page.
            form.reset()
            this.dispatchEvent(new CustomEvent(SIGNED_IN, { bubbles: true, composed: true }))
        } else if (result.error.kind !== 'aborted') {
            this.message = result.error.message
        }
    }

    private signOut(auth: Auth): void {
        auth.signOut()
        this.message = ''
        this.dispatchEvent(new CustomEvent(SIGNED_OUT, { bubbles: true, composed: true }))
    }

    private field(field: CredentialField): unknown {
        return html`
            <label>
                <span>${field.label}</span>
                <input
                    name=${field.name}
                    type=${field.secret ? 'password' : 'text'}
                    autocomplete=${autocompleteOf(field)}
                    required
                    ?disabled=${this.busy}>
            </label>`
    }

    private form(auth: Auth): unknown {
        return html`
            <form @submit=${(event: SubmitEvent) => this.signIn(auth, event)}>
                ${auth.fields.map((field) => this.field(field))}
                <button type="submit" ?disabled=${this.busy}>${this.busy ? 'Signing in…' : 'Sign in'}</button>
                ${this.message === '' ? '' : html`<p role="alert">${this.message}</p>`}
            </form>`
    }

    protected override render(): unknown {
        const auth = getAuth()

        // Nothing to ask for: no sign-in at all, or a cookie session that the API owns.
        if (auth === undefined || auth.fields.length === 0) {
            return html``
        }

        return auth.isSignedIn()
            ? html`<p role="status">Signed in <button type="button" @click=${() => this.signOut(auth)}>Sign out</button></p>`
            : this.form(auth)
    }
}
