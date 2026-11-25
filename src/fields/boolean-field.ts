import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { MonkeyField } from './field.ts'
import type { ControlAttributes } from './field.ts'


@customElement('monkey-boolean-field')
export class MonkeyBooleanField extends MonkeyField<boolean> {
    @property({ type: Boolean })
    override value = false

    protected override control({ id, invalid, describedBy }: ControlAttributes) {
        return html`
            <input
                id=${id}
                type="checkbox"
                .checked=${this.value}
                ?disabled=${this.disabled || this.readonly}
                aria-invalid=${invalid ? 'true' : 'false'}
                aria-describedby=${describedBy}
                @change=${(event: Event) => this.emit((event.target as HTMLInputElement).checked)}>`
    }
}
