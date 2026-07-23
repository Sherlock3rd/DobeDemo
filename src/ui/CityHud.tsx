import type { JSX } from 'react'
import {
  REPUTATION_PER_TICK,
  REPUTATION_TICK_SECONDS,
  getGangLevel,
  getGangRole,
  getLevelProgress,
} from '../game/gangProgression'
import { getCurrentProductionRates } from '../game/resourceEconomy'
import { useCityStore } from '../store/useCityStore'
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
  const resources = useCityStore((state) => state.resources)
  const buildingProgress = useCityStore((state) => state.buildingProgress)
  const activeProducerIds = useCityStore((state) => state.activeProducerIds)
  const productionRates = getCurrentProductionRates(
    buildingProgress,
    activeProducerIds,
  )

  return (
    <section className="city-hud" aria-labelledby="city-hud-title">
      <h1 id="city-hud-title" className="city-hud__title">
        工业城改造计划
      </h1>
      <p className="city-hud__level">{`Lv. ${level}`}</p>
      <p className="city-hud__role">{`${role.title}（${role.chineseTitle}）`}</p>
      <p className="city-hud__progress-label">{`${current} / ${required}`}</p>
      <progress className="city-hud__progress" max={required} value={current} />
      <p className="city-hud__rate">
        {`+${REPUTATION_PER_TICK} 声望/${REPUTATION_TICK_SECONDS}秒`}
      </p>
      <div className="city-hud__resources" aria-label="资源">
        <div className="city-hud__resource">
          <p>{`钱 ${Math.trunc(resources.money)}`}</p>
          <p>{`钱 +${productionRates.money}/10秒`}</p>
        </div>
        <div className="city-hud__resource">
          <p>{`油 ${Math.trunc(resources.oil)}`}</p>
          <p>{`油 +${productionRates.oil}/10秒`}</p>
        </div>
        <div className="city-hud__resource">
          <p>{`物资 ${Math.trunc(resources.materials)}`}</p>
          <p>{`物资 +${productionRates.materials}/10秒`}</p>
        </div>
      </div>
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
