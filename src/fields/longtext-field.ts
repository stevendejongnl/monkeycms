import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { live } from 'lit/directives/live.js'
import { MonkeyField } from './field.ts'
import type { ControlAttributes } from './field.ts'


@customElement('monkey-longtext-field')
export class MonkeyLongtextField extends MonkeyField<string> {
    @property({ type: String })
    override value = ''

    protected override control({ id, invalid, describedBy }: ControlAttributes) {
        return html`
            <textarea
                id=${id}
                rows="6"
                .value=${live(this.value ?? '')}
                ?required=${this.required}
                ?disabled=${this.disabled}
                ?readonly=${this.readonly}
                aria-invalid=${invalid ? 'true' : 'false'}
                aria-describedby=${describedBy}
                @input=${(event: Event) => this.emit((event.target as HTMLTextAreaElement).value)}></textarea>`
    }
}
