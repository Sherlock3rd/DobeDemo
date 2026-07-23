import type { StateStorage } from 'zustand/middleware'

/**
 * Shared persistence storage that transparently falls back to an in-memory
 * store the first time the underlying storage throws (private mode, quota,
 * disabled cookies, SSR, etc.). Once it falls back it stays sticky so reads and
 * writes remain consistent within the session.
 */
export function createSafeStorage(
  getStorage: () => Storage = () => window.localStorage,
): StateStorage {
  const memoryStore = new Map<string, string>()
  let useMemoryStore = false

  const withFallback = <T>(
    operation: (storage: Storage) => T,
    fallback: () => T,
  ): T => {
    if (useMemoryStore) {
      return fallback()
    }

    try {
      return operation(getStorage())
    } catch {
      useMemoryStore = true
      return fallback()
    }
  }

  return {
    getItem: (name) =>
      withFallback(
        (storage) => storage.getItem(name),
        () => memoryStore.get(name) ?? null,
      ),
    setItem: (name, value) =>
      withFallback(
        (storage) => {
          storage.setItem(name, value)
        },
        () => {
          memoryStore.set(name, value)
        },
      ),
    removeItem: (name) =>
      withFallback(
        (storage) => {
          storage.removeItem(name)
        },
        () => {
          memoryStore.delete(name)
        },
      ),
  }
}
