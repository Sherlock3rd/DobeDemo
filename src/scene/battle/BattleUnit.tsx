import type { JSX } from 'react'
import type { HeroAppearance } from '../../config/heroesConfig'
import type { UnitSnapshot } from '../../game/combat/battleEngine'
import { usePrefersReducedMotion } from '../city/usePrefersReducedMotion'
import { appearanceForUnit, slotWorldPosition } from './battleUnitAppearance'

export interface BattleUnitProps {
  unit: UnitSnapshot
  appearance?: HeroAppearance
  acting?: boolean
}

function WeaponMeshes({
  weapon,
  accent,
}: {
  weapon: HeroAppearance['weapon']
  accent: string
}): JSX.Element {
  if (weapon === 'shotgun') {
    return (
      <mesh position={[0.45, 0.1, 0.35]}>
        <boxGeometry args={[0.55, 0.12, 0.12]} />
        <meshStandardMaterial color={accent} />
      </mesh>
    )
  }
  if (weapon === 'rifle') {
    return (
      <mesh position={[0.55, 0.15, 0.2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.9, 6]} />
        <meshStandardMaterial color={accent} />
      </mesh>
    )
  }
  return (
    <group>
      <mesh position={[-0.45, 0.1, 0.2]}>
        <boxGeometry args={[0.55, 0.7, 0.08]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      <mesh position={[0.5, 0.2, 0.15]}>
        <boxGeometry args={[0.15, 0.7, 0.15]} />
        <meshStandardMaterial color="#444" />
      </mesh>
    </group>
  )
}

export function BattleUnit({
  unit,
  appearance,
  acting = false,
}: BattleUnitProps): JSX.Element {
  const reduced = usePrefersReducedMotion()
  const look = appearance ?? appearanceForUnit(unit)
  const [x, y, z] = slotWorldPosition(unit)
  const actionOffset =
    acting && unit.alive ? (unit.side === 'ally' ? -0.45 : 0.45) : 0
  const hpRatio = unit.maxHp > 0 ? Math.max(0, unit.hp / unit.maxHp) : 0
  const bodyScale =
    look.silhouette === 'bulk' ? 1.2 : look.silhouette === 'slim' ? 0.85 : 1

  return (
    <group
      position={[x, y, z + actionOffset]}
      rotation={unit.alive ? [0, 0, 0] : [Math.PI / 2, 0, 0]}
      userData={{
        silhouette: look.silhouette,
        weapon: look.weapon,
        tween: reduced ? 'none' : 'smooth',
        acting,
      }}
    >
      <mesh
        scale={[bodyScale, bodyScale, bodyScale]}
        userData={{
          silhouette: look.silhouette,
          weapon: look.weapon,
        }}
      >
        {look.silhouette === 'capsule' ? (
          <capsuleGeometry args={[0.28, 0.55, 4, 8]} />
        ) : look.silhouette === 'slim' ? (
          <capsuleGeometry args={[0.2, 0.75, 4, 8]} />
        ) : (
          <boxGeometry args={[0.7, 0.9, 0.45]} />
        )}
        <meshStandardMaterial color={look.primaryColor} />
      </mesh>
      <mesh position={[0, 0.55 * bodyScale, 0]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color={look.accentColor} />
      </mesh>
      <WeaponMeshes weapon={look.weapon} accent={look.accentColor} />
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[0.7, 0.08, 0.08]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[-(0.35 - 0.35 * hpRatio), 1.15, 0.02]}>
        <boxGeometry args={[0.7 * hpRatio, 0.06, 0.06]} />
        <meshStandardMaterial color={unit.alive ? '#69db7c' : '#868e96'} />
      </mesh>
    </group>
  )
}
