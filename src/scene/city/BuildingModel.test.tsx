import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { buildingCatalogById } from '../../game/buildingCatalog'
import type { BuildingVisualPart } from './buildingVisualTypes'

vi.mock('./AnimatedBuildingFragment', () => ({
  AnimatedBuildingFragment: ({
    animate,
    children,
  }: {
    animate: boolean
    children: unknown
  }) => (
    <div data-testid="fragment" data-animate={String(animate)}>
      {children as never}
    </div>
  ),
}))

const { BuildingModel } = await import('./BuildingModel')
const { getFragmentPartMaterial } = await import('./buildingFragmentMaterial')

const box = (tag: string, colorRole: BuildingVisualPart['colorRole']) =>
  ({
    shape: 'box',
    tag,
    position: [0, 1, 0],
    size: [1, 2, 1],
    colorRole,
  }) satisfies BuildingVisualPart

describe('getFragmentPartMaterial', () => {
  const base = {
    primaryColor: '#111111',
    accentColor: '#22ff22',
    highlighted: false,
    neon: false,
    scaffold: false,
  }

  it('maps color roles to the definition palette and shared fixed colors', () => {
    expect(getFragmentPartMaterial(box('a', 'primary'), base).color).toBe(
      '#111111',
    )
    expect(getFragmentPartMaterial(box('a', 'accent'), base).color).toBe(
      '#22ff22',
    )
    expect(getFragmentPartMaterial(box('a', 'roof'), base).color).toBe(
      '#c8c9c7',
    )
    expect(getFragmentPartMaterial(box('a', 'dark'), base).color).toBe(
      '#2f3438',
    )
    expect(getFragmentPartMaterial(box('a', 'glass'), base).color).toBe(
      '#78909c',
    )
  })

  it('keeps a clubhouse neon sign and tube glowing with the accent color', () => {
    const sign = getFragmentPartMaterial(box('clubhouse-neon-sign', 'accent'), {
      ...base,
      neon: true,
    })
    const halo = getFragmentPartMaterial(box('clubhouse-neon-halo', 'accent'), {
      ...base,
      neon: true,
    })

    expect(sign.emissive).toBe('#22ff22')
    expect(sign.emissiveIntensity).toBeCloseTo(0.45, 5)
    expect(halo.emissiveIntensity).toBeCloseTo(0.45, 5)
  })

  it('does not glow the neon mounting mast', () => {
    const mast = getFragmentPartMaterial(box('clubhouse-neon-mast', 'dark'), {
      ...base,
      neon: true,
    })

    expect(mast.emissive).toBe('#000000')
    expect(mast.emissiveIntensity).toBe(0)
  })

  it('does not glow non-neon parts even when neon is enabled', () => {
    const material = getFragmentPartMaterial(
      box('clubhouse-main-hall', 'primary'),
      {
        ...base,
        neon: true,
      },
    )

    expect(material.emissive).toBe('#000000')
    expect(material.emissiveIntensity).toBe(0)
  })

  it('ignores neon-tagged parts when the building is not the clubhouse', () => {
    const material = getFragmentPartMaterial(box('gas-neon-sign', 'accent'), {
      ...base,
      neon: false,
    })

    expect(material.emissiveIntensity).toBe(0)
  })

  it('uses the shared warm highlight over neon and default emissive', () => {
    const highlighted = getFragmentPartMaterial(
      box('clubhouse-neon-sign', 'accent'),
      {
        ...base,
        neon: true,
        highlighted: true,
      },
    )

    expect(highlighted.emissive).toBe('#ffcf70')
    expect(highlighted.emissiveIntensity).toBeCloseTo(0.22, 5)
  })

  it('renders scaffold slots as translucent construction pads', () => {
    const scaffold = getFragmentPartMaterial(box('a', 'dark'), {
      ...base,
      scaffold: true,
    })
    const solid = getFragmentPartMaterial(box('a', 'dark'), base)

    expect(scaffold.transparent).toBe(true)
    expect(scaffold.opacity).toBeLessThan(1)
    expect(solid.transparent).toBe(false)
    expect(solid.opacity).toBe(1)
  })
})

describe('BuildingModel', () => {
  it('renders all five repair slots for a fresh building and animates none', () => {
    render(
      <BuildingModel
        definition={buildingCatalogById['repair-shop']}
        progress={{ level: 1, childLevels: [0, 0, 0, 0, 0] }}
        highlighted={false}
      />,
    )

    const fragments = screen.getAllByTestId('fragment')
    expect(fragments).toHaveLength(5)
    fragments.forEach((fragment) => {
      expect(fragment).toHaveAttribute('data-animate', 'false')
    })
  })

  it('animates only the freshly upgraded child at its independent slot', () => {
    render(
      <BuildingModel
        definition={buildingCatalogById['repair-shop']}
        progress={{ level: 3, childLevels: [1, 0, 2, 0, 0] }}
        highlighted={false}
        animatedFragmentId="repair-fragment-3"
      />,
    )

    const fragments = screen.getAllByTestId('fragment')
    expect(fragments).toHaveLength(5)
    expect(fragments[0]).toHaveAttribute('data-animate', 'false')
    expect(fragments[1]).toHaveAttribute('data-animate', 'false')
    expect(fragments[2]).toHaveAttribute('data-animate', 'true')
    expect(fragments[3]).toHaveAttribute('data-animate', 'false')
    expect(fragments[4]).toHaveAttribute('data-animate', 'false')
  })
})
