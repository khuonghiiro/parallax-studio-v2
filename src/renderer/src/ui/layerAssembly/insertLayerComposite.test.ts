import { describe, expect, it, beforeEach } from 'vitest'
import { insertLayerCompositeToScene } from './insertLayerComposite'
import { useEditor } from '../../store/editor'
import { createProject, createShot } from '../../project/factory'
import type { LayerComposite } from './types'

describe('Insert Layer Composite To Scene', () => {
  beforeEach(() => {
    const proj = createProject({ width: 1920, height: 1080 })
    const shot = createShot('Cảnh 1')
    proj.shots = [shot]
    proj.assets = [
      {
        id: 'asset-tree',
        name: 'tree.png',
        path: 'nature/tree-trunk.png',
        kind: 'image',
        mime: 'image/png',
        width: 400,
        height: 600
      }
    ]
    useEditor.setState({
      selectedShotId: shot.id,
      project: proj
    })
  })

  it('inserts all unhidden layers of a composite into active shot', async () => {
    const comp: LayerComposite = {
      id: 'comp-tree-test',
      name: 'Cây Test',
      category: 'nature',
      width: 500,
      height: 700,
      layers: [
        {
          id: 'l1',
          name: 'Thân',
          assetPath: 'nature/tree-trunk.png',
          x: 0,
          y: 50,
          z: 20,
          scale: 1,
          rotation: 0,
          opacity: 1,
          motion: { type: 'sway', speed: 1, amplitude: 10, anchor: 'bottom' }
        },
        {
          id: 'l2',
          name: 'Tán lá ẩn',
          x: 0,
          y: -50,
          z: -10,
          scale: 1,
          rotation: 0,
          opacity: 1,
          hidden: true, // Should be skipped
          motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
        },
        {
          id: 'l3',
          name: 'Tán trước',
          x: 10,
          y: -20,
          z: -30,
          scale: 1.2,
          rotation: 5,
          opacity: 0.9,
          motion: { type: 'breathe', speed: 0.8, amplitude: 8, anchor: 'center' }
        }
      ]
    }

    const shotId = useEditor.getState().project.shots[0].id
    const insertedIds = await insertLayerCompositeToScene({
      composite: comp,
      targetShotId: shotId,
      positionOffset: [100, 200, 50],
      globalScale: 1.5
    })

    expect(insertedIds.length).toBe(2) // 2 unhidden layers

    const project = useEditor.getState().project
    expect(project.layers.length).toBe(2)

    const layer1 = project.layers[0]
    expect(layer1.name).toContain('[Cây Test] Thân')
    expect(layer1.motion?.type).toBe('sway')
    expect(layer1.motion?.speed).toBe(1)
    expect(layer1.motion?.amplitude).toEqual([10, 10, 0])
    expect(layer1.transform.position.value).toEqual([100, 200 - 50 * 1.5, 50 + 20 * 1.5])
  })
})
