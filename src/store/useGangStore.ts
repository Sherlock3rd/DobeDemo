import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  GANG_MAX_LEVEL,
  GANG_MIN_LEVEL,
  MAX_REPUTATION,
  getGangLevel,
  getGangRole,
  getTotalReputationForLevel,
} from '../game/gangProgression'
import { createSafeStorage } from './safeStorage'

// Re-exported for API/back-compat: existing imports and tests reference
// `createSafeStorage` from this module. The implementation now lives in
// ./safeStorage so the city store can share it.
export { createSafeStorage }

export const GANG_STORAGE_KEY = 'gang-progression-v1'

interface GangState {
  totalReputation: number
  currentLevel: number
  lastUpdatedAt: number
  addReputation: (amount: number, now: number) => boolean
  promoteOneLevel: (
    now: number,
    currentChapterComplete: boolean,
  ) => GangPromotionResult
  advanceOneLevel: (now: number) => void
  unlockForDebug: (now: number) => void
  reset: (now: number) => void
}

export interface GangPromotionResult {
  applied: boolean
  reason:
    | 'ready'
    | 'invalid-request'
    | 'max-level'
    | 'insufficient-reputation'
    | 'chapter-incomplete'
}

function normalizeCurrentLevel(
  value: unknown,
  fallbackReputation: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return getGangLevel(fallbackReputation)
  }
  return Math.min(GANG_MAX_LEVEL, Math.max(GANG_MIN_LEVEL, Math.trunc(value)))
}

export const useGangStore = create<GangState>()(
  persist(
    (set, get) => ({
      totalReputation: 0,
      currentLevel: GANG_MIN_LEVEL,
      lastUpdatedAt: Date.now(),
      addReputation: (amount, now) => {
        if (
          !Number.isSafeInteger(amount) ||
          amount <= 0 ||
          !Number.isFinite(now)
        ) {
          return false
        }
        set((state) => ({
          totalReputation: Math.min(
            MAX_REPUTATION,
            state.totalReputation + amount,
          ),
          lastUpdatedAt: Math.max(state.lastUpdatedAt, now),
        }))
        return true
      },
      promoteOneLevel: (now, currentChapterComplete) => {
        if (!Number.isFinite(now)) {
          return { applied: false, reason: 'invalid-request' }
        }
        const { currentLevel, totalReputation } = get()
        if (currentLevel >= GANG_MAX_LEVEL) {
          return { applied: false, reason: 'max-level' }
        }
        const nextLevel = currentLevel + 1
        if (totalReputation < getTotalReputationForLevel(nextLevel)) {
          return { applied: false, reason: 'insufficient-reputation' }
        }
        const crossesRole =
          getGangRole(currentLevel).threshold !==
          getGangRole(nextLevel).threshold
        if (crossesRole && !currentChapterComplete) {
          return { applied: false, reason: 'chapter-incomplete' }
        }
        set({ currentLevel: nextLevel, lastUpdatedAt: now })
        return { applied: true, reason: 'ready' }
      },
      advanceOneLevel: (now) => {
        if (!Number.isFinite(now)) return
        const { currentLevel, totalReputation } = get()
        if (currentLevel >= GANG_MAX_LEVEL) return
        const nextLevel = currentLevel + 1
        set({
          totalReputation: Math.max(
            totalReputation,
            getTotalReputationForLevel(nextLevel),
          ),
          currentLevel: nextLevel,
          lastUpdatedAt: now,
        })
      },
      unlockForDebug: (now) => {
        if (!Number.isFinite(now)) {
          return
        }
        set({
          totalReputation: MAX_REPUTATION,
          currentLevel: GANG_MAX_LEVEL,
          lastUpdatedAt: now,
        })
      },
      reset: (now) => {
        set({
          totalReputation: 0,
          currentLevel: GANG_MIN_LEVEL,
          lastUpdatedAt: Number.isFinite(now) ? now : Date.now(),
        })
      },
    }),
    {
      name: GANG_STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (persisted) => {
        const source =
          typeof persisted === 'object' && persisted !== null
            ? (persisted as {
                totalReputation?: unknown
                currentLevel?: unknown
                lastUpdatedAt?: unknown
              })
            : {}
        const totalReputation =
          typeof source.totalReputation === 'number' &&
          Number.isFinite(source.totalReputation)
            ? Math.min(MAX_REPUTATION, Math.max(0, source.totalReputation))
            : 0
        return {
          totalReputation,
          currentLevel: normalizeCurrentLevel(
            source.currentLevel,
            totalReputation,
          ),
          lastUpdatedAt:
            typeof source.lastUpdatedAt === 'number' &&
            Number.isFinite(source.lastUpdatedAt)
              ? source.lastUpdatedAt
              : Date.now(),
        }
      },
      partialize: (state) => ({
        totalReputation: state.totalReputation,
        currentLevel: state.currentLevel,
        lastUpdatedAt: state.lastUpdatedAt,
      }),
    },
  ),
)
