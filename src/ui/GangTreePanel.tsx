import { useEffect, useMemo, useState, type JSX } from 'react'
import { heroesConfig } from '../config/heroesConfig'
import { equipmentConfig } from '../config/equipmentConfig'
import { buildingCatalogById } from '../game/buildingCatalog'
import {
  GANG_MAX_LEVEL,
  GANG_MIN_LEVEL,
  GANG_ROLES,
  getGangRole,
  getNextGangRole,
  getTotalReputationForLevel,
} from '../game/gangProgression'
import {
  getChapterForGangLevel,
  isChapterComplete,
} from '../game/chapterProgression'
import {
  PROGRESSION_UNLOCKS,
  type ProgressionUnlock,
} from '../game/progressionUnlocks'
import { useGangStore } from '../store/useGangStore'
import { useAdventureStore } from '../store/useAdventureStore'
import { useCityStore } from '../store/useCityStore'
import { useInitialFocus } from './useInitialFocus'

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

const FEATURE_LABELS = {
  adventure: '战役',
  heroes: '英雄',
  racing: '公路争霸',
}

function unlockLabel(unlock: ProgressionUnlock): string {
  if (unlock.kind === 'building') {
    return buildingCatalogById[unlock.buildingId]?.name ?? unlock.buildingId
  }
  if (unlock.kind === 'hero') {
    const hero = heroesConfig.heroes[unlock.heroId]
    return `${hero.name}·${hero.alias}`
  }
  if (unlock.kind === 'car') {
    return `载具·${equipmentConfig.cars[unlock.carId].name}`
  }
  if (unlock.kind === 'gun') {
    return `枪械·${equipmentConfig.guns[unlock.gunId].name}`
  }
  return FEATURE_LABELS[unlock.featureId]
}

function unlockKey(unlock: ProgressionUnlock): string {
  switch (unlock.kind) {
    case 'building':
      return unlock.buildingId
    case 'hero':
      return unlock.heroId
    case 'feature':
      return unlock.featureId
    case 'car':
      return unlock.carId
    case 'gun':
      return unlock.gunId
  }
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
  const currentLevel = useGangStore((state) => state.currentLevel)
  const promoteOneLevel = useGangStore((state) => state.promoteOneLevel)
  const heroLevels = useAdventureStore((state) => state.heroLevels)
  const gunLevels = useAdventureStore((state) => state.gunLevels)
  const carPartInventory = useAdventureStore((state) => state.carPartInventory)
  const highestClearedStage = useAdventureStore(
    (state) => state.highestClearedStage,
  )
  const highestClearedRacingStage = useAdventureStore(
    (state) => state.highestClearedRacingStage,
  )
  const buildingProgress = useCityStore((state) => state.buildingProgress)
  const [feedback, setFeedback] = useState('')
  const titleRef = useInitialFocus<HTMLHeadingElement>(open)
  const currentChapter = getChapterForGangLevel(currentLevel)
  const chapterComplete = useMemo(
    () =>
      isChapterComplete(currentChapter, {
        heroLevels,
        gunLevels,
        carPartInventory,
        highestClearedStage,
        highestClearedRacingStage,
        buildingProgress,
      }),
    [
      buildingProgress,
      carPartInventory,
      currentChapter,
      gunLevels,
      heroLevels,
      highestClearedRacingStage,
      highestClearedStage,
    ],
  )

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

  const currentRole = getGangRole(currentLevel)
  const nextRole = getNextGangRole(currentLevel)
  const nextLevel = Math.min(GANG_MAX_LEVEL, currentLevel + 1)
  const requiredReputation = getTotalReputationForLevel(nextLevel)
  const crossesRole =
    currentLevel < GANG_MAX_LEVEL &&
    getGangRole(currentLevel).threshold !== getGangRole(nextLevel).threshold
  const canPromote =
    currentLevel < GANG_MAX_LEVEL &&
    totalReputation >= requiredReputation &&
    (!crossesRole || chapterComplete)
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
        <h2
          ref={titleRef}
          id={TITLE_ID}
          className="gang-tree-panel__title"
          tabIndex={-1}
        >
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
        <div className="gang-tree-panel__promotion">
          <div>
            <strong>
              {currentLevel >= GANG_MAX_LEVEL
                ? '帮派等级已满'
                : `晋升 Lv.${nextLevel}`}
            </strong>
            <span>
              {currentLevel >= GANG_MAX_LEVEL
                ? '所有等级均已解锁'
                : totalReputation < requiredReputation
                  ? `帮派经验 ${totalReputation}/${requiredReputation}`
                  : crossesRole && !chapterComplete
                    ? `需完成${currentChapter.title}`
                    : '晋升条件已满足'}
            </span>
          </div>
          <button
            type="button"
            disabled={!canPromote}
            onClick={() => {
              const result = promoteOneLevel(Date.now(), chapterComplete)
              setFeedback(
                result.applied
                  ? `已晋升至 Lv.${currentLevel + 1}`
                  : result.reason === 'chapter-incomplete'
                    ? '当前章节未完成，无法晋升职级'
                    : '尚未满足晋升条件',
              )
            }}
          >
            {currentLevel >= GANG_MAX_LEVEL ? '已满级' : '晋升一级'}
          </button>
        </div>
        <p className="gang-tree-panel__feedback" aria-live="polite">
          {feedback}
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
                  const key = unlockKey(unlock)
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
