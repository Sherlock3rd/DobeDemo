import {
  useCallback,
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
import { getChapterForGangLevel } from '../game/chapterProgression'
import {
  PROGRESSION_UNLOCKS,
  type ProgressionUnlock,
} from '../game/progressionUnlocks'
import {
  getRoleHandover,
  type RoleHandoverDefinition,
} from '../game/roleHandover'
import { useGangStore } from '../store/useGangStore'
import { useChapterStore } from '../store/useChapterStore'
import { useInitialFocus } from './useInitialFocus'

export interface GangTreePanelProps {
  open: boolean
  onClose: () => void
  onRolePromoted?: (level: number) => void
  onStartRoleHandover?: (handover: RoleHandoverDefinition) => void
  promotionCeremonyLevel?: number | null
  onPromotionCeremonyComplete?: () => void
}

interface PromotionCeremony {
  level: number
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

function buildPromotionCeremony(
  level: number | null,
): PromotionCeremony | null {
  if (level === null) return null
  const role = getGangRole(level)
  if (role.threshold !== level) return null
  const seat = getGangCoreSeat(level)
  return {
    level,
    roleTitle: role.title,
    chineseTitle: role.chineseTitle,
    formerHolder: seat.holder,
    managedSeats: getManagedCoreSeatCount(level),
  }
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
  if (state === 'current') return '前任 · 直属'
  if (state === 'subordinate') return '辖下'
  return '上级'
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

const NETWORK_POSITIONS = [
  ['top-left', 17, 17],
  ['top-center', 50, 11],
  ['top-right', 83, 17],
  ['middle-right', 88, 50],
  ['bottom-right', 83, 83],
  ['bottom-center', 50, 89],
  ['bottom-left', 17, 83],
] as const

function HierarchyNode({
  seat,
  currentLevel,
  selected,
  onSelect,
  position,
}: {
  seat: GangCoreSeat
  currentLevel: number
  selected: boolean
  onSelect: () => void
  position: (typeof NETWORK_POSITIONS)[number]
}): JSX.Element {
  const role = roleForCoreSeat(seat)
  const state = getGangSeatState(seat.threshold, currentLevel)
  const [, x, y] = position

  return (
    <li
      className="gang-tree-panel__network-node"
      data-state={state}
      data-threshold={seat.threshold}
      data-selected={selected}
      style={
        {
          '--node-x': `${x}%`,
          '--node-y': `${y}%`,
        } as CSSProperties
      }
    >
      <button
        type="button"
        aria-label={`查看${seat.holder} · ${role.chineseTitle} Lv.${seat.threshold}`}
        aria-pressed={selected}
        onClick={onSelect}
      >
        <SeatPortrait index={seat.portraitIndex} />
        <span className="gang-tree-panel__node-state">
          {seatStateLabel(state)}
        </span>
        <strong>{seat.holder}</strong>
        <small>{`${role.title} · ${role.chineseTitle} · Lv.${role.threshold}`}</small>
      </button>
    </li>
  )
}

export function GangTreePanel({
  open,
  onClose,
  onRolePromoted,
  onStartRoleHandover,
  promotionCeremonyLevel = null,
  onPromotionCeremonyComplete,
}: GangTreePanelProps): JSX.Element | null {
  const totalReputation = useGangStore((state) => state.totalReputation)
  const currentLevel = useGangStore((state) => state.currentLevel)
  const promoteOneLevel = useGangStore((state) => state.promoteOneLevel)
  const claimedChapterNumbers = useChapterStore(
    (state) => state.claimedChapterNumbers,
  )
  const [feedback, setFeedback] = useState('')
  const currentRole = getGangRole(currentLevel)
  const [selectedThreshold, setSelectedThreshold] = useState(
    currentRole.threshold,
  )
  const titleRef = useInitialFocus<HTMLHeadingElement>(open)
  const currentChapter = getChapterForGangLevel(currentLevel)
  const chapterComplete = claimedChapterNumbers.includes(currentChapter.number)
  const ceremony = useMemo(
    () => buildPromotionCeremony(promotionCeremonyLevel),
    [promotionCeremonyLevel],
  )

  const finishCeremony = useCallback((): void => {
    if (!ceremony) return
    const completedLevel = ceremony.level
    setSelectedThreshold(ceremony.level)
    onPromotionCeremonyComplete?.()
    onRolePromoted?.(completedLevel)
  }, [ceremony, onPromotionCeremonyComplete, onRolePromoted])

  useEffect(() => {
    if (!ceremony) return
    const timeout = window.setTimeout(finishCeremony, CEREMONY_DURATION_MS)
    return () => window.clearTimeout(timeout)
  }, [ceremony, finishCeremony])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        if (ceremony) {
          finishCeremony()
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [ceremony, finishCeremony, open, onClose])

  if (!open) return null

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
  const selectedSeat = getGangCoreSeat(selectedThreshold)
  const selectedRole = roleForCoreSeat(selectedSeat)
  const selectedState = getGangSeatState(selectedThreshold, currentLevel)
  const handover = crossesRole ? getRoleHandover(nextLevel) : null
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
            Thomas
            位于关系网中央；金色为当前席位前任，绿色为辖下，灰色为尚未接掌的上级。
          </p>
          <div className="gang-tree-panel__network">
            <svg
              className="gang-tree-panel__network-lines"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {NETWORK_POSITIONS.map(([name, x, y]) => (
                <line key={name} x1="50" y1="50" x2={x} y2={y} />
              ))}
            </svg>
            <ol
              className="gang-tree-panel__hierarchy"
              aria-label="剃刀党管辖关系"
            >
              {GANG_CORE_SEATS.map((seat, index) => (
                <HierarchyNode
                  key={seat.threshold}
                  seat={seat}
                  currentLevel={currentLevel}
                  selected={selectedThreshold === seat.threshold}
                  onSelect={() => setSelectedThreshold(seat.threshold)}
                  position={NETWORK_POSITIONS[index]}
                />
              ))}
            </ol>
            <article
              className="gang-tree-panel__player-node"
              aria-label={`自己：${PLAYER_GANG_LEADER}，${currentRole.chineseTitle}`}
            >
              <SeatPortrait index={0} />
              <span>自己</span>
              <strong>{PLAYER_GANG_LEADER}</strong>
              <small>{`${currentRole.chineseTitle} · Lv.${currentLevel}`}</small>
            </article>
          </div>

          <article
            className="gang-tree-panel__selected-seat"
            data-state={selectedState}
            aria-label={`${selectedSeat.holder}的职位详情`}
          >
            <SeatPortrait index={selectedSeat.portraitIndex} compact />
            <div>
              <span>{seatStateLabel(selectedState)}</span>
              <strong>{selectedSeat.holder}</strong>
              <b>{`${selectedRole.title} · ${selectedRole.chineseTitle}`}</b>
              <small>{selectedSeat.seatDescription}</small>
            </div>
            <p>
              {selectedSeat.support.length > 0
                ? `直属成员：${selectedSeat.support
                    .map((member) => `${member.name}（${member.position}）`)
                    .join('、')}`
                : selectedState === 'current'
                  ? '完成席位交接后转入 Thomas 的直属管辖。'
                  : '当前没有额外直属成员。'}
            </p>
          </article>
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
                  ? '剃刀党所有席位均已归你管辖'
                  : totalReputation < requiredReputation
                    ? `还需 ${requiredReputation - totalReputation} 声望`
                    : crossesRole && !chapterComplete
                      ? `需完成并领取${currentChapter.title}奖励`
                      : handover
                        ? `交接方式：${handover.modeLabel}`
                        : '晋升条件已满足'}
              </span>
            </div>
            <button
              type="button"
              disabled={!canPromote}
              onClick={() => {
                const promotedRole = crossesRole ? getGangRole(nextLevel) : null
                if (promotedRole) {
                  const roleHandover = getRoleHandover(nextLevel)
                  if (roleHandover && onStartRoleHandover) {
                    onStartRoleHandover(roleHandover)
                    setFeedback(`等待完成${roleHandover.modeLabel}`)
                    return
                  }
                }
                const result = promoteOneLevel(Date.now(), chapterComplete)
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
                  ? handover?.mode === 'dialogue'
                    ? '和平交接'
                    : handover?.mode === 'battle'
                      ? '推关挑战'
                      : 'SUP 竞速挑战'
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
              onClick={finishCeremony}
            >
              继续
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
