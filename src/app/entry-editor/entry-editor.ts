import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { getClient } from 'client/main.ts'
import { alertStyles, buttonStyles, linkStyles } from 'base/styles.ts'
import { getConfig } from 'config/main.ts'
import type { CollectionConfig } from 'config/main.ts'
import 'fields/main.ts'
import type { FieldChange } from 'fields/main.ts'
import { displayValue } from '../display.ts'
import { sectionsOf } from '../sections.ts'
import type { EditorSection } from '../sections.ts'
import { emptyEntry, hasChanged, validateEntry } from '../validate.ts'
import { hrefOf } from '../route.ts'


export const SAVED = 'monkey-saved'

type Status = 'loading' | 'ready' | 'failed'
type Mode = 'edit' | 'preview'

// A form for one entry, made from the fields of the collection, in sections when the config
// has them (with an outline to jump to one). Without an entry-id it makes a new entry. It
// checks the values before it sends them, lists the problems with a link to each field, shows
// the errors of the API at the field they belong to, and warns when the person leaves with
// unsaved changes (the dirty property is true then). A bar at the bottom shows that state
// next to Save. Edit and Preview swap the form for a view of the values: a click on a block
// goes back to its field. Sends "monkey-saved" with { collection, id } after a save.
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

        header {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 1rem;
            align-items: center;
        }

        .modes, .outline ul {
            display: grid;
            grid-auto-flow: column;
            justify-content: start;
            gap: 0.5rem;
            margin: 0;
            padding: 0;
            list-style: none;
        }

        .modes button, .outline button {
            min-block-size: 2.75rem;
            padding: 0 1rem;
        }

        button[aria-pressed='true'] {
            color: var(--monkey-accent-contrast-color);
            background: var(--monkey-accent-color);
            border-color: transparent;
        }

        section {
            display: grid;
            gap: var(--monkey-gap);
        }

        section h3 {
            margin: 0;
            font-size: 1.25rem;
            scroll-margin-block-start: 1rem;
        }

        section h3:focus {
            outline: none;
        }

        .problems {
            display: grid;
            gap: 0.5rem;
        }

        .problems p {
            margin: 0;
        }

        .problems ul {
            display: grid;
            gap: 0.25rem;
            margin: 0;
            padding-inline-start: 1.25rem;
        }

        .link {
            min-block-size: 0;
            padding: 0;
            font-weight: 400;
            color: var(--monkey-link-color);
            text-decoration: underline;
            border: 0;
            border-radius: 0;
        }

        .block {
            display: grid;
            justify-items: start;
            gap: 0.25rem;
            inline-size: 100%;
            padding: 0.75rem 1rem;
            text-align: start;
            font-weight: 400;
            border-radius: var(--monkey-radius);
        }

        .block .label {
            font-size: 0.8125rem;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--monkey-muted-color);
        }

        .block .value {
            white-space: pre-wrap;
        }

        .bar {
            position: sticky;
            inset-block-end: 0;
            display: grid;
            grid-template-columns: 1fr auto auto;
            gap: 0.75rem;
            align-items: center;
            padding: 0.75rem 1rem;
            background: var(--monkey-surface-color);
            border: 1px solid var(--monkey-border-color);
            border-radius: var(--monkey-radius);
        }

        .bar [role='status'] {
            color: var(--monkey-muted-color);
        }

        .bar [role='status'].changed {
            color: var(--monkey-color);
            font-weight: 600;
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
    @state() private mode: Mode = 'edit'

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

    // Moves the focus to the control of a field, after the form is drawn.
    private async focusField(name: string): Promise<void> {
        await this.updateComplete

        const field = [...this.renderRoot.querySelectorAll<HTMLElement & { name: string, updateComplete: Promise<boolean> }>('monkey-field')].find((candidate) => candidate.name === name)

        // The field draws its input in an update of its own.
        await field?.updateComplete
        await (field?.firstElementChild as { updateComplete?: Promise<boolean> } | null | undefined)?.updateComplete
        field?.scrollIntoView({ block: 'center' })
        field?.focus()
    }

    private async jumpTo(title: string): Promise<void> {
        await this.updateComplete

        const heading = [...this.renderRoot.querySelectorAll<HTMLElement>('section h3')].find((candidate) => candidate.textContent === title)

        heading?.focus()
        heading?.scrollIntoView({ block: 'start' })
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
        this.mode = Object.keys(problems).length === 0 ? this.mode : 'edit'
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

    private section({ title, fields }: EditorSection): unknown {
        return html`
            <section aria-label=${title === '' ? 'Fields' : title}>
                ${title === '' ? nothing : html`<h3 tabindex="-1">${title}</h3>`}
                ${this.mode === 'edit' ? fields.map((entry) => this.field([...entry])) : fields.map(([name, field]) => this.block(name, field))}
            </section>`
    }

    // One value in the preview. A click goes back to the form, at the field.
    private block(name: string, field: CollectionConfig['fields'][string]): unknown {
        const value = displayValue(field, this.values[name])

        return html`
            <button type="button" class="block" @click=${() => { this.mode = 'edit'; void this.focusField(name) }}>
                <span class="label">${field.label ?? name}</span>
                <span class="value">${value === '' ? '–' : value}</span>
            </button>`
    }

    private outline(sections: readonly EditorSection[]): unknown {
        return sections.length < 2 || this.mode !== 'edit' ? nothing : html`
            <nav class="outline" aria-label="Sections">
                <ul>
                    ${sections.map(({ title }) => html`<li><button type="button" @click=${() => this.jumpTo(title)}>${title}</button></li>`)}
                </ul>
            </nav>`
    }

    private problems(collection: CollectionConfig): unknown {
        const failed = Object.entries(this.errors).filter(([name]) => name in collection.fields)

        return this.message === '' ? nothing : html`
            <div class="problems" role="alert">
                <p>${this.message}</p>
                ${failed.length === 0 ? nothing : html`
                    <ul aria-label="Fields to fix">
                        ${failed.map(([name, error]) => html`
                            <li><button type="button" class="link" @click=${() => this.focusField(name)}>${collection.fields[name]?.label ?? name}</button>: ${error}</li>`)}
                    </ul>`}
            </div>`
    }

    protected override render(): unknown {
        const collection = getConfig()?.collections[this.collection]

        if (this.status === 'failed' || collection === undefined) {
            return html`<p role="alert">${this.message}</p>`
        }

        if (this.status === 'loading') {
            return html`<p role="status">Loading…</p>`
        }

        const sections = sectionsOf(collection)

        return html`
            <header>
                <h2>${this.entryId === '' ? 'New' : 'Edit'} ${collection.label ?? this.collection}</h2>
                <div class="modes" role="group" aria-label="Mode">
                    ${(['edit', 'preview'] as const).map((mode) => html`<button type="button" aria-pressed=${String(this.mode === mode)} @click=${() => { this.mode = mode }}>${mode === 'edit' ? 'Edit' : 'Preview'}</button>`)}
                </div>
            </header>
            ${this.outline(sections)}
            <form novalidate @submit=${(event: SubmitEvent) => this.save(event)}>
                ${this.problems(collection)}
                ${sections.map((section) => this.section(section))}
                <div class="bar">
                    <span role="status" class=${this.dirty ? 'changed' : ''}>${this.dirty ? 'Unsaved changes' : 'No changes'}</span>
                    <a class="button" href=${hrefOf({ view: 'list', collection: this.collection })}>Cancel</a>
                    <button type="submit" ?disabled=${this.saving}>${this.saving ? 'Saving…' : 'Save'}</button>
                </div>
            </form>`
    }
}
