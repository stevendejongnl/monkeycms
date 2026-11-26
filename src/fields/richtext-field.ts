import { css, html, svg } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { MonkeyField } from './field.ts'
import type { ControlAttributes } from './field.ts'
import { htmlToMarkdown, markdownToHtml } from '../richtext/markdown.ts'
import { sanitizeHtml } from '../richtext/sanitize.ts'
import type { RichtextFormat } from '../config/main.ts'


interface Command {
    readonly label: string
    // The path of the icon in a 24 by 24 box.
    readonly icon: string
    readonly run: () => void
}

const format = (command: string, value?: string): void => {
    document.execCommand(command, false, value)
}

const COMMANDS: readonly Command[] = [
    { label: 'Heading', icon: 'M6 5v14M18 5v14M6 12h12', run: () => format('formatBlock', 'h2') },
    { label: 'Bold', icon: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z', run: () => format('bold') },
    { label: 'Italic', icon: 'M10 5h8M6 19h8M14 5l-4 14', run: () => format('italic') },
    { label: 'Bulleted list', icon: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01', run: () => format('insertUnorderedList') },
    { label: 'Quote', icon: 'M5 17c0-4 1-7 4-9M13 17c0-4 1-7 4-9', run: () => format('formatBlock', 'blockquote') },
    { label: 'Paragraph', icon: 'M8 5h8M8 12h8M8 19h5', run: () => format('formatBlock', 'p') },
]

// A text with headings, bold, italic, lists and quotes, made with a small toolbar on a
// contenteditable element. The value is stored as HTML or as Markdown ("format"). What the
// person types is sanitized before it goes out, and the value that comes in is sanitized
// before it is shown, so the value only ever has the tags that the toolbar can make.
@customElement('monkey-richtext-field')
export class MonkeyRichtextField extends MonkeyField<string> {
    static override styles = [...MonkeyField.styles, css`
        .frame {
            overflow: hidden;
            background: var(--monkey-background-color);
            border: 1px solid var(--monkey-control-border-color);
            border-radius: calc(var(--monkey-radius) + 4px);
        }

        .frame:focus-within {
            outline: 3px solid var(--monkey-accent-color);
            outline-offset: 2px;
        }

        .frame.invalid {
            border: 2px solid var(--monkey-error-color);
        }

        .toolbar {
            display: grid;
            grid-auto-flow: column;
            justify-content: start;
            align-items: center;
            gap: 2px;
            padding: 6px;
            background: var(--monkey-surface-color);
            border-block-end: 1px solid var(--monkey-border-color);
        }

        .toolbar button {
            display: grid;
            place-items: center;
            inline-size: 2.5rem;
            block-size: 2.5rem;
            padding: 0;
            color: var(--monkey-color);
            background: transparent;
            border: 0;
            border-radius: var(--monkey-radius);
            cursor: pointer;
        }

        .toolbar button:hover:not(:disabled) {
            background: color-mix(in oklab, var(--monkey-accent-color) 14%, var(--monkey-surface-color));
        }

        .toolbar button:focus-visible {
            outline: 3px solid var(--monkey-accent-color);
            outline-offset: -3px;
        }

        .toolbar button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .editor {
            box-sizing: border-box;
            min-block-size: 16rem;
            padding: 1.25rem 1.5rem;
            font-size: 1.0625rem;
            line-height: 1.7;
            outline: 0;
        }

        .editor > :first-child {
            margin-block-start: 0;
        }

        .editor > :last-child {
            margin-block-end: 0;
        }

        .editor h2 {
            margin: 1.4em 0 0.4em;
            font-size: 1.5rem;
            line-height: 1.25;
            letter-spacing: -0.01em;
        }

        .editor h3 {
            margin: 1.2em 0 0.4em;
            font-size: 1.25rem;
            line-height: 1.3;
        }

        .editor p {
            margin: 0.8em 0;
        }

        .editor ul, .editor ol {
            margin: 0.8em 0;
            padding-inline-start: 1.4em;
        }

        .editor li {
            margin: 0.25em 0;
        }

        .editor blockquote {
            margin: 1em 0;
            padding: 0.625rem 1.125rem;
            background: color-mix(in oklab, var(--monkey-accent-color) 9%, var(--monkey-surface-color));
            border-radius: var(--monkey-radius);
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
            <div class="toolbar" role="toolbar" aria-label="Formatting" aria-controls="control">
                ${COMMANDS.map(({ label, icon, run }) => html`
                    <button
                        type="button"
                        title=${label}
                        aria-label=${label}
                        ?disabled=${!editable}
                        @mousedown=${(event: Event) => event.preventDefault()}
                        @click=${() => {
                            const editor = this.renderRoot.querySelector<HTMLElement>('#control')

                            // Focusing an editor that has the focus can move the selection in WebKit.
                            if (editor !== null && this.renderRoot.querySelector(':focus') !== editor) {
                                editor.focus()
                            }

                            run()
                            editor?.dispatchEvent(new Event('input', { bubbles: true }))
                        }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svg`<path d=${icon}></path>`}</svg>
                    </button>`)}
            </div>`
    }

    protected override control({ id, invalid, describedBy }: ControlAttributes) {
        const editable = !this.disabled && !this.readonly

        return html`
            <div class=${invalid ? 'frame invalid' : 'frame'}>
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
                    @input=${(event: Event) => this.input(event)}></div>
            </div>`
    }
}
