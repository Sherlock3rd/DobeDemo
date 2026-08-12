import { type JSX } from 'react'
import type { GangWallRewardId } from '../game/gangPhotoWall'
import {
  STORY_RANKS,
  getStoryRank,
  getStoryReputation,
} from '../game/storyPlanC'
import { useStoryStore } from '../store/useStoryStore'
import { GangPhotoWall } from './GangPhotoWall'

export function StoryGangTreePanel({
  currentStepNumber,
  canContinue,
  requiredRewardId,
  promotionTargetTier,
  continueLabel,
  onContinue,
  onPromotionRequested,
  onRewardClaimed,
  onClose,
}: {
  currentStepNumber: number
  canContinue: boolean
  requiredRewardId?: GangWallRewardId
  promotionTargetTier?: number
  continueLabel?: string
  onContinue: () => void
  onPromotionRequested: () => void
  onRewardClaimed: (rewardId: GangWallRewardId) => void
  onClose: () => void
}): JSX.Element {
  const currentRank = getStoryRank(currentStepNumber)
  const reputation = getStoryReputation(currentStepNumber)
  const nextRank = STORY_RANKS.find(
    (rank) => rank.tier === currentRank.tier + 1,
  )
  const promotionRank = STORY_RANKS.find(
    (rank) => rank.tier === promotionTargetTier,
  )
  const promotionReady = Boolean(
    promotionRank &&
    promotionRank.tier === currentRank.tier + 1 &&
    reputation >= promotionRank.reputationThreshold,
  )
  const claimedRewardIds = useStoryStore(
    (state) => state.claimedGangWallRewardIds,
  )
  const claimReward = useStoryStore((state) => state.claimGangWallReward)

  return (
    <div className="story-gang__overlay">
      <section
        className="story-gang"
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-gang-title"
      >
        <header>
          <div>
            <span>PLAN C · GANG PHOTO WALL</span>
            <h2 id="story-gang-title">帮派照片墙</h2>
          </div>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="story-gang__summary">
          <span>当前职级</span>
          <strong>{`${currentRank.title} · ${currentRank.chineseTitle}`}</strong>
          <div className="story-gang__reputation">
            <b>{`声望 ${reputation}`}</b>
            <i>
              {nextRank
                ? `下一职级 ${nextRank.reputationThreshold}`
                : '已达到最高职级'}
            </i>
            <span
              style={{
                width: nextRank
                  ? `${Math.min(100, (reputation / nextRank.reputationThreshold) * 100)}%`
                  : '100%',
              }}
            />
          </div>
          <p>
            {requiredRewardId
              ? `你已到达 T${currentRank.tier}，请从 T${currentRank.tier - 1} 收复指定人物与奖励。`
              : promotionRank
                ? `声望达到 ${promotionRank.reputationThreshold} 后，点击晋升并进入「${promotionRank.promotionEvent}」。`
                : '玩法获得声望；达到门槛后主动晋升。晋升至 N 层，只能收复 N-1 层。'}
          </p>
        </div>
        <div className="story-gang__scroll">
          <GangPhotoWall
            currentTier={currentRank.tier}
            currentStepNumber={currentStepNumber}
            claimedRewardIds={claimedRewardIds}
            requiredRewardId={requiredRewardId}
            onClaimReward={(rewardId) => {
              if (claimReward(rewardId)) onRewardClaimed(rewardId)
            }}
          />
        </div>
        <footer>
          <span>产业始终属于帮派；照片墙记录成员归属、管理权和玩法奖励。</span>
          {promotionRank ? (
            <button
              type="button"
              disabled={!promotionReady}
              aria-label={`晋升 ${promotionRank.title}`}
              onClick={onPromotionRequested}
            >
              {promotionReady
                ? `晋升 ${promotionRank.title}`
                : `声望不足 ${reputation} / ${promotionRank.reputationThreshold}`}
            </button>
          ) : canContinue ? (
            <button type="button" onClick={onContinue}>
              {continueLabel ?? '了解方案 C 帮派树规则'}
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  )
}
