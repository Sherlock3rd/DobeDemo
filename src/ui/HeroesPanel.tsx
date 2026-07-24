import { useEffect, useState, type JSX } from 'react'
import { expToLevel, heroesConfig } from '../config/heroesConfig'
import {
  HERO_IDS,
  getHeroLevelCap,
  getHeroStats,
  heroUnlockLevel,
  isHeroUnlocked,
  type HeroId,
} from '../game/heroes'
import { getGangLevel } from '../game/gangProgression'
import { useAdventureStore } from '../store/useAdventureStore'
import { useGangStore } from '../store/useGangStore'
import { useInitialFocus } from './useInitialFocus'

export interface HeroesPanelProps {
  onClose: () => void
}

const TITLE_ID = 'heroes-panel-title'

function upgradeFeedback(
  reason: string,
  name: string,
  level: number,
  sharedExp: number,
): string {
  switch (reason) {
    case 'ready':
      return `已升级 ${name} 至 Lv.${level + 1}`
    case 'hero-level-capped-by-gang':
      return '英雄等级不能超过帮派等级'
    case 'hero-maxed':
      return '已达到最高等级 Lv.50'
    case 'insufficient-shared-exp':
      return `英雄经验不足，还需 ${expToLevel(level) - sharedExp}`
    default:
      return '无法升级'
  }
}

export function HeroesPanel({ onClose }: HeroesPanelProps): JSX.Element {
  const totalReputation = useGangStore((s) => s.totalReputation)
  const heroLevels = useAdventureStore((s) => s.heroLevels)
  const sharedExp = useAdventureStore((s) => s.sharedExp)
  const upgradeHero = useAdventureStore((s) => s.upgradeHero)
  const [status, setStatus] = useState('')
  const titleRef = useInitialFocus<HTMLHeadingElement>()
  const gangLevel = getGangLevel(totalReputation)
  const cap = getHeroLevelCap(gangLevel)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const stopPropagation = (event: { stopPropagation: () => void }): void => {
    event.stopPropagation()
  }

  const handleUpgrade = (heroId: HeroId): void => {
    const level = heroLevels[heroId]
    const name = heroesConfig.heroes[heroId].name
    const result = upgradeHero(heroId, gangLevel)
    setStatus(upgradeFeedback(result.reason, name, level, sharedExp))
  }

  return (
    <div
      className="heroes-panel__overlay"
      onPointerDown={stopPropagation}
      onClick={stopPropagation}
    >
      <section
        className="heroes-panel"
        role="dialog"
        aria-labelledby={TITLE_ID}
        onPointerDown={stopPropagation}
        onClick={stopPropagation}
      >
        <button
          type="button"
          className="heroes-panel__close"
          aria-label="关闭英雄培养"
          onClick={onClose}
        >
          关闭
        </button>
        <h2
          ref={titleRef}
          id={TITLE_ID}
          className="heroes-panel__title"
          tabIndex={-1}
        >
          英雄培养
        </h2>
        <p className="heroes-panel__shared-exp">{`共享英雄经验 ${sharedExp}`}</p>
        <p className="heroes-panel__cap">{`当前帮派等级上限 Lv.${cap}`}</p>
        <ul className="heroes-panel__list">
          {HERO_IDS.map((heroId) => {
            const def = heroesConfig.heroes[heroId]
            const level = heroLevels[heroId]
            const unlocked = isHeroUnlocked(heroId, gangLevel)
            const stats = getHeroStats(heroId, level)
            return (
              <li
                key={heroId}
                className="heroes-panel__card"
                data-hero={heroId}
              >
                <h3 className="heroes-panel__name">
                  {`${def.name}·${def.alias}`}
                </h3>
                {!unlocked ? (
                  <p className="heroes-panel__locked">
                    {`帮派 Lv.${heroUnlockLevel(heroId)} 解锁`}
                  </p>
                ) : (
                  <>
                    <p className="heroes-panel__level">{`Lv.${level}`}</p>
                    <p className="heroes-panel__stats">
                      {`HP ${stats.hp} · ATK ${stats.atk} · DEF ${stats.def}`}
                    </p>
                    <p className="heroes-panel__skill">{`技能 ${def.skill.name}`}</p>
                    <button
                      type="button"
                      className="heroes-panel__upgrade"
                      onClick={() => handleUpgrade(heroId)}
                    >
                      {`升级 ${def.name}`}
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
        <p className="heroes-panel__status" role="status" aria-live="polite">
          {status}
        </p>
      </section>
    </div>
  )
}
