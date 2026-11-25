import { createSignal } from '../base/signals/signals.ts'
import type { Auth } from './types.ts'


// The auth of the loaded config, for every component. monkey-set-up fills it when the config
// is ready, and replaces it when another config loads.
export const [getAuth, setAuth] = createSignal<Auth | undefined>(undefined)
