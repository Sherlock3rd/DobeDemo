import type { JSX } from 'react'
import {
  environmentBuildingPlacements,
  treePlacements,
  vehiclePlacements,
  type CityPlacement,
} from '../../game/cityLayout'

function Warehouse({ placement }: { placement: CityPlacement }): JSX.Element {
  const [width, depth] = placement.size

  return (
    <group
      position={placement.position}
      rotation={[0, placement.rotation ?? 0, 0]}
    >
      <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 1.7, depth]} />
        <meshStandardMaterial color="#a5aaa7" />
      </mesh>
      <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.2, depth]} />
        <meshStandardMaterial color="#d1d2cc" />
      </mesh>
    </group>
  )
}

function Vehicle({
  placement,
  index,
}: {
  placement: CityPlacement
  index: number
}): JSX.Element {
  const [length, width] = placement.size
  const isTruck = index % 3 === 0

  return (
    <group
      position={[placement.position[0], 0.18, placement.position[2]]}
      rotation={[0, placement.rotation ?? 0, 0]}
    >
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, 0.36, width]} />
        <meshStandardMaterial color={isTruck ? '#9b9e99' : '#a85a43'} />
      </mesh>
      <mesh
        position={[isTruck ? -length * 0.18 : 0, 0.45, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[isTruck ? length * 0.55 : length * 0.58, 0.34, width * 0.82]}
        />
        <meshStandardMaterial color={isTruck ? '#d2d2cb' : '#67777b'} />
      </mesh>
    </group>
  )
}

function Tree({ placement }: { placement: CityPlacement }): JSX.Element {
  const crownRadius = placement.size[0] * 0.45

  return (
    <group position={placement.position}>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.11, 0.15, 1.1, 8]} />
        <meshStandardMaterial color="#66513c" />
      </mesh>
      <mesh position={[0, 1.35, 0]} castShadow receiveShadow>
        <sphereGeometry args={[crownRadius, 12, 8]} />
        <meshStandardMaterial color="#4e6b50" />
      </mesh>
    </group>
  )
}

export function CityEnvironment(): JSX.Element {
  return (
    <group>
      {environmentBuildingPlacements.map((placement, index) => (
        <Warehouse key={`warehouse-${index}`} placement={placement} />
      ))}
      {vehiclePlacements.map((placement, index) => (
        <Vehicle key={`vehicle-${index}`} placement={placement} index={index} />
      ))}
      {treePlacements.map((placement, index) => (
        <Tree key={`tree-${index}`} placement={placement} />
      ))}
    </group>
  )
}
