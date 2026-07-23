import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

interface MatchMediaStub {
  matches: boolean
}

function stubMatchMedia(stub: MatchMediaStub | undefined) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value:
      stub === undefined
        ? undefined
        : vi.fn().mockReturnValue({
            matches: stub.matches,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          }),
  })
}

afterEach(() => {
  // jsdom does not implement matchMedia; restore the absent default.
  stubMatchMedia(undefined)
})

describe('usePrefersReducedMotion', () => {
  it('defaults to false when matchMedia is unavailable', () => {
    stubMatchMedia(undefined)

    const { result } = renderHook(() => usePrefersReducedMotion())

    expect(result.current).toBe(false)
  })

  it('reports true when the reduce query matches', () => {
    stubMatchMedia({ matches: true })

    const { result } = renderHook(() => usePrefersReducedMotion())

    expect(result.current).toBe(true)
  })

  it('reports false when the reduce query does not match', () => {
    stubMatchMedia({ matches: false })

    const { result } = renderHook(() => usePrefersReducedMotion())

    expect(result.current).toBe(false)
  })
})
