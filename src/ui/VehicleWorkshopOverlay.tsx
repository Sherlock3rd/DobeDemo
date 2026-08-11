import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState, type JSX } from 'react'
import type { Group } from 'three'
import './VehicleWorkshopOverlay.css'

interface WorkshopOverlayProps {
  onComplete: () => void
}

const MODIFICATION_ACTIONS = [
  '抬起引擎盖',
  '拆下损坏引擎',
  '装入博赠送的调校引擎',
  '点火测试',
] as const

const MODIFICATION_STATUS = [
  '先打开引擎盖，找到发红的故障引擎。',
  '故障引擎已经暴露，把它从发动机舱拆下来。',
  '旧引擎已移除，把青绿色调校引擎装入空位。',
  '引擎已经固定，最后进行一次点火测试。',
  '转速稳定，调校引擎安装完成。',
] as const

const DISMANTLE_ACTIONS = [
  '拆下 1 号车轮组',
  '切出 1 号车引擎',
  '压缩 1 号车车壳',
  '拆下 2 号车轮组',
  '切出 2 号车引擎',
  '压缩 2 号车车壳',
] as const

function WorkshopLights(): JSX.Element {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight
        castShadow
        color="#fff1c2"
        intensity={2.8}
        position={[4, 7, 5]}
      />
      <pointLight color="#54f0cf" intensity={18} position={[-4, 2, -2]} />
      <pointLight color="#ffb347" intensity={12} position={[4, 1.5, 2]} />
    </>
  )
}

function WorkshopFloor(): JSX.Element {
  return (
    <>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[24, 18]} />
        <meshStandardMaterial
          color="#101715"
          roughness={0.82}
          metalness={0.15}
        />
      </mesh>
      <mesh
        receiveShadow
        position={[0, 0.03, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[2.9, 3.1, 48]} />
        <meshStandardMaterial
          color="#d6aa35"
          emissive="#6d4d00"
          emissiveIntensity={0.7}
        />
      </mesh>
      {[-5, 5].map((x) => (
        <mesh key={x} position={[x, 2.2, -2.8]}>
          <boxGeometry args={[0.18, 4.4, 0.18]} />
          <meshStandardMaterial
            color="#26352f"
            metalness={0.8}
            roughness={0.35}
          />
        </mesh>
      ))}
    </>
  )
}

function Wheel({
  position,
  visible = true,
}: {
  position: [number, number, number]
  visible?: boolean
}): JSX.Element {
  return (
    <group position={position} visible={visible}>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.44, 0.44, 0.34, 20]} />
        <meshStandardMaterial color="#090b0b" roughness={0.78} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, 0.36, 12]} />
        <meshStandardMaterial
          color="#8d9690"
          metalness={0.85}
          roughness={0.25}
        />
      </mesh>
    </group>
  )
}

function EngineBlock({
  tuned,
  position,
}: {
  tuned: boolean
  position: [number, number, number]
}): JSX.Element {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[1.08, 0.58, 0.82]} />
        <meshStandardMaterial
          color={tuned ? '#45d9b5' : '#8f312c'}
          emissive={tuned ? '#0d715d' : '#4d100c'}
          emissiveIntensity={tuned ? 1.1 : 0.8}
          metalness={0.72}
          roughness={0.28}
        />
      </mesh>
      {[-0.34, 0.34].map((x) => (
        <mesh key={x} position={[x, 0.38, 0]}>
          <cylinderGeometry args={[0.11, 0.11, 0.46, 10]} />
          <meshStandardMaterial
            color="#d3d9d5"
            metalness={0.92}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  )
}

function ModificationVehicle({
  operation,
}: {
  operation: number
}): JSX.Element {
  const vehicleRef = useRef<Group>(null)
  const bonnetOpen = operation >= 1
  const brokenEngineVisible = operation < 2
  const tunedEngineVisible = operation >= 2
  const tunedEngineInstalled = operation >= 3
  const tested = operation >= MODIFICATION_ACTIONS.length

  useFrame((state) => {
    if (!vehicleRef.current) return
    vehicleRef.current.rotation.y =
      -0.34 + Math.sin(state.clock.elapsedTime * 0.65) * 0.035
    vehicleRef.current.position.y = tested
      ? 0.07 + Math.sin(state.clock.elapsedTime * 9) * 0.018
      : 0.07
  })

  return (
    <group ref={vehicleRef} position={[0, 0.07, 0]} rotation={[0, -0.34, 0]}>
      <mesh castShadow position={[0, 0.72, 0.18]}>
        <boxGeometry args={[2.18, 0.58, 3.62]} />
        <meshStandardMaterial
          color="#315f3f"
          metalness={0.55}
          roughness={0.36}
        />
      </mesh>
      <mesh castShadow position={[0, 1.3, 0.72]}>
        <boxGeometry args={[1.72, 0.88, 1.38]} />
        <meshStandardMaterial
          color="#19231f"
          metalness={0.72}
          roughness={0.24}
        />
      </mesh>
      <mesh castShadow position={[0, 1.56, 0.64]}>
        <boxGeometry args={[1.45, 0.38, 1.04]} />
        <meshStandardMaterial
          color="#0b1518"
          metalness={0.38}
          roughness={0.15}
        />
      </mesh>
      <group
        position={[0, 1.03, -1.22]}
        rotation={[bonnetOpen ? -1.05 : 0, 0, 0]}
      >
        <mesh castShadow position={[0, 0, -0.42]}>
          <boxGeometry args={[1.95, 0.12, 1.1]} />
          <meshStandardMaterial
            color="#315f3f"
            metalness={0.58}
            roughness={0.32}
          />
        </mesh>
      </group>
      {brokenEngineVisible ? (
        <EngineBlock tuned={false} position={[0, 1.02, -0.92]} />
      ) : null}
      {tunedEngineVisible ? (
        <EngineBlock
          tuned
          position={tunedEngineInstalled ? [0, 1.02, -0.92] : [2.55, 0.9, 0.2]}
        />
      ) : null}
      <Wheel position={[-1.12, 0.52, -1.18]} />
      <Wheel position={[1.12, 0.52, -1.18]} />
      <Wheel position={[-1.12, 0.52, 1.18]} />
      <Wheel position={[1.12, 0.52, 1.18]} />
      {tested ? (
        <>
          <pointLight
            color="#61ffd8"
            intensity={16}
            position={[0, 1.1, -1.2]}
          />
          <mesh position={[-0.72, 0.64, 2.08]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.12, 0.8, 10]} />
            <meshBasicMaterial color="#ffb347" transparent opacity={0.8} />
          </mesh>
        </>
      ) : null}
    </group>
  )
}

function DismantleVehicle({
  carIndex,
  phase,
}: {
  carIndex: number
  phase: number
}): JSX.Element {
  const vehicleRef = useRef<Group>(null)
  useFrame((state) => {
    if (!vehicleRef.current) return
    vehicleRef.current.rotation.y =
      0.42 + Math.sin(state.clock.elapsedTime * 0.52) * 0.04
  })
  const wheelsVisible = phase < 1
  const engineVisible = phase < 2
  const compressed = phase >= 3
  const color = carIndex === 0 ? '#6e3131' : '#334d73'

  return (
    <group ref={vehicleRef} position={[0, 0.08, 0]} rotation={[0, 0.42, 0]}>
      <mesh
        castShadow
        position={[0, compressed ? 0.34 : 0.74, 0.16]}
        scale={[1, compressed ? 0.24 : 1, 1]}
      >
        <boxGeometry args={[2.28, 0.68, 3.72]} />
        <meshStandardMaterial color={color} metalness={0.62} roughness={0.52} />
      </mesh>
      {!compressed ? (
        <mesh castShadow position={[0, 1.3, 0.64]}>
          <boxGeometry args={[1.68, 0.76, 1.42]} />
          <meshStandardMaterial
            color="#171d1c"
            metalness={0.58}
            roughness={0.42}
          />
        </mesh>
      ) : null}
      {engineVisible && !compressed ? (
        <EngineBlock tuned={false} position={[0, 1.03, -1.02]} />
      ) : null}
      <Wheel position={[-1.18, 0.52, -1.2]} visible={wheelsVisible} />
      <Wheel position={[1.18, 0.52, -1.2]} visible={wheelsVisible} />
      <Wheel position={[-1.18, 0.52, 1.2]} visible={wheelsVisible} />
      <Wheel position={[1.18, 0.52, 1.2]} visible={wheelsVisible} />
      {phase === 2 ? (
        <group position={[0.7, 1.1, -0.9]}>
          {[0, 1, 2, 3, 4].map((spark) => (
            <mesh
              key={spark}
              position={[spark * 0.11, spark * 0.08, spark * -0.06]}
            >
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshBasicMaterial
                color={spark % 2 === 0 ? '#ffd369' : '#ff6b35'}
              />
            </mesh>
          ))}
        </group>
      ) : null}
    </group>
  )
}

function CompletedBales({ count }: { count: number }): JSX.Element {
  return (
    <group position={[-3.5, 0.4, 1.4]}>
      {Array.from({ length: count }, (_, index) => (
        <mesh
          key={index}
          castShadow
          position={[0, index * 0.6, 0]}
          rotation={[0, 0.18 * index, 0]}
        >
          <boxGeometry args={[1.55, 0.5, 1.15]} />
          <meshStandardMaterial
            color="#53605b"
            metalness={0.82}
            roughness={0.48}
          />
        </mesh>
      ))}
    </group>
  )
}

function ModificationScene({ operation }: { operation: number }): JSX.Element {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [6.2, 4.2, 7.2], fov: 35 }}
      aria-label="灰狐改车三维示意"
    >
      <color attach="background" args={['#07100f']} />
      <fog attach="fog" args={['#07100f', 8, 18]} />
      <WorkshopLights />
      <WorkshopFloor />
      <ModificationVehicle operation={operation} />
    </Canvas>
  )
}

function DismantleScene({ operation }: { operation: number }): JSX.Element {
  const carIndex = Math.min(1, Math.floor(operation / 3))
  const phase = operation >= DISMANTLE_ACTIONS.length ? 3 : operation % 3
  const completedCount = Math.min(2, Math.floor(operation / 3))
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [6.5, 4.4, 7.5], fov: 36 }}
      aria-label="废车拆解三维示意"
    >
      <color attach="background" args={['#0d100f']} />
      <fog attach="fog" args={['#0d100f', 8, 19]} />
      <WorkshopLights />
      <WorkshopFloor />
      <DismantleVehicle carIndex={carIndex} phase={phase} />
      <CompletedBales count={completedCount} />
    </Canvas>
  )
}

export function CarModificationOverlay({
  onComplete,
}: WorkshopOverlayProps): JSX.Element {
  const [operation, setOperation] = useState(0)
  const completionSentRef = useRef(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const finished = operation >= MODIFICATION_ACTIONS.length

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const handleAction = (): void => {
    if (!finished) {
      setOperation((current) =>
        Math.min(MODIFICATION_ACTIONS.length, current + 1),
      )
      return
    }
    if (completionSentRef.current) return
    completionSentRef.current = true
    onComplete()
  }

  return (
    <section
      className="vehicle-workshop"
      role="dialog"
      aria-modal="true"
      aria-label="3D 改车工位"
    >
      <header className="vehicle-workshop__header">
        <div>
          <span>RAZOR GARAGE · MOD BAY</span>
          <h2 ref={titleRef} tabIndex={-1}>
            灰狐改车工位
          </h2>
        </div>
        <strong>{`${Math.min(operation, MODIFICATION_ACTIONS.length)} / ${MODIFICATION_ACTIONS.length}`}</strong>
      </header>
      <div className="vehicle-workshop__scene">
        <ModificationScene operation={operation} />
        <div className="vehicle-workshop__scene-label">3D 实时工位</div>
      </div>
      <footer className="vehicle-workshop__console">
        <div className="vehicle-workshop__task">
          <span>{finished ? '改装完成' : '当前操作'}</span>
          <p aria-live="polite">{MODIFICATION_STATUS[operation]}</p>
        </div>
        <progress
          value={operation}
          max={MODIFICATION_ACTIONS.length}
          aria-label="改车进度"
        />
        <button
          type="button"
          className="vehicle-workshop__action"
          onClick={handleAction}
        >
          {finished ? '确认改装完成' : MODIFICATION_ACTIONS[operation]}
        </button>
      </footer>
    </section>
  )
}

export function CarDismantleOverlay({
  onComplete,
}: WorkshopOverlayProps): JSX.Element {
  const [operation, setOperation] = useState(0)
  const completionSentRef = useRef(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const finished = operation >= DISMANTLE_ACTIONS.length
  const activeCar = Math.min(2, Math.floor(operation / 3) + 1)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const handleAction = (): void => {
    if (!finished) {
      setOperation((current) => Math.min(DISMANTLE_ACTIONS.length, current + 1))
      return
    }
    if (completionSentRef.current) return
    completionSentRef.current = true
    onComplete()
  }

  return (
    <section
      className="vehicle-workshop vehicle-workshop--dismantle"
      role="dialog"
      aria-modal="true"
      aria-label="3D 拆车工位"
    >
      <header className="vehicle-workshop__header">
        <div>
          <span>SCRAP YARD · BREAKDOWN LINE</span>
          <h2 ref={titleRef} tabIndex={-1}>
            黑市车辆拆解
          </h2>
        </div>
        <strong>{finished ? '2 / 2' : `${activeCar} / 2`}</strong>
      </header>
      <div className="vehicle-workshop__scene">
        <DismantleScene operation={operation} />
        <div className="vehicle-workshop__scene-label">车辆拆解台</div>
      </div>
      <footer className="vehicle-workshop__console">
        <div className="vehicle-workshop__task">
          <span>{finished ? '拆解完成' : `当前车辆 · ${activeCar} 号`}</span>
          <p aria-live="polite">
            {finished
              ? '两辆黑市车已经拆成可用部件，回收物等待入库。'
              : '按轮组、引擎、车壳顺序拆解，观察车辆模型实时变化。'}
          </p>
        </div>
        <progress
          value={operation}
          max={DISMANTLE_ACTIONS.length}
          aria-label="拆车进度"
        />
        {finished ? (
          <div className="vehicle-workshop__reward" aria-label="拆车奖励">
            <span>零件 +25</span>
            <span>普通悬挂 ×1</span>
          </div>
        ) : null}
        <button
          type="button"
          className="vehicle-workshop__action"
          onClick={handleAction}
        >
          {finished ? '收取拆解物' : DISMANTLE_ACTIONS[operation]}
        </button>
      </footer>
    </section>
  )
}
