import { act, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTotalReputationForLevel } from '../../game/gangProgression'
import { CITY_STORAGE_KEY, useCityStore } from '../../store/useCityStore'
import { useGangStore } from '../../store/useGangStore'

vi.mock('./BuildingModel', () => ({
  BuildingModel: ({
    definition,
    progress,
    animatedFragmentId,
    animationRun,
  }: {
    definition: { id: string }
    progress: { level: number; childLevels: number[] }
    animatedFragmentId?: string
    animationRun?: number
  }) => (
    <div
      data-testid="building-model"
      data-id={definition.id}
      data-level={progress.level}
      data-completed={
        progress.childLevels.filter((level) => level === progress.level).length
      }
      data-child-levels={progress.childLevels.join(',')}
      data-animated={animatedFragmentId ?? ''}
      data-animation-run={animationRun ?? ''}
    >
      {definition.id}
    </div>
  ),
}))

vi.mock('./LockedBuildingPlot', () => ({
  LockedBuildingPlot: () => <div data-testid="locked-building-plot" />,
}))

const { BuildingVisual } = await import('./BuildingVisual')

// Canonically raises the first repair child from Lv.0 to Lv.1 (a single-child
// increase), the same effect the removed fixed-order bridge action produced.
function bumpFirstRepairChild(): void {
  useCityStore.setState((state) => ({
    buildingProgress: {
      ...state.buildingProgress,
      'repair-shop': { level: 1, childLevels: [1, 0, 0, 0, 0] },
    },
  }))
}

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
      bumpFirstRepairChild()
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
      vi.restoreAllMocks()
      vi.useRealTimers()
    })

    it('does not replay an entrance for progress restored on mount', () => {
      act(() => {
        bumpFirstRepairChild()
      })

      render(<BuildingVisual id="repair-shop" highlighted={false} />)

      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animated',
        '',
      )
    })

    it('does not animate a single-child increase applied by rehydrate after mount', async () => {
      render(<BuildingVisual id="repair-shop" highlighted={false} />)
      const durable = useCityStore.getState()
      window.localStorage.setItem(
        CITY_STORAGE_KEY,
        JSON.stringify({
          version: 2,
          state: {
            buildingProgress: {
              ...durable.buildingProgress,
              'repair-shop': {
                level: 1,
                childLevels: [1, 0, 0, 0, 0],
              },
            },
            resources: durable.resources,
            lastResourceUpdatedAt: durable.lastResourceUpdatedAt,
            activeProducerIds: durable.activeProducerIds,
          },
        }),
      )

      await act(async () => {
        await useCityStore.persist.rehydrate()
      })

      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-child-levels',
        '1,0,0,0,0',
      )
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
        bumpFirstRepairChild()
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

    it('restarts the same fragment with a new run for consecutive upgrades', () => {
      useCityStore.setState((state) => ({
        buildingProgress: {
          ...state.buildingProgress,
          'repair-shop': {
            level: 3,
            childLevels: [0, 0, 0, 0, 0],
          },
        },
      }))
      render(<BuildingVisual id="repair-shop" highlighted={false} />)

      act(() => {
        useCityStore.setState((state) => ({
          buildingProgress: {
            ...state.buildingProgress,
            'repair-shop': {
              level: 3,
              childLevels: [1, 0, 0, 0, 0],
            },
          },
        }))
      })
      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animation-run',
        '1',
      )

      act(() => {
        vi.advanceTimersByTime(100)
        useCityStore.setState((state) => ({
          buildingProgress: {
            ...state.buildingProgress,
            'repair-shop': {
              level: 3,
              childLevels: [2, 0, 0, 0, 0],
            },
          },
        }))
      })
      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animated',
        'repair-fragment-1',
      )
      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animation-run',
        '2',
      )

      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animated',
        'repair-fragment-1',
      )

      act(() => {
        vi.advanceTimersByTime(100)
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
        bumpFirstRepairChild()
      })

      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animated',
        'repair-fragment-1',
      )
    })

    it('animates the exact child that increases by one regardless of slot order', () => {
      useCityStore.setState((state) => ({
        buildingProgress: {
          ...state.buildingProgress,
          'repair-shop': {
            level: 5,
            childLevels: [0, 0, 0, 0, 0],
          },
        },
      }))
      render(<BuildingVisual id="repair-shop" highlighted={false} />)

      act(() => {
        useCityStore.setState((state) => ({
          buildingProgress: {
            ...state.buildingProgress,
            'repair-shop': {
              ...state.buildingProgress['repair-shop'],
              childLevels: [0, 0, 0, 0, 1],
            },
          },
        }))
      })

      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animated',
        'repair-fragment-5',
      )
    })

    it('does not animate for a main-only level change', () => {
      render(<BuildingVisual id="repair-shop" highlighted={false} />)

      act(() => {
        useCityStore.setState((state) => ({
          buildingProgress: {
            ...state.buildingProgress,
            'repair-shop': {
              level: 2,
              childLevels: [
                ...state.buildingProgress['repair-shop'].childLevels,
              ],
            },
          },
        }))
      })

      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animated',
        '',
      )
    })

    it('does not animate a child increase bundled with a main-level upgrade', () => {
      render(<BuildingVisual id="repair-shop" highlighted={false} />)

      act(() => {
        useCityStore.setState((state) => ({
          buildingProgress: {
            ...state.buildingProgress,
            'repair-shop': {
              level: 2,
              childLevels: [1, 0, 0, 0, 0],
            },
          },
        }))
      })

      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animated',
        '',
      )
    })

    it('does not animate a child change outside the unlocked prefix', () => {
      useGangStore.setState({
        totalReputation: getTotalReputationForLevel(16),
      })
      useCityStore.setState((state) => ({
        buildingProgress: {
          ...state.buildingProgress,
          'commercial-street': {
            level: 2,
            childLevels: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          },
        },
      }))
      render(<BuildingVisual id="commercial-street" highlighted={false} />)
      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animation-run',
        '0',
      )
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
      setTimeoutSpy.mockClear()

      act(() => {
        useCityStore.setState((state) => ({
          buildingProgress: {
            ...state.buildingProgress,
            'commercial-street': {
              level: 2,
              childLevels: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
            },
          },
        }))
      })

      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animated',
        '',
      )
      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animation-run',
        '0',
      )
      expect(setTimeoutSpy).not.toHaveBeenCalledWith(expect.any(Function), 400)
    })

    it('does not animate the repair level-five to six main transition', () => {
      useCityStore.setState((state) => ({
        buildingProgress: {
          ...state.buildingProgress,
          'repair-shop': {
            level: 5,
            childLevels: [5, 5, 5, 5, 5],
          },
        },
      }))
      render(<BuildingVisual id="repair-shop" highlighted={false} />)

      act(() => {
        useCityStore.setState((state) => ({
          buildingProgress: {
            ...state.buildingProgress,
            'repair-shop': {
              level: 6,
              childLevels: [5, 5, 5, 5, 5],
            },
          },
        }))
      })

      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animated',
        '',
      )
    })

    it('does not animate when multiple children change together', () => {
      render(<BuildingVisual id="repair-shop" highlighted={false} />)

      act(() => {
        useCityStore.setState((state) => ({
          buildingProgress: {
            ...state.buildingProgress,
            'repair-shop': {
              ...state.buildingProgress['repair-shop'],
              childLevels: [1, 1, 0, 0, 0],
            },
          },
        }))
      })

      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animated',
        '',
      )
    })

    it('does not animate when reset lowers a child level', () => {
      useCityStore.setState((state) => ({
        buildingProgress: {
          ...state.buildingProgress,
          'repair-shop': {
            ...state.buildingProgress['repair-shop'],
            childLevels: [1, 0, 0, 0, 0],
          },
        },
      }))
      render(<BuildingVisual id="repair-shop" highlighted={false} />)

      act(() => {
        useCityStore.getState().reset()
      })

      expect(screen.getByTestId('building-model')).toHaveAttribute(
        'data-animated',
        '',
      )
    })
  })
})
