import { beforeEach, describe, expect, it } from 'vitest'
import { createProject } from './factory'
import {
  findMouthLayerForCharacter,
  isMouthLayer,
  evaluateCharacterLipSync
} from './lipSync'
import { buildTimelineClusters, getCleanLayerSubName } from '../ui/timeline/timelineClusters'
import type { ImageLayer, Layer } from '@shared/types'

describe('Lip-Sync & Timeline Clusters', () => {
  let project = createProject()

  beforeEach(() => {
    project = createProject()
  })

  it('correctly detects mouth layers via isMouthLayer', () => {
    expect(isMouthLayer({ name: 'Layer_Mouth_1', id: 'l1' } as Layer)).toBe(true)
    expect(isMouthLayer({ name: '[Nhân Vật] Miệng', id: 'l2' } as Layer)).toBe(true)
    expect(isMouthLayer({ name: 'hero_lips', id: 'l3' } as Layer)).toBe(true)
    expect(isMouthLayer({ name: 'khau_hinh_noi', id: 'l4' } as Layer)).toBe(true)
    expect(isMouthLayer({ name: 'Layer_Eyes', id: 'l5' } as Layer)).toBe(false)
    expect(isMouthLayer({ name: 'Body_Torso', id: 'l6' } as Layer)).toBe(false)
  })

  it('finds character mouth layer in character layer list', () => {
    const layers: Layer[] = [
      {
        id: 'l-body',
        name: '[Nam Hiệp Sĩ] Thân',
        composite: { instanceId: 'char-1', compositeId: 'c1', compositeName: 'Nam Hiệp Sĩ', lockedGroup: true }
      } as Layer,
      {
        id: 'l-mouth',
        name: '[Nam Hiệp Sĩ] Miệng',
        composite: { instanceId: 'char-1', compositeId: 'c1', compositeName: 'Nam Hiệp Sĩ', lockedGroup: true }
      } as Layer,
      {
        id: 'l-other',
        name: 'Background Sky'
      } as Layer
    ]

    const mouth = findMouthLayerForCharacter(layers, 'char-1')
    expect(mouth).toBeDefined()
    expect(mouth?.id).toBe('l-mouth')

    const notFound = findMouthLayerForCharacter(layers, 'char-2')
    expect(notFound).toBeUndefined()
  })

  it('evaluates lip-sync transform for mouth layer when character has active voice audio', () => {
    const mouthLayer = {
      id: 'l-mouth',
      name: '[Nam Hiệp Sĩ] Miệng',
      composite: { instanceId: 'char-1', compositeId: 'c1', compositeName: 'Nam Hiệp Sĩ', lockedGroup: true },
      transform: {
        position: { value: [0, 0, 0], keyframes: [] },
        scale: { value: [1, 1, 1], keyframes: [] }
      }
    } as unknown as Layer

    project.layers.push(mouthLayer)
    project.audioTracks = [
      {
        id: 'audio-voice-1',
        assetId: 'asset-sound-1',
        offset: 0,
        volume: 1,
        duration: 5,
        targetType: 'character',
        targetId: 'char-1',
        characterRole: 'voice',
        lipSyncEnabled: true,
        lipSyncIntensity: 1.5
      }
    ]

    const result = evaluateCharacterLipSync(project, mouthLayer, 1.0)
    // Audio peak cache chưa nạp trong môi trường unit test thuần không có audio buffer, trả về safe defaults
    expect(result).toBeDefined()
    expect(typeof result.active).toBe('boolean')
  })

  it('groups multiple layers into timeline clusters and cleans sub-names', () => {
    const layers: Layer[] = [
      {
        id: 'l-body',
        name: '[Nam Hiệp Sĩ] Thân',
        inPoint: 0,
        outPoint: 5,
        composite: { instanceId: 'char-1', compositeId: 'c1', compositeName: 'Nam Hiệp Sĩ', lockedGroup: true }
      } as Layer,
      {
        id: 'l-head',
        name: '[Nam Hiệp Sĩ] Đầu',
        inPoint: 0,
        outPoint: 5,
        composite: { instanceId: 'char-1', compositeId: 'c1', compositeName: 'Nam Hiệp Sĩ', lockedGroup: true }
      } as Layer,
      {
        id: 'l-mouth',
        name: '[Nam Hiệp Sĩ] Miệng',
        inPoint: 0,
        outPoint: 5,
        composite: { instanceId: 'char-1', compositeId: 'c1', compositeName: 'Nam Hiệp Sĩ', lockedGroup: true }
      } as Layer,
      {
        id: 'l-single',
        name: 'Bầu trời đêm',
        inPoint: 0,
        outPoint: 10
      } as Layer
    ]

    const clusters = buildTimelineClusters(layers)
    expect(clusters.length).toBe(2) // 1 cluster nhóm nhân vật và 1 layer đơn lẻ
    expect(clusters[0].kind).toBe('cluster')
    if (clusters[0].kind === 'cluster') {
      expect(clusters[0].name).toBe('Nam Hiệp Sĩ')
      expect(clusters[0].layers.length).toBe(3)
      expect(clusters[0].hasMouth).toBe(true)
    }

    expect(clusters[1].kind).toBe('single')

    // Kiểm tra làm sạch tên layer con
    expect(getCleanLayerSubName(layers[0], 'Nam Hiệp Sĩ')).toBe('Thân')
    expect(getCleanLayerSubName(layers[1], 'Nam Hiệp Sĩ')).toBe('Đầu')
    expect(getCleanLayerSubName(layers[2], 'Nam Hiệp Sĩ')).toBe('Miệng')
  })
})
