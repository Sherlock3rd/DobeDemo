import { cityPointerDragTracker } from './pointerDragTracker'

export const FALLBACK_MOUSE_POINTER_ID = 1

// Tracks native events already claimed by a foreground handler (e.g. a
// building click) so background handlers can bail out even if pointer-event
// propagation is not stopped. This is defense-in-depth alongside
// stopPropagation, not a replacement for it.
const handledNativeEvents = new WeakSet<object>()

function isNonNullObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null
}

export function markPointerEventHandled(nativeEvent: unknown): void {
  if (isNonNullObject(nativeEvent)) {
    handledNativeEvents.add(nativeEvent)
  }
}

export function isPointerEventHandled(nativeEvent: unknown): boolean {
  return isNonNullObject(nativeEvent) && handledNativeEvents.has(nativeEvent)
}

function hasFinitePointerId(value: unknown): value is { pointerId: number } {
  if (typeof value !== 'object' || value === null || !('pointerId' in value)) {
    return false
  }

  const { pointerId } = value as { pointerId: unknown }

  return typeof pointerId === 'number' && Number.isFinite(pointerId)
}

export function getPointerId(nativeEvent: unknown): number {
  return hasFinitePointerId(nativeEvent)
    ? nativeEvent.pointerId
    : FALLBACK_MOUSE_POINTER_ID
}

export function consumePointerDrag(nativeEvent: unknown): boolean {
  return cityPointerDragTracker.consumeDraggedClick(getPointerId(nativeEvent))
}
