import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { computed, createLocalStorageSignal, createSignal, effect } from './signals.ts'


const memory = new Map<string, string>()
const events = new EventTarget()

let storageBroken = false

Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => {
        if (storageBroken) {
            throw new DOMException('blocked', 'SecurityError')
        }

        return {
            getItem: (key: string) => memory.get(key) ?? null,
            setItem: (key: string, value: string) => void memory.set(key, String(value)),
        }
    },
})

Object.assign(globalThis, {
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
})

// What a browser sends to the other tabs when one tab changes the storage.
const storageEvent = (key: string | null): void => {
    events.dispatchEvent(Object.assign(new Event('storage'), { key }))
}

describe('createSignal', () => {
    it('should store and get a value', () => {
        const [signal, setSignal] = createSignal('the initial value')

        assert.equal(signal(), 'the initial value')

        setSignal('the updated value')

        assert.equal(signal(), 'the updated value')
    })
})

describe('effect', () => {
    it('should run at once, and again when a signal that it read changes', () => {
        const [count, setCount] = createSignal(1)
        const seen: number[] = []

        effect(() => void seen.push(count()))
        setCount(2)
        setCount(3)

        assert.deepEqual(seen, [1, 2, 3])
    })

    it('should not rerun when the value is the same', () => {
        const [count, setCount] = createSignal(1)
        const seen: number[] = []

        effect(() => void seen.push(count()))
        setCount(1)

        assert.deepEqual(seen, [1])
    })

    it('should follow only the signals that it read last time', () => {
        const [useA, setUseA] = createSignal(true)
        const [a, setA] = createSignal('a')
        const [b, setB] = createSignal('b')
        const seen: string[] = []

        effect(() => void seen.push(useA() ? a() : b()))
        setB('b2')
        setUseA(false)
        setA('a2')
        setB('b3')

        assert.deepEqual(seen, ['a', 'b2', 'b3'])
    })

    it('should stop when the stop function is called', () => {
        const [count, setCount] = createSignal(1)
        const seen: number[] = []
        const stop = effect(() => void seen.push(count()))

        stop()
        setCount(2)

        assert.deepEqual(seen, [1])
    })

    it('should not rerun itself when it changes a signal that it reads', () => {
        const [count, setCount] = createSignal(0)
        let runs = 0

        effect(() => {
            runs += 1
            setCount(count() + 1)
        })

        assert.equal(runs, 1)
        assert.equal(count(), 1)
    })

    it('should keep track of nested effects', () => {
        const [outer, setOuter] = createSignal(0)
        const [inner, setInner] = createSignal(0)
        const seen: string[] = []

        effect(() => {
            const value = outer()

            effect(() => void seen.push(`${value}:${inner()}`))
        })
        setInner(1)

        assert.deepEqual(seen, ['0:0', '0:1'])

        setOuter(1)

        assert.ok(seen.includes('1:1'))
    })
})

describe('computed', () => {
    it('should follow the signals that it reads', () => {
        const [first, setFirst] = createSignal('Ada')
        const [last] = createSignal('Lovelace')
        const [full] = computed(() => `${first()} ${last()}`)

        assert.equal(full(), 'Ada Lovelace')

        setFirst('Grace')

        assert.equal(full(), 'Grace Lovelace')
    })

    it('should work in an effect, and stop when told', () => {
        const [count, setCount] = createSignal(1)
        const [double, stop] = computed(() => count() * 2)
        const seen: number[] = []

        effect(() => void seen.push(double()))
        setCount(2)
        stop()
        setCount(3)

        assert.deepEqual(seen, [2, 4])
    })
})

describe('createLocalStorageSignal', () => {
    beforeEach(() => {
        memory.clear()
        storageBroken = false
    })

    afterEach(() => {
        storageBroken = false
    })

    it('should store and get a value', () => {
        const [signal, setSignal] = createLocalStorageSignal('KEY', 'the initial value')

        setSignal('the updated value')

        assert.equal(signal(), 'the updated value')
        assert.equal(JSON.parse(memory.get('KEY') ?? ''), 'the updated value')
    })

    it('should store a complex object', () => {
        const [signal, setSignal] = createLocalStorageSignal('OBJECT', { value: 'the initial value' })

        setSignal({ value: 'the updated value' })

        assert.deepEqual(signal(), { value: 'the updated value' })
        assert.deepEqual(JSON.parse(memory.get('OBJECT') ?? ''), { value: 'the updated value' })
    })

    it('should not write the initial value before the first set', () => {
        createLocalStorageSignal('UNTOUCHED', 'initial')

        assert.equal(memory.has('UNTOUCHED'), false)
    })

    it('should start with the stored value', () => {
        memory.set('STORED', JSON.stringify({ a: 1 }))

        assert.deepEqual(createLocalStorageSignal('STORED', { a: 0 })[0](), { a: 1 })
    })

    it('should keep falsy and null values that are stored', () => {
        memory.set('NULL', 'null')
        memory.set('ZERO', '0')
        memory.set('FALSE', 'false')

        assert.equal(createLocalStorageSignal<number | null>('NULL', 5)[0](), null)
        assert.equal(createLocalStorageSignal('ZERO', 5)[0](), 0)
        assert.equal(createLocalStorageSignal('FALSE', true)[0](), false)
    })

    it('should use the initial value when the stored text is not JSON', () => {
        memory.set('BROKEN', '{ not json')

        const [signal, setSignal] = createLocalStorageSignal('BROKEN', 'initial')

        assert.equal(signal(), 'initial')

        setSignal('fixed')

        assert.equal(memory.get('BROKEN'), '"fixed"')
    })

    it('should use the initial value when the stored value fails validation', () => {
        const isNumber = (value: unknown): value is number => typeof value === 'number'

        memory.set('TYPED', '"text"')

        assert.equal(createLocalStorageSignal('TYPED', 7, isNumber)[0](), 7)

        memory.set('TYPED', '8')

        assert.equal(createLocalStorageSignal('TYPED', 7, isNumber)[0](), 8)
    })

    it('should work in memory when the storage throws', () => {
        storageBroken = true

        const [signal, setSignal] = createLocalStorageSignal('BLOCKED', 'initial')

        assert.equal(signal(), 'initial')

        setSignal('changed')

        assert.equal(signal(), 'changed')
    })

    it('should work in memory when the storage is full', () => {
        const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')

        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            value: { getItem: () => null, setItem: () => { throw new DOMException('full', 'QuotaExceededError') } },
        })

        const [signal, setSignal] = createLocalStorageSignal('FULL', 'initial')

        setSignal('changed')

        assert.equal(signal(), 'changed')
        Object.defineProperty(globalThis, 'localStorage', original as PropertyDescriptor)
    })

    it('should follow a change that another tab makes, until it is stopped', () => {
        const [signal, , stop] = createLocalStorageSignal('SHARED', 'initial')
        const seen: string[] = []

        effect(() => void seen.push(signal()))

        memory.set('SHARED', '"from another tab"')
        storageEvent('SHARED')
        storageEvent('OTHER')

        assert.deepEqual(seen, ['initial', 'from another tab'])

        memory.delete('SHARED')
        storageEvent(null)

        assert.equal(signal(), 'initial')

        stop()
        memory.set('SHARED', '"late"')
        storageEvent('SHARED')

        assert.equal(signal(), 'initial')
    })
})
