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
  CHAPTERS,
  getChapterByNumber,
  getChapterForGangLevel,
  getChapterTasks,
  getTaskProgress,
} from '../game/chapterProgression'
import { BUILDING_IDS } from '../game/cityTypes'
import { getAccountTotalPower, unitPower } from '../game/combat/power'
import { getHeroCombatStats } from '../game/heroEquipment'
import { HERO_IDS, isHeroUnlocked } from '../game/heroes'
import { getPrologueVisibility } from '../game/prologue'
import {
  getStoryRank,
  getStoryStep,
  getStoryVisibility,
} from '../game/storyPlanC'
import {
  getClaimableIdleExp,
  useAdventureStore,
} from '../store/useAdventureStore'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import {
  getChapterProgressSnapshot,
  useChapterStore,
} from '../store/useChapterStore'
import { hasAdventureRedDot, hasHeroesRedDot } from './redDots'
import { ResourceAmount } from './ResourceAmount'

export interface GlobalHudProps {
  onOpenHeroes: () => void
  onOpenGangTree: () => void
  onOpenChapters?: () => void
  onOpenAdventure: () => void
  onOpenRacing?: () => void
  onOpenSettings: () => void
  storyStepNumber?: number
}

export function GlobalHud(props: GlobalHudProps): JSX.Element {
  const resources = useCityStore((s) => s.resources)
  const buildingProgress = useCityStore((s) => s.buildingProgress)
  const claimedBuildingIds = useCityStore((s) => s.claimedBuildingIds)
  const gangLevel = useGangStore((s) => s.currentLevel)
  const totalReputation = useGangStore((s) => s.totalReputation)
  const heroLevels = useAdventureStore((s) => s.heroLevels)
  const equipmentByHero = useAdventureStore((s) => s.equipmentByHero)
  const formation = useAdventureStore((s) => s.formation)
  const gunLevels = useAdventureStore((s) => s.gunLevels)
  const carPartInventory = useAdventureStore((s) => s.carPartInventory)
  const carPartSlotsByCar = useAdventureStore((s) => s.carPartSlotsByCar)
  useAdventureStore((s) => s.carPartUpgradeCount)
  useAdventureStore((s) => s.spareParts)
  const sharedExp = useAdventureStore((s) => s.sharedExp)
  const highestClearedStage = useAdventureStore((s) => s.highestClearedStage)
  useAdventureStore((s) => s.highestClearedRacingStage)
  const claimedTaskIds = useChapterStore((s) => s.claimedTaskIds)
  const claimedChapterNumbers = useChapterStore((s) => s.claimedChapterNumbers)
  const activeChapterNumber = useChapterStore((s) => s.activeChapterNumber)
  const prologueStep = useChapterStore((s) => s.prologueStep)
  const selectedTaskPackageIds = useChapterStore(
    (s) => s.selectedTaskPackageIds,
  )
  const idleClock = useAdventureStore((s) => s.idleClock)
  const tick = useChestTick((s) => s.tick)
  const now = useChestTick((s) => s.now)
  const role = getGangRole(gangLevel)
  const storyStep =
    props.storyStepNumber === undefined
      ? null
      : getStoryStep(props.storyStepNumber)
  const storyRank =
    props.storyStepNumber === undefined
      ? null
      : getStoryRank(props.storyStepNumber)
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
  const currentChapter = getChapterByNumber(activeChapterNumber) ?? CHAPTERS[0]
  const currentChapterTasks = getChapterTasks(
    currentChapter.number,
    selectedTaskPackageIds[currentChapter.number],
  )
  const chapterSnapshot = getChapterProgressSnapshot()
  const chapterClaimable =
    currentChapterTasks.some(
      (task) =>
        !claimedTaskIds.includes(task.id) &&
        getTaskProgress(task, chapterSnapshot).complete,
    ) ||
    (!claimedChapterNumbers.includes(currentChapter.number) &&
      currentChapterTasks.length > 0 &&
      currentChapterTasks.every(
        (task) => getTaskProgress(task, chapterSnapshot).complete,
      ))
  const nextGangLevel = Math.min(GANG_MAX_LEVEL, gangLevel + 1)
  const crossesRole =
    gangLevel < GANG_MAX_LEVEL &&
    getGangRole(gangLevel).threshold !== getGangRole(nextGangLevel).threshold
  const roleChapter = getChapterForGangLevel(gangLevel)
  const chapterComplete = claimedChapterNumbers.includes(roleChapter.number)
  const gangPromotionReady =
    gangLevel < GANG_MAX_LEVEL &&
    totalReputation >= getTotalReputationForLevel(nextGangLevel) &&
    (!crossesRole || chapterComplete)
  const legacyVisibility = getPrologueVisibility(prologueStep)
  const storyVisibility =
    props.storyStepNumber === undefined
      ? null
      : getStoryVisibility(props.storyStepNumber)
  const visibility = storyVisibility
    ? {
        heroes: storyVisibility.heroes,
        gangTree: storyVisibility.gangStatus,
        chapters: false,
        campaign: storyVisibility.campaign,
      }
    : legacyVisibility
  const visibleResources = [
    storyVisibility
      ? storyVisibility.money
        ? ('money' as const)
        : null
      : claimedBuildingIds.includes('repair-shop') ||
          claimedBuildingIds.includes('commercial-street')
        ? ('money' as const)
        : null,
    storyVisibility
      ? storyVisibility.oil
        ? ('oil' as const)
        : null
      : claimedBuildingIds.includes('gas-station')
        ? ('oil' as const)
        : null,
    storyVisibility
      ? storyVisibility.materials
        ? ('materials' as const)
        : null
      : claimedBuildingIds.includes('metalworking-plant')
        ? ('materials' as const)
        : null,
  ].filter((resource) => resource !== null)

  return (
    <section className="global-hud" aria-label="主界面 HUD">
      {visibility.heroes ||
      visibility.gangTree ||
      visibleResources.length > 0 ? (
        <div className="global-hud__top">
          {visibility.heroes ? (
            <button
              type="button"
              className="global-hud__avatar"
              aria-label="打开英雄培养"
              onClick={props.onOpenHeroes}
            >
              Thomas Shelby
            </button>
          ) : null}
          {visibility.gangTree ? (
            <button
              type="button"
              className="global-hud__gang"
              data-promotion-ready={
                storyVisibility ? undefined : gangPromotionReady
              }
              onClick={props.onOpenGangTree}
            >
              <span>
                {storyRank
                  ? `T${storyRank.tier} ${storyRank.title}（${storyRank.chineseTitle}）`
                  : `Lv.${gangLevel} ${role.title}（${role.chineseTitle}）`}
              </span>
              <ResourceAmount kind="power" amount={totalPower} />
              {!storyVisibility && gangPromotionReady ? (
                <span
                  className="global-hud__promotion-ready"
                  aria-label="帮派等级可晋升"
                >
                  可晋升
                </span>
              ) : null}
            </button>
          ) : null}
          {visibleResources.length > 0 ? (
            <div className="global-hud__resources" aria-label="资源">
              {visibleResources.includes('money') ? (
                <ResourceAmount
                  kind="money"
                  amount={Math.trunc(resources.money)}
                  showLabel={false}
                />
              ) : null}
              {visibleResources.includes('oil') ? (
                <ResourceAmount
                  kind="oil"
                  amount={Math.trunc(resources.oil)}
                  showLabel={false}
                />
              ) : null}
              {visibleResources.includes('materials') ? (
                <ResourceAmount
                  kind="materials"
                  amount={Math.trunc(resources.materials)}
                  showLabel={false}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {visibility.chapters ? (
        <button
          type="button"
          className="global-hud__chapter"
          onClick={props.onOpenChapters}
        >
          <span>
            {storyStep
              ? `方案 C · ACT ${storyStep.act}`
              : prologueStep === 'complete'
                ? `章节 ${currentChapter.number} / ${CHAPTERS.length}`
                : '序章 · 转正任务'}
          </span>
          <small>
            {storyStep
              ? `L${String(storyStep.number).padStart(2, '0')} · ${storyStep.title}`
              : prologueStep === 'complete'
                ? currentChapter.title.replace(/^第.+? · /, '')
                : '完成三项见习职责'}
          </small>
          {!storyVisibility && chapterClaimable ? (
            <span className="global-hud__dot" aria-label="有章节奖励可领取" />
          ) : null}
        </button>
      ) : null}
      <nav className="global-hud__bottom" aria-label="主导航">
        {visibility.campaign ? (
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
        ) : null}
        {visibility.heroes ? (
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
        ) : null}
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
