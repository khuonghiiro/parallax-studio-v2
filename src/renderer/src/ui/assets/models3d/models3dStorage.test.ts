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
    expect(front?.assetPath).toBe('assembly_3d/modular/wall_front_tudor.png')
    expect(front?.position).toEqual([0, 0, 0])

    const leftWall = faces.find((f) => f.id === 'face-left')
    const rightWall = faces.find((f) => f.id === 'face-right')
    const leftRoof = faces.find((f) => f.id === 'face-roof-left')
    const rightRoof = faces.find((f) => f.id === 'face-roof-right')
    const leftChimney = faces.find((f) => f.id === 'face-chimney-left')
    const rightChimney = faces.find((f) => f.id === 'face-chimney-right')

    expect(leftWall).toBeDefined()
    expect(rightWall).toBeDefined()
    expect(leftRoof).toBeDefined()
    expect(rightRoof).toBeDefined()
    expect(leftChimney).toBeDefined()
    expect(rightChimney).toBeDefined()

    // Rotations
    expect(leftChimney?.rotation[1]).toBe(90)
    expect(rightChimney?.rotation[1]).toBe(-90)
    expect(leftRoof?.rotation[0]).toBe(-43.69)
    expect(rightRoof?.rotation[0]).toBe(-43.69)
    expect(leftWall?.position[0]).toBe(-420)
    expect(rightWall?.position[0]).toBe(420)

    // Side walls ground alignment: ground at -483, wall height 393 -> center at -286.5
    expect(leftWall?.position[1]).toBe(-286.5)
    expect(rightWall?.position[1]).toBe(-286.5)
  })

  it('auto-heals outdated cottage coordinates in getStoredModels3D', () => {
    // Simulate legacy localStorage with buggy cottage coords
    const legacyCottage: Model3D = {
      id: 'model-tudor-cottage',
      name: 'Ngôi Nhà Tudor 3D (Origami Cottage)',
      category: 'architecture',
      scale: 0.6,
      faces: [
        {
          id: 'face-front',
          name: 'Trước',
          width: 980,
          height: 966,
          position: [0, 140, 0], // legacy buggy Y
          rotation: [0, 0, 0]
        },
        {
          id: 'face-roof-left',
          name: 'Mái trái',
          width: 840,
          height: 608,
          position: [-210, 212, 420],
          rotation: [46.33, -90, 0] // legacy buggy rotation
        }
      ],
      createdAt: 1000,
      updatedAt: 1000
    }
    store['parallax_models_3d_v2'] = JSON.stringify([legacyCottage])

    const loaded = getStoredModels3D()
    const cottage = loaded.find((m) => m.id === 'model-tudor-cottage')
    expect(cottage).toBeDefined()
    expect(cottage?.faces.length).toBe(7)
    const healedFront = cottage?.faces.find((f) => f.id === 'face-front')
    const healedRoof = cottage?.faces.find((f) => f.id === 'face-roof-left')
    expect(healedFront?.position[1]).toBe(0)
    expect(healedRoof?.rotation[0]).toBe(-43.69)
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
