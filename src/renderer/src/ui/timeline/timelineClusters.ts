import type { AudioTrackItem, Layer } from '@shared/types'
import { isMouthLayer } from '../../project/lipSync'

export interface TimelineClusterGroup {
  kind: 'cluster'
  clusterType: 'composite' | 'model3d'
  instanceId: string
  name: string
  layers: Layer[]
  audioTracks: AudioTrackItem[]
  inPoint: number
  outPoint: number
  hasMouth: boolean
  rootLayerId?: string
}

export interface TimelineSingleLayerItem {
  kind: 'single'
  layer: Layer
  audioTracks?: AudioTrackItem[]
}

export type TimelineClusterItem = TimelineClusterGroup | TimelineSingleLayerItem

/**
 * Phân tích danh sách layer trong shot và gom các layer thuộc cùng một cụm
 * (Nhân vật xếp chồng từ xưởng Layer Assembly hoặc Mô hình 3D).
 * Đồng thời liên kết các track âm thanh thoại/SFX được gán cho nhân vật/3D/layer vào cụm/layer tương ứng.
 */
export function buildTimelineClusters(
  layers: Layer[],
  audioTracks?: AudioTrackItem[]
): TimelineClusterItem[] {
  const result: TimelineClusterItem[] = []
  const clusterMap = new Map<string, TimelineClusterGroup>()

  for (const layer of layers) {
    const compositeInst = layer.composite?.instanceId
    const model3dInst = layer.model3d?.instanceId
    const instId = compositeInst || model3dInst

    if (instId) {
      let group = clusterMap.get(instId)
      if (!group) {
        const clusterType: 'composite' | 'model3d' = compositeInst ? 'composite' : 'model3d'
        const clusterName = layer.composite?.compositeName || layer.model3d?.modelName || 'Cụm layer'
        group = {
          kind: 'cluster',
          clusterType,
          instanceId: instId,
          name: clusterName,
          layers: [],
          audioTracks: [],
          inPoint: layer.inPoint,
          outPoint: layer.outPoint,
          hasMouth: false,
          rootLayerId: layer.composite?.isRoot ? layer.id : undefined
        }
        clusterMap.set(instId, group)
        result.push(group)
      }

      group.layers.push(layer)
      group.inPoint = Math.min(group.inPoint, layer.inPoint)
      group.outPoint = Math.max(group.outPoint, layer.outPoint)
      if (isMouthLayer(layer)) {
        group.hasMouth = true
      }
      if (layer.composite?.isRoot && !group.rootLayerId) {
        group.rootLayerId = layer.id
      }
    } else {
      // Layer độc lập
      result.push({
        kind: 'single',
        layer,
        audioTracks: []
      })
    }
  }

  // Gắn các audio track thuộc về cụm nhân vật, mô hình 3D, hoặc layer độc lập
  if (audioTracks && audioTracks.length > 0) {
    for (const item of result) {
      if (item.kind === 'cluster') {
        const charAudio = audioTracks.filter((tr) => {
          if (item.clusterType === 'composite' && tr.targetType === 'character' && tr.targetId === item.instanceId) {
            return true
          }
          if (item.clusterType === 'model3d' && tr.targetType === 'model3d' && tr.targetId === item.instanceId) {
            return true
          }
          // Gắn qua layer con trong cụm
          if (tr.targetType === 'layer' && item.layers.some((l) => l.id === tr.targetId)) {
            return true
          }
          return false
        })
        item.audioTracks = charAudio
      } else {
        const singleAudio = audioTracks.filter((tr) => {
          if (tr.targetType === 'layer' && tr.targetId === item.layer.id) {
            return true
          }
          if (
            tr.targetType === 'character' &&
            (item.layer.composite?.instanceId === tr.targetId || item.layer.id === tr.targetId)
          ) {
            return true
          }
          if (
            tr.targetType === 'model3d' &&
            (item.layer.model3d?.instanceId === tr.targetId || item.layer.id === tr.targetId)
          ) {
            return true
          }
          return false
        })
        item.audioTracks = singleAudio
      }
    }
  }

  return result
}

/**
 * Rút gọn tên layer con bên trong cụm nhân vật, lược bỏ tiền tố `[Tên Nhân Vật]`
 * để giao diện timeline trong sáng, không bị lặp chữ dài dòng.
 */
export function getCleanLayerSubName(layer: Layer, clusterName?: string): string {
  let name = layer.name || 'Layer'
  if (name.startsWith('[')) {
    const endBracket = name.indexOf(']')
    if (endBracket > 0) {
      name = name.slice(endBracket + 1).trim()
    }
  } else if (clusterName) {
    const prefix1 = `[${clusterName}]`
    const prefix2 = `${clusterName} - `
    if (name.startsWith(prefix1)) {
      name = name.slice(prefix1.length).trim()
    } else if (name.startsWith(prefix2)) {
      name = name.slice(prefix2.length).trim()
    }
  }
  return name || layer.name || 'Layer'
}
