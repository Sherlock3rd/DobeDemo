import { useEffect, useState, type JSX } from 'react'
import {
  grantAllResourcesForDebug,
  unlockGangTreeForDebug,
} from '../game/debugActions'
import { resetAccount } from '../game/resetAccount'
import { campaignConfig } from '../config/campaignConfig'
import { racingConfig } from '../config/racingConfig'
import {
  CAR_PART_QUALITY_INFO,
  getPartSalvageDropProfile,
} from '../game/equipmentProgression'
import { CAR_PART_QUALITY_IDS } from '../game/equipmentTypes'
import {
  getCampaignPartQualityWeights,
  getRacingPartQualityWeights,
  type PartQualityWeights,
} from '../game/stageRewards'
import { useGangStore } from '../store/useGangStore'
import { useInitialFocus } from './useInitialFocus'

export interface SettingsPanelProps {
  onClose: () => void
  onOpenAdventure?: () => void
  onOpenRacing?: () => void
}

const TITLE_ID = 'settings-panel-title'

function formatQualityWeights(weights: PartQualityWeights): string {
  return CAR_PART_QUALITY_IDS.map(
    (quality) =>
      `${CAR_PART_QUALITY_INFO[quality].name} ${Math.round(
        weights[quality] * 100,
      )}%`,
  ).join(' · ')
}

export function SettingsPanel({
  onClose,
  onOpenAdventure,
  onOpenRacing,
}: SettingsPanelProps): JSX.Element {
  const [confirming, setConfirming] = useState(false)
  const [showProbabilities, setShowProbabilities] = useState(false)
  const [feedback, setFeedback] = useState('')
  const titleRef = useInitialFocus<HTMLHeadingElement>()
  const gangLevel = useGangStore((state) => state.currentLevel)
  const advanceOneLevel = useGangStore((state) => state.advanceOneLevel)

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

  const confirmReset = (): void => {
    resetAccount(Date.now())
    onClose()
  }

  const unlockGangTree = (): void => {
    if (unlockGangTreeForDebug(Date.now())) {
      setFeedback('帮派树已解锁')
    }
  }

  const grantAllResources = (): void => {
    if (grantAllResourcesForDebug(Date.now())) {
      setFeedback('钱、油、物资各增加 10000')
    }
  }

  const advanceGangLevel = (): void => {
    if (gangLevel >= 50) return
    advanceOneLevel(Date.now())
    setFeedback(`帮派等级已提升至 Lv.${gangLevel + 1}`)
  }

  return (
    <div
      className="settings-panel__overlay"
      onPointerDown={stopPropagation}
      onClick={stopPropagation}
    >
      <section
        className="settings-panel"
        role="dialog"
        aria-labelledby={TITLE_ID}
        onPointerDown={stopPropagation}
        onClick={stopPropagation}
      >
        <button
          type="button"
          className="settings-panel__close"
          aria-label="关闭调试设置"
          onClick={onClose}
        >
          关闭
        </button>
        <h2
          ref={titleRef}
          id={TITLE_ID}
          className="settings-panel__title"
          tabIndex={-1}
        >
          调试设置
        </h2>
        <p className="settings-panel__description">
          仅用于 Demo 调试，管理当前浏览器中的账号进度。
        </p>
        <div className="settings-panel__item settings-panel__item--debug">
          <h3 className="settings-panel__item-title">快捷调试</h3>
          <p className="settings-panel__item-description">
            调整当前进度，操作会立即生效并保留此面板。
          </p>
          <div className="settings-panel__debug-actions">
            <button
              type="button"
              className="settings-panel__debug-action"
              onClick={onOpenRacing}
            >
              打开 SUP 调试入口
            </button>
            <button
              type="button"
              className="settings-panel__debug-action"
              onClick={onOpenAdventure}
            >
              打开推关调试入口
            </button>
            <button
              type="button"
              className="settings-panel__debug-action"
              onClick={unlockGangTree}
            >
              解锁帮派树
            </button>
            <button
              type="button"
              className="settings-panel__debug-action"
              disabled={gangLevel >= 50}
              onClick={advanceGangLevel}
            >
              {gangLevel >= 50 ? '帮派树已满级' : '帮派树升一级'}
            </button>
            <button
              type="button"
              className="settings-panel__debug-action"
              onClick={grantAllResources}
            >
              钱/油/物资各 +10000
            </button>
          </div>
          <p className="settings-panel__feedback" aria-live="polite">
            {feedback}
          </p>
        </div>
        <div className="settings-panel__item">
          <h3 className="settings-panel__item-title">掉落概率</h3>
          <p className="settings-panel__item-description">
            查看废车回收厂、推关和赛车的真实随机掉落配置。
          </p>
          <button
            type="button"
            className="settings-panel__debug-action"
            aria-expanded={showProbabilities}
            onClick={() => setShowProbabilities((visible) => !visible)}
          >
            {showProbabilities ? '收起掉落概率' : '查看掉落概率'}
          </button>
          {showProbabilities ? (
            <div className="settings-panel__probabilities">
              <h4>废车回收厂</h4>
              <ul>
                {Array.from({ length: 10 }, (_, index) => {
                  const level = index + 1
                  const profile = getPartSalvageDropProfile(level)
                  const quantities = Object.entries(profile.quantityWeights)
                    .map(
                      ([quantity, weight]) =>
                        `${quantity}件 ${Math.round(weight * 100)}%`,
                    )
                    .join(' · ')
                  return (
                    <li key={level}>
                      {`Lv.${level} · ${profile.intervalMs / 1000}秒/批 · ${quantities} · ${formatQualityWeights(
                        profile.qualityWeights,
                      )}`}
                    </li>
                  )
                })}
              </ul>
              <h4>推关首通</h4>
              <ul>
                {[1, 6, 11, 16].map((stage) => (
                  <li key={stage}>{`${stage}–${stage + 4}关 · 配件 ${
                    campaignConfig.stages[stage - 1].firstClearReward
                      .partDropChance * 100
                  }% · ${formatQualityWeights(
                    getCampaignPartQualityWeights(stage),
                  )}`}</li>
                ))}
              </ul>
              <h4>赛车首通</h4>
              <ul>
                {[1, 3, 5, 7, 9].map((stage) => (
                  <li key={stage}>{`${stage}–${stage + 1}关 · 配件 ${
                    racingConfig.stages[stage - 1].partDropChance * 100
                  }% · ${formatQualityWeights(
                    getRacingPartQualityWeights(stage),
                  )}`}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="settings-panel__item settings-panel__item--danger">
          <h3 className="settings-panel__item-title">账号进度</h3>
          <p className="settings-panel__item-description">
            声望、职位、章节奖励、建筑解锁、建筑等级和碎片进度都会恢复初始状态，且无法撤销。
          </p>
          {confirming ? (
            <div className="settings-panel__confirmation">
              <p className="settings-panel__warning" role="alert">
                确定要永久重置当前账号吗？
              </p>
              <div className="settings-panel__confirmation-actions">
                <button
                  type="button"
                  className="settings-panel__confirm-reset"
                  onClick={confirmReset}
                >
                  确认重置账号
                </button>
                <button
                  type="button"
                  className="settings-panel__cancel-reset"
                  onClick={() => setConfirming(false)}
                >
                  取消重置
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="settings-panel__reset"
              onClick={() => setConfirming(true)}
            >
              重置账号
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
