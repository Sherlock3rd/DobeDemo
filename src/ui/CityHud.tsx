import type { JSX } from 'react'
import {
  REPUTATION_PER_SECOND,
  getGangLevel,
  getGangRole,
  getLevelProgress,
} from '../game/gangProgression'
import { useGangStore } from '../store/useGangStore'

export interface CityHudProps {
  onOpenGangTree?: () => void
  onOpenSettings?: () => void
}

export function CityHud({
  onOpenGangTree,
  onOpenSettings,
}: CityHudProps = {}): JSX.Element {
  const totalReputation = useGangStore((state) => state.totalReputation)
  const level = getGangLevel(totalReputation)
  const role = getGangRole(level)
  const { current, required } = getLevelProgress(totalReputation)

  return (
    <section className="city-hud" aria-labelledby="city-hud-title">
      <h1 id="city-hud-title" className="city-hud__title">
        工业城改造计划
      </h1>
      <p className="city-hud__level">{`Lv. ${level}`}</p>
      <p className="city-hud__role">{`${role.title}（${role.chineseTitle}）`}</p>
      <p className="city-hud__progress-label">{`${current} / ${required}`}</p>
      <progress className="city-hud__progress" max={required} value={current} />
      <p className="city-hud__rate">{`+${REPUTATION_PER_SECOND} 声望/秒`}</p>
      <div className="city-hud__actions">
        <button
          type="button"
          className="city-hud__open-gang-tree"
          onClick={onOpenGangTree}
        >
          打开帮派树
        </button>
        <button
          type="button"
          className="city-hud__open-settings"
          aria-label="打开调试设置"
          onClick={onOpenSettings}
        >
          设置
        </button>
      </div>
      <p className="city-hud__hint">拖拽平移 · 滚轮缩放 · 点击建筑升级</p>
    </section>
  )
}
