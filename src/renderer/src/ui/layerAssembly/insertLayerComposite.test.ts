import { describe, expect, it, beforeEach } from 'vitest'
import { insertLayerCompositeToScene, COMPOSITE_Z_FACTOR } from './insertLayerComposite'
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
    expect(layer1.transform.position.value).toEqual([100, 200 - 50 * 1.5, 50 - 20 * COMPOSITE_Z_FACTOR * 1.5])
    expect(layer1.transform.scale.value).toEqual([1.5, 1.5, 1])
    expect((layer1.props as { width?: number }).width).toBe(400)
    expect((layer1.props as { height?: number }).height).toBe(600)

    // Kiểm tra thông tin cụm composite được gán chuẩn xác
    expect(layer1.composite).toBeDefined()
    expect(layer1.composite?.compositeId).toBe('comp-tree-test')
    expect(layer1.composite?.compositeName).toBe('Cây Test')
    expect(layer1.composite?.isRoot).toBe(true)
    expect(layer1.composite?.lockedGroup).toBe(true)

    const layer2 = project.layers[1]
    expect(layer2.composite).toBeDefined()
    expect(layer2.composite?.instanceId).toBe(layer1.composite?.instanceId)
    expect(layer2.composite?.isRoot).toBe(false)
    expect(layer2.composite?.lockedGroup).toBe(true)
  })

  it('does not double-bake X/Y/rotation on soft-skinned layers while still baking zOrder and rigid layers', async () => {
    const comp: LayerComposite = {
      id: 'comp-rig-test',
      name: 'Nhân Vật Test',
      category: 'character',
      width: 600,
      height: 800,
      rig: {
        bones: [
          { id: 'bone-root', name: 'Root', x: 0, y: 0, length: 80, angle: -90 },
          { id: 'bone-shin', name: 'Shin', parentId: 'bone-root', x: 0, y: 120, length: 90, angle: 90 },
          { id: 'bone-glasses', name: 'Glasses', parentId: 'bone-root', x: 0, y: -150, length: 40, angle: 0 }
        ],
        duration: 2,
        loop: true,
        tracks: {
          'bone-shin': [
            { time: 0, x: 0, y: 0, rotation: 0, zOrder: 10, easing: 'linear' },
            { time: 1, x: 25, y: -40, rotation: -30, zOrder: -10, easing: 'linear' },
            { time: 2, x: 0, y: 0, rotation: 0, zOrder: 10, easing: 'linear' }
          ],
          'bone-glasses': [
            { time: 0, x: 0, y: 0, rotation: 0, easing: 'linear' },
            { time: 1, x: 10, y: -12, rotation: 15, easing: 'linear' },
            { time: 2, x: 0, y: 0, rotation: 0, easing: 'linear' }
          ]
        }
      },
      layers: [
        {
          id: 'shin',
          name: 'Cẳng chân',
          assetPath: 'nature/tree-trunk.png',
          x: 20,
          y: 150,
          z: -10,
          scale: 1,
          rotation: 0,
          opacity: 1,
          boneId: 'bone-shin',
          bindingMode: 'soft',
          motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
        },
        {
          id: 'glasses',
          name: 'Mắt kính',
          assetPath: 'nature/tree-trunk.png',
          x: 0,
          y: -150,
          z: 40,
          scale: 1,
          rotation: 0,
          opacity: 1,
          boneId: 'bone-glasses',
          bindingMode: 'rigid',
          motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
        }
      ]
    }

    const shotId = useEditor.getState().project.shots[0].id
    await insertLayerCompositeToScene({
      composite: comp,
      targetShotId: shotId,
      positionOffset: [0, 0, 0],
      globalScale: 1
    })

    const project = useEditor.getState().project
    const shinLayer = project.layers.find((l) => l.composite?.sourceLayerId === 'shin')!
    const glassesLayer = project.layers.find((l) => l.composite?.sourceLayerId === 'glasses')!

    // Soft-skinned layer has mesh.skin attached, keeps static X/Y and 0 rotation, and only animates Z depth (zOrder)
    expect(shinLayer.mesh?.skin?.binding.boneId).toBe('bone-shin')
    expect(shinLayer.transform.rotation.keyframes.length).toBe(0)
    expect(shinLayer.transform.position.keyframes.length).toBeGreaterThan(0)
    for (const kf of shinLayer.transform.position.keyframes) {
      expect(kf.value[0]).toBeCloseTo(20, 2)
      expect(kf.value[1]).toBeCloseTo(-150, 2)
    }

    // Rigid layer has no mesh.skin and bakes full X/Y position and rotation keyframes
    expect(glassesLayer.mesh?.skin).toBeUndefined()
    expect(glassesLayer.transform.rotation.keyframes.length).toBeGreaterThan(0)
    expect(glassesLayer.transform.position.keyframes.some((kf) => Math.abs(kf.value[0]) > 1)).toBe(true)
  })
})
