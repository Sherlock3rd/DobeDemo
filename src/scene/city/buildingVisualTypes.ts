export type BuildingColorRole = 'primary' | 'accent' | 'roof' | 'dark' | 'glass'

export interface BoxVisualPart {
  shape: 'box'
  tag: string
  position: readonly [number, number, number]
  size: readonly [number, number, number]
  rotation?: readonly [number, number, number]
  colorRole: BuildingColorRole
}

export interface CylinderVisualPart {
  shape: 'cylinder'
  tag: string
  position: readonly [number, number, number]
  radius: number
  height: number
  rotation?: readonly [number, number, number]
  colorRole: BuildingColorRole
}

export type BuildingVisualPart = BoxVisualPart | CylinderVisualPart
