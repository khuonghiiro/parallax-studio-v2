import * as THREE from 'three'
import type { Face3D } from './types'
import { faceQuaternion, type Vec3 } from './assemblyGeometry'
import {
  localPlaneHit,
  projectPoint,
  resizedScale,
  rotationAngle,
  rotationBasis,
  type GizmoRect,
  type Point
} from '../../../engine/layerGizmo'

export type AssemblyGizmoHandle =
  | { kind: 'scale'; handle: Point }
  | { kind: 'rotate'; axis: number }
  | { kind: 'translate'; axis: number; edgeOn: boolean }

export interface AssemblyDragContext {
  face: Face3D
  modelScale: number
  camera: THREE.Camera
  rect: GizmoRect
  worldMatrix: THREE.Matrix4
  onUpdateFace: (faceId: string, updates: Partial<Face3D>) => void
  onDragStateChange?: (isDragging: boolean) => void
}

/**
 * Scale handle behaviour: mid-edge handles move only their own edge (the opposite edge stays
 * put), corner handles scale about the centre. Holding Alt swaps the two behaviours.
 */
export function isAnchoredResize(handle: Point, altKey: boolean): boolean {
  const isEdge = handle[0] === 0 || handle[1] === 0
  return isEdge !== altKey
}

/**
 * New face centre after resizing from (startW, startH) to (nextW, nextH) while the edge /
 * corner opposite `handle` stays fixed. Offsets are applied along the face's own axes.
 */
export function anchoredResizePosition(
  rotation: Vec3,
  startPos: Vec3,
  startW: number,
  startH: number,
  nextW: number,
  nextH: number,
  handle: Point
): Vec3 {
  const local = new THREE.Vector3(((nextW - startW) / 2) * handle[0], ((nextH - startH) / 2) * handle[1], 0)
  const v = local.applyQuaternion(faceQuaternion(rotation))
  const r = (n: number): number => Math.round(n * 100) / 100
  return [r(startPos[0] + v.x), r(startPos[1] + v.y), r(startPos[2] - v.z)]
}

/**
 * Initiates an interactive drag on an Assembly 3D Face gizmo handle (scale, rotate, translate).
 * Handles pointer events, calculates transforms, supports Shift snapping and Escape cancellation.
 */
export function startAssemblyGizmoDrag(
  e: React.PointerEvent,
  context: AssemblyDragContext,
  handle: AssemblyGizmoHandle
): () => void {
  const { face, modelScale, camera, rect, worldMatrix, onUpdateFace, onDragStateChange } = context
  const targetEl = e.currentTarget as SVGElement
  const container = targetEl.ownerSVGElement?.parentElement
  const bounds = container?.getBoundingClientRect()
  if (!bounds) return () => undefined

  const point = (ev: { clientX: number; clientY: number }): Point => [
    ev.clientX - bounds.left,
    ev.clientY - bounds.top
  ]

  const startPt = point(e)
  const startPos: [number, number, number] = [...face.position]
  const startRot: [number, number, number] = [...face.rotation]
  const startW = face.width
  const startH = face.height

  const pivot = new THREE.Vector3().setFromMatrixPosition(worldMatrix)
  const center = projectPoint(pivot, camera, rect)
  const from = localPlaneHit(startPt, camera, rect, worldMatrix)

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
    if (cancel) {
      onUpdateFace(face.id, {
        position: startPos,
        rotation: startRot,
        width: startW,
        height: startH
      })
    }
  }

  /** Scale gesture: ratio from the local plane hit (or screen delta when edge-on). */
  function scaleTo(currPt: Point, ev: PointerEvent, hs: Point): void {
    const anchored = isAnchoredResize(hs, ev.altKey)
    const ms = modelScale || 1
    const to = localPlaneHit(currPt, camera, rect, worldMatrix)
    let ratioX = 1
    let ratioY = 1
    if (from && to) {
      const anchor = anchored
        ? new THREE.Vector3((-hs[0] * startW * ms) / 2, (-hs[1] * startH * ms) / 2, 0)
        : new THREE.Vector3(0, 0, 0)
      ;[ratioX, ratioY] = resizedScale([1, 1, 1], from, to, anchor, hs, ev.shiftKey)
    } else {
      const k = anchored ? 100 : 200
      ratioX = hs[0] !== 0 ? 1 + ((currPt[0] - startPt[0]) * hs[0]) / k : 1
      ratioY = hs[1] !== 0 ? 1 - ((currPt[1] - startPt[1]) * hs[1]) / k : 1
      if (ev.shiftKey && hs[0] && hs[1]) ratioX = ratioY = Math.max(ratioX, ratioY)
    }
    const nextW = Math.max(10, Math.round(startW * Math.abs(ratioX)))
    const nextH = Math.max(10, Math.round(startH * Math.abs(ratioY)))
    const position = anchored
      ? anchoredResizePosition(startRot, startPos, startW, startH, nextW, nextH, hs)
      : startPos
    onUpdateFace(face.id, { width: nextW, height: nextH, position })
  }

  function move(ev: PointerEvent): void {
    if (ev.pointerId !== pointerId) return
    const currPt = point(ev)

    if (handle.kind === 'scale') {
      scaleTo(currPt, ev, handle.handle)
      return
    }

    if (handle.kind === 'rotate') {
      const curAngle = angleAt(currPt)
      if (!edgeOnRotation && curAngle !== null && prevAngle !== null) {
        totalAngle += Math.atan2(Math.sin(curAngle - prevAngle), Math.cos(curAngle - prevAngle))
        prevAngle = curAngle
      }
      let deltaDeg = edgeOnRotation
        ? currPt[0] - startPt[0]
        : (totalAngle * 180) / Math.PI * (handle.axis === 0 ? 1 : -1)
      if (ev.shiftKey) deltaDeg = Math.round(deltaDeg / 15) * 15
      else deltaDeg = Math.round(deltaDeg)
      const nextRot: [number, number, number] = [...startRot]
      nextRot[handle.axis] = Math.round(startRot[handle.axis] + deltaDeg)
      onUpdateFace(face.id, { rotation: nextRot })
      return
    }

    if (handle.kind === 'translate') {
      const axis = handle.axis
      const localAxis = new THREE.Vector3(
        axis === 0 ? 1 : 0,
        axis === 1 ? 1 : 0,
        axis === 2 ? -1 : 0
      )
      const worldAxis = localAxis.clone().multiplyScalar(modelScale || 1.0)
      const end = projectPoint(pivot.clone().add(worldAxis), camera, rect)
      const dx = end[0] - center[0]
      const dy = end[1] - center[1]
      const distSq = dx * dx + dy * dy
      let delta = handle.edgeOn
        ? (startPt[1] - currPt[1]) * 2
        : ((currPt[0] - startPt[0]) * dx + (currPt[1] - startPt[1]) * dy) / Math.max(1e-8, distSq)
      if (ev.shiftKey) delta = Math.round(delta / 10) * 10
      else delta = Math.round(delta)
      const nextPos: [number, number, number] = [...startPos]
      nextPos[axis] = startPos[axis] + delta
      onUpdateFace(face.id, { position: nextPos })
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
