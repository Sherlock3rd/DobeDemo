import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from './AppErrorBoundary'

function ThrowingChild(): never {
  throw new Error('boom')
}

describe('AppErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when no error occurs', () => {
    render(
      <AppErrorBoundary>
        <p>正常内容</p>
      </AppErrorBoundary>,
    )

    expect(screen.getByText('正常内容')).toBeInTheDocument()
  })

  it('shows alert fallback when a child throws during render', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <AppErrorBoundary>
        <ThrowingChild />
      </AppErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Demo 加载失败/)).toBeInTheDocument()
  })
})
