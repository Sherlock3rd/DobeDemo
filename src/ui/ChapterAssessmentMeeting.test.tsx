import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChapterAssessmentMeeting } from './ChapterAssessmentMeeting'

describe('ChapterAssessmentMeeting', () => {
  const finishFormalMemberEligibility = async (): Promise<void> => {
    expect(screen.getByText('正式成员资格表决')).toBeInTheDocument()
    expect(
      screen.getByText('是否接纳 Thomas Shelby 成为剃刀党正式成员？'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '开始资格表决' }))
    expect(
      screen.getByRole('status', { name: '正式成员资格表决结果' }),
    ).toHaveTextContent('赞成 5 席 · 保留 1 席 · 资格通过')
    await userEvent.click(
      screen.getByRole('button', { name: '听取表决后的对话' }),
    )
    expect(
      screen.getByRole('dialog', {
        name: '剧情对话：正式成员资格通过',
      }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '下一句' }))
    await userEvent.click(screen.getByRole('button', { name: '继续评定会议' }))
  }

  it('adds the formal-member vote and dialogue before the neutral event and task packages', async () => {
    const onComplete = vi.fn()
    render(
      <ChapterAssessmentMeeting
        completedChapterNumber={1}
        onComplete={onComplete}
      />,
    )

    expect(
      screen.getByRole('dialog', {
        name: '第一章 · 冷炉初燃完成评定会议',
      }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('章节会议流程')).toHaveTextContent('资格表决')

    await finishFormalMemberEligibility()

    expect(screen.getByText('无主废车涌入南区')).toBeInTheDocument()
    expect(screen.getByText('对当前事件进行中性表决')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '进入事件表决' }))
    await userEvent.click(screen.getByRole('button', { name: /先核清来源/ }))

    expect(
      screen.getByRole('status', { name: '事件表决结果' }),
    ).toHaveTextContent('你的选择：先核清来源')
    await userEvent.click(
      screen.getByRole('button', { name: '查看三个任务包' }),
    )

    const packageGroup = screen.getByRole('radiogroup', {
      name: '第二章 · 废铁生意任务包',
    })
    expect(packageGroup.querySelectorAll('[role="radio"]')).toHaveLength(3)
    expect(screen.getByText('方案 A · 1 项')).toBeInTheDocument()
    expect(screen.getByText('方案 B · 2 项')).toBeInTheDocument()
    expect(screen.getByText('方案 C · 3 项')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: /拆解产线/ }))
    expect(screen.getByLabelText('本章固定额外任务')).toHaveTextContent(
      '职位声望',
    )
    expect(screen.getByLabelText('本章固定额外任务')).toHaveTextContent(
      '清理街区',
    )
    expect(screen.getByLabelText('本章固定额外任务')).toHaveTextContent(
      '公路行动',
    )
    await userEvent.click(
      screen.getByRole('button', { name: '确认接取并开始第2章' }),
    )

    expect(onComplete).toHaveBeenCalledWith({
      completedChapterNumber: 1,
      nextChapterNumber: 2,
      selectedPackageId: 'chapter-2-package-yard',
      vote: 'option-a',
    })
  })

  it('opens the same three packages after either neutral vote', async () => {
    const readPackages = async (
      voteName: '先核清来源' | '先保住产线',
    ): Promise<string[]> => {
      const view = render(
        <ChapterAssessmentMeeting
          completedChapterNumber={1}
          onComplete={() => {}}
        />,
      )
      await finishFormalMemberEligibility()
      await userEvent.click(
        screen.getByRole('button', { name: '进入事件表决' }),
      )
      await userEvent.click(
        screen.getByRole('button', { name: new RegExp(voteName) }),
      )
      await userEvent.click(
        screen.getByRole('button', { name: '查看三个任务包' }),
      )
      const titles = screen
        .getAllByRole('radio')
        .map((radio) => radio.textContent ?? '')
      view.unmount()
      return titles
    }

    expect(await readPackages('先核清来源')).toEqual(
      await readPackages('先保住产线'),
    )
  })

  it('adds a unanimous presidency vote and dialogue before the seventh chapter meeting', async () => {
    render(
      <ChapterAssessmentMeeting
        completedChapterNumber={6}
        onComplete={() => {}}
      />,
    )

    expect(screen.getByText('主席继任资格表决')).toBeInTheDocument()
    expect(
      screen.getByText('是否推举 Thomas Shelby 接掌剃刀党主席席位？'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '开始资格表决' }))
    expect(
      screen.getByRole('status', { name: '主席继任资格表决结果' }),
    ).toHaveTextContent('赞成 6 席 · 保留 0 席 · 资格通过')
    await userEvent.click(
      screen.getByRole('button', { name: '听取表决后的对话' }),
    )
    expect(
      screen.getByRole('dialog', { name: '剧情对话：主席继任资格通过' }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '下一句' }))
    await userEvent.click(screen.getByRole('button', { name: '继续评定会议' }))
    expect(screen.getByText('主席席位需要最终章程')).toBeInTheDocument()
  })

  it('keeps ordinary chapter transitions on the original three-step flow', () => {
    render(
      <ChapterAssessmentMeeting
        completedChapterNumber={2}
        onComplete={() => {}}
      />,
    )

    expect(screen.queryByText('资格表决')).not.toBeInTheDocument()
    expect(screen.getByText('商业街夜间货流改道')).toBeInTheDocument()
  })
})
