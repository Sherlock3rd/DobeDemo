import { describe, expect, it } from 'vitest'
import {
  PROLOGUE_STEPS,
  PROLOGUE_TUNED_PART_ID,
  getPrologueVisibility,
  isPrologueAtLeast,
  isPrologueStep,
  isTutorialPartInstalled,
} from './prologue'

describe('prologue progression', () => {
  it('keeps every step ordered and rejects unknown persisted values', () => {
    expect(PROLOGUE_STEPS[0]).toBe('opening-dialogue')
    expect(PROLOGUE_STEPS.at(-1)).toBe('complete')
    expect(isPrologueStep('borrowed-shooting')).toBe(true)
    expect(isPrologueStep('formal-promotion')).toBe(true)
    expect(isPrologueStep('chapter-briefing')).toBe(true)
    expect(isPrologueStep('recycling-takeover')).toBe(true)
    expect(isPrologueStep('unknown')).toBe(false)
    expect(isPrologueAtLeast('prospect-tasks', 'part-tutorial')).toBe(true)
    expect(isPrologueAtLeast('police-race', 'part-tutorial')).toBe(false)
  })

  it('reveals only the systems earned by the current prologue step', () => {
    expect(getPrologueVisibility('opening-dialogue')).toEqual({
      heroes: false,
      heroLevel: false,
      car: false,
      gun: false,
      gangTree: false,
      chapters: false,
      campaign: false,
    })
    expect(getPrologueVisibility('part-tutorial')).toMatchObject({
      heroes: true,
      car: true,
      gun: false,
      gangTree: false,
      campaign: false,
    })
    expect(getPrologueVisibility('prospect-tasks')).toMatchObject({
      heroes: true,
      gun: false,
      gangTree: true,
      chapters: true,
      campaign: false,
    })
    expect(getPrologueVisibility('gun-gift').gun).toBe(true)
    expect(getPrologueVisibility('chapter-briefing')).toMatchObject({
      gangTree: true,
      chapters: true,
      campaign: false,
    })
    expect(getPrologueVisibility('recycling-takeover').campaign).toBe(false)
    expect(getPrologueVisibility('complete')).toEqual({
      heroes: true,
      heroLevel: true,
      car: true,
      gun: true,
      gangTree: true,
      chapters: true,
      campaign: true,
    })
  })

  it('recognizes only the gifted engine as the tutorial replacement', () => {
    expect(isTutorialPartInstalled(PROLOGUE_TUNED_PART_ID)).toBe(true)
    expect(isTutorialPartInstalled('prologue-broken-engine')).toBe(false)
    expect(isTutorialPartInstalled(null)).toBe(false)
  })
})
