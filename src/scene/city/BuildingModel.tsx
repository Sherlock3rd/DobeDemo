import type { JSX } from 'react'
import type { BuildingDefinition, BuildingLevel } from '../../game/cityTypes'
import {
  getBuildingVisualStage,
  type BuildingColorRole,
} from './buildingVisualConfig'

interface BuildingModelProps {
  definition: BuildingDefinition
  level: BuildingLevel
  highlighted: boolean
}

const fixedColors: Readonly<
  Record<Exclude<BuildingColorRole, 'primary' | 'accent'>, string>
> = {
  roof: '#c8c9c7',
  dark: '#2f3438',
  glass: '#78909c',
}

export function BuildingModel({
  definition,
  level,
  highlighted,
}: BuildingModelProps): JSX.Element {
  const stage = getBuildingVisualStage(definition.kind, level)
  const colors: Readonly<Record<BuildingColorRole, string>> = {
    primary: definition.primaryColor,
    accent: definition.accentColor,
    ...fixedColors,
  }

  return (
    <group>
      {stage.map((part, index) => {
        const isNeonSign =
          definition.kind === 'clubhouse' &&
          (part.tag === 'clubhouse-sign' || part.tag === 'neon-sign')

        return (
          <mesh
            key={`${part.tag}-${index}`}
            position={part.position}
            rotation={part.rotation}
            castShadow
            receiveShadow
          >
            {part.shape === 'box' ? (
              <boxGeometry args={part.size} />
            ) : (
              <cylinderGeometry
                args={[part.radius, part.radius, part.height, 16]}
              />
            )}
            <meshStandardMaterial
              color={colors[part.colorRole]}
              emissive={
                highlighted
                  ? '#ffcf70'
                  : isNeonSign
                    ? definition.accentColor
                    : '#000000'
              }
              emissiveIntensity={highlighted ? 0.22 : isNeonSign ? 0.45 : 0}
            />
          </mesh>
        )
      })}
    </group>
  )
}
