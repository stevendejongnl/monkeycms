import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PRESETS, PRESET_NAMES, applyTheme, parseTheme, resolveTheme, themeCss, themeJson, themeTokens } from './theme.ts'


describe('resolveTheme', () => {
    it('should use the indigo values without a theme', () => {
        assert.deepEqual(resolveTheme(undefined), PRESETS.indigo)
    })

    it('should take the preset, and let a set value win over it', () => {
        assert.deepEqual(resolveTheme({ preset: 'forest', radius: 'round' }), { ...PRESETS.forest, radius: 'round' })
    })

    it('should have six presets', () => {
        assert.equal(PRESET_NAMES.length, 6)
    })
})

describe('themeTokens', () => {
    it('should give the five tokens of a theme', () => {
        assert.deepEqual(themeTokens({ ...PRESETS.indigo, radius: 'round', density: 'compact', font: 'mono' }), {
            '--monkey-accent-color': '#5b4bdb',
            '--monkey-radius': '1rem',
            '--monkey-gap': '1rem',
            '--monkey-padding': '0.5rem',
            '--monkey-font': "ui-monospace, 'SF Mono', Menlo, monospace",
        })
    })
})

describe('themeCss and themeJson', () => {
    it('should write the tokens as CSS, and say when the mode is not the system', () => {
        assert.match(themeCss(PRESETS.teal), /^:root \{\n    --monkey-accent-color: #0f766e;/)
        assert.doesNotMatch(themeCss(PRESETS.teal), /data-theme/)
        assert.match(themeCss({ ...PRESETS.teal, mode: 'dark' }), /data-theme="dark"/)
    })

    it('should write the theme as the theme key of a config', () => {
        assert.deepEqual(JSON.parse(themeJson(PRESETS.rose)), { theme: PRESETS.rose })
    })
})

describe('parseTheme', () => {
    it('should keep valid values and drop the others', () => {
        assert.deepEqual(parseTheme({ preset: 'teal', accent: '#ABCDEF', radius: 'huge', font: 'comic', extra: 1 }), { preset: 'teal', accent: '#ABCDEF' })
    })

    it('should give undefined for nothing usable', () => {
        for (const input of [null, 'x', 5, [], {}, { accent: 'red' }]) {
            assert.equal(parseTheme(input), undefined)
        }
    })
})

describe('applyTheme', () => {
    const fake = () => {
        const properties = new Map<string, string>()
        const attributes = new Map<string, string>()

        return {
            properties,
            attributes,
            root: {
                style: { setProperty: (name: string, value: string) => properties.set(name, value), removeProperty: (name: string) => properties.delete(name) },
                setAttribute: (name: string, value: string) => attributes.set(name, value),
                removeAttribute: (name: string) => attributes.delete(name),
            } as unknown as HTMLElement,
        }
    }

    it('should set the tokens, and data-theme for light and dark only', () => {
        const { root, properties, attributes } = fake()

        applyTheme({ preset: 'teal', mode: 'dark' }, root)

        assert.equal(properties.get('--monkey-accent-color'), '#0f766e')
        assert.equal(attributes.get('data-theme'), 'dark')

        applyTheme({ mode: 'system' }, root)

        assert.equal(attributes.has('data-theme'), false)
    })

    it('should take its own tokens off again without a theme', () => {
        const { root, properties } = fake()

        applyTheme({ preset: 'rose' }, root)
        applyTheme(undefined, root)

        assert.equal(properties.size, 0)
    })
})
