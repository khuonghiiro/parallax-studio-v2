import * as THREE from 'three'
import type { Assembly3DActiveTool, BrushSettings } from './Assembly3DVerticalPalette'

export interface SculptStrokeSession {
  mesh: THREE.Mesh
  faceId: string
  tool: Assembly3DActiveTool
  settings: BrushSettings
  /** Vị trí các đỉnh khi bắt đầu nhấp chuột (local space) */
  initialPositions: Float32Array
  /** Điểm tiếp xúc cọ ở frame trước đó trong world space */
  lastHitWorld: THREE.Vector3
  /** Điểm tiếp xúc ban đầu khi nhấn chuột trong world space */
  startHitWorld: THREE.Vector3
  /** Ma trận nghịch đảo của mesh world matrix được cache */
  invMat: THREE.Matrix4
  /** Tọa độ chuột ban đầu */
  startMouse: { x: number; y: number }
  /** Tọa độ chuột ở frame trước đó */
  lastMouse: { x: number; y: number }
  /** Bán kính đầu cọ trong world space */
  worldRadius: number
  /** Danh sách các đỉnh bị ảnh hưởng cho Grab tool */
  grabIndices?: number[]
  /** Trọng số suy giảm cho Grab tool */
  grabFalloffs?: Float32Array
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
 * Tính hệ số suy giảm khoảng cách (Smooth Cosine Curve chuẩn Blender Sculpt Mode).
 * Tại tâm cọ (d = 0) -> w = 1.0 với đạo hàm 0 (đỉnh vòm mềm mại, không nhọn hoắt).
 * Tại viền cọ (d = radius) -> w = 0.0 với đạo hàm 0 (tiếp xúc phẳng lỳ với bề mặt xung quanh, không để lại vết hằn ngấn gãy).
 */
export function computeCosineFalloff(dist: number, radius: number): number {
  if (dist >= radius) return 0
  const t = Math.max(0, Math.min(1, dist / radius))
  // Cosine bell curve: 0.5 * (1 + cos(t * PI))
  return 0.5 * (1 + Math.cos(t * Math.PI))
}

/**
 * Khởi tạo một phiên vẽ cọ điêu khắc khi người dùng nhấn chuột xuống mesh.
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
  const initialPositions = new Float32Array(posAttr.array)
  const invMat = mesh.matrixWorld.clone().invert()

  const session: SculptStrokeSession = {
    mesh,
    faceId,
    tool,
    settings,
    initialPositions,
    startHitWorld: hitPointWorld.clone(),
    lastHitWorld: hitPointWorld.clone(),
    invMat,
    startMouse: { x: clientX, y: clientY },
    lastMouse: { x: clientX, y: clientY },
    worldRadius
  }

  // Đối với Grab tool: lưu lại các đỉnh neo trong bán kính ban đầu
  if (tool === 'grab') {
    const affected: number[] = []
    const weights: number[] = []
    const tempV = new THREE.Vector3()
    const count = posAttr.count

    for (let i = 0; i < count; i++) {
      tempV.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i))
      mesh.localToWorld(tempV)
      const dist = tempV.distanceTo(hitPointWorld)
      if (dist <= worldRadius) {
        const w = computeCosineFalloff(dist, worldRadius)
        if (w > 0.001) {
          affected.push(i)
          weights.push(w)
        }
      }
    }
    session.grabIndices = affected
    session.grabFalloffs = new Float32Array(weights)
  } else {
    // Với cọ vẽ liên tục (Inflate, Smooth, Crease): áp dụng ngay dab đầu tiên tại điểm nhấn chuột
    applySingleDab(session, hitPointWorld)
  }

  return session
}

/**
 * Áp dụng một điểm chạm cọ (Brush Dab) tại vị trí dabCenterWorld trên mesh.
 * Đây là thuật toán cốt lõi của Blender Sculpt: cọ lướt qua đâu thì đỉnh ở đó biến dạng!
 */
export function applySingleDab(session: SculptStrokeSession, dabCenterWorld: THREE.Vector3): void {
  const { mesh, tool, settings, worldRadius, invMat } = session
  const posAttr = mesh.geometry?.getAttribute('position')
  if (!posAttr) return

  // Chuyển tâm dab sang local space của mesh
  const localDab = dabCenterWorld.clone().applyMatrix4(invMat)

  // Bán kính cọ trong local space (tính theo tỉ lệ scale của mesh)
  const meshScale = mesh.scale.x || 1.0
  const localRadius = worldRadius / meshScale
  const localRadiusSq = localRadius * localRadius
  const factor = settings.strength

  const count = posAttr.count

  if (tool === 'inflate') {
    // 🎈 CỌ PHỒNG / LÕM (INFLATE): Đẩy các đỉnh nhô lên / lõm xuống mềm mại theo khoảng cách
    const sign = settings.invert ? -1 : 1
    const baseStep = localRadius * 0.04 * factor * sign

    for (let i = 0; i < count; i++) {
      const px = posAttr.getX(i)
      const py = posAttr.getY(i)
      const pz = posAttr.getZ(i)

      const dx = px - localDab.x
      const dy = py - localDab.y
      const dz = pz - localDab.z
      const distSq = dx * dx + dy * dy + dz * dz

      if (distSq <= localRadiusSq) {
        const dist = Math.sqrt(distSq)
        const w = computeCosineFalloff(dist, localRadius)
        // Đẩy dọc theo trục Z cục bộ của mặt phẳng
        posAttr.setZ(i, pz + baseStep * w)
      }
    }
  } else if (tool === 'smooth') {
    // 🫧 CỌ LÀM MƯỢT (SMOOTH): Gom các đỉnh gồ ghề về mặt phẳng trung bình cục bộ
    // 1. Tìm các đỉnh trong bán kính và tính vị trí trung bình
    let sumZ = 0
    let insideCount = 0

    for (let i = 0; i < count; i++) {
      const px = posAttr.getX(i)
      const py = posAttr.getY(i)
      const pz = posAttr.getZ(i)
      const dx = px - localDab.x
      const dy = py - localDab.y
      const dz = pz - localDab.z

      if (dx * dx + dy * dy + dz * dz <= localRadiusSq) {
        sumZ += pz
        insideCount++
      }
    }

    if (insideCount > 1) {
      const avgZ = sumZ / insideCount
      const blend = 0.35 * factor

      for (let i = 0; i < count; i++) {
        const px = posAttr.getX(i)
        const py = posAttr.getY(i)
        const pz = posAttr.getZ(i)
        const dx = px - localDab.x
        const dy = py - localDab.y
        const dz = pz - localDab.z
        const distSq = dx * dx + dy * dy + dz * dz

        if (distSq <= localRadiusSq) {
          const dist = Math.sqrt(distSq)
          const w = computeCosineFalloff(dist, localRadius)
          posAttr.setZ(i, pz + (avgZ - pz) * w * blend)
        }
      }
    }
  } else if (tool === 'crease') {
    // 〰️ CỌ GẤP NẾP / GÂN LÁ (CREASE): Ép rãnh nhọn và kéo chụm vào tâm đường cọ
    const sign = settings.invert ? 1 : -1
    const baseStep = localRadius * 0.05 * factor * sign

    for (let i = 0; i < count; i++) {
      const px = posAttr.getX(i)
      const py = posAttr.getY(i)
      const pz = posAttr.getZ(i)
      const dx = px - localDab.x
      const dy = py - localDab.y
      const dz = pz - localDab.z
      const distSq = dx * dx + dy * dy + dz * dz

      if (distSq <= localRadiusSq) {
        const dist = Math.sqrt(distSq)
        const w = computeCosineFalloff(dist, localRadius)
        // Pinch chụm lại trục đường vẽ
        const pinchX = (localDab.x - px) * 0.15 * w * factor
        const pinchY = (localDab.y - py) * 0.15 * w * factor
        posAttr.setXYZ(i, px + pinchX, py + pinchY, pz + baseStep * w)
      }
    }
  }

  posAttr.needsUpdate = true
}

/**
 * Cập nhật biến dạng cọ khi chuột di chuyển trong từng frame.
 * Hỗ trợ nội suy nét cọ liên tục (Stroke Dabbing Interpolation) để đường vẽ luôn mượt mà.
 */
export function applySculptStrokeMove(
  session: SculptStrokeSession,
  currentMouse: { x: number; y: number },
  currentHitWorld: THREE.Vector3,
  camera: THREE.Camera,
  viewportHeight: number
): void {
  const { mesh, tool, settings, initialPositions, startMouse, worldRadius, invMat } = session
  const posAttr = mesh.geometry?.getAttribute('position')
  if (!posAttr) return

  if (tool === 'grab') {
    // 1. CỌ KÉO MỀM (GRAB): Kéo cụm đỉnh neo ban đầu theo hướng chuột di chuyển
    const { grabIndices, grabFalloffs } = session
    if (!grabIndices || grabIndices.length === 0 || !grabFalloffs) return

    const totalDx = currentMouse.x - startMouse.x
    const totalDy = currentMouse.y - startMouse.y
    const factor = settings.strength

    const dist = camera.position.distanceTo(session.startHitWorld)
    const fov = (camera as THREE.PerspectiveCamera).fov || 45
    const worldPerPx = (2 * Math.tan((fov * Math.PI) / 360) * dist) / (viewportHeight || 500)

    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
    const deltaWorld = new THREE.Vector3()
      .addScaledVector(camRight, totalDx * worldPerPx)
      .addScaledVector(camUp, -totalDy * worldPerPx)

    const deltaLocal = deltaWorld.transformDirection(invMat)

    for (let k = 0; k < grabIndices.length; k++) {
      const idx = grabIndices[k]
      const w = grabFalloffs[k] * factor
      const initX = initialPositions[idx * 3]
      const initY = initialPositions[idx * 3 + 1]
      const initZ = initialPositions[idx * 3 + 2]

      posAttr.setXYZ(idx, initX + deltaLocal.x * w, initY + deltaLocal.y * w, initZ + deltaLocal.z * w)
    }

    posAttr.needsUpdate = true
  } else {
    // 2. CỌ VẼ LIÊN TỤC (INFLATE, SMOOTH, CREASE):
    // Nội suy các bước dab giữa lastHitWorld và currentHitWorld để đường vẽ liền mạch không bị đứt đoạn
    const dist = session.lastHitWorld.distanceTo(currentHitWorld)
    const stepDist = Math.max(2, worldRadius * 0.2) // Bước nhảy dab = 20% bán kính cọ chuẩn Blender
    const steps = Math.max(1, Math.min(8, Math.ceil(dist / stepDist)))

    for (let s = 1; s <= steps; s++) {
      const alpha = s / steps
      const dabPos = new THREE.Vector3().lerpVectors(session.lastHitWorld, currentHitWorld, alpha)
      applySingleDab(session, dabPos)
    }

    session.lastHitWorld.copy(currentHitWorld)
  }

  session.lastMouse = { ...currentMouse }
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
  const { mesh, initialPositions } = session
  const posAttr = mesh.geometry?.getAttribute('position')
  if (!posAttr) return []

  const count = posAttr.count
  const offsets: number[] = new Array(count * 3)
  const base = unsculptedBasePositions || initialPositions

  for (let i = 0; i < count; i++) {
    const curX = posAttr.getX(i)
    const curY = posAttr.getY(i)
    const curZ = posAttr.getZ(i)

    offsets[i * 3] = Math.round((curX - base[i * 3]) * 100) / 100
    offsets[i * 3 + 1] = Math.round((curY - base[i * 3 + 1]) * 100) / 100
    offsets[i * 3 + 2] = Math.round((curZ - base[i * 3 + 2]) * 100) / 100
  }

  return offsets
}
