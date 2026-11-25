// A small signal module: createSignal, computed and effect. An effect or a computed value
// reruns when a signal that it read changes. The TC39 Signals proposal may replace this one
// day. The API is kept small so that the swap stays easy.

interface Subscription {
    rerun: () => void
    // The subscriber sets that this subscription is in, so it can leave them before a rerun.
    sources: Set<Set<Subscription>>
}

let current: Subscription | undefined

const watch = (subscribers: Set<Subscription>): void => {
    if (current !== undefined) {
        subscribers.add(current)
        current.sources.add(subscribers)
    }
}

const forget = (subscription: Subscription): void => {
    subscription.sources.forEach((subscribers) => subscribers.delete(subscription))
    subscription.sources.clear()
}

export type Getter<T> = () => T
export type Setter<T> = (newValue: T) => void

export const createSignal = <T>(initialValue: T): [Getter<T>, Setter<T>] => {
    let value = initialValue
    const subscribers = new Set<Subscription>()

    return [
        () => {
            watch(subscribers)

            return value
        },
        (newValue) => {
            if (!Object.is(newValue, value)) {
                value = newValue
                // A copy, because a rerun changes the set.
                ;[...subscribers].forEach((subscription) => subscription.rerun())
            }
        },
    ]
}

// Runs fn now, and again each time a signal that fn read changes. Returns a function that
// stops it. An effect that changes a signal that it also reads does not rerun itself.
export const effect = (fn: () => void): (() => void) => {
    let running = false
    let stopped = false
    const subscription: Subscription = {
        sources: new Set(),
        rerun: () => {
            if (running || stopped) {
                return
            }

            forget(subscription)

            const outer = current

            current = subscription
            running = true

            try {
                fn()
            } finally {
                current = outer
                running = false
            }
        },
    }

    subscription.rerun()

    return () => {
        stopped = true
        forget(subscription)
    }
}

// A value that follows other signals. It is worked out again at once when they change.
// Call the returned stop function when the value is no longer needed.
export const computed = <T>(fn: () => T): [Getter<T>, () => void] => {
    const [get, set] = createSignal<T | undefined>(undefined)
    const stop = effect(() => set(fn()))

    return [get as Getter<T>, stop]
}

type Stored<T> = { readonly value: T } | undefined

// The storage can be missing or can throw (private mode, blocked site data), so every
// access is guarded and the signal still works in memory without it.
type StorageArea = 'localStorage' | 'sessionStorage'

const storage = (area: StorageArea): Storage | undefined => {
    try {
        return globalThis[area]
    } catch {
        return undefined
    }
}

const readStored = <T>(area: StorageArea, key: string, validate: (value: unknown) => value is T): Stored<T> => {
    try {
        const raw = storage(area)?.getItem(key)
        const parsed: unknown = raw === null || raw === undefined ? undefined : JSON.parse(raw)

        return raw !== null && raw !== undefined && validate(parsed) ? { value: parsed } : undefined
    } catch {
        return undefined
    }
}

const writeStored = (area: StorageArea, key: string, value: unknown): void => {
    try {
        storage(area)?.setItem(key, JSON.stringify(value))
    } catch {
        // The storage is full or blocked. The value stays in memory.
    }
}

const valueOr = <T>(stored: Stored<T>, fallback: T): T => stored === undefined ? fallback : stored.value

const anything = <T>(_value: unknown): _value is T => true

// A signal that is saved in the storage area when it is set. A stored value that is
// missing, is not JSON, or fails validate is ignored, and the initial value is used. The
// third item removes the listener that follows changes from other tabs.
const createStoredSignal = <T>(
    area: StorageArea,
    key: string,
    initialValue: T,
    validate: (value: unknown) => value is T
): [Getter<T>, Setter<T>, () => void] => {
    const [get, setValue] = createSignal<T>(valueOr(readStored(area, key, validate), initialValue))

    const onStorage = (event: StorageEvent): void => {
        if (event.key === key || event.key === null) {
            setValue(valueOr(readStored(area, key, validate), initialValue))
        }
    }

    // Other tabs share localStorage. Each tab has its own sessionStorage.
    const listens = area === 'localStorage'

    if (listens) {
        globalThis.addEventListener?.('storage', onStorage)
    }

    return [
        get,
        (newValue) => {
            setValue(newValue)
            writeStored(area, key, newValue)
        },
        () => listens ? globalThis.removeEventListener?.('storage', onStorage) : undefined,
    ]
}

export const createLocalStorageSignal = <T>(
    key: string,
    initialValue: T,
    validate: (value: unknown) => value is T = anything
): [Getter<T>, Setter<T>, () => void] => createStoredSignal('localStorage', key, initialValue, validate)

// For data that must not outlive the tab, such as a session.
export const createSessionStorageSignal = <T>(
    key: string,
    initialValue: T,
    validate: (value: unknown) => value is T = anything
): [Getter<T>, Setter<T>, () => void] => createStoredSignal('sessionStorage', key, initialValue, validate)
