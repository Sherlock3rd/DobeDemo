import type { JSX } from 'react'
import type { PrologueStep } from '../game/prologue'

export interface PrologueGuideProps {
  step: PrologueStep
  claimedTasks: number
  onOpenHeroes: () => void
  onOpenTasks: () => void
  onOpenGangTree: () => void
}

export function PrologueGuide({
  step,
  claimedTasks,
  onOpenHeroes,
  onOpenTasks,
  onOpenGangTree,
}: PrologueGuideProps): JSX.Element | null {
  if (step === 'part-tutorial') {
    return (
      <aside className="prologue-guide" role="status">
        <span>TUTORIAL · 车辆养成</span>
        <strong>换下锈狐的损坏引擎</strong>
        <p>进入引擎部位，把博赠送的“调校引擎”安装上去。</p>
        <button type="button" onClick={onOpenHeroes}>
          前往更换配件
        </button>
      </aside>
    )
  }

  if (step === 'prospect-tasks') {
    return (
      <aside className="prologue-guide" role="status">
        <span>PROSPECT · 转正任务</span>
        <strong>{`奖励已领取 ${claimedTasks}/3`}</strong>
        <p>接管并升级修车厂，确认新引擎已安装，再领取全部三项奖励。</p>
        <button type="button" onClick={onOpenTasks}>
          查看转正任务
        </button>
      </aside>
    )
  }

  if (step === 'gang-training') {
    return (
      <aside className="prologue-guide" role="status">
        <span>POWER TREE · 转正资格</span>
        <strong>将帮派等级提升至 Lv.7</strong>
        <p>达到 Lv.7 后再次点击晋升，参加正式成员资格会议。</p>
        <button type="button" onClick={onOpenGangTree}>
          打开帮派权力树
        </button>
      </aside>
    )
  }

  return null
}
