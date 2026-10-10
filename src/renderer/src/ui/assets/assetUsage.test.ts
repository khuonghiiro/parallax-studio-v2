import { describe, it, expect } from 'vitest'
import { findAssetUsages } from './assetUsage'
import type { Project } from '@shared/types'
import type { LayerComposite } from '../layerAssembly/types'
import type { Model3D } from './models3d/types'

describe('assetUsage', () => {
  const dummyProject = {
    version: 2,
    comp: { name: 'Comp 1', width: 1920, height: 1080, fps: 30, duration: 8, background: '#000' },
    camera: {} as any,
    look: {} as any,
    shots: [
      { id: 'shot-1', name: 'Cảnh Rừng Xanh', color: '#ff0', visible: true, position: { value: [0, 0, 0], keyframes: [] }, rotation: { value: [0, 0, 0], keyframes: [] } },
      { id: 'shot-2', name: 'Cảnh Lâu Đài', color: '#0ff', visible: true, position: { value: [0, 0, 0], keyframes: [] }, rotation: { value: [0, 0, 0], keyframes: [] } }
    ],
    layers: [
      {
        id: 'layer-1',
        name: 'Dây leo cổ thụ',
        type: 'image',
        shotId: 'shot-1',
        props: { assetId: 'asset-vines' }
      } as any,
      {
        id: 'layer-2',
        name: 'Đom đóm bay',
        type: 'particles',
        shotId: 'shot-2',
        props: { textureAssetId: 'asset-firefly' }
      } as any
    ],
    assets: [
      { id: 'asset-vines', name: 'Dây leo', kind: 'image', mime: 'image/png', assetPath: 'demo_transparent/vines.png' },
      { id: 'asset-firefly', name: 'Đom đóm', kind: 'image', mime: 'image/gif', assetPath: 'demos/fireflies.gif' }
    ],
    audio: null
  } as unknown as Project

  const dummyComposites: LayerComposite[] = [
    {
      id: 'comp-1',
      name: 'Hiệp Sĩ Tí Hon',
      category: 'character',
      width: 400,
      height: 500,
      layers: [
        {
          id: 'l-head',
          name: 'Đầu hiệp sĩ',
          assetPath: 'assembly_3d/modular/knight_head.png'
        } as any,
        {
          id: 'l-sword',
          name: 'Thanh kiếm bạc',
          assetPath: 'demo_transparent/vines.png'
        } as any
      ]
    }
  ]

  const dummyModels = [
    {
      id: 'model-1',
      name: 'Ngôi Nhà Cổ Tích',
      category: 'architecture',
      scale: 1,
      createdAt: 0,
      updatedAt: 0,
      faces: [
        {
          id: 'face-1',
          name: 'Mái ngói',
          assetPath: 'assembly_3d/modular/roof.png'
        } as any,
        {
          id: 'face-2',
          name: 'Dây leo bò tường',
          assetPath: 'demo_transparent/vines.png'
        } as any
      ]
    }
  ] as unknown as Model3D[]

  it('detects usage across project shots, composites, and 3D models', () => {
    const report = findAssetUsages(
      { relativePath: 'demo_transparent/vines.png', id: 'asset-vines' },
      dummyProject,
      dummyComposites,
      dummyModels
    )

    expect(report.totalUsages).toBe(3)
    expect(report.shots).toHaveLength(1)
    expect(report.shots[0].shotName).toBe('Cảnh Rừng Xanh')
    expect(report.shots[0].layerName).toBe('Dây leo cổ thụ')

    expect(report.composites).toHaveLength(1)
    expect(report.composites[0].compositeName).toBe('Hiệp Sĩ Tí Hon')
    expect(report.composites[0].layerName).toBe('Thanh kiếm bạc')

    expect(report.models3D).toHaveLength(1)
    expect(report.models3D[0].modelName).toBe('Ngôi Nhà Cổ Tích')
    expect(report.models3D[0].faceName).toBe('Dây leo bò tường')
  })

  it('returns totalUsages === 0 for unused asset', () => {
    const report = findAssetUsages(
      { relativePath: 'unused/image_never_used.png', name: 'Ảnh không ai dùng' },
      dummyProject,
      dummyComposites,
      dummyModels
    )

    expect(report.totalUsages).toBe(0)
    expect(report.shots).toHaveLength(0)
    expect(report.composites).toHaveLength(0)
    expect(report.models3D).toHaveLength(0)
  })

  it('detects particles texture usage', () => {
    const report = findAssetUsages(
      { relativePath: 'demos/fireflies.gif', id: 'asset-firefly' },
      dummyProject,
      dummyComposites,
      dummyModels
    )

    expect(report.totalUsages).toBe(1)
    expect(report.shots[0].layerName).toBe('Đom đóm bay')
    expect(report.shots[0].shotName).toBe('Cảnh Lâu Đài')
  })
})
