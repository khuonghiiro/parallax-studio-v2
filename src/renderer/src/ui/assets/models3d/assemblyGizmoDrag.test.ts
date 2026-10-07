import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import type { Face3D } from './types'
import { startAssemblyGizmoDrag, type AssemblyDragContext } from './assemblyGizmoDrag'

describe('assemblyGizmoDrag', () => {
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

  function createTestContext(faceOverrides: Partial<Face3D> = {}): {
    context: AssemblyDragContext
    onUpdateFace: ReturnType<typeof vi.fn>
    onDragStateChange: ReturnType<typeof vi.fn>
  } {
    const face: Face3D = {
      id: 'face-test-1',
      name: 'Mặt trước',
      width: 400,
      height: 300,
      position: [100, 50, -20],
      rotation: [0, 0, 0],
      ...faceOverrides
    }

    const camera = new THREE.PerspectiveCamera(40, 1.5, 10, 10000)
    camera.position.set(0, 0, 1500)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()

    const rect = { x: 0, y: 0, w: 900, h: 600 }
    const worldMatrix = new THREE.Matrix4()
    worldMatrix.setPosition(face.position[0], face.position[1], -face.position[2])

    const onUpdateFace = vi.fn()
    const onDragStateChange = vi.fn()

    const context: AssemblyDragContext = {
      face,
      modelScale: 1.0,
      camera,
      rect,
      worldMatrix,
      onUpdateFace,
      onDragStateChange
    }

    return { context, onUpdateFace, onDragStateChange }
  }

  function mockPointerEvent(clientX: number, clientY: number): React.PointerEvent {
    const mockTarget = {
      ownerSVGElement: {
        parentElement: {
          getBoundingClientRect: () => ({
            left: 0,
            top: 0,
            right: 900,
            bottom: 600,
            width: 900,
            height: 600,
            x: 0,
            y: 0
          })
        }
      }
    }

    return {
      clientX,
      clientY,
      button: 0,
      pointerId: 1,
      currentTarget: mockTarget,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    } as unknown as React.PointerEvent
  }

  it('notifies drag state change and updates translation along X axis', () => {
    const { context, onUpdateFace, onDragStateChange } = createTestContext()
    const startEvent = mockPointerEvent(450, 300)

    startAssemblyGizmoDrag(startEvent, context, { kind: 'translate', axis: 0, edgeOn: false })
    expect(onDragStateChange).toHaveBeenCalledWith(true)

    // Simulate pointer move 50px right
    window.dispatchEvent({ type: 'pointermove', clientX: 500, clientY: 300, pointerId: 1, shiftKey: false })

    expect(onUpdateFace).toHaveBeenCalled()
    const lastCall = onUpdateFace.mock.calls[onUpdateFace.mock.calls.length - 1]
    expect(lastCall[0]).toBe('face-test-1')
    expect(lastCall[1].position).toBeDefined()
    expect(lastCall[1].position[0]).toBeGreaterThan(context.face.position[0])

    // Pointer up finishes drag
    window.dispatchEvent({ type: 'pointerup', pointerId: 1 })
    expect(onDragStateChange).toHaveBeenCalledWith(false)
  })

  it('cancels drag and reverts face transform on Escape key', () => {
    const { context, onUpdateFace, onDragStateChange } = createTestContext()
    const startEvent = mockPointerEvent(450, 300)

    startAssemblyGizmoDrag(startEvent, context, { kind: 'translate', axis: 1, edgeOn: false })

    // Move
    window.dispatchEvent({ type: 'pointermove', clientX: 450, clientY: 250, pointerId: 1, shiftKey: false })
    expect(onUpdateFace).toHaveBeenCalled()

    // Press Escape
    window.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault: vi.fn() })

    expect(onDragStateChange).toHaveBeenCalledWith(false)
    const finalCall = onUpdateFace.mock.calls[onUpdateFace.mock.calls.length - 1]
    expect(finalCall[1]).toEqual({
      position: [100, 50, -20],
      rotation: [0, 0, 0],
      width: 400,
      height: 300
    })
  })

  it('resizes width and height on scale handle drag', () => {
    const { context, onUpdateFace } = createTestContext()
    const startEvent = mockPointerEvent(450, 300)

    startAssemblyGizmoDrag(startEvent, context, { kind: 'scale', handle: [1, 1] })

    // Move outward diagonally
    window.dispatchEvent({ type: 'pointermove', clientX: 550, clientY: 200, pointerId: 1, shiftKey: false })
    expect(onUpdateFace).toHaveBeenCalled()
    const lastCall = onUpdateFace.mock.calls[onUpdateFace.mock.calls.length - 1]
    expect(lastCall[1].width).toBeDefined()
    expect(lastCall[1].height).toBeDefined()

    window.dispatchEvent({ type: 'pointerup', pointerId: 1 })
  })

  it('rotates face when dragging rotation ring', () => {
    const { context, onUpdateFace } = createTestContext()
    const startEvent = mockPointerEvent(450, 300)

    startAssemblyGizmoDrag(startEvent, context, { kind: 'rotate', axis: 1 })

    // Move horizontally
    window.dispatchEvent({ type: 'pointermove', clientX: 480, clientY: 300, pointerId: 1, shiftKey: false })
    expect(onUpdateFace).toHaveBeenCalled()
    const lastCall = onUpdateFace.mock.calls[onUpdateFace.mock.calls.length - 1]
    expect(lastCall[1].rotation).toBeDefined()

    window.dispatchEvent({ type: 'pointerup', pointerId: 1 })
  })
})
