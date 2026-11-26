import { createSignal } from '../base/signals/signals.ts'
import type { ThemeConfig } from '../config/main.ts'
import { parseTheme } from './theme.ts'


const KEY = 'monkeycms:theme'

const read = (): ThemeConfig | undefined => {
    try {
        return parseTheme(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
    } catch {
        return undefined
    }
}

const write = (theme: ThemeConfig | undefined): void => {
    try {
        theme === undefined ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, JSON.stringify(theme))
    } catch {
        // Not saved. The theme still changes for this visit.
    }
}

const [chosen, setChosen] = createSignal<ThemeConfig | undefined>(read())

// The theme that the person chose on the settings screen. It wins over the theme of the
// config. It is kept in the browser. Reading it in an effect follows the changes.
export const getChosenTheme = chosen

export const setChosenTheme = (theme: ThemeConfig | undefined): void => {
    write(theme)
    setChosen(theme)
}
