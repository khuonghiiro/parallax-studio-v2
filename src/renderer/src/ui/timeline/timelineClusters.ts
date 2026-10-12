import type { Layer } from '@shared/types'
import { isMouthLayer } from '../../project/lipSync'

export interface TimelineClusterGroup {
  kind: 'cluster'
  clusterType: 'composite' | 'model3d'
  instanceId: string
  name: string
  layers: Layer[]
  inPoint: number
  outPoint: number
  hasMouth: boolean
  rootLayerId?: string
}

export interface TimelineSingleLayerItem {
  kind: 'single'
  layer: Layer
}

export type TimelineClusterItem = TimelineClusterGroup | TimelineSingleLayerItem

/**
 * Phân tích danh sách layer trong shot và gom các layer thuộc cùng một cụm
 * (Nhân vật xếp chồng từ xưởng Layer Assembly hoặc Mô hình 3D).
 */
export function buildTimelineClusters(layers: Layer[]): TimelineClusterItem[] {
  const result: TimelineClusterItem[] = []
  const clusterMap = new Map<string, TimelineClusterGroup>()
  const clusterOrder: string[] = []

  // Đếm số lượng layer thuộc từng instance
  const instanceCounts = new Map<string, number>()
  for (const l of layers) {
    const instId = l.composite?.instanceId || l.model3d?.instanceId
    if (instId) {
      instanceCounts.set(instId, (instanceCounts.get(instId) || 0) + 1)
    }
  }

  for (const layer of layers) {
    const compositeInst = layer.composite?.instanceId
    const model3dInst = layer.model3d?.instanceId
    const instId = compositeInst || model3dInst

    // Chỉ gom thành cụm khi instanceId đó có từ 2 layer trở lên
    const count = instId ? instanceCounts.get(instId) || 0 : 0
    if (instId && count >= 2) {
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
          inPoint: layer.inPoint,
          outPoint: layer.outPoint,
          hasMouth: false,
          rootLayerId: layer.composite?.isRoot ? layer.id : undefined
        }
        clusterMap.set(instId, group)
        clusterOrder.push(instId)
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
      // Layer độc lập hoặc instance chỉ có 1 layer
      result.push({
        kind: 'single',
        layer
      })
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
  if (clusterName) {
    const prefix1 = `[${clusterName}]`
    const prefix2 = `${clusterName} - `
    if (name.startsWith(prefix1)) {
      name = name.slice(prefix1.length).trim()
    } else if (name.startsWith(prefix2)) {
      name = name.slice(prefix2.length).trim()
    }
  }
  return name
}
