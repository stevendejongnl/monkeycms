import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { getClient } from '../../client/main.ts'
import type { ListPage } from '../../client/main.ts'
import { alertStyles, buttonStyles, controlStyles, linkStyles } from '../../base/styles.ts'
import { getConfig } from '../../config/main.ts'
import type { CollectionConfig } from '../../config/main.ts'
import type { PageState } from '../../mapping/main.ts'
import { firstPage } from '../../mapping/main.ts'
import { displayValue } from '../display.ts'
import { hrefOf } from '../route.ts'


// A long text does not fit in a table cell.
const columnsOf = (collection: CollectionConfig) =>
    Object.entries(collection.fields).filter(([, field]) => field.type !== 'longtext')

// Shows the entries of a collection in a table: one page at a time, with search when the
// config has a searchParam, a link to each entry, and delete after a confirmation.
@customElement('monkey-collection-list')
export class MonkeyCollectionList extends LitElement {
    static override styles = [controlStyles, buttonStyles, linkStyles, alertStyles, css`
        :host {
            display: grid;
            gap: var(--monkey-gap);
        }

        header {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 1rem;
            align-items: center;
        }

        h2 {
            margin: 0;
            font-size: 2rem;
            line-height: 1.15;
            letter-spacing: -0.02em;
        }

        form {
            display: grid;
            grid-template-columns: minmax(0, 24rem) auto;
            justify-content: start;
            gap: 0.75rem;
            align-items: end;
        }

        form label {
            display: grid;
            gap: var(--monkey-field-gap);
            font-weight: 600;
        }

        nav {
            display: grid;
            grid-auto-flow: column;
            justify-content: start;
            gap: 0.75rem;
            align-items: center;
            color: var(--monkey-muted-color);
        }

        .table {
            overflow-x: auto;
            background: var(--monkey-surface-color);
            border: 1px solid var(--monkey-border-color);
            border-radius: calc(var(--monkey-radius) + 0.5rem);
        }

        table {
            border-collapse: collapse;
            inline-size: 100%;
        }

        th, td {
            text-align: start;
            padding: var(--monkey-padding) 1.125rem;
        }

        tbody tr + tr :is(th, td) {
            border-block-start: 1px solid var(--monkey-border-color);
        }

        th {
            font-size: 0.8125rem;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--monkey-muted-color);
            border-block-end: 1px solid var(--monkey-border-color);
        }

        .actions {
            display: grid;
            grid-auto-flow: column;
            justify-content: start;
            gap: 0.5rem;
            align-items: center;
        }

        td button, td a.button {
            min-block-size: 2.75rem;
            padding: 0 1rem;
        }

        .visually-hidden {
            position: absolute;
            inline-size: 1px;
            block-size: 1px;
            overflow: hidden;
            clip-path: inset(50%);
        }

        [role='status'] {
            margin: 0;
            color: var(--monkey-muted-color);
        }
    `]

    @property({ type: String })
    collection = ''

    @state() private page: ListPage | undefined
    @state() private loading = true
    @state() private message = ''
    @state() private search = ''
    @state() private current: PageState = firstPage
    // The pages before the current one, so the person can go back.
    @state() private history: readonly PageState[] = []
    @state() private term = ''
    @state() private confirming: string | undefined

    private cancel: AbortController | undefined

    override disconnectedCallback(): void {
        super.disconnectedCallback()
        this.cancel?.abort()
    }

    protected override willUpdate(changed: Map<string, unknown>): void {
        if (changed.has('collection')) {
            this.current = firstPage
            this.history = []
            this.term = ''
            this.search = ''
            this.confirming = undefined
            void this.load()
        }
    }

    private async load(): Promise<void> {
        this.cancel?.abort()
        this.cancel = new AbortController()
        this.loading = true
        this.message = ''

        const client = getClient()

        if (client === undefined) {
            this.loading = false
            this.message = 'There is no API client yet'

            return
        }

        const result = await client.list(this.collection, { page: this.current, search: this.term, signal: this.cancel.signal })

        if (!result.ok && result.error.kind === 'aborted') {
            return
        }

        this.loading = false

        if (result.ok) {
            this.page = result.value
        } else {
            this.page = undefined
            this.message = result.error.message
        }
    }

    private go(page: PageState, history: readonly PageState[]): void {
        this.current = page
        this.history = history
        this.confirming = undefined
        void this.load()
    }

    private next(): void {
        const next = this.page?.next

        if (next !== null && next !== undefined) {
            this.go(next, [...this.history, this.current])
        }
    }

    private previous(): void {
        const previous = this.history.at(-1)

        if (previous !== undefined) {
            this.go(previous, this.history.slice(0, -1))
        }
    }

    private submitSearch(event: SubmitEvent): void {
        event.preventDefault()
        this.term = this.search
        this.go(firstPage, [])
    }

    private async deleteEntry(id: string): Promise<void> {
        const client = getClient()
        const result = await client?.remove(this.collection, id)

        this.confirming = undefined

        if (result?.ok === false) {
            this.message = result.error.message

            return
        }

        await this.load()
    }

    private cell(name: string, value: unknown, collection: CollectionConfig): string {
        const field = collection.fields[name]

        return field === undefined ? '' : displayValue(field, value)
    }

    private actions(id: string, label: string, collection: CollectionConfig): unknown {
        const route = hrefOf({ view: 'edit', collection: this.collection, id })

        return html`
            <td>
                <div class="actions">
                    ${collection.get !== undefined || collection.update !== undefined
                        ? html`<a class="button" href=${route} aria-label=${`Edit ${label}`}>Edit</a>`
                        : nothing}
                    ${collection.delete === undefined ? nothing : this.confirming === id
                        ? html`
                            <button type="button" class="danger" @click=${() => this.deleteEntry(id)}>Confirm delete</button>
                            <button type="button" @click=${() => { this.confirming = undefined }}>Cancel</button>`
                        : html`<button type="button" class="danger" aria-label=${`Delete ${label}`} @click=${() => { this.confirming = id }}>Delete</button>`}
                </div>
            </td>`
    }

    private table(collection: CollectionConfig, page: ListPage): unknown {
        const columns = columnsOf(collection)

        return page.items.length === 0
            ? html`<p role="status">${this.term === '' ? 'No entries yet' : 'No entries found'}</p>`
            : html`
                <div class="table">
                    <table>
                        <caption class="visually-hidden">${collection.label ?? this.collection}</caption>
                        <thead>
                            <tr>
                                ${columns.map(([name, field]) => html`<th scope="col">${field.label ?? name}</th>`)}
                                <th scope="col">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${page.items.map((entry) => {
                                const label = String(Object.values(entry.values).find((value) => typeof value === 'string' && value !== '') ?? entry.id)

                                return html`<tr>
                                    ${columns.map(([name]) => html`<td>${this.cell(name, entry.values[name], collection)}</td>`)}
                                    ${this.actions(entry.id, label, collection)}
                                </tr>`
                            })}
                        </tbody>
                    </table>
                </div>`
    }

    private pager(page: ListPage): unknown {
        return html`
            <nav aria-label="Pages">
                <button type="button" ?disabled=${this.history.length === 0 || this.loading} @click=${() => this.previous()}>Previous</button>
                <button type="button" ?disabled=${page.next === null || this.loading} @click=${() => this.next()}>Next</button>
                ${page.total === undefined ? nothing : html`<span>${page.total} entries</span>`}
            </nav>`
    }

    protected override render(): unknown {
        const collection = getConfig()?.collections[this.collection]

        if (collection === undefined) {
            return html`<p role="alert">There is no collection "${this.collection}"</p>`
        }

        return html`
            <header>
                <h2>${collection.label ?? this.collection}</h2>
                ${collection.create === undefined ? nothing : html`<a class="button primary" href=${hrefOf({ view: 'new', collection: this.collection })}>New</a>`}
            </header>
            ${collection.list.searchParam === undefined ? nothing : html`
                <form role="search" @submit=${(event: SubmitEvent) => this.submitSearch(event)}>
                    <label>Search <input type="search" .value=${this.search} @input=${(event: Event) => { this.search = (event.target as HTMLInputElement).value }}></label>
                    <button type="submit">Search</button>
                </form>`}
            ${this.message === '' ? nothing : html`<p role="alert">${this.message}</p>`}
            ${this.loading ? html`<p role="status">Loading…</p>` : nothing}
            ${this.page === undefined ? nothing : html`${this.table(collection, this.page)}${this.pager(this.page)}`}`
    }
}
