import { act, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTotalReputationForLevel } from '../../game/gangProgression'
import { useCityStore } from '../../store/useCityStore'
import { useGangStore } from '../../store/useGangStore'

vi.mock('./BuildingModel', () => ({
  BuildingModel: ({
    definition,
    progress,
    animatedFragmentId,
  }: {
    definition: { id: string }
    progress: { level: number; childLevels: number[] }
    animatedFragmentId?: string
  }) => (
    <div
      data-testid="building-model"
      data-id={definition.id}
      data-level={progress.level}
      data-completed={
        progress.childLevels.filter((level) => level === progress.level).length
      }
      data-animated={animatedFragmentId ?? ''}
    >
      {definition.id}
    </div>
  ),
}))

vi.mock('./LockedBuildingPlot', () => ({
  LockedBuildingPlot: () => <div data-testid="locked-building-plot" />,
}))

const { BuildingVisual } = await import('./BuildingVisual')

describe('BuildingVisual', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useCityStore.getState().reset()
    useGangStore.getState().reset(1_700_000_000_000)
  })

  it('renders the repair shop model at zero reputation', () => {
    render(<BuildingVisual id="repair-shop" highlighted={false} />)

    expect(screen.getByTestId('building-model')).toHaveTextContent(
      'repair-shop',
    )
    expect(screen.queryByTestId('locked-building-plot')).not.toBeInTheDocument()
  })

  it('renders the recycling yard locked plot at zero reputation', () => {
    render(<BuildingVisual id="recycling-yard" highlighted={false} />)

    expect(screen.getByTestId('locked-building-plot')).toBeInTheDocument()
    expect(screen.queryByTestId('building-model')).not.toBeInTheDocument()
  })

  it('switches the recycling yard to its model at the level 8 threshold', () => {
    useGangStore.setState({ totalReputation: getTotalReputationForLevel(8) })

    render(<BuildingVisual id="recycling-yard" highlighted={false} />)

    expect(screen.getByTestId('building-model')).toHaveTextContent(
      'recycling-yard',
    )
  })

  it('forwards the full building progress from the store', () => {
    act(() => {
      useCityStore.getState().completeNextFragment('repair-shop')
    })

    render(<BuildingVisual id="repair-shop" highlighted={false} />)

    expect(screen.getByTestId('building-model')).toHaveAttribute(
      'data-completed',
      '1',
    )
  })

  describe('entrance animation gating', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('does not replay an entrance for progress restored on mount', () => {
      act(() => {
        useCityStore.getState().completeNextFragment('repair-shop')
      })

      render(<BuildingVisual id="repair-shop" highlighted={false} />)

      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animated',
        '',
      )
    })

    it('animates only the freshly completed fragment for a session click, then clears', () => {
      render(<BuildingVisual id="repair-shop" highlighted={false} />)
      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animated',
        '',
      )

      act(() => {
        useCityStore.getState().completeNextFragment('repair-shop')
      })
      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animated',
        'repair-fragment-1',
      )

      act(() => {
        vi.advanceTimersByTime(400)
      })
      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animated',
        '',
      )
    })

    it('keeps animating under StrictMode double-invocation', () => {
      render(
        <StrictMode>
          <BuildingVisual id="repair-shop" highlighted={false} />
        </StrictMode>,
      )

      act(() => {
        useCityStore.getState().completeNextFragment('repair-shop')
      })

      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animated',
        'repair-fragment-1',
      )
    })
  })
})
