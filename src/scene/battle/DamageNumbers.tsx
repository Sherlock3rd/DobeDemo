import type { JSX } from 'react'
import type { HitEvent } from '../../game/combat/battleEngine'
import { usePrefersReducedMotion } from '../city/usePrefersReducedMotion'

export interface DamageNumbersProps {
  hits: HitEvent[]
}

const DIGIT_SEGMENTS: Record<string, readonly string[]> = {
  '0': ['a', 'b', 'c', 'd', 'e', 'f'],
  '1': ['b', 'c'],
  '2': ['a', 'b', 'g', 'e', 'd'],
  '3': ['a', 'b', 'g', 'c', 'd'],
  '4': ['f', 'g', 'b', 'c'],
  '5': ['a', 'f', 'g', 'c', 'd'],
  '6': ['a', 'f', 'g', 'e', 'c', 'd'],
  '7': ['a', 'b', 'c'],
  '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  '9': ['a', 'b', 'c', 'd', 'f', 'g'],
}

const SEGMENT_LAYOUT: Record<
  string,
  { position: [number, number, number]; size: [number, number, number] }
> = {
  a: { position: [0, 0.24, 0], size: [0.2, 0.035, 0.025] },
  b: { position: [0.1, 0.12, 0], size: [0.035, 0.2, 0.025] },
  c: { position: [0.1, -0.12, 0], size: [0.035, 0.2, 0.025] },
  d: { position: [0, -0.24, 0], size: [0.2, 0.035, 0.025] },
  e: { position: [-0.1, -0.12, 0], size: [0.035, 0.2, 0.025] },
  f: { position: [-0.1, 0.12, 0], size: [0.035, 0.2, 0.025] },
  g: { position: [0, 0, 0], size: [0.2, 0.035, 0.025] },
}

function DamageDigits({
  amount,
  color,
}: {
  amount: number
  color: string
}): JSX.Element {
  const digits = String(Math.max(0, Math.trunc(amount))).split('')
  const width = 0.28
  const start = -((digits.length - 1) * width) / 2
  return (
    <group name={`damage-${amount}`} rotation={[-Math.PI / 2, 0, 0]}>
      {digits.map((digit, digitIndex) => (
        <group
          key={`${digit}-${digitIndex}`}
          position={[start + digitIndex * width, 0, 0]}
        >
          {(DIGIT_SEGMENTS[digit] ?? []).map((segment) => {
            const layout = SEGMENT_LAYOUT[segment]
            return (
              <mesh key={segment} position={layout.position}>
                <boxGeometry args={layout.size} />
                <meshBasicMaterial color={color} toneMapped={false} />
              </mesh>
            )
          })}
        </group>
      ))}
    </group>
  )
}

function hitPosition(hit: HitEvent): [number, number, number] {
  const row = hit.targetGlobalIndex <= 1 ? 'front' : 'back'
  const index =
    hit.targetGlobalIndex <= 1
      ? hit.targetGlobalIndex
      : hit.targetGlobalIndex - 2
  const x =
    row === 'front'
      ? index === 0
        ? -1.5
        : 1.5
      : index === 0
        ? -2.4
        : index === 1
          ? 0
          : 2.4
  const zBase = hit.targetSide === 'ally' ? 2.5 : -2.5
  const z = row === 'front' ? zBase : hit.targetSide === 'ally' ? 3.8 : -3.8
  return [x, 1.6, z]
}

export function DamageNumbers({ hits }: DamageNumbersProps): JSX.Element {
  const reduced = usePrefersReducedMotion()

  return (
    <group>
      {hits.map((hit, i) => {
        const [x, y, z] = hitPosition(hit)
        return (
          <group
            key={`${hit.attackerGlobalIndex}-${hit.targetGlobalIndex}-${i}`}
            position={[x, y + (reduced ? 0 : 0.2), z]}
            userData={{ amount: hit.amount, reduced }}
          >
            <DamageDigits
              amount={hit.amount}
              color={hit.kind === 'basic' ? '#fff3bf' : '#ffd43b'}
            />
          </group>
        )
      })}
    </group>
  )
}
