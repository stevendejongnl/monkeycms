import { createSignal } from '../base/signals/signals.ts'


const [counts, setCounts] = createSignal<Readonly<Record<string, number>>>({})

// The number of entries that each collection had the last time its list was loaded. The list
// sets it, and the sidebar shows it. Reading it in an effect follows the changes.
export const getCounts = counts

export const setCount = (collection: string, total: number): void => {
    setCounts({ ...counts(), [collection]: total })
}
