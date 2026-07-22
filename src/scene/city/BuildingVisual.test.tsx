import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTotalReputationForLevel } from '../../game/gangProgression'
import { useGangStore } from '../../store/useGangStore'

vi.mock('./BuildingModel', () => ({
  BuildingModel: ({ definition }: { definition: { id: string } }) => (
    <div data-testid="building-model">{definition.id}</div>
  ),
}))

vi.mock('./LockedBuildingPlot', () => ({
  LockedBuildingPlot: () => <div data-testid="locked-building-plot" />,
}))

const { BuildingVisual } = await import('./BuildingVisual')

describe('BuildingVisual', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useGangStore.getState().reset(1_700_000_000_000)
  })

  it('renders the repair shop model at zero reputation', () => {
    render(<BuildingVisual id="repair-shop" level={1} highlighted={false} />)

    expect(screen.getByTestId('building-model')).toHaveTextContent(
      'repair-shop',
    )
    expect(screen.queryByTestId('locked-building-plot')).not.toBeInTheDocument()
  })

  it('renders the recycling yard locked plot at zero reputation', () => {
    render(<BuildingVisual id="recycling-yard" level={1} highlighted={false} />)

    expect(screen.getByTestId('locked-building-plot')).toBeInTheDocument()
    expect(screen.queryByTestId('building-model')).not.toBeInTheDocument()
  })

  it('switches the recycling yard to its model at the level 8 threshold', () => {
    useGangStore.setState({
      totalReputation: getTotalReputationForLevel(8),
    })

    render(<BuildingVisual id="recycling-yard" level={1} highlighted={false} />)

    expect(screen.getByTestId('building-model')).toHaveTextContent(
      'recycling-yard',
    )
    expect(screen.queryByTestId('locked-building-plot')).not.toBeInTheDocument()
  })
})
