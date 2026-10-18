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
  showMesh?: boolean
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
  requestRender,
  showMesh = false
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

  // Kiểm tra xem tất cả các layer có đang ở Z = 0 không (chỉ phân tách so le khi zExaggeration > 0)
  const allZeroZ = zExaggeration > 0 && layers.length > 1 && layers.every((l) => Math.abs(l.z || 0) < 0.001)

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

    // Nếu tất cả layer có Z = 0 và zExaggeration > 0, tự động phân tách tầng thị giác so le
    const visualLayer = allZeroZ
      ? {
          ...layer,
          z: Math.round((idx - (layers.length - 1) / 2) * -50)
        }
      : layer

    // Thiết lập renderOrder:
    // - Khi nhìn chính diện phẳng 2D (zExaggeration <= 0): tất cả layer đều ở Z=0,
    //   dùng painter order cố định theo layer.z và layerIndex để vẽ đúng thứ tự xếp chồng 2D.
    // - Khi ở không gian 3D (zExaggeration > 0): layer đã có tọa độ Z thực tế,
    //   BẮT BUỘC đặt renderOrder = 0 để Three.js tự sắp xếp theo khoảng cách thực tế tới camera
    //   kết hợp Z-buffer hardware (depthTest/depthWrite). Nhờ vậy khi người dùng xoay camera ra phía sau,
    //   layer phía sau (nằm gần camera hơn) sẽ che khuất layer phía trước đúng vật lý 3D,
    //   chỉ để lộ các phần layer không bị che khuất, triệt tiêu hoàn toàn hiện tượng "lật chính diện ngược lại"!
    const isFlatFrontView = zExaggeration <= 0
    inst.mesh.renderOrder = isFlatFrontView ? Math.round(1000 - visualLayer.z) * 100 + idx : 0
    if (inst.wireframeMesh) {
      inst.wireframeMesh.renderOrder = 190000 + idx
    }
    inst.outline.renderOrder = 200000 + idx
    inst.anchorDot.renderOrder = 200100 + idx

    updateLayer3DInstance(
      inst,
      visualLayer,
      time,
      zExaggeration,
      selectedIds ? selectedIds.includes(layer.id) : layer.id === selectedLayerId,
      idx,
      cameraClippingPlanes,
      showMesh
    )
  })
}
