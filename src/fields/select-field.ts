import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { live } from 'lit/directives/live.js'
import { MonkeyField } from './field.ts'
import type { ControlAttributes } from './field.ts'


// The value is one of the options, or undefined when nothing is chosen. A field that is not
// required has an empty choice.
@customElement('monkey-select-field')
export class MonkeySelectField extends MonkeyField<string | undefined> {
    @property({ type: String })
    override value: string | undefined = undefined

    @property({ attribute: false })
    options: readonly string[] = []

    protected override control({ id, invalid, describedBy }: ControlAttributes) {
        return html`
            <select
                id=${id}
                .value=${live(this.value ?? '')}
                ?required=${this.required}
                ?disabled=${this.disabled || this.readonly}
                aria-invalid=${invalid ? 'true' : 'false'}
                aria-describedby=${describedBy}
                @change=${(event: Event) => {
                    const { value } = event.target as HTMLSelectElement

                    this.emit(value === '' ? undefined : value)
                }}>
                <option value="" ?hidden=${this.required}></option>
                ${this.options.map((option) => html`<option value=${option} ?selected=${option === this.value}>${option}</option>`)}
            </select>`
    }
}
