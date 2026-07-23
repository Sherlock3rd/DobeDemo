import { useMemo, type JSX } from 'react'
import type { BuildingDefinition, BuildingProgress } from '../../game/cityTypes'
import { AnimatedBuildingFragment } from './AnimatedBuildingFragment'
import { getRenderedBuildingFragments } from './buildingFragmentCatalog'
import { getFragmentPartMaterial } from './buildingFragmentMaterial'

interface BuildingModelProps {
  definition: BuildingDefinition
  progress: BuildingProgress
  highlighted: boolean
  animatedFragmentId?: string
  animationRun?: number
}

export function BuildingModel({
  definition,
  progress,
  highlighted,
  animatedFragmentId,
  animationRun,
}: BuildingModelProps): JSX.Element {
  const fragments = useMemo(
    () =>
      getRenderedBuildingFragments(
        definition.kind,
        progress,
        animatedFragmentId,
      ),
    [definition.kind, progress, animatedFragmentId],
  )
  const neon = definition.kind === 'clubhouse'

  return (
    <group>
      {fragments.map((fragment) => {
        const scaffold = fragment.state === 'scaffold'

        return (
          <group key={fragment.id} position={fragment.anchor}>
            <AnimatedBuildingFragment
              animate={fragment.animate}
              animationRun={fragment.animate ? animationRun : undefined}
            >
              {fragment.parts.map((part, index) => {
                const material = getFragmentPartMaterial(part, {
                  primaryColor: definition.primaryColor,
                  accentColor: definition.accentColor,
                  highlighted,
                  neon,
                  scaffold,
                })

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
                      color={material.color}
                      emissive={material.emissive}
                      emissiveIntensity={material.emissiveIntensity}
                      transparent={material.transparent}
                      opacity={material.opacity}
                    />
                  </mesh>
                )
              })}
            </AnimatedBuildingFragment>
          </group>
        )
      })}
    </group>
  )
}
