import * as THREE from 'three'
import type { Project, Vec3 } from '@shared/types'
import { evaluateScene, type EvaluatedShot } from '../../engine/evaluateScene'
import type { EditorCamera } from '../../engine/EditorCamera'
import type { Rect, SceneRenderer } from '../../engine/SceneRenderer'
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
