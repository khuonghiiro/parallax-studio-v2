import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../../../actions'
import { evaluateScene } from '../../../engine/evaluateScene'
import { assetStore } from '../../../project/assets'
import { frameTolerance, useEditor } from '../../../store/editor'
import { useView } from '../../../store/view'
import {
  AnimateCameraProFooterBar,
  AnimateCameraVerticalFilmstrip
} from './AnimateCameraFilmstrip'
import { AnimateCameraToolbar } from './AnimateCameraToolbar'
import { AnimateShotPlane2D } from './AnimateShotPlane2D'
import {
  AnimateCameraViewfinder,
  type BubbleStageOffset,
  type StageToolMode
} from './AnimateCameraViewfinder'
import type { CameraLineStyle } from './animateCameraEdgePaths'
import {
  computeShotStageLayout,
  evaluateLiveCameraFrame2D,
  extractCameraFrames2D,
  findNearestShotByStage2D,
  projectShotLayers2D,
  type CameraFrame2D,
  type ProjectedLayer2D,
  type ShotStageBox
} from './animateCameraMath'
import {
  alignWaypointInShot,
  appendShotCameraWaypoint,
  applyWaypointActionMode,
  enrichCameraWaypoints,
  ensureShotWaypointTime,
  findActiveWaypointIndexAtTime,
  panCameraToLayer2D,
  panCameraToShot,
  removeCameraWaypoint,
  spawnNextCameraWaypoint,
  updateCameraWaypoint,
  type CameraActionMode,
  type CameraWaypointItem
} from './animateCameraRouteLogic'
import { useCameraStageDrag } from './useCameraStageDrag'

interface AnimateCameraStageProps {
  splitLeftWidth?: number
}

export function AnimateCameraStage({ splitLeftWidth = 0 }: AnimateCameraStageProps) {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const playing = useEditor((s) => s.playing)
  const selectedShotId = useEditor((s) => s.selectedShotId)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)
  const setTime = useEditor((s) => s.setTime)
  const setPlaying = useEditor((s) => s.setPlaying)
  const selectShot = useEditor((s) => s.selectShot)
  const selectLayer = useEditor((s) => s.selectLayer)
  const update = useEditor((s) => s.update)
  const inspectorTab = useEditor((s) => s.inspectorTab)
  const theme = useView((s) => s.theme)
  const animate2dSplit = useView((s) => s.animate2dSplit)
  const setView = useView((s) => s.set)

  const stageRef = useRef<HTMLDivElement>(null)
  const [viewportSize, setViewportSize] = useState({ w: 680, h: 480 })
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(0.28)
  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)
  panRef.current = pan
  zoomRef.current = zoom
  const [autoFitted, setAutoFitted] = useState(false)
  const [toolMode, setToolMode] = useState<StageToolMode>('pan-scale')
  const [lineStyle, setLineStyle] = useState<CameraLineStyle>('smoothstep')
  const [showFilmstripPreview, setShowFilmstripPreview] = useState<boolean>(true)
  const [bubbleOffsets, setBubbleOffsets] = useState<Record<number, BubbleStageOffset>>({})
  const [showAllFrames, setShowAllFrames] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [snapGuide, setSnapGuide] = useState<{ x: number | null; y: number | null }>({ x: null, y: null })
  const [, setAssetTick] = useState(0)

  useEffect(() => {
    return assetStore.subscribe(() => setAssetTick((n) => !n ? 1 : n + 1))
  }, [])

  const hasAnimatedShots = useMemo(
    () => project.shots.some((s) => s.position.keyframes.length > 0),
    [project.shots]
  )
  const layoutTime = hasAnimatedShots ? time : 0
  const stageLayout = useMemo(
    () => computeShotStageLayout(project, layoutTime),
    [project, layoutTime]
  )
  const frames = useMemo(() => extractCameraFrames2D(project, stageLayout), [project, stageLayout])
  const waypoints = useMemo(() => enrichCameraWaypoints(frames), [frames])
  const liveFrame = useMemo(
    () => evaluateLiveCameraFrame2D(project, stageLayout, frames, time),
    [project, stageLayout, frames, time]
  )

  const tol = frameTolerance(project)
  const activeFrameIndex = useMemo(
    () => findActiveWaypointIndexAtTime(waypoints, time, Math.max(tol, 0.015)),
    [waypoints, time, tol]
  )

  const activeFrame = waypoints[activeFrameIndex] ?? waypoints[0]

  // Khi đang phát (playing), giữ ổn định thời điểm lấy mẫu mặt phẳng 2D để tránh tính lại & render DOM 60fps
  const stageSampleTime = playing ? (activeFrame?.time ?? 0) : time
  const ev = useMemo(() => evaluateScene(project, stageSampleTime), [project, stageSampleTime])
  const activeYaw = activeFrame?.yaw ?? 0
  const activePitch = activeFrame?.pitch ?? 0
  const activeShotIdFor2D = activeFrame?.shotId ?? null

  const layersByShot = useMemo(() => {
    const map = new Map<string | null, ProjectedLayer2D[]>()
    for (let idx = 0; idx < stageLayout.length; idx++) {
      const box = stageLayout[idx]
      const isCurrentShot = box.shotId === activeShotIdFor2D
      const angles = isCurrentShot ? { yaw: activeYaw, pitch: activePitch } : undefined
      let shotEv = ev
      if (!isCurrentShot && box.shotId) {
        const wpForShot = waypoints.find((w) => w.shotId === box.shotId)
        if (wpForShot && Math.abs(wpForShot.time - stageSampleTime) > 0.05) {
          shotEv = evaluateScene(project, wpForShot.time)
        }
      }
      map.set(box.shotId, projectShotLayers2D(project, shotEv, box.shotId, idx === 0, angles))
    }
    return map
  }, [stageLayout, project, ev, waypoints, stageSampleTime, activeShotIdFor2D, activeYaw, activePitch])

  const layersByWaypoint = useMemo(() => {
    return waypoints.map((wp) => {
      const box =
        (wp.shotId ? stageLayout.find((b) => b.shotId === wp.shotId) : null) ?? stageLayout[0]
      const wpEv =
        Math.abs(wp.time - stageSampleTime) < 0.02 ? ev : evaluateScene(project, wp.time)
      const isFirstBox = box ? stageLayout[0]?.shotId === box.shotId : true
      return projectShotLayers2D(project, wpEv, box?.shotId ?? null, isFirstBox, {
        yaw: wp.yaw,
        pitch: wp.pitch
      })
    })
  }, [waypoints, stageLayout, project, ev, stageSampleTime])

  const lastSyncedShotRef = useRef<string | null>(selectedShotId)
  useEffect(() => {
    if (playing || !selectedShotId) {
      lastSyncedShotRef.current = selectedShotId
      return
    }
    if (lastSyncedShotRef.current === selectedShotId) return
    lastSyncedShotRef.current = selectedShotId

    const box = stageLayout.find((b) => b.shotId === selectedShotId)
    if (!box) return

    const curZoom = zoomRef.current
    const nextPan = {
      x: Math.round(-box.stageX * curZoom),
      y: Math.round(-box.stageY * curZoom - 14)
    }
    panRef.current = nextPan
    setPan(nextPan)

    const shotWps = waypoints.filter((w) => w.shotId === selectedShotId)
    if (shotWps.length > 0) {
      if (activeFrame?.shotId !== selectedShotId) {
        setTime(shotWps[0].time)
      }
      return
    }

    let spawnedTime: number | null = null
    update((d) => {
      spawnedTime = appendShotCameraWaypoint(d, stageLayout, selectedShotId, 2.0)
    })
    if (spawnedTime !== null) {
      setTime(spawnedTime)
      toast(`🎥 Đã tạo mốc lộ trình mới cho "${box.name}" tại ${(spawnedTime as number).toFixed(1)}s`)
    }
  }, [selectedShotId, playing, stageLayout, waypoints, activeFrame?.shotId, setTime, update])

  // Khi chọn một Layer (từ Workflow V2, Timeline hoặc Inspector), tự động căn khung Camera 2D đến Layer đó
  const lastSyncedLayerRef = useRef<string | null>(selectedLayerId)
  useEffect(() => {
    if (playing || !selectedLayerId) {
      lastSyncedLayerRef.current = selectedLayerId
      return
    }
    if (lastSyncedLayerRef.current === selectedLayerId) return
    lastSyncedLayerRef.current = selectedLayerId

    const layer = project.layers.find((l) => l.id === selectedLayerId)
    if (!layer) return
    const box = (layer.shotId ? stageLayout.find((b) => b.shotId === layer.shotId) : null) ?? stageLayout[0]
    if (!box) return
    const proj = (layersByShot.get(box.shotId) ?? []).find((p) => p.id === selectedLayerId)
    const curZoom = zoomRef.current
    const targetStageX = box.stageX + (proj?.offsetX ?? 0)
    const targetStageY = box.stageY + (proj?.offsetY ?? 0)
    const nextPan = {
      x: Math.round(-targetStageX * curZoom),
      y: Math.round(-targetStageY * curZoom - 14)
    }
    panRef.current = nextPan
    setPan(nextPan)
  }, [selectedLayerId, playing, project.layers, stageLayout, layersByShot])

  const handleStartLayerBBoxDrag = useCallback(
    (
      e: React.PointerEvent,
      _box: ShotStageBox,
      projLayer: ProjectedLayer2D,
      mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'
    ): void => {
      setPlaying(false)
      selectLayer(projLayer.id)
      const layerObj = useEditor.getState().project.layers.find((l) => l.id === projLayer.id)
      if (!layerObj) return
      const startX = e.clientX
      const startY = e.clientY
      const origPos = [...(layerObj.transform.position.value ?? [0, 0, 0])]
      const origScale = [...(layerObj.transform.scale.value ?? [1, 1, 1])]
      const safeZoom = Math.max(0.04, zoomRef.current)
      const refD = 1483.64
      const pFactor = refD / Math.max(80, refD + (origPos[2] ?? 0))

      const onMove = (pev: PointerEvent): void => {
        const dxStage = (pev.clientX - startX) / safeZoom
        const dyStage = (pev.clientY - startY) / safeZoom
        update((d) => {
          const dl = d.layers.find((l) => l.id === projLayer.id)
          if (!dl) return
          if (mode === 'move') {
            const nx = Math.round(origPos[0] + dxStage / pFactor)
            const ny = Math.round(origPos[1] - dyStage / pFactor)
            dl.transform.position.value = [nx, ny, origPos[2] ?? 0]
            const wfNode = d.workflow?.nodes.find((n) => n.id === `v2-layer-${dl.id}`)
            if (wfNode?.params) {
              wfNode.params.transformX = nx
              wfNode.params.transformY = ny
            }
          } else {
            const signX = mode === 'ne' || mode === 'se' ? 1 : -1
            const signY = mode === 'sw' || mode === 'se' ? 1 : -1
            const deltaW = dxStage * signX * 2
            const deltaH = dyStage * signY * 2
            const ratioW = Math.max(0.1, Math.min(8, (projLayer.width + deltaW) / Math.max(12, projLayer.width)))
            const ratioH = Math.max(0.1, Math.min(8, (projLayer.height + deltaH) / Math.max(12, projLayer.height)))
            const ratio = Number(((ratioW + ratioH) / 2).toFixed(3))
            dl.transform.scale.value = [
              Number((origScale[0] * ratio).toFixed(3)),
              Number((origScale[1] * ratio).toFixed(3)),
              origScale[2] ?? 1
            ]
          }
        }, `anim2d-layer-bbox-${projLayer.id}`)
      }

      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [setPlaying, selectLayer, update]
  )

  // Fit all 2D shot planes and external callout bubbles into the stage viewport
  const fitStage = useCallback(
    (vw = viewportSize.w, vh = viewportSize.h) => {
      if (stageLayout.length === 0 || vw < 40 || vh < 40) return
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (const box of stageLayout) {
        minX = Math.min(minX, box.stageX - box.width * 0.6)
        maxX = Math.max(maxX, box.stageX + box.width * 0.6)
        minY = Math.min(minY, box.stageY - box.height * 0.72)
        maxY = Math.max(maxY, box.stageY + box.height * 0.78)
      }
      for (const f of frames) {
        minX = Math.min(minX, f.stageX - f.width * 0.58)
        maxX = Math.max(maxX, f.stageX + f.width * 0.58)
        minY = Math.min(minY, f.stageY - f.height * 0.65)
        maxY = Math.max(maxY, f.stageY + f.height * 0.72)
      }
      const spanW = Math.max(project.comp.width, maxX - minX)
      const spanH = Math.max(project.comp.height, maxY - minY)
      const availW = Math.max(120, vw - 116)
      const availH = Math.max(120, vh - 165)
      const nextZoom = Math.max(0.04, Math.min(0.85, Math.min(availW / spanW, availH / spanH)))
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      const nextPan = { x: -cx * nextZoom, y: -cy * nextZoom - 14 }
      zoomRef.current = nextZoom
      panRef.current = nextPan
      setZoom(nextZoom)
      setPan(nextPan)
    },
    [stageLayout, frames, project.comp.width, project.comp.height, viewportSize.w, viewportSize.h]
  )

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const w = Math.floor(entry.contentRect.width)
      const h = Math.floor(entry.contentRect.height)
      if (w > 20 && h > 20) {
        setViewportSize({ w, h })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const prevShotCountRef = useRef(stageLayout.length)
  const lastFittedWRef = useRef(0)

  useEffect(() => {
    if (viewportSize.w > 100 && viewportSize.h > 100) {
      const widthChanged = Math.abs(viewportSize.w - lastFittedWRef.current) > 48
      if (!autoFitted || prevShotCountRef.current !== stageLayout.length || widthChanged) {
        prevShotCountRef.current = stageLayout.length
        lastFittedWRef.current = viewportSize.w
        fitStage(viewportSize.w, viewportSize.h)
        setAutoFitted(true)
      }
    }
  }, [autoFitted, viewportSize.w, viewportSize.h, fitStage, stageLayout.length])

  const stageToScreen = (sx: number, sy: number): { x: number; y: number } => ({
    x: viewportSize.w / 2 + pan.x + sx * zoom,
    y: viewportSize.h / 2 + pan.y + sy * zoom
  })

  const {
    startFrameMoveDrag,
    startFrameResizeDrag,
    startFrameRotateDrag,
    startFrameOrbit3DDrag,
    startShotMoveDrag
  } = useCameraStageDrag({
    compWidth: project.comp.width,
    compHeight: project.comp.height,
    zoom,
    stageLayout,
    stageRef,
    stageToScreen,
    setPlaying,
    setTime,
    setSnapGuide,
    update
  })

  // Chọn mốc Camera, đồng bộ Cảnh và tự động bật tab Lộ trình khi click bóng tròn / thẻ kẻ phim
  const handleSelectFrame = useCallback(
    (f: CameraFrame2D | CameraWaypointItem, activateRouteTab = false): void => {
      setPlaying(false)
      setTime(f.time)
      const targetShot =
        f.shotId ?? findNearestShotByStage2D(stageLayout, f.stageX, f.stageY)?.shotId ?? null
      if (targetShot) {
        const box = stageLayout.find((b) => b.shotId === targetShot)
        if (box) {
          const curZoom = zoomRef.current
          const nextPan = {
            x: Math.round(-box.stageX * curZoom),
            y: Math.round(-box.stageY * curZoom - 14)
          }
          panRef.current = nextPan
          setPan(nextPan)
        }
        selectShot(targetShot)
      }
      if (activateRouteTab) {
        useEditor.getState().setInspectorTab('route')
      }
    },
    [stageLayout, selectShot, setPlaying, setTime]
  )

  // Cho phép kéo thả di chuyển Bóng Tròn Liên Kết (#1, #2...) ra vị trí thoáng bất kỳ
  const handleStartBubbleDrag = useCallback(
    (e: React.PointerEvent, idx: number, wp: CameraWaypointItem): void => {
      handleSelectFrame(wp, true)
      const startX = e.clientX
      const startY = e.clientY
      const orig = bubbleOffsets[idx] ?? { dx: 0, dy: 0 }
      const safeZoom = Math.max(0.04, zoom)

      const onMove = (pev: PointerEvent): void => {
        const deltaScreenX = pev.clientX - startX
        const deltaScreenY = pev.clientY - startY
        if (Math.hypot(deltaScreenX, deltaScreenY) < 3) return
        setBubbleOffsets((prev) => ({
          ...prev,
          [idx]: {
            dx: Math.round(orig.dx + deltaScreenX / safeZoom),
            dy: Math.round(orig.dy + deltaScreenY / safeZoom)
          }
        }))
      }

      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [bubbleOffsets, zoom, handleSelectFrame]
  )

  const handleResetBubbleOffset = useCallback((idx: number): void => {
    setBubbleOffsets((prev) => {
      const next = { ...prev }
      delete next[idx]
      return next
    })
    toast(`Đã đặt lại vị trí bóng tròn #${idx + 1}`)
  }, [])

  const hasMovedBubbles = Object.keys(bubbleOffsets).length > 0

  const handleSelectShotOnStage = useCallback(
    (shotId: string | null): void => {
      lastSyncedShotRef.current = shotId
      selectShot(shotId)
      if (!shotId) return
      setPlaying(false)
      const shotWps = waypoints.filter((w) => w.shotId === shotId)
      if (shotWps.length > 0) {
        if (activeFrame?.shotId !== shotId) {
          setTime(shotWps[0].time)
        }
        return
      }
      let spawnedTime: number | null = null
      update((d) => {
        spawnedTime = appendShotCameraWaypoint(d, stageLayout, shotId, 2.0)
      })
      if (spawnedTime !== null) {
        setTime(spawnedTime)
        const box = stageLayout.find((b) => b.shotId === shotId)
        toast(`🎥 Đã tạo mốc lộ trình mới cho "${box?.name ?? 'Cảnh'}" tại ${(spawnedTime as number).toFixed(1)}s`)
      }
    },
    [selectShot, setPlaying, waypoints, activeFrame?.shotId, setTime, update, stageLayout]
  )

  // Spawn next Camera Frame (pan / zoom in / zoom out / target shot)
  const spawnNextCameraFrame = (
    mode: 'pan' | 'zoom-in' | 'zoom-out' | 'shot',
    targetShot?: ShotStageBox
  ): void => {
    let result: ReturnType<typeof spawnNextCameraWaypoint> = null
    update((d) => {
      result = spawnNextCameraWaypoint(d, stageLayout, {
        mode,
        activeTime: time,
        selectedShotId,
        targetShot
      })
    })
    if (!result) return
    const spawned = result as NonNullable<ReturnType<typeof spawnNextCameraWaypoint>>
    if (spawned.shotId) {
      lastSyncedShotRef.current = spawned.shotId
      selectShot(spawned.shotId)
    }
    setPlaying(false)
    setTime(spawned.nextTime)
    toast(
      `🎥 Đã tạo Mốc #${spawned.displayLabel} trong "${spawned.shotName}" tại ${spawned.nextTime.toFixed(1)}s`
    )
  }

  const handleAddHold = (): void => {
    let result: ReturnType<typeof spawnNextCameraWaypoint> = null
    update((d) => {
      result = spawnNextCameraWaypoint(d, stageLayout, {
        mode: 'hold',
        activeTime: time,
        selectedShotId
      })
    })
    if (!result) return
    const spawned = result as NonNullable<ReturnType<typeof spawnNextCameraWaypoint>>
    if (spawned.shotId) {
      lastSyncedShotRef.current = spawned.shotId
      selectShot(spawned.shotId)
    }
    setPlaying(false)
    setTime(spawned.nextTime)
    toast(`⏸ Đã tạo mốc Dừng ngắm #${spawned.displayLabel} tại ${spawned.nextTime.toFixed(1)}s`)
  }

  const handleQuickActionMode = (mode: CameraActionMode): void => {
    if (!activeFrame) return
    const targetTime = activeFrame.time
    update((d) => {
      applyWaypointActionMode(d, stageLayout, targetTime, mode)
    })
    if (Math.abs(targetTime - time) > 0.01) {
      setPlaying(false)
      setTime(targetTime)
    }
  }

  const handleEstablishCenter100 = (): void => {
    if (!activeFrame) return
    const box =
      (activeFrame.shotId ? stageLayout.find((b) => b.shotId === activeFrame.shotId) : null) ??
      findNearestShotByStage2D(stageLayout, activeFrame.stageX, activeFrame.stageY) ??
      stageLayout[0]
    if (!box) return
    const targetTime = activeFrame.time
    update((d) => {
      updateCameraWaypoint(d, stageLayout, targetTime, {
        stageX: box.stageX,
        stageY: box.stageY,
        scale: 1.0,
        yaw: 0,
        pitch: 0,
        roll: 0
      })
    })
    if (Math.abs(targetTime - time) > 0.01) {
      setPlaying(false)
      setTime(targetTime)
    }
    toast(`⊡ Đã căn khung chuẩn 100% vào chính giữa "${box.name}"`)
  }

  const handleQuickAnglePreset = (yaw: number, pitch: number, roll = 0, label = ''): void => {
    if (!activeFrame) return
    const targetTime = activeFrame.time
    update((d) => {
      updateCameraWaypoint(d, stageLayout, targetTime, { yaw, pitch, roll })
    })
    if (Math.abs(targetTime - time) > 0.01) {
      setPlaying(false)
      setTime(targetTime)
    }
    toast(`↻ Đã đặt góc 3D (${label || `Yaw ${yaw}° · Pitch ${pitch}°`})`)
  }

  const deleteFrameAt = (frame: CameraFrame2D): void => {
    if (!frame.isKeyframed || frames.length <= 1) {
      toast('Cần giữ ít nhất 1 mốc Camera gốc')
      return
    }
    update((d) => {
      removeCameraWaypoint(d, frame.time)
    })
    const prev = frames[Math.max(0, frame.index - 1)]
    if (prev) {
      if (prev.shotId) {
        lastSyncedShotRef.current = prev.shotId
        selectShot(prev.shotId)
      }
      setTime(prev.time)
    }
  }

  // Pan the 2D Stage when dragging empty canvas space (or Orbit 3D if in orbit-3d mode)
  const onStagePointerDown = (e: React.PointerEvent): void => {
    if (toolMode === 'orbit-3d' && activeFrame && e.button === 0 && !e.altKey) {
      startFrameOrbit3DDrag(e, activeFrame)
      return
    }
    const startX = e.clientX
    const startY = e.clientY
    const origPan = { ...panRef.current }
    const onMove = (pev: PointerEvent): void => {
      const nextPan = {
        x: origPan.x + (pev.clientX - startX),
        y: origPan.y + (pev.clientY - startY)
      }
      panRef.current = nextPan
      setPan(nextPan)
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onStageWheel = (e: React.WheelEvent): void => {
    e.stopPropagation()
    const curZoom = zoomRef.current
    const curPan = panRef.current
    const factor = e.deltaY < 0 ? 1.12 : 0.89
    const nextZoom = Math.max(0.05, Math.min(2.5, Math.round(curZoom * factor * 1000) / 1000))
    if (Math.abs(nextZoom - curZoom) < 1e-4) return

    const el = stageRef.current
    if (el) {
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const cx = (rect.width || viewportSize.w) / 2
      const cy = (rect.height || viewportSize.h) / 2
      const dx = mx - cx
      const dy = my - cy
      const scaleRatio = nextZoom / curZoom
      const nextPan = {
        x: Math.round((dx - (dx - curPan.x) * scaleRatio) * 10) / 10,
        y: Math.round((dy - (dy - curPan.y) * scaleRatio) * 10) / 10
      }
      panRef.current = nextPan
      setPan(nextPan)
    }
    zoomRef.current = nextZoom
    setZoom(nextZoom)
  }

  const handleAimAtShot = (box: ShotStageBox): void => {
    if (!activeFrame || !box.shotId) return
    lastSyncedShotRef.current = box.shotId
    selectShot(box.shotId)
    let targetTime = activeFrame.time
    update((d) => {
      if (activeFrame.shotId !== box.shotId) {
        targetTime = ensureShotWaypointTime(d, stageLayout, box.shotId!, activeFrame.time, true)
      }
      panCameraToShot(d, stageLayout, box.shotId!, targetTime, activeFrame.scale, activeFrame.ease)
    })
    if (Math.abs(targetTime - time) > 0.01) {
      setPlaying(false)
      setTime(targetTime)
    }
    toast(`⊡ Đã căn khung Camera vào chính giữa "${box.name}"`)
  }

  const handleAimAtLayer = (box: ShotStageBox, layer: ProjectedLayer2D): void => {
    if (!activeFrame) return
    if (box.shotId) {
      lastSyncedShotRef.current = box.shotId
      selectShot(box.shotId)
    }
    let targetTime = activeFrame.time
    update((d) => {
      if (box.shotId && activeFrame.shotId !== box.shotId) {
        targetTime = ensureShotWaypointTime(d, stageLayout, box.shotId, activeFrame.time, true)
      }
      panCameraToLayer2D(
        d,
        stageLayout,
        box.shotId,
        layer.offsetX,
        layer.offsetY,
        targetTime,
        activeFrame.scale,
        activeFrame.ease,
        layer.zDepth
      )
    })
    if (Math.abs(targetTime - time) > 0.01) {
      setPlaying(false)
      setTime(targetTime)
    }
    toast(`🎯 Đã ngắm & lấy nét Camera vào "${layer.name}"`)
  }

  const handleDoubleClickSpot = (stageX: number, stageY: number): void => {
    if (!activeFrame) return
    const targetBox = findNearestShotByStage2D(stageLayout, stageX, stageY)
    if (targetBox?.shotId) {
      lastSyncedShotRef.current = targetBox.shotId
      selectShot(targetBox.shotId)
    }
    let targetTime = activeFrame.time
    update((d) => {
      if (targetBox?.shotId && activeFrame.shotId !== targetBox.shotId) {
        targetTime = ensureShotWaypointTime(d, stageLayout, targetBox.shotId, activeFrame.time, true)
      }
      updateCameraWaypoint(d, stageLayout, targetTime, { stageX, stageY })
    })
    if (Math.abs(targetTime - time) > 0.01) {
      setPlaying(false)
      setTime(targetTime)
    }
    toast(`📍 Đã dời tâm Camera tới (${stageX}, ${stageY})`)
  }

  const activeShotBox = useMemo(() => {
    if (!activeFrame) return stageLayout[0]
    return (
      (activeFrame.shotId ? stageLayout.find((b) => b.shotId === activeFrame.shotId) : null) ??
      findNearestShotByStage2D(stageLayout, activeFrame.stageX, activeFrame.stageY) ??
      stageLayout[0]
    )
  }, [activeFrame, stageLayout])

  const activeShotLayers = useMemo(() => {
    if (!activeShotBox) return []
    return layersByShot.get(activeShotBox.shotId) ?? []
  }, [activeShotBox, layersByShot])

  return (
    <div
      id="animate-camera-stage"
      className={`anim2d-stage ${theme}${!animate2dSplit ? ' single-2d' : ''}`}
      style={{
        pointerEvents: 'none',
        background: 'transparent'
      }}
    >
      {/* 0. Thanh công cụ Top đồng nhất — trải rộng toàn màn hình từ x = 0 đến x = W */}
      <div style={{ pointerEvents: 'auto', width: '100%' }}>
        <AnimateCameraToolbar
          toolMode={toolMode}
          lineStyle={lineStyle}
          activeFrame={activeFrame}
          activeShotBox={activeShotBox}
          activeShotLayers={activeShotLayers}
          hasMovedBubbles={hasMovedBubbles}
          playing={playing}
          showAllFrames={showAllFrames}
          showGrid={showGrid}
          inspectorTab={inspectorTab}
          onSetToolMode={setToolMode}
          onSetLineStyle={setLineStyle}
          onSpawnNextFrame={(mode) => spawnNextCameraFrame(mode)}
          onAddHold={handleAddHold}
          onQuickAnglePreset={handleQuickAnglePreset}
          onAimAtLayer={handleAimAtLayer}
          onResetAllBubbles={() => {
            setBubbleOffsets({})
            toast('Đã đặt lại vị trí tất cả bóng tròn về mặc định')
          }}
          onTogglePlaying={() => setPlaying(!playing)}
          onToggleShowAllFrames={() => setShowAllFrames((v) => !v)}
          onToggleShowGrid={() => setShowGrid((v) => !v)}
          onFitStage={() => fitStage()}
        />
      </div>

      {/* Khu vực chính: Bàn dựng 2D bên trái + Kẻ phim dọc (Vertical Filmstrip Preview) bên phải */}
      <div
        className="anim2d-workspace-row"
        style={{
          marginLeft: splitLeftWidth,
          pointerEvents: 'auto',
          background: 'var(--bg-0)'
        }}
      >
        <div
          ref={stageRef}
          className={`anim2d-canvas mode-${toolMode}`}
          onPointerDown={onStagePointerDown}
          onWheel={onStageWheel}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* 1. Các Cảnh 3D được ánh xạ lên mặt phẳng 2D */}
          {stageLayout.map((box) => {
            const layers2D = layersByShot.get(box.shotId) ?? []
            const topLeft = stageToScreen(box.stageX - box.width / 2, box.stageY - box.height / 2)
            return (
              <AnimateShotPlane2D
                key={box.shotId ?? 'global'}
                box={box}
                layers={layers2D}
                background={project.comp.background}
                look={project.look}
                isSelectedShot={selectedShotId === box.shotId}
                isActiveCameraShot={activeFrame?.shotId === box.shotId}
                selectedLayerId={selectedLayerId}
                aimMode={toolMode === 'aim-target'}
                zoom={zoom}
                screenLeft={topLeft.x}
                screenTop={topLeft.y}
                onSelectShot={handleSelectShotOnStage}
                onStartShotDrag={startShotMoveDrag}
                onAimCurrentAtShot={handleAimAtShot}
                onAddFrameAtShot={(targetBox) => spawnNextCameraFrame('shot', targetBox)}
                onAimAtLayer={handleAimAtLayer}
                onDoubleClickSpot={handleDoubleClickSpot}
                onStartLayerBBoxDrag={handleStartLayerBBoxDrag}
              />
            )
          })}

          {/* 2. Đường bay ReactFlow, Bóng tròn kéo thả tự do & Khung Ngắm Camera Đang Chọn */}
          <AnimateCameraViewfinder
            stageLayout={stageLayout}
            waypoints={waypoints}
            activeFrameIndex={activeFrameIndex}
            liveFrame={liveFrame}
            playing={playing}
            zoom={zoom}
            toolMode={toolMode}
            lineStyle={lineStyle}
            showAllFrames={showAllFrames}
            showGrid={showGrid}
            snapGuide={snapGuide}
            bubbleOffsets={bubbleOffsets}
            stageToScreen={stageToScreen}
            onSelectFrame={handleSelectFrame}
            onStartBubbleDrag={handleStartBubbleDrag}
            onResetBubbleOffset={handleResetBubbleOffset}
            onStartMoveDrag={startFrameMoveDrag}
            onStartResizeDrag={startFrameResizeDrag}
            onStartRotateDrag={startFrameRotateDrag}
            onStartOrbit3DDrag={startFrameOrbit3DDrag}
            onSpawnNextPan={() => spawnNextCameraFrame('pan')}
            onAddHold={handleAddHold}
            onResetAngles={(f) => {
              update((d) => {
                alignWaypointInShot(d, stageLayout, f.time, 'reset-angles')
              })
              toast('Đã đặt lại góc xoay 3D & Roll về 0°')
            }}
            onDeleteFrame={deleteFrameAt}
          />
        </div>

        {/* 3. Kẻ phim dọc (Vertical Filmstrip Preview) chứa list ảnh từng mốc + thông tin thời gian & lộ trình */}
        <AnimateCameraVerticalFilmstrip
          waypoints={waypoints}
          activeFrameIndex={activeFrameIndex}
          stageLayout={stageLayout}
          layersByShot={layersByShot}
          layersByWaypoint={layersByWaypoint}
          background={project.comp.background}
          look={project.look}
          showPreview={showFilmstripPreview}
          onTogglePreview={() => setShowFilmstripPreview((v) => !v)}
          onSelectWaypoint={(wp) => handleSelectFrame(wp, true)}
        />
      </div>

      {/* 4. Thanh công cụ Động tác Quay Chuyên Nghiệp dưới chân (Gọn gàng, đồng nhất) */}
      <div style={{ marginLeft: splitLeftWidth, pointerEvents: 'auto' }}>
        <AnimateCameraProFooterBar
          activeFrame={activeFrame}
          waypoints={waypoints}
          onSelectWaypoint={(wp) => handleSelectFrame(wp, true)}
          onQuickActionMode={handleQuickActionMode}
          onEstablishCenter100={handleEstablishCenter100}
        />
      </div>
    </div>
  )
}
