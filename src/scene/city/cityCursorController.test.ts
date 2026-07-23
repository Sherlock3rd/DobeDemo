import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  cityCursorController,
  createCityCursorController,
} from './cityCursorController'

describe('createCityCursorController', () => {
  let controller: ReturnType<typeof createCityCursorController>
  let element: HTMLDivElement

  beforeEach(() => {
    controller = createCityCursorController()
    element = document.createElement('div')
    document.body.appendChild(element)
  })

  afterEach(() => {
    element.remove()
    document.body.style.cursor = ''
  })

  it('applies the grab cursor when a canvas is registered', () => {
    controller.registerCanvas(element)

    expect(element.style.cursor).toBe('grab')
  })

  it('does not pollute the document body cursor', () => {
    controller.registerCanvas(element)

    expect(document.body.style.cursor).toBe('')
  })

  it('shows grabbing while the camera is dragging', () => {
    controller.registerCanvas(element)

    controller.setCameraDragging(true)

    expect(element.style.cursor).toBe('grabbing')
  })

  it('shows pointer when a building is hovered and not dragging', () => {
    controller.registerCanvas(element)

    controller.setBuildingHovered('repair-shop', true)

    expect(element.style.cursor).toBe('pointer')
  })

  it('prioritises grabbing over a hovered building', () => {
    controller.registerCanvas(element)
    controller.setBuildingHovered('repair-shop', true)

    controller.setCameraDragging(true)

    expect(element.style.cursor).toBe('grabbing')

    controller.setCameraDragging(false)

    expect(element.style.cursor).toBe('pointer')
  })

  it('keeps the pointer cursor while any building retains hover ownership', () => {
    controller.registerCanvas(element)
    controller.setBuildingHovered('repair-shop', true)
    controller.setBuildingHovered('gas-station', true)

    controller.setBuildingHovered('repair-shop', false)
    expect(element.style.cursor).toBe('pointer')

    controller.setBuildingHovered('gas-station', false)
    expect(element.style.cursor).toBe('grab')
  })

  it('restores the original cursor when unregistered and stops updating', () => {
    element.style.cursor = 'crosshair'

    const unregister = controller.registerCanvas(element)
    unregister()

    expect(element.style.cursor).toBe('crosshair')

    controller.setCameraDragging(true)
    expect(element.style.cursor).toBe('crosshair')
  })

  it('restores the original cursor and clears state on reset', () => {
    element.style.cursor = 'crosshair'
    controller.registerCanvas(element)
    controller.setCameraDragging(true)
    controller.setBuildingHovered('repair-shop', true)

    controller.reset()

    expect(element.style.cursor).toBe('crosshair')

    const unregister = controller.registerCanvas(element)
    expect(element.style.cursor).toBe('grab')
    unregister()
  })
})

describe('cityCursorController', () => {
  it('exposes a shared controller instance', () => {
    const element = document.createElement('div')
    document.body.appendChild(element)

    const unregister = cityCursorController.registerCanvas(element)
    expect(element.style.cursor).toBe('grab')

    unregister()
    element.remove()
  })
})
