import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { createSignal, createLocalStorageSignal } from './signals.ts'


const memory = new Map<string, string>()

Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => void memory.set(key, String(value)),
    },
})

describe('Signals', () => {
    beforeEach(() => memory.clear())

    it('should store and get signal', () => {
        const [signal, setSignal] = createSignal('the initial value')

        setSignal('the updated value')

        assert.equal(signal(), 'the updated value')
    })

    it('should store and get signal from local storage', () => {
        const SIGNAL_KEY = 'SIGNAL_KEY'
        const [signal, setSignal] = createLocalStorageSignal(SIGNAL_KEY, 'the initial value')

        setSignal('the updated value')

        assert.equal(signal(), 'the updated value')
        assert.equal(JSON.parse(localStorage.getItem(SIGNAL_KEY) ?? ''), 'the updated value')
    })

    it('should store complex object in local storage', () => {
        const SIGNAL_KEY = 'COMPLEX_SIGNAL_KEY'
        const [signal, setSignal] = createLocalStorageSignal(SIGNAL_KEY, { value: 'the initial value' })

        setSignal({ value: 'the updated value' })

        assert.deepEqual(signal(), { value: 'the updated value' })
        assert.deepEqual(JSON.parse(localStorage.getItem(SIGNAL_KEY) ?? ''), { value: 'the updated value' })
    })
})
