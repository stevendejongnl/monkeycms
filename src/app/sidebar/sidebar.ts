import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { IconName } from 'config/main.ts'
import { hrefOf } from '../route.ts'
import { icon } from '../icons.ts'
import '../logo/logo.ts'


export const SIGN_OUT = 'monkey-sign-out'

// The "active" value of the settings screen. No collection can have this name.
export const SETTINGS = 'settings'

const FOLDED_KEY = 'monkeycms:sidebar-folded'

// The folded state is a convenience, so a browser that blocks storage starts unfolded.
const savedFolded = (): boolean => {
    try {
        return localStorage.getItem(FOLDED_KEY) === 'true'
    } catch {
        return false
    }
}

const saveFolded = (folded: boolean): void => {
    try {
        localStorage.setItem(FOLDED_KEY, String(folded))
    } catch {
        // Not saved. The sidebar still folds for this visit.
    }
}

export interface SidebarItem {
    readonly name: string
    readonly label: string
    readonly icon?: IconName
}

// The side menu of the CMS, in the accent colour. Each item has a 48px icon column (the icon
// of the collection), the label and, when it is known, the
// number of entries. The footer has Sign out (with "canSignOut") and a button that folds the
// sidebar to a rail of icons. The folded state is remembered. Sends "monkey-sign-out".
@customElement('monkey-sidebar')
export class MonkeySidebar extends LitElement {
    static override styles = css`
        :host {
            display: block;
            color: var(--monkey-accent-contrast-color);
            background: var(--monkey-accent-color);
        }

        aside {
            position: sticky;
            inset-block-start: 0;
            display: grid;
            grid-template-rows: auto 1fr auto;
            box-sizing: border-box;
            inline-size: 16.5rem;
            block-size: 100dvh;
            padding: 1rem;
        }

        aside.folded {
            inline-size: 5rem;
        }

        header {
            padding: 0 0 0.25rem;
        }

        monkey-logo {
            block-size: 2.75rem;
            --monkey-logo-ink-color: var(--monkey-accent-contrast-color);
            --monkey-logo-accent-color: color-mix(in oklab, var(--monkey-accent-contrast-color) 65%, var(--monkey-accent-color));
        }

        ul {
            display: grid;
            align-content: start;
            gap: 0.25rem;
            margin: 0;
            padding: 0;
            list-style: none;
        }

        footer {
            display: grid;
            gap: 0.25rem;
        }

        a, button {
            display: grid;
            grid-template-columns: 3rem 1fr auto;
            align-items: center;
            box-sizing: border-box;
            inline-size: 100%;
            min-block-size: 3rem;
            padding: 0;
            padding-inline-end: 0.75rem;
            font: inherit;
            font-weight: 500;
            text-align: start;
            color: inherit;
            text-decoration: none;
            background: transparent;
            border: 0;
            border-radius: var(--monkey-radius);
            cursor: pointer;
        }

        a:hover, button:hover {
            background: color-mix(in oklab, currentColor 14%, transparent);
        }

        a[aria-current='page'] {
            font-weight: 700;
            color: var(--monkey-accent-color);
            background: var(--monkey-accent-contrast-color);
        }

        a:focus-visible, button:focus-visible {
            outline: 3px solid currentColor;
            outline-offset: 2px;
        }

        .icon {
            display: grid;
            place-items: center;
        }

        .count {
            font-size: 0.8125rem;
            font-variant-numeric: tabular-nums;
            opacity: 0.85;
        }

        .who {
            margin: 0;
            padding-inline: 0.75rem;
            font-size: 0.8125rem;
            opacity: 0.85;
        }

        .folded header {
            padding-inline: 0;
            text-align: center;
        }

        .folded monkey-logo {
            block-size: 2rem;
        }

        .folded :is(.text, .count, .who) {
            position: absolute;
            inline-size: 1px;
            block-size: 1px;
            overflow: hidden;
            clip-path: inset(50%);
        }

        .fold .icon {
            transition: rotate 0.15s;
        }

        .folded .fold .icon {
            rotate: 180deg;
        }

        @media (max-width: 40rem) {
            aside, aside.folded {
                position: static;
                inline-size: auto;
                block-size: auto;
                grid-template-rows: auto;
            }

            header {
                padding-block-end: 0.5rem;
            }

            ul {
                grid-auto-flow: column;
                overflow-x: auto;
            }

            a {
                grid-template-columns: 2rem auto auto;
                inline-size: auto;
            }

            .icon {
                font-size: 1rem;
            }

            footer, .fold {
                display: none;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .fold .icon {
                transition: none;
            }
        }
    `

    @property({ attribute: false })
    items: readonly SidebarItem[] = []

    // The name of the collection that is open.
    @property({ type: String })
    active = ''

    // The number of entries by collection name. An item without a number shows none.
    @property({ attribute: false })
    counts: Readonly<Record<string, number>> = {}

    @property({ type: Boolean, attribute: 'can-sign-out' })
    canSignOut = false

    @state() private folded = savedFolded()

    private toggle(): void {
        this.folded = !this.folded
        saveFolded(this.folded)
    }

    private item({ name, label, icon: iconName }: SidebarItem): unknown {
        const count = this.counts[name]

        return html`
            <li>
                <a href=${hrefOf({ view: 'list', collection: name })} aria-current=${name === this.active ? 'page' : nothing} title=${this.folded ? label : nothing}>
                    <span class="icon" aria-hidden="true">${icon(iconName ?? 'document')}</span>
                    <span class="text">${label}</span>
                    ${count === undefined ? nothing : html`<span class="count">${count}</span>`}
                </a>
            </li>`
    }

    protected override render(): unknown {
        return html`
            <aside class=${this.folded ? 'folded' : ''}>
                <header>
                    <monkey-logo ?mark=${this.folded}></monkey-logo>
                </header>
                <nav aria-label="Collections">
                    <ul>${this.items.map((item) => this.item(item))}</ul>
                </nav>
                <footer>
                    <a href=${hrefOf({ view: 'settings' })} aria-current=${this.active === SETTINGS ? 'page' : nothing} title=${this.folded ? 'Settings' : nothing}>
                        <span class="icon" aria-hidden="true">${icon('settings')}</span><span class="text">Settings</span>
                    </a>
                    ${this.canSignOut ? html`
                        <p class="who" role="status">Signed in</p>
                        <button type="button" title=${this.folded ? 'Sign out' : nothing} @click=${() => this.dispatchEvent(new CustomEvent(SIGN_OUT, { bubbles: true, composed: true }))}>
                            <span class="icon" aria-hidden="true">${icon('signOut')}</span><span class="text">Sign out</span>
                        </button>` : nothing}
                    <button type="button" class="fold" aria-expanded=${String(!this.folded)} title=${this.folded ? 'Expand' : nothing} @click=${() => this.toggle()}>
                        <span class="icon" aria-hidden="true">${icon('collapse')}</span><span class="text">${this.folded ? 'Expand' : 'Collapse'}</span>
                    </button>
                </footer>
            </aside>`
    }
}
