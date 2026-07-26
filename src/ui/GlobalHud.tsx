import { useMemo, type JSX } from 'react'
import { getBuildingPower } from '../config/economyConfig'
import { heroesConfig } from '../config/heroesConfig'
import { useChestTick } from '../game/chestTick'
import {
  GANG_MAX_LEVEL,
  getGangRole,
  getTotalReputationForLevel,
  isBuildingUnlocked,
} from '../game/gangProgression'
import {
  getChapterForGangLevel,
  getTaskProgress,
  isChapterComplete,
} from '../game/chapterProgression'
import { BUILDING_IDS } from '../game/cityTypes'
import { getAccountTotalPower, unitPower } from '../game/combat/power'
import { getHeroCombatStats } from '../game/heroEquipment'
import { HERO_IDS, isHeroUnlocked } from '../game/heroes'
import {
  getClaimableIdleExp,
  useAdventureStore,
} from '../store/useAdventureStore'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { useChapterStore } from '../store/useChapterStore'
import { hasAdventureRedDot, hasHeroesRedDot } from './redDots'
import { ResourceAmount } from './ResourceAmount'

export interface GlobalHudProps {
  onOpenHeroes: () => void
  onOpenGangTree: () => void
  onOpenChapters?: () => void
  onOpenAdventure: () => void
  onOpenRacing: () => void
  onOpenSettings: () => void
}

export function GlobalHud(props: GlobalHudProps): JSX.Element {
  const resources = useCityStore((s) => s.resources)
  const buildingProgress = useCityStore((s) => s.buildingProgress)
  const gangLevel = useGangStore((s) => s.currentLevel)
  const totalReputation = useGangStore((s) => s.totalReputation)
  const heroLevels = useAdventureStore((s) => s.heroLevels)
  const equipmentByHero = useAdventureStore((s) => s.equipmentByHero)
  const formation = useAdventureStore((s) => s.formation)
  const gunLevels = useAdventureStore((s) => s.gunLevels)
  const carPartInventory = useAdventureStore((s) => s.carPartInventory)
  const carPartSlotsByCar = useAdventureStore((s) => s.carPartSlotsByCar)
  const sharedExp = useAdventureStore((s) => s.sharedExp)
  const highestClearedStage = useAdventureStore((s) => s.highestClearedStage)
  const highestClearedRacingStage = useAdventureStore(
    (s) => s.highestClearedRacingStage,
  )
  const claimedTaskIds = useChapterStore((s) => s.claimedTaskIds)
  const claimedChapterNumbers = useChapterStore((s) => s.claimedChapterNumbers)
  const idleClock = useAdventureStore((s) => s.idleClock)
  const tick = useChestTick((s) => s.tick)
  const now = useChestTick((s) => s.now)
  const role = getGangRole(gangLevel)
  const totalPower = useMemo(() => {
    const progression = { gunLevels, carPartInventory, carPartSlotsByCar }
    return getAccountTotalPower({
      unlockedHeroPowers: HERO_IDS.filter((heroId) =>
        isHeroUnlocked(heroId, gangLevel),
      ).map((heroId) => {
        const currentRow =
          formation.find((slot) => slot.heroId === heroId)?.row ??
          heroesConfig.heroes[heroId].role
        return unitPower(
          currentRow,
          getHeroCombatStats(
            heroId,
            heroLevels[heroId],
            equipmentByHero[heroId],
            progression,
          ),
        )
      }),
      completedBuildingPowers: BUILDING_IDS.filter((buildingId) =>
        isBuildingUnlocked(buildingId, gangLevel),
      ).map((buildingId) =>
        getBuildingPower(buildingId, buildingProgress[buildingId].level),
      ),
    })
  }, [
    buildingProgress,
    carPartInventory,
    carPartSlotsByCar,
    equipmentByHero,
    formation,
    gangLevel,
    gunLevels,
    heroLevels,
  ])
  // tick subscription forces a recompute when AdventureIdleClock advances.
  const claimable = getClaimableIdleExp(
    idleClock,
    highestClearedStage,
    tick > 0 || now > 0 ? now : idleClock,
  )
  const adventureDot = hasAdventureRedDot(highestClearedStage, claimable)
  const heroesDot = hasHeroesRedDot(heroLevels, sharedExp, gangLevel)
  const currentChapter = getChapterForGangLevel(gangLevel)
  const chapterSnapshot = {
    heroLevels,
    gunLevels,
    carPartInventory,
    highestClearedStage,
    highestClearedRacingStage,
    buildingProgress,
  }
  const chapterClaimable =
    currentChapter.tasks.some(
      (task) =>
        !claimedTaskIds.includes(task.id) &&
        getTaskProgress(task, chapterSnapshot).complete,
    ) ||
    (!claimedChapterNumbers.includes(currentChapter.number) &&
      currentChapter.tasks.every(
        (task) => getTaskProgress(task, chapterSnapshot).complete,
      ))
  const nextGangLevel = Math.min(GANG_MAX_LEVEL, gangLevel + 1)
  const crossesRole =
    gangLevel < GANG_MAX_LEVEL &&
    getGangRole(gangLevel).threshold !== getGangRole(nextGangLevel).threshold
  const chapterComplete =
    isChapterComplete(currentChapter, chapterSnapshot) &&
    claimedChapterNumbers.includes(currentChapter.number)
  const gangPromotionReady =
    gangLevel < GANG_MAX_LEVEL &&
    totalReputation >= getTotalReputationForLevel(nextGangLevel) &&
    (!crossesRole || chapterComplete)

  return (
    <section className="global-hud" aria-label="主界面 HUD">
      <div className="global-hud__top">
        <button
          type="button"
          className="global-hud__avatar"
          aria-label="打开英雄培养"
          onClick={props.onOpenHeroes}
        >
          Thomas Shelby
        </button>
        <button
          type="button"
          className="global-hud__gang"
          data-promotion-ready={gangPromotionReady}
          onClick={props.onOpenGangTree}
        >
          <span>{`Lv.${gangLevel} ${role.title}（${role.chineseTitle}）`}</span>
          <ResourceAmount kind="power" amount={totalPower} />
          {gangPromotionReady ? (
            <span
              className="global-hud__promotion-ready"
              aria-label="帮派等级可晋升"
            >
              可晋升
            </span>
          ) : null}
        </button>
        <div className="global-hud__resources" aria-label="资源">
          <ResourceAmount
            kind="money"
            amount={Math.trunc(resources.money)}
            showLabel={false}
          />
          <ResourceAmount
            kind="oil"
            amount={Math.trunc(resources.oil)}
            showLabel={false}
          />
          <ResourceAmount
            kind="materials"
            amount={Math.trunc(resources.materials)}
            showLabel={false}
          />
        </div>
      </div>
      <button
        type="button"
        className="global-hud__chapter"
        onClick={props.onOpenChapters}
      >
        <span>{`章节 ${currentChapter.number}`}</span>
        <small>{currentChapter.title.replace(/^第.+? · /, '')}</small>
        {chapterClaimable ? (
          <span className="global-hud__dot" aria-label="有章节奖励可领取" />
        ) : null}
      </button>
      <nav className="global-hud__bottom" aria-label="主导航">
        <button
          type="button"
          className="global-hud__nav"
          onClick={props.onOpenRacing}
        >
          赛车
        </button>
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
