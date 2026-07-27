import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChapterAssessmentMeeting } from './ChapterAssessmentMeeting'

describe('ChapterAssessmentMeeting', () => {
  it('progresses from the chapter-one decision to task confirmation and assignment', async () => {
    const onComplete = vi.fn()
    render(
      <ChapterAssessmentMeeting chapterNumber={1} onComplete={onComplete} />,
    )

    expect(
      screen.getByRole('dialog', {
        name: '第一章 · 冷炉初燃评定会议',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('旁听席 · 无投票权')).toBeInTheDocument()
    expect(screen.getByText('此刻只评定行动方向')).toBeInTheDocument()
    expect(screen.queryByText('你的章节任务')).not.toBeInTheDocument()
    expect(screen.queryByText('领头人就位')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '投赞成票' }),
    ).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '听取会议决议' }))

    expect(
      screen.getByRole('status', { name: '第一章评定结果' }),
    ).toHaveTextContent('议案通过')
    expect(screen.getByText('本章只记录委员会决议')).toBeInTheDocument()
    expect(screen.queryByText('领头人就位')).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: '根据决议形成任务' }),
    )
    expect(screen.getByText('本章行动任务已形成')).toBeInTheDocument()
    expect(screen.getByLabelText('本章行动任务池').children).toHaveLength(8)
    expect(screen.getByText('领头人就位')).toBeInTheDocument()
    expect(screen.getByText('点燃修理厂')).toBeInTheDocument()
    expect(screen.getByText('清理街口')).toBeInTheDocument()
    expect(screen.getByText('第一面完整补丁')).toBeInTheDocument()
    expect(screen.queryByText('你的章节任务')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '进入成员分配' }))
    expect(screen.getByText('你的章节任务')).toBeInTheDocument()
    expect(screen.getByText('其他成员任务')).toBeInTheDocument()
    expect(screen.getByLabelText('Thomas的章节任务').children).toHaveLength(4)
    expect(screen.getByLabelText('其他成员分派任务').children).toHaveLength(4)

    await userEvent.click(
      screen.getByRole('button', { name: '接取四项章节任务' }),
    )
    expect(onComplete).toHaveBeenCalledWith(1)
  })

  it('keeps committee markers and the passed result identical for either player vote', async () => {
    const vote = async (
      buttonName: '投赞成票' | '投反对票',
    ): Promise<{
      result: string
      memberVotes: string[]
    }> => {
      const view = render(
        <ChapterAssessmentMeeting chapterNumber={2} onComplete={() => {}} />,
      )
      expect(
        screen.getByLabelText('第一章 · 冷炉初燃成员完成度'),
      ).toBeInTheDocument()
      expect(screen.getByLabelText('Thomas Shelby评级 S')).toBeInTheDocument()
      for (const grade of ['A', 'B', 'C', 'D']) {
        expect(
          view.container.querySelector(`[data-grade="${grade}"]`),
        ).not.toBeNull()
      }
      await userEvent.click(
        screen.getByRole('button', { name: '宣读评定结论' }),
      )
      expect(
        screen.getByRole('status', {
          name: '第一章 · 冷炉初燃评定完成',
        }),
      ).toHaveTextContent('Thomas Shelby · 本章最佳')
      await userEvent.click(
        screen.getByRole('button', { name: '进入本章任务评定' }),
      )
      expect(screen.getByText('此刻只评定行动方向')).toBeInTheDocument()
      expect(screen.queryByText('你的章节任务')).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: '进入表决' }))
      await userEvent.click(screen.getByRole('button', { name: buttonName }))
      const result =
        screen.getByRole('status', { name: '第二章评定结果' }).textContent ?? ''
      const memberVotes = Array.from(
        view.container.querySelectorAll<HTMLElement>(
          '.chapter-assessment__member[data-vote]',
        ),
      ).map((element) => element.dataset.vote ?? '')
      await userEvent.click(
        screen.getByRole('button', { name: '根据决议形成任务' }),
      )
      expect(screen.getByLabelText('本章行动任务池').children).toHaveLength(8)
      expect(screen.queryByText('你的章节任务')).not.toBeInTheDocument()
      await userEvent.click(
        screen.getByRole('button', { name: '进入成员分配' }),
      )
      expect(screen.getByText('你的章节任务')).toBeInTheDocument()
      expect(screen.getByText('其他成员任务')).toBeInTheDocument()
      view.unmount()
      return { result, memberVotes }
    }

    const support = await vote('投赞成票')
    const oppose = await vote('投反对票')

    expect(support.memberVotes).toEqual(oppose.memberVotes)
    expect(support.result).toContain('议案通过')
    expect(oppose.result).toContain('议案通过')
  })
})
