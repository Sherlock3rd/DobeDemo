import { useEffect, type JSX } from 'react'
import { heroesConfig } from '../config/heroesConfig'
import { buildingCatalogById } from '../game/buildingCatalog'
import {
  GANG_MAX_LEVEL,
  GANG_MIN_LEVEL,
  GANG_ROLES,
  getGangLevel,
  getGangRole,
  getNextGangRole,
} from '../game/gangProgression'
import {
  PROGRESSION_UNLOCKS,
  type ProgressionUnlock,
} from '../game/progressionUnlocks'
import { useGangStore } from '../store/useGangStore'

export interface GangTreePanelProps {
  open: boolean
  onClose: () => void
}

type LevelState = 'completed' | 'current' | 'locked'

const TITLE_ID = 'gang-tree-panel-title'

const LEVELS: readonly number[] = Array.from(
  { length: GANG_MAX_LEVEL - GANG_MIN_LEVEL + 1 },
  (_, index) => GANG_MIN_LEVEL + index,
)

const ROLE_BY_LEVEL = new Map(GANG_ROLES.map((role) => [role.threshold, role]))

const UNLOCKS_BY_LEVEL = PROGRESSION_UNLOCKS.reduce((map, unlock) => {
  const list = map.get(unlock.requiredLevel) ?? []
  list.push(unlock)
  map.set(unlock.requiredLevel, list)
  return map
}, new Map<number, ProgressionUnlock[]>())

const FEATURE_LABELS: Record<'adventure' | 'heroes', string> = {
  adventure: '战役',
  heroes: '英雄',
}

function unlockLabel(unlock: ProgressionUnlock): string {
  if (unlock.kind === 'building') {
    return buildingCatalogById[unlock.buildingId]?.name ?? unlock.buildingId
  }
  if (unlock.kind === 'hero') {
    const hero = heroesConfig.heroes[unlock.heroId]
    return `${hero.name}·${hero.alias}`
  }
  return FEATURE_LABELS[unlock.featureId]
}

function getLevelState(level: number, currentLevel: number): LevelState {
  if (level < currentLevel) {
    return 'completed'
  }

  if (level === currentLevel) {
    return 'current'
  }

  return 'locked'
}

export function GangTreePanel({
  open,
  onClose,
}: GangTreePanelProps): JSX.Element | null {
  const totalReputation = useGangStore((state) => state.totalReputation)

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) {
    return null
  }

  const currentLevel = getGangLevel(totalReputation)
  const currentRole = getGangRole(currentLevel)
  const nextRole = getNextGangRole(currentLevel)
  const stopPropagation = (event: { stopPropagation: () => void }): void => {
    event.stopPropagation()
  }

  return (
    <div
      className="gang-tree-panel__overlay"
      onPointerDown={stopPropagation}
      onClick={stopPropagation}
    >
      <section
        className="gang-tree-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        onPointerDown={stopPropagation}
        onClick={stopPropagation}
      >
        <button
          type="button"
          className="gang-tree-panel__close"
          aria-label="关闭帮派树"
          onClick={onClose}
        >
          关闭
        </button>
        <h2 id={TITLE_ID} className="gang-tree-panel__title">
          帮派树
        </h2>
        <p className="gang-tree-panel__status">
          {`Lv. ${currentLevel} · ${currentRole.title}（${currentRole.chineseTitle}） · 总声望 ${totalReputation}`}
        </p>
        <p className="gang-tree-panel__next">
          {nextRole
            ? `下一职位：${nextRole.title}（${nextRole.chineseTitle}） · 需要 Lv. ${nextRole.threshold}`
            : '已达到最高职位'}
        </p>
        <ol className="gang-tree-panel__levels">
          {LEVELS.map((level) => {
            const state = getLevelState(level, currentLevel)
            const role = ROLE_BY_LEVEL.get(level)
            const unlocks = UNLOCKS_BY_LEVEL.get(level) ?? []
            const unlocked = state !== 'locked'

            return (
              <li
                key={level}
                className="gang-tree-panel__level"
                data-state={state}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                <span className="gang-tree-panel__level-number">{`等级 ${level}`}</span>
                {role ? (
                  <span className="gang-tree-panel__level-role">
                    {`${role.title}（${role.chineseTitle}）`}
                  </span>
                ) : null}
                {unlocks.map((unlock) => {
                  const label = unlockLabel(unlock)
                  const key =
                    unlock.kind === 'building'
                      ? unlock.buildingId
                      : unlock.kind === 'hero'
                        ? unlock.heroId
                        : unlock.featureId
                  return (
                    <span
                      key={`${unlock.kind}-${key}`}
                      className={
                        unlock.kind === 'building'
                          ? 'gang-tree-panel__level-building'
                          : 'gang-tree-panel__level-unlock'
                      }
                    >
                      {`${label} ${unlocked ? '已解锁' : '待解锁'}`}
                    </span>
                  )
                })}
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
