import type { JSX } from 'react'

interface LockedBuildingPlotProps {
  footprint: readonly [number, number]
  highlighted: boolean
}

const FOUNDATION_HEIGHT = 0.32
const POST_HEIGHT = 1.15
const POST_RADIUS = 0.11
const TAPE_HEIGHT = 0.06
const TAPE_THICKNESS = 0.14
const LOCK_BODY_SIZE: readonly [number, number, number] = [0.9, 0.85, 0.5]
const LOCK_SHACKLE_RADIUS = 0.14
const LOCK_SHACKLE_LEG_HEIGHT = 0.6
const LOCK_SHACKLE_SPAN = 0.55

const DARK_BASE = '#2b2d30'
const DARK_ACCENT = '#1f2123'
const LOCK_METAL = '#3a3d40'
const IDLE_EMISSIVE = '#000000'
const WARN_COLOR_A = '#4a4d40'
const WARN_COLOR_B = '#c8901f'
const HIGHLIGHT_EMISSIVE = '#ffb703'

export function LockedBuildingPlot({
  footprint,
  highlighted,
}: LockedBuildingPlotProps): JSX.Element {
  const [width, depth] = footprint
  const halfWidth = width / 2
  const halfDepth = depth / 2
  const cornerInset = 0.35
  const cornerPositions: readonly [number, number][] = [
    [halfWidth - cornerInset, halfDepth - cornerInset],
    [-(halfWidth - cornerInset), halfDepth - cornerInset],
    [halfWidth - cornerInset, -(halfDepth - cornerInset)],
    [-(halfWidth - cornerInset), -(halfDepth - cornerInset)],
  ]
  const diagonalLength = Math.sqrt(width * width + depth * depth) * 0.94
  const lockEmissive = highlighted ? HIGHLIGHT_EMISSIVE : IDLE_EMISSIVE
  const lockEmissiveIntensity = highlighted ? 0.65 : 0

  return (
    <group>
      <mesh position={[0, FOUNDATION_HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width * 0.92, FOUNDATION_HEIGHT, depth * 0.92]} />
        <meshStandardMaterial
          color={DARK_BASE}
          emissive={IDLE_EMISSIVE}
          roughness={0.95}
        />
      </mesh>

      {cornerPositions.map(([x, z], index) => (
        <mesh
          key={`corner-post-${index}`}
          position={[x, POST_HEIGHT / 2, z]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[POST_RADIUS, POST_RADIUS, POST_HEIGHT, 8]} />
          <meshStandardMaterial color={DARK_ACCENT} emissive={IDLE_EMISSIVE} />
        </mesh>
      ))}

      <mesh
        position={[0, POST_HEIGHT * 0.62, 0]}
        rotation={[0, Math.PI / 4, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[diagonalLength, TAPE_HEIGHT, TAPE_THICKNESS]} />
        <meshStandardMaterial color={WARN_COLOR_A} emissive={IDLE_EMISSIVE} />
      </mesh>
      <mesh
        position={[0, POST_HEIGHT * 0.62, 0]}
        rotation={[0, -Math.PI / 4, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[diagonalLength, TAPE_HEIGHT, TAPE_THICKNESS]} />
        <meshStandardMaterial color={WARN_COLOR_B} emissive={IDLE_EMISSIVE} />
      </mesh>

      <group position={[0, FOUNDATION_HEIGHT + 0.55, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={LOCK_BODY_SIZE} />
          <meshStandardMaterial
            color={LOCK_METAL}
            emissive={lockEmissive}
            emissiveIntensity={lockEmissiveIntensity}
          />
        </mesh>
        <mesh
          position={[
            -LOCK_SHACKLE_SPAN / 2,
            LOCK_BODY_SIZE[1] / 2 + LOCK_SHACKLE_LEG_HEIGHT / 2,
            0,
          ]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry
            args={[
              LOCK_SHACKLE_RADIUS,
              LOCK_SHACKLE_RADIUS,
              LOCK_SHACKLE_LEG_HEIGHT,
              10,
            ]}
          />
          <meshStandardMaterial
            color={LOCK_METAL}
            emissive={lockEmissive}
            emissiveIntensity={lockEmissiveIntensity}
          />
        </mesh>
        <mesh
          position={[
            LOCK_SHACKLE_SPAN / 2,
            LOCK_BODY_SIZE[1] / 2 + LOCK_SHACKLE_LEG_HEIGHT / 2,
            0,
          ]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry
            args={[
              LOCK_SHACKLE_RADIUS,
              LOCK_SHACKLE_RADIUS,
              LOCK_SHACKLE_LEG_HEIGHT,
              10,
            ]}
          />
          <meshStandardMaterial
            color={LOCK_METAL}
            emissive={lockEmissive}
            emissiveIntensity={lockEmissiveIntensity}
          />
        </mesh>
        <mesh
          position={[0, LOCK_BODY_SIZE[1] / 2 + LOCK_SHACKLE_LEG_HEIGHT, 0]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry
            args={[
              LOCK_SHACKLE_RADIUS,
              LOCK_SHACKLE_RADIUS,
              LOCK_SHACKLE_SPAN,
              10,
            ]}
          />
          <meshStandardMaterial
            color={LOCK_METAL}
            emissive={lockEmissive}
            emissiveIntensity={lockEmissiveIntensity}
          />
        </mesh>
      </group>
    </group>
  )
}
