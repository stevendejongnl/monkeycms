import type { ThemeConfig, ThemeDensity, ThemeFont, ThemeMode, ThemePreset, ThemeRadius } from '../config/main.ts'


// A theme with every value set.
export interface ResolvedTheme {
    readonly mode: ThemeMode
    readonly accent: string
    readonly radius: ThemeRadius
    readonly density: ThemeDensity
    readonly font: ThemeFont
}

export const MODES = ['system', 'light', 'dark'] as const satisfies readonly ThemeMode[]
export const RADII = ['sharp', 'soft', 'round'] as const satisfies readonly ThemeRadius[]
export const DENSITIES = ['compact', 'comfortable', 'spacious'] as const satisfies readonly ThemeDensity[]
export const FONTS = ['system', 'serif', 'mono'] as const satisfies readonly ThemeFont[]

export const PRESETS: Readonly<Record<ThemePreset, ResolvedTheme>> = {
    indigo: { mode: 'system', accent: '#5b4bdb', radius: 'soft', density: 'comfortable', font: 'system' },
    teal: { mode: 'system', accent: '#0f766e', radius: 'soft', density: 'comfortable', font: 'system' },
    rose: { mode: 'system', accent: '#be123c', radius: 'round', density: 'comfortable', font: 'system' },
    amber: { mode: 'system', accent: '#b45309', radius: 'sharp', density: 'comfortable', font: 'system' },
    slate: { mode: 'system', accent: '#334155', radius: 'sharp', density: 'compact', font: 'mono' },
    forest: { mode: 'system', accent: '#166534', radius: 'soft', density: 'spacious', font: 'serif' },
}

export const PRESET_NAMES = Object.keys(PRESETS) as readonly ThemePreset[]

const RADIUS: Readonly<Record<ThemeRadius, string>> = { sharp: '0.125rem', soft: '0.5rem', round: '1rem' }

const DENSITY: Readonly<Record<ThemeDensity, { gap: string, padding: string }>> = {
    compact: { gap: '1rem', padding: '0.5rem' },
    comfortable: { gap: '1.5rem', padding: '0.875rem' },
    spacious: { gap: '2rem', padding: '1.25rem' },
}

// A fixed list of stacks, so a config cannot put free CSS in a font name.
const FONT: Readonly<Record<ThemeFont, string>> = {
    system: 'system-ui, sans-serif',
    serif: "Georgia, 'Times New Roman', serif",
    mono: "ui-monospace, 'SF Mono', Menlo, monospace",
}

// The theme with every value set: the defaults, then the preset, then the values of the theme.
export const resolveTheme = (theme: ThemeConfig | undefined): ResolvedTheme => ({
    ...PRESETS.indigo,
    ...(theme?.preset === undefined ? {} : PRESETS[theme.preset]),
    ...Object.fromEntries(Object.entries(theme ?? {}).filter(([key, value]) => key !== 'preset' && value !== undefined)),
})

// The tokens that a theme sets. The contrast and link colours follow the accent in main.css.
export const themeTokens = (theme: ResolvedTheme): Readonly<Record<string, string>> => ({
    '--monkey-accent-color': theme.accent,
    '--monkey-radius': RADIUS[theme.radius],
    '--monkey-gap': DENSITY[theme.density].gap,
    '--monkey-padding': DENSITY[theme.density].padding,
    '--monkey-font': FONT[theme.font],
})

// The theme as CSS that a page could use without the config key.
export const themeCss = (theme: ResolvedTheme): string =>
    `:root {\n${Object.entries(themeTokens(theme)).map(([name, value]) => `    ${name}: ${value};`).join('\n')}\n}${theme.mode === 'system' ? '' : `\n\n/* <html data-theme="${theme.mode}"> */`}`

// The theme as the "theme" key of the config.
export const themeJson = (theme: ResolvedTheme): string => JSON.stringify({ theme }, null, 2)

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T => list.includes(value as T)

// A theme from data that came from outside, for example the browser storage. It keeps the
// values that are valid and leaves the others out. It gives undefined when nothing is left.
export const parseTheme = (input: unknown): ThemeConfig | undefined => {
    if (typeof input !== 'object' || input === null) {
        return undefined
    }

    const { preset, mode, accent, radius, density, font } = input as Record<string, unknown>
    const theme: ThemeConfig = {
        ...(isOneOf(PRESET_NAMES, preset) ? { preset } : {}),
        ...(isOneOf(MODES, mode) ? { mode } : {}),
        ...(typeof accent === 'string' && /^#[0-9a-f]{6}$/i.test(accent) ? { accent } : {}),
        ...(isOneOf(RADII, radius) ? { radius } : {}),
        ...(isOneOf(DENSITIES, density) ? { density } : {}),
        ...(isOneOf(FONTS, font) ? { font } : {}),
    }

    return Object.keys(theme).length === 0 ? undefined : theme
}

const setsMode = new WeakSet<HTMLElement>()

const OWNED = Object.keys(themeTokens(PRESETS.indigo))

// Puts a theme on the page: the tokens on the root element, and data-theme for light or dark.
// Without a theme the page keeps whatever its own CSS says.
export const applyTheme = (theme: ThemeConfig | undefined, root: HTMLElement = document.documentElement): void => {
    OWNED.forEach((name) => root.style.removeProperty(name))

    // A data-theme that the page set itself stays, unless this function set it before.
    if (setsMode.delete(root)) {
        root.removeAttribute('data-theme')
    }

    if (theme === undefined) {
        return
    }

    const resolved = resolveTheme(theme)

    Object.entries(themeTokens(resolved)).forEach(([name, value]) => root.style.setProperty(name, value))

    if (resolved.mode !== 'system') {
        root.setAttribute('data-theme', resolved.mode)
        setsMode.add(root)
    }
}
