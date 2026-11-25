import { createSignal } from '../base/signals/signals.ts'
import type { MonkeyConfig } from './types.ts'


// The validated config, for every component. It is empty until monkey-set-up has loaded it.
// It is not saved in the browser, so a changed config is picked up on the next load.
export const [getConfig, setConfig] = createSignal<MonkeyConfig | undefined>(undefined)
