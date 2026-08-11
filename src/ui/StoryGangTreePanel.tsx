import { type JSX } from 'react'
import type { GangWallRewardId } from '../game/gangPhotoWall'
import { getStoryRank } from '../game/storyPlanB'
import { useStoryStore } from '../store/useStoryStore'
import { GangPhotoWall } from './GangPhotoWall'

export function StoryGangTreePanel({
  currentStepNumber,
  canContinue,
  requiredRewardId,
  onContinue,
  onRewardClaimed,
  onClose,
}: {
  currentStepNumber: number
  canContinue: boolean
  requiredRewardId?: GangWallRewardId
  onContinue: () => void
  onRewardClaimed: (rewardId: GangWallRewardId) => void
  onClose: () => void
}): JSX.Element {
  const currentRank = getStoryRank(currentStepNumber)
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
            <span>STEPS OF POWER · PHOTO WALL</span>
            <h2 id="story-gang-title">剃刀党照片墙</h2>
          </div>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="story-gang__summary">
          <span>当前职级</span>
          <strong>{`${currentRank.title} · ${currentRank.chineseTitle}`}</strong>
          <p>
            {requiredRewardId
              ? `你已到达 T${currentRank.tier}，请从 T${currentRank.tier - 1} 完成指定交接。`
              : '每次到达新层级，只能接管上一层的人物与管理奖励。'}
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
          <span>所有产业始终属于帮派；照片墙记录的是管理权与人员归属。</span>
          {canContinue ? (
            <button type="button" onClick={onContinue}>
              了解 N-1 接管规则
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  )
}
