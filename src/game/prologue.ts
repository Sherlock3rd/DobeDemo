import type { CarPartInstance } from './equipmentTypes'

export const PROLOGUE_STEPS = [
  'opening-dialogue',
  'police-race',
  'bo-invitation',
  'garage-dialogue',
  'part-tutorial',
  'ambush-dialogue',
  'escape-race',
  'prospect-invitation',
  'borrowed-shooting',
  'tasks-dialogue',
  'prospect-tasks',
  'gun-gift',
  'gun-race',
  'gang-dialogue',
  'gang-training',
  'meeting',
  'complete',
] as const

export type PrologueStep = (typeof PROLOGUE_STEPS)[number]

export const PROLOGUE_BROKEN_PART_ID = 'prologue-broken-engine'
export const PROLOGUE_TUNED_PART_ID = 'prologue-tuned-engine'

export const PROLOGUE_BROKEN_PART: CarPartInstance = {
  id: PROLOGUE_BROKEN_PART_ID,
  slot: 'engine',
  quality: 'common',
  level: 1,
}

export const PROLOGUE_TUNED_PART: CarPartInstance = {
  id: PROLOGUE_TUNED_PART_ID,
  slot: 'engine',
  quality: 'rare',
  level: 1,
}

export const PROLOGUE_TASK_IDS = [
  'chapter-1-prologue-claim',
  'chapter-1-prologue-upgrade',
  'chapter-1-prologue-part',
] as const

export function isPrologueStep(value: unknown): value is PrologueStep {
  return (
    typeof value === 'string' &&
    PROLOGUE_STEPS.some((candidate) => candidate === value)
  )
}

export function prologueStepIndex(step: PrologueStep): number {
  return PROLOGUE_STEPS.indexOf(step)
}

export function isPrologueAtLeast(
  step: PrologueStep,
  threshold: PrologueStep,
): boolean {
  return prologueStepIndex(step) >= prologueStepIndex(threshold)
}

export interface PrologueVisibility {
  heroes: boolean
  heroLevel: boolean
  car: boolean
  gun: boolean
  gangTree: boolean
  chapters: boolean
  campaign: boolean
}

export function getPrologueVisibility(step: PrologueStep): PrologueVisibility {
  const complete = step === 'complete'
  return {
    heroes: isPrologueAtLeast(step, 'part-tutorial'),
    heroLevel: complete,
    car: isPrologueAtLeast(step, 'part-tutorial'),
    gun: isPrologueAtLeast(step, 'gun-gift'),
    gangTree: isPrologueAtLeast(step, 'prospect-tasks'),
    chapters: isPrologueAtLeast(step, 'prospect-tasks'),
    campaign: complete,
  }
}

export function isTutorialPartInstalled(
  installedEnginePartId: string | null,
): boolean {
  return installedEnginePartId === PROLOGUE_TUNED_PART_ID
}
