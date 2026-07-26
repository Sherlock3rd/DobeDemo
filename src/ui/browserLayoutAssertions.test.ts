// @ts-expect-error Browser smoke assertions are shared from a plain Node module.
import { hasPositiveAreaOverlap } from '../../.superpowers/sdd/browser-layout-assertions.mjs'
import { describe, expect, it } from 'vitest'

describe('browser layout assertions', () => {
  it('detects positive-area overlap between browser rectangles', () => {
    expect(
      hasPositiveAreaOverlap(
        { left: 0, right: 100, top: 0, bottom: 100 },
        { left: 90, right: 120, top: 20, bottom: 80 },
      ),
    ).toBe(true)
  })

  it('allows separated or merely touching browser rectangles', () => {
    const portrait = { left: 0, right: 100, top: 0, bottom: 100 }

    expect(
      hasPositiveAreaOverlap(portrait, {
        left: 100,
        right: 180,
        top: 0,
        bottom: 100,
      }),
    ).toBe(false)
    expect(
      hasPositiveAreaOverlap(portrait, {
        left: 110,
        right: 180,
        top: 0,
        bottom: 100,
      }),
    ).toBe(false)
  })
})
