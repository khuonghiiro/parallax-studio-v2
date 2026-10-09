import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import type { AssembledLayerItem } from './types'
import {
  startLayerAssemblyGizmoDrag,
  type LayerAssemblyDragContext
} from './layerAssemblyGizmoDrag'

describe('layerAssemblyGizmoDrag', () => {
  let listeners: Record<string, ((ev: any) => void)[]> = {}
  const originalWindow = (globalThis as any).window

  beforeEach(() => {
    listeners = {}
    const mockWindow = {
      addEventListener: (type: string, fn: any) => {
        listeners[type] = listeners[type] || []
        listeners[type].push(fn)
      },
      removeEventListener: (type: string, fn: any) => {
        listeners[type] = (listeners[type] || []).filter((f) => f !== fn)
      },
      dispatchEvent: (event: { type: string; [key: string]: any }) => {
        for (const fn of [...(listeners[event.type] || [])]) fn(event)
      }
    }
    ;(globalThis as any).window = mockWindow
  })

  afterEach(() => {
    ;(globalThis as any).window = originalWindow
  })

  function fire(event: { type: string; [key: string]: unknown }): void {
    for (const fn of [...(listeners[event.type] || [])]) fn(event)
  }

  function createTestContext(layerOverrides: Partial<AssembledLayerItem> = {}): {
    context: LayerAssemblyDragContext
    onUpdateLayer: ReturnType<typeof vi.fn>
    onDragStateChange: ReturnType<typeof vi.fn>
  } {
    const layer: AssembledLayerItem = {
      id: 'layer-test-1',
      name: 'Layer Test',
      x: 50,
      y: 100,
      z: 20,
      scale: 1.0,
      rotation: 0,
      opacity: 1.0,
      motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' },
      ...layerOverrides
    }

    const camera = new THREE.PerspectiveCamera(45, 1.5, 1, 10000)
    camera.position.set(0, 0, 1000)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()

    const rect = { x: 0, y: 0, w: 900, h: 600 }
    const worldMatrix = new THREE.Matrix4().setPosition(layer.x, -layer.y, -layer.z)
    const onUpdateLayer = vi.fn()
    const onDragStateChange = vi.fn()

    const context: LayerAssemblyDragContext = {
      layer,
      camera,
      rect,
      worldMatrix,
      zExaggeration: 1.8,
      onUpdateLayer,
      onDragStateChange
    }

    return { context, onUpdateLayer, onDragStateChange }
  }

  function mockPointerEvent(clientX = 450, clientY = 300, pointerId = 1): any {
    const fakeOwnerSvg = {
      parentElement: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 600 })
      }
    }
    return {
      pointerId,
      clientX,
      clientY,
      button: 0,
      currentTarget: { ownerSVGElement: fakeOwnerSvg }
    }
  }

  it('notifies drag state change on start and finish', () => {
    const { context, onDragStateChange } = createTestContext()
    const startEvent = mockPointerEvent()
    startLayerAssemblyGizmoDrag(startEvent, context, { kind: 'translate', axis: 0, edgeOn: false })

    expect(onDragStateChange).toHaveBeenCalledWith(true)

    fire({ type: 'pointerup', pointerId: 1 })
    expect(onDragStateChange).toHaveBeenCalledWith(false)
  })

  it('translates X axis horizontally on pointer move', () => {
    const { context, onUpdateLayer } = createTestContext({ x: 100 })
    const startEvent = mockPointerEvent(450, 300)
    startLayerAssemblyGizmoDrag(startEvent, context, { kind: 'translate', axis: 0, edgeOn: false })

    fire({ type: 'pointermove', pointerId: 1, clientX: 480, clientY: 300 })
    expect(onUpdateLayer).toHaveBeenCalled()
    const lastPatch = onUpdateLayer.mock.calls.at(-1)?.[1]
    expect(lastPatch).toHaveProperty('x')
    expect(typeof lastPatch.x).toBe('number')
  })

  it('rotates layer around Z axis', () => {
    const { context, onUpdateLayer } = createTestContext({ rotation: 0 })
    const startEvent = mockPointerEvent(450, 200)
    startLayerAssemblyGizmoDrag(startEvent, context, { kind: 'rotate', axis: 2 })

    fire({ type: 'pointermove', pointerId: 1, clientX: 550, clientY: 300 })
    expect(onUpdateLayer).toHaveBeenCalled()
    const lastPatch = onUpdateLayer.mock.calls.at(-1)?.[1]
    expect(lastPatch).toHaveProperty('rotation')
  })

  it('scales layer via bounding box handles', () => {
    const { context, onUpdateLayer } = createTestContext({ scale: 1.0 })
    const startEvent = mockPointerEvent(450, 250)
    startLayerAssemblyGizmoDrag(startEvent, context, { kind: 'scale', handle: [1, 1] })

    fire({ type: 'pointermove', pointerId: 1, clientX: 500, clientY: 200 })
    expect(onUpdateLayer).toHaveBeenCalled()
    const lastPatch = onUpdateLayer.mock.calls.at(-1)?.[1]
    expect(lastPatch).toHaveProperty('scale')
    expect(lastPatch.scale).toBeGreaterThan(0)
  })

  it('cancels drag and restores original values on Escape', () => {
    const { context, onUpdateLayer } = createTestContext({ x: 50, y: 100, z: 20, rotation: 10, scale: 1.2 })
    const startEvent = mockPointerEvent(450, 300)
    startLayerAssemblyGizmoDrag(startEvent, context, { kind: 'translate', axis: 0, edgeOn: false })

    fire({ type: 'pointermove', pointerId: 1, clientX: 600, clientY: 300 })
    fire({ type: 'keydown', key: 'Escape', preventDefault: vi.fn() })

    const lastCall = onUpdateLayer.mock.calls.at(-1)
    expect(lastCall?.[1]).toMatchObject({
      x: 50,
      y: 100,
      z: 20,
      rotation: 10,
      scale: 1.2
    })
  })
})
