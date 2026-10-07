import * as THREE from 'three'
import { nanoid } from 'nanoid'
import type { Vec3 } from '@shared/types'
import { evaluate, setValueAt } from '../../animation/keyframes'
import { layerPivot, localPlaneHit, projectPoint, resizedScale, rotationAngle, rotationBasis, type Point } from '../../engine/layerGizmo'
import type { EvaluatedLayer } from '../../engine/evaluateScene'
import { frameTolerance, useEditor } from '../../store/editor'
import type { GizmoFrame } from './LayerGizmo'

export type GizmoHandle = { kind: 'scale'; handle: Point } | { kind: 'rotate'; axis: number } | { kind: 'translate'; axis: number; edgeOn: boolean }

function dragSolver(frame: GizmoFrame, el: EvaluatedLayer, parent: THREE.Matrix4, handle: GizmoHandle, startPoint: Point, time: number) {
  const prop: 'scale' | 'rotation' | 'position' = handle.kind === 'scale' ? 'scale' : handle.kind === 'rotate' ? 'rotation' : 'position'
  const start = [...evaluate(el.layer.transform[prop], time)] as Vec3
  const anchor = el.layer.transform.anchor ? evaluate(el.layer.transform.anchor, time) : [0, 0, 0] as Vec3
  const pivot = layerPivot(el, anchor)
  const center = projectPoint(pivot, frame.camera, frame.rect)
  const from = localPlaneHit(startPoint, frame.camera, frame.rect, el.world)
  const basis = handle.kind === 'rotate' ? rotationBasis(start, handle.axis, parent) : parent
  const angleAt = (point: Point): number | null => handle.kind === 'rotate' ? rotationAngle(point, frame.camera, frame.rect, pivot, basis, handle.axis) : null
  let previousAngle = angleAt(startPoint)
  const edgeOnRotation = previousAngle === null
  let totalAngle = 0
  return { prop, solve(point: Point, shift: boolean): Vec3 | null {
    if (handle.kind === 'scale') {
      const to = localPlaneHit(point, frame.camera, frame.rect, el.world)
      if (!from || !to) return null
      return resizedScale(start, from, to, new THREE.Vector3(anchor[0] * el.size[0], anchor[1] * el.size[1], -anchor[2]), handle.handle, shift)
    }
    const next = [...start] as Vec3
    const axis = handle.axis
    if (handle.kind === 'translate') {
      const localAxis = new THREE.Vector3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? -1 : 0)
      const worldAxis = localAxis.applyMatrix4(parent).sub(new THREE.Vector3().setFromMatrixPosition(parent))
      const end = projectPoint(pivot.clone().add(worldAxis), frame.camera, frame.rect)
      const dx = end[0] - center[0], dy = end[1] - center[1]
      const delta = handle.edgeOn ? (startPoint[1] - point[1]) * 3 : ((point[0] - startPoint[0]) * dx + (point[1] - startPoint[1]) * dy) / Math.max(1e-8, dx * dx + dy * dy)
      next[axis] += shift ? Math.round(delta / 10) * 10 : delta
    } else {
      const angle = angleAt(point)
      if (!edgeOnRotation && (angle === null || previousAngle === null)) return null
      if (angle !== null && previousAngle !== null) {
        totalAngle += Math.atan2(Math.sin(angle - previousAngle), Math.cos(angle - previousAngle))
        previousAngle = angle
      }
      const delta = edgeOnRotation ? point[0] - startPoint[0] : totalAngle * 180 / Math.PI * (axis === 0 ? 1 : -1)
      next[axis] += shift ? Math.round(delta / 15) * 15 : delta
    }
    return next.every(Number.isFinite) ? next : null
  } }
}

/** One pointer gesture is one history entry, including pauses longer than the merge window. */
export function startGizmoDrag(e: React.PointerEvent, frame: GizmoFrame, el: EvaluatedLayer, parent: THREE.Matrix4, handle: GizmoHandle): () => void {
  const initial = useEditor.getState()
  const time = initial.time
  const canvas = (e.currentTarget as SVGElement).ownerSVGElement?.parentElement?.querySelector('canvas')
  const bounds = canvas?.getBoundingClientRect()
  if (!bounds) return () => undefined
  const point = (ev: { clientX: number; clientY: number }): Point => [ev.clientX - bounds.left, ev.clientY - bounds.top]
  const solver = dragSolver(frame, el, parent, handle, point(e), time)
  const key = `gizmo-${nanoid(8)}`
  const pointerId = e.pointerId
  let changed = false
  let active = true
  let lastProject = initial.project
  function finish(cancel = false): void {
    if (!active) return
    active = false
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', cancelDrag)
    window.removeEventListener('keydown', keydown)
    window.removeEventListener('blur', cancelDrag)
    if (cancel && changed && useEditor.getState().project === lastProject) {
      useEditor.setState({ project: initial.project, past: initial.past, future: initial.future, dirty: initial.dirty, lastMerge: null })
    }
  }
  function move(ev: PointerEvent): void {
    if (ev.pointerId !== pointerId) return
    const st = useEditor.getState()
    if (st.project !== lastProject || st.time !== time || st.selectedLayerId !== el.layer.id || st.playing) { finish(); return }
    if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 2 && !changed) return
    const next = solver.solve(point(ev), ev.shiftKey)
    if (!next) return
    if (changed) useEditor.setState({ lastMerge: { key, at: performance.now() } })
    st.update((draft) => {
      const layer = draft.layers.find((l) => l.id === el.layer.id)
      if (layer && !layer.locked) setValueAt(layer.transform[solver.prop], time, next, frameTolerance(draft))
    }, key)
    lastProject = useEditor.getState().project
    changed = lastProject !== initial.project
  }
  function up(ev: PointerEvent): void { if (ev.pointerId === pointerId) finish() }
  function cancelDrag(): void { finish(true) }
  function keydown(ev: KeyboardEvent): void { if (ev.key === 'Escape') { ev.preventDefault(); finish(true) } }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', cancelDrag)
  window.addEventListener('keydown', keydown)
  window.addEventListener('blur', cancelDrag)
  return cancelDrag
}
