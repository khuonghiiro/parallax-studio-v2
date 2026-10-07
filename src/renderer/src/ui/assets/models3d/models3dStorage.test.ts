import { describe, expect, it, beforeEach } from 'vitest'
import {
  generatePresetFaces,
  getStoredModels3D,
  saveModel3D,
  deleteModel3D,
  duplicateModel3D
} from './models3dStorage'
import type { Model3D } from './types'

describe('3D Models Preset and Storage System', () => {
  let store: Record<string, string> = {}

  beforeEach(() => {
    store = {}
    const mockLocalStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        delete store[key]
      },
      clear: () => {
        store = {}
      }
    }
    // @ts-expect-error polyfill for vitest node environment
    globalThis.localStorage = mockLocalStorage
  })

  it('generates cottage preset with 7 faces including chimney sides and roof slopes', () => {
    const faces = generatePresetFaces('cottage', { w: 840, h: 400, d: 840 })
    expect(faces.length).toBe(7)

    const front = faces.find((f) => f.id === 'face-front')
    expect(front).toBeDefined()
    expect(front?.assetPath).toBe('assembly_3d/house/origami_front.png')

    const leftChimney = faces.find((f) => f.id === 'face-chimney-left')
    const rightChimney = faces.find((f) => f.id === 'face-chimney-right')
    expect(leftChimney).toBeDefined()
    expect(rightChimney).toBeDefined()
    expect(leftChimney?.rotation[1]).toBe(90)
    expect(rightChimney?.rotation[1]).toBe(-90)
  })

  it('generates cube preset with 6 faces forming a closed volume', () => {
    const faces = generatePresetFaces('cube', { w: 500, h: 500, d: 500 })
    expect(faces.length).toBe(6)
    const faceIds = faces.map((f) => f.id)
    expect(faceIds).toEqual(['cube-front', 'cube-left', 'cube-right', 'cube-back', 'cube-top', 'cube-bottom'])
  })

  it('generates corner preset with 3 faces including ground', () => {
    const faces = generatePresetFaces('corner', { w: 600, h: 400, d: 600 })
    expect(faces.length).toBe(3)
    expect(faces[0].rotation[1]).toBe(0)
    expect(faces[1].rotation[1]).toBe(90)
    expect(faces[2].rotation[0]).toBe(-90)
  })

  it('generates room preset with 4 interior faces', () => {
    const faces = generatePresetFaces('room', { w: 800, h: 500, d: 800 })
    expect(faces.length).toBe(4)
  })

  it('loads default seed models when storage is empty', () => {
    const models = getStoredModels3D()
    expect(models.length).toBeGreaterThanOrEqual(4)
    expect(models.some((m) => m.id === 'model-tudor-cottage')).toBe(true)
    expect(models.some((m) => m.id === 'model-cubic-box')).toBe(true)
  })

  it('saves, duplicates, and deletes a custom 3D model correctly', () => {
    const customModel: Model3D = {
      id: 'custom-model-test-1',
      name: 'Custom Test Model',
      description: 'A test 3D model',
      category: 'props',
      scale: 1.5,
      faces: generatePresetFaces('cube'),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    saveModel3D(customModel)
    const listAfterSave = getStoredModels3D()
    expect(listAfterSave.some((m) => m.id === 'custom-model-test-1')).toBe(true)

    const cloned = duplicateModel3D('custom-model-test-1')
    expect(cloned).toBeDefined()
    expect(cloned?.name).toContain('(Bản sao)')

    deleteModel3D('custom-model-test-1')
    const listAfterDelete = getStoredModels3D()
    expect(listAfterDelete.some((m) => m.id === 'custom-model-test-1')).toBe(false)
    expect(listAfterDelete.some((m) => m.id === cloned?.id)).toBe(true)
  })
})
