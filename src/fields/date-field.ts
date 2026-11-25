import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { live } from 'lit/directives/live.js'
import { MonkeyField } from './field.ts'
import type { ControlAttributes } from './field.ts'


// The value is an ISO 8601 string, the same form as the "date" transform makes. The input
// shows the day. A chosen day is sent as midnight UTC, and undefined when the input is empty.
@customElement('monkey-date-field')
export class MonkeyDateField extends MonkeyField<string | undefined> {
    @property({ type: String })
    override value: string | undefined = undefined

    protected override control({ id, invalid, describedBy }: ControlAttributes) {
        return html`
            <input
                id=${id}
                type="date"
                .value=${live((this.value ?? '').slice(0, 10))}
                ?required=${this.required}
                ?disabled=${this.disabled}
                ?readonly=${this.readonly}
                aria-invalid=${invalid ? 'true' : 'false'}
                aria-describedby=${describedBy}
                @change=${(event: Event) => {
                    const { value } = event.target as HTMLInputElement

                    this.emit(value === '' ? undefined : `${value}T00:00:00.000Z`)
                }}>`
    }
}
