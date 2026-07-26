import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type JSX,
} from 'react'
import gangPortraitAtlas from '../assets/peaky-blinders-hierarchy-atlas.png'
import { heroesConfig } from '../config/heroesConfig'
import { equipmentConfig } from '../config/equipmentConfig'
import { buildingCatalogById } from '../game/buildingCatalog'
import {
  GANG_MAX_LEVEL,
  getGangRole,
  getNextGangRole,
  getTotalReputationForLevel,
} from '../game/gangProgression'
import {
  GANG_CORE_SEATS,
  GANG_NAME,
  PLAYER_GANG_LEADER,
  getGangCoreSeat,
  getGangSeatState,
  getManagedCoreSeatCount,
  roleForCoreSeat,
  type GangCoreSeat,
  type GangSeatState,
} from '../game/gangHierarchy'
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
import { useChapterStore } from '../store/useChapterStore'
import { useCityStore } from '../store/useCityStore'
import { useInitialFocus } from './useInitialFocus'

export interface GangTreePanelProps {
  open: boolean
  onClose: () => void
}

interface PromotionCeremony {
  roleTitle: string
  chineseTitle: string
  formerHolder: string
  managedSeats: number
}

interface RewardPreview {
  title: string
  detail: string
  kind: 'level' | 'role' | 'unlock'
}

const TITLE_ID = 'gang-tree-panel-title'
const CEREMONY_DURATION_MS = 3000

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

function portraitStyle(index: number): CSSProperties {
  const column = index % 4
  const row = Math.floor(index / 4)
  return {
    backgroundImage: `url(${gangPortraitAtlas})`,
    backgroundPosition: `${(column / 3) * 100}% ${row * 100}%`,
  }
}

function seatStateLabel(state: GangSeatState): string {
  if (state === 'current') return '你在这里'
  if (state === 'subordinate') return '直属辖下'
  return '上级席位'
}

function buildRewardPreview(
  nextLevel: number,
  crossesRole: boolean,
): RewardPreview[] {
  const items: RewardPreview[] = [
    {
      title: `帮派等级 Lv.${nextLevel}`,
      detail: '核心声望阶位提升',
      kind: 'level',
    },
  ]
  if (crossesRole) {
    const role = getGangRole(nextLevel)
    items.push({
      title: `${role.title}（${role.chineseTitle}）`,
      detail: '接掌核心席位与下属',
      kind: 'role',
    })
  }
  const unlocks = PROGRESSION_UNLOCKS.filter(
    (unlock) => unlock.requiredLevel === nextLevel,
  )
  for (const unlock of unlocks) {
    items.push({
      title: unlockLabel(unlock),
      detail: '新权限解锁',
      kind: 'unlock',
    })
  }
  if (items.length === 1) {
    items.push({
      title: '组织影响力',
      detail: '开启下一等级声望进度',
      kind: 'unlock',
    })
  }
  return items
}

function SeatPortrait({
  index,
  compact = false,
}: {
  index: number
  compact?: boolean
}): JSX.Element {
  return (
    <span
      className={
        compact
          ? 'gang-tree-panel__portrait gang-tree-panel__portrait--compact'
          : 'gang-tree-panel__portrait'
      }
      style={portraitStyle(index)}
      aria-hidden="true"
    />
  )
}

function HierarchySeat({
  seat,
  currentLevel,
}: {
  seat: GangCoreSeat
  currentLevel: number
}): JSX.Element {
  const role = roleForCoreSeat(seat)
  const state = getGangSeatState(seat.threshold, currentLevel)
  const isCurrent = state === 'current'
  const displayedName = isCurrent ? PLAYER_GANG_LEADER : seat.holder
  const portraitIndex = isCurrent ? 0 : seat.portraitIndex
  const support = isCurrent
    ? [
        {
          name: seat.holder,
          position: `前任 ${role.chineseTitle} · 现直属下属`,
          portraitIndex: seat.portraitIndex,
        },
        ...seat.support.map((member) => ({ ...member, portraitIndex: null })),
      ]
    : seat.support.map((member) => ({ ...member, portraitIndex: null }))

  return (
    <li
      className="gang-tree-panel__tier"
      data-state={state}
      data-threshold={seat.threshold}
      aria-current={isCurrent ? 'step' : undefined}
    >
      <span className="gang-tree-panel__relation" aria-hidden="true">
        管辖
      </span>
      <article className="gang-tree-panel__core-card">
        <SeatPortrait index={portraitIndex} />
        <span className="gang-tree-panel__seat-state">
          {seatStateLabel(state)}
        </span>
        <strong>{displayedName}</strong>
        <b>{`${role.title} · ${role.chineseTitle}`}</b>
        <small>{`核心等级 Lv.${role.threshold} · ${seat.seatDescription}`}</small>
        {isCurrent ? (
          <em>{`${seat.holder} 已交出席位，转入你的管辖`}</em>
        ) : null}
      </article>
      <div
        className="gang-tree-panel__support"
        aria-label={`${displayedName} 的下属`}
      >
        {support.map((member) => (
          <article
            key={`${seat.threshold}-${member.name}`}
            className="gang-tree-panel__support-card"
          >
            {member.portraitIndex === null ? (
              <span
                className="gang-tree-panel__support-initial"
                aria-hidden="true"
              >
                {member.name.slice(0, 1)}
              </span>
            ) : (
              <SeatPortrait index={member.portraitIndex} compact />
            )}
            <span>
              <strong>{member.name}</strong>
              <small>{member.position}</small>
            </span>
          </article>
        ))}
      </div>
    </li>
  )
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
  const claimedChapterNumbers = useChapterStore(
    (state) => state.claimedChapterNumbers,
  )
  const buildingProgress = useCityStore((state) => state.buildingProgress)
  const [feedback, setFeedback] = useState('')
  const [ceremony, setCeremony] = useState<PromotionCeremony | null>(null)
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
      }) && claimedChapterNumbers.includes(currentChapter.number),
    [
      buildingProgress,
      carPartInventory,
      claimedChapterNumbers,
      currentChapter,
      gunLevels,
      heroLevels,
      highestClearedRacingStage,
      highestClearedStage,
    ],
  )

  useEffect(() => {
    if (!ceremony) return
    const timeout = window.setTimeout(
      () => setCeremony(null),
      CEREMONY_DURATION_MS,
    )
    return () => window.clearTimeout(timeout)
  }, [ceremony])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        if (ceremony) {
          setCeremony(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [ceremony, open, onClose])

  if (!open) return null

  const currentRole = getGangRole(currentLevel)
  const nextRole = getNextGangRole(currentLevel)
  const nextLevel = Math.min(GANG_MAX_LEVEL, currentLevel + 1)
  const requiredReputation = getTotalReputationForLevel(nextLevel)
  const currentLevelReputation = getTotalReputationForLevel(currentLevel)
  const reputationRange = Math.max(
    1,
    requiredReputation - currentLevelReputation,
  )
  const reputationProgress =
    currentLevel >= GANG_MAX_LEVEL
      ? 100
      : Math.min(
          100,
          Math.max(
            0,
            ((totalReputation - currentLevelReputation) / reputationRange) *
              100,
          ),
        )
  const crossesRole =
    currentLevel < GANG_MAX_LEVEL &&
    currentRole.threshold !== getGangRole(nextLevel).threshold
  const canPromote =
    currentLevel < GANG_MAX_LEVEL &&
    totalReputation >= requiredReputation &&
    (!crossesRole || chapterComplete)
  const rewardPreview =
    currentLevel >= GANG_MAX_LEVEL
      ? []
      : buildRewardPreview(nextLevel, crossesRole)
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
        <header className="gang-tree-panel__header">
          <div>
            <span className="gang-tree-panel__eyebrow">STEPS OF POWER</span>
            <h2 ref={titleRef} id={TITLE_ID} tabIndex={-1}>
              帮派权力树
            </h2>
          </div>
          <div className="gang-tree-panel__identity">
            <span>帮派名称</span>
            <strong>{GANG_NAME}</strong>
          </div>
          <button
            type="button"
            className="gang-tree-panel__close"
            aria-label="关闭帮派树"
            onClick={onClose}
          >
            关闭
          </button>
        </header>

        <div className="gang-tree-panel__summary">
          <div>
            <span>当前掌权人</span>
            <strong>{PLAYER_GANG_LEADER}</strong>
            <small>{`Lv.${currentLevel} · ${currentRole.title}（${currentRole.chineseTitle}）`}</small>
          </div>
          <div>
            <span>组织关系</span>
            <strong>{`管辖 ${getManagedCoreSeatCount(currentLevel)} 个核心席位`}</strong>
            <small>
              {nextRole
                ? `上级目标：Lv.${nextRole.threshold} ${nextRole.chineseTitle}`
                : '剃刀党最高权力已经归你'}
            </small>
          </div>
        </div>

        <div className="gang-tree-panel__hierarchy-scroll">
          <p className="gang-tree-panel__hierarchy-help">
            高位者管理下方席位；你晋升后会替换该职级负责人，原负责人转为直属下属。
          </p>
          <ol
            className="gang-tree-panel__hierarchy"
            aria-label="剃刀党管辖关系"
          >
            {[...GANG_CORE_SEATS].reverse().map((seat) => (
              <HierarchySeat
                key={seat.threshold}
                seat={seat}
                currentLevel={currentLevel}
              />
            ))}
          </ol>
        </div>

        <footer className="gang-tree-panel__promotion-dock">
          <div className="gang-tree-panel__progress">
            <span>{`总声望 ${totalReputation}`}</span>
            <strong>
              {currentLevel >= GANG_MAX_LEVEL
                ? 'MAX'
                : `${totalReputation}/${requiredReputation}`}
            </strong>
            <div
              className="gang-tree-panel__progress-track"
              role="progressbar"
              aria-label="帮派晋升进度"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(reputationProgress)}
            >
              <span style={{ width: `${reputationProgress}%` }} />
            </div>
          </div>
          <div className="gang-tree-panel__rewards">
            <span className="gang-tree-panel__rewards-title">晋升奖励</span>
            <div>
              {rewardPreview.length > 0 ? (
                rewardPreview.map((reward) => (
                  <article key={`${reward.kind}-${reward.title}`}>
                    <span data-kind={reward.kind} aria-hidden="true">
                      {reward.kind === 'level'
                        ? 'LV'
                        : reward.kind === 'role'
                          ? '◆'
                          : '＋'}
                    </span>
                    <strong>{reward.title}</strong>
                    <small>{reward.detail}</small>
                  </article>
                ))
              ) : (
                <article>
                  <span data-kind="role" aria-hidden="true">
                    ◆
                  </span>
                  <strong>最高权力</strong>
                  <small>所有核心席位均已归你管辖</small>
                </article>
              )}
            </div>
          </div>
          <div
            className="gang-tree-panel__promotion"
            data-state={canPromote ? 'ready' : 'waiting'}
          >
            <div>
              {canPromote ? (
                <span
                  className="gang-tree-panel__promotion-ready"
                  role="status"
                  aria-label="帮派等级可晋升"
                >
                  可晋升
                </span>
              ) : null}
              <strong>
                {currentLevel >= GANG_MAX_LEVEL
                  ? '帮派等级已满'
                  : crossesRole
                    ? `晋升 ${getGangRole(nextLevel).chineseTitle}`
                    : `晋升 Lv.${nextLevel}`}
              </strong>
              <span>
                {currentLevel >= GANG_MAX_LEVEL
                  ? '剃刀党所有席位均已接管'
                  : totalReputation < requiredReputation
                    ? `还需 ${requiredReputation - totalReputation} 声望`
                    : crossesRole && !chapterComplete
                      ? `需完成并领取${currentChapter.title}奖励`
                      : '晋升条件已满足'}
              </span>
            </div>
            <button
              type="button"
              disabled={!canPromote}
              onClick={() => {
                const promotedRole = crossesRole ? getGangRole(nextLevel) : null
                const result = promoteOneLevel(Date.now(), chapterComplete)
                if (result.applied && promotedRole) {
                  const seat = getGangCoreSeat(promotedRole.threshold)
                  setCeremony({
                    roleTitle: promotedRole.title,
                    chineseTitle: promotedRole.chineseTitle,
                    formerHolder: seat.holder,
                    managedSeats: getManagedCoreSeatCount(nextLevel),
                  })
                }
                setFeedback(
                  result.applied
                    ? `已晋升至 Lv.${nextLevel}`
                    : result.reason === 'chapter-incomplete'
                      ? '请先完成任务并领取当前章节奖励'
                      : '尚未满足晋升条件',
                )
              }}
            >
              {currentLevel >= GANG_MAX_LEVEL
                ? '已满级'
                : crossesRole
                  ? '接掌席位'
                  : '晋升一级'}
            </button>
          </div>
          <p className="gang-tree-panel__feedback" aria-live="polite">
            {feedback}
          </p>
        </footer>

        {ceremony ? (
          <div
            className="gang-tree-panel__ceremony"
            role="status"
            aria-label={`职级晋升：${ceremony.chineseTitle}`}
          >
            <div className="gang-tree-panel__ceremony-rays" />
            <span>THE RAZOR RISES</span>
            <SeatPortrait index={0} />
            <p>剃刀党 · 职级晋升</p>
            <h3>{`${ceremony.roleTitle} · ${ceremony.chineseTitle}`}</h3>
            <strong>{PLAYER_GANG_LEADER}</strong>
            <small>{`${ceremony.formerHolder} 已交出席位 · 现管辖 ${ceremony.managedSeats} 个核心席位`}</small>
            <button
              type="button"
              aria-label="跳过晋升演出"
              onClick={() => setCeremony(null)}
            >
              继续
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
