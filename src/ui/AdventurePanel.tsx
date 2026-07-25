import { useEffect, useState, type JSX } from 'react'
import { campaignConfig } from '../config/campaignConfig'
import { useChestTick } from '../game/chestTick'
import {
  getClaimableIdleExp,
  useAdventureStore,
} from '../store/useAdventureStore'
import { useInitialFocus } from './useInitialFocus'
import { ResourceAmount } from './ResourceAmount'

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

  const currentStage = campaignConfig.stages.find(
    (stage) => stage.global === highestClearedStage + 1,
  )

  const claimChest = (): void => {
    const claimed = claimIdleChest(Date.now())
    setStatus(claimed > 0 ? `已领取英雄经验 ${claimed}` : '暂无可领取经验')
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

        <div className="adventure-panel__detail">
          {currentStage ? (
            <>
              <p>{`当前关卡 ${currentStage.id}`}</p>
              <p>{`敌人 Lv.${currentStage.enemy.level} × ${currentStage.enemyCount}`}</p>
              <div className="adventure-panel__rewards" aria-label="首通奖励">
                <ResourceAmount
                  kind="experience"
                  amount={currentStage.firstClearReward.sharedExp}
                />
                <ResourceAmount
                  kind="money"
                  amount={currentStage.firstClearReward.money}
                />
                <ResourceAmount
                  kind="part"
                  label="配件概率"
                  amount={`${Math.round(
                    currentStage.firstClearReward.partDropChance * 100,
                  )}%`}
                />
              </div>
              <button
                type="button"
                className="adventure-panel__challenge"
                onClick={() => onChallenge(currentStage.global)}
              >
                {`挑战 ${currentStage.id}`}
              </button>
            </>
          ) : (
            <p>全部关卡已通关</p>
          )}
        </div>

        <div className="adventure-panel__chest">
          <p>
            <ResourceAmount
              kind="experience"
              label="当前可领取"
              amount={claimable}
            />
          </p>
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
