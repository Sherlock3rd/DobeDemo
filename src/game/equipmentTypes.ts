export const CAR_IDS = [
  'rust-fox',
  'iron-fang',
  'neon-bee',
  'road-wolf',
  'black-throne',
] as const

export const GUN_IDS = [
  'rivet-smg',
  'double-barrel',
  'industrial-carbine',
  'road-machine-gun',
  'president-cannon',
] as const

export type CarId = (typeof CAR_IDS)[number]
export type GunId = (typeof GUN_IDS)[number]

export interface HeroEquipment {
  carId: CarId | null
  gunId: GunId | null
}

export type EquipmentByHero = Record<HeroId, HeroEquipment>

export function isCarId(value: string): value is CarId {
  return CAR_IDS.some((id) => id === value)
}

export function isGunId(value: string): value is GunId {
  return GUN_IDS.some((id) => id === value)
}
import type { HeroId } from './heroes'
