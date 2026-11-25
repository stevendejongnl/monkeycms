import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { live } from 'lit/directives/live.js'
import { MonkeyField } from './field.ts'
import type { ControlAttributes } from './field.ts'


// The value is a number, or undefined when the input is empty or does not hold a number.
@customElement('monkey-number-field')
export class MonkeyNumberField extends MonkeyField<number | undefined> {
    @property({ type: Number })
    override value: number | undefined = undefined

    protected override control({ id, invalid, describedBy }: ControlAttributes) {
        return html`
            <input
                id=${id}
                type="number"
                step="any"
                .value=${live(this.value === undefined ? '' : String(this.value))}
                ?required=${this.required}
                ?disabled=${this.disabled}
                ?readonly=${this.readonly}
                aria-invalid=${invalid ? 'true' : 'false'}
                aria-describedby=${describedBy}
                @input=${(event: Event) => {
                    const { valueAsNumber } = event.target as HTMLInputElement

                    this.emit(Number.isNaN(valueAsNumber) ? undefined : valueAsNumber)
                }}>`
    }
}
