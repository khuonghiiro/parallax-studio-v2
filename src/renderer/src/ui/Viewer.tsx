import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { nanoid } from 'nanoid'
import type { Vec3 } from '@shared/types'
import { flyToShot } from '../actions'
import { evaluate, setValueAt } from '../animation/keyframes'
import { EditorCamera, type EditorViewKind } from '../engine/EditorCamera'
import { evaluateScene, type EvaluatedScene } from '../engine/evaluateScene'
import { SceneRenderer, type ResidencyStats, type Rect } from '../engine/SceneRenderer'
import type { ScreenLabel } from '../engine/editorHelpers'
import { setLiveRenderer } from '../engine/liveRenderer'
import { assetStore } from '../project/assets'
import { frameTolerance, useEditor } from '../store/editor'
import { useView } from '../store/view'
import { IconCamera, IconCube, IconEye, IconFocus, IconRoute, IconSingle, IconSplit } from './icons'

type Quality = 1 | 0.5

interface Layout {
  dpr: number
  /** CSS px, relative to the canvas. */
  cam: Rect | null
  ed: Rect | null
}

export const EDITOR_KINDS: { id: EditorViewKind; label: string }[] = [
  { id: 'custom', label: 'Tự do (orbit)' },
  { id: 'top', label: 'Top' },
  { id: 'front', label: 'Front' },
  { id: 'left', label: 'Left' }
]

const CLEAR = '#090a10'

function fitRect(area: Rect, aspect: number, pad: number): Rect {
  const W = Math.max(16, area.w - pad * 2)
  const H = Math.max(9, area.h - pad * 2)
  let w = W
  let h = W / aspect
  if (h > H) {
    h = H
    w = H * aspect
  }
  w = Math.floor(w)
  h = Math.floor(h)
  return { x: Math.round(area.x + (area.w - w) / 2), y: Math.round(area.y + (area.h - h) / 2), w, h }
}

const toDevice = (r: Rect, dpr: number): Rect => ({
  x: Math.round(r.x * dpr),
  y: Math.round(r.y * dpr),
  w: Math.max(2, Math.round(r.w * dpr)),
  h: Math.max(2, Math.round(r.h * dpr))
})

const inRect = (r: Rect | null, x: number, y: number): r is Rect => !!r && x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h

function worldBox(ev: EvaluatedScene): THREE.Box3 {
  const box = new THREE.Box3()
  for (const s of ev.shots) if (s.shot.visible) box.union(s.bounds)
  for (const l of ev.layers) if (!l.shot && l.active && l.layer.type !== 'particles') box.union(l.bounds)
  box.expandByPoint(new THREE.Vector3(ev.camera.position[0], ev.camera.position[1], -ev.camera.position[2]))
  return box
}

export function Viewer() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<SceneRenderer | null>(null)
  const edCam = useRef(new EditorCamera()).current
  const needsFrame = useRef(true)
  const pendingFocus = useRef<THREE.Box3 | null>(null)
  const layoutRef = useRef<Layout>({ dpr: 1, cam: null, ed: null })
  const rafRef = useRef(0)
  const frameTimes = useRef<number[]>([])
  const [quality, setQuality] = useState<Quality>(1)
  const [fps, setFps] = useState(0)
  const [stats, setStats] = useState<ResidencyStats | null>(null)
  const [rects, setRects] = useState<Layout>({ dpr: 1, cam: null, ed: null })
  const comp = useEditor((s) => s.project.comp)
  const cameraFov = useEditor((s) => s.project.camera.fov)
  const time = useEditor((s) => s.time)
  const playing = useEditor((s) => s.playing)
  const view = useView()

  edCam.setKind(view.editorKind)

  // ---------------------------------------------------------------- render loop

  function requestRender(): void {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      draw()
    })
  }

  function draw(): void {
    const r = rendererRef.current
    if (!r) return
    const s = useEditor.getState()
    const v = useView.getState()
    const L = layoutRef.current
    r.beginFrame(CLEAR)
    if (L.cam) {
      r.render(s.project, s.time, {
        selectedId: s.playing ? null : s.selectedLayerId,
        viewport: toDevice(L.cam, L.dpr),
        prefetch: s.playing,
        playing: s.playing
      })
    }
    if (L.ed) {
      const aspect = L.ed.w / L.ed.h
      if (pendingFocus.current) {
        edCam.frame(pendingFocus.current, aspect)
        pendingFocus.current = null
        needsFrame.current = false
      } else if (needsFrame.current) {
        needsFrame.current = false
        edCam.frame(worldBox(evaluateScene(s.project, s.time)), aspect)
      }
      const labels = r.renderEditor(s.project, s.time, edCam.get(aspect), {
        viewport: toDevice(L.ed, L.dpr),
        selectedId: s.playing ? null : s.selectedLayerId,
        selectedShotId: s.selectedShotId,
        showPath: v.showPath,
        cameraOnly: v.cameraOnly,
        playing: s.playing
      })
      updateLabels(labels, L.ed, L.dpr, s.selectedShotId)
    } else {
      updateLabels([], null, 1, null)
    }
    const now = performance.now()
    const ft = frameTimes.current
    ft.push(now)
    while (ft.length && now - ft[0] > 1000) ft.shift()
  }

  // ---------------------------------------------------------------- labels (imperative DOM)

  const labelEls = useRef(new Map<string, HTMLDivElement>()).current
  function updateLabels(labels: ScreenLabel[], ed: Rect | null, dpr: number, selectedShotId: string | null): void {
    const host = labelsRef.current
    if (!host) return
    const seen = new Set<string>()
    if (ed) {
      for (const l of labels) {
        const key = `${l.kind}:${l.id}`
        const x = ed.x + l.x / dpr
        const y = ed.y + l.y / dpr
        if (x < ed.x - 40 || x > ed.x + ed.w + 40 || y < ed.y - 20 || y > ed.y + ed.h + 20) continue
        seen.add(key)
        let el = labelEls.get(key)
        if (!el) {
          el = document.createElement('div')
          if (l.kind === 'shot') {
            el.className = 'v-label shot'
            el.dataset.shot = l.id
            el.title = 'Kéo để di chuyển cảnh trong không gian 3D (Shift: khóa trục, Alt: kéo chiều sâu Z)'
          } else if (l.kind === 'camera') {
            el.className = 'v-label cam'
            el.dataset.cam = 'pos'
            el.title = 'Kéo để dời Camera trong 3D · Click để cấu hình góc quay (Alt: kéo chiều sâu Z, Shift: khóa trục)'
          } else if (l.kind === 'cam-target') {
            el.className = 'v-label cam-target'
            el.dataset.cam = 'target'
            el.title = 'Kéo để dời điểm nhìn của Camera trong 3D (Alt: kéo chiều sâu Z, Shift: khóa trục)'
          }
          host.appendChild(el)
          labelEls.set(key, el)
        }
        if (el.textContent !== l.text) el.textContent = l.text
        el.style.transform = `translate(${x}px, ${y}px)`
        el.style.setProperty('--c', l.color)
        el.classList.toggle('selected', l.kind === 'shot' && l.id === selectedShotId)
      }
    }
    for (const [key, el] of labelEls) {
      if (!seen.has(key)) {
        el.remove()
        labelEls.delete(key)
      }
    }
  }

  // ---------------------------------------------------------------- lifecycle

  useEffect(() => {
    const r = new SceneRenderer(canvasRef.current!)
    rendererRef.current = r
    setLiveRenderer(r)
    r.onInvalidate = () => requestRender()
    const unsubStore = useEditor.subscribe((s, prev) => {
      if (s.epoch !== prev.epoch) needsFrame.current = true
      if (
        s.project !== prev.project ||
        s.time !== prev.time ||
        s.selectedLayerId !== prev.selectedLayerId ||
        s.selectedShotId !== prev.selectedShotId ||
        s.playing !== prev.playing
      )
        requestRender()
    })
    const unsubView = useView.subscribe((v, prev) => {
      if (v.focus !== prev.focus && v.focus) applyFocus(v.focus.kind, v.focus.id)
      requestRender()
    })
    const unsubAssets = assetStore.subscribe(() => requestRender())
    requestRender()
    return () => {
      unsubStore()
      unsubView()
      unsubAssets()
      cancelAnimationFrame(rafRef.current)
      r.dispose()
      setLiveRenderer(null)
      rendererRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      setFps(frameTimes.current.length)
      const r = rendererRef.current
      if (r) setStats(r.stats())
    }, 500)
    return () => window.clearInterval(id)
  }, [])

  // Live viewport animation loop for animated GIFs & continuous preview when paused
  useEffect(() => {
    let animId = 0
    let lastRender = 0

    const checkAndLoop = (now: number): void => {
      animId = requestAnimationFrame(checkAndLoop)

      const s = useEditor.getState()
      if (s.playing) return

      // Check if project has any animated GIF layers with autoPlay enabled
      const hasAnimatedGif = s.project.layers.some((l) => {
        if (l.type !== 'image' || l.props.autoPlayPaused === false) return false
        const a = assetStore.get(l.props.assetId)
        return (a?.meta.isAnimated || a?.gif) && (a?.gif?.frames?.length ?? 0) > 1
      })

      if (!hasAnimatedGif) return

      // Smooth ~30-40 fps rendering
      if (now - lastRender >= 24) {
        lastRender = now
        requestRender()
      }
    }

    animId = requestAnimationFrame(checkAndLoop)
    return () => cancelAnimationFrame(animId)
  }, [])

  // Size the canvas to the viewer and compute the view rectangles.
  useEffect(() => {
    const wrap = wrapRef.current!
    const fit = (): void => {
      const W = wrap.clientWidth
      const H = wrap.clientHeight
      const c = canvasRef.current!
      c.style.width = `${W}px`
      c.style.height = `${H}px`
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * quality
      rendererRef.current?.setSize(W * dpr, H * dpr)
      const aspect = comp.width / comp.height
      let cam: Rect | null = null
      let ed: Rect | null = null
      if (view.split) {
        const half = Math.floor(W / 2)
        cam = fitRect({ x: 0, y: 0, w: half - 1, h: H }, aspect, 18)
        ed = { x: half + 1, y: 0, w: W - half - 1, h: H }
      } else if (view.primary === 'camera') {
        cam = fitRect({ x: 0, y: 0, w: W, h: H }, aspect, 28)
      } else {
        ed = { x: 0, y: 0, w: W, h: H }
      }
      const L = { dpr, cam, ed }
      layoutRef.current = L
      setRects(L)
      requestRender()
    }
    const ro = new ResizeObserver(fit)
    ro.observe(wrap)
    fit()
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp.width, comp.height, quality, view.split, view.primary])

  // F = frame selection in the 3D view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'f' || e.key === 'F') {
        useView.getState().requestFocus('selection')
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function applyFocus(kind: 'shot' | 'layer' | 'all' | 'selection', id?: string): void {
    const s = useEditor.getState()
    const ev = evaluateScene(s.project, s.time)
    let box: THREE.Box3 | null = null
    if (kind === 'selection') {
      if (s.selectedLayerId) {
        kind = 'layer'
        id = s.selectedLayerId
      } else if (s.selectedShotId) {
        kind = 'shot'
        id = s.selectedShotId
      } else kind = 'all'
    }
    if (kind === 'layer') box = ev.layers.find((l) => l.layer.id === id)?.bounds.clone() ?? null
    else if (kind === 'shot') box = ev.shots.find((x) => x.shot.id === id)?.bounds.clone() ?? null
    if (!box || box.isEmpty()) box = worldBox(ev)
    // The layout may still be switching to the 3D view: frame on the next draw that has it.
    pendingFocus.current = box
    edCam.touched = true
    requestRender()
  }

  // ---------------------------------------------------------------- interaction helpers

  const localXY = (e: { clientX: number; clientY: number }): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return [e.clientX - rect.left, e.clientY - rect.top]
  }
  const ndcIn = (r: Rect, x: number, y: number): [number, number] => [((x - r.x) / r.w) * 2 - 1, -((y - r.y) / r.h) * 2 + 1]

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
    const start = [...el.position] as Vec3
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
    capture(e, (pev, _dx, dy) => {
      let next: Vec3
      if (pev.altKey) {
        next = [start[0], start[1], Math.round(start[2] - dy * depthPerPx)]
      } else {
        const [x, y] = localXY(pev)
        const hit = r.rayAt(...ndcIn(rect, x, y), cam).intersectPlane(plane, new THREE.Vector3())
        if (!hit) return
        const d = hit.sub(hit0).applyQuaternion(inv)
        next = [Math.round(start[0] + d.x), Math.round(start[1] + d.y), Math.round(start[2] - d.z)]
        if (pev.shiftKey) {
          const deltas = [0, 1, 2].map((i) => Math.abs(next[i] - start[i]))
          const keep = deltas.indexOf(Math.max(...deltas))
          for (let i = 0; i < 3; i++) if (i !== keep) next[i] = start[i]
        }
      }
      const st = useEditor.getState()
      st.update((dr) => {
        const l = dr.layers.find((x) => x.id === id)
        if (l) setValueAt(l.transform.position, st.time, next, frameTolerance(st.project))
      }, key)
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

  // ---------------------------------------------------------------- pointer handlers

  const onPointerDown = (e: React.PointerEvent): void => {
    const r = rendererRef.current
    if (!r) return
    const st = useEditor.getState()
    const L = layoutRef.current
    const [x, y] = localXY(e)

    if (inRect(L.cam, x, y)) {
      if (e.button !== 0) return
      if (st.playing) st.setPlaying(false)
      const [nx, ny] = ndcIn(L.cam, x, y)
      r.layoutForPick(st.project, st.time, toDevice(L.cam, L.dpr).h)
      const id = r.pick(nx, ny, st.project)
      st.selectLayer(id)
      if (id) startLayerDrag(e, id, r.camera, L.cam, 'depth')
      return
    }

    if (!inRect(L.ed, x, y)) return
    const ed = L.ed
    const aspect = ed.w / ed.h
    const cam = edCam.get(aspect)

    // Left mouse button interactions
    if (e.button === 0) {
      // 1. Check if clicking on or near any shot label/header first!
      // This prevents accidentally selecting a background layer when trying to move a shot.
      const labelEl = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-shot]')
      if (labelEl?.dataset.shot) {
        const shotId = labelEl.dataset.shot
        st.selectLayer(null)
        st.selectShot(shotId)
        startShotDrag(e, shotId)
        return
      }

      // Proximity check: if clicking within 36px of the shot's top header anchor, prioritize shot dragging
      const ev = evaluateScene(st.project, st.time)
      const tmpV = new THREE.Vector3()
      for (const s of ev.shots) {
        if (!s.shot.visible || s.bounds.isEmpty()) continue
        const b = s.bounds
        tmpV.set((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2).project(cam)
        if (tmpV.z >= -1 && tmpV.z <= 1) {
          const sx = ed.x + ((tmpV.x + 1) / 2) * ed.w
          const sy = ed.y + ((1 - tmpV.y) / 2) * ed.h - 14
          if (Math.hypot(x - sx, y - sy) <= 36) {
            st.selectLayer(null)
            st.selectShot(s.shot.id)
            startShotDrag(e, s.shot.id)
            return
          }
        }
      }

      // 2. Check if clicking on any layer with left mouse button
      const [nx, ny] = ndcIn(ed, x, y)
      r.layoutForPick(st.project, st.time, toDevice(ed, L.dpr).h, cam)
      const id = r.pick(nx, ny, st.project, cam, false)
      if (id) {
        if (st.playing) st.setPlaying(false)
        st.selectLayer(id)
        startLayerDrag(e, id, cam, ed, 'facing')
        return
      }
    }

    const pan = e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)
    const orbit = e.button === 0 && e.altKey

    // Empty space: orbit (perspective) or pan (orthographic views); click selects a shot.
    const doPan = pan || (!orbit && edCam.isOrtho)
    let lastX = e.clientX
    let lastY = e.clientY
    capture(
      e,
      (pev) => {
        const dx = pev.clientX - lastX
        const dy = pev.clientY - lastY
        lastX = pev.clientX
        lastY = pev.clientY
        if (doPan) edCam.pan(dx, dy, ed.h, aspect)
        else {
          edCam.orbit(dx, dy)
          if (useView.getState().editorKind !== edCam.kind) useView.getState().set({ editorKind: edCam.kind })
        }
        requestRender()
      },
      (moved) => {
        if (moved || e.button !== 0) return
        const [nx, ny] = ndcIn(ed, x, y)
        const shotId = r.pickShot(nx, ny, cam)
        if (shotId) st.selectShot(shotId)
        else {
          st.selectLayer(null)
          st.selectShot(null)
        }
      }
    )
  }

  const onWheel = (e: React.WheelEvent): void => {
    const L = layoutRef.current
    const [x, y] = localXY(e)
    if (!inRect(L.ed, x, y)) return
    edCam.zoom(e.deltaY)
    requestRender()
  }

  const onDoubleClick = (e: React.MouseEvent): void => {
    const r = rendererRef.current
    const L = layoutRef.current
    const [x, y] = localXY(e)
    if (!r || !inRect(L.ed, x, y)) return
    const ed = L.ed
    const cam = edCam.get(ed.w / ed.h)
    const [nx, ny] = ndcIn(ed, x, y)
    const st = useEditor.getState()
    const layerId = r.pick(nx, ny, st.project, cam, false)
    const shotId = (layerId && st.project.layers.find((l) => l.id === layerId)?.shotId) || r.pickShot(nx, ny, cam)
    if (shotId) flyToShot(shotId)
  }

  const onLabelPointerDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) return
    const shotEl = (e.target as HTMLElement).closest<HTMLElement>('[data-shot]')
    if (shotEl?.dataset.shot) {
      e.stopPropagation()
      e.preventDefault()
      const id = shotEl.dataset.shot
      const st = useEditor.getState()
      st.selectLayer(null)
      st.selectShot(id)
      startShotDrag(e, id)
      return
    }
    const camEl = (e.target as HTMLElement).closest<HTMLElement>('[data-cam]')
    if (camEl?.dataset.cam) {
      e.stopPropagation()
      e.preventDefault()
      const mode = camEl.dataset.cam as 'pos' | 'target'
      const st = useEditor.getState()
      st.setInspectorTab('camera')
      startCameraDrag(e, mode)
      return
    }
  }

  const onLabelDoubleClick = (e: React.MouseEvent): void => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-shot]')
    if (el?.dataset.shot) flyToShot(el.dataset.shot)
  }

  // ---------------------------------------------------------------- UI

  const fov = evaluate(cameraFov, time)
  const showEd = !!rects.ed
  const kindLabel = EDITOR_KINDS.find((k) => k.id === view.editorKind)?.label ?? ''

  return (
    <div className="viewer" ref={wrapRef}>
      <canvas
        id="viewer-canvas"
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />
      {rects.cam && (
        <div
          id="camera-frame"
          className="camera-frame"
          style={{ left: rects.cam.x, top: rects.cam.y, width: rects.cam.w, height: rects.cam.h }}
        />
      )}
      {view.split && rects.ed && (
        <div className="pane-divider" style={{ left: rects.ed.x - 1 }} />
      )}
      <div className="view-labels" ref={labelsRef} onPointerDown={onLabelPointerDown} onDoubleClick={onLabelDoubleClick} />

      <div className="viewer-hud">
        <span className="chip">
          <span className="dot" /> {playing ? `${fps} fps` : 'Sẵn sàng'}
        </span>
        <span className="chip">
          {comp.width}×{comp.height} · {comp.fps}p
        </span>
        {rects.cam && <span className="chip">FOV {fov.toFixed(1)}°</span>}
        {stats && (
          <span
            id="memory-chip"
            className={`chip mem${stats.textureMB > stats.budgetMB * 0.85 ? ' warn' : ''}`}
            title={`Texture GPU đang giữ: ${stats.textures} (${stats.pending} đang giải mã)\nNgân sách VRAM: ${stats.budgetMB} MB · LOD bias ${stats.lodBias}\nLayer đang vẽ trong camera: ${stats.visibleLayers}/${stats.totalLayers}\nChỉ cảnh nằm trong khung camera mới được nạp & render.`}
          >
            VRAM {stats.textureMB.toFixed(0)}/{stats.budgetMB} MB · {stats.textures} tex
            {stats.totalShots > 0 && ` · cảnh ${stats.visibleShots}/${stats.totalShots}`}
          </span>
        )}
      </div>

      {view.split && rects.cam && (
        <span className="chip pane-tag" style={{ left: rects.cam.x + 8, top: rects.cam.y + rects.cam.h - 30 }}>
          <IconCamera /> Camera
        </span>
      )}
      {showEd && (
        <span className="chip pane-tag" style={{ left: rects.ed!.x + 12, top: rects.ed!.y + rects.ed!.h - 32 }}>
          <IconCube /> 3D · {kindLabel}
          <span className="pane-hint">Kéo: xoay · Shift/chuột phải: pan · Lăn: zoom · F: focus · Double-click cảnh: bay tới</span>
        </span>
      )}

      <div className="viewer-tools">
        {!view.split && (
          <div className="seg">
            <button
              id="view-camera"
              className={`btn sm${view.primary === 'camera' ? ' active' : ''}`}
              title="Góc nhìn camera (kết quả render)"
              onClick={() => view.set({ primary: 'camera' })}
            >
              <IconCamera /> Camera
            </button>
            <button
              id="view-3d"
              className={`btn sm${view.primary === 'editor' ? ' active' : ''}`}
              title="Không gian 3D: xem các layer xếp chồng, các cảnh và đường bay camera"
              onClick={() => view.set({ primary: 'editor' })}
            >
              <IconCube /> 3D
            </button>
          </div>
        )}
        {showEd && (
          <select
            id="view-kind"
            className="select sm"
            value={view.editorKind}
            onChange={(e) => view.set({ editorKind: e.target.value as EditorViewKind })}
            title="Kiểu nhìn 3D"
          >
            {EDITOR_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        )}
        {showEd && (
          <>
            <button
              id="view-path"
              className={`btn sm icon${view.showPath ? ' active' : ''}`}
              title="Hiện đường bay camera"
              onClick={() => view.set({ showPath: !view.showPath })}
            >
              <IconRoute />
            </button>
            <button
              id="view-camera-only"
              className={`btn sm icon${view.cameraOnly ? ' active' : ''}`}
              title="Chỉ hiện nội dung camera đang thấy (xem trước cơ chế streaming — cảnh ngoài khung chỉ là khung viền)"
              onClick={() => view.set({ cameraOnly: !view.cameraOnly })}
            >
              <IconEye />
            </button>
            <button id="view-focus" className="btn sm icon" title="Focus vùng chọn (F)" onClick={() => useView.getState().requestFocus('selection')}>
              <IconFocus />
            </button>
          </>
        )}
        <button
          id="view-split"
          className={`btn sm icon${view.split ? ' active' : ''}`}
          title={view.split ? '1 view' : '2 view: Camera + 3D'}
          onClick={() => view.set({ split: !view.split })}
        >
          {view.split ? <IconSingle /> : <IconSplit />}
        </button>
        <button id="quality-toggle" className="btn sm" title="Chất lượng preview" onClick={() => setQuality((q) => (q === 1 ? 0.5 : 1))}>
          {quality === 1 ? 'Full' : 'Half'}
        </button>
      </div>
    </div>
  )
}
