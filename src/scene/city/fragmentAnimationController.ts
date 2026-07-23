import {
  BUILDING_FRAGMENT_ANIMATION_MS,
  getFragmentAnimationTransform,
  type FragmentAnimationTransform,
} from './buildingFragmentAnimation'

// Peak intensity of the independent green feedback light at the start of an
// entrance. The light is purely a visual cue and never mutates the fragment's
// own highlight / neon materials.
export const FRAGMENT_GLOW_MAX_INTENSITY = 3
export const FRAGMENT_GLOW_DISTANCE = 6

const REST: FragmentAnimationTransform = { scale: 1, yOffset: 0, glow: 0 }

// Minimal structural targets so the frame writer can be unit tested with plain
// objects and stays decoupled from the concrete three.js classes.
export interface FragmentTransformTarget {
  scale: { setScalar(value: number): void }
  position: { y: number }
}

export interface FragmentFeedbackTarget {
  intensity: number
}

// Owns the per-fragment animation clock. Kept outside the component so the
// interruption/replay/finish behaviour is deterministic and unit testable. It
// holds no React or Zustand state.
export class FragmentAnimationController {
  private startSeconds: number | null = null

  // Force the next animating frame to restart from the entrance pose. Driven by
  // the component's animate-prop transition effect, so replays never depend on a
  // stray animate=false frame arriving first.
  reset(): void {
    this.startSeconds = null
  }

  sample(
    nowSeconds: number,
    animate: boolean,
    reducedMotion: boolean,
  ): FragmentAnimationTransform {
    if (!animate) {
      this.startSeconds = null
      return REST
    }

    if (this.startSeconds === null) {
      this.startSeconds = nowSeconds
    }

    if (reducedMotion) {
      return REST
    }

    const elapsedMs = (nowSeconds - this.startSeconds) * 1000
    if (elapsedMs >= BUILDING_FRAGMENT_ANIMATION_MS) {
      return REST
    }

    return getFragmentAnimationTransform(elapsedMs, false)
  }
}

// Snaps a fragment to its resting pose. Used by the animate-prop transition
// effect so an interrupted fragment settles immediately, independent of frames.
// The feature checks keep it safe when a ref is not yet backed by a three.js
// object (e.g. before attachment, or in a DOM test renderer).
export function snapFragmentRest(
  group: FragmentTransformTarget | null,
  feedback: FragmentFeedbackTarget | null,
): void {
  if (group && typeof group.scale?.setScalar === 'function') {
    group.scale.setScalar(1)
    group.position.y = 0
  }
  if (feedback && typeof feedback.intensity === 'number') {
    feedback.intensity = 0
  }
}

// The only thing useFrame does: sample the controller and write the result to
// the inner group transform and the dedicated feedback light. Never touches the
// business materials and never writes React/Zustand state.
export function applyFragmentFrame(
  group: FragmentTransformTarget | null,
  feedback: FragmentFeedbackTarget | null,
  controller: FragmentAnimationController,
  nowSeconds: number,
  animate: boolean,
  reducedMotion: boolean,
): void {
  const { scale, yOffset, glow } = controller.sample(
    nowSeconds,
    animate,
    reducedMotion,
  )

  if (group) {
    group.scale.setScalar(scale)
    group.position.y = yOffset
  }

  if (feedback) {
    feedback.intensity = glow * FRAGMENT_GLOW_MAX_INTENSITY
  }
}
