export const BUILDING_FRAGMENT_ANIMATION_MS = 400

const FRAGMENT_START_SCALE = 0.78
const FRAGMENT_START_Y_OFFSET = -0.35

// Bright green entrance glow, matching the reference video's upgrade sweep.
export const FRAGMENT_GLOW_COLOR = '#39ff8f'

export interface FragmentAnimationTransform {
  scale: number
  yOffset: number
  glow: number
}

// Pure entrance easing: scale 0.78 -> 1, y -0.35 -> 0, green glow 1 -> 0 across
// BUILDING_FRAGMENT_ANIMATION_MS. Reduced motion lands on the resting pose
// immediately. Deterministic in its inputs so it is trivial to unit test.
export function getFragmentAnimationTransform(
  elapsedMs: number,
  reducedMotion: boolean,
): FragmentAnimationTransform {
  if (reducedMotion) {
    return { scale: 1, yOffset: 0, glow: 0 }
  }

  const progress = Math.min(
    1,
    Math.max(0, elapsedMs / BUILDING_FRAGMENT_ANIMATION_MS),
  )

  return {
    scale: FRAGMENT_START_SCALE + (1 - FRAGMENT_START_SCALE) * progress,
    yOffset: FRAGMENT_START_Y_OFFSET * (1 - progress),
    glow: 1 - progress,
  }
}
