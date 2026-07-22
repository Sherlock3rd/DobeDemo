import { Loader } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useState, type JSX } from 'react'
import { GangIdleController } from './game/GangIdleController'
import { CAMERA_CONFIG } from './game/cityLayout'
import { CityScene } from './scene/city/CityScene'
import { AppErrorBoundary } from './ui/AppErrorBoundary'
import { BuildingPanel } from './ui/BuildingPanel'
import { CityHud } from './ui/CityHud'
import { GangTreePanel } from './ui/GangTreePanel'
import './App.css'

export default function App(): JSX.Element {
  const [gangTreeOpen, setGangTreeOpen] = useState(false)

  return (
    <AppErrorBoundary>
      <main className="city-app">
        <Canvas
          className="city-app__canvas"
          shadows
          orthographic
          camera={{
            position: CAMERA_CONFIG.position,
            zoom: CAMERA_CONFIG.initialZoom,
            near: 0.1,
            far: 200,
          }}
          dpr={[1, 1.75]}
        >
          <Suspense fallback={null}>
            <CityScene />
          </Suspense>
        </Canvas>
        <Loader
          containerStyles={{ background: 'rgba(4, 10, 24, 0.92)' }}
          innerStyles={{ width: 'min(18rem, 72vw)' }}
          barStyles={{ background: '#ffd43b' }}
          dataStyles={{ color: '#f8fafc', fontSize: '0.875rem' }}
          dataInterpolation={(progress) =>
            `正在加载城市场景… ${progress.toFixed(0)}%`
          }
        />
        <GangIdleController />
        <CityHud onOpenGangTree={() => setGangTreeOpen(true)} />
        <BuildingPanel />
        <GangTreePanel
          open={gangTreeOpen}
          onClose={() => setGangTreeOpen(false)}
        />
      </main>
    </AppErrorBoundary>
  )
}
