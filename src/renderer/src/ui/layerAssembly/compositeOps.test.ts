import { describe, expect, it, beforeEach } from 'vitest'
import {
  setCompositeGroupLock,
  setCompositeRootLayer,
  batchApplyCompositeMotion,
  batchClearCompositeMotion,
  batchKeyframeCompositeTransform,
  replaceCompositeSublayerAsset
} from './compositeOps'
import { useEditor } from '../../store/editor'
import { createProject, createImageLayer } from '../../project/factory'
import type { AssetMeta, ImageLayer } from '@shared/types'

describe('Composite Operations (compositeOps)', () => {
  const instanceId = 'comp-test-inst-1'
  let dummyAsset: AssetMeta

  beforeEach(() => {
    const proj = createProject({ width: 1920, height: 1080 })
    dummyAsset = {
      id: 'asset-leaf',
      name: 'leaf.png',
      kind: 'image',
      mime: 'image/png',
      width: 200,
      height: 200
    }
    proj.assets = [dummyAsset]

    const l1 = createImageLayer(dummyAsset, proj.comp, 0)
    l1.id = 'layer-root'
    l1.name = '[Cụm Cây] Thân'
    l1.composite = {
      instanceId,
      compositeId: 'comp-1',
      compositeName: 'Cụm Cây',
      isRoot: true,
      lockedGroup: true
    }

    const l2 = createImageLayer(dummyAsset, proj.comp, -20)
    l2.id = 'layer-child'
    l2.name = '[Cụm Cây] Tán lá'
    l2.composite = {
      instanceId,
      compositeId: 'comp-1',
      compositeName: 'Cụm Cây',
      isRoot: false,
      lockedGroup: true
    }

    proj.layers = [l1, l2]
    useEditor.setState({ project: proj, time: 1.0 })
  })

  it('toggles lockedGroup for all layers in composite', () => {
    // Mở khóa
    setCompositeGroupLock(instanceId, false)
    let layers = useEditor.getState().project.layers
    expect(layers[0].composite?.lockedGroup).toBe(false)
    expect(layers[1].composite?.lockedGroup).toBe(false)

    // Khóa lại
    setCompositeGroupLock(instanceId, true)
    layers = useEditor.getState().project.layers
    expect(layers[0].composite?.lockedGroup).toBe(true)
    expect(layers[1].composite?.lockedGroup).toBe(true)
  })

  it('changes the root layer of composite', () => {
    setCompositeRootLayer(instanceId, 'layer-child')
    const layers = useEditor.getState().project.layers
    expect(layers[0].composite?.isRoot).toBe(false)
    expect(layers[1].composite?.isRoot).toBe(true)
  })

  it('applies batch motion with staggered phase', () => {
    batchApplyCompositeMotion(
      instanceId,
      { type: 'sway', speed: 1.5, amplitude: [20, 20, 0], phase: 0 },
      true
    )

    const layers = useEditor.getState().project.layers
    expect(layers[0].motion?.type).toBe('sway')
    expect(layers[0].motion?.speed).toBe(1.5)
    expect(layers[0].motion?.phase).toBe(0)

    expect(layers[1].motion?.type).toBe('sway')
    expect(layers[1].motion?.speed).toBe(1.5)
    expect(layers[1].motion?.phase).toBe(0.35) // Staggered by 0.35
  })

  it('clears batch motion for all layers in composite', () => {
    batchApplyCompositeMotion(instanceId, { type: 'pulse', speed: 2 })
    expect(useEditor.getState().project.layers[0].motion).toBeDefined()

    batchClearCompositeMotion(instanceId)
    const layers = useEditor.getState().project.layers
    expect(layers[0].motion).toBeUndefined()
    expect(layers[1].motion).toBeUndefined()
  })

  it('creates keyframes for all layers at current time', () => {
    batchKeyframeCompositeTransform(instanceId)
    const layers = useEditor.getState().project.layers
    expect(layers[0].transform.position.keyframes.length).toBeGreaterThanOrEqual(1)
    expect(layers[0].transform.position.keyframes[0].t).toBe(1.0)
    expect(layers[1].transform.position.keyframes.length).toBeGreaterThanOrEqual(1)
    expect(layers[1].transform.position.keyframes[0].t).toBe(1.0)
  })

  it('replaces asset of a specific sublayer', () => {
    const newAsset: AssetMeta = {
      id: 'asset-flower',
      name: 'flower.png',
      kind: 'image',
      mime: 'image/png',
      width: 300,
      height: 300
    }

    replaceCompositeSublayerAsset('layer-child', newAsset)
    const layers = useEditor.getState().project.layers
    const child = layers.find((l) => l.id === 'layer-child') as ImageLayer
    expect(child.props.assetId).toBe('asset-flower')
    expect(child.name).toBe('[Cụm Cây] flower.png')
  })
})
