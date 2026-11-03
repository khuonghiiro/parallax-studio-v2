import * as THREE from 'three'
import type { Project, Vec3 } from '@shared/types'
import { evaluateScene, type EvaluatedShot } from '../../engine/evaluateScene'
import type { EditorCamera } from '../../engine/EditorCamera'
import type { Rect, SceneRenderer } from '../../engine/SceneRenderer'
import { computeShotRoute } from '../../project/workflowV2Engine'
import { inRect, type Layout } from './viewerLayout'

export interface ScreenToSceneOptions {
  clientX: number
  clientY: number
  canvasEl: HTMLCanvasElement
  layout: Layout
  renderer: SceneRenderer
  edCam: EditorCamera
  project: Project
  time: number
  targetShotId?: string | null
}

const _camDir = new THREE.Vector3()
const _shotQ = new THREE.Quaternion()
const _hitPoint = new THREE.Vector3()

const roundCoord = (v: number): number => {
  const r = Math.round(v)
  return Object.is(r, -0) ? 0 : r
}

/**
 * Xác định chính xác cảnh (Shot) mục tiêu mà người dùng đang thả tài nguyên vào trên Camera View hoặc 3D Editor View.
 * Khắc phục lỗi khi người dùng đang xem Cảnh B trên Camera/3D nhưng `selectedShotId` vẫn đang ở Cảnh A khiến
 * layer hiển thị ở Cảnh B nhưng dòng Timeline lại nhảy sang Cảnh A.
 */
export function resolveDropTargetShotId(opts: ScreenToSceneOptions): string | null {
  const { clientX, clientY, canvasEl, layout, renderer, edCam, project, time, targetShotId } = opts
  if (project.shots.length === 0) return null
  if (project.shots.length === 1) return project.shots[0].id

  const canvasRect = canvasEl.getBoundingClientRect()
  const localX = clientX - canvasRect.left
  const localY = clientY - canvasRect.top

  const camRect = layout.cam
  const edRect = layout.ed
  const insideCam =
    !!camRect &&
    localX >= camRect.x &&
    localY >= camRect.y &&
    localX < camRect.x + camRect.w &&
    localY < camRect.y + camRect.h
  const insideEd =
    !!edRect &&
    localX >= edRect.x &&
    localY >= edRect.y &&
    localX < edRect.x + edRect.w &&
    localY < edRect.y + edRect.h

  const ev = evaluateScene(project, time)
  const route = computeShotRoute(project)
  const fallback =
    targetShotId && project.shots.some((s) => s.id === targetShotId)
      ? targetShotId
      : project.shots[0]?.id ?? null

  if (insideEd && edRect) {
    const aspect = edRect.w / Math.max(1, edRect.h)
    const activeCam = edCam.get(aspect)
    const ndcX = ((localX - edRect.x) / Math.max(1, edRect.w)) * 2 - 1
    const ndcY = -(((localY - edRect.y) / Math.max(1, edRect.h)) * 2 - 1)

    const pickedLayerId = renderer.pick(ndcX, ndcY, project, activeCam, false)
    if (pickedLayerId) {
      const pickedLayer = project.layers.find((l) => l.id === pickedLayerId)
      if (pickedLayer?.shotId && project.shots.some((s) => s.id === pickedLayer.shotId)) {
        return pickedLayer.shotId
      }
    }
    const pickedShotId = renderer.pickShot(ndcX, ndcY, activeCam)
    if (pickedShotId && project.shots.some((s) => s.id === pickedShotId)) {
      return pickedShotId
    }

    const ray = renderer.rayAt(ndcX, ndcY, activeCam)
    let bestShotId: string | null = null
    let bestDist = Infinity
    for (const s of ev.shots) {
      if (!s.shot.visible) continue
      const p0 = new THREE.Vector3().setFromMatrixPosition(s.matrix)
      _shotQ.setFromRotationMatrix(s.matrix)
      const inv = _shotQ.clone().invert()
      let normal = new THREE.Vector3(0, 0, 1).applyQuaternion(_shotQ)
      const camDir = activeCam.getWorldDirection(_camDir)
      if (Math.abs(normal.dot(camDir)) < 0.12) normal = camDir.clone().negate()
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, p0)
      const hit = ray.intersectPlane(plane, _hitPoint)
      if (hit) {
        const d = hit.sub(p0).applyQuaternion(inv)
        const dist = Math.hypot(d.x, d.y)
        if (dist < bestDist) {
          bestDist = dist
          bestShotId = s.shot.id
        }
      }
    }
    if (bestShotId && bestDist < 1800) {
      return bestShotId
    }
  }

  // Trên Camera View (hoặc mặc định): ưu tiên cảnh đang được Camera quay tại mốc `time`
  if (insideCam || !insideEd) {
    if (camRect) {
      const ndcX = ((localX - camRect.x) / Math.max(1, camRect.w)) * 2 - 1
      const ndcY = -(((localY - camRect.y) / Math.max(1, camRect.h)) * 2 - 1)
      const pickedLayerId = renderer.pick(ndcX, ndcY, project, renderer.camera, true)
      if (pickedLayerId) {
        const pickedLayer = project.layers.find((l) => l.id === pickedLayerId)
        if (pickedLayer?.shotId && project.shots.some((s) => s.id === pickedLayer.shotId)) {
          return pickedLayer.shotId
        }
      }
    }
    for (const s of route.order) {
      const r = route.ranges.get(s.id)
      if (r && time >= r.start - 1e-3 && time <= r.end + 1e-3) {
        return s.id
      }
    }
    const camTarget = new THREE.Vector3(...ev.camera.target)
    let closestShotId: string | null = null
    let closestDist = Infinity
    for (const s of ev.shots) {
      if (!s.shot.visible) continue
      const p0 = new THREE.Vector3().setFromMatrixPosition(s.matrix)
      const dist = p0.distanceTo(camTarget)
      if (dist < closestDist) {
        closestDist = dist
        closestShotId = s.shot.id
      }
    }
    if (closestShotId && closestDist < 1500) {
      return closestShotId
    }
  }

  return fallback
}

/**
 * Quy đổi toạ độ chuột màn hình (clientX, clientY) sang toạ độ không gian 2.5D [x, y, z]
 * cục bộ của Shot hiện tại trên mặt phẳng cảnh (Z = 0).
 * Hoạt động trơn tru trên cả 2 khung nhìn Camera View và Editor Orbit View.
 */
export function screenToScenePoint(opts: ScreenToSceneOptions): [number, number, number] {
  const {
    clientX,
    clientY,
    canvasEl,
    layout,
    renderer,
    edCam,
    project,
    time,
    targetShotId
  } = opts

  const canvasRect = canvasEl.getBoundingClientRect()
  const localX = clientX - canvasRect.left
  const localY = clientY - canvasRect.top

  // 1. Xác định khung nhìn (Camera View vs Editor View) đang chứa con trỏ chuột
  let activeRect: Rect | null = null
  let activeCam: THREE.Camera | null = null

  const camRect = layout.cam
  const edRect = layout.ed
  const insideCam = !!camRect && localX >= camRect.x && localY >= camRect.y && localX < camRect.x + camRect.w && localY < camRect.y + camRect.h
  const insideEd = !!edRect && localX >= edRect.x && localY >= edRect.y && localX < edRect.x + edRect.w && localY < edRect.y + edRect.h

  if (insideCam && camRect) {
    activeRect = camRect
    activeCam = renderer.camera
  } else if (insideEd && edRect) {
    activeRect = edRect
    const aspect = edRect.w / Math.max(1, edRect.h)
    activeCam = edCam.get(aspect)
  } else if (camRect) {
    activeRect = camRect
    activeCam = renderer.camera
  } else if (edRect) {
    activeRect = edRect
    const aspect = edRect.w / Math.max(1, edRect.h)
    activeCam = edCam.get(aspect)
  }

  if (!activeRect || !activeCam) {
    return [0, 0, 0]
  }

  // 2. Chuyển đổi toạ độ pixel sang NDC (-1 .. +1)
  const ndcX = ((localX - activeRect.x) / Math.max(1, activeRect.w)) * 2 - 1
  const ndcY = -(((localY - activeRect.y) / Math.max(1, activeRect.h)) * 2 - 1)

  const ray = renderer.rayAt(ndcX, ndcY, activeCam)

  // 3. Tìm shot tương ứng và mặt phẳng của shot trong không gian Three.js
  const ev = evaluateScene(project, time)
  const activeShot: EvaluatedShot | undefined =
    (targetShotId ? ev.shots.find((s) => s.shot.id === targetShotId) : undefined) ??
    ev.shots.find((s) => s.shot.id === project.shots[0]?.id) ??
    ev.shots[0]

  if (activeShot) {
    const p0 = new THREE.Vector3().setFromMatrixPosition(activeShot.matrix)
    _shotQ.setFromRotationMatrix(activeShot.matrix)
    const inv = _shotQ.clone().invert()
    const camDir = activeCam.getWorldDirection(_camDir)

    // Pháp tuyến mặt phẳng layer trong shot (hướng theo trục Z depth)
    let normal = new THREE.Vector3(0, 0, 1).applyQuaternion(_shotQ)
    if (Math.abs(normal.dot(camDir)) < 0.12) {
      normal = camDir.clone().negate()
    }

    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, p0)
    const hit = ray.intersectPlane(plane, _hitPoint)
    if (hit) {
      const d = hit.sub(p0).applyQuaternion(inv)
      return [roundCoord(d.x), roundCoord(d.y), roundCoord(-d.z)]
    }
  }

  // Fallback: Mặt phẳng chuẩn Z = 0 qua gốc toạ độ
  const fallbackPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  const hit = ray.intersectPlane(fallbackPlane, _hitPoint)
  if (hit) {
    return [roundCoord(hit.x), roundCoord(hit.y), 0]
  }

  return [0, 0, 0]
}
