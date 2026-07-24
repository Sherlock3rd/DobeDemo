import { useEffect, useState, type JSX } from 'react'
import {
  campaignConfig,
  getFirstClearReward,
  isStageUnlocked,
} from '../config/campaignConfig'
import { useChestTick } from '../game/chestTick'
import {
  getClaimableIdleExp,
  useAdventureStore,
} from '../store/useAdventureStore'
import { useInitialFocus } from './useInitialFocus'

export interface AdventurePanelProps {
  onClose: () => void
  onChallenge: (stage: number) => void
}

const TITLE_ID = 'adventure-panel-title'

export function AdventurePanel({
  onClose,
  onChallenge,
}: AdventurePanelProps): JSX.Element {
  const highestClearedStage = useAdventureStore((s) => s.highestClearedStage)
  const idleClock = useAdventureStore((s) => s.idleClock)
  const claimIdleChest = useAdventureStore((s) => s.claimIdleChest)
  const [selectedStage, setSelectedStage] = useState(1)
  const [status, setStatus] = useState('')
  const titleRef = useInitialFocus<HTMLHeadingElement>()
  const tick = useChestTick((s) => s.tick)
  const now = useChestTick((s) => s.now)
  const claimable = getClaimableIdleExp(
    idleClock,
    highestClearedStage,
    tick > 0 || now > 0 ? now : idleClock,
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const stopPropagation = (event: { stopPropagation: () => void }): void => {
    event.stopPropagation()
  }

  const chapterOne = campaignConfig.stages.filter((s) => s.global <= 10)
  const chapterTwo = campaignConfig.stages.filter((s) => s.global > 10)
  const selected = campaignConfig.stages.find((s) => s.global === selectedStage)
  const canChallenge =
    selected !== undefined &&
    isStageUnlocked(selected.global, highestClearedStage)

  const claimChest = (): void => {
    const claimed = claimIdleChest(Date.now())
    setStatus(claimed > 0 ? `已领取英雄经验 ${claimed}` : '暂无可领取经验')
  }

  const renderStageButton = (stage: (typeof campaignConfig.stages)[number]) => {
    const unlocked = isStageUnlocked(stage.global, highestClearedStage)
    const cleared = stage.global <= highestClearedStage
    return (
      <button
        key={stage.id}
        type="button"
        className="adventure-panel__stage"
        disabled={!unlocked}
        aria-pressed={selectedStage === stage.global}
        onClick={() => setSelectedStage(stage.global)}
      >
        {`${stage.id} · 敌Lv.${stage.enemy.level}×${stage.enemyCount}`}
        {cleared ? ' · 已通' : ''}
      </button>
    )
  }

  return (
    <div
      className="adventure-panel__overlay"
      onPointerDown={stopPropagation}
      onClick={stopPropagation}
    >
      <section
        className="adventure-panel"
        role="dialog"
        aria-labelledby={TITLE_ID}
        aria-label="推关地图"
        onPointerDown={stopPropagation}
        onClick={stopPropagation}
      >
        <button
          type="button"
          className="adventure-panel__close"
          aria-label="关闭推关"
          onClick={onClose}
        >
          关闭
        </button>
        <h2
          ref={titleRef}
          id={TITLE_ID}
          className="adventure-panel__title"
          tabIndex={-1}
        >
          推关战役
        </h2>

        <div className="adventure-panel__chapter">
          <h3>第 1 章</h3>
          <div className="adventure-panel__stages">
            {chapterOne.map(renderStageButton)}
          </div>
        </div>
        <div className="adventure-panel__chapter">
          <h3>第 2 章</h3>
          <div className="adventure-panel__stages">
            {chapterTwo.map(renderStageButton)}
          </div>
        </div>

        <div className="adventure-panel__detail">
          {selected ? (
            <>
              <p>{`选中 ${selected.id}`}</p>
              <p>{`首通奖励 英雄经验 ${getFirstClearReward(selected.global)}`}</p>
              <button
                type="button"
                className="adventure-panel__challenge"
                disabled={!canChallenge}
                onClick={() => onChallenge(selected.global)}
              >
                {`挑战 ${selected.id}`}
              </button>
            </>
          ) : null}
        </div>

        <div className="adventure-panel__chest">
          <p>{`当前可领取 ${claimable}`}</p>
          <button
            type="button"
            className="adventure-panel__claim"
            onClick={claimChest}
          >
            领取宝箱
          </button>
        </div>
        <p className="adventure-panel__status" role="status" aria-live="polite">
          {status}
        </p>
      </section>
    </div>
  )
}
