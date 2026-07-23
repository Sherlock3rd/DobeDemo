import type { BuildingId } from '../../game/cityTypes'

type CityCursor = 'grab' | 'grabbing' | 'pointer'

export interface CityCursorController {
  registerCanvas(element: HTMLElement): () => void
  setCameraDragging(dragging: boolean): void
  setBuildingHovered(id: BuildingId, hovered: boolean): void
  reset(): void
}

export function createCityCursorController(): CityCursorController {
  let element: HTMLElement | null = null
  let originalCursor = ''
  let dragging = false
  const hoveredBuildingIds = new Set<BuildingId>()

  function resolveCursor(): CityCursor {
    if (dragging) {
      return 'grabbing'
    }

    if (hoveredBuildingIds.size > 0) {
      return 'pointer'
    }

    return 'grab'
  }

  function apply(): void {
    if (element) {
      element.style.cursor = resolveCursor()
    }
  }

  function restore(): void {
    if (element) {
      element.style.cursor = originalCursor
    }
  }

  return {
    registerCanvas(nextElement) {
      element = nextElement
      originalCursor = nextElement.style.cursor
      apply()

      return () => {
        if (element !== nextElement) {
          return
        }

        restore()
        element = null
        originalCursor = ''
      }
    },

    setCameraDragging(nextDragging) {
      dragging = nextDragging
      apply()
    },

    setBuildingHovered(id, hovered) {
      if (hovered) {
        hoveredBuildingIds.add(id)
      } else {
        hoveredBuildingIds.delete(id)
      }

      apply()
    },

    reset() {
      restore()
      element = null
      originalCursor = ''
      dragging = false
      hoveredBuildingIds.clear()
    },
  }
}

export const cityCursorController: CityCursorController =
  createCityCursorController()
