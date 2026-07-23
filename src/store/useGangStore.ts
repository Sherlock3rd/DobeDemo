import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  MAX_REPUTATION,
  calculateIdleSettlement,
} from '../game/gangProgression'
import { createSafeStorage } from './safeStorage'

// Re-exported for API/back-compat: existing imports and tests reference
// `createSafeStorage` from this module. The implementation now lives in
// ./safeStorage so the city store can share it.
export { createSafeStorage }

export const GANG_STORAGE_KEY = 'gang-progression-v1'

interface GangState {
  totalReputation: number
  lastUpdatedAt: number
  syncIdleProgress: (now: number) => void
  reset: (now: number) => void
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
