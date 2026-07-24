import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCityStore } from '../store/useCityStore'
import { useGangStore } from '../store/useGangStore'
import { SettingsPanel } from './SettingsPanel'

const BASE_TIME = 1_700_000_000_000

describe('SettingsPanel', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useCityStore.getState().reset(BASE_TIME)
    useGangStore.getState().reset(BASE_TIME)
    vi.restoreAllMocks()
  })

  it('unlocks the gang tree immediately, keeps the panel open, and announces success', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    vi.spyOn(Date, 'now').mockReturnValue(BASE_TIME + 80_000_000)
    render(<SettingsPanel onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: '解锁帮派树' }))

    expect(useGangStore.getState()).toMatchObject({
      totalReputation: 1470,
      lastUpdatedAt: BASE_TIME + 80_000_000,
    })
    expect(screen.getByRole('dialog', { name: '调试设置' })).toBeInTheDocument()
    expect(screen.getByText('帮派树已解锁')).toHaveAttribute(
      'aria-live',
      'polite',
    )
    expect(
      screen.queryByRole('button', { name: '确认重置账号' }),
    ).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('repeatedly grants every resource, keeps the panel open, and announces success', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    vi.spyOn(Date, 'now').mockReturnValue(BASE_TIME)
    render(<SettingsPanel onClose={onClose} />)
    const grantButton = screen.getByRole('button', {
      name: '钱/油/物资各 +10000',
    })

    await user.click(grantButton)
    await user.click(grantButton)

    expect(useCityStore.getState().resources).toEqual({
      money: 30_000,
      oil: 20_000,
      materials: 20_000,
    })
    expect(screen.getByText('钱、油、物资各增加 10000')).toHaveAttribute(
      'aria-live',
      'polite',
    )
    expect(screen.getByRole('dialog', { name: '调试设置' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '确认重置账号' }),
    ).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('requires a second confirmation before resetting', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const confirmedAt = BASE_TIME + 12_345
    vi.spyOn(Date, 'now').mockReturnValue(confirmedAt)
    useGangStore.setState({ totalReputation: 480 })
    useCityStore.getState().selectBuilding('repair-shop')

    render(<SettingsPanel onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: '重置账号' }))

    expect(useGangStore.getState().totalReputation).toBe(480)
    expect(useCityStore.getState().selectedBuildingId).toBe('repair-shop')
    expect(
      screen.getByRole('button', { name: '确认重置账号' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '确认重置账号' }))

    expect(useGangStore.getState().totalReputation).toBe(0)
    expect(useGangStore.getState().lastUpdatedAt).toBe(confirmedAt)
    expect(useCityStore.getState().selectedBuildingId).toBeNull()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cancels confirmation without resetting', async () => {
    const user = userEvent.setup()
    useGangStore.setState({ totalReputation: 480 })
    render(<SettingsPanel onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '重置账号' }))
    await user.click(screen.getByRole('button', { name: '取消重置' }))

    expect(useGangStore.getState().totalReputation).toBe(480)
    expect(
      screen.queryByRole('button', { name: '确认重置账号' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重置账号' })).toBeInTheDocument()
  })

  it('renders an accessible dialog with warning copy and a named close button', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<SettingsPanel onClose={onClose} />)

    const dialog = screen.getByRole('dialog', { name: '调试设置' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(
      screen.getByText('仅用于 Demo 调试，管理当前浏览器中的账号进度。'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        '声望、职位、建筑解锁、建筑等级和碎片进度都会恢复初始状态，且无法撤销。',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '关闭调试设置' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape and removes the listener after unmount', () => {
    const onClose = vi.fn()
    const { unmount } = render(<SettingsPanel onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    unmount()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps overlay, panel and button interactions from reaching a parent scene', async () => {
    const user = userEvent.setup()
    const onParentPointerDown = vi.fn()
    const onParentClick = vi.fn()
    const { container } = render(
      <div onPointerDown={onParentPointerDown} onClick={onParentClick}>
        <SettingsPanel onClose={vi.fn()} />
      </div>,
    )

    const overlay = container.querySelector('.settings-panel__overlay')
    expect(overlay).not.toBeNull()
    fireEvent.pointerDown(overlay as Element)
    fireEvent.click(overlay as Element)
    await user.click(screen.getByRole('dialog', { name: '调试设置' }))
    await user.click(screen.getByRole('button', { name: '重置账号' }))

    expect(onParentPointerDown).not.toHaveBeenCalled()
    expect(onParentClick).not.toHaveBeenCalled()
  })
})
