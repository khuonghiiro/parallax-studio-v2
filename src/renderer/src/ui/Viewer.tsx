import '../styles/workspaceCompact.css'
import { computeTaggedLayout, selectedViews } from './viewer/taggedLayout'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { flyToShot } from '../actions'
import { EditorCamera } from '../engine/EditorCamera'
import { evaluateScene } from '../engine/evaluateScene'
import { SceneRenderer, type ResidencyStats } from '../engine/SceneRenderer'
import { LAYER_COMPOSE_FRAG } from '../engine/renderTypes'
import { setLiveRenderer } from '../engine/liveRenderer'
import { assetStore } from '../project/assets'
import { useEditor } from '../store/editor'
import { useView } from '../store/view'
import { usePerformance } from '../store/performance'
import {
  CLEAR,
  EDITOR_KINDS,
  inRect,
  toDevice,
  worldBox,
  type Layout
} from './viewer/viewerLayout'
import { useViewerLabels } from './viewer/useViewerLabels'
import { useViewerDrag } from './viewer/useViewerDrag'
import { ViewerOverlays } from './viewer/ViewerOverlays'
import { LayerGizmo, type GizmoController, type GizmoFrame } from './viewer/LayerGizmo'
import { AnimateCameraStage } from './viewer/animateCamera/AnimateCameraStage'
import { TopView, useFocusShotId } from './TopView'

export { EDITOR_KINDS }

export function Viewer() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const gizmoRef = useRef<GizmoController | null>(null)
  const rendererRef = useRef<SceneRenderer | null>(null)
  const edCam = useRef(new EditorCamera()).current
  const needsFrame = useRef(true)
  const pendingFocus = useRef<THREE.Box3 | null>(null)
  const pendingShotFocal = useRef<THREE.Vector3 | null>(null)
  const layoutRef = useRef<Layout>({ dpr: 1, cam: null, ed: null, stage2d: null })
  const rafRef = useRef(0)
  const frameTimes = useRef<number[]>([])
  const [fps, setFps] = useState(0)
  const [stats, setStats] = useState<ResidencyStats | null>(null)
  const [rects, setRects] = useState<Layout>({ dpr: 1, cam: null, ed: null, stage2d: null })
  const comp = useEditor((s) => s.project.comp)
  const playing = useEditor((s) => s.playing)
  const view = useView()

  edCam.setKind(view.editorKind)
  const focusShotId = useFocusShotId()
  const hasWebGLPane = Boolean(rects.cam || rects.ed)

  const { updateLabels } = useViewerLabels(labelsRef)
  const { localXY, ndcIn, capture, startLayerDrag, startShotDrag, startCameraDrag } = useViewerDrag({
    canvasRef,
    rendererRef,
    layoutRef,
    edCam
  })

  const workflowPreviewActive = useRef(false)
  useEffect(() => {
    const onPreviewActivity = (event: Event) => {
      workflowPreviewActive.current = Boolean((event as CustomEvent<boolean>).detail)
      if (!workflowPreviewActive.current) requestRender()
    }
    window.addEventListener('pxs:workflow-preview-active', onPreviewActivity)
    return () => window.removeEventListener('pxs:workflow-preview-active', onPreviewActivity)
  }, [])

  // ---------------------------------------------------------------- render loop

  function requestRender(): void {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      draw()
    })
  }

  function draw(): void {
    if (workflowPreviewActive.current) return
    const r = rendererRef.current
    const L = layoutRef.current
    if (!r || (!L.cam && !L.ed)) return
    const s = useEditor.getState()
    if (!Number.isFinite(s.time)) {
      s.setTime(0)
    }
    if (!Number.isFinite(edCam.target.x) || !Number.isFinite(edCam.distance)) {
      edCam.target.set(0, 0, 0)
      edCam.distance = 1850
      needsFrame.current = true
    }
    const v = useView.getState()
    const gizmoFrames: GizmoFrame[] = []
    const clearCol = v.theme === 'light' ? '#e2e5eb' : CLEAR
    r.beginFrame(clearCol)
    if (L.cam) {
      r.render(s.project, s.time, {
        selectedId: s.playing ? null : s.selectedLayerId,
        viewport: toDevice(L.cam, L.dpr),
        prefetch: s.playing,
        playing: s.playing
      })
      gizmoFrames.push({ key: 'camera', camera: r.camera.clone(), rect: L.cam })
    }
    if (L.ed) {
      const aspect = L.ed.w / L.ed.h
      if (pendingShotFocal.current) {
        edCam.frameShotFocal(pendingShotFocal.current, s.project.comp.width, s.project.comp.height, aspect)
        pendingShotFocal.current = null
        pendingFocus.current = null
        needsFrame.current = false
      } else if (pendingFocus.current) {
        edCam.frame(pendingFocus.current, aspect)
        pendingFocus.current = null
        needsFrame.current = false
      } else if (needsFrame.current || (!edCam.touched && edCam.distance > 4000)) {
        needsFrame.current = false
        const evNow = evaluateScene(s.project, s.time)
        const activeShot =
          (s.selectedShotId ? evNow.shots.find((x) => x.shot.id === s.selectedShotId) : null) ??
          evNow.shots.find(
            (x) => Math.hypot(x.position[0] - evNow.camera.target[0], x.position[1] - evNow.camera.target[1]) < 1200
          ) ??
          evNow.shots[0]
        if (activeShot) {
          edCam.frameShotFocal(
            new THREE.Vector3(activeShot.position[0], activeShot.position[1], -activeShot.position[2]),
            s.project.comp.width,
            s.project.comp.height,
            aspect
          )
        } else {
          edCam.frame(worldBox(evNow), aspect)
        }
      }
      const labels = r.renderEditor(s.project, s.time, edCam.get(aspect), {
        viewport: toDevice(L.ed, L.dpr),
        selectedId: s.playing ? null : s.selectedLayerId,
        selectedShotId: s.selectedShotId,
        showPath: v.showPath,
        cameraOnly: v.cameraOnly,
        playing: s.playing,
        theme: v.theme
      })
      updateLabels(labels, L.ed, L.dpr, s.selectedShotId)
      gizmoFrames.push({ key: 'editor', camera: edCam.get(aspect).clone(), rect: L.ed })
    } else {
      updateLabels([], null, 1, null)
    }
    const now = performance.now()
    gizmoRef.current?.update(gizmoFrames)
    const ft = frameTimes.current
    ft.push(now)
    while (ft.length && now - ft[0] > 1000) ft.shift()
  }

  // ---------------------------------------------------------------- lifecycle

  useEffect(() => {
    const perf = usePerformance.getState()
    const r = new SceneRenderer(canvasRef.current!, { budgetMB: perf.budgetMB })
    r.maxAnisotropy = perf.maxAnisotropy
    r.maxTextureSize = perf.maxTextureSize
    rendererRef.current = r
    setLiveRenderer(r)
    r.onInvalidate = () => requestRender()
    const unsubStore = useEditor.subscribe((s, prev) => {
      if (s.epoch !== prev.epoch) needsFrame.current = true
      if (s.selectedLayerId !== prev.selectedLayerId && s.selectedLayerId) {
        applyFocus('layer', s.selectedLayerId)
      } else if (s.selectedShotId !== prev.selectedShotId && s.selectedShotId) {
        applyFocus('shot', s.selectedShotId)
      }
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
    const unsubPerf = usePerformance.subscribe((p, prev) => {
      if (
        p.budgetMB !== prev.budgetMB ||
        p.maxAnisotropy !== prev.maxAnisotropy ||
        p.maxTextureSize !== prev.maxTextureSize
      ) {
        r.budgetMB = p.budgetMB
        r.maxAnisotropy = p.maxAnisotropy
        r.maxTextureSize = p.maxTextureSize
        requestRender()
      }
    })
    // Tự động căn khung tiêu điểm 2.5D đồng bộ với Camera và Cam 2D
    applyFocus('shot', useEditor.getState().selectedShotId ?? useEditor.getState().project.shots[0]?.id)
    requestRender()
    return () => {
      unsubStore()
      unsubView()
      unsubAssets()
      unsubPerf()
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      r.dispose()
      setLiveRenderer(null)
      rendererRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SceneRenderer, LAYER_COMPOSE_FRAG])

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
      if (!Number.isFinite(s.time)) {
        s.setTime(0)
      }
      if (!Number.isFinite(edCam.target.x) || !Number.isFinite(edCam.distance)) {
        edCam.target.set(0, 0, 0)
        edCam.distance = 1850
        needsFrame.current = true
      }
      if (s.playing) return

      const hasAnimatedGif = s.project.layers.some((l) => {
        if (l.type !== 'image' || l.props.autoPlayPaused === false) return false
        const a = assetStore.get(l.props.assetId)
        return (a?.meta.isAnimated || a?.gif) && (a?.gif?.frames?.length ?? 0) > 1
      })

      if (!hasAnimatedGif) return

      if (now - lastRender >= 24) {
        lastRender = now
        requestRender()
      }
    }

    animId = requestAnimationFrame(checkAndLoop)
    return () => cancelAnimationFrame(animId)
  }, [edCam])

  // Size the canvas to the viewer and compute the view rectangles.
  useEffect(() => {
    const wrap = wrapRef.current!
    const fit = (): void => {
      const W = wrap.clientWidth
      const H = wrap.clientHeight
      const c = canvasRef.current!
      c.style.width = `${W}px`
      c.style.height = `${H}px`
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      rendererRef.current?.setSize(W * dpr, H * dpr)
      const toolbarHeight = (wrap.querySelector('.viewer-tools')?.getBoundingClientRect().height ?? 32) + 2
      const L = computeTaggedLayout(W, H, comp.width / comp.height, selectedViews(view), dpr, toolbarHeight)
      layoutRef.current = L
      setRects(L)
      requestRender()
    }
    const ro = new ResizeObserver(fit)
    ro.observe(wrap)
    const toolbar = wrap.querySelector('.viewer-tools')
    if (toolbar) ro.observe(toolbar)
    fit()
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp.width, comp.height, view.split, view.primary, view.animate2dSplit, view.activeViews])

  // F = frame selection in the 3D view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'f' || e.key === 'F') {
        useView.getState().requestFocus('selection')
        e.preventDefault()
      } else if (e.key === 'w' || e.key === 'W') {
        const v = useView.getState()
        v.set({ showTranslate: !v.showTranslate })
        e.preventDefault()
      } else if (e.key === 'e' || e.key === 'E') {
        const v = useView.getState()
        v.set({ showRotate: !v.showRotate })
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function applyFocus(kind: 'shot' | 'layer' | 'all' | 'selection', id?: string): void {
    const s = useEditor.getState()
    if (!Number.isFinite(s.time)) {
      s.setTime(0)
    }
    if (!Number.isFinite(edCam.target.x) || !Number.isFinite(edCam.distance)) {
      edCam.target.set(0, 0, 0)
      edCam.distance = 1850
      needsFrame.current = true
    }
    const ev = evaluateScene(s.project, s.time)
    let box: THREE.Box3 | null = null
    if (kind === 'selection') {
      if (s.selectedLayerId) {
        kind = 'layer'
        id = s.selectedLayerId
      } else if (s.selectedShotId) {
        kind = 'shot'
        id = s.selectedShotId
      } else {
        kind = 'shot'
        id = s.project.shots[0]?.id
      }
    }
    if (kind === 'shot' || kind === 'all') {
      const shotObj =
        (id ? ev.shots.find((x) => x.shot.id === id) : null) ??
        ev.shots.find(
          (x) => Math.hypot(x.position[0] - ev.camera.target[0], x.position[1] - ev.camera.target[1]) < 1200
        ) ??
        ev.shots[0]
      if (shotObj) {
        pendingShotFocal.current = new THREE.Vector3(
          shotObj.position[0],
          shotObj.position[1],
          -shotObj.position[2]
        )
        pendingFocus.current = null
        edCam.touched = true
        requestRender()
        return
      }
    }
    if (kind === 'layer' && id) {
      const targetLayer = s.project.layers.find((l) => l.id === id)
      const compInstId = targetLayer?.composite?.instanceId
      const modInstId = targetLayer?.model3d?.instanceId
      const unionBox = new THREE.Box3()
      for (const el of ev.layers) {
        if (
          el.layer.id === id ||
          (compInstId && el.layer.composite?.instanceId === compInstId) ||
          (modInstId && el.layer.model3d?.instanceId === modInstId)
        ) {
          if (!el.bounds.isEmpty()) unionBox.union(el.bounds)
        }
      }
      box = unionBox.isEmpty() ? null : unionBox
    }
    if (!box || box.isEmpty()) box = worldBox(ev)
    pendingFocus.current = box
    edCam.touched = true
    requestRender()
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

    if (e.button === 0) {
      const labelEl = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-shot]')
      if (labelEl?.dataset.shot) {
        const shotId = labelEl.dataset.shot
        st.selectLayer(null)
        st.selectShot(shotId)
        startShotDrag(e, shotId)
        return
      }

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

    if (e.button === 1) e.preventDefault()
    const orbit = e.button === 1 || (e.button === 0 && e.altKey)

    const doPan = !orbit
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
    const [nx, ny] = ndcIn(L.ed, x, y)
    edCam.zoom(e.deltaY, nx, ny, L.ed.w / Math.max(1, L.ed.h))
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

  return (
    <div className="viewer" ref={wrapRef}>
      <canvas
        id="viewer-canvas"
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
        style={{ display: hasWebGLPane ? 'block' : 'none' }}
      />
      {hasWebGLPane && (
        <LayerGizmo controller={gizmoRef} />
      )}
      {hasWebGLPane && (
        <div className="view-labels" ref={labelsRef} onPointerDown={onLabelPointerDown} onDoubleClick={onLabelDoubleClick} />
      )}

      {rects.depth && (
        <div className="viewer-depth-pane" data-mcp-region="viewer_depth"
          style={{ position: 'absolute', left: rects.depth.x, top: rects.depth.y,
            width: rects.depth.w, height: rects.depth.h, zIndex: 5, background: 'var(--bg-1)' }}>
          <TopView shotId={focusShotId} isExpanded={true} />
        </div>
      )}
      {rects.stage2d && (
        <div className="anim2d-pane-host" data-mcp-region="viewer_stage2d"
          style={{ position: 'absolute', left: rects.stage2d.x, top: rects.stage2d.y,
            width: rects.stage2d.w, height: rects.stage2d.h, zIndex: 8 }}>
          <AnimateCameraStage />
        </div>
      )}

      <ViewerOverlays
        view={view}
        playing={playing}
        fps={fps}
        stats={stats}
        rects={rects}
      />
    </div>
  )
}
