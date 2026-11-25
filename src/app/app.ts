import { LitElement, css, html, nothing } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import '../auth/login/login.ts'
import { getAuth } from '../auth/main.ts'
import { effect } from '../base/signals/signals.ts'
import { getConfig } from '../config/main.ts'
import './collection-list/collection-list.ts'
import './entry-editor/entry-editor.ts'
import type { MonkeyEntryEditor } from './entry-editor/entry-editor.ts'
import { SAVED } from './entry-editor/entry-editor.ts'
import { hrefOf, parseRoute } from './route.ts'
import type { Route } from './route.ts'


const LEAVE_QUESTION = 'You have unsaved changes. Leave without saving?'

// The CMS: a menu of the collections, the sign-in, and the view for the address in the URL
// hash (#/posts, #/posts/new, #/posts/12). It asks before it leaves an entry that has unsaved
// changes, and goes back to the list after a save.
@customElement('monkey-app')
export class MonkeyApp extends LitElement {
    static override styles = css`
        :host {
            display: grid;
            gap: var(--monkey-gap, 1rem);
        }

        nav ul {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            padding: 0;
            list-style: none;
        }
    `

    @state() private route: Route = parseRoute(location.hash)

    private hash = location.hash

    private stop: (() => void) | undefined

    private readonly navigated = (): void => {
        const editor = this.renderRoot.querySelector<MonkeyEntryEditor>('monkey-entry-editor')

        if (editor?.dirty === true && !window.confirm(LEAVE_QUESTION)) {
            // Stay: put the old address back without a new history entry.
            history.replaceState(null, '', this.hash)

            return
        }

        this.hash = location.hash
        this.route = parseRoute(location.hash)
    }

    private readonly saved = (): void => {
        const { route } = this

        location.hash = hrefOf({ view: 'list', collection: 'collection' in route ? route.collection : '' })
    }

    override connectedCallback(): void {
        super.connectedCallback()
        window.addEventListener('hashchange', this.navigated)
        this.addEventListener(SAVED, this.saved)
        // Redraw when the config, the auth or its session changes.
        this.stop = effect(() => {
            getConfig()
            getAuth()?.session()
            this.requestUpdate()
        })
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback()
        window.removeEventListener('hashchange', this.navigated)
        this.removeEventListener(SAVED, this.saved)
        this.stop?.()
    }

    private menu(collections: string[]): unknown {
        const active = 'collection' in this.route ? this.route.collection : undefined

        return html`
            <nav aria-label="Collections">
                <ul>
                    ${collections.map((name) => html`
                        <li><a href=${hrefOf({ view: 'list', collection: name })} aria-current=${name === active ? 'page' : nothing}>${getConfig()?.collections[name]?.label ?? name}</a></li>`)}
                </ul>
            </nav>`
    }

    private view(): unknown {
        const { route } = this

        return route.view === 'home'
            ? html`<p>Choose a collection.</p>`
            : route.view === 'list'
                ? html`<monkey-collection-list collection=${route.collection}></monkey-collection-list>`
                : html`<monkey-entry-editor collection=${route.collection} entry-id=${route.view === 'edit' ? route.id : ''}></monkey-entry-editor>`
    }

    protected override render(): unknown {
        const config = getConfig()

        return html`
            <monkey-login></monkey-login>
            ${config === undefined || getAuth()?.isSignedIn() !== true ? nothing : html`${this.menu(Object.keys(config.collections))}${this.view()}`}`
    }
}
