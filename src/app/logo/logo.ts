import { LitElement, css, svg } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { CMS, MARK_ACCENT, MARK_INK, MARK_WIDTH, MONKEY, VIEW_BOX } from './paths.ts'


// The logo of MonkeyCMS: a monkey with a building-block cap and the name. With "mark" it shows
// the monkey alone. The colours come from the theme: the monkey and "Monkey" use the text
// colour, and the cap and "CMS" use the accent. A page can set "--monkey-logo-ink-color" and
// "--monkey-logo-accent-color" to use other colours, for example on a coloured background.
@customElement('monkey-logo')
export class MonkeyLogo extends LitElement {
    static override styles = css`
        :host {
            display: inline-block;
            line-height: 0;
        }

        svg {
            block-size: 100%;
            inline-size: auto;
        }

        .ink {
            fill: var(--monkey-logo-ink-color, var(--monkey-color));
        }

        .accent {
            fill: var(--monkey-logo-accent-color, var(--monkey-accent-color));
        }
    `

    // Shows the monkey alone.
    @property({ type: Boolean })
    mark = false

    // The name that a screen reader says. The default is the name of the product.
    @property({ type: String })
    label = 'MonkeyCMS'

    protected override render(): unknown {
        const [x, y, width, height] = VIEW_BOX.split(' ').map(Number) as [number, number, number, number]

        return svg`
            <svg viewBox="${x} ${y} ${this.mark ? MARK_WIDTH : width} ${height}" role="img" aria-label=${this.label}>
                <path class="ink" fill-rule="evenodd" d=${MARK_INK}></path>
                <path class="accent" fill-rule="evenodd" d=${MARK_ACCENT}></path>
                ${this.mark ? '' : svg`
                    <path class="ink" d=${MONKEY}></path>
                    <path class="accent" d=${CMS}></path>`}
            </svg>`
    }
}
