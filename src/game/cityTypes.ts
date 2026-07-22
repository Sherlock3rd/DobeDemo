export const BUILDING_IDS = [
  'repair-shop',
  'recycling-yard',
  'commercial-street',
  'metalworking-plant',
  'gas-station',
  'clubhouse',
] as const

export type BuildingId = (typeof BUILDING_IDS)[number]
export type BuildingLevel = 1 | 2 | 3
export type BuildingKind =
  'repair' | 'recycling' | 'commercial' | 'metalworking' | 'gas' | 'clubhouse'

export interface BuildingDefinition {
  id: BuildingId
  name: string
  kind: BuildingKind
  footprint: readonly [number, number]
  primaryColor: string
  accentColor: string
  levelSummary: readonly [string, string, string]
}
