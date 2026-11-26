import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { getClient } from 'client/main.ts'
import { alertStyles, buttonStyles, linkStyles } from 'base/styles.ts'
import { getConfig } from 'config/main.ts'
import type { CollectionConfig } from 'config/main.ts'
import 'fields/main.ts'
import type { FieldChange } from 'fields/main.ts'
import { emptyEntry, hasChanged, validateEntry } from '../validate.ts'
import { hrefOf } from '../route.ts'


export const SAVED = 'monkey-saved'

type Status = 'loading' | 'ready' | 'failed'

// A form for one entry, made from the fields of the collection. Without an entry-id it makes
// a new entry. It checks the values before it sends them, shows the errors of the API at the
// field they belong to, and warns when the person leaves with unsaved changes (the dirty
// property is true then). Sends "monkey-saved" with { collection, id } after a save.
@customElement('monkey-entry-editor')
export class MonkeyEntryEditor extends LitElement {
    static override styles = [buttonStyles, linkStyles, alertStyles, css`
        :host {
            display: grid;
            gap: var(--monkey-gap);
            max-inline-size: 48rem;
        }

        h2 {
            margin: 0;
            font-size: 2rem;
            line-height: 1.15;
            letter-spacing: -0.02em;
        }

        form {
            display: grid;
            gap: var(--monkey-gap);
            padding: clamp(1.25rem, 3vw, 2rem);
            background: var(--monkey-surface-color);
            border: 1px solid var(--monkey-border-color);
            border-radius: calc(var(--monkey-radius) + 0.5rem);
        }

        .actions {
            display: grid;
            grid-auto-flow: column;
            justify-content: start;
            gap: 0.75rem;
            align-items: center;
        }

        [role='status'] {
            margin: 0;
            color: var(--monkey-muted-color);
        }
    `]

    @property({ type: String })
    collection = ''

    // The id of the entry to edit. Empty for a new entry.
    @property({ type: String, attribute: 'entry-id' })
    entryId = ''

    @state() private status: Status = 'loading'
    @state() private values: Record<string, unknown> = {}
    @state() private errors: Record<string, string> = {}
    @state() private message = ''
    @state() private saving = false

    private saved: Record<string, unknown> = {}

    private cancel: AbortController | undefined

    private readonly leave = (event: BeforeUnloadEvent): void => {
        if (this.dirty) {
            event.preventDefault()
        }
    }

    get dirty(): boolean {
        const fields = this.fields()

        return fields !== undefined && hasChanged(fields, this.saved, this.values)
    }

    private fields(): CollectionConfig['fields'] | undefined {
        return getConfig()?.collections[this.collection]?.fields
    }

    override connectedCallback(): void {
        super.connectedCallback()
        window.addEventListener('beforeunload', this.leave)
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback()
        window.removeEventListener('beforeunload', this.leave)
        this.cancel?.abort()
    }

    protected override willUpdate(changed: Map<string, unknown>): void {
        if (changed.has('collection') || changed.has('entryId')) {
            void this.load()
        }
    }

    private start(values: Record<string, unknown>): void {
        this.saved = values
        this.values = values
        this.errors = {}
        this.message = ''
        this.status = 'ready'
    }

    private async load(): Promise<void> {
        const fields = this.fields()

        this.cancel?.abort()
        this.cancel = new AbortController()

        if (fields === undefined) {
            this.status = 'failed'
            this.message = `There is no collection "${this.collection}"`

            return
        }

        if (this.entryId === '') {
            this.start(emptyEntry(fields))

            return
        }

        this.status = 'loading'

        const result = await getClient()?.get(this.collection, this.entryId, { signal: this.cancel.signal })

        if (result === undefined) {
            this.status = 'failed'
            this.message = 'There is no API client yet'
        } else if (result.ok) {
            this.start({ ...emptyEntry(fields), ...result.value.values })
        } else if (result.error.kind !== 'aborted') {
            this.status = 'failed'
            this.message = result.error.message
        }
    }

    private change({ detail }: CustomEvent<FieldChange>): void {
        this.values = { ...this.values, [detail.name]: detail.value }
        this.errors = Object.fromEntries(Object.entries(this.errors).filter(([name]) => name !== detail.name))
    }

    private async save(event: SubmitEvent): Promise<void> {
        event.preventDefault()

        const fields = this.fields() ?? {}
        const problems = validateEntry(fields, this.values)

        this.errors = problems
        this.message = Object.keys(problems).length === 0 ? '' : 'Fix the marked fields and save again'

        if (Object.keys(problems).length > 0 || this.saving) {
            return
        }

        const client = getClient()

        this.saving = true

        const result = this.entryId === ''
            ? await client?.create(this.collection, this.values)
            : await client?.update(this.collection, this.entryId, this.values)

        this.saving = false

        if (result === undefined) {
            this.message = 'There is no API client yet'
        } else if (result.ok) {
            // The entry is saved, so leaving is not a loss.
            this.saved = this.values
            this.dispatchEvent(new CustomEvent(SAVED, { bubbles: true, composed: true, detail: { collection: this.collection, id: result.value.id } }))
        } else {
            const { fieldErrors } = result.error
            const known = Object.fromEntries(Object.entries(fieldErrors).filter(([name]) => name in fields))

            this.errors = known
            this.message = result.error.message
        }
    }

    private field([name, field]: [string, CollectionConfig['fields'][string]]): unknown {
        return html`
            <monkey-field
                .name=${name}
                .field=${field}
                .value=${this.values[name]}
                .error=${this.errors[name] ?? ''}
                ?disabled=${this.saving}
                @monkey-change=${(event: CustomEvent<FieldChange>) => this.change(event)}></monkey-field>`
    }

    protected override render(): unknown {
        const collection = getConfig()?.collections[this.collection]

        if (this.status === 'failed' || collection === undefined) {
            return html`<p role="alert">${this.message}</p>`
        }

        if (this.status === 'loading') {
            return html`<p role="status">Loading…</p>`
        }

        return html`
            <h2>${this.entryId === '' ? 'New' : 'Edit'} ${collection.label ?? this.collection}</h2>
            <form novalidate @submit=${(event: SubmitEvent) => this.save(event)}>
                ${Object.entries(collection.fields).map((entry) => this.field(entry))}
                ${this.message === '' ? nothing : html`<p role="alert">${this.message}</p>`}
                <div class="actions">
                    <button type="submit" ?disabled=${this.saving}>${this.saving ? 'Saving…' : 'Save'}</button>
                    <a class="button" href=${hrefOf({ view: 'list', collection: this.collection })}>Cancel</a>
                </div>
            </form>`
    }
}
