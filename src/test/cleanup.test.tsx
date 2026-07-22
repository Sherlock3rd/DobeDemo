import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('React Testing Library cleanup', () => {
  it('renders a marker for the current test', () => {
    render(<div>cleanup-regression-marker</div>)

    expect(screen.getByText('cleanup-regression-marker')).toBeInTheDocument()
  })

  it('removes DOM rendered by the previous test', () => {
    expect(
      screen.queryByText('cleanup-regression-marker'),
    ).not.toBeInTheDocument()
  })
})
