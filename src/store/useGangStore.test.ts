import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MAX_REPUTATION } from '../game/gangProgression'
import {
  GANG_STORAGE_KEY,
  createSafeStorage,
  useGangStore,
} from './useGangStore'

const initialSnapshot = useGangStore.getState()
const BASE_TIME = 1_700_000_000_000

describe('useGangStore initial state', () => {
  it('starts with zero reputation and a finite creation timestamp', () => {
    expect(initialSnapshot.totalReputation).toBe(0)
    expect(Number.isFinite(initialSnapshot.lastUpdatedAt)).toBe(true)
    expect(initialSnapshot.lastUpdatedAt).toBeGreaterThan(0)
  })
})

describe('useGangStore idle sync', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useGangStore.getState().reset(BASE_TIME)
  })

  it('awards five reputation per complete second', () => {
    useGangStore.getState().syncIdleProgress(BASE_TIME + 5_000)

    const state = useGangStore.getState()
    expect(state.totalReputation).toBe(25)
    expect(state.lastUpdatedAt).toBe(BASE_TIME + 5_000)
  })

  it('settles only complete seconds and keeps the sub-second remainder across calls', () => {
    useGangStore.getState().syncIdleProgress(BASE_TIME + 1_500)
    expect(useGangStore.getState().totalReputation).toBe(5)
    expect(useGangStore.getState().lastUpdatedAt).toBe(BASE_TIME + 1_000)

    useGangStore.getState().syncIdleProgress(BASE_TIME + 1_999)
    expect(useGangStore.getState().totalReputation).toBe(5)
    expect(useGangStore.getState().lastUpdatedAt).toBe(BASE_TIME + 1_000)

    useGangStore.getState().syncIdleProgress(BASE_TIME + 2_000)
    expect(useGangStore.getState().totalReputation).toBe(10)
    expect(useGangStore.getState().lastUpdatedAt).toBe(BASE_TIME + 2_000)
  })

  it('caps reputation at the max level and snaps lastUpdatedAt to now beyond eight hours', () => {
    const eightHoursInMs = 28_800 * 1_000

    useGangStore.getState().syncIdleProgress(BASE_TIME + eightHoursInMs)

    const state = useGangStore.getState()
    expect(state.totalReputation).toBe(MAX_REPUTATION)
    expect(state.lastUpdatedAt).toBe(BASE_TIME + eightHoursInMs)
  })

  it('discards time beyond the eight-hour cap and advances lastUpdatedAt directly to now', () => {
    const tenHoursLater = BASE_TIME + 10 * 60 * 60 * 1_000

    useGangStore.getState().syncIdleProgress(tenHoursLater)

    const state = useGangStore.getState()
    expect(state.totalReputation).toBe(MAX_REPUTATION)
    expect(state.lastUpdatedAt).toBe(tenHoursLater)
  })

  it('ignores a non-finite now', () => {
    useGangStore.getState().syncIdleProgress(Number.NaN)
    useGangStore.getState().syncIdleProgress(Number.POSITIVE_INFINITY)

    const state = useGangStore.getState()
    expect(state.totalReputation).toBe(0)
    expect(state.lastUpdatedAt).toBe(BASE_TIME)
  })

  it('ignores a now at or before lastUpdatedAt', () => {
    useGangStore.getState().syncIdleProgress(BASE_TIME)
    useGangStore.getState().syncIdleProgress(BASE_TIME - 1_000)

    const state = useGangStore.getState()
    expect(state.totalReputation).toBe(0)
    expect(state.lastUpdatedAt).toBe(BASE_TIME)
  })

  it('keeps reputation capped while advancing lastUpdatedAt to avoid idle backlog once maxed', () => {
    const eightHoursInMs = 28_800 * 1_000
    useGangStore.getState().syncIdleProgress(BASE_TIME + eightHoursInMs)
    expect(useGangStore.getState().totalReputation).toBe(MAX_REPUTATION)

    const muchLaterNow = BASE_TIME + eightHoursInMs + 3_600_000
    useGangStore.getState().syncIdleProgress(muchLaterNow)

    const state = useGangStore.getState()
    expect(state.totalReputation).toBe(MAX_REPUTATION)
    expect(state.lastUpdatedAt).toBe(muchLaterNow)
  })

  it('resets reputation to zero and applies the provided timestamp', () => {
    useGangStore.getState().syncIdleProgress(BASE_TIME + 5_000)

    useGangStore.getState().reset(BASE_TIME + 100_000)

    const state = useGangStore.getState()
    expect(state.totalReputation).toBe(0)
    expect(state.lastUpdatedAt).toBe(BASE_TIME + 100_000)
  })

  it('falls back to Date.now() when reset receives an invalid timestamp', () => {
    const before = Date.now()
    useGangStore.getState().reset(Number.NaN)
    const after = Date.now()

    const { lastUpdatedAt } = useGangStore.getState()
    expect(lastUpdatedAt).toBeGreaterThanOrEqual(before)
    expect(lastUpdatedAt).toBeLessThanOrEqual(after)
  })
})

describe('useGangStore persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useGangStore.getState().reset(BASE_TIME)
  })

  afterEach(() => {
    useGangStore.getState().reset(BASE_TIME)
    window.localStorage.clear()
  })

  it('persists only totalReputation and lastUpdatedAt under the storage key', () => {
    useGangStore.getState().syncIdleProgress(BASE_TIME + 5_000)

    const raw = window.localStorage.getItem(GANG_STORAGE_KEY)
    expect(raw).not.toBeNull()

    const parsed = JSON.parse(raw as string)
    expect(Object.keys(parsed.state)).toEqual(
      expect.arrayContaining(['totalReputation', 'lastUpdatedAt']),
    )
    expect(Object.keys(parsed.state)).toHaveLength(2)
    expect(parsed.state.totalReputation).toBe(25)
    expect(parsed.state.lastUpdatedAt).toBe(BASE_TIME + 5_000)
  })

  it('uses the documented storage key', () => {
    expect(GANG_STORAGE_KEY).toBe('gang-progression-v1')
  })

  it('rehydrates a persisted timestamp before settling offline progress', async () => {
    const persistedLastUpdatedAt = BASE_TIME - 5_000
    window.localStorage.setItem(
      GANG_STORAGE_KEY,
      JSON.stringify({
        state: {
          totalReputation: 10,
          lastUpdatedAt: persistedLastUpdatedAt,
        },
        version: 0,
      }),
    )

    await useGangStore.persist.rehydrate()

    expect(useGangStore.getState().totalReputation).toBe(10)
    expect(useGangStore.getState().lastUpdatedAt).toBe(persistedLastUpdatedAt)

    useGangStore.getState().syncIdleProgress(BASE_TIME)

    expect(useGangStore.getState().totalReputation).toBe(35)
    expect(useGangStore.getState().lastUpdatedAt).toBe(BASE_TIME)
  })
})

describe('createSafeStorage fallback', () => {
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
