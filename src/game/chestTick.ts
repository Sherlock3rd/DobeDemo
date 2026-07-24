import { create } from 'zustand'

/** Non-persistent tick used only to refresh derived chest UI. */
export const useChestTick = create<{
  tick: number
  now: number
  increment: () => void
}>((set) => ({
  tick: 0,
  now: 0,
  increment: () =>
    set((s) => ({
      tick: s.tick + 1,
      now: Date.now(),
    })),
}))
