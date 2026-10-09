import * as THREE from 'three'
import type { Layer3DMeshInstance } from './layerAssembly3DMesh'

export interface LayerMeshHit {
  layerId: string
  point: THREE.Vector3
  instance: Layer3DMeshInstance
}

/**
 * Tìm kiếm layer mesh bị click thông qua Raycaster
 */
export function findLayerMeshHit(
  raycaster: THREE.Raycaster,
  meshInstances: Map<string, Layer3DMeshInstance>
): LayerMeshHit | null {
  const meshToInst = new Map<THREE.Object3D, Layer3DMeshInstance>()
  const meshes: THREE.Mesh[] = []

  for (const inst of meshInstances.values()) {
    if (inst.group.visible) {
      meshes.push(inst.mesh)
      meshToInst.set(inst.mesh, inst)
    }
  }

  const intersects = raycaster.intersectObjects(meshes, false)
  if (intersects.length > 0) {
    const hit = intersects[0]
    const inst = meshToInst.get(hit.object)
    const layerId = hit.object.userData?.layerId || inst?.layerId
    if (layerId && inst) {
      return {
        layerId,
        point: hit.point.clone(),
        instance: inst
      }
    }
  }

  return null
}

/**
 * Tạo mặt phẳng di chuyển (Drag Plane) nằm ngay trên mặt phẳng của layer:
 * - Bình thường: Mặt phẳng đi qua điểm hit, pháp tuyến trùng với hướng mặt layer
 * - Nếu góc nhìn nghiêng sát cạnh (gần vuông góc góc nhìn): Chuyển sang mặt phẳng hướng thẳng camera
 */
export function createLayerDragPlane(
  instance: Layer3DMeshInstance,
  camera: THREE.PerspectiveCamera,
  hitPoint: THREE.Vector3
): THREE.Plane {
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(instance.group.quaternion).normalize()
  const viewDir = camera.getWorldDirection(new THREE.Vector3())

  // Đảm bảo pháp tuyến hướng về phía camera
  if (normal.dot(viewDir) > 0) {
    normal.negate()
  }

  // Nếu góc nhìn gần như tiếp tuyến với mặt phẳng (cos < 0.15) -> Dùng mặt phẳng trực giao camera
  if (Math.abs(normal.dot(viewDir)) < 0.15) {
    return new THREE.Plane().setFromNormalAndCoplanarPoint(viewDir.clone().negate(), hitPoint)
  }

  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, hitPoint)
}

/**
 * Tính toán độ dời (dx, dy) trên mặt phẳng layer từ vị trí chuột hiện tại
 */
export function computeLayerDragDisplacement(
  raycaster: THREE.Raycaster,
  dragPlane: THREE.Plane,
  startHitPoint: THREE.Vector3,
  instance: Layer3DMeshInstance
): { dx: number; dy: number } | null {
  const currentHit = new THREE.Vector3()
  if (!raycaster.ray.intersectPlane(dragPlane, currentHit)) {
    return null
  }

  const worldDelta = currentHit.clone().sub(startHitPoint)
  const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(instance.group.quaternion).normalize()
  const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(instance.group.quaternion).normalize()

  const dx = worldDelta.dot(localRight)
  const dy = worldDelta.dot(localUp)

  return { dx, dy }
}
