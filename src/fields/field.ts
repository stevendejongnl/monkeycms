import { LitElement, css, html, nothing } from 'lit'
import { property } from 'lit/decorators.js'
import type { TemplateResult } from 'lit'
import { controlStyles } from '../base/styles.ts'


export const FIELD_CHANGE = 'monkey-change'

export interface FieldChange<T = unknown> {
    readonly name: string
    readonly value: T
}

// What a control needs to be tied to its label and its error message.
export interface ControlAttributes {
    readonly id: string
    readonly invalid: boolean
    readonly describedBy: string | typeof nothing
}

// The contract that every field input shares: a label, a required mark, an error message,
// a disabled and a read-only state, and one "monkey-change" event with { name, value }.
// A field type only draws its control and says how a user action becomes a value.
export abstract class MonkeyField<T> extends LitElement {
    static override styles = [controlStyles, css`
        :host {
            display: grid;
            gap: var(--monkey-field-gap);
        }

        label {
            font-weight: 600;
        }

        input:not([type='checkbox']), textarea, select {
            min-inline-size: 0;
        }

        [role='alert'] {
            margin: 0;
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--monkey-error-color);
        }
    `]

    // The key of the field in the entry.
    @property({ type: String })
    name = ''

    @property({ type: String })
    label = ''

    @property({ type: Boolean })
    required = false

    @property({ type: Boolean })
    disabled = false

    @property({ type: Boolean })
    readonly = false

    // The message to show under the control. An empty string means the value is fine.
    @property({ type: String })
    error = ''

    abstract value: T

    protected abstract control(attributes: ControlAttributes): TemplateResult

    // Sets the value and tells the page.
    protected emit(value: T): void {
        this.value = value
        this.dispatchEvent(new CustomEvent<FieldChange<T>>(FIELD_CHANGE, {
            bubbles: true,
            composed: true,
            detail: { name: this.name, value },
        }))
    }

    protected override render(): unknown {
        const failed = this.error !== ''

        return html`
            <label for="control">
                ${this.label === '' ? this.name : this.label}
                ${this.required ? html`<span aria-hidden="true">*</span>` : nothing}
            </label>
            ${this.control({ id: 'control', invalid: failed, describedBy: failed ? 'error' : nothing })}
            ${failed ? html`<p id="error" role="alert">${this.error}</p>` : nothing}`
    }
}
