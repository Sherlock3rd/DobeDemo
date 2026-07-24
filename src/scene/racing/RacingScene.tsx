import type { JSX } from 'react'
import { equipmentConfig } from '../../config/equipmentConfig'
import { nextObstacle, type RaceState } from '../../game/racing/raceEngine'
import type { CarId, GunId } from '../../game/equipmentTypes'

export interface RacingSceneProps {
  state: RaceState
  carId: CarId
  gunId: GunId | null
}

const LANE_X = [-3.2, 0, 3.2] as const

function Car({
  color,
  accent,
  position,
  enemy = false,
  armed = false,
}: {
  color: string
  accent: string
  position: [number, number, number]
  enemy?: boolean
  armed?: boolean
}): JSX.Element {
  return (
    <group position={position} rotation={[0, enemy ? Math.PI : 0, 0]}>
      <mesh castShadow>
        <boxGeometry args={[2.15, 0.55, 3.8]} />
        <meshStandardMaterial color={color} roughness={0.62} />
      </mesh>
      <mesh position={[0, 0.55, -0.15]} castShadow>
        <boxGeometry args={[1.6, 0.62, 1.7]} />
        <meshStandardMaterial color={accent} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.6, enemy ? 2.1 : -2.1]}>
        <boxGeometry args={[1.7, 0.18, 0.12]} />
        <meshStandardMaterial
          color={enemy ? '#f04444' : '#f7e85b'}
          emissive={enemy ? '#8e1212' : '#b18c11'}
          emissiveIntensity={1.5}
        />
      </mesh>
      {armed ? (
        <mesh position={[0, 1.05, -0.2]} castShadow>
          <boxGeometry args={[0.18, 0.18, 1.7]} />
          <meshStandardMaterial color="#24292c" metalness={0.8} />
        </mesh>
      ) : null}
      {[-0.92, 0.92].flatMap((x) =>
        [-1.22, 1.22].map((z) => (
          <mesh
            key={`${x}:${z}`}
            position={[x, -0.28, z]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.36, 0.36, 0.28, 12]} />
            <meshStandardMaterial color="#111316" />
          </mesh>
        )),
      )}
    </group>
  )
}

export function RacingScene({
  state,
  carId,
  gunId,
}: RacingSceneProps): JSX.Element {
  const appearance = equipmentConfig.cars[carId].appearance
  const roadOffset = state.distance % 12
  const obstacle = nextObstacle(state)
  const obstacleGap = obstacle.distance - state.distance
  return (
    <>
      <color attach="background" args={['#171d24']} />
      <fog attach="fog" args={['#171d24', 24, 72]} />
      <hemisphereLight args={['#a9c7d6', '#1e1a18', 1.2]} />
      <directionalLight position={[8, 16, 8]} intensity={2.4} castShadow />
      <group>
        <mesh position={[0, -0.55, -28]} receiveShadow>
          <boxGeometry args={[11, 0.25, 90]} />
          <meshStandardMaterial color="#292d31" roughness={0.95} />
        </mesh>
        {[-5.4, 5.4].map((x) => (
          <mesh key={x} position={[x, -0.36, -28]}>
            <boxGeometry args={[0.22, 0.22, 90]} />
            <meshStandardMaterial color="#d9a128" />
          </mesh>
        ))}
        {[-1.6, 1.6].flatMap((x) =>
          Array.from({ length: 9 }, (_, index) => {
            const z = 6 - index * 12 + roadOffset
            return (
              <mesh key={`${x}:${index}`} position={[x, -0.34, z]}>
                <boxGeometry args={[0.11, 0.06, 5.5]} />
                <meshStandardMaterial color="#d9dad5" />
              </mesh>
            )
          }),
        )}
        <Car
          color={appearance.body}
          accent={appearance.accent}
          position={[LANE_X[state.lane], 0, 3]}
          armed={gunId !== null}
        />
        {state.opponents.map((distance, index) => {
          const gap = distance - state.distance
          return (
            <Car
              key={index}
              color={index === 0 ? '#a43e32' : '#3d5d87'}
              accent="#c7cbd0"
              position={[
                LANE_X[((index + state.stage) % 3) as 0 | 1 | 2],
                0,
                Math.min(18, Math.max(-58, 3 - gap)),
              ]}
            />
          )
        })}
        {state.mode === 'pursuit' ? (
          <Car
            color="#8b2529"
            accent="#16181b"
            position={[
              LANE_X[state.targetLane],
              0,
              Math.min(
                18,
                Math.max(-58, 3 - (state.targetDistance - state.distance)),
              ),
            ]}
            enemy
            armed
          />
        ) : null}
        {obstacleGap > -4 && obstacleGap < 65 ? (
          <group
            position={[LANE_X[obstacle.lane], 0, Math.min(18, 3 - obstacleGap)]}
          >
            <mesh castShadow>
              <boxGeometry args={[1.5, 1.1, 0.7]} />
              <meshStandardMaterial color="#d17128" />
            </mesh>
            <mesh position={[0, 0.12, 0.36]}>
              <boxGeometry args={[1.55, 0.2, 0.05]} />
              <meshStandardMaterial color="#f6d45a" />
            </mesh>
          </group>
        ) : null}
      </group>
    </>
  )
}
