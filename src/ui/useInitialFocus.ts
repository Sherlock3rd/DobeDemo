import { useEffect, useRef, type RefObject } from 'react'

export function useInitialFocus<T extends HTMLElement>(
  active = true,
): RefObject<T | null> {
  const targetRef = useRef<T>(null)

  useEffect(() => {
    if (active) {
      targetRef.current?.focus()
    }
  }, [active])

  return targetRef
}
