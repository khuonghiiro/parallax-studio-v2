import { describe, expect, it } from 'vitest'
import type { AssetMeta } from '@shared/types'
import { createProject, createImageLayer } from './factory'
import { evaluateScene } from '../engine/evaluateScene'
import { autoScaleFactor, referenceDistance } from '../animation/math'

describe('Image Layer Creation and Sliced Layers Alignment', () => {
  it('creates image layers with exact 1:1 scale (scale = [1, 1, 1]) and autoScale = true', () => {
    const project = createProject({ width: 1920, height: 1080 })
    const fullAsset: AssetMeta = {
      id: 'bg_1',
      name: 'background.png',
      kind: 'image',
      mime: 'image/png',
      width: 1920,
      height: 1080
    }
    const layer = createImageLayer(fullAsset, project.comp, 0)
    expect(layer.transform.scale.value).toEqual([1, 1, 1])
    expect(layer.transform.position.value[2]).toBe(0)
    expect(layer.autoScale).toBe(true)
  })

  it('preserves 1:1 scale even for high-res (4K) or non-standard aspect ratio images without auto-cover shrinking', () => {
    const project = createProject({ width: 1920, height: 1080 })
    const highResAsset: AssetMeta = {
      id: 'high_res_1',
      name: 'master_4k.png',
      kind: 'image',
      mime: 'image/png',
      width: 3840,
      height: 2160
    }
    const layer = createImageLayer(highResAsset, project.comp, 0)
    // Scale must remain exactly 1, not shrunk down to 0.5 (comp.width / 3840)
    expect(layer.transform.scale.value).toEqual([1, 1, 1])
    expect(layer.props.width).toBe(3840)
    expect(layer.props.height).toBe(2160)
  })

  it('separates 5 sliced layers across depth distances while autoScale perfectly preserves screen alignment', () => {
    const project = createProject({ width: 1920, height: 1080 })
    const d = referenceDistance(project.comp)

    // Simulate 5 layers split from a single master image, placed at stepped depths
    const slices: { asset: AssetMeta; z: number }[] = [
      { asset: { id: 'slice_sky', name: 'sky.png', kind: 'image', mime: 'image/png', width: 1920, height: 1080 }, z: 0 },
      { asset: { id: 'slice_mountains', name: 'mountains.png', kind: 'image', mime: 'image/png', width: 1920, height: 600 }, z: -200 },
      { asset: { id: 'slice_char', name: 'character.png', kind: 'image', mime: 'image/png', width: 450, height: 800 }, z: -400 },
      { asset: { id: 'slice_tree', name: 'tree.png', kind: 'image', mime: 'image/png', width: 300, height: 950 }, z: -600 },
      { asset: { id: 'slice_fg', name: 'foreground_grass.png', kind: 'image', mime: 'image/png', width: 1920, height: 400 }, z: -800 }
    ]

    for (const item of slices) {
      const layer = createImageLayer(item.asset, project.comp, item.z)
      project.layers.push(layer)
    }

    expect(project.layers.length).toBe(5)

    // Verify distinct depth distances (not collapsed onto a single axis)
    const distinctDepths = new Set(project.layers.map((l) => l.transform.position.value[2]))
    expect(distinctDepths.size).toBe(5)

    // Evaluate in scene engine at t = 0
    const ev = evaluateScene(project, 0)
    for (let i = 0; i < slices.length; i++) {
      const { asset, z } = slices[i]
      const evaluated = ev.layers.find((l) => (l.layer.props as any).assetId === asset.id)!
      expect(evaluated).toBeDefined()
      expect(evaluated.worldPosition[2]).toBe(z)

      // autoScale multiplier applied by the engine
      const expectedK = autoScaleFactor(z, project.comp)
      expect(evaluated.scale[0]).toBeCloseTo(expectedK, 4)
      expect(evaluated.scale[1]).toBeCloseTo(expectedK, 4)

      // The perceived screen size (world mesh size projected through perspective camera):
      // distance from camera is (z + d), perspective scale factor is d / (z + d)
      // (nominal_size * k) * (d / (z + d)) = nominal_size * ((z + d) / d) * (d / (z + d)) = nominal_size!
      const distToCamera = z + d
      const projectedWidth = (evaluated.size[0] * evaluated.scale[0] * d) / distToCamera
      const projectedHeight = (evaluated.size[1] * evaluated.scale[1] * d) / distToCamera

      expect(projectedWidth).toBeCloseTo(asset.width!, 2)
      expect(projectedHeight).toBeCloseTo(asset.height!, 2)
    }
  })
})
