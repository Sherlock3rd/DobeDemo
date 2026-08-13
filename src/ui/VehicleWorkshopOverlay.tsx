import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState, type JSX } from 'react'
import type { Group } from 'three'
import type {
  CarDismantleScenario,
  CarModificationScenario,
} from '../game/storyPlanC'
import './VehicleWorkshopOverlay.css'

interface WorkshopOverlayProps {
  onComplete: () => void
}

interface ModificationDefinition {
  overline: string
  title: string
  sceneLabel: string
  actions: readonly string[]
  status: readonly string[]
  jobLabels: readonly string[]
  actionsPerJob: number
}

const MODIFICATION_DEFINITIONS: Readonly<
  Record<CarModificationScenario, ModificationDefinition>
> = {
  'repair-trio': {
    overline: 'RAZOR GARAGE · THREE-CAR SHIFT',
    title: '伏击后三车维修',
    sceneLabel: '三辆车 · 三种损伤',
    actions: [
      '打开灰狐引擎舱',
      '更换灰狐散热器',
      '完成灰狐压力测试',
      '举升 Eddie 的通勤车',
      '拆下变形轮组',
      '安装备用轮组并落车',
      '拆除 Bo 的破损护杠',
      '固定强化护杠',
      '检查灯光与车身间隙',
    ],
    status: [
      '灰狐在伏击中高温报警，先打开引擎舱确认散热器位置。',
      '漏液点已经找到，拆下破损散热器并换入完好件。',
      '散热系统已经闭合，做一次压力测试确认灰狐能够返程。',
      '灰狐维修完成。第二辆车的右前轮外倾，先把车辆举升。',
      '悬挂已经卸载，拆下在撞击中变形的轮组。',
      '安装备用轮组并让车辆落地，确认轮胎能够直线滚动。',
      '第二辆车可以交付。第三辆接应车的前护杠已经松脱。',
      '破损护杠已拆下，把强化护杠固定到车架受力点。',
      '三辆车都已恢复，最后检查灯光与车身间隙。',
      '三辆车全部交付，第二份见习证明完成。',
    ],
    jobLabels: ['Thomas · 灰狐', 'Eddie · 通勤车', 'Bo · 接应车'],
    actionsPerJob: 3,
  },
  'tune-engine': {
    overline: 'RAZOR GARAGE · ENGINE BAY',
    title: '灰狐引擎强化',
    sceneLabel: '剧情配件 · 调校引擎',
    actions: ['抬起引擎盖', '拆下损坏引擎', '装入博赠送的调校引擎', '点火测试'],
    status: [
      '先打开引擎盖，找到发红的故障引擎。',
      '故障引擎已经暴露，把它从发动机舱拆下来。',
      '旧引擎已移除，把青绿色调校引擎装入空位。',
      '引擎已经固定，最后进行一次点火测试。',
      '转速稳定，调校引擎安装完成。',
    ],
    jobLabels: ['Thomas · 灰狐'],
    actionsPerJob: 4,
  },
  'nitrous-install': {
    overline: 'RAZOR GARAGE · REPAIR & NITROUS BAY',
    title: '灰狐维修与氮气加装',
    sceneLabel: '伏击损伤 · 博赠送氮气',
    actions: [
      '打开受损引擎舱',
      '更换破损散热器',
      '完成压力测试',
      '打开后备舱',
      '固定氮气瓶与管路',
      '点火喷射测试',
    ],
    status: [
      '灰狐在伏击中高温报警，先打开引擎舱检查损伤。',
      '漏液点已经找到，换下破损散热器并重新连接管路。',
      '散热系统闭合后完成压力测试，确认车辆能够继续行驶。',
      '维修完成。博带来一套氮气系统，打开后备舱寻找安装位。',
      '把双瓶支架固定在后轴上方，并将高压管路接入进气。',
      '检查压力表，点火并做一次短促喷射测试。',
      '蓝色尾焰稳定，灰狐完成维修并获得氮气冲刺能力。',
    ],
    jobLabels: ['Thomas · 灰狐'],
    actionsPerJob: 6,
  },
  'race-prep': {
    overline: 'SCRAP YARD · RACE SETUP',
    title: '赛前悬挂换件',
    sceneLabel: '回收配件 · 竞速调校',
    actions: ['举升灰狐', '拆下弯曲悬挂', '安装回收悬挂', '完成四轮定位'],
    status: [
      '回收所得的悬挂已经送到工位，先举升车辆释放轮组载荷。',
      '右前轮角度异常，拆下在伏击中弯曲的旧悬挂。',
      '安装回收场挑出的青绿色悬挂，并锁紧全部连接点。',
      '新悬挂已经落位，完成四轮定位后才能安全参加一对一竞速。',
      '定位数据归零，灰狐已经完成赛前准备。',
    ],
    jobLabels: ['Thomas · 灰狐'],
    actionsPerJob: 4,
  },
  'revenge-build': {
    overline: 'SCRAP YARD · ARMORED BAY',
    title: '铁獠复仇整备',
    sceneLabel: '第二辆车 · 装甲修复',
    actions: [
      '打开铁獠装甲舱',
      '装入残车引擎部件',
      '固定前部装甲',
      '完成武装点火',
    ],
    status: [
      '铁獠一直由 Freddie 看守，先打开装甲舱确认空缺部位。',
      '把追杀残车里拆出的引擎部件装入铁獠动力舱。',
      '动力已经恢复，重新固定能承受正面火力的前部装甲。',
      '装甲锁止，完成武装点火并确认车辆可以投入复仇行动。',
      '铁獠已经苏醒，第二辆剧情车辆整备完成。',
    ],
    jobLabels: ['Freddie 遗留 · 铁獠'],
    actionsPerJob: 4,
  },
}

const DISMANTLE_ACTIONS: Readonly<
  Record<CarDismantleScenario, readonly string[]>
> = {
  'salvage-single': ['拆下废车轮组', '取出引擎与氮气装置', '压缩废车车壳'],
  'salvage-pair': [
    '拆下 1 号车轮组',
    '切出 1 号车引擎',
    '压缩 1 号车车壳',
    '拆下 2 号车轮组',
    '切出 2 号车引擎',
    '压缩 2 号车车壳',
  ],
  'pursuit-wreck': ['拆下追杀车轮组', '切出引擎与车架编号', '压缩残骸'],
}

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

function SuspensionModule({
  tuned,
  position,
}: {
  tuned: boolean
  position: [number, number, number]
}): JSX.Element {
  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.92, 12]} />
        <meshStandardMaterial
          color={tuned ? '#51e5c2' : '#a43b32'}
          emissive={tuned ? '#0c6d59' : '#4b100c'}
          emissiveIntensity={0.7}
          metalness={0.8}
          roughness={0.26}
        />
      </mesh>
      {[-0.3, -0.1, 0.1, 0.3].map((z) => (
        <mesh key={z} position={[0, 0, z]}>
          <torusGeometry args={[0.29, 0.055, 8, 20]} />
          <meshStandardMaterial
            color={tuned ? '#c8fff2' : '#d87968'}
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  )
}

function ModificationVehicle({
  scenario,
  operation,
}: {
  scenario: CarModificationScenario
  operation: number
}): JSX.Element {
  const vehicleRef = useRef<Group>(null)
  const definition = MODIFICATION_DEFINITIONS[scenario]
  const repairCarIndex =
    scenario === 'repair-trio'
      ? Math.min(2, Math.floor(operation / definition.actionsPerJob))
      : 0
  const localOperation =
    scenario === 'repair-trio'
      ? operation - repairCarIndex * definition.actionsPerJob
      : operation
  const isEngineJob =
    scenario === 'tune-engine' ||
    (scenario === 'repair-trio' && repairCarIndex === 0)
  const isWheelJob = scenario === 'repair-trio' && repairCarIndex === 1
  const isBumperJob = scenario === 'repair-trio' && repairCarIndex === 2
  const isRacePrep = scenario === 'race-prep'
  const isNitrous = scenario === 'nitrous-install'
  const isIronFang = scenario === 'revenge-build'
  const bonnetOpen = isEngineJob || isIronFang ? localOperation >= 1 : false
  const brokenEngineVisible =
    scenario === 'tune-engine' ? localOperation < 2 : false
  const tunedEngineVisible =
    scenario === 'tune-engine' ? localOperation >= 2 : isIronFang
  const tunedEngineInstalled =
    scenario === 'tune-engine' ? localOperation >= 3 : localOperation >= 2
  const wheelRemoved = isWheelJob && localOperation >= 2
  const tunedSuspensionInstalled = isRacePrep && localOperation >= 3
  const tested = operation >= definition.actions.length
  const bodyColor = isIronFang
    ? '#28302e'
    : scenario === 'repair-trio'
      ? ['#315f3f', '#755638', '#354f70'][repairCarIndex]
      : '#315f3f'

  useFrame((state) => {
    if (!vehicleRef.current) return
    vehicleRef.current.rotation.y =
      -0.34 + Math.sin(state.clock.elapsedTime * 0.65) * 0.035
    vehicleRef.current.position.y = tested
      ? 0.07 + Math.sin(state.clock.elapsedTime * 9) * 0.018
      : 0.07
  })

  return (
    <group
      ref={vehicleRef}
      position={[0, 0.07, 0]}
      rotation={[0, -0.34, 0]}
      scale={isIronFang ? [1.08, 1.02, 1.12] : [1, 1, 1]}
    >
      <mesh castShadow position={[0, 0.72, 0.18]}>
        <boxGeometry args={[2.18, 0.58, 3.62]} />
        <meshStandardMaterial
          color={bodyColor}
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
            color={bodyColor}
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
      {scenario === 'repair-trio' && repairCarIndex === 0 ? (
        <group position={[0, 1.01, -1.2]}>
          <mesh castShadow>
            <boxGeometry args={[1.36, 0.5, 0.18]} />
            <meshStandardMaterial
              color={localOperation >= 2 ? '#65ddbd' : '#a23932'}
              emissive={localOperation >= 2 ? '#155f50' : '#4d100c'}
              emissiveIntensity={0.62}
              metalness={0.74}
              roughness={0.32}
            />
          </mesh>
          {[-0.42, -0.14, 0.14, 0.42].map((x) => (
            <mesh key={x} position={[x, 0, -0.11]}>
              <boxGeometry args={[0.055, 0.4, 0.07]} />
              <meshStandardMaterial color="#18201e" metalness={0.82} />
            </mesh>
          ))}
        </group>
      ) : null}
      <Wheel position={[-1.12, 0.52, -1.18]} />
      <Wheel position={[1.12, 0.52, -1.18]} visible={!wheelRemoved} />
      <Wheel position={[-1.12, 0.52, 1.18]} />
      <Wheel position={[1.12, 0.52, 1.18]} />
      {wheelRemoved ? (
        <group position={[2.65, 0.45, -0.55]} rotation={[0, 0.3, 0.4]}>
          <Wheel position={[0, 0, 0]} />
        </group>
      ) : null}
      {isRacePrep ? (
        <>
          <SuspensionModule
            tuned={tunedSuspensionInstalled}
            position={
              tunedSuspensionInstalled
                ? [0.86, 0.72, -1.05]
                : [2.55, 0.72, 0.15]
            }
          />
          {localOperation < 2 ? (
            <SuspensionModule tuned={false} position={[0.86, 0.72, -1.05]} />
          ) : null}
        </>
      ) : null}
      {isNitrous ? (
        <group
          position={localOperation >= 2 ? [0, 0.94, 1.18] : [2.5, 0.72, 0.2]}
        >
          {[-0.3, 0.3].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.17, 0.17, 0.92, 16]} />
                <meshStandardMaterial
                  color={localOperation >= 3 ? '#53d8ff' : '#b9c4c8'}
                  emissive={localOperation >= 3 ? '#075a78' : '#000000'}
                  emissiveIntensity={0.8}
                  metalness={0.9}
                  roughness={0.22}
                />
              </mesh>
              <mesh position={[0, 0, -0.5]}>
                <cylinderGeometry args={[0.07, 0.1, 0.12, 12]} />
                <meshStandardMaterial color="#d6a84d" metalness={0.95} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, -0.22, 0]}>
            <boxGeometry args={[0.92, 0.08, 1.08]} />
            <meshStandardMaterial color="#17211f" metalness={0.75} />
          </mesh>
        </group>
      ) : null}
      {isBumperJob ? (
        <mesh castShadow position={[0, 0.72, -2.03]}>
          <boxGeometry args={[2.44, 0.34, 0.28]} />
          <meshStandardMaterial
            color={localOperation >= 2 ? '#5bd8ba' : '#9c342d'}
            emissive={localOperation >= 2 ? '#155b4b' : '#45100c'}
            emissiveIntensity={0.55}
            metalness={0.82}
            roughness={0.3}
          />
        </mesh>
      ) : null}
      {isIronFang ? (
        <>
          <mesh castShadow position={[0, 0.86, -1.94]}>
            <boxGeometry args={[2.5, 0.58, 0.34]} />
            <meshStandardMaterial
              color={localOperation >= 3 ? '#5e6d66' : '#843a31'}
              metalness={0.9}
              roughness={0.28}
            />
          </mesh>
          <mesh castShadow position={[-0.72, 1.56, 0.12]}>
            <boxGeometry args={[0.18, 0.18, 2.05]} />
            <meshStandardMaterial color="#222c29" metalness={0.92} />
          </mesh>
          <mesh castShadow position={[0.72, 1.56, 0.12]}>
            <boxGeometry args={[0.18, 0.18, 2.05]} />
            <meshStandardMaterial color="#222c29" metalness={0.92} />
          </mesh>
        </>
      ) : null}
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

function ModificationScene({
  scenario,
  operation,
}: {
  scenario: CarModificationScenario
  operation: number
}): JSX.Element {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [6.2, 4.2, 7.2], fov: 35 }}
      aria-label={`${MODIFICATION_DEFINITIONS[scenario].title}三维示意`}
    >
      <color attach="background" args={['#07100f']} />
      <fog attach="fog" args={['#07100f', 8, 18]} />
      <WorkshopLights />
      <WorkshopFloor />
      <ModificationVehicle scenario={scenario} operation={operation} />
    </Canvas>
  )
}

function DismantleScene({
  scenario,
  operation,
}: {
  scenario: CarDismantleScenario
  operation: number
}): JSX.Element {
  const actions = DISMANTLE_ACTIONS[scenario]
  const carIndex =
    scenario === 'salvage-pair' ? Math.min(1, Math.floor(operation / 3)) : 0
  const phase = operation >= actions.length ? 3 : operation % 3
  const completedCount =
    scenario === 'salvage-pair'
      ? Math.min(2, Math.floor(operation / 3))
      : operation >= actions.length
        ? 1
        : 0
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [6.5, 4.4, 7.5], fov: 36 }}
      aria-label={
        scenario === 'salvage-pair'
          ? '黑市车辆拆解三维示意'
          : scenario === 'salvage-single'
            ? '见习废车拆解三维示意'
            : '追杀残车拆解三维示意'
      }
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
  scenario = 'tune-engine',
}: WorkshopOverlayProps & {
  scenario?: CarModificationScenario
}): JSX.Element {
  const [operation, setOperation] = useState(0)
  const completionSentRef = useRef(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const definition = MODIFICATION_DEFINITIONS[scenario]
  const finished = operation >= definition.actions.length
  const activeJobIndex = Math.min(
    definition.jobLabels.length - 1,
    Math.floor(operation / definition.actionsPerJob),
  )

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const handleAction = (): void => {
    if (!finished) {
      setOperation((current) =>
        Math.min(definition.actions.length, current + 1),
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
      data-scenario={scenario}
    >
      <header className="vehicle-workshop__header">
        <div>
          <span>{definition.overline}</span>
          <h2 ref={titleRef} tabIndex={-1}>
            {definition.title}
          </h2>
        </div>
        <strong>{`${Math.min(operation, definition.actions.length)} / ${definition.actions.length}`}</strong>
      </header>
      <div className="vehicle-workshop__scene">
        <ModificationScene scenario={scenario} operation={operation} />
        <div className="vehicle-workshop__scene-label">
          {definition.sceneLabel}
        </div>
      </div>
      <footer className="vehicle-workshop__console">
        <div className="vehicle-workshop__task">
          <span>
            {finished ? '工位完成' : definition.jobLabels[activeJobIndex]}
          </span>
          <p aria-live="polite">{definition.status[operation]}</p>
        </div>
        <progress
          value={operation}
          max={definition.actions.length}
          aria-label="改车进度"
        />
        <button
          type="button"
          className="vehicle-workshop__action"
          onClick={handleAction}
        >
          {finished ? '确认工位完成' : definition.actions[operation]}
        </button>
      </footer>
    </section>
  )
}

export function CarDismantleOverlay({
  onComplete,
  scenario = 'salvage-pair',
}: WorkshopOverlayProps & {
  scenario?: CarDismantleScenario
}): JSX.Element {
  const [operation, setOperation] = useState(0)
  const completionSentRef = useRef(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const actions = DISMANTLE_ACTIONS[scenario]
  const finished = operation >= actions.length
  const vehicleCount = scenario === 'salvage-pair' ? 2 : 1
  const activeCar = Math.min(vehicleCount, Math.floor(operation / 3) + 1)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const handleAction = (): void => {
    if (!finished) {
      setOperation((current) => Math.min(actions.length, current + 1))
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
      data-scenario={scenario}
    >
      <header className="vehicle-workshop__header">
        <div>
          <span>SCRAP YARD · BREAKDOWN LINE</span>
          <h2 ref={titleRef} tabIndex={-1}>
            {scenario === 'salvage-pair'
              ? '黑市车辆拆解'
              : scenario === 'salvage-single'
                ? '见习废车拆解'
                : '追杀残车取证'}
          </h2>
        </div>
        <strong>
          {finished
            ? `${vehicleCount} / ${vehicleCount}`
            : `${activeCar} / ${vehicleCount}`}
        </strong>
      </header>
      <div className="vehicle-workshop__scene">
        <DismantleScene scenario={scenario} operation={operation} />
        <div className="vehicle-workshop__scene-label">
          {scenario === 'salvage-pair'
            ? '车辆拆解台'
            : scenario === 'salvage-single'
              ? '单车回收台'
              : '残车取证台'}
        </div>
      </div>
      <footer className="vehicle-workshop__console">
        <div className="vehicle-workshop__task">
          <span>{finished ? '拆解完成' : `当前车辆 · ${activeCar} 号`}</span>
          <p aria-live="polite">
            {finished
              ? scenario === 'salvage-pair'
                ? '两辆黑市车已经拆成可用部件，回收物等待入库。'
                : scenario === 'salvage-single'
                  ? '第一辆废车已经拆完，零件与氮气装置等待装上灰狐。'
                  : '追杀残车已经拆解，车架编号与可用部件等待交给车队。'
              : scenario === 'salvage-pair'
                ? '按轮组、引擎、车壳顺序拆解，观察车辆模型实时变化。'
                : scenario === 'salvage-single'
                  ? '按轮组、动力件、车壳顺序拆解，取出可用零件和氮气装置。'
                  : '拆解敌方残车，保留车架编号并取出可用修复部件。'}
          </p>
        </div>
        <progress
          value={operation}
          max={actions.length}
          aria-label="拆车进度"
        />
        {finished ? (
          <div className="vehicle-workshop__reward" aria-label="拆车奖励">
            {scenario === 'salvage-pair' ? (
              <>
                <span>零件 +25</span>
                <span>普通悬挂 ×1</span>
              </>
            ) : scenario === 'salvage-single' ? (
              <>
                <span>零件 +15</span>
                <span>氮气装置 ×1</span>
              </>
            ) : (
              <>
                <span>袭击车架编号 ×1</span>
                <span>铁獠修复部件 ×1</span>
              </>
            )}
          </div>
        ) : null}
        <button
          type="button"
          className="vehicle-workshop__action"
          onClick={handleAction}
        >
          {finished ? '收取拆解物' : actions[operation]}
        </button>
      </footer>
    </section>
  )
}
