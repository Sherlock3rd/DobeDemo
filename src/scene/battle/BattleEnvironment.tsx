import type { JSX } from 'react'

const SLOT_MARKERS: ReadonlyArray<{
  side: 'ally' | 'enemy'
  x: number
  z: number
}> = [
  { side: 'ally', x: -1.5, z: 2.2 },
  { side: 'ally', x: 1.5, z: 2.2 },
  { side: 'ally', x: -2.4, z: 3.8 },
  { side: 'ally', x: 0, z: 3.8 },
  { side: 'ally', x: 2.4, z: 3.8 },
  { side: 'enemy', x: -1.5, z: -2.2 },
  { side: 'enemy', x: 1.5, z: -2.2 },
  { side: 'enemy', x: -2.4, z: -3.8 },
  { side: 'enemy', x: 0, z: -3.8 },
  { side: 'enemy', x: 2.4, z: -3.8 },
]

export function BattleEnvironment(): JSX.Element {
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        userData={{ role: 'battle-ground' }}
      >
        <planeGeometry args={[16, 14]} />
        <meshStandardMaterial color="#3a4550" />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 0.12]} />
        <meshStandardMaterial color="#ffd43b" />
      </mesh>
      {SLOT_MARKERS.map((slot) => (
        <mesh
          key={`${slot.side}-${slot.x}-${slot.z}`}
          position={[slot.x, 0.03, slot.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.55, 0.7, 4]} />
          <meshStandardMaterial
            color={slot.side === 'ally' ? '#74c0fc' : '#ffa94d'}
            transparent
            opacity={0.55}
          />
        </mesh>
      ))}
      <ambientLight intensity={0.65} />
      <directionalLight position={[4, 10, 2]} intensity={1.1} castShadow />
    </group>
  )
}
