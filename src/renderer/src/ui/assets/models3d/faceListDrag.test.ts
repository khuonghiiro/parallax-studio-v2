import { describe, it, expect, beforeEach } from 'vitest'
import {
  setAssemblyDraggedAsset,
  getAssemblyDraggedAsset,
  subscribeAssemblyDraggedAsset
} from './assemblyDragState'
import type { Face3D } from './types'

describe('assemblyDragState', () => {
  beforeEach(() => {
    setAssemblyDraggedAsset(null)
  })

  it('stores and retrieves active dragged asset', () => {
    expect(getAssemblyDraggedAsset()).toBeNull()

    setAssemblyDraggedAsset({
      assetPath: 'assets/nature/grass.png',
      name: 'Bụi cỏ'
    })

    expect(getAssemblyDraggedAsset()).toEqual({
      assetPath: 'assets/nature/grass.png',
      name: 'Bụi cỏ'
    })

    setAssemblyDraggedAsset(null)
    expect(getAssemblyDraggedAsset()).toBeNull()
  })

  it('notifies subscribers on asset change', () => {
    const events: unknown[] = []
    const unsub = subscribeAssemblyDraggedAsset((asset) => {
      events.push(asset)
    })

    setAssemblyDraggedAsset({
      assetPath: 'assets/nature/flower.png',
      name: 'Bông hoa'
    })
    setAssemblyDraggedAsset(null)

    expect(events.length).toBe(2)
    expect(events[0]).toEqual({
      assetPath: 'assets/nature/flower.png',
      name: 'Bông hoa'
    })
    expect(events[1]).toBeNull()

    unsub()
    setAssemblyDraggedAsset({ assetPath: 'other.png', name: 'Other' })
    expect(events.length).toBe(2)
  })
})

describe('Face texture assignment logic', () => {
  const sampleFaces: Face3D[] = [
    { id: 'f-1', name: 'Cỏ 1', width: 240, height: 240, position: [0, 0, 0], rotation: [0, 0, 0] },
    { id: 'f-2', name: 'Cỏ 2', width: 240, height: 240, position: [0, 0, 0], rotation: [0, 0, 0] },
    { id: 'f-3', name: 'Cỏ 3', width: 240, height: 240, position: [0, 0, 0], rotation: [0, 0, 0] }
  ]

  it('assigns texture to a single face', () => {
    const texturePath = 'assets/nature/grass.png'
    const updated = sampleFaces.map((f) => (f.id === 'f-2' ? { ...f, assetPath: texturePath } : f))

    expect(updated[0].assetPath).toBeUndefined()
    expect(updated[1].assetPath).toBe(texturePath)
    expect(updated[2].assetPath).toBeUndefined()
  })

  it('assigns texture to all faces in one batch (Shift "nhận 1 thể")', () => {
    const texturePath = 'assets/nature/grass.png'
    const updated = sampleFaces.map((f) => ({ ...f, assetPath: texturePath }))

    expect(updated.every((f) => f.assetPath === texturePath)).toBe(true)
    expect(updated.length).toBe(3)
  })
})
