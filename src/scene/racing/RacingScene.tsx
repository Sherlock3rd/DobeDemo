import { useFrame } from '@react-three/fiber'
import { useRef, type JSX } from 'react'
import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { equipmentConfig } from '../../config/equipmentConfig'
import type { CarId, GunId } from '../../game/equipmentTypes'
import {
  upcomingTrackFeatures,
  type RaceEffect,
  type RaceState,
  type VehicleState,
} from '../../game/racing/raceEngine'

export interface RacingSceneProps {
  state: RaceState
  carId: CarId
  gunId: GunId | null
}

const PLAYER_SCENE_Z = 0

function RacingCameraRig({ state }: { state: RaceState }): null {
  const target = useRef(new Vector3(0, 0.8, -24))
  const desired = useRef(new Vector3())

  useFrame((frameState) => {
    const activeCamera = frameState.camera
    const speedRatio = Math.min(1, state.player.speed / 60)
    const boostLift = Math.min(18, state.player.airborneHeight)
    const boostFov = state.player.superBoosting
      ? 11
      : state.player.boosting
        ? 5
        : 0
    const impact =
      state.event?.type === 'collision' || state.event?.type === 'incoming'
        ? 0.32
        : 0
    const shake =
      impact > 0
        ? Math.sin((state.event?.id ?? 0) * 8.3 + state.elapsedMs * 0.04) *
          impact
        : 0
    desired.current.set(
      shake,
      16 + speedRatio * 3 + boostLift * 0.72,
      27 + speedRatio * 2.5 + boostLift * 0.2,
    )
    activeCamera.position.lerp(desired.current, 0.14)
    target.current.set(0, 0.65 + boostLift * 0.58, -30 - speedRatio * 14)
    activeCamera.lookAt(target.current)
    if (activeCamera instanceof PerspectiveCamera) {
      activeCamera.fov = MathUtils.lerp(
        activeCamera.fov,
        46 + speedRatio * 8 + boostFov,
        0.09,
      )
      activeCamera.updateProjectionMatrix()
    }
  })
  return null
}

function Wheel({
  x,
  z,
  spin,
}: {
  x: number
  z: number
  spin: number
}): JSX.Element {
  return (
    <mesh position={[x, -0.29, z]} rotation={[spin, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.38, 0.38, 0.3, 12]} />
      <meshStandardMaterial color="#0a0c0f" roughness={0.9} />
    </mesh>
  )
}

function VehicleModel({
  vehicle,
  playerDistance,
  armed,
}: {
  vehicle: VehicleState
  playerDistance: number
  armed: boolean
}): JSX.Element | null {
  if (vehicle.durability <= 0) return null
  const appearance = equipmentConfig.cars[vehicle.carId].appearance
  const relativeZ = PLAYER_SCENE_Z - (vehicle.distance - playerDistance)
  if (relativeZ < -185 || relativeZ > 28) return null
  const spin = vehicle.distance * 0.65
  const bodyRoll = MathUtils.clamp(
    -vehicle.lateralVelocity * 0.035,
    -0.22,
    0.22,
  )
  const damaged = vehicle.durability / vehicle.maxDurability < 0.38
  return (
    <group
      position={[vehicle.x, vehicle.airborneHeight + 0.12, relativeZ]}
      rotation={[vehicle.stuntAngle, vehicle.yaw, bodyRoll]}
      userData={{
        vehicleId: vehicle.id,
        role: vehicle.role,
        drift: vehicle.driftActive,
        airborne: vehicle.airborneHeight > 0,
      }}
    >
      <mesh castShadow>
        <boxGeometry args={[2.2, 0.62, 4]} />
        <meshStandardMaterial
          color={appearance.body}
          roughness={0.55}
          metalness={0.2}
        />
      </mesh>
      <mesh position={[0, 0.58, -0.12]} castShadow>
        <boxGeometry args={[1.62, 0.66, 1.78]} />
        <meshStandardMaterial color={appearance.accent} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.15, 2.03]}>
        <boxGeometry args={[1.74, 0.18, 0.12]} />
        <meshStandardMaterial
          color="#f44747"
          emissive="#9c1717"
          emissiveIntensity={1.7}
        />
      </mesh>
      <mesh position={[0, 0.18, -2.03]}>
        <boxGeometry args={[1.72, 0.18, 0.12]} />
        <meshStandardMaterial
          color="#fff18a"
          emissive="#c8a821"
          emissiveIntensity={1.5}
        />
      </mesh>
      {armed ? (
        <group position={[0, 1.03, -0.3]}>
          <mesh castShadow>
            <boxGeometry args={[0.28, 0.25, 1.8]} />
            <meshStandardMaterial color="#20262b" metalness={0.85} />
          </mesh>
          <mesh position={[0, 0, -1.05]}>
            <cylinderGeometry args={[0.07, 0.07, 0.75, 8]} />
            <meshStandardMaterial color="#101417" metalness={0.95} />
          </mesh>
        </group>
      ) : null}
      <Wheel x={-0.95} z={-1.28} spin={spin} />
      <Wheel x={0.95} z={-1.28} spin={spin} />
      <Wheel x={-0.95} z={1.28} spin={spin} />
      <Wheel x={0.95} z={1.28} spin={spin} />
      {vehicle.driftActive ? (
        <>
          <mesh position={[-0.88, -0.12, 2.35]}>
            <sphereGeometry args={[0.42, 8, 6]} />
            <meshStandardMaterial color="#d6d9dd" transparent opacity={0.42} />
          </mesh>
          <mesh position={[0.88, -0.12, 2.35]}>
            <sphereGeometry args={[0.42, 8, 6]} />
            <meshStandardMaterial color="#d6d9dd" transparent opacity={0.42} />
          </mesh>
        </>
      ) : null}
      {vehicle.boosting ? (
        <group
          name={vehicle.superBoosting ? 'super-nitro-trail' : 'nitro-trail'}
        >
          {[-0.64, 0.64].map((x) => (
            <group key={x} position={[x, 0.05, 2.7]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry
                  args={[
                    vehicle.superBoosting ? 0.34 : 0.22,
                    vehicle.superBoosting ? 4.8 : 2.8,
                    10,
                  ]}
                />
                <meshBasicMaterial
                  color={vehicle.superBoosting ? '#c084fc' : '#38bdf8'}
                  transparent
                  opacity={0.88}
                  toneMapped={false}
                />
              </mesh>
              <pointLight
                color={vehicle.superBoosting ? '#d8b4fe' : '#7dd3fc'}
                intensity={vehicle.superBoosting ? 5 : 2.8}
                distance={vehicle.superBoosting ? 9 : 5}
              />
            </group>
          ))}
          {vehicle.superBoosting ? (
            <>
              {[0, 1.4, 2.8].map((offset) => (
                <mesh
                  key={offset}
                  position={[0, 0.1, 3.2 + offset]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <torusGeometry args={[1.25 + offset * 0.08, 0.07, 8, 24]} />
                  <meshBasicMaterial
                    color="#e9d5ff"
                    transparent
                    opacity={0.62 - offset * 0.1}
                    toneMapped={false}
                  />
                </mesh>
              ))}
            </>
          ) : null}
        </group>
      ) : null}
      {damaged ? (
        <mesh position={[0.45, 1.4, 0.8]}>
          <sphereGeometry args={[0.48, 8, 6]} />
          <meshStandardMaterial color="#596068" transparent opacity={0.58} />
        </mesh>
      ) : null}
    </group>
  )
}

function TrackEffect({
  effect,
  playerDistance,
}: {
  effect: RaceEffect
  playerDistance: number
}): JSX.Element | null {
  const z = PLAYER_SCENE_Z - (effect.distance - playerDistance)
  if (z < -145 || z > 32) return null
  const color =
    effect.type === 'smoke'
      ? '#cbd1d5'
      : effect.type === 'nitro'
        ? '#38bdf8'
        : effect.type === 'super-nitro'
          ? '#c084fc'
          : effect.type === 'explosion'
            ? '#ff5a2e'
            : effect.type === 'landing'
              ? '#d4b17a'
              : '#ffd43b'
  const size =
    effect.type === 'explosion'
      ? 1.4 * effect.intensity
      : effect.type === 'super-nitro'
        ? 0.7 * effect.intensity
        : 0.2 + effect.intensity * 0.24
  return (
    <group position={[effect.x, 0.45, z]}>
      {Array.from(
        { length: effect.type === 'explosion' ? 8 : 4 },
        (_, index) => (
          <mesh
            key={index}
            position={[
              Math.sin(index * 2.4) * size,
              (index % 3) * size * 0.42,
              Math.cos(index * 1.7) * size,
            ]}
          >
            <sphereGeometry args={[size * 0.28, 6, 5]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={effect.type === 'smoke' ? 0 : 1.8}
              transparent
              opacity={Math.min(0.9, effect.ttlMs / 450)}
            />
          </mesh>
        ),
      )}
    </group>
  )
}

function Ramp({ x, z }: { x: number; z: number }): JSX.Element {
  return (
    <group position={[x, 0.2, z]}>
      <mesh rotation={[-0.2, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.7, 0.35, 5.4]} />
        <meshStandardMaterial color="#bc6b2c" roughness={0.82} />
      </mesh>
      {[-0.8, 0, 0.8].map((stripe) => (
        <mesh
          key={stripe}
          position={[stripe, 0.38, -0.1]}
          rotation={[-0.2, 0, 0]}
        >
          <boxGeometry args={[0.28, 0.04, 5.25]} />
          <meshStandardMaterial
            color="#ffd43b"
            emissive="#8c6711"
            emissiveIntensity={0.7}
          />
        </mesh>
      ))}
    </group>
  )
}

export function RacingScene({
  state,
  carId,
  gunId,
}: RacingSceneProps): JSX.Element {
  const roadOffset = state.player.distance % 12
  const features = upcomingTrackFeatures(state)
  const allVehicles = [state.player, ...state.vehicles]
  const speedRatio = Math.min(1, state.player.speed / 60)
  const nitroIntensity = state.player.superBoosting
    ? 1
    : state.player.boosting
      ? 0.55
      : 0
  return (
    <>
      <RacingCameraRig state={state} />
      <color attach="background" args={['#121820']} />
      <fog attach="fog" args={['#121820', 68, 205]} />
      <hemisphereLight args={['#b8d5e2', '#211d1a', 1.4]} />
      <directionalLight position={[10, 22, 12]} intensity={2.7} castShadow />
      <group>
        <mesh position={[0, -0.55, -83]} receiveShadow>
          <boxGeometry args={[11.5, 0.28, 215]} />
          <meshStandardMaterial color="#292e34" roughness={0.96} />
        </mesh>
        {[-5.55, 5.55].map((x) => (
          <mesh key={x} position={[x, -0.36, -83]}>
            <boxGeometry args={[0.22, 0.22, 215]} />
            <meshStandardMaterial
              color="#d9a128"
              emissive="#71500b"
              emissiveIntensity={0.4}
            />
          </mesh>
        ))}
        {[-1.62, 1.62].flatMap((x) =>
          Array.from({ length: 20 }, (_, index) => {
            const z = 15 - index * 12 + roadOffset
            return (
              <mesh key={`${x}:${index}`} position={[x, -0.34, z]}>
                <boxGeometry args={[0.12, 0.06, 5.6]} />
                <meshStandardMaterial color="#e6e7e3" />
              </mesh>
            )
          }),
        )}
        {features.map((feature) => {
          const z = PLAYER_SCENE_Z - (feature.distance - state.player.distance)
          const x = [-3.25, 0, 3.25][feature.lane]
          return feature.kind === 'ramp' ? (
            <Ramp key={`ramp-${feature.index}`} x={x} z={z} />
          ) : (
            <group key={`obstacle-${feature.index}`} position={[x, 0, z]}>
              <mesh castShadow>
                <boxGeometry args={[1.65, 1.15, 0.75]} />
                <meshStandardMaterial color="#d17128" />
              </mesh>
              <mesh position={[0, 0.12, 0.4]}>
                <boxGeometry args={[1.7, 0.2, 0.05]} />
                <meshStandardMaterial
                  color="#f6d45a"
                  emissive="#866e16"
                  emissiveIntensity={0.7}
                />
              </mesh>
            </group>
          )
        })}
        {allVehicles.map((vehicle) => (
          <VehicleModel
            key={vehicle.id}
            vehicle={
              vehicle.role === 'player' ? { ...vehicle, carId } : vehicle
            }
            playerDistance={state.player.distance}
            armed={
              state.mode === 'pursuit' &&
              (vehicle.role !== 'player' || gunId !== null)
            }
          />
        ))}
        {state.projectiles.map((projectile) => {
          const z =
            PLAYER_SCENE_Z - (projectile.distance - state.player.distance)
          return (
            <group key={projectile.id} position={[projectile.x, 1.12, z]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.055, 0.055, 1.5, 6]} />
                <meshStandardMaterial
                  color={projectile.owner === 'player' ? '#ffe066' : '#ff5c5c'}
                  emissive={
                    projectile.owner === 'player' ? '#ffd43b' : '#e03131'
                  }
                  emissiveIntensity={3}
                />
              </mesh>
              <pointLight
                color={projectile.owner === 'player' ? '#ffd43b' : '#ff4d4d'}
                intensity={1.6}
                distance={4}
              />
            </group>
          )
        })}
        {state.effects.map((effect) => (
          <TrackEffect
            key={effect.id}
            effect={effect}
            playerDistance={state.player.distance}
          />
        ))}
        {Array.from(
          { length: Math.round(4 + speedRatio * 8 + nitroIntensity * 10) },
          (_, index) => (
            <mesh
              key={`speed-${index}`}
              position={[
                index % 2 === 0
                  ? -5.1 + (index % 3) * 0.3
                  : 5.1 - (index % 3) * 0.3,
                0.3 + (index % 4) * 0.28,
                -10 - index * (10 - nitroIntensity * 3) + roadOffset,
              ]}
            >
              <boxGeometry
                args={[
                  0.035 + nitroIntensity * 0.018,
                  0.035 + nitroIntensity * 0.018,
                  3 + speedRatio * 7 + nitroIntensity * 10,
                ]}
              />
              <meshBasicMaterial
                color={state.player.superBoosting ? '#e9d5ff' : '#b8ddf0'}
                transparent
                opacity={0.18 + speedRatio * 0.32 + nitroIntensity * 0.22}
              />
            </mesh>
          ),
        )}
      </group>
    </>
  )
}
