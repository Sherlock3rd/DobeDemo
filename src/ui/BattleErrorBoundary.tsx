import { Component, type ReactNode } from 'react'

interface BattleErrorBoundaryProps {
  children: ReactNode
  onExit: () => void
}

interface BattleErrorBoundaryState {
  hasError: boolean
}

export class BattleErrorBoundary extends Component<
  BattleErrorBoundaryProps,
  BattleErrorBoundaryState
> {
  state: BattleErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): BattleErrorBoundaryState {
    return { hasError: true }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="battle-screen battle-screen--error"
          role="dialog"
          aria-label="战斗"
        >
          <div className="battle-screen__error" role="alert">
            <p>战斗初始化失败</p>
            <p>战斗场景渲染异常，请返回推关地图后重试。</p>
            <button type="button" onClick={this.props.onExit}>
              返回推关地图
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
