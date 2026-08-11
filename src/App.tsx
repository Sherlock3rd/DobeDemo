import { Loader } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type JSX,
} from 'react'
import { AdventureIdleClock } from './game/AdventureIdleClock'
import { BuildingUpgradeController } from './game/BuildingUpgradeController'
import { EconomyIdleController } from './game/EconomyIdleController'
import { PartSalvageController } from './game/PartSalvageController'
import {
  getChapterForGangLevel,
  type ChapterTaskRequirement,
} from './game/chapterProgression'
import type { BuildingId } from './game/cityTypes'
import {
  PROLOGUE_TASK_IDS,
  PROLOGUE_TUNED_PART_ID,
  isTutorialPartInstalled,
} from './game/prologue'
import {
  STORY_COMPLETE_STEP,
  getStoryClaimBuilding,
  getStoryRank,
  getStoryStep,
} from './game/storyPlanB'
import {
  getNarrativeEvent,
  type NarrativeEvent,
  type NarrativeEventId,
} from './game/narrative'
import { CAMERA_CONFIG } from './game/cityLayout'
import { CityScene } from './scene/city/CityScene'
import { useAdventureStore } from './store/useAdventureStore'
import { useCityStore } from './store/useCityStore'
import { useChapterStore } from './store/useChapterStore'
import { useGangStore } from './store/useGangStore'
import { useStoryStore } from './store/useStoryStore'
import { AdventurePanel } from './ui/AdventurePanel'
import { AppErrorBoundary } from './ui/AppErrorBoundary'
import { BattleScreen } from './ui/BattleScreen'
import { BuildingPanel } from './ui/BuildingPanel'
import { FormationPanel } from './ui/FormationPanel'
import { GangTreePanel } from './ui/GangTreePanel'
import { ChapterPanel } from './ui/ChapterPanel'
import { ChapterAssessmentMeeting } from './ui/ChapterAssessmentMeeting'
import { GlobalHud } from './ui/GlobalHud'
import { HeroesPanel, type DevelopmentTab } from './ui/HeroesPanel'
import { RacingPanel } from './ui/RacingPanel'
import { RaceScreen } from './ui/RaceScreen'
import type { HeroId } from './game/heroes'
import { getRoleHandover } from './game/roleHandover'
import { SettingsPanel } from './ui/SettingsPanel'
import { NarrativeDialogueOverlay } from './ui/NarrativeDialogueOverlay'
import { ProgressionMilestoneOverlay } from './ui/ProgressionMilestoneOverlay'
import { RoleHandoverOverlay } from './ui/RoleHandoverOverlay'
import { PrologueGuide } from './ui/PrologueGuide'
import { PrologueShootOverlay } from './ui/PrologueShootOverlay'
import { StoryBeatOverlay } from './ui/StoryBeatOverlay'
import { StoryCouncilOverlay } from './ui/StoryCouncilOverlay'
import { StoryGangTreePanel } from './ui/StoryGangTreePanel'
import { StoryProgressGuide } from './ui/StoryProgressGuide'
import { StoryRoadmapPanel } from './ui/StoryRoadmapPanel'
import {
  CarDismantleOverlay,
  CarModificationOverlay,
} from './ui/VehicleWorkshopOverlay'
import './App.css'

export type ActiveOverlay =
  | { kind: 'none' }
  | { kind: 'buildingDetail'; buildingId: BuildingId }
  | { kind: 'gangTree' }
  | { kind: 'chapters' }
  | { kind: 'settings' }
  | { kind: 'adventure' }
  | { kind: 'formation'; stage: number }
  | { kind: 'heroes'; initialTab?: DevelopmentTab }
  | { kind: 'battle'; stage: number }
  | { kind: 'racing' }
  | { kind: 'race'; stage: number; heroId: HeroId }
  | { kind: 'buildingUnlock'; buildingId: BuildingId }
  | { kind: 'chapterComplete'; chapterNumber: number }
  | { kind: 'assessmentMeeting'; completedChapterNumber: number }
  | { kind: 'roleHandover'; targetLevel: number }
  | { kind: 'roleHandoverBattle'; targetLevel: number; stage: number }
  | { kind: 'roleHandoverRace'; targetLevel: number; stage: number }
  | { kind: 'prologueShoot' }
  | { kind: 'storyBeat' }
  | { kind: 'storyRoadmap' }
  | { kind: 'storyGangTree' }
  | { kind: 'storyCouncil' }
  | { kind: 'storyCarCustomize' }
  | { kind: 'storyCarDismantle' }

type PlayOverlay = Exclude<ActiveOverlay, { kind: 'buildingDetail' }>

const FULLSCREEN_KINDS = new Set([
  'adventure',
  'formation',
  'heroes',
  'battle',
  'racing',
  'race',
  'chapters',
  'chapterComplete',
  'assessmentMeeting',
  'roleHandover',
  'roleHandoverBattle',
  'roleHandoverRace',
  'prologueShoot',
  'storyBeat',
  'storyRoadmap',
  'storyGangTree',
  'storyCouncil',
  'storyCarCustomize',
  'storyCarDismantle',
])
const MODAL_KINDS = new Set([
  'gangTree',
  'settings',
  'adventure',
  'formation',
  'heroes',
  'battle',
  'racing',
  'race',
  'chapters',
  'buildingUnlock',
  'chapterComplete',
  'assessmentMeeting',
  'roleHandover',
  'roleHandoverBattle',
  'roleHandoverRace',
  'prologueShoot',
  'storyBeat',
  'storyRoadmap',
  'storyGangTree',
  'storyCouncil',
  'storyCarCustomize',
  'storyCarDismantle',
])

interface QueuedNarrative {
  event: NarrativeEvent
  after?:
    | 'gangTree'
    | 'chapters'
    | { kind: 'assessmentMeeting'; completedChapterNumber: number }
}

function resolveActiveOverlay(
  playOverlay: PlayOverlay,
  selectedBuildingId: BuildingId | null,
): ActiveOverlay {
  if (playOverlay.kind !== 'none') return playOverlay
  if (selectedBuildingId) {
    return { kind: 'buildingDetail', buildingId: selectedBuildingId }
  }
  return { kind: 'none' }
}

export default function App(): JSX.Element {
  const [playOverlay, setPlayOverlay] = useState<PlayOverlay>({ kind: 'none' })
  const [narrativeQueue, setNarrativeQueue] = useState<QueuedNarrative[]>([])
  const [promotionCeremonyLevel, setPromotionCeremonyLevel] = useState<
    number | null
  >(null)
  const queuedNarrativeIdsRef = useRef(new Set<NarrativeEventId>())
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const pendingFocusRestoreRef = useRef(false)
  const selectedBuildingId = useCityStore((s) => s.selectedBuildingId)
  const selectBuilding = useCityStore((s) => s.selectBuilding)
  const clearSelection = useCityStore((s) => s.clearSelection)
  const gangLevel = useGangStore((s) => s.currentLevel)
  const claimedBuildingIds = useCityStore((s) => s.claimedBuildingIds)
  const buildingProgress = useCityStore((s) => s.buildingProgress)
  const seenNarrativeIds = useChapterStore((s) => s.seenNarrativeIds)
  const markNarrativeSeen = useChapterStore((s) => s.markNarrativeSeen)
  const activeChapterNumber = useChapterStore((s) => s.activeChapterNumber)
  const prologueStep = useChapterStore((s) => s.prologueStep)
  const advancePrologue = useChapterStore((s) => s.advancePrologue)
  const claimedTaskIds = useChapterStore((s) => s.claimedTaskIds)
  const claimChapterReward = useChapterStore((s) => s.claimChapterReward)
  const completeAssessment = useChapterStore((s) => s.completeAssessment)
  const grantProloguePart = useAdventureStore((s) => s.grantProloguePart)
  const grantPrologueGun = useAdventureStore((s) => s.grantPrologueGun)
  const grantChapterReward = useAdventureStore((s) => s.grantChapterReward)
  const tutorialEnginePartId = useAdventureStore(
    (s) => s.carPartSlotsByCar['rust-fox'].engine,
  )
  const reconcileWithGang = useAdventureStore((s) => s.reconcileWithGang)
  const storyEnabled = useStoryStore((s) => s.enabled)
  const storyStepNumber = useStoryStore((s) => s.currentStepNumber)
  const storyBriefedStepNumbers = useStoryStore((s) => s.briefedStepNumbers)
  const advanceStory = useStoryStore((s) => s.advance)
  const markStoryBriefed = useStoryStore((s) => s.markBriefed)
  const storyStep = storyEnabled ? getStoryStep(storyStepNumber) : null
  const storyClaimBuilding = storyEnabled
    ? getStoryClaimBuilding(storyStepNumber)
    : null
  const activeOverlay = resolveActiveOverlay(playOverlay, selectedBuildingId)
  const activeNarrative = narrativeQueue[0] ?? null

  const enqueueNarrative = useCallback(
    (
      eventId: NarrativeEventId,
      after?:
        | 'gangTree'
        | 'chapters'
        | { kind: 'assessmentMeeting'; completedChapterNumber: number },
    ): void => {
      if (
        seenNarrativeIds.includes(eventId) ||
        queuedNarrativeIdsRef.current.has(eventId)
      ) {
        return
      }
      const event = getNarrativeEvent(eventId)
      if (!event) return
      queuedNarrativeIdsRef.current.add(eventId)
      setNarrativeQueue((current) => [...current, { event, after }])
    },
    [seenNarrativeIds],
  )

  useEffect(() => {
    const reconcileWhenBothHydrated = (): void => {
      if (
        !useAdventureStore.persist.hasHydrated() ||
        !useGangStore.persist.hasHydrated() ||
        !useCityStore.persist.hasHydrated()
      ) {
        return
      }
      const level = useGangStore.getState().currentLevel
      useAdventureStore.getState().reconcileWithGang(level)
      useAdventureStore.getState().syncCityRewardMoney()
    }

    const unsubAdventure = useAdventureStore.persist.onFinishHydration(
      reconcileWhenBothHydrated,
    )
    const unsubGang = useGangStore.persist.onFinishHydration(
      reconcileWhenBothHydrated,
    )
    const unsubCity = useCityStore.persist.onFinishHydration(
      reconcileWhenBothHydrated,
    )
    reconcileWhenBothHydrated()

    return () => {
      unsubAdventure()
      unsubGang()
      unsubCity()
    }
  }, [])

  useEffect(() => {
    if (
      !useAdventureStore.persist.hasHydrated() ||
      !useGangStore.persist.hasHydrated()
    ) {
      return
    }
    reconcileWithGang(gangLevel)
  }, [gangLevel, reconcileWithGang])

  useEffect(() => {
    if (
      storyEnabled ||
      playOverlay.kind !== 'none' ||
      !useGangStore.persist.hasHydrated() ||
      !useChapterStore.persist.hasHydrated()
    ) {
      return
    }
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      switch (prologueStep) {
        case 'opening-dialogue':
          enqueueNarrative('prologue:police-chase')
          return
        case 'bo-invitation':
          enqueueNarrative('prologue:bo-invitation')
          return
        case 'garage-dialogue':
          enqueueNarrative('prologue:garage')
          return
        case 'ambush-dialogue':
          enqueueNarrative('prologue:ambush')
          return
        case 'prospect-invitation':
          enqueueNarrative('prologue:prospect')
          return
        case 'tasks-dialogue':
          enqueueNarrative('prologue:tasks')
          return
        case 'gun-gift':
          enqueueNarrative('prologue:gun-gift')
          return
        case 'gang-dialogue':
          enqueueNarrative('prologue:gang-training')
          return
        case 'police-race':
          setPlayOverlay({ kind: 'race', stage: 1, heroId: 'foreman' })
          return
        case 'part-tutorial':
          setPlayOverlay({ kind: 'heroes', initialTab: 'car' })
          return
        case 'escape-race':
          setPlayOverlay({ kind: 'race', stage: 2, heroId: 'foreman' })
          return
        case 'borrowed-shooting':
          setPlayOverlay({ kind: 'prologueShoot' })
          return
        case 'gun-race':
          setPlayOverlay({ kind: 'race', stage: 3, heroId: 'foreman' })
          return
        case 'meeting':
          setPlayOverlay({
            kind: 'assessmentMeeting',
            completedChapterNumber: 1,
          })
          return
        case 'formal-promotion':
          setPlayOverlay({ kind: 'gangTree' })
          return
        case 'chapter-briefing':
          if (seenNarrativeIds.includes('chapter-start:2')) {
            setPlayOverlay({ kind: 'chapters' })
          } else {
            enqueueNarrative('chapter-start:2', 'chapters')
          }
          return
        case 'recycling-takeover':
          return
        case 'complete':
          enqueueNarrative(`chapter-start:${activeChapterNumber}`)
          return
        case 'prospect-tasks':
        case 'gang-training':
          return
      }
    })
    return () => {
      cancelled = true
    }
  }, [
    activeChapterNumber,
    enqueueNarrative,
    playOverlay.kind,
    prologueStep,
    seenNarrativeIds,
    storyEnabled,
  ])

  useEffect(() => {
    if (
      storyEnabled ||
      prologueStep !== 'part-tutorial' ||
      !isTutorialPartInstalled(tutorialEnginePartId)
    ) {
      return
    }
    if (advancePrologue('part-tutorial', 'ambush-dialogue')) {
      queueMicrotask(() => setPlayOverlay({ kind: 'none' }))
    }
  }, [advancePrologue, prologueStep, storyEnabled, tutorialEnginePartId])

  useEffect(() => {
    if (
      storyEnabled ||
      prologueStep !== 'prospect-tasks' ||
      !PROLOGUE_TASK_IDS.every((taskId) => claimedTaskIds.includes(taskId))
    ) {
      return
    }
    if (
      claimChapterReward(1) &&
      advancePrologue('prospect-tasks', 'gun-gift')
    ) {
      queueMicrotask(() => setPlayOverlay({ kind: 'none' }))
    }
  }, [
    advancePrologue,
    claimChapterReward,
    claimedTaskIds,
    prologueStep,
    storyEnabled,
  ])

  const advanceStoryStep = useCallback(
    (expectedStepNumber: number): boolean => {
      if (!advanceStory(expectedStepNumber)) return false

      if (expectedStepNumber === 6) {
        useCityStore.getState().grantRewardResources('story-b:first-money', {
          money: 500,
          oil: 0,
          materials: 0,
        })
      }
      if (expectedStepNumber === 8) {
        useGangStore.getState().addReputation(90, Date.now())
      }
      if (expectedStepNumber === 15) {
        grantChapterReward({
          gangReputation: 0,
          heroExperience: 0,
          spareParts: 25,
          carParts: [{ slot: 'suspension', quality: 'common' }],
        })
      }
      if (expectedStepNumber === 20) {
        grantChapterReward({
          gangReputation: 0,
          heroExperience: 0,
          spareParts: 0,
          carParts: [],
          resources: { money: 0, oil: 0, materials: 0 },
          unlockCarIds: ['iron-fang'],
          unlockGunIds: [],
        })
      }
      if (expectedStepNumber === 38) {
        grantChapterReward({
          gangReputation: 0,
          heroExperience: 0,
          spareParts: 0,
          carParts: [],
          resources: { money: 0, oil: 0, materials: 0 },
          unlockCarIds: [],
          unlockGunIds: ['industrial-carbine'],
        })
      }
      if (expectedStepNumber === 41) {
        grantChapterReward({
          gangReputation: 0,
          heroExperience: 0,
          spareParts: 0,
          carParts: [],
          resources: { money: 0, oil: 0, materials: 0 },
          unlockCarIds: ['black-throne'],
          unlockGunIds: [],
        })
      }

      const nextStepNumber = Math.min(
        STORY_COMPLETE_STEP,
        expectedStepNumber + 1,
      )
      const targetSystemLevel = getStoryRank(nextStepNumber).systemLevel
      let guard = 0
      while (
        useGangStore.getState().currentLevel < targetSystemLevel &&
        guard < 50
      ) {
        useGangStore.getState().advanceOneLevel(Date.now())
        guard += 1
      }
      reconcileWithGang(useGangStore.getState().currentLevel)
      return true
    },
    [advanceStory, grantChapterReward, reconcileWithGang],
  )

  useEffect(() => {
    if (
      !storyEnabled ||
      !useStoryStore.persist.hasHydrated() ||
      storyStepNumber >= STORY_COMPLETE_STEP ||
      playOverlay.kind !== 'none' ||
      selectedBuildingId !== null ||
      activeNarrative !== null ||
      storyBriefedStepNumbers.includes(storyStepNumber)
    ) {
      return
    }
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setPlayOverlay({ kind: 'storyBeat' })
    })
    return () => {
      cancelled = true
    }
  }, [
    activeNarrative,
    playOverlay.kind,
    selectedBuildingId,
    storyBriefedStepNumbers,
    storyEnabled,
    storyStepNumber,
  ])

  useEffect(() => {
    if (!storyEnabled || !storyStep) return
    if (
      storyStep.action.kind === 'building-claim' &&
      claimedBuildingIds.includes(storyStep.action.buildingId)
    ) {
      advanceStoryStep(storyStep.number)
      return
    }
    if (
      storyStep.action.kind === 'building-upgrade' &&
      (buildingProgress[storyStep.action.buildingId].childLevels[0] ?? 0) >= 1
    ) {
      advanceStoryStep(storyStep.number)
    }
  }, [
    advanceStoryStep,
    buildingProgress,
    claimedBuildingIds,
    storyEnabled,
    storyStep,
  ])

  const openOverlay = (overlay: PlayOverlay): void => {
    if (document.activeElement instanceof HTMLElement) {
      returnFocusRef.current = document.activeElement
    }
    clearSelection()
    setPlayOverlay(overlay)
  }

  const closeOverlay = (): void => {
    if (activeOverlay.kind === 'buildingDetail') {
      clearSelection()
    } else if (activeOverlay.kind !== 'none') {
      pendingFocusRestoreRef.current = true
    }
    setPlayOverlay({ kind: 'none' })
  }

  const startStoryAction = (): void => {
    if (!storyEnabled || !storyStep) return
    markStoryBriefed(storyStep.number)

    switch (storyStep.action.kind) {
      case 'continue':
        advanceStoryStep(storyStep.number)
        setPlayOverlay({ kind: 'none' })
        return
      case 'race':
        if (storyStep.action.stage >= 2) grantPrologueGun()
        setPlayOverlay({
          kind: 'race',
          stage: storyStep.action.stage,
          heroId: 'foreman',
        })
        return
      case 'heroes':
        advanceStoryStep(storyStep.number)
        setPlayOverlay({ kind: 'heroes', initialTab: storyStep.action.tab })
        return
      case 'car-customize':
        if (storyStep.action.scenario === 'tune-engine') {
          grantProloguePart()
        }
        setPlayOverlay({ kind: 'storyCarCustomize' })
        return
      case 'car-dismantle':
        setPlayOverlay({ kind: 'storyCarDismantle' })
        return
      case 'building-claim':
        setPlayOverlay({ kind: 'none' })
        return
      case 'building-upgrade':
        setPlayOverlay({ kind: 'none' })
        if (claimedBuildingIds.includes(storyStep.action.buildingId)) {
          selectBuilding(storyStep.action.buildingId)
        }
        return
      case 'campaign':
        setPlayOverlay({ kind: 'adventure' })
        return
      case 'gang-tree':
        setPlayOverlay({ kind: 'storyGangTree' })
        return
      case 'meeting':
        setPlayOverlay({ kind: 'storyCouncil' })
    }
  }

  const finishStoryRace = (stage: number): void => {
    const currentStepNumber = useStoryStore.getState().currentStepNumber
    const currentStep = getStoryStep(currentStepNumber)
    const cleared =
      useAdventureStore.getState().highestClearedRacingStage >= stage
    if (
      storyEnabled &&
      currentStep?.action.kind === 'race' &&
      currentStep.action.stage === stage &&
      cleared
    ) {
      advanceStoryStep(currentStepNumber)
      setPlayOverlay({ kind: 'none' })
      return
    }
    setPlayOverlay({ kind: 'storyBeat' })
  }

  const finishStoryCampaign = (): boolean => {
    const currentStepNumber = useStoryStore.getState().currentStepNumber
    const currentStep = getStoryStep(currentStepNumber)
    if (
      !storyEnabled ||
      currentStep?.action.kind !== 'campaign' ||
      useAdventureStore.getState().highestClearedStage <
        currentStep.action.targetStage
    ) {
      return false
    }
    advanceStoryStep(currentStepNumber)
    setPlayOverlay({ kind: 'none' })
    return true
  }

  const finishStoryCarCustomization = (): void => {
    const currentStepNumber = useStoryStore.getState().currentStepNumber
    const currentStep = getStoryStep(currentStepNumber)
    if (!storyEnabled || currentStep?.action.kind !== 'car-customize') return

    if (currentStep.action.scenario === 'tune-engine') {
      grantProloguePart()
      const result = useAdventureStore
        .getState()
        .equipCarPart(
          'rust-fox',
          PROLOGUE_TUNED_PART_ID,
          useGangStore.getState().currentLevel,
        )
      if (!result.applied) return
      grantPrologueGun()
    }
    if (currentStep.action.scenario === 'race-prep') {
      const adventure = useAdventureStore.getState()
      const recoveredSuspension = [...adventure.carPartInventory]
        .reverse()
        .find((part) => part.slot === 'suspension')
      if (recoveredSuspension) {
        adventure.equipCarPart(
          'rust-fox',
          recoveredSuspension.id,
          useGangStore.getState().currentLevel,
        )
      }
    }
    advanceStoryStep(currentStepNumber)
    setPlayOverlay({ kind: 'none' })
  }

  const finishStoryCarDismantle = (): void => {
    const currentStepNumber = useStoryStore.getState().currentStepNumber
    const currentStep = getStoryStep(currentStepNumber)
    if (!storyEnabled || currentStep?.action.kind !== 'car-dismantle') return

    advanceStoryStep(currentStepNumber)
    setPlayOverlay({ kind: 'none' })
  }

  const completeRoleHandover = (targetLevel: number): void => {
    const gang = useGangStore.getState()
    if (gang.currentLevel + 1 !== targetLevel) {
      setPlayOverlay({ kind: 'gangTree' })
      return
    }
    const chapter = getChapterForGangLevel(gang.currentLevel)
    const chapterComplete = useChapterStore
      .getState()
      .claimedChapterNumbers.includes(chapter.number)
    const result = gang.promoteOneLevel(Date.now(), chapterComplete)
    if (result.applied) {
      setPromotionCeremonyLevel(targetLevel)
    }
    setPlayOverlay({ kind: 'gangTree' })
  }

  const navigateFromChapter = (requirement: ChapterTaskRequirement): void => {
    switch (requirement.kind) {
      case 'building-claimed':
        setPlayOverlay({ kind: 'none' })
        if (
          requirement.buildingId === 'recycling-yard' &&
          prologueStep === 'chapter-briefing'
        ) {
          advancePrologue('chapter-briefing', 'recycling-takeover')
        }
        if (claimedBuildingIds.includes(requirement.buildingId)) {
          selectBuilding(requirement.buildingId)
        }
        return
      case 'building-level':
        setPlayOverlay({ kind: 'none' })
        if (claimedBuildingIds.includes(requirement.buildingId)) {
          selectBuilding(requirement.buildingId)
        }
        return
      case 'hero-level':
        setPlayOverlay({ kind: 'heroes', initialTab: 'level' })
        return
      case 'part-level':
      case 'part-upgrades':
      case 'part-installed':
        setPlayOverlay({ kind: 'heroes', initialTab: 'car' })
        return
      case 'gun-level':
        setPlayOverlay({ kind: 'heroes', initialTab: 'gun' })
        return
      case 'campaign-clears':
        setPlayOverlay({ kind: 'adventure' })
        return
      case 'racing-clears':
        setPlayOverlay({ kind: 'racing' })
        return
      case 'gang-level':
        setPlayOverlay({ kind: 'gangTree' })
        return
      case 'resource-money':
      case 'resource-oil':
      case 'resource-materials':
        setPlayOverlay({ kind: 'none' })
        return
      case 'spare-parts':
      case 'total-power':
      case 'car-power':
        setPlayOverlay({ kind: 'heroes', initialTab: 'car' })
    }
  }

  useEffect(() => {
    if (activeOverlay.kind !== 'none' || !pendingFocusRestoreRef.current) {
      return
    }

    pendingFocusRestoreRef.current = false
    const target = returnFocusRef.current
    returnFocusRef.current = null
    if (target?.isConnected) {
      target.focus()
    }
  }, [activeOverlay.kind])

  useEffect(() => {
    if (activeOverlay.kind !== 'battle' && activeOverlay.kind !== 'race') {
      return
    }

    const currentFocus = document.activeElement
    if (
      currentFocus instanceof HTMLElement &&
      currentFocus !== document.body &&
      currentFocus.isConnected
    ) {
      return
    }

    const label = activeOverlay.kind === 'battle' ? '战斗' : '公路争霸'
    document
      .querySelector<HTMLElement>(
        `[role="dialog"][aria-label="${label}"] button:not(:disabled)`,
      )
      ?.focus()
  }, [activeOverlay.kind])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (
        activeNarrative ||
        activeOverlay.kind === 'none' ||
        activeOverlay.kind === 'battle' ||
        activeOverlay.kind === 'race' ||
        activeOverlay.kind === 'buildingUnlock' ||
        activeOverlay.kind === 'chapterComplete' ||
        activeOverlay.kind === 'assessmentMeeting' ||
        activeOverlay.kind === 'storyBeat' ||
        activeOverlay.kind === 'storyCouncil' ||
        activeOverlay.kind === 'storyCarCustomize' ||
        activeOverlay.kind === 'storyCarDismantle'
      ) {
        return
      }
      if (activeOverlay.kind === 'buildingDetail') {
        clearSelection()
        return
      }
      if (activeOverlay.kind === 'formation') {
        setPlayOverlay({ kind: 'adventure' })
        return
      }
      pendingFocusRestoreRef.current = true
      setPlayOverlay({ kind: 'none' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeNarrative, activeOverlay.kind, clearSelection])

  const hideCityCanvas = FULLSCREEN_KINDS.has(activeOverlay.kind)
  const isolateCityBackground =
    MODAL_KINDS.has(activeOverlay.kind) || activeNarrative !== null
  const isolateHud = activeOverlay.kind !== 'none' || activeNarrative !== null

  const finishActiveNarrative = (): void => {
    if (!activeNarrative) return
    const completedEventId = activeNarrative.event.id
    markNarrativeSeen(activeNarrative.event.id)
    queuedNarrativeIdsRef.current.delete(activeNarrative.event.id)
    setNarrativeQueue((current) => current.slice(1))
    switch (completedEventId) {
      case 'prologue:police-chase':
        if (advancePrologue('opening-dialogue', 'police-race')) {
          setPlayOverlay({ kind: 'race', stage: 1, heroId: 'foreman' })
        }
        return
      case 'prologue:bo-invitation':
        if (advancePrologue('bo-invitation', 'garage-dialogue')) {
          setPlayOverlay({ kind: 'none' })
          enqueueNarrative('prologue:garage')
        }
        return
      case 'prologue:garage':
        if (
          grantProloguePart() &&
          advancePrologue('garage-dialogue', 'part-tutorial')
        ) {
          setPlayOverlay({ kind: 'heroes', initialTab: 'car' })
        }
        return
      case 'prologue:ambush':
        if (advancePrologue('ambush-dialogue', 'escape-race')) {
          setPlayOverlay({ kind: 'race', stage: 2, heroId: 'foreman' })
        }
        return
      case 'prologue:prospect':
        if (advancePrologue('prospect-invitation', 'borrowed-shooting')) {
          setPlayOverlay({ kind: 'prologueShoot' })
        }
        return
      case 'prologue:tasks':
        if (advancePrologue('tasks-dialogue', 'prospect-tasks')) {
          setPlayOverlay({ kind: 'none' })
        }
        return
      case 'prologue:gun-gift':
        if (grantPrologueGun() && advancePrologue('gun-gift', 'gun-race')) {
          setPlayOverlay({ kind: 'race', stage: 3, heroId: 'foreman' })
        }
        return
      case 'prologue:gang-training':
        if (advancePrologue('gang-dialogue', 'gang-training')) {
          setPlayOverlay({ kind: 'gangTree' })
        }
        return
    }
    if (activeNarrative.after === 'gangTree') {
      setPlayOverlay({ kind: 'gangTree' })
    } else if (activeNarrative.after === 'chapters') {
      setPlayOverlay({ kind: 'chapters' })
    } else if (activeNarrative.after?.kind === 'assessmentMeeting') {
      setPlayOverlay(activeNarrative.after)
    }
  }

  const finishPrologueRace = (
    stage: 1 | 2 | 3,
    expected: 'police-race' | 'escape-race' | 'gun-race',
    next: 'bo-invitation' | 'prospect-invitation' | 'gang-dialogue',
  ): void => {
    if (useAdventureStore.getState().highestClearedRacingStage < stage) return
    if (advancePrologue(expected, next)) {
      setPlayOverlay({ kind: 'none' })
    }
  }

  const prologueRaceTitle =
    activeOverlay.kind !== 'race'
      ? null
      : storyEnabled &&
          storyStep?.action.kind === 'race' &&
          storyStep.action.stage === activeOverlay.stage
        ? storyStep.title
        : prologueStep === 'police-race' && activeOverlay.stage === 1
          ? '甩开警察'
          : prologueStep === 'escape-race' && activeOverlay.stage === 2
            ? '冲出镇外追杀'
            : prologueStep === 'gun-race' && activeOverlay.stage === 3
              ? '追杀敌方头车'
              : null
  const claimedPrologueTaskCount = PROLOGUE_TASK_IDS.filter((taskId) =>
    claimedTaskIds.includes(taskId),
  ).length

  return (
    <AppErrorBoundary>
      <main className="city-app">
        <div
          className={
            hideCityCanvas
              ? 'city-app__canvas-wrap city-app__canvas-wrap--hidden'
              : 'city-app__canvas-wrap'
          }
          aria-hidden={isolateCityBackground || undefined}
          inert={isolateCityBackground ? true : undefined}
        >
          <Canvas
            className="city-app__canvas"
            tabIndex={0}
            aria-label="工业城市 3D 场景"
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
              <CityScene
                guidedBuildingId={
                  storyEnabled
                    ? storyClaimBuilding
                    : prologueStep === 'recycling-takeover'
                      ? 'recycling-yard'
                      : null
                }
                takeoverBuildingId={
                  storyEnabled ? storyClaimBuilding : undefined
                }
                onBuildingClaimed={(buildingId) => {
                  if (storyEnabled && buildingId === storyClaimBuilding) {
                    advanceStoryStep(storyStepNumber)
                    setPlayOverlay({ kind: 'buildingUnlock', buildingId })
                    return
                  }
                  if (
                    buildingId === 'recycling-yard' &&
                    prologueStep === 'recycling-takeover'
                  ) {
                    advancePrologue('recycling-takeover', 'complete')
                  }
                  setPlayOverlay({ kind: 'buildingUnlock', buildingId })
                }}
              />
            </Suspense>
          </Canvas>
        </div>
        <Loader
          containerStyles={{ background: 'rgba(4, 10, 24, 0.92)' }}
          innerStyles={{ width: 'min(18rem, 72vw)' }}
          barStyles={{ background: '#ffd43b' }}
          dataStyles={{ color: '#f8fafc', fontSize: '0.875rem' }}
          dataInterpolation={(progress) =>
            `正在加载城市场景… ${progress.toFixed(0)}%`
          }
        />
        <EconomyIdleController />
        <BuildingUpgradeController />
        <PartSalvageController />
        <AdventureIdleClock />
        <div
          aria-hidden={isolateHud || undefined}
          inert={isolateHud ? true : undefined}
          hidden={isolateHud}
        >
          <GlobalHud
            onOpenHeroes={() => openOverlay({ kind: 'heroes' })}
            onOpenGangTree={() =>
              openOverlay({
                kind: storyEnabled ? 'storyGangTree' : 'gangTree',
              })
            }
            onOpenChapters={() =>
              openOverlay({
                kind: storyEnabled ? 'storyRoadmap' : 'chapters',
              })
            }
            onOpenAdventure={() => openOverlay({ kind: 'adventure' })}
            onOpenSettings={() => openOverlay({ kind: 'settings' })}
            storyStepNumber={storyEnabled ? storyStepNumber : undefined}
          />
          {storyEnabled ? (
            <StoryProgressGuide
              step={storyStep}
              onContinue={() => openOverlay({ kind: 'storyBeat' })}
              onOpenRoadmap={() => openOverlay({ kind: 'storyRoadmap' })}
            />
          ) : (
            <PrologueGuide
              step={prologueStep}
              claimedTasks={claimedPrologueTaskCount}
              onOpenHeroes={() =>
                openOverlay({ kind: 'heroes', initialTab: 'car' })
              }
              onOpenTasks={() => openOverlay({ kind: 'chapters' })}
              onOpenGangTree={() => openOverlay({ kind: 'gangTree' })}
            />
          )}
        </div>
        {activeOverlay.kind === 'buildingDetail' ? <BuildingPanel /> : null}
        {activeOverlay.kind === 'storyBeat' && storyStep ? (
          <StoryBeatOverlay
            step={storyStep}
            onAction={startStoryAction}
            onOpenRoadmap={() => setPlayOverlay({ kind: 'storyRoadmap' })}
          />
        ) : null}
        {activeOverlay.kind === 'storyRoadmap' ? (
          <StoryRoadmapPanel
            currentStepNumber={storyStepNumber}
            onClose={closeOverlay}
            onContinue={() => setPlayOverlay({ kind: 'storyBeat' })}
          />
        ) : null}
        {activeOverlay.kind === 'storyGangTree' ? (
          <StoryGangTreePanel
            currentStepNumber={storyStepNumber}
            canContinue={storyStep?.action.kind === 'gang-tree'}
            onContinue={() => {
              if (storyStep?.action.kind === 'gang-tree') {
                advanceStoryStep(storyStep.number)
              }
              setPlayOverlay({ kind: 'none' })
            }}
            onClose={closeOverlay}
          />
        ) : null}
        {activeOverlay.kind === 'storyCouncil' && storyStep ? (
          <StoryCouncilOverlay
            step={storyStep}
            onComplete={() => {
              advanceStoryStep(storyStep.number)
              setPlayOverlay({ kind: 'none' })
            }}
          />
        ) : null}
        {activeOverlay.kind === 'storyCarCustomize' ? (
          <CarModificationOverlay
            scenario={
              storyStep?.action.kind === 'car-customize'
                ? storyStep.action.scenario
                : 'tune-engine'
            }
            onComplete={finishStoryCarCustomization}
          />
        ) : null}
        {activeOverlay.kind === 'storyCarDismantle' ? (
          <CarDismantleOverlay
            scenario={
              storyStep?.action.kind === 'car-dismantle'
                ? storyStep.action.scenario
                : 'salvage-pair'
            }
            onComplete={finishStoryCarDismantle}
          />
        ) : null}
        <GangTreePanel
          open={activeOverlay.kind === 'gangTree'}
          onClose={closeOverlay}
          promotionCeremonyLevel={promotionCeremonyLevel}
          onPromotionCeremonyComplete={() => setPromotionCeremonyLevel(null)}
          onStartRoleHandover={(handover) =>
            setPlayOverlay({
              kind: 'roleHandover',
              targetLevel: handover.targetLevel,
            })
          }
          onRolePromoted={(level) => {
            if (level === 8 && prologueStep === 'formal-promotion') {
              if (advancePrologue('formal-promotion', 'chapter-briefing')) {
                enqueueNarrative('chapter-start:2', 'chapters')
              }
              return
            }
            enqueueNarrative(`promotion:${level}`)
          }}
          prologueMeetingReady={prologueStep === 'gang-training'}
          onStartPrologueMeeting={() => {
            if (advancePrologue('gang-training', 'meeting')) {
              setPlayOverlay({
                kind: 'assessmentMeeting',
                completedChapterNumber: 1,
              })
            }
          }}
          prologuePromotionReady={prologueStep === 'formal-promotion'}
          onCompleteProloguePromotion={() => completeRoleHandover(8)}
        />
        {activeOverlay.kind === 'roleHandover' &&
        getRoleHandover(activeOverlay.targetLevel) ? (
          <RoleHandoverOverlay
            handover={getRoleHandover(activeOverlay.targetLevel)!}
            onCancel={() => setPlayOverlay({ kind: 'gangTree' })}
            onCompleteDialogue={() =>
              completeRoleHandover(activeOverlay.targetLevel)
            }
            onStartChallenge={() => {
              const handover = getRoleHandover(activeOverlay.targetLevel)
              if (!handover?.challengeStage) return
              setPlayOverlay({
                kind:
                  handover.mode === 'battle'
                    ? 'roleHandoverBattle'
                    : 'roleHandoverRace',
                targetLevel: handover.targetLevel,
                stage: handover.challengeStage,
              })
            }}
          />
        ) : null}
        {activeOverlay.kind === 'chapters' ? (
          <ChapterPanel
            onClose={closeOverlay}
            onNavigateTask={navigateFromChapter}
            onChapterCompleted={(chapterNumber) =>
              setPlayOverlay({ kind: 'chapterComplete', chapterNumber })
            }
          />
        ) : null}
        {activeOverlay.kind === 'settings' ? (
          <SettingsPanel
            onClose={closeOverlay}
            onOpenAdventure={() => setPlayOverlay({ kind: 'adventure' })}
            onOpenRacing={() => setPlayOverlay({ kind: 'racing' })}
          />
        ) : null}
        {activeOverlay.kind === 'adventure' ? (
          <AdventurePanel
            onClose={() => {
              if (!finishStoryCampaign()) closeOverlay()
            }}
            onChallenge={(stage) =>
              setPlayOverlay({ kind: 'formation', stage })
            }
          />
        ) : null}
        {activeOverlay.kind === 'formation' ? (
          <FormationPanel
            stage={activeOverlay.stage}
            onCancel={() => setPlayOverlay({ kind: 'adventure' })}
            onStart={(stage) => setPlayOverlay({ kind: 'battle', stage })}
          />
        ) : null}
        {activeOverlay.kind === 'heroes' ? (
          <HeroesPanel
            onClose={closeOverlay}
            initialTab={activeOverlay.initialTab}
          />
        ) : null}
        {activeOverlay.kind === 'battle' ? (
          <BattleScreen
            stage={activeOverlay.stage}
            onExit={() => {
              if (!finishStoryCampaign()) {
                setPlayOverlay({ kind: 'adventure' })
              }
            }}
            onNext={(stage) => {
              if (!finishStoryCampaign()) {
                setPlayOverlay({ kind: 'battle', stage })
              }
            }}
            onDevelop={() =>
              setPlayOverlay({ kind: 'heroes', initialTab: 'level' })
            }
          />
        ) : null}
        {activeOverlay.kind === 'roleHandoverBattle' ? (
          <BattleScreen
            stage={activeOverlay.stage}
            onExit={() => setPlayOverlay({ kind: 'gangTree' })}
            onDevelop={() =>
              setPlayOverlay({ kind: 'heroes', initialTab: 'level' })
            }
            roleChallengeTitle={`${getRoleHandover(activeOverlay.targetLevel)?.title ?? '职位'} · 击败对手`}
            onRoleChallengeVictory={() =>
              completeRoleHandover(activeOverlay.targetLevel)
            }
          />
        ) : null}
        {activeOverlay.kind === 'racing' ? (
          <RacingPanel
            onClose={closeOverlay}
            onStart={(stage, heroId) =>
              setPlayOverlay({ kind: 'race', stage, heroId })
            }
          />
        ) : null}
        {activeOverlay.kind === 'race' ? (
          <RaceScreen
            stage={activeOverlay.stage}
            heroId={activeOverlay.heroId}
            prologueTitle={prologueRaceTitle ?? undefined}
            onExit={() => {
              if (storyEnabled) {
                finishStoryRace(activeOverlay.stage)
              } else if (prologueRaceTitle && activeOverlay.stage === 1) {
                finishPrologueRace(1, 'police-race', 'bo-invitation')
              } else if (prologueRaceTitle && activeOverlay.stage === 2) {
                finishPrologueRace(2, 'escape-race', 'prospect-invitation')
              } else if (prologueRaceTitle && activeOverlay.stage === 3) {
                finishPrologueRace(3, 'gun-race', 'gang-dialogue')
              } else {
                setPlayOverlay({ kind: 'racing' })
              }
            }}
            onDevelop={() =>
              setPlayOverlay({ kind: 'heroes', initialTab: 'car' })
            }
          />
        ) : null}
        {activeOverlay.kind === 'prologueShoot' ? (
          <PrologueShootOverlay
            onComplete={() => {
              if (advancePrologue('borrowed-shooting', 'tasks-dialogue')) {
                setPlayOverlay({ kind: 'none' })
              }
            }}
          />
        ) : null}
        {activeOverlay.kind === 'roleHandoverRace' ? (
          <RaceScreen
            stage={activeOverlay.stage}
            heroId="foreman"
            onExit={() => setPlayOverlay({ kind: 'gangTree' })}
            onDevelop={() =>
              setPlayOverlay({ kind: 'heroes', initialTab: 'car' })
            }
            roleChallengeTitle={`${getRoleHandover(activeOverlay.targetLevel)?.title ?? '职位'} · 跑进前三`}
            onRoleChallengeVictory={() =>
              completeRoleHandover(activeOverlay.targetLevel)
            }
          />
        ) : null}
        {activeOverlay.kind === 'buildingUnlock' ? (
          <ProgressionMilestoneOverlay
            milestone={{
              kind: 'building',
              buildingId: activeOverlay.buildingId,
            }}
            onContinue={() => {
              const buildingId = activeOverlay.buildingId
              if (storyEnabled) {
                setPlayOverlay({ kind: 'none' })
                return
              }
              const eventId = `building-claimed:${buildingId}` as const
              const returnsToChapter =
                buildingId === 'recycling-yard' && activeChapterNumber === 2
              if (returnsToChapter && seenNarrativeIds.includes(eventId)) {
                setPlayOverlay({ kind: 'chapters' })
              } else {
                setPlayOverlay({ kind: 'none' })
                enqueueNarrative(
                  eventId,
                  returnsToChapter ? 'chapters' : undefined,
                )
              }
            }}
          />
        ) : null}
        {activeOverlay.kind === 'chapterComplete' ? (
          <ProgressionMilestoneOverlay
            milestone={{
              kind: 'chapter',
              chapterNumber: activeOverlay.chapterNumber,
            }}
            onContinue={() => {
              const chapterNumber = activeOverlay.chapterNumber
              setPlayOverlay({ kind: 'none' })
              enqueueNarrative(
                `chapter-end:${chapterNumber}`,
                chapterNumber < 7
                  ? {
                      kind: 'assessmentMeeting',
                      completedChapterNumber: chapterNumber,
                    }
                  : undefined,
              )
            }}
          />
        ) : null}
        {activeOverlay.kind === 'assessmentMeeting' ? (
          <ChapterAssessmentMeeting
            completedChapterNumber={activeOverlay.completedChapterNumber}
            onComplete={(selection) => {
              const applied = completeAssessment(
                selection.completedChapterNumber,
                selection.selectedPackageId,
                selection.decision,
              )
              if (!applied) return
              if (
                selection.completedChapterNumber === 1 &&
                prologueStep === 'meeting'
              ) {
                if (!advancePrologue('meeting', 'formal-promotion')) return
                setPlayOverlay({ kind: 'gangTree' })
                return
              }
              setPlayOverlay({ kind: 'none' })
              enqueueNarrative(
                `chapter-start:${selection.nextChapterNumber}`,
                'gangTree',
              )
            }}
          />
        ) : null}
        {activeNarrative ? (
          <NarrativeDialogueOverlay
            key={activeNarrative.event.id}
            event={activeNarrative.event}
            onComplete={finishActiveNarrative}
          />
        ) : null}
      </main>
    </AppErrorBoundary>
  )
}
