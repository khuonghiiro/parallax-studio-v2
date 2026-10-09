import { describe, it, expect, beforeEach } from 'vitest'
import { createProject, createImageLayer, createSolidLayer } from '../../../project/factory'
import { useEditor } from '../../../store/editor'
import {
  translateModel3DInstance,
  rotateModel3DInstance,
  rescaleModel3DInstance
} from './insertModel3D'
import { deleteSelectedLayer, duplicateSelectedLayer } from '../../../actions'

describe('insertModel3D unified operations', () => {
  const instanceId = 'test-model-inst-1'

  beforeEach(() => {
    const project = createProject()
    const l1 = createImageLayer({ id: 'asset-1', name: 'front', kind: 'image', mime: 'image/png', width: 200, height: 200, dataUrl: '' }, project.comp, 0)
    l1.id = 'layer-front'
    l1.transform.position.value = [0, 0, 0]
    l1.transform.rotation.value = [0, 0, 0]
    l1.model3d = {
      instanceId,
      modelId: 'm1',
      modelName: 'House',
      faceId: 'f1',
      initialScale: 1,
      globalScale: 1,
      basePosition: [0, 0, 0],
      centerPosition: [0, 0, 0],
      baseSize: [200, 200]
    }

    const l2 = createSolidLayer(project.comp)
    l2.id = 'layer-roof'
    l2.transform.position.value = [0, 100, 50]
    l2.transform.rotation.value = [45, 0, 0]
    l2.model3d = {
      instanceId,
      modelId: 'm1',
      modelName: 'House',
      faceId: 'f2',
      initialScale: 1,
      globalScale: 1,
      basePosition: [0, 100, 50],
      centerPosition: [0, 0, 0],
      baseSize: [200, 100]
    }

    project.layers = [l1, l2]
    useEditor.setState({ project, selectedLayerId: 'layer-front' })
  })

  it('translates all faces of a model instance together', () => {
    translateModel3DInstance(instanceId, [50, -30, 20])
    const p = useEditor.getState().project
    const f1 = p.layers.find((l) => l.id === 'layer-front')!
    const f2 = p.layers.find((l) => l.id === 'layer-roof')!

    expect(f1.transform.position.value).toEqual([50, -30, 20])
    expect(f2.transform.position.value).toEqual([50, 70, 70])
    expect(f1.model3d?.centerPosition).toEqual([50, -30, 20])
    expect(f2.model3d?.centerPosition).toEqual([50, -30, 20])
  })

  it('rotates all faces of a model instance around its center', () => {
    rotateModel3DInstance(instanceId, 1, 90, [0, 0, 0])
    const p = useEditor.getState().project
    const f2 = p.layers.find((l) => l.id === 'layer-roof')!

    // [0, 100, 50] rotated 90 deg around Y:
    // nx = rx * cos(90) + rz * sin(90) = 50
    // ny = 100
    // nz = -rx * sin(90) + rz * cos(90) = 0
    expect(f2.transform.position.value[0]).toBeCloseTo(50, 1)
    expect(f2.transform.position.value[1]).toBeCloseTo(100, 1)
    expect(f2.transform.position.value[2]).toBeCloseTo(0, 1)
    expect(f2.transform.rotation.value[1]).toBe(90)
  })

  it('rescales all faces of a model instance around center', () => {
    rescaleModel3DInstance(instanceId, 2.0, [0, 0, 0])
    const p = useEditor.getState().project
    const f2 = p.layers.find((l) => l.id === 'layer-roof')!

    expect(f2.transform.position.value).toEqual([0, 200, 100])
    expect(f2.transform.scale.value).toEqual([2.0, 2.0, 2.0])
    if (f2.type === 'solid') {
      expect(f2.props.width).toBe(200)
      expect(f2.props.height).toBe(100)
    }
  })

  it('supports sequential rescale without reverting to default size', () => {
    // First rescale to 1.5x
    rescaleModel3DInstance(instanceId, 1.5, [0, 0, 0])
    let p = useEditor.getState().project
    let f2 = p.layers.find((l) => l.id === 'layer-roof')!
    expect(f2.transform.position.value).toEqual([0, 150, 75])
    expect(f2.transform.scale.value).toEqual([1.5, 1.5, 1.5])
    expect(f2.model3d?.globalScale).toBe(1.5)

    // Second rescale to 2.5x - smoothly updates from base without compounding or shrinking
    rescaleModel3DInstance(instanceId, 2.5, [0, 0, 0])
    p = useEditor.getState().project
    f2 = p.layers.find((l) => l.id === 'layer-roof')!
    expect(f2.transform.position.value).toEqual([0, 250, 125])
    expect(f2.transform.scale.value).toEqual([2.5, 2.5, 2.5])
    expect(f2.model3d?.globalScale).toBe(2.5)
    if (f2.type === 'solid') {
      expect(f2.props.width).toBe(200)
      expect(f2.props.height).toBe(100)
    }
  })

  it('deletes all faces of a model instance together when any face is deleted', () => {
    useEditor.getState().selectLayer('layer-roof')
    deleteSelectedLayer()
    const p = useEditor.getState().project
    expect(p.layers.filter((l) => l.model3d?.instanceId === instanceId)).toHaveLength(0)
  })

  it('duplicates all faces of a model instance together with a new instanceId', () => {
    useEditor.getState().selectLayer('layer-front')
    duplicateSelectedLayer()
    const p = useEditor.getState().project
    expect(p.layers).toHaveLength(4)
    const newLayers = p.layers.filter((l) => l.model3d?.instanceId !== instanceId)
    expect(newLayers).toHaveLength(2)
    const newInst = newLayers[0].model3d?.instanceId
    expect(newInst).toBeTruthy()
    expect(newLayers[1].model3d?.instanceId).toBe(newInst)
  })

  it('attaches deformable mesh definition to layers on insertModel3DToScene', async () => {
    const { insertModel3DToScene } = await import('./insertModel3D')
    const model = {
      id: 'm-flower-test',
      name: 'Flower',
      category: 'nature' as const,
      scale: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      faces: [
        {
          id: 'petal-1',
          name: 'Curved Petal',
          width: 80,
          height: 160,
          position: [0, 50, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          bendY: 35,
          bendX: 20,
          depthProfile: 'ridge' as const,
          depthIntensity: 15
        }
      ]
    }

    const createdIds = await insertModel3DToScene({ model })
    expect(createdIds).toHaveLength(1)
    const layer = useEditor.getState().project.layers.find((l) => l.id === createdIds[0])!
    expect(layer).toBeDefined()
    expect(layer.mesh).toBeDefined()
    expect(layer.mesh?.modifiers.some((m) => m.type === 'bend')).toBe(true)
    expect(layer.mesh?.modifiers.some((m) => m.type === 'depthProfile')).toBe(true)
    expect(layer.model3d?.mesh).toBeDefined()
  })
})
