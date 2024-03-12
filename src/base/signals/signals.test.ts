import { expect } from '@open-wc/testing'
import { createSignal, createLocalStorageSignal } from './signals.js'


describe('Signals', () => {
    it('should store and get signal', async () => {
        const [signal, setSignal] = createSignal('the initial value')

        setSignal('the updated value')

        const actual = signal()
        const expected = 'the updated value'

        await expect(actual).to.equal(expected)
    })

    it('should store and get signal from local storage', async () => {
        const SIGNAL_KEY = Symbol('SIGNAL_KEY').toString()
        const [signal, setSignal] = createLocalStorageSignal(SIGNAL_KEY, 'the initial value')

        setSignal('the updated value')

        const actualSignal = signal()
        const actualLocalStorage = localStorage.getItem(SIGNAL_KEY) || ''
        const expected = 'the updated value'

        await expect(actualSignal).to.equal(expected)
        await expect(JSON.parse(actualLocalStorage)).to.equal(expected)
    })

    it('should store complex object in local storage', async () => {
        const SIGNAL_KEY = Symbol('COMPLEX_SIGNAL_KEY').toString()
        const [signal, setSignal] = createLocalStorageSignal(SIGNAL_KEY, { value: 'the initial value' })

        setSignal({ value: 'the updated value' })

        const actualSignal = signal()
        const actualLocalStorage = localStorage.getItem(SIGNAL_KEY) || ''
        const expected = { value: 'the updated value' }

        await expect(actualSignal).to.deep.equal(expected)
        await expect(JSON.parse(actualLocalStorage)).to.deep.equal(expected)
    })
})
