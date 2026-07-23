import { describe, expect, it } from 'vitest'
import { createSafeStorage } from './safeStorage'

function createThrowingStorage(): Storage {
  return {
    length: 0,
    clear: () => {
      throw new Error('storage unavailable')
    },
    key: () => {
      throw new Error('storage unavailable')
    },
    getItem: () => {
      throw new Error('storage unavailable')
    },
    setItem: () => {
      throw new Error('storage unavailable')
    },
    removeItem: () => {
      throw new Error('storage unavailable')
    },
  }
}

describe('createSafeStorage fallback', () => {
  it('falls back to an in-memory store when the underlying storage throws', () => {
    const safeStorage = createSafeStorage(() => createThrowingStorage())

    expect(safeStorage.getItem('missing')).toBeNull()

    safeStorage.setItem('key', 'value')
    expect(safeStorage.getItem('key')).toBe('value')

    safeStorage.removeItem('key')
    expect(safeStorage.getItem('key')).toBeNull()
  })

  it('sticks to the same memory store after only setItem throws', () => {
    const readableValues = new Map<string, string>()
    const partiallyFailingStorage: Storage = {
      length: 0,
      clear: () => readableValues.clear(),
      key: () => null,
      getItem: (name) => readableValues.get(name) ?? null,
      setItem: () => {
        throw new Error('storage is read-only')
      },
      removeItem: (name) => {
        readableValues.delete(name)
      },
    }
    const safeStorage = createSafeStorage(() => partiallyFailingStorage)

    safeStorage.setItem('key', 'memory-value')

    expect(safeStorage.getItem('key')).toBe('memory-value')
    safeStorage.removeItem('key')
    expect(safeStorage.getItem('key')).toBeNull()
  })

  it('sticks to the same memory store after only getItem throws', () => {
    let failGet = true
    const backing = new Map<string, string>()
    const partiallyFailingStorage: Storage = {
      length: 0,
      clear: () => backing.clear(),
      key: () => null,
      getItem: (name) => {
        if (failGet) {
          throw new Error('storage read failed once')
        }
        return backing.get(name) ?? null
      },
      setItem: (name, value) => {
        backing.set(name, value)
      },
      removeItem: (name) => {
        backing.delete(name)
      },
    }
    const safeStorage = createSafeStorage(() => partiallyFailingStorage)

    expect(safeStorage.getItem('key')).toBeNull()
    failGet = false

    safeStorage.setItem('key', 'memory-value')
    expect(safeStorage.getItem('key')).toBe('memory-value')
    expect(backing.has('key')).toBe(false)
  })

  it('sticks to the same memory store after only removeItem throws', () => {
    const backing = new Map<string, string>()
    const partiallyFailingStorage: Storage = {
      length: 0,
      clear: () => backing.clear(),
      key: () => null,
      getItem: (name) => backing.get(name) ?? null,
      setItem: (name, value) => {
        backing.set(name, value)
      },
      removeItem: () => {
        throw new Error('storage remove failed')
      },
    }
    const safeStorage = createSafeStorage(() => partiallyFailingStorage)

    safeStorage.removeItem('key')

    safeStorage.setItem('key', 'memory-value')
    expect(safeStorage.getItem('key')).toBe('memory-value')
    expect(backing.has('key')).toBe(false)
  })

  it('falls back to an in-memory store when accessing the storage itself throws', () => {
    const safeStorage = createSafeStorage(() => {
      throw new Error('window.localStorage is unavailable')
    })

    safeStorage.setItem('key', 'value')
    expect(safeStorage.getItem('key')).toBe('value')

    safeStorage.removeItem('key')
    expect(safeStorage.getItem('key')).toBeNull()
  })

  it('uses the real storage when it is available', () => {
    window.localStorage.clear()
    const safeStorage = createSafeStorage(() => window.localStorage)

    safeStorage.setItem('probe-key', 'probe-value')
    expect(window.localStorage.getItem('probe-key')).toBe('probe-value')
    expect(safeStorage.getItem('probe-key')).toBe('probe-value')

    safeStorage.removeItem('probe-key')
    expect(window.localStorage.getItem('probe-key')).toBeNull()
  })
})
