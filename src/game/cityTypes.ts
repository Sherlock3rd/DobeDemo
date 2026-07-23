export const BUILDING_IDS = [
  'repair-shop',
  'recycling-yard',
  'commercial-street',
  'metalworking-plant',
  'gas-station',
  'clubhouse',
] as const

export type BuildingId = (typeof BUILDING_IDS)[number]
export const BUILDING_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
export type BuildingLevel = (typeof BUILDING_LEVELS)[number]
export type BuildingKind =
  'repair' | 'recycling' | 'commercial' | 'metalworking' | 'gas' | 'clubhouse'

export interface BuildingProgress {
  level: BuildingLevel
  completedFragments: number
}

export interface BuildingDefinition {
  id: BuildingId
  name: string
  kind: BuildingKind
  footprint: readonly [number, number]
  primaryColor: string
  accentColor: string
  levelSummary: readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ]
}
