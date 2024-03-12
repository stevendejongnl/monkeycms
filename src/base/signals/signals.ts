import { signal as signalCore } from '@preact/signals-core'


export const createSignal = <T>(initialValue: T): [
    () => T,
    (newValue: T) => void
]=> {
    const signal = signalCore<T>(initialValue)

    return [
        (): T => signal.value,
        (newValue: T): void => {
            signal.value = newValue
        }
    ]
}

export const createLocalStorageSignal = <T>(key: string, initialValue: T): [
    () => T,
    (newValue: T) => void
]=> {
    const signal = signalCore<T>(initialValue)

    const value = localStorage.getItem(key)

    if (value) {
        signal.value = JSON.parse(value)
    }

    signal.subscribe((newValue: T) => {
        localStorage.setItem(key, JSON.stringify(newValue))
    })

    return [
        (): T => signal.value,
        (newValue: T): void => {
            signal.value = newValue
        }
    ]
}
