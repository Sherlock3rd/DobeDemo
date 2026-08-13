import { useEffect, useRef, type CSSProperties, type JSX } from 'react'
import gangPortraitAtlas from '../assets/peaky-blinders-hierarchy-atlas.png'
import garageRepair from '../assets/story/garage-repair-nitrous.webp'
import scrapyardSalvage from '../assets/story/scrapyard-salvage.webp'
import workshopTakeover from '../assets/story/workshop-takeover-dispatch.webp'
import {
  GANG_PHOTO_WALL,
  GANG_WALL_TAGS,
  type GangWallPhoto,
  type GangWallRewardId,
} from '../game/gangPhotoWall'

const BUILDING_PHOTOS = {
  'repair-shop': workshopTakeover,
  'recycling-yard': scrapyardSalvage,
  'commercial-street': workshopTakeover,
  'gas-station': garageRepair,
  'metalworking-plant': scrapyardSalvage,
  clubhouse: workshopTakeover,
} as const

function portraitStyle(index: number): CSSProperties {
  const column = index % 4
  const row = Math.floor(index / 4)
  return {
    backgroundImage: `url(${gangPortraitAtlas})`,
    backgroundPosition: `${(column / 3) * 100}% ${row * 100}%`,
  }
}

function photoStyle(photo: GangWallPhoto): CSSProperties {
  if (photo.kind === 'person') {
    return portraitStyle(photo.portraitIndex ?? 0)
  }
  return {
    backgroundImage: `url(${BUILDING_PHOTOS[photo.buildingId ?? 'repair-shop']})`,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
  }
}

type PhotoState = 'claimed' | 'claimable' | 'managed' | 'current' | 'locked'

function getPhotoState(
  photo: GangWallPhoto,
  tier: number,
  currentTier: number,
  currentStepNumber: number,
  claimedRewardIds: readonly GangWallRewardId[],
  requiredRewardIds: readonly GangWallRewardId[],
): PhotoState {
  if (claimedRewardIds.includes(photo.id)) return 'claimed'
  if (
    requiredRewardIds.includes(photo.id) &&
    photo.availableFromStep <= currentStepNumber
  ) {
    return 'claimable'
  }
  if (
    tier === currentTier - 1 &&
    photo.availableFromStep <= currentStepNumber
  ) {
    return 'claimable'
  }
  if (tier < currentTier - 1) return 'managed'
  if (tier === currentTier) return 'current'
  return 'locked'
}

function stateLabel(state: PhotoState): string {
  if (state === 'claimed') return '已交接'
  if (state === 'claimable') return '可以交接'
  if (state === 'managed') return '辖下成员'
  if (state === 'current') return '同层成员'
  return '尚未公开'
}

export interface GangPhotoWallProps {
  currentTier: number
  currentStepNumber: number
  claimedRewardIds: readonly GangWallRewardId[]
  requiredRewardId?: GangWallRewardId
  requiredRewardIds?: readonly GangWallRewardId[]
  onClaimReward?: (rewardId: GangWallRewardId) => void
}

export function GangPhotoWall({
  currentTier,
  currentStepNumber,
  claimedRewardIds,
  requiredRewardId,
  requiredRewardIds = [],
  onClaimReward,
}: GangPhotoWallProps): JSX.Element {
  const currentTierRef = useRef<HTMLLIElement | null>(null)
  const requiredIds = requiredRewardId
    ? [...requiredRewardIds, requiredRewardId]
    : requiredRewardIds

  useEffect(() => {
    const tier = currentTierRef.current
    const container = tier?.closest<HTMLElement>('.story-gang__scroll')
    if (!tier || !container) return
    const containerRect = container.getBoundingClientRect()
    const tierRect = tier.getBoundingClientRect()
    container.scrollTop = Math.max(
      0,
      container.scrollTop +
        tierRect.top -
        containerRect.top -
        (container.clientHeight - tierRect.height) / 2,
    )
  }, [currentTier])

  return (
    <div className="gang-photo-wall">
      <div className="gang-photo-wall__legend">
        <span>照片墙 · 上级在上</span>
        <strong>
          {currentTier === 1
            ? 'N-1 规则：晋升 T2 后，才可承接 T1'
            : `N-1 规则：你到达 T${currentTier}，可承接 T${currentTier - 1}`}
        </strong>
        {requiredIds.length > 0 ? <em>点击发光照片完成本次交接</em> : null}
      </div>
      <ol className="gang-photo-wall__tiers" aria-label="剃刀党照片墙层级">
        {[...GANG_PHOTO_WALL].reverse().map((tier) => {
          const tierState =
            tier.tier < currentTier
              ? 'managed'
              : tier.tier === currentTier
                ? 'current'
                : 'locked'
          return (
            <li
              key={tier.tier}
              ref={tier.tier === currentTier ? currentTierRef : undefined}
              className="gang-photo-wall__tier"
              data-tier={tier.tier}
              data-state={tierState}
            >
              <header>
                <span>{`T${tier.tier}`}</span>
                <div>
                  <strong>{tier.title}</strong>
                  <small>{`${tier.chineseTitle} · Lv.${tier.systemLevel}`}</small>
                </div>
                <p>{`${tier.duty} · 声望 ${tier.reputationThreshold}`}</p>
                <em>{tier.promotionEvent}</em>
                {tier.tier === currentTier ? (
                  <article
                    className="gang-photo-wall__player"
                    aria-label={`你在这里：Thomas Shelby，${tier.chineseTitle}`}
                  >
                    <span style={portraitStyle(0)} aria-hidden="true" />
                    <div>
                      <b>你在这里</b>
                      <strong>Thomas Shelby</strong>
                    </div>
                  </article>
                ) : null}
              </header>
              <div
                className="gang-photo-wall__slots"
                style={
                  {
                    '--wall-slot-count': tier.slots.length,
                  } as CSSProperties
                }
              >
                {tier.slots.map((slot) => {
                  if (slot.kind === 'empty') {
                    return (
                      <article
                        key={slot.id}
                        className="gang-photo-wall__empty"
                        aria-label="空置照片位"
                      >
                        <span aria-hidden="true">＋</span>
                        <small>席位空置</small>
                      </article>
                    )
                  }

                  const state = getPhotoState(
                    slot,
                    tier.tier,
                    currentTier,
                    currentStepNumber,
                    claimedRewardIds,
                    requiredIds,
                  )
                  const isRequired = requiredIds.includes(slot.id)
                  const canClaim = state === 'claimable' && onClaimReward
                  return (
                    <article
                      key={slot.id}
                      className="gang-photo-wall__photo"
                      data-kind={slot.kind}
                      data-state={state}
                      data-required={isRequired || undefined}
                    >
                      <div
                        className="gang-photo-wall__image"
                        style={photoStyle(slot)}
                        aria-hidden="true"
                      >
                        <span>{stateLabel(state)}</span>
                      </div>
                      <div className="gang-photo-wall__tags">
                        {slot.tags.map((tag) => (
                          <span key={tag} data-tag={tag}>
                            {GANG_WALL_TAGS[tag]}
                          </span>
                        ))}
                      </div>
                      <strong>{slot.name}</strong>
                      <small>{slot.position}</small>
                      <b>{`任务 · ${slot.task}`}</b>
                      <p>{slot.description}</p>
                      {canClaim ? (
                        <button
                          type="button"
                          aria-label={slot.claimLabel}
                          onClick={() => onClaimReward(slot.id)}
                        >
                          {isRequired ? '完成本次交接' : '点击交接'}
                        </button>
                      ) : (
                        <em>{stateLabel(state)}</em>
                      )}
                    </article>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
