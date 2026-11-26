import { LitElement } from 'lit'
import { html, literal } from 'lit/static-html.js'
import { customElement, property } from 'lit/decorators.js'
import type { FieldType } from '../config/main.ts'
import type { FieldConfig } from '../config/main.ts'


// The input element for each type of field.
const inputs = {
    text: literal`monkey-text-field`,
    longtext: literal`monkey-longtext-field`,
    number: literal`monkey-number-field`,
    boolean: literal`monkey-boolean-field`,
    date: literal`monkey-date-field`,
    select: literal`monkey-select-field`,
} satisfies Record<FieldType, unknown>

// Draws the right input for a field of the config. Give it the name of the field, the field
// and the value. A read-only field is shown but cannot change. It sends the "monkey-change"
// event of the input it draws.
@customElement('monkey-field')
export class MonkeyFieldInput extends LitElement {
    @property({ type: String })
    name = ''

    @property({ attribute: false })
    field: FieldConfig | undefined

    @property({ attribute: false })
    value: unknown = undefined

    @property({ type: String })
    error = ''

    @property({ type: Boolean })
    disabled = false

    // The inputs draw their own styles, so there is no shadow DOM to add here.
    protected override createRenderRoot(): HTMLElement {
        return this
    }

    override focus(options?: FocusOptions): void {
        this.firstElementChild instanceof HTMLElement && this.firstElementChild.focus(options)
    }

    protected override render(): unknown {
        const { field } = this

        return field === undefined ? html`` : html`
            <${inputs[field.type]}
                name=${this.name}
                label=${field.label ?? this.name}
                .value=${this.value}
                .options=${field.options ?? []}
                ?required=${field.required ?? false}
                ?readonly=${field.readOnly ?? false}
                ?disabled=${this.disabled}
                error=${this.error}></${inputs[field.type]}>`
    }
}
