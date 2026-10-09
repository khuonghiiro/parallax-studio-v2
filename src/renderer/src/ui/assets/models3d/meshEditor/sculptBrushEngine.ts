import * as THREE from 'three'
import type { Assembly3DActiveTool, BrushSettings } from './Assembly3DVerticalPalette'

export interface SculptStrokeSession {
  mesh: THREE.Mesh
  faceId: string
  tool: Assembly3DActiveTool
  settings: BrushSettings
  /** Vị trí các đỉnh khi bắt đầu nhấp chuột (local space) */
  initialPositions: Float32Array
  /** Độ lệch sculpt đã có từ trước (nếu trước đó đã vẽ cọ) */
  baseOffsets: Float32Array
  /** Điểm tiếp xúc ban đầu của đầu cọ trong world space */
  startHitWorld: THREE.Vector3
  /** Ma trận nghịch đảo của mesh world matrix được cache để không clone mỗi frame */
  invMat: THREE.Matrix4
  /** Tọa độ chuột ban đầu */
  startMouse: { x: number; y: number }
  /** Bán kính đầu cọ trong world space */
  worldRadius: number
  /** Danh sách các đỉnh nằm trong bán kính cọ */
  affectedIndices: number[]
  /** Trọng số suy giảm (falloff weights) [0..1] tương ứng từng đỉnh */
  falloffs: Float32Array
}

/**
 * Quy đổi bán kính cọ từ pixel màn hình sang đơn vị 3D world space
 * dựa trên góc nhìn camera (FOV) và khoảng cách từ camera đến điểm tiếp xúc.
 */
export function computeWorldBrushRadius(
  screenRadiusPx: number,
  hitPointWorld: THREE.Vector3,
  camera: THREE.Camera,
  viewportHeight: number
): number {
  const dist = camera.position.distanceTo(hitPointWorld)
  const fov = (camera as THREE.PerspectiveCamera).fov || 45
  const worldPerPx = (2 * Math.tan((fov * Math.PI) / 360) * dist) / (viewportHeight || 500)
  return Math.max(1, screenRadiusPx * worldPerPx)
}

/**
 * Tính hệ số suy giảm khoảng cách (Smooth Falloff chuẩn Blender / Cosine Curve).
 * Tại tâm cọ (d = 0) -> 1.0; tại viền cọ (d = radius) -> 0.0 mượt mà không ngấn gãy.
 */
function computeFalloffWeight(dist: number, radius: number): number {
  if (dist >= radius) return 0
  const t = dist / radius
  // Đường cong smooth cubic: (1 - t^2)^2
  const inner = 1 - t * t
  return inner * inner
}

/**
 * Khởi tạo một phiên vẽ cọ điêu khắc cục bộ khi người dùng nhấn chuột xuống mesh.
 */
export function startSculptStroke(
  mesh: THREE.Mesh,
  faceId: string,
  hitPointWorld: THREE.Vector3,
  clientX: number,
  clientY: number,
  camera: THREE.Camera,
  viewportHeight: number,
  tool: Assembly3DActiveTool,
  settings: BrushSettings,
  existingSculptOffsets?: number[]
): SculptStrokeSession | null {
  const geo = mesh.geometry
  const posAttr = geo?.getAttribute('position')
  if (!posAttr || posAttr.count === 0) return null

  const worldRadius = computeWorldBrushRadius(settings.radius, hitPointWorld, camera, viewportHeight)
  const count = posAttr.count
  const initialPositions = new Float32Array(posAttr.array)
  const baseOffsets = new Float32Array(count * 3)

  if (existingSculptOffsets && existingSculptOffsets.length > 0) {
    const len = Math.min(baseOffsets.length, existingSculptOffsets.length)
    for (let i = 0; i < len; i++) {
      baseOffsets[i] = existingSculptOffsets[i] || 0
    }
  }

  // Thu thập các đỉnh nằm trong bán kính cọ tại điểm tiếp xúc
  const affected: number[] = []
  const weights: number[] = []
  const tempV = new THREE.Vector3()

  for (let i = 0; i < count; i++) {
    tempV.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i))
    mesh.localToWorld(tempV)
    const dist = tempV.distanceTo(hitPointWorld)
    if (dist <= worldRadius) {
      const w = computeFalloffWeight(dist, worldRadius)
      if (w > 0.001) {
        affected.push(i)
        weights.push(w)
      }
    }
  }

  return {
    mesh,
    faceId,
    tool,
    settings,
    initialPositions,
    baseOffsets,
    startHitWorld: hitPointWorld.clone(),
    invMat: mesh.matrixWorld.clone().invert(),
    startMouse: { x: clientX, y: clientY },
    worldRadius,
    affectedIndices: affected,
    falloffs: new Float32Array(weights)
  }
}

/**
 * Cập nhật biến dạng trực tiếp trên Three.js BufferGeometry trong từng frame chuột di chuyển.
 * Thao tác thuần GPU/TypedArray, hoàn toàn không qua React re-render để đạt 60fps mượt mà.
 */
export function applySculptStrokeMove(
  session: SculptStrokeSession,
  currentMouse: { x: number; y: number },
  camera: THREE.Camera,
  viewportHeight: number
): void {
  const { mesh, tool, settings, initialPositions, startMouse, worldRadius, affectedIndices, falloffs, invMat } = session
  const posAttr = mesh.geometry?.getAttribute('position')
  if (!posAttr || affectedIndices.length === 0) return

  const totalDx = currentMouse.x - startMouse.x
  const totalDy = currentMouse.y - startMouse.y
  const factor = settings.strength

  if (tool === 'grab') {
    // 1. CỌ KÉO MỀM (GRAB BRUSH CỤC BỘ)
    // Tính vector dịch chuyển theo hướng camera
    const dist = camera.position.distanceTo(session.startHitWorld)
    const fov = (camera as THREE.PerspectiveCamera).fov || 45
    const worldPerPx = (2 * Math.tan((fov * Math.PI) / 360) * dist) / (viewportHeight || 500)

    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
    const deltaWorld = new THREE.Vector3()
      .addScaledVector(camRight, totalDx * worldPerPx)
      .addScaledVector(camUp, -totalDy * worldPerPx)

    // Chuyển delta sang local space của mesh dùng invMat đã cache
    const deltaLocal = deltaWorld.transformDirection(invMat)

    for (let k = 0; k < affectedIndices.length; k++) {
      const idx = affectedIndices[k]
      const w = falloffs[k] * factor
      const initX = initialPositions[idx * 3]
      const initY = initialPositions[idx * 3 + 1]
      const initZ = initialPositions[idx * 3 + 2]

      posAttr.setXYZ(idx, initX + deltaLocal.x * w, initY + deltaLocal.y * w, initZ + deltaLocal.z * w)
    }
  } else if (tool === 'inflate') {
    // 2. CỌ KHỐI LỒI / LÕM (INFLATE BRUSH CỤC BỘ)
    // Đẩy các đỉnh theo pháp tuyến (Z cục bộ hoặc normal vector)
    const sign = settings.invert ? -1 : 1
    // Biên độ đẩy tăng theo độ dịch chuyển chuột hoặc lực cọ
    const dragDist = Math.hypot(totalDx, totalDy)
    const pushAmount = sign * (worldRadius * 0.18 + dragDist * 0.15) * factor

    for (let k = 0; k < affectedIndices.length; k++) {
      const idx = affectedIndices[k]
      const w = falloffs[k]
      const initX = initialPositions[idx * 3]
      const initY = initialPositions[idx * 3 + 1]
      const initZ = initialPositions[idx * 3 + 2]

      posAttr.setXYZ(idx, initX, initY, initZ + pushAmount * w)
    }
  } else if (tool === 'smooth') {
    // 3. CỌ LÀM MƯỢT (SMOOTH BRUSH CỤC BỘ)
    // Tính vị trí trung bình của các đỉnh trong bán kính ảnh hưởng
    let avgX = 0
    let avgY = 0
    let avgZ = 0
    for (let k = 0; k < affectedIndices.length; k++) {
      const idx = affectedIndices[k]
      avgX += initialPositions[idx * 3]
      avgY += initialPositions[idx * 3 + 1]
      avgZ += initialPositions[idx * 3 + 2]
    }
    avgX /= affectedIndices.length
    avgY /= affectedIndices.length
    avgZ /= affectedIndices.length

    const blend = 0.45 * factor
    for (let k = 0; k < affectedIndices.length; k++) {
      const idx = affectedIndices[k]
      const w = falloffs[k] * blend
      const initX = initialPositions[idx * 3]
      const initY = initialPositions[idx * 3 + 1]
      const initZ = initialPositions[idx * 3 + 2]

      posAttr.setXYZ(idx, initX + (avgX - initX) * w, initY + (avgY - initY) * w, initZ + (avgZ - initZ) * w)
    }
  } else if (tool === 'crease') {
    // 4. CỌ GẤP NẾP / GÂN LÁ (CREASE BRUSH CỤC BỘ)
    // Bóp các đỉnh lại gần tâm cọ (pinch) đồng thời ép rãnh sâu xuống theo Z
    const sign = settings.invert ? 1 : -1
    const depthAmount = sign * (worldRadius * 0.2) * factor
    const localHit = mesh.worldToLocal(session.startHitWorld.clone())

    for (let k = 0; k < affectedIndices.length; k++) {
      const idx = affectedIndices[k]
      const w = falloffs[k]
      const initX = initialPositions[idx * 3]
      const initY = initialPositions[idx * 3 + 1]
      const initZ = initialPositions[idx * 3 + 2]

      // Pinch: kéo nhẹ tọa độ X/Y về gần trục hit
      const pinchX = (localHit.x - initX) * 0.25 * w * factor
      const pinchY = (localHit.y - initY) * 0.25 * w * factor

      posAttr.setXYZ(idx, initX + pinchX, initY + pinchY, initZ + depthAmount * w)
    }
  }

  posAttr.needsUpdate = true
  mesh.geometry.computeVertexNormals()
}

/**
 * Kết thúc nét cọ khi người dùng nhả chuột:
 * Tính toán mảng độ lệch đỉnh (sculptOffsets) so với base geometry ban đầu để lưu vào Face3D.
 */
export function endSculptStroke(
  session: SculptStrokeSession,
  unsculptedBasePositions?: Float32Array
): number[] {
  const { mesh, initialPositions, baseOffsets } = session
  const posAttr = mesh.geometry?.getAttribute('position')
  if (!posAttr) return []

  const count = posAttr.count
  const offsets: number[] = new Array(count * 3)
  const base = unsculptedBasePositions || initialPositions

  for (let i = 0; i < count; i++) {
    // Độ lệch = vị trí hiện tại sau khi vẽ - vị trí ban đầu chưa hề sculpt
    const curX = posAttr.getX(i)
    const curY = posAttr.getY(i)
    const curZ = posAttr.getZ(i)

    if (unsculptedBasePositions) {
      offsets[i * 3] = Math.round((curX - base[i * 3]) * 100) / 100
      offsets[i * 3 + 1] = Math.round((curY - base[i * 3 + 1]) * 100) / 100
      offsets[i * 3 + 2] = Math.round((curZ - base[i * 3 + 2]) * 100) / 100
    } else {
      // Delta so với đầu stroke cộng với baseOffsets trước đó
      const dX = curX - initialPositions[i * 3]
      const dY = curY - initialPositions[i * 3 + 1]
      const dZ = curZ - initialPositions[i * 3 + 2]
      offsets[i * 3] = Math.round((baseOffsets[i * 3] + dX) * 100) / 100
      offsets[i * 3 + 1] = Math.round((baseOffsets[i * 3 + 1] + dY) * 100) / 100
      offsets[i * 3 + 2] = Math.round((baseOffsets[i * 3 + 2] + dZ) * 100) / 100
    }
  }

  return offsets
}
