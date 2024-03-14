import { LitElement, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { createLocalStorageSignal } from '../main.js'


const FakeFetch = (endpoint: string, fakeResponse: any): Promise<Response> => {
    console.log(`FakeFetch: ${endpoint}`)

    return new Promise((resolve) => {
        resolve(new Response(JSON.stringify(fakeResponse)))
    })
}

export const SET_UP_STORE = 'SET_UP_STORE'

@customElement('monkey-set-up')
export class MonkeySetUp extends LitElement {
    @property({ type: String, attribute: 'get-set-up-endpoint'})
    private setUpEndpoint: string = ''

    @state()
    store: unknown

    constructor() {
        super()
        this.store
    }

    override async  connectedCallback(): Promise<void> {
        super.connectedCallback()

        const response = await FakeFetch(this.setUpEndpoint, { 'some-key': 'some-value' })
        const [getSetUpStore, ] = createLocalStorageSignal(SET_UP_STORE, await response.json())
        this.store = getSetUpStore()
    }

    protected override render(): unknown {
        return html`yes`
    }
}
