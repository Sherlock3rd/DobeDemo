import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type JSX, type ReactNode } from 'react'
import type { Group, PointLight } from 'three'
import { FRAGMENT_GLOW_COLOR } from './buildingFragmentAnimation'
import {
  applyFragmentFrame,
  FRAGMENT_GLOW_DISTANCE,
  FragmentAnimationController,
  snapFragmentRest,
} from './fragmentAnimationController'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

interface AnimatedBuildingFragmentProps {
  animate: boolean
  children: ReactNode
}

// Transform-only entrance wrapper. useFrame writes just the inner group
// scale/y and a dedicated green feedback light — it never mutates the fragment's
// own highlight/neon materials, and never writes React or Zustand state.
export function AnimatedBuildingFragment({
  animate,
  children,
}: AnimatedBuildingFragmentProps): JSX.Element {
  const groupRef = useRef<Group>(null)
  const feedbackRef = useRef<PointLight>(null)
  const controllerRef = useRef<FragmentAnimationController | null>(null)
  if (controllerRef.current === null) {
    controllerRef.current = new FragmentAnimationController()
  }
  const reducedMotion = usePrefersReducedMotion()

  // Restart on every animate transition so the same stable fragment instance can
  // replay its entrance at a later level. Interrupted fragments snap to rest
  // right away instead of waiting for a frame to observe animate=false.
  useLayoutEffect(() => {
    const controller = controllerRef.current
    controller?.reset()
    if (!animate) {
      snapFragmentRest(groupRef.current, feedbackRef.current)
    }
  }, [animate])

  useFrame((state) => {
    const controller = controllerRef.current
    if (!controller) {
      return
    }

    applyFragmentFrame(
      groupRef.current,
      feedbackRef.current,
      controller,
      state.clock.elapsedTime,
      animate,
      reducedMotion,
    )
  })

  return (
    <group ref={groupRef}>
      {animate && (
        <pointLight
          ref={feedbackRef}
          color={FRAGMENT_GLOW_COLOR}
          intensity={0}
          distance={FRAGMENT_GLOW_DISTANCE}
          decay={2}
        />
      )}
      {children}
    </group>
  )
}
