import * as THREE from 'three'
import type { AssembledLayerItem } from './types'
import {
  createLayer3DInstance,
  updateLayer3DInstance,
  updateLayerInstanceTexture,
  type Layer3DMeshInstance
} from './layerAssembly3DMesh'
import { getLayerFullResUrl } from './useLayerAssetImage'
import { resolveFaceTexture } from '../assets/models3d/textureResolver'

export interface SyncLayersGroupOptions {
  layers: AssembledLayerItem[]
  layersGroup: THREE.Group
  meshInstances: Map<string, Layer3DMeshInstance>
  selectedLayerId: string | null
  selectedIds?: string[]
  time: number
  zExaggeration: number
  cameraClippingPlanes: THREE.Plane[]
  requestRender: () => void
}

/**
 * Đồng bộ hóa Three.js mesh instances của các layer trong LayersGroup
 */
export function syncLayersGroupMeshes({
  layers,
  layersGroup,
  meshInstances,
  selectedLayerId,
  selectedIds,
  time,
  zExaggeration,
  cameraClippingPlanes,
  requestRender
}: SyncLayersGroupOptions) {
  const activeLayerIds = new Set(layers.map((l) => l.id))

  // Xóa mesh của các layer không còn tồn tại
  for (const [id, inst] of meshInstances.entries()) {
    if (!activeLayerIds.has(id)) {
      layersGroup.remove(inst.group)
      inst.mesh.geometry.dispose()
      inst.outline.geometry.dispose()
      inst.anchorDot.geometry.dispose()
      meshInstances.delete(id)
    }
  }

  // Kiểm tra xem tất cả các layer có đang ở Z = 0 không
  const allZeroZ = layers.length > 1 && layers.every((l) => Math.abs(l.z || 0) < 0.001)

  // Tạo hoặc cập nhật mesh cho từng layer với ảnh full-resolution sắc nét
  layers.forEach((layer, idx) => {
    let inst = meshInstances.get(layer.id)
    const fullResUrl = getLayerFullResUrl(layer.assetPath, layer.imageUrl)

    if (!inst) {
      inst = createLayer3DInstance(layer, fullResUrl, requestRender)
      meshInstances.set(layer.id, inst)
      layersGroup.add(inst.group)
    } else if (fullResUrl && inst.currentTextureUrl !== fullResUrl) {
      updateLayerInstanceTexture(inst, fullResUrl, requestRender)
    }

    if (!fullResUrl && layer.assetPath) {
      resolveFaceTexture(layer.assetPath).then((res) => {
        if (res?.url && inst) {
          updateLayerInstanceTexture(inst, res.url, requestRender)
        }
      })
    }

    // Nếu tất cả layer có Z = 0, tự động phân tách tầng thị giác so le
    const visualLayer = allZeroZ
      ? {
          ...layer,
          z: Math.round((idx - (layers.length - 1) / 2) * -50)
        }
      : layer

    // Thiết lập renderOrder để Three.js vẽ đúng thứ tự
    inst.mesh.renderOrder = idx

    updateLayer3DInstance(
      inst,
      visualLayer,
      time,
      zExaggeration,
      selectedIds ? selectedIds.includes(layer.id) : layer.id === selectedLayerId,
      idx,
      cameraClippingPlanes
    )
  })
}
