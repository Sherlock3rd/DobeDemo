import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, type JSX } from 'react'
import type { Group } from 'three'
import type { HitEvent } from '../../game/combat/battleEngine'
import type { Side } from '../../game/combat/targeting'
import { usePrefersReducedMotion } from '../city/usePrefersReducedMotion'
import { BattleEffectAnimationController } from './battleAnimationController'

export interface BattleEffectEvent {
  hit: HitEvent
  eventKey: number
  eventIndex: number
}

export interface BattleEffectsProps {
  events: readonly BattleEffectEvent[]
  currentEventKey: number
  onPresented?: (frame: BattlePresentationFrame) => void
}

export interface BattlePresentationFrame {
  eventKey: number
  basicActive: boolean
  skillActive: boolean
  visibleEvents: number
}

function combatantWorldPosition(
  side: Side,
  globalIndex: number,
): [number, number, number] {
  const front = globalIndex <= 1
  const rowIndex = front ? globalIndex : globalIndex - 2
  const x = front
    ? rowIndex === 0
      ? -1.5
      : 1.5
    : rowIndex === 0
      ? -2.4
      : rowIndex === 1
        ? 0
        : 2.4
  const sideDirection = side === 'ally' ? 1 : -1
  return [x, 1.05, sideDirection * (front ? 2.2 : 3.8)]
}

function pointBetween(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  amount: number,
): [number, number, number] {
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount,
  ]
}

function SkillTrail({
  hit,
  from,
  to,
  trailRef,
}: {
  hit: HitEvent
  from: readonly [number, number, number]
  to: readonly [number, number, number]
  trailRef: React.RefObject<Group | null>
}): JSX.Element {
  const midpoint = pointBetween(from, to, 0.5)
  const dx = to[0] - from[0]
  const dz = to[2] - from[2]
  const distance = Math.hypot(dx, dz)
  const rotationY = Math.atan2(dx, dz)
  const main = hit.kind === 'skill-main'

  return (
    <group
      ref={trailRef}
      name={main ? 'skill-main-golden-volley' : 'skill-splash-golden-trail'}
      position={midpoint}
      rotation={[0, rotationY, 0]}
    >
      {(main ? [-0.13, 0, 0.13] : [0]).map((offset) => (
        <mesh key={offset} position={[offset, 0, 0]}>
          <boxGeometry args={[main ? 0.07 : 0.045, 0.05, distance]} />
          <meshBasicMaterial
            color={main ? '#ffd43b' : '#ffe066'}
            transparent
            opacity={main ? 0.9 : 0.72}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

function HitEffect({
  hit,
  reducedMotion,
}: {
  hit: HitEvent
  reducedMotion: boolean
}): JSX.Element {
  const effectRef = useRef<Group>(null)
  const muzzleRef = useRef<Group>(null)
  const impactRef = useRef<Group>(null)
  const trailRef = useRef<Group>(null)
  const controllerRef = useRef<BattleEffectAnimationController | null>(null)
  if (controllerRef.current === null) {
    controllerRef.current = new BattleEffectAnimationController()
  }

  const from = combatantWorldPosition(hit.attackerSide, hit.attackerGlobalIndex)
  const to = combatantWorldPosition(hit.targetSide, hit.targetGlobalIndex)
  const muzzlePosition = pointBetween(from, to, 0.14)
  const skill = hit.kind !== 'basic'

  useFrame((state) => {
    const frame = controllerRef.current?.step(
      state.clock.elapsedTime,
      hit.kind,
      reducedMotion,
    )
    if (!frame) {
      return
    }
    if (effectRef.current) {
      effectRef.current.visible = frame.visible
    }
    muzzleRef.current?.scale.setScalar(frame.muzzleScale)
    impactRef.current?.scale.setScalar(frame.impactScale)
    if (trailRef.current) {
      trailRef.current.scale.z = frame.trailProgress
    }
  })

  return (
    <group ref={effectRef}>
      <group
        ref={muzzleRef}
        name={skill ? 'skill-muzzle-flash' : 'basic-muzzle-flash'}
        position={muzzlePosition}
      >
        <mesh>
          {skill ? (
            <octahedronGeometry args={[0.2, 0]} />
          ) : (
            <sphereGeometry args={[0.13, 6, 6]} />
          )}
          <meshBasicMaterial
            color={skill ? '#ffd43b' : '#fff3bf'}
            toneMapped={false}
          />
        </mesh>
        <pointLight
          color={skill ? '#ffd43b' : '#fff3bf'}
          intensity={skill ? 3.5 : 2.2}
          distance={skill ? 4 : 2.5}
        />
      </group>

      {skill && !reducedMotion && (
        <SkillTrail hit={hit} from={from} to={to} trailRef={trailRef} />
      )}

      <group
        ref={impactRef}
        name={skill ? `skill-impact-${hit.kind}` : 'basic-impact-flash'}
        position={to}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          {skill ? (
            <torusGeometry args={[0.28, 0.07, 6, 16]} />
          ) : (
            <octahedronGeometry args={[0.16, 0]} />
          )}
          <meshBasicMaterial
            color={skill ? '#ffd43b' : '#ffffff'}
            transparent
            opacity={0.9}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  )
}

export function BattleEffects({
  events,
  currentEventKey,
  onPresented,
}: BattleEffectsProps): JSX.Element {
  const reducedMotion = usePrefersReducedMotion()
  const visibleEvents = reducedMotion
    ? events.filter((event) => event.eventKey === currentEventKey)
    : events
  const basicActive = visibleEvents.some(({ hit }) => hit.kind === 'basic')
  const skillActive = visibleEvents.some(({ hit }) => hit.kind !== 'basic')

  useEffect(() => {
    onPresented?.({
      eventKey: currentEventKey,
      basicActive,
      skillActive,
      visibleEvents: visibleEvents.length,
    })
  }, [
    basicActive,
    currentEventKey,
    onPresented,
    skillActive,
    visibleEvents.length,
  ])

  return (
    <group>
      {visibleEvents.map(({ hit, eventKey, eventIndex }) => (
        <HitEffect
          key={`${eventKey}-${hit.attackerSide}-${hit.attackerGlobalIndex}-${hit.targetGlobalIndex}-${eventIndex}`}
          hit={hit}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  )
}
