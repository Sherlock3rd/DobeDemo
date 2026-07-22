import type { JSX } from 'react'
import {
  CITY_BOUNDS,
  lotPlacements,
  riverPlacements,
  roadPlacements,
  type CityPlacement,
} from '../../game/cityLayout'

interface SurfaceProps {
  placement: CityPlacement
  color: string
  y: number
}

function Surface({ placement, color, y }: SurfaceProps): JSX.Element {
  return (
    <group
      position={[placement.position[0], y, placement.position[2]]}
      rotation={[0, placement.rotation ?? 0, 0]}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={placement.size} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

export function CityGround(): JSX.Element {
  const cityWidth = CITY_BOUNDS.maxX - CITY_BOUNDS.minX
  const cityDepth = CITY_BOUNDS.maxZ - CITY_BOUNDS.minZ
  const cityCenterX = (CITY_BOUNDS.minX + CITY_BOUNDS.maxX) / 2
  const cityCenterZ = (CITY_BOUNDS.minZ + CITY_BOUNDS.maxZ) / 2

  return (
    <group>
      <mesh
        position={[cityCenterX, -0.04, cityCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[cityWidth, cityDepth]} />
        <meshStandardMaterial color="#66735d" />
      </mesh>

      {lotPlacements.map((placement, index) => (
        <Surface
          key={`lot-${index}`}
          placement={placement}
          color="#777875"
          y={0}
        />
      ))}
      {roadPlacements.map((placement, index) => (
        <Surface
          key={`road-${index}`}
          placement={placement}
          color="#34393b"
          y={0.025}
        />
      ))}
      {riverPlacements.map((placement, index) => (
        <Surface
          key={`river-${index}`}
          placement={placement}
          color="#397d80"
          y={0.04}
        />
      ))}
    </group>
  )
}
