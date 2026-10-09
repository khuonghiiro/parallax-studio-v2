import * as THREE from 'three'
import type { AssembledLayerItem } from './types'
import {
  projectPoint,
  rotationAngle,
  rotationBasis,
  type GizmoRect,
  type Point
} from '../../engine/layerGizmo'

export type LayerGizmoHandle =
  | { kind: 'scale'; handle: Point }
  | { kind: 'rotate'; axis: number }
  | { kind: 'translate'; axis: number; edgeOn: boolean }

export interface LayerAssemblyDragContext {
  layer: AssembledLayerItem
  camera: THREE.PerspectiveCamera
  rect: GizmoRect
  worldMatrix: THREE.Matrix4
  zExaggeration: number
  onUpdateLayer?: (id: string, patch: Partial<AssembledLayerItem>) => void
  onDragStateChange?: (isDragging: boolean) => void
}

/**
 * Xử lý tương tác kéo thả các thành phần của Layer Gizmo 3D (di chuyển XYZ, xoay góc 3D, phóng to thu nhỏ)
 */
export function startLayerAssemblyGizmoDrag(
  e: React.PointerEvent,
  context: LayerAssemblyDragContext,
  handle: LayerGizmoHandle
): () => void {
  const { layer, camera, rect, worldMatrix, zExaggeration, onUpdateLayer, onDragStateChange } = context
  if (!onUpdateLayer) return () => undefined

  const targetEl = e.currentTarget as SVGElement
  const container = targetEl.ownerSVGElement?.parentElement
  const bounds = container?.getBoundingClientRect()
  if (!bounds) return () => undefined

  const point = (ev: { clientX: number; clientY: number }): Point => [
    ev.clientX - bounds.left,
    ev.clientY - bounds.top
  ]

  const startPt = point(e)
  const startPos = { x: layer.x, y: layer.y, z: layer.z }
  const startRot: [number, number, number] = [
    layer.rotationX || 0,
    layer.rotationY || 0,
    layer.rotation || 0
  ]
  const startScale = layer.scale

  const pivot = new THREE.Vector3().setFromMatrixPosition(worldMatrix)
  const center = projectPoint(pivot, camera, rect)

  const parent = new THREE.Matrix4()
  const basis = handle.kind === 'rotate' ? rotationBasis(startRot, handle.axis, parent) : parent
  const angleAt = (pt: Point): number | null =>
    handle.kind === 'rotate' ? rotationAngle(pt, camera, rect, pivot, basis, handle.axis) : null
  let prevAngle = angleAt(startPt)
  const edgeOnRotation = prevAngle === null
  let totalAngle = 0

  const pointerId = e.pointerId
  let active = true
  onDragStateChange?.(true)

  function finish(cancel = false): void {
    if (!active) return
    active = false
    onDragStateChange?.(false)
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', cancelDrag)
    window.removeEventListener('keydown', keydown)
    window.removeEventListener('blur', cancelDrag)

    if (cancel && onUpdateLayer) {
      onUpdateLayer(layer.id, {
        x: startPos.x,
        y: startPos.y,
        z: startPos.z,
        rotationX: startRot[0],
        rotationY: startRot[1],
        rotation: startRot[2],
        scale: startScale
      })
    }
  }

  function move(ev: PointerEvent): void {
    if (ev.pointerId !== pointerId || !onUpdateLayer) return
    const currPt = point(ev)

    // 1. Kéo giãn tỉ lệ (Scale)
    if (handle.kind === 'scale') {
      const startDist = Math.hypot(startPt[0] - center[0], startPt[1] - center[1])
      const currDist = Math.hypot(currPt[0] - center[0], currPt[1] - center[1])
      const ratio = currDist / Math.max(12, startDist)
      let nextScale = Math.max(0.05, Math.min(10, startScale * ratio))
      if (ev.shiftKey) {
        nextScale = Math.round(nextScale * 10) / 10
      } else {
        nextScale = Math.round(nextScale * 100) / 100
      }
      onUpdateLayer(layer.id, { scale: nextScale })
      return
    }

    // 2. Xoay góc 3D theo 3 trục (Pitch X, Yaw Y, Roll Z)
    if (handle.kind === 'rotate') {
      const curAngle = angleAt(currPt)
      if (!edgeOnRotation && curAngle !== null && prevAngle !== null) {
        totalAngle += Math.atan2(Math.sin(curAngle - prevAngle), Math.cos(curAngle - prevAngle))
        prevAngle = curAngle
      }
      let deltaDeg = edgeOnRotation
        ? currPt[0] - startPt[0]
        : ((totalAngle * 180) / Math.PI) * (handle.axis === 0 ? 1 : -1)

      if (ev.shiftKey) {
        deltaDeg = Math.round(deltaDeg / 15) * 15
      } else {
        deltaDeg = Math.round(deltaDeg)
      }

      if (handle.axis === 0) {
        // Trục X (Pitch)
        onUpdateLayer(layer.id, { rotationX: Math.round(startRot[0] + deltaDeg) })
      } else if (handle.axis === 1) {
        // Trục Y (Yaw)
        onUpdateLayer(layer.id, { rotationY: Math.round(startRot[1] + deltaDeg) })
      } else {
        // Trục Z (Roll)
        onUpdateLayer(layer.id, { rotation: Math.round(startRot[2] + deltaDeg) })
      }
      return
    }

    // 3. Di chuyển trục (Translate X / Y / Z)
    if (handle.kind === 'translate') {
      const axis = handle.axis
      const axisVector = new THREE.Vector3(
        axis === 0 ? 100 : 0,
        axis === 1 ? 100 : 0,
        axis === 2 ? 100 : 0
      )
      const end = projectPoint(pivot.clone().add(axisVector), camera, rect)
      const dx = end[0] - center[0]
      const dy = end[1] - center[1]
      const distSq = dx * dx + dy * dy

      let delta = handle.edgeOn
        ? (startPt[1] - currPt[1]) * 1.5
        : (((currPt[0] - startPt[0]) * dx + (currPt[1] - startPt[1]) * dy) / Math.max(1e-6, distSq)) * 100

      if (axis === 0) {
        // Trục X (Ngang)
        if (ev.shiftKey) delta = Math.round(delta / 10) * 10
        const nextX = Math.round(startPos.x + delta)
        onUpdateLayer(layer.id, { x: nextX })
      } else if (axis === 1) {
        // Trục Y (Dọc): Trong Three.js +Y là Lên, nhưng trong 2D canvas Y hướng Xuống
        if (ev.shiftKey) delta = Math.round(delta / 10) * 10
        const nextY = Math.round(startPos.y - delta)
        onUpdateLayer(layer.id, { y: nextY })
      } else if (axis === 2) {
        // Trục Z (Độ sâu): Three.js +Z là Gần camera (Tiền cảnh -> Z nhỏ/âm hơn)
        const zStep = delta / Math.max(0.1, zExaggeration)
        const roundedZ = ev.shiftKey ? Math.round(zStep / 10) * 10 : zStep
        const nextZ = Math.round(startPos.z - roundedZ)
        onUpdateLayer(layer.id, { z: nextZ })
      }
    }
  }

  function up(ev: PointerEvent): void {
    if (ev.pointerId === pointerId) finish()
  }

  function cancelDrag(): void {
    finish(true)
  }

  function keydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      ev.preventDefault()
      finish(true)
    }
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', cancelDrag)
  window.addEventListener('keydown', keydown)
  window.addEventListener('blur', cancelDrag)

  return cancelDrag
}
