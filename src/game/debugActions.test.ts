import { beforeEach, describe, expect, it } from 'vitest'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { useAdventureStore } from '../store/useAdventureStore'
import {
  grantAllResourcesForDebug,
  unlockGangTreeForDebug,
} from './debugActions'

const START = 1_700_000_000_000
const UNLOCK_TIME = START + 80_000_000

describe('debug action coordinators', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useCityStore.getState().reset(START)
    useCityStore.getState().claimBuilding('repair-shop', 1, START)
    useGangStore.getState().reset(START)
    useAdventureStore.getState().reset(START)
  })

  it('settles claimed producers without auto-taking over new buildings', () => {
    expect(unlockGangTreeForDebug(UNLOCK_TIME)).toBe(true)

    expect(useGangStore.getState()).toMatchObject({
      totalReputation: 1470,
      lastUpdatedAt: UNLOCK_TIME,
    })
    expect(useCityStore.getState()).toMatchObject({
      resources: { money: 12_880, oil: 0, materials: 0 },
      lastResourceUpdatedAt: UNLOCK_TIME,
      activeProducerIds: ['repair-shop'],
      claimedBuildingIds: ['repair-shop'],
    })
    expect(useAdventureStore.getState()).toMatchObject({
      chapterUnlockedCarIds: ['iron-fang', 'black-throne'],
      chapterUnlockedGunIds: ['industrial-carbine'],
    })
  })

  it('keeps repeated gang unlocks at the same now idempotent', () => {
    unlockGangTreeForDebug(UNLOCK_TIME)
    const cityAfterFirstClick = useCityStore.getState()

    expect(unlockGangTreeForDebug(UNLOCK_TIME)).toBe(true)

    expect(useCityStore.getState().resources).toEqual(
      cityAfterFirstClick.resources,
    )
    expect(useCityStore.getState().lastResourceUpdatedAt).toBe(UNLOCK_TIME)
    expect(useGangStore.getState()).toMatchObject({
      totalReputation: 1470,
      lastUpdatedAt: UNLOCK_TIME,
    })
  })

  it('rejects a non-finite gang unlock without changing either store', () => {
    const cityBefore = useCityStore.getState()
    const gangBefore = useGangStore.getState()

    expect(unlockGangTreeForDebug(Number.NaN)).toBe(false)

    expect(useCityStore.getState()).toBe(cityBefore)
    expect(useGangStore.getState()).toBe(gangBefore)
  })

  it('settles production and cumulatively grants all resources', () => {
    expect(grantAllResourcesForDebug(START + 10_000)).toBe(true)
    expect(grantAllResourcesForDebug(START + 10_000)).toBe(true)

    expect(useCityStore.getState().resources).toEqual({
      money: 30_001,
      oil: 20_000,
      materials: 20_000,
    })
  })

  it('rejects a non-finite resource grant without changing the city store', () => {
    const before = useCityStore.getState()

    expect(grantAllResourcesForDebug(Number.POSITIVE_INFINITY)).toBe(false)

    expect(useCityStore.getState()).toBe(before)
  })
})
