import { LitElement, css, html, nothing } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { buttonStyles, controlStyles } from '../../base/styles.ts'
import { getConfig } from '../../config/main.ts'
import { getChosenTheme, setChosenTheme } from '../../theme/store.ts'
import { DENSITIES, FONTS, MODES, PRESETS, PRESET_NAMES, RADII, resolveTheme, themeCss, themeJson } from '../../theme/theme.ts'
import type { ResolvedTheme } from '../../theme/theme.ts'


type Tab = 'preview' | 'code'

const GROUPS = [
    { key: 'mode', label: 'Mode', options: MODES },
    { key: 'radius', label: 'Corners', options: RADII },
    { key: 'density', label: 'Density', options: DENSITIES },
    { key: 'font', label: 'Font', options: FONTS },
] as const

// The settings screen (#/settings): the person picks a preset, or sets the mode, accent, corners,
// density and font. The whole app changes at once, so the page is the live preview. The code tab
// shows the choice as the "theme" key of the config and as CSS. The choice is kept in the browser.
@customElement('monkey-settings')
export class MonkeySettings extends LitElement {
    static override styles = [controlStyles, buttonStyles, css`
        :host {
            display: grid;
            gap: var(--monkey-gap);
        }

        h1, h2, p, pre {
            margin: 0;
        }

        fieldset {
            display: grid;
            grid-auto-flow: column;
            justify-content: start;
            gap: 0.5rem;
            margin: 0;
            padding: 0;
            border: 0;
        }

        .group {
            display: grid;
            gap: var(--monkey-field-gap);
        }

        legend, .label {
            padding: 0;
            font-weight: 600;
        }

        fieldset button {
            min-block-size: 2.75rem;
            padding: 0 1rem;
            text-transform: capitalize;
        }

        button[aria-pressed='true'] {
            color: var(--monkey-accent-contrast-color);
            background: var(--monkey-accent-color);
            border-color: transparent;
        }

        .options {
            display: grid;
            gap: var(--monkey-gap);
            padding: var(--monkey-gap);
            background: var(--monkey-surface-color);
            border: 1px solid var(--monkey-border-color);
            border-radius: var(--monkey-radius);
        }

        .presets {
            flex-wrap: wrap;
        }

        .swatch {
            display: inline-block;
            inline-size: 1rem;
            block-size: 1rem;
            margin-inline-end: 0.5rem;
            vertical-align: middle;
            border: 2px solid currentColor;
            border-radius: 50%;
        }

        input[type='color'] {
            inline-size: 4rem;
            block-size: 3rem;
            padding: 0.25rem;
        }

        pre {
            overflow-x: auto;
            padding: 1rem;
            font-size: 0.875rem;
            background: var(--monkey-surface-color);
            border: 1px solid var(--monkey-border-color);
            border-radius: var(--monkey-radius);
        }

        .sample {
            display: grid;
            gap: 0.75rem;
            justify-items: start;
            padding: var(--monkey-gap);
            background: var(--monkey-surface-color);
            border: 1px solid var(--monkey-border-color);
            border-radius: var(--monkey-radius);
        }

        .muted {
            color: var(--monkey-muted-color);
        }

        .actions {
            display: grid;
            grid-auto-flow: column;
            justify-content: start;
            gap: 0.75rem;
        }
    `]

    @state() private tab: Tab = 'preview'

    // The theme that is on the page: the choice of the person, else the theme of the config.
    private theme(): ResolvedTheme {
        return resolveTheme(getChosenTheme() ?? getConfig()?.theme)
    }

    private choose(change: Partial<ResolvedTheme>): void {
        setChosenTheme({ ...this.theme(), ...change })
        this.requestUpdate()
    }

    private reset(): void {
        setChosenTheme(undefined)
        this.requestUpdate()
    }

    private isPreset(name: keyof typeof PRESETS, theme: ResolvedTheme): boolean {
        return (Object.keys(theme) as (keyof ResolvedTheme)[]).every((key) => theme[key].toLowerCase() === PRESETS[name][key].toLowerCase())
    }

    private group(key: (typeof GROUPS)[number]['key'], label: string, options: readonly string[], theme: ResolvedTheme): unknown {
        return html`
            <fieldset aria-label=${label}>
                <legend class="label">${label}</legend>
                ${options.map((option) => html`<button type="button" aria-pressed=${String(theme[key] === option)} @click=${() => this.choose({ [key]: option })}>${option}</button>`)}
            </fieldset>`
    }

    private code(theme: ResolvedTheme): unknown {
        return html`
            <div class="group">
                <h2>Config</h2>
                <p class="muted">Put this in the config to make it the default look.</p>
                <pre><code>${themeJson(theme)}</code></pre>
            </div>
            <div class="group">
                <h2>CSS</h2>
                <p class="muted">Or use these tokens in your own CSS.</p>
                <pre><code>${themeCss(theme)}</code></pre>
            </div>`
    }

    private preview(): unknown {
        return html`
            <div class="sample">
                <h2>Sample</h2>
                <p class="muted">The whole app follows these choices at once.</p>
                <button type="submit">Primary button</button>
            </div>`
    }

    protected override render(): unknown {
        const theme = this.theme()

        return html`
            <h1>Settings</h1>
            <div class="options">
                <fieldset class="presets" aria-label="Preset">
                    <legend class="label">Preset</legend>
                    ${PRESET_NAMES.map((name) => html`
                        <button type="button" aria-pressed=${String(this.isPreset(name, theme))} @click=${() => this.choose(PRESETS[name])}>
                            <span><span class="swatch" style="background: ${PRESETS[name].accent}"></span>${name}</span>
                        </button>`)}
                </fieldset>
                ${GROUPS.map(({ key, label, options }) => this.group(key, label, options, theme))}
                <div class="group">
                    <label class="label" for="accent">Accent colour</label>
                    <input id="accent" type="color" .value=${theme.accent} @input=${(event: Event) => this.choose({ accent: (event.target as HTMLInputElement).value })}>
                </div>
                <div class="actions">
                    <button type="button" @click=${() => this.reset()}>Reset to the config</button>
                </div>
            </div>
            <fieldset aria-label="Show">
                ${(['preview', 'code'] as const).map((tab) => html`<button type="button" aria-pressed=${String(this.tab === tab)} @click=${() => { this.tab = tab }}>${tab === 'preview' ? 'Preview' : 'Code'}</button>`)}
            </fieldset>
            ${this.tab === 'preview' ? this.preview() : this.code(theme)}
            ${getChosenTheme() === undefined ? nothing : html`<p class="muted">Your choice is kept in this browser.</p>`}`
    }
}
