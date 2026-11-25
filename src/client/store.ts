import { createSignal } from '../base/signals/signals.ts'
import type { ApiClient } from './types.ts'


// The client of the loaded config, for every component. monkey-set-up fills it when the config
// is ready, and replaces it when another config loads.
export const [getClient, setClient] = createSignal<ApiClient | undefined>(undefined)
