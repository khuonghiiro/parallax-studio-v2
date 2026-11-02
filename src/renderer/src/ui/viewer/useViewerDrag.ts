import * as THREE from 'three'
import { nanoid } from 'nanoid'
import type { Vec3 } from '@shared/types'
import { evaluate, setValueAt } from '../../animation/keyframes'
import { evaluateScene } from '../../engine/evaluateScene'
import type { EditorCamera } from '../../engine/EditorCamera'
import type { SceneRenderer, Rect } from '../../engine/SceneRenderer'
import { preserveWorkflowV2CacheForLiveDrag } from '../../project/workflowV2Engine'
import { frameTolerance, useEditor } from '../../store/editor'
import type { Layout } from './viewerLayout'

export function useViewerDrag({
  canvasRef,
  rendererRef,
  layoutRef,
  edCam
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  rendererRef: React.RefObject<SceneRenderer | null>
  layoutRef: React.RefObject<Layout>
  edCam: EditorCamera
}) {
  const localXY = (e: { clientX: number; clientY: number }): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return [e.clientX - rect.left, e.clientY - rect.top]
  }

  const ndcIn = (r: Rect, x: number, y: number): [number, number] => [
    ((x - r.x) / r.w) * 2 - 1,
    -((y - r.y) / r.h) * 2 + 1
  ]

  /** Generic drag using window listeners so mouse movement & release are never lost. */
  function capture(
    e: React.PointerEvent,
    move: (ev: PointerEvent, dx: number, dy: number) => void,
    up?: (moved: boolean, ev: PointerEvent) => void
  ): void {
    const target = (e.target as HTMLElement) ?? (e.currentTarget as HTMLElement)
    try {
      if (target?.setPointerCapture) target.setPointerCapture(e.pointerId)
    } catch {
      /* ignore if pointer capture fails */
    }
    const sx = e.clientX
    const sy = e.clientY
    let moved = false
    const onMove = (ev: PointerEvent): void => {
      const dx = ev.clientX - sx
      const dy = ev.clientY - sy
      if (!moved && Math.hypot(dx, dy) > 2) moved = true
      if (moved) move(ev, dx, dy)
    }
    const onUp = (ev: PointerEvent): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      try {
        if (target?.hasPointerCapture?.(e.pointerId)) {
          target.releasePointerCapture(e.pointerId)
        }
      } catch {
        /* ignore */
      }
      up?.(moved, ev)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  /** Drag a layer in a plane; converts the world delta into the layer's local (shot) space. */
  function startLayerDrag(
    e: React.PointerEvent,
    id: string,
    cam: THREE.Camera,
    rect: Rect,
    planeMode: 'depth' | 'facing'
  ): void {
    const r = rendererRef.current!
    const s = useEditor.getState()
    const ev = evaluateScene(s.project, s.time)
    const el = ev.layers.find((l) => l.layer.id === id)
    if (!el || el.layer.locked) return
    const compRef = el.layer.composite
    const isCompLocked = !!compRef?.lockedGroup
    const modelInstanceId = el.layer.model3d?.instanceId
    const compInstanceId = isCompLocked ? compRef?.instanceId : undefined

    const related = modelInstanceId
      ? ev.layers.filter((l) => l.layer.model3d?.instanceId === modelInstanceId)
      : compInstanceId
        ? ev.layers.filter((l) => l.layer.composite?.instanceId === compInstanceId)
        : [el]
    const initialLayers = related.map((l) => ({
      id: l.layer.id,
      start: [...l.position] as Vec3,
      startValue: [...l.layer.transform.position.value] as Vec3,
      startKeyframes: l.layer.transform.position.keyframes.map((k) => [...k.value] as Vec3),
      hasRigOrGroupKeys:
        l.layer.transform.position.keyframes.length > 1 &&
        (related.length > 1 || l.layer.transform.position.keyframes.some((k) => k.id.includes('-rig-'))),
      center: l.layer.model3d?.centerPosition
        ? [...l.layer.model3d.centerPosition] as Vec3
        : l.layer.composite?.centerPosition
          ? [...l.layer.composite.centerPosition] as Vec3
          : undefined
    }))

    const p0 = new THREE.Vector3().setFromMatrixPosition(el.world)
    const shotQ = new THREE.Quaternion()
    if (el.shot) shotQ.setFromRotationMatrix(el.shot.matrix)
    const inv = shotQ.clone().invert()
    const camDir = cam.getWorldDirection(new THREE.Vector3())
    let normal = planeMode === 'depth' ? new THREE.Vector3(0, 0, 1).applyQuaternion(shotQ) : camDir.clone()
    if (Math.abs(normal.dot(camDir)) < 0.15) normal = camDir.clone()
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, p0)
    const [x0, y0] = localXY(e)
    const hit0 = r.rayAt(...ndcIn(rect, x0, y0), cam).intersectPlane(plane, new THREE.Vector3())
    if (!hit0) return
    const key = `drag-${nanoid(6)}`
    const depthPerPx = planeMode === 'depth' ? 6 : Math.max(2, edCam.distance * 0.003)
    const initById = new Map(initialLayers.map((x) => [x.id, x]))
    const useFastDirectUpdate = initialLayers.some((x) => x.hasRigOrGroupKeys)
    const initialProjectSnapshot = s.project
    let pushedHistory = false
    capture(e, (pev, _dx, dy) => {
      let delta: Vec3
      if (pev.altKey) {
        delta = [0, 0, Math.round(-dy * depthPerPx)]
      } else {
        const [x, y] = localXY(pev)
        const hit = r.rayAt(...ndcIn(rect, x, y), cam).intersectPlane(plane, new THREE.Vector3())
        if (!hit) return
        const d = hit.sub(hit0).applyQuaternion(inv)
        delta = [Math.round(d.x), Math.round(d.y), Math.round(-d.z)]
        if (pev.shiftKey) {
          const deltas = [0, 1, 2].map((i) => Math.abs(delta[i]))
          const keep = deltas.indexOf(Math.max(...deltas))
          for (let i = 0; i < 3; i++) if (i !== keep) delta[i] = 0
        }
      }
      const st = useEditor.getState()
      const prevProject = st.project
      if (useFastDirectUpdate) {
        const nextLayers = prevProject.layers.map((l) => {
          const init = initById.get(l.id)
          if (!init || l.locked) return l
          const nextValue: Vec3 = init.hasRigOrGroupKeys
            ? [init.startValue[0] + delta[0], init.startValue[1] + delta[1], init.startValue[2] + delta[2]]
            : [init.start[0] + delta[0], init.start[1] + delta[1], init.start[2] + delta[2]]
          const nextKeyframes =
            init.hasRigOrGroupKeys && l.transform.position.keyframes.length === init.startKeyframes.length
              ? l.transform.position.keyframes.map((kf, idx) => {
                  const kv = init.startKeyframes[idx]
                  return {
                    ...kf,
                    value: [kv[0] + delta[0], kv[1] + delta[1], kv[2] + delta[2]] as Vec3
                  }
                })
              : l.transform.position.keyframes
          const nextCenter: Vec3 | undefined = init.center
            ? [init.center[0] + delta[0], init.center[1] + delta[1], init.center[2] + delta[2]]
            : undefined
          return {
            ...l,
            transform: {
              ...l.transform,
              position: {
                ...l.transform.position,
                value: nextValue,
                keyframes: nextKeyframes
              }
            },
            ...(l.model3d && nextCenter ? { model3d: { ...l.model3d, centerPosition: nextCenter } } : {}),
            ...(l.composite && nextCenter ? { composite: { ...l.composite, centerPosition: nextCenter } } : {})
          }
        })
        const nextProject = { ...prevProject, layers: nextLayers }
        preserveWorkflowV2CacheForLiveDrag(prevProject, nextProject)
        const now = performance.now()
        useEditor.setState({
          project: nextProject,
          past: pushedHistory ? st.past : [...st.past.slice(-49), initialProjectSnapshot],
          future: [],
          dirty: true,
          lastMerge: { key, at: now }
        })
        pushedHistory = true
        return
      }
      st.update((dr) => {
        for (const init of initialLayers) {
          const l = dr.layers.find((x) => x.id === init.id)
          if (!l || l.locked) continue
          const next: Vec3 = [
            init.start[0] + delta[0],
            init.start[1] + delta[1],
            init.start[2] + delta[2]
          ]
          setValueAt(l.transform.position, st.time, next, frameTolerance(st.project))
          if (l.model3d && init.center) {
            l.model3d.centerPosition = [
              init.center[0] + delta[0],
              init.center[1] + delta[1],
              init.center[2] + delta[2]
            ]
          }
          if (l.composite && init.center) {
            l.composite.centerPosition = [
              init.center[0] + delta[0],
              init.center[1] + delta[1],
              init.center[2] + delta[2]
            ]
          }
        }
      }, key)
      preserveWorkflowV2CacheForLiveDrag(prevProject, useEditor.getState().project)
    })
  }

  /** Drag a whole shot (world position) in a plane facing the editor camera. */
  function startShotDrag(e: React.PointerEvent, shotId: string): void {
    const r = rendererRef.current
    const ed = layoutRef.current.ed
    if (!r || !ed) return
    const s = useEditor.getState()
    const shot = s.project.shots.find((x) => x.id === shotId)
    if (!shot) return
    const start = [...evaluate(shot.position, s.time)] as Vec3
    const cam = edCam.get(ed.w / ed.h)
    const p0 = new THREE.Vector3(start[0], start[1], -start[2])
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cam.getWorldDirection(new THREE.Vector3()), p0)
    const [x0, y0] = localXY(e)
    let hit0 = r.rayAt(...ndcIn(ed, x0, y0), cam).intersectPlane(plane, new THREE.Vector3())
    if (!hit0) hit0 = p0.clone()
    const key = `shotdrag-${nanoid(6)}`
    capture(
      e,
      (pev) => {
        const [x, y] = localXY(pev)
        const hit = r.rayAt(...ndcIn(ed, x, y), cam).intersectPlane(plane, new THREE.Vector3())
        if (!hit) return
        const d = hit.sub(hit0!)
        let next: Vec3
        if (pev.altKey) {
          // Alt: drag in depth (Z axis)
          const depthPerPx = Math.max(2, edCam.distance * 0.003)
          next = [start[0], start[1], Math.round(start[2] - (pev.clientY - e.clientY) * depthPerPx)]
        } else {
          next = [Math.round(start[0] + d.x), Math.round(start[1] + d.y), Math.round(start[2] - d.z)]
          if (pev.shiftKey) {
            // Shift: lock to predominant axis (X, Y, or Z)
            const deltas = [0, 1, 2].map((i) => Math.abs(next[i] - start[i]))
            const keep = deltas.indexOf(Math.max(...deltas))
            for (let i = 0; i < 3; i++) if (i !== keep) next[i] = start[i]
          }
        }
        const st = useEditor.getState()
        st.update((dr) => {
          const sh = dr.shots.find((x) => x.id === shotId)
          if (sh) setValueAt(sh.position, st.time, next, frameTolerance(st.project))
        }, key)
      },
      () => undefined
    )
  }

  /** Drag camera position or target in a plane facing the editor camera. */
  function startCameraDrag(e: React.PointerEvent, mode: 'pos' | 'target'): void {
    const r = rendererRef.current
    const ed = layoutRef.current.ed
    if (!r || !ed) return
    const s = useEditor.getState()
    const isPos = mode === 'pos'
    const prop = isPos ? s.project.camera.position : s.project.camera.target
    const start = [...evaluate(prop, s.time)] as Vec3
    const cam = edCam.get(ed.w / ed.h)
    const p0 = new THREE.Vector3(start[0], start[1], -start[2])
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cam.getWorldDirection(new THREE.Vector3()), p0)
    const [x0, y0] = localXY(e)
    let hit0 = r.rayAt(...ndcIn(ed, x0, y0), cam).intersectPlane(plane, new THREE.Vector3())
    if (!hit0) hit0 = p0.clone()
    const key = `camdrag-${nanoid(6)}`
    capture(
      e,
      (pev) => {
        const [x, y] = localXY(pev)
        const hit = r.rayAt(...ndcIn(ed, x, y), cam).intersectPlane(plane, new THREE.Vector3())
        if (!hit) return
        const d = hit.sub(hit0!)
        let next: Vec3
        if (pev.altKey) {
          const depthPerPx = Math.max(2, edCam.distance * 0.003)
          next = [start[0], start[1], Math.round(start[2] - (pev.clientY - e.clientY) * depthPerPx)]
        } else {
          next = [Math.round(start[0] + d.x), Math.round(start[1] + d.y), Math.round(start[2] - d.z)]
          if (pev.shiftKey) {
            const deltas = [0, 1, 2].map((i) => Math.abs(next[i] - start[i]))
            const keep = deltas.indexOf(Math.max(...deltas))
            for (let i = 0; i < 3; i++) if (i !== keep) next[i] = start[i]
          }
        }
        const st = useEditor.getState()
        st.update((dr) => {
          if (isPos) {
            setValueAt(dr.camera.position, st.time, next, frameTolerance(st.project))
            const tg = evaluate(dr.camera.target, st.time)
            const dist = Math.hypot(next[0] - tg[0], next[1] - tg[1], next[2] - tg[2])
            setValueAt(dr.camera.focusDistance, st.time, Math.round(dist), frameTolerance(st.project))
          } else {
            setValueAt(dr.camera.target, st.time, next, frameTolerance(st.project))
            const cp = evaluate(dr.camera.position, st.time)
            const dist = Math.hypot(cp[0] - next[0], cp[1] - next[1], cp[2] - next[2])
            setValueAt(dr.camera.focusDistance, st.time, Math.round(dist), frameTolerance(st.project))
          }
        }, key)
      },
      () => undefined
    )
  }

  return {
    localXY,
    ndcIn,
    capture,
    startLayerDrag,
    startShotDrag,
    startCameraDrag
  }
}
