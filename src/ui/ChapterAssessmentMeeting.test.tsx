import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChapterAssessmentMeeting } from './ChapterAssessmentMeeting'

describe('ChapterAssessmentMeeting', () => {
  it('moves from a neutral event vote to one-of-three task package selection', async () => {
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
})
