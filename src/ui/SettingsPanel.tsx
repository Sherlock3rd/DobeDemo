import { useEffect, useState, type JSX } from 'react'
import {
  grantAllResourcesForDebug,
  unlockGangTreeForDebug,
} from '../game/debugActions'
import { resetAccount } from '../game/resetAccount'
import { useInitialFocus } from './useInitialFocus'

export interface SettingsPanelProps {
  onClose: () => void
}

const TITLE_ID = 'settings-panel-title'

export function SettingsPanel({ onClose }: SettingsPanelProps): JSX.Element {
  const [confirming, setConfirming] = useState(false)
  const [feedback, setFeedback] = useState('')
  const titleRef = useInitialFocus<HTMLHeadingElement>()

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
              onClick={unlockGangTree}
            >
              解锁帮派树
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
        <div className="settings-panel__item settings-panel__item--danger">
          <h3 className="settings-panel__item-title">账号进度</h3>
          <p className="settings-panel__item-description">
            声望、职位、建筑解锁、建筑等级和碎片进度都会恢复初始状态，且无法撤销。
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
