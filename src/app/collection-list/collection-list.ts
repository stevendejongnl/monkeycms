import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { getClient } from 'client/main.ts'
import type { ListPage } from 'client/main.ts'
import { alertStyles, buttonStyles, controlStyles, linkStyles } from 'base/styles.ts'
import { getConfig } from 'config/main.ts'
import type { CollectionConfig } from 'config/main.ts'
import type { Entry, PageState } from 'mapping/main.ts'
import { firstPage } from 'mapping/main.ts'
import { setCount } from '../counts.ts'
import { displayValue } from '../display.ts'
import { hrefOf } from '../route.ts'


// A long text does not fit in a table cell.
const columnsOf = (collection: CollectionConfig) =>
    Object.entries(collection.fields).filter(([, field]) => field.type !== 'longtext' && field.type !== 'richtext')

type View = 'table' | 'cards'

const viewKey = (collection: string): string => `monkeycms:view:${collection}`

// The chosen view is a convenience, so a browser that blocks storage just gets the table.
const savedView = (collection: string): View => {
    try {
        return localStorage.getItem(viewKey(collection)) === 'cards' ? 'cards' : 'table'
    } catch {
        return 'table'
    }
}

const saveView = (collection: string, view: View): void => {
    try {
        localStorage.setItem(viewKey(collection), view)
    } catch {
        // Not saved. The view still changes for this visit.
    }
}

// Shows the entries of a collection as a table or as cards: one page at a time, with search
// when the config has a searchParam, tabs when it has a status param, a link to each entry,
// delete after a confirmation, and bulk Publish and Delete for the selected entries.
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

        .title {
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
            line-height: 1.15;
            letter-spacing: -0.02em;
        }

        header a.button {
            display: inline-grid;
            grid-auto-flow: column;
            gap: 0.5rem;
            min-block-size: 3rem;
            padding: 0 1.375rem;
        }

        svg {
            flex: none;
            inline-size: 1.125rem;
            block-size: 1.125rem;
        }

        .toolbar {
            display: grid;
            grid-template-columns: auto minmax(11.25rem, 1fr) auto;
            gap: 0.75rem;
            align-items: center;
        }

        .tabs, .views {
            display: grid;
            grid-auto-flow: column;
            gap: 0.25rem;
            padding: 0.25rem;
            background: var(--monkey-surface-color);
            border: 1px solid var(--monkey-border-color);
            border-radius: 999px;
        }

        .tabs button, .views button {
            min-block-size: 2.5rem;
            padding: 0 1rem;
            color: var(--monkey-color);
            background: none;
            border: 0;
        }

        .views button {
            padding: 0;
            inline-size: 2.75rem;
        }

        .views svg {
            inline-size: 1.25rem;
            block-size: 1.25rem;
        }

        .tabs button[aria-pressed='true'], .views button[aria-pressed='true'] {
            color: var(--monkey-accent-contrast-color);
            background: var(--monkey-accent-color);
        }

        .search {
            display: grid;
            grid-template-columns: 2.75rem 1fr;
            align-items: center;
            min-block-size: 3rem;
            color: var(--monkey-muted-color);
            background: var(--monkey-surface-color);
            border: 1px solid var(--monkey-control-border-color);
            border-radius: 999px;
        }

        .search:focus-within {
            outline: 3px solid var(--monkey-link-color);
            outline-offset: 2px;
        }

        .search span {
            display: grid;
            place-items: center;
        }

        .search input {
            min-inline-size: 0;
            min-block-size: 0;
            padding: 0 1rem 0 0;
            background: none;
            border: 0;
            outline: 0;
        }

        .table {
            overflow-x: auto;
            background: var(--monkey-surface-color);
            border: 1px solid var(--monkey-border-color);
            border-radius: calc(var(--monkey-radius) + 0.375rem);
        }

        table {
            border-collapse: collapse;
            inline-size: 100%;
            min-inline-size: 40rem;
        }

        th, td {
            text-align: start;
            padding: 0.5rem 0.75rem;
            border-block-end: 1px solid var(--monkey-border-color);
        }

        th {
            padding-block: 0;
            font-size: 0.8125rem;
            line-height: 1.5;
            color: var(--monkey-muted-color);
        }

        .check {
            inline-size: 3.5rem;
            padding: 0;
        }

        .check > * {
            display: grid;
            place-items: center;
            min-block-size: 4rem;
        }

        th.check > * {
            min-block-size: 0;
            line-height: 0;
        }

        th.check .select {
            margin-block: -0.0625rem;
        }

        .end {
            text-align: end;
        }

        .actions {
            display: grid;
            grid-auto-flow: column;
            justify-content: end;
            gap: 0.25rem;
            align-items: center;
        }

        :is(td, .card) :is(button, a.button) {
            min-block-size: 2.75rem;
            padding: 0 0.75rem;
            font-weight: 600;
            color: var(--monkey-link-color);
            background: none;
            border: 0;
            border-radius: var(--monkey-radius);
        }

        :is(td, .card) a.button {
            text-decoration: underline;
        }

        :is(td, .card) .danger {
            color: var(--monkey-error-color);
        }

        .bulk {
            display: grid;
            grid-template-columns: 1fr auto auto auto;
            gap: 0.75rem;
            align-items: center;
            min-block-size: 3.5rem;
            padding: 0 1rem;
            background: color-mix(in oklab, var(--monkey-accent-color) 14%, var(--monkey-surface-color));
            border: 1px solid color-mix(in oklab, var(--monkey-accent-color) 35%, var(--monkey-surface-color));
            border-radius: var(--monkey-radius);
        }

        .bulk button {
            min-block-size: 2.75rem;
            padding: 0 1rem;
            background: var(--monkey-surface-color);
            border-radius: var(--monkey-radius);
        }

        .bulk .clear {
            padding: 0 0.75rem;
            font-weight: 400;
            background: none;
            border: 0;
        }

        .select {
            inline-size: 1.25rem;
            block-size: 1.25rem;
        }

        .cards {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
            gap: var(--monkey-gap);
            margin: 0;
            padding: 0;
            list-style: none;
        }

        .card {
            display: grid;
            gap: 0.75rem;
            align-content: start;
            padding: var(--monkey-padding);
            background: var(--monkey-surface-color);
            border: 1px solid var(--monkey-border-color);
            border-radius: calc(var(--monkey-radius) + 0.5rem);
        }

        .card dl {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 0.25rem 0.75rem;
            margin: 0;
        }

        .card dt {
            color: var(--monkey-muted-color);
        }

        .card dd {
            margin: 0;
        }

        .pager {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 0.75rem;
            align-items: center;
            color: var(--monkey-muted-color);
        }

        .pager div {
            display: grid;
            grid-auto-flow: column;
            gap: 0.5rem;
        }

        .pager button {
            min-block-size: 2.75rem;
            padding: 0 1.125rem;
        }

        .pager button:disabled {
            opacity: 1;
            font-weight: 400;
            color: var(--monkey-muted-color);
            border-color: var(--monkey-border-color);
            cursor: default;
        }

        dialog {
            box-sizing: border-box;
            inline-size: min(50vw, 100%);
            min-inline-size: min(28rem, 100%);
            max-inline-size: 100%;
            block-size: 100%;
            max-block-size: 100%;
            margin: 0;
            margin-inline-start: auto;
            padding: calc(var(--monkey-padding) * 1.5);
            overflow-y: auto;
            color: var(--monkey-color);
            background: var(--monkey-surface-color);
            border: 0;
            border-inline-start: 1px solid var(--monkey-border-color);
        }

        dialog::backdrop {
            background: color-mix(in oklab, black 45%, transparent);
        }

        dialog h3 {
            margin: 0;
            font-size: 1.5rem;
        }

        dialog dl {
            display: grid;
            gap: 1rem;
            margin: var(--monkey-gap) 0;
        }

        dialog dt {
            color: var(--monkey-muted-color);
            font-size: 0.8125rem;
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }

        dialog dd {
            margin: 0.25rem 0 0;
            white-space: pre-wrap;
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
    @state() private view: View = 'table'
    @state() private status = ''
    @state() private selected: ReadonlySet<string> = new Set()
    @state() private confirmingBulk = false
    @state() private previewing: Entry | undefined

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
            this.view = savedView(this.collection)
            this.status = ''
            this.previewing = undefined
            this.clearSelection()
            void this.load()
        }
    }

    // The dialog is drawn closed. Open it as a modal, which traps the focus, closes on Escape
    // and puts the focus back on the button that opened it.
    protected override updated(): void {
        const dialog = this.renderRoot.querySelector('dialog')

        if (dialog !== null && !dialog.open) {
            dialog.showModal()
        }
    }

    private clearSelection(): void {
        this.selected = new Set()
        this.confirmingBulk = false
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

        const result = await client.list(this.collection, { page: this.current, search: this.term, status: this.status, signal: this.cancel.signal })

        if (!result.ok && result.error.kind === 'aborted') {
            return
        }

        this.loading = false

        if (result.ok) {
            this.page = result.value

            // Only a list without search or filter says how many entries the collection has.
            if (result.value.total !== undefined && this.term === '' && this.status === '') {
                setCount(this.collection, result.value.total)
            }
        } else {
            this.page = undefined
            this.message = result.error.message
        }
    }

    private go(page: PageState, history: readonly PageState[]): void {
        this.current = page
        this.history = history
        this.confirming = undefined
        this.clearSelection()
        void this.load()
    }

    private setView(view: View): void {
        this.view = view
        saveView(this.collection, view)
    }

    private setStatus(status: string): void {
        this.status = status
        this.go(firstPage, [])
    }

    private toggle(id: string, on: boolean): void {
        const selected = new Set(this.selected)

        on ? selected.add(id) : selected.delete(id)
        this.selected = selected
        this.confirmingBulk = false
    }

    private toggleAll(on: boolean): void {
        this.selected = new Set(on ? this.page?.items.map(({ id }) => id) : [])
        this.confirmingBulk = false
    }

    // Runs one call per selected entry. It reports the first failure, and always reloads, so
    // the list shows what the API really did.
    private async bulk(run: (id: string) => Promise<{ ok: boolean, error?: { message: string } } | undefined>): Promise<void> {
        const failures: string[] = []

        for (const id of this.selected) {
            const result = await run(id)

            if (result?.ok === false) {
                failures.push(result.error?.message ?? 'Failed')
            }
        }

        this.clearSelection()
        await this.load()
        this.message = failures.length === 0 ? '' : `${failures.length} of the entries failed: ${failures[0]}`
    }

    private bulkDelete(): Promise<void> {
        return this.bulk((id) => getClient()?.remove(this.collection, id) ?? Promise.resolve(undefined))
    }

    private bulkPublish(collection: CollectionConfig): Promise<void> {
        const status = collection.status

        return this.bulk((id) => {
            const entry = this.page?.items.find((item) => item.id === id)

            return status?.publish === undefined || entry === undefined
                ? Promise.resolve(undefined)
                : getClient()?.update(this.collection, id, { ...entry.values, [status.field]: status.publish }) ?? Promise.resolve(undefined)
        })
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
                <div class="actions">
                    ${collection.preview === undefined ? nothing : html`<button type="button" aria-label=${`Preview ${label}`} @click=${() => { this.previewing = this.page?.items.find((item) => item.id === id) }}>Preview</button>`}
                    ${collection.get !== undefined || collection.update !== undefined
                        ? html`<a class="button" href=${route} aria-label=${`Edit ${label}`}>Edit</a>`
                        : nothing}
                    ${collection.delete === undefined ? nothing : this.confirming === id
                        ? html`
                            <button type="button" class="danger" @click=${() => this.deleteEntry(id)}>Confirm delete</button>
                            <button type="button" @click=${() => { this.confirming = undefined }}>Cancel</button>`
                        : html`<button type="button" class="danger" aria-label=${`Delete ${label}`} @click=${() => { this.confirming = id }}>Delete</button>`}
                </div>`
    }

    private selectable(collection: CollectionConfig): boolean {
        return collection.delete !== undefined || (collection.status?.publish !== undefined && collection.update !== undefined)
    }

    private labelOf(entry: Entry): string {
        return String(Object.values(entry.values).find((value) => typeof value === 'string' && value !== '') ?? entry.id)
    }

    private checkbox(entry: Entry): unknown {
        return html`<input type="checkbox" class="select" aria-label=${`Select ${this.labelOf(entry)}`} .checked=${this.selected.has(entry.id)}
            @change=${(event: Event) => this.toggle(entry.id, (event.target as HTMLInputElement).checked)}>`
    }

    private table(collection: CollectionConfig, page: ListPage): unknown {
        const columns = columnsOf(collection)
        const selectable = this.selectable(collection)

        return html`
            <div class="table">
                <table>
                    <caption class="visually-hidden">${collection.label ?? this.collection}</caption>
                    <thead>
                        <tr>
                            ${selectable ? html`<th scope="col" class="check"><span><input type="checkbox" class="select" aria-label="Select all" .checked=${this.selected.size === page.items.length}
                                @change=${(event: Event) => this.toggleAll((event.target as HTMLInputElement).checked)}></span></th>` : nothing}
                            ${columns.map(([name, field]) => html`<th scope="col">${field.label ?? name}</th>`)}
                            <th scope="col" class="end"><span class="visually-hidden">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${page.items.map((entry) => html`<tr>
                            ${selectable ? html`<td class="check"><span>${this.checkbox(entry)}</span></td>` : nothing}
                            ${columns.map(([name]) => html`<td>${this.cell(name, entry.values[name], collection)}</td>`)}
                            <td class="end">${this.actions(entry.id, this.labelOf(entry), collection)}</td>
                        </tr>`)}
                    </tbody>
                </table>
            </div>`
    }

    private cards(collection: CollectionConfig, page: ListPage): unknown {
        const columns = columnsOf(collection)
        const selectable = this.selectable(collection)

        return html`
            <ul class="cards" aria-label=${collection.label ?? this.collection}>
                ${page.items.map((entry) => html`<li class="card">
                    ${selectable ? this.checkbox(entry) : nothing}
                    <dl>
                        ${columns.map(([name, field]) => html`<dt>${field.label ?? name}</dt><dd>${this.cell(name, entry.values[name], collection)}</dd>`)}
                    </dl>
                    ${this.actions(entry.id, this.labelOf(entry), collection)}
                </li>`)}
            </ul>`
    }

    private entries(collection: CollectionConfig, page: ListPage): unknown {
        return page.items.length === 0
            ? html`<p role="status">${this.term === '' && this.status === '' ? 'No entries yet' : 'No entries found'}</p>`
            : this.view === 'cards' ? this.cards(collection, page) : this.table(collection, page)
    }

    private drawer(collection: CollectionConfig, entry: Entry): unknown {
        const route = hrefOf({ view: 'edit', collection: this.collection, id: entry.id })

        return html`
            <dialog aria-label=${`Preview ${this.labelOf(entry)}`}
                @close=${() => { this.previewing = undefined }}
                @click=${(event: Event) => { event.target === event.currentTarget && (event.currentTarget as HTMLDialogElement).close() }}>
                <h3>${this.labelOf(entry)}</h3>
                <dl>
                    ${(collection.preview?.fields ?? []).map((name) => html`
                        <dt>${collection.fields[name]?.label ?? name}</dt>
                        <dd>${this.cell(name, entry.values[name], collection)}</dd>`)}
                </dl>
                <div class="actions">
                    ${collection.get !== undefined || collection.update !== undefined ? html`<a class="button primary" href=${route}>Edit</a>` : nothing}
                    <button type="button" @click=${(event: Event) => (event.target as HTMLElement).closest('dialog')?.close()}>Close</button>
                </div>
            </dialog>`
    }

    private toolbar(collection: CollectionConfig): unknown {
        const status = collection.status
        const options = status === undefined ? undefined : collection.fields[status.field]?.options
        const label = collection.label ?? this.collection

        return html`
            <div class="toolbar">
                ${status?.param === undefined || options === undefined ? html`<span></span>` : html`
                    <div class="tabs" role="group" aria-label="Status">
                        ${['', ...options].map((option) => html`<button type="button" aria-pressed=${String(this.status === option)} @click=${() => this.setStatus(option)}>${option === '' ? 'All' : option}</button>`)}
                    </div>`}
                ${collection.list.searchParam === undefined ? html`<span></span>` : html`
                    <form role="search" class="search" @submit=${(event: SubmitEvent) => this.submitSearch(event)}>
                        <span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg></span>
                        <input type="search" placeholder=${`Search ${label.toLowerCase()}`} aria-label=${`Search ${label.toLowerCase()}`} .value=${this.search} @input=${(event: Event) => { this.search = (event.target as HTMLInputElement).value }}>
                    </form>`}
                <div class="views" role="group" aria-label="View">
                    <button type="button" aria-label="Table view" aria-pressed=${String(this.view === 'table')} @click=${() => this.setView('table')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"></path></svg></button>
                    <button type="button" aria-label="Card view" aria-pressed=${String(this.view === 'cards')} @click=${() => this.setView('cards')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5"></rect><rect x="13" y="4" width="7" height="7" rx="1.5"></rect><rect x="4" y="13" width="7" height="7" rx="1.5"></rect><rect x="13" y="13" width="7" height="7" rx="1.5"></rect></svg></button>
                </div>
            </div>`
    }

    private bulkBar(collection: CollectionConfig): unknown {
        return this.selected.size === 0 ? nothing : html`
            <div class="bulk" role="region" aria-label="Bulk actions">
                <strong>${this.selected.size} selected</strong>
                ${collection.status?.publish === undefined || collection.update === undefined ? nothing : html`<button type="button" @click=${() => this.bulkPublish(collection)}>Publish</button>`}
                ${collection.delete === undefined ? nothing : this.confirmingBulk
                    ? html`
                        <button type="button" class="danger" @click=${() => this.bulkDelete()}>Confirm delete ${this.selected.size}</button>
                        <button type="button" @click=${() => { this.confirmingBulk = false }}>Cancel</button>`
                    : html`<button type="button" class="danger" @click=${() => { this.confirmingBulk = true }}>Delete</button>`}
                <button type="button" class="clear" @click=${() => this.clearSelection()}>Clear</button>
            </div>`
    }

    private pager(page: ListPage): unknown {
        return html`
            <nav class="pager" aria-label="Pages">
                <span>${page.total === undefined ? '' : `${page.total} entries`}</span>
                <div>
                    <button type="button" ?disabled=${this.history.length === 0 || this.loading} @click=${() => this.previous()}>Previous</button>
                    <button type="button" ?disabled=${page.next === null || this.loading} @click=${() => this.next()}>Next</button>
                </div>
            </nav>`
    }

    protected override render(): unknown {
        const collection = getConfig()?.collections[this.collection]

        if (collection === undefined) {
            return html`<p role="alert">There is no collection "${this.collection}"</p>`
        }

        const host = getConfig() === undefined ? '' : new URL(getConfig()!.baseUrl).host

        return html`
            <header>
                <div class="title">
                    ${host === '' ? nothing : html`<span class="eyebrow">${host}</span>`}
                    <h1>${collection.label ?? this.collection}</h1>
                </div>
                ${collection.create === undefined ? nothing : html`<a class="button primary" href=${hrefOf({ view: 'new', collection: this.collection })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>New</a>`}
            </header>
            ${this.toolbar(collection)}
            ${this.bulkBar(collection)}
            ${this.message === '' ? nothing : html`<p role="alert">${this.message}</p>`}
            ${this.loading ? html`<p role="status">Loading…</p>` : nothing}
            ${this.previewing === undefined ? nothing : this.drawer(collection, this.previewing)}
            ${this.page === undefined ? nothing : html`${this.entries(collection, this.page)}${this.pager(this.page)}`}`
    }
}
