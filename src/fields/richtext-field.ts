import { css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { MonkeyField } from './field.ts'
import type { ControlAttributes } from './field.ts'
import { htmlToMarkdown, markdownToHtml } from '../richtext/markdown.ts'
import { sanitizeHtml } from '../richtext/sanitize.ts'
import type { RichtextFormat } from '../config/main.ts'


interface Command {
    readonly label: string
    readonly run: () => void
}

const format = (command: string, value?: string): void => {
    document.execCommand(command, false, value)
}

const COMMANDS: readonly Command[] = [
    { label: 'Heading', run: () => format('formatBlock', 'h2') },
    { label: 'Subheading', run: () => format('formatBlock', 'h3') },
    { label: 'Paragraph', run: () => format('formatBlock', 'p') },
    { label: 'Bold', run: () => format('bold') },
    { label: 'Italic', run: () => format('italic') },
    { label: 'Bullet list', run: () => format('insertUnorderedList') },
    { label: 'Numbered list', run: () => format('insertOrderedList') },
    { label: 'Quote', run: () => format('formatBlock', 'blockquote') },
]

// A text with headings, bold, italic, lists and quotes, made with a small toolbar on a
// contenteditable element. The value is stored as HTML or as Markdown ("format"). What the
// person types is sanitized before it goes out, and the value that comes in is sanitized
// before it is shown, so the value only ever has the tags that the toolbar can make.
@customElement('monkey-richtext-field')
export class MonkeyRichtextField extends MonkeyField<string> {
    static override styles = [...MonkeyField.styles, css`
        .toolbar {
            display: flex;
            flex-wrap: wrap;
            gap: 0.25rem;
        }

        .toolbar button {
            min-block-size: 2.75rem;
            padding: 0 0.875rem;
            font: inherit;
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--monkey-color);
            background: transparent;
            border: 1px solid var(--monkey-control-border-color);
            border-radius: var(--monkey-radius);
            cursor: pointer;
        }

        .toolbar button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .editor {
            box-sizing: border-box;
            min-block-size: 10rem;
            padding: var(--monkey-padding);
            color: var(--monkey-color);
            background: var(--monkey-surface-color);
            border: 1px solid var(--monkey-control-border-color);
            border-radius: var(--monkey-radius);
        }

        .editor:focus-visible {
            outline: 3px solid var(--monkey-accent-color);
            outline-offset: 2px;
        }

        .editor[aria-invalid='true'] {
            border-color: var(--monkey-error-color);
        }

        .editor > :first-child {
            margin-block-start: 0;
        }

        .editor > :last-child {
            margin-block-end: 0;
        }

        .editor blockquote {
            margin-inline: 0;
            padding-inline-start: 1rem;
            color: var(--monkey-muted-color);
            border-inline-start: 4px solid var(--monkey-border-color);
        }
    `]

    @property({ type: String })
    override value = ''

    // How the value is stored.
    @property({ type: String })
    format: RichtextFormat = 'html'

    // The value that this field sent last. The editor shows a value from outside only when it
    // is another one, because a new value in the middle of typing would move the cursor.
    private sent: string | undefined

    private shown: string | undefined

    private toHtml(value: string): string {
        return sanitizeHtml(this.format === 'markdown' ? markdownToHtml(value) : value)
    }

    private toValue(editor: HTMLElement): string {
        const clean = sanitizeHtml(editor.innerHTML)

        return this.format === 'markdown' ? htmlToMarkdown(clean) : clean
    }

    protected override updated(): void {
        const value = typeof this.value === 'string' ? this.value : ''
        const editor = this.renderRoot.querySelector<HTMLElement>('#control')

        if (editor !== null && value !== this.sent && `${this.format}:${value}` !== this.shown) {
            editor.innerHTML = this.toHtml(value)
            this.shown = `${this.format}:${value}`
        }
    }

    private input(event: Event): void {
        const value = this.toValue(event.currentTarget as HTMLElement)

        this.sent = value
        this.emit(value)
    }

    private toolbar(editable: boolean): unknown {
        return html`
            <div class="toolbar" role="toolbar" aria-label="Formatting">
                ${COMMANDS.map(({ label, run }) => html`
                    <button
                        type="button"
                        ?disabled=${!editable}
                        @mousedown=${(event: Event) => event.preventDefault()}
                        @click=${(event: Event) => {
                            const editor = this.renderRoot.querySelector<HTMLElement>('#control')

                            editor?.focus()
                            run()
                            editor?.dispatchEvent(new Event('input', { bubbles: true }))
                            event.preventDefault()
                        }}>${label}</button>`)}
            </div>`
    }

    protected override control({ id, invalid, describedBy }: ControlAttributes) {
        const editable = !this.disabled && !this.readonly

        return html`
            ${this.toolbar(editable)}
            <div
                id=${id}
                class="editor"
                role="textbox"
                aria-multiline="true"
                aria-label=${this.label === '' ? this.name : this.label}
                aria-required=${this.required ? 'true' : 'false'}
                aria-readonly=${this.readonly ? 'true' : 'false'}
                aria-disabled=${this.disabled ? 'true' : 'false'}
                aria-invalid=${invalid ? 'true' : 'false'}
                aria-describedby=${describedBy}
                contenteditable=${editable ? 'true' : 'false'}
                tabindex="0"
                @input=${(event: Event) => this.input(event)}></div>`
    }
}
