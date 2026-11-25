import { LitElement, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { createAuth } from '../../auth/auth.ts'
import { setAuth } from '../../auth/store.ts'
import { createClient } from '../../client/client.ts'
import { setClient } from '../../client/store.ts'
import { describeFailure, loadConfig, setConfig } from '../../config/main.ts'
import type { LoadFailure, MonkeyConfig } from '../../config/main.ts'


export const CONFIG_READY = 'monkey-config-ready'

type Status = 'loading' | 'ready' | 'failed'

// Loads the mapping config, checks it and puts it in the config store for the other
// components. Shows when it is loading, and which part of the config is wrong when it fails.
// Sends "monkey-config-ready" with the config as detail when the config is ready.
@customElement('monkey-set-up')
export class MonkeySetUp extends LitElement {
    // A URL that returns the config as JSON.
    @property({ type: String, attribute: 'get-set-up-endpoint' })
    setUpEndpoint = ''

    // The config as a JSON string. Wins over the endpoint.
    @property({ type: String, attribute: 'config' })
    inlineConfig = ''

    @state()
    private status: Status = 'loading'

    @state()
    private failure: LoadFailure | undefined

    @state()
    private config: MonkeyConfig | undefined

    override connectedCallback(): void {
        super.connectedCallback()
        void this.load()
    }

    private async load(): Promise<void> {
        this.status = 'loading'

        const result = await loadConfig({ endpoint: this.setUpEndpoint, inline: this.inlineConfig })

        if (result.ok) {
            setConfig(result.config)
            const auth = createAuth(result.config)

            setAuth(auth)
            setClient(createClient(result.config, { auth }))
            this.config = result.config
            this.failure = undefined
            this.dispatchEvent(new CustomEvent(CONFIG_READY, { bubbles: true, composed: true, detail: result.config }))
        } else {
            this.failure = result.failure
        }

        this.status = result.ok ? 'ready' : 'failed'
    }

    private readonly views: Record<Status, () => unknown> = {
        loading: () => html`<p role="status">Loading the config…</p>`,
        ready: () => html`<p role="status">Config loaded: ${Object.keys(this.config?.collections ?? {}).join(', ')}</p>`,
        failed: () => html`
            <ul role="alert">
                ${(this.failure === undefined ? [] : describeFailure(this.failure)).map((line) => html`<li>${line}</li>`)}
            </ul>`,
    }

    protected override render(): unknown {
        return this.views[this.status]()
    }
}
