import { LitElement, css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { effect } from 'base/signals/signals.ts'
import { getConfig } from 'config/main.ts'
import 'app/logo/logo.ts'
import { alertStyles, buttonStyles, controlStyles } from 'base/styles.ts'
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

        .screen {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(min(100%, 26.25rem), 1fr));
            min-block-size: 100dvh;
            background: var(--monkey-background-color);
        }

        aside {
            display: grid;
            grid-template-rows: auto 1fr auto;
            gap: 1.5rem;
            box-sizing: border-box;
            padding: clamp(1.75rem, 5vw, 4rem);
            color: var(--monkey-accent-contrast-color);
            background: linear-gradient(160deg, var(--monkey-accent-color), color-mix(in oklab, var(--monkey-accent-color) 55%, #000));
        }

        aside monkey-logo {
            --monkey-logo-ink-color: var(--monkey-accent-contrast-color);
            --monkey-logo-accent-color: color-mix(in oklab, var(--monkey-accent-contrast-color) 65%, var(--monkey-accent-color));
        }

        .brand {
            block-size: 3rem;
            justify-self: start;
        }

        .hero {
            display: grid;
            align-self: center;
            gap: 1rem;
            max-inline-size: 30rem;
        }

        .badge {
            display: grid;
            place-items: center;
            justify-self: start;
            inline-size: clamp(8.75rem, 18vw, 12.5rem);
            aspect-ratio: 1;
            margin-block-end: 0.5rem;
            border-radius: 50%;
            background: color-mix(in oklab, var(--monkey-accent-contrast-color) 14%, transparent);
            box-shadow: 0 0 0 clamp(0.625rem, 1.6vw, 1.125rem) color-mix(in oklab, var(--monkey-accent-contrast-color) 7%, transparent);
        }

        .badge monkey-logo {
            block-size: 6.25rem;
        }

        h2 {
            margin: 0;
            font-size: clamp(2rem, 4vw, 3rem);
            line-height: 1.1;
            letter-spacing: -0.03em;
        }

        .lead {
            margin: 0;
            font-size: 1.125rem;
            opacity: 0.9;
        }

        .connected {
            font-size: 0.875rem;
            opacity: 0.85;
        }

        main {
            display: grid;
            place-items: center;
            box-sizing: border-box;
            padding: clamp(1.5rem, 5vw, 4rem);
        }

        form {
            display: grid;
            gap: 1.25rem;
            inline-size: min(25rem, 100%);
        }

        .heading {
            display: grid;
            line-height: 1.2;
        }

        .eyebrow {
            font-size: 0.8125rem;
            font-weight: 600;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--monkey-muted-color);
        }

        h1 {
            margin: 0.25rem 0 0;
            font-size: 2.125rem;
            letter-spacing: -0.02em;
        }

        [role='alert'] {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 0.625rem;
            align-items: start;
            padding: 0.75rem 0.875rem;
        }

        [role='alert'] svg {
            inline-size: 1.375rem;
            block-size: 1.375rem;
            color: var(--monkey-error-color);
        }

        [role='alert'] span {
            display: grid;
        }

        [role='alert'] small {
            font-size: inherit;
            color: var(--monkey-muted-color);
        }

        .field {
            display: grid;
            gap: var(--monkey-field-gap);
        }

        label {
            font-weight: 600;
        }

        input:not([type='checkbox']) {
            background: var(--monkey-surface-color);
        }

        .secret {
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: center;
            background: var(--monkey-surface-color);
            border: 1px solid var(--monkey-control-border-color);
            border-radius: var(--monkey-radius);
        }

        .secret:focus-within {
            outline: 3px solid var(--monkey-link-color);
            outline-offset: 2px;
        }

        .secret input {
            min-inline-size: 0;
            min-block-size: 2.875rem;
            background: none;
            border: 0;
            outline: 0;
        }

        .secret button {
            min-block-size: 2.75rem;
            padding: 0 0.875rem;
            color: var(--monkey-link-color);
            background: none;
            border: 0;
            border-radius: var(--monkey-radius);
        }

        form > button {
            min-block-size: 3.25rem;
            font-size: 1rem;
        }

        .note {
            margin: 0;
            font-size: 0.875rem;
            color: var(--monkey-muted-color);
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

    @state()
    private shown = false

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

    private input(field: CredentialField): unknown {
        return html`
            <input
                id=${field.name}
                name=${field.name}
                type=${field.secret && !this.shown ? 'password' : 'text'}
                autocomplete=${autocompleteOf(field)}
                required
                ?disabled=${this.busy}>`
    }

    private field(field: CredentialField): unknown {
        return html`
            <div class="field">
                <label for=${field.name}>${field.label}</label>
                ${field.secret
                    ? html`<div class="secret">${this.input(field)}<button type="button" aria-controls=${field.name} aria-pressed=${String(this.shown)} @click=${() => { this.shown = !this.shown }}>${this.shown ? 'Hide' : 'Show'}</button></div>`
                    : this.input(field)}
            </div>`
    }

    private aside(): unknown {
        const host = getConfig() === undefined ? '' : new URL(getConfig()!.baseUrl).host

        return html`
            <aside>
                <monkey-logo class="brand"></monkey-logo>
                <div class="hero">
                    <span class="badge"><monkey-logo mark></monkey-logo></span>
                    <h2>Edit content for any API.</h2>
                    <p class="lead">No backend. No lock-in. Everything on screen follows one small config file.</p>
                </div>
                ${host === '' ? '' : html`<span class="connected">Connected to ${host}</span>`}
            </aside>`
    }

    private form(auth: Auth): unknown {
        const secret = auth.fields.some(({ secret }) => secret)

        return html`
            <div class="screen">
                ${this.aside()}
                <main>
                    <form @submit=${(event: SubmitEvent) => this.signIn(auth, event)}>
                        <div class="heading">
                            <span class="eyebrow">Welcome back</span>
                            <h1>Sign in</h1>
                        </div>
                        ${this.message === '' ? '' : html`
                            <div role="alert">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7.5v5.5M12 16.5h.01"></path></svg>
                                <span><strong>Could not sign in</strong><small>${this.message}</small></span>
                            </div>`}
                        ${auth.fields.map((field) => this.field(field))}
                        <button type="submit" ?disabled=${this.busy}>${this.busy ? 'Signing in…' : 'Sign in'}</button>
                        ${secret ? html`<p class="note">The password is only sent to sign in. MonkeyCMS does not keep it.</p>` : ''}
                    </form>
                </main>
            </div>`
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
