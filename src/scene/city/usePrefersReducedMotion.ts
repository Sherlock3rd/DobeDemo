import { useEffect, useState } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function readMatch(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false
  }

  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

// Tracks the OS "reduce motion" accessibility preference. Falls back to false
// wherever matchMedia is unavailable (SSR/jsdom) so callers can always animate
// unless the user explicitly opted out.
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(readMatch)

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return
    }

    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return reduced
}
