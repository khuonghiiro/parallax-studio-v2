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

export function startGizmoDrag(
  e: React.PointerEvent,
  frame: GizmoFrame,
  el: EvaluatedLayer,
  parent: THREE.Matrix4,
  handle: GizmoHandle,
  modelLayers?: EvaluatedLayer[]
): () => void {
  const initial = useEditor.getState()
  const time = initial.time
  const canvas = (e.currentTarget as SVGElement).ownerSVGElement?.parentElement?.querySelector('canvas')
  const bounds = canvas?.getBoundingClientRect()
  if (!bounds) return () => undefined
  const point = (ev: { clientX: number; clientY: number }): Point => [ev.clientX - bounds.left, ev.clientY - bounds.top]
  const startPt = point(e)

  const isModel3D = !!el.layer.model3d && !!modelLayers && modelLayers.length > 0
  let modelPivot = new THREE.Vector3()
  let modelCenter: Point = [0, 0]
  let initialLayers: Array<{
    id: string
    startPos: Vec3
    startRot: Vec3
    startScale: Vec3
    globalScale: number
    baseSize?: [number, number]
    centerPosition: Vec3
  }> = []

  let totalAngle = 0
  let previousAngle: number | null = null
  let edgeOnRotation = false
  const startDist = Math.hypot(startPt[0] - modelCenter[0], startPt[1] - modelCenter[1])

  if (isModel3D) {
    const mb = new THREE.Box3()
    for (const ml of modelLayers) {
      if (!ml.bounds.isEmpty()) mb.union(ml.bounds)
    }
    if (mb.isEmpty()) mb.copy(el.bounds)
    modelPivot = mb.getCenter(new THREE.Vector3())
    modelCenter = projectPoint(modelPivot, frame.camera, frame.rect)
    initialLayers = modelLayers.map((ml) => {
      const l = ml.layer
      return {
        id: l.id,
        startPos: [...evaluate(l.transform.position, time)] as Vec3,
        startRot: [...evaluate(l.transform.rotation, time)] as Vec3,
        startScale: [...evaluate(l.transform.scale, time)] as Vec3,
        globalScale: l.model3d?.globalScale ?? 1.0,
        baseSize: l.model3d?.baseSize,
        centerPosition: (l.model3d?.centerPosition ? [...l.model3d.centerPosition] : [modelPivot.x, modelPivot.y, -modelPivot.z]) as Vec3
      }
    })
    if (handle.kind === 'rotate') {
      previousAngle = rotationAngle(startPt, frame.camera, frame.rect, modelPivot, parent, handle.axis)
      edgeOnRotation = previousAngle === null
    }
  }

  const solver = !isModel3D ? dragSolver(frame, el, parent, handle, startPt, time) : null
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

  function moveModel(pt: Point, shift: boolean): void {
    const st = useEditor.getState()
    if (handle.kind === 'translate') {
      const axis = handle.axis
      const localAxis = new THREE.Vector3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? -1 : 0)
      const worldAxis = localAxis.applyMatrix4(parent).sub(new THREE.Vector3().setFromMatrixPosition(parent))
      const end = projectPoint(modelPivot.clone().add(worldAxis), frame.camera, frame.rect)
      const dx = end[0] - modelCenter[0], dy = end[1] - modelCenter[1]
      const delta = handle.edgeOn ? (startPt[1] - pt[1]) * 3 : ((pt[0] - startPt[0]) * dx + (pt[1] - startPt[1]) * dy) / Math.max(1e-8, dx * dx + dy * dy)
      const step = shift ? Math.round(delta / 10) * 10 : Math.round(delta)
      const deltaVec: Vec3 = [axis === 0 ? step : 0, axis === 1 ? step : 0, axis === 2 ? step : 0]
      st.update((draft) => {
        for (const init of initialLayers) {
          const l = draft.layers.find((x) => x.id === init.id)
          if (!l || l.locked) continue
          const nextPos: Vec3 = [init.startPos[0] + deltaVec[0], init.startPos[1] + deltaVec[1], init.startPos[2] + deltaVec[2]]
          setValueAt(l.transform.position, time, nextPos, frameTolerance(draft))
          if (l.model3d) {
            l.model3d.centerPosition = [init.centerPosition[0] + deltaVec[0], init.centerPosition[1] + deltaVec[1], init.centerPosition[2] + deltaVec[2]]
          }
        }
      }, key)
    } else if (handle.kind === 'rotate') {
      const axis = handle.axis
      const angle = rotationAngle(pt, frame.camera, frame.rect, modelPivot, parent, axis)
      if (!edgeOnRotation && (angle === null || previousAngle === null)) return
      if (angle !== null && previousAngle !== null) {
        totalAngle += Math.atan2(Math.sin(angle - previousAngle), Math.cos(angle - previousAngle))
        previousAngle = angle
      }
      const delta = edgeOnRotation ? pt[0] - startPt[0] : totalAngle * 180 / Math.PI * (axis === 0 ? 1 : -1)
      const deltaDeg = shift ? Math.round(delta / 15) * 15 : delta
      const rad = (deltaDeg * Math.PI) / 180
      const cosA = Math.cos(rad)
      const sinA = Math.sin(rad)
      st.update((draft) => {
        for (const init of initialLayers) {
          const l = draft.layers.find((x) => x.id === init.id)
          if (!l || l.locked) continue
          const rx = init.startPos[0] - modelPivot.x
          const ry = init.startPos[1] - modelPivot.y
          const rz = init.startPos[2] - (-modelPivot.z)
          let nx = rx, ny = ry, nz = rz
          if (axis === 0) {
            ny = ry * cosA - rz * sinA
            nz = ry * sinA + rz * cosA
          } else if (axis === 1) {
            nx = rx * cosA + rz * sinA
            nz = -rx * sinA + rz * cosA
          } else {
            nx = rx * cosA - ry * sinA
            ny = rx * sinA + ry * cosA
          }
          setValueAt(l.transform.position, time, [Math.round(modelPivot.x + nx), Math.round(modelPivot.y + ny), Math.round(-modelPivot.z + nz)], frameTolerance(draft))
          const nextRot = [...init.startRot] as Vec3
          nextRot[axis] = (nextRot[axis] + deltaDeg) % 360
          setValueAt(l.transform.rotation, time, nextRot, frameTolerance(draft))
        }
      }, key)
    } else {
      const curDist = Math.hypot(pt[0] - modelCenter[0], pt[1] - modelCenter[1])
      const rawRatio = curDist / Math.max(1, startDist)
      const scaleRatio = Math.max(0.05, shift ? Math.round(rawRatio * 20) / 20 : rawRatio)
      st.update((draft) => {
        for (const init of initialLayers) {
          const l = draft.layers.find((x) => x.id === init.id)
          if (!l || l.locked) continue
          const nextPos: Vec3 = [
            Math.round(modelPivot.x + (init.startPos[0] - modelPivot.x) * scaleRatio),
            Math.round(modelPivot.y + (init.startPos[1] - modelPivot.y) * scaleRatio),
            Math.round(-modelPivot.z + (init.startPos[2] - (-modelPivot.z)) * scaleRatio)
          ]
          setValueAt(l.transform.position, time, nextPos, frameTolerance(draft))
          const nextScale: Vec3 = [init.startScale[0] * scaleRatio, init.startScale[1] * scaleRatio, init.startScale[2] * scaleRatio]
          setValueAt(l.transform.scale, time, nextScale, frameTolerance(draft))
          if (l.model3d) l.model3d.globalScale = init.globalScale * scaleRatio
          if (l.type === 'solid' && init.baseSize) {
            l.props.width = Math.round(init.baseSize[0] * init.globalScale * scaleRatio)
            l.props.height = Math.round(init.baseSize[1] * init.globalScale * scaleRatio)
          }
        }
      }, key)
    }
  }

  function move(ev: PointerEvent): void {
    if (ev.pointerId !== pointerId) return
    const st = useEditor.getState()
    if (st.project !== lastProject || st.time !== time || st.selectedLayerId !== el.layer.id || st.playing) { finish(); return }
    if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 2 && !changed) return
    const curPt = point(ev)
    if (changed) useEditor.setState({ lastMerge: { key, at: performance.now() } })
    if (isModel3D) {
      moveModel(curPt, ev.shiftKey)
    } else {
      const next = solver?.solve(curPt, ev.shiftKey)
      if (!next) return
      st.update((draft) => {
        const layer = draft.layers.find((l) => l.id === el.layer.id)
        if (layer && !layer.locked && solver) setValueAt(layer.transform[solver.prop], time, next, frameTolerance(draft))
      }, key)
    }
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
