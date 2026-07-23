import type {
  BuildingColorRole,
  BuildingVisualPart,
} from './buildingVisualTypes'

const fixedColors: Readonly<
  Record<Exclude<BuildingColorRole, 'primary' | 'accent'>, string>
> = {
  roof: '#c8c9c7',
  dark: '#2f3438',
  glass: '#78909c',
}

const SCAFFOLD_OPACITY = 0.5

export interface FragmentPartMaterialOptions {
  primaryColor: string
  accentColor: string
  highlighted: boolean
  neon: boolean
  scaffold: boolean
}

export interface FragmentPartMaterial {
  color: string
  emissive: string
  emissiveIntensity: number
  transparent: boolean
  opacity: number
}

// Preserves the pre-fragment material semantics: hover/selection highlight wins,
// otherwise clubhouse neon parts keep their accent glow, and target-added but
// not-yet-built scaffold slots render translucent like the reference video.
export function getFragmentPartMaterial(
  part: BuildingVisualPart,
  {
    primaryColor,
    accentColor,
    highlighted,
    neon,
    scaffold,
  }: FragmentPartMaterialOptions,
): FragmentPartMaterial {
  const color =
    part.colorRole === 'primary'
      ? primaryColor
      : part.colorRole === 'accent'
        ? accentColor
        : fixedColors[part.colorRole]

  // Only the actual neon sign / tube glows. Structural neon supports such as the
  // mounting mast stay unlit.
  const isNeonSign =
    neon && part.tag.includes('neon') && !part.tag.includes('mast')

  return {
    color,
    emissive: highlighted ? '#ffcf70' : isNeonSign ? accentColor : '#000000',
    emissiveIntensity: highlighted ? 0.22 : isNeonSign ? 0.45 : 0,
    transparent: scaffold,
    opacity: scaffold ? SCAFFOLD_OPACITY : 1,
  }
}
