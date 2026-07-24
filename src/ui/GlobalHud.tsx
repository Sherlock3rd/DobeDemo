import type { JSX } from 'react'
import { useChestTick } from '../game/chestTick'
import { getGangLevel, getGangRole } from '../game/gangProgression'
import { getCurrentProductionRates } from '../game/resourceEconomy'
import {
  getClaimableIdleExp,
  useAdventureStore,
} from '../store/useAdventureStore'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { hasAdventureRedDot, hasHeroesRedDot } from './redDots'

export interface GlobalHudProps {
  onOpenHeroes: () => void
  onOpenGangTree: () => void
  onOpenAdventure: () => void
  onOpenSettings: () => void
}

export function GlobalHud(props: GlobalHudProps): JSX.Element {
  const resources = useCityStore((s) => s.resources)
  const buildingProgress = useCityStore((s) => s.buildingProgress)
  const activeProducerIds = useCityStore((s) => s.activeProducerIds)
  const totalReputation = useGangStore((s) => s.totalReputation)
  const heroLevels = useAdventureStore((s) => s.heroLevels)
  const sharedExp = useAdventureStore((s) => s.sharedExp)
  const highestClearedStage = useAdventureStore((s) => s.highestClearedStage)
  const idleClock = useAdventureStore((s) => s.idleClock)
  const tick = useChestTick((s) => s.tick)
  const now = useChestTick((s) => s.now)
  const gangLevel = getGangLevel(totalReputation)
  const role = getGangRole(gangLevel)
  const rates = getCurrentProductionRates(buildingProgress, activeProducerIds)
  // tick subscription forces a recompute when AdventureIdleClock advances.
  const claimable = getClaimableIdleExp(
    idleClock,
    highestClearedStage,
    tick > 0 || now > 0 ? now : idleClock,
  )
  const adventureDot = hasAdventureRedDot(highestClearedStage, claimable)
  const heroesDot = hasHeroesRedDot(heroLevels, sharedExp, gangLevel)

  return (
    <section className="global-hud" aria-label="主界面 HUD">
      <div className="global-hud__top">
        <button
          type="button"
          className="global-hud__avatar"
          aria-label="打开英雄培养"
          onClick={props.onOpenHeroes}
        >
          玩家
        </button>
        <button
          type="button"
          className="global-hud__gang"
          onClick={props.onOpenGangTree}
        >
          {`Lv.${gangLevel} ${role.title}（${role.chineseTitle}）`}
        </button>
        <div className="global-hud__resources" aria-label="资源">
          <span>{`钱 ${Math.trunc(resources.money)} +${rates.money}/10秒`}</span>
          <span>{`油 ${Math.trunc(resources.oil)} +${rates.oil}/10秒`}</span>
          <span>{`物资 ${Math.trunc(resources.materials)} +${rates.materials}/10秒`}</span>
          <span>{`英雄经验 ${sharedExp} · 可领 ${claimable}`}</span>
        </div>
      </div>
      <nav className="global-hud__bottom" aria-label="主导航">
        <button
          type="button"
          className="global-hud__nav"
          onClick={props.onOpenAdventure}
        >
          推关
          {adventureDot ? (
            <span
              className="global-hud__dot"
              aria-label="有可挑战关卡或可领取宝箱"
            />
          ) : null}
        </button>
        <button
          type="button"
          className="global-hud__nav"
          onClick={props.onOpenHeroes}
        >
          英雄
          {heroesDot ? (
            <span className="global-hud__dot" aria-label="有可升级英雄" />
          ) : null}
        </button>
        <button
          type="button"
          className="global-hud__nav"
          onClick={props.onOpenSettings}
        >
          设置
        </button>
      </nav>
    </section>
  )
}
