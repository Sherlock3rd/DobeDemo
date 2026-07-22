import { create } from 'zustand'
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from 'zustand/middleware'
import {
  MAX_REPUTATION,
  calculateIdleSettlement,
} from '../game/gangProgression'

export const GANG_STORAGE_KEY = 'gang-progression-v1'

interface GangState {
  totalReputation: number
  lastUpdatedAt: number
  syncIdleProgress: (now: number) => void
  reset: (now: number) => void
}

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

export const useGangStore = create<GangState>()(
  persist(
    (set, get) => ({
      totalReputation: 0,
      lastUpdatedAt: Date.now(),
      syncIdleProgress: (now) => {
        if (!Number.isFinite(now)) {
          return
        }

        const { totalReputation, lastUpdatedAt } = get()

        if (now <= lastUpdatedAt) {
          return
        }

        if (totalReputation >= MAX_REPUTATION) {
          set({ totalReputation: MAX_REPUTATION, lastUpdatedAt: now })
          return
        }

        const settlement = calculateIdleSettlement(lastUpdatedAt, now)

        if (settlement.nextUpdatedAt === lastUpdatedAt) {
          return
        }

        set({
          totalReputation: Math.min(
            totalReputation + settlement.earnedReputation,
            MAX_REPUTATION,
          ),
          lastUpdatedAt: settlement.nextUpdatedAt,
        })
      },
      reset: (now) => {
        set({
          totalReputation: 0,
          lastUpdatedAt: Number.isFinite(now) ? now : Date.now(),
        })
      },
    }),
    {
      name: GANG_STORAGE_KEY,
      storage: createJSONStorage(() => createSafeStorage()),
      partialize: (state) => ({
        totalReputation: state.totalReputation,
        lastUpdatedAt: state.lastUpdatedAt,
      }),
    },
  ),
)
