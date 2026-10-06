import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Vec3 } from '@shared/types'
import { addLayerAtPosition, deleteSelectedLayer, moveLayer } from '../actions'
import { shotAtTime } from '../animation/cameraPath'
import { evaluateScene } from '../engine/evaluateScene'
import { composeDepthMatrix, depthToThree, threeToDepth } from '../engine/spatial'
import { useEditor } from '../store/editor'
import { useView } from '../store/view'
import {
  localToScreenX,
  localToScreenZ,
  screenToLocalX,
  screenToLocalZ,
  screenXToSideZ,
  screenYToSideY,
  sideYToScreenY,
  sideZToScreenX
} from './topViewCameraMath'
import { useTopViewDrag } from './topview/useTopViewDrag'
import { SideViewSvg } from './topview/SideViewSvg'
import { TopViewSvg } from './topview/TopViewSvg'
import { TYPE_COLORS, getTopViewCorners } from './topview/topViewCommon'

export { TYPE_COLORS, getTopViewCorners }

export function useFocusShotId(): string | null {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const selectedShotId = useEditor((s) => s.selectedShotId)
  return useMemo(() => {
    if (selectedShotId && project.shots.some((s) => s.id === selectedShotId)) return selectedShotId
    return shotAtTime(project, time) ?? project.shots[0]?.id ?? null
  }, [project, time, selectedShotId])
}

export function TopView({
  shotId,
  isExpanded = false,
  viewMode: propViewMode
}: {
  shotId: string | null
  isExpanded?: boolean
  viewMode?: 'top' | 'side'
}) {
  const storeViewMode = useView((s) => s.topViewMode)
  const viewMode = propViewMode ?? storeViewMode
  const isSide = viewMode === 'side'

  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const selected = useEditor((s) => s.selectedLayerId)
  const selectLayer = useEditor((s) => s.selectLayer)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 300, h: 300 })
  const [isDragOver, setIsDragOver] = useState(false)

  useEffect(() => {
    if (!isDragOver) return
    const handleDragEnd = () => setIsDragOver(false)
    window.addEventListener('dragend', handleDragEnd)
    window.addEventListener('drop', handleDragEnd)
    return () => {
      window.removeEventListener('dragend', handleDragEnd)
      window.removeEventListener('drop', handleDragEnd)
    }
  }, [isDragOver])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const w = Math.floor(entry.contentRect.width)
        const h = Math.floor(entry.contentRect.height)
        if (w > 20 && h > 20) {
          setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
        }
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ev = useMemo(() => evaluateScene(project, time), [project, time])
  const { comp } = project
  const shot = shotId ? ev.shots.find((s) => s.shot.id === shotId) : undefined

  const inv = useMemo(() => (shot ? shot.matrix.clone().invert() : new THREE.Matrix4()), [shot])
  const toLocal = (p: Vec3): Vec3 => threeToDepth(depthToThree(p).applyMatrix4(inv))
  const camPos = toLocal(ev.camera.position)
  const camTarget = toLocal(ev.camera.target)
  const layers = ev.layers.filter((l) => l.layer.visible && (l.layer.shotId ?? null) === (shot ? shot.shot.id : null))

  // Coordinate spans
  const zs = [camPos[2], camTarget[2], ...layers.map((l) => l.position[2])]
  const zMin = Math.min(...zs) - 300
  const zMax = Math.max(...zs, 0) + 400
  const xHalf = comp.width * 1.3

  const ys = [
    camPos[1],
    camTarget[1],
    ...layers.flatMap((l) => [l.position[1] - (l.size[1] * l.scale[1]) / 2, l.position[1] + (l.size[1] * l.scale[1]) / 2])
  ]
  const maxAbsY = Math.max(...ys.map((y) => Math.abs(y)), 100)
  const yHalf = Math.max(comp.height * 0.9, maxAbsY + 150)
  const pad = 16

  // Top View conversions
  const sx = (x: number): number => localToScreenX(x, size.w, pad, xHalf)
  const sz = (z: number): number => localToScreenZ(z, size.h, pad, zMin, zMax)
  const unx = (px: number): number => screenToLocalX(px, size.w, pad, xHalf)
  const unz = (py: number): number => screenToLocalZ(py, size.h, pad, zMin, zMax)

  // Side View conversions
  const sideZ = (z: number): number => sideZToScreenX(z, size.w, pad, zMin, zMax)
  const sideY = (y: number): number => sideYToScreenY(y, size.h, pad, yHalf)
  const unSideZ = (px: number): number => screenXToSideZ(px, size.w, pad, zMin, zMax)
  const unSideY = (py: number): number => screenYToSideY(py, size.h, pad, yHalf)

  const {
    dragMode,
    hudText,
    startLayerDrag,
    startCamPosDrag,
    startCamAngleDrag,
    startCamTargetDrag
  } = useTopViewDrag({
    shotId,
    viewMode,
    unx,
    unz,
    unSideZ,
    unSideY
  })

  const reach = zMax - zMin
  const aimDist = Math.max(80, Math.min(reach * 0.22, 160))

  // Camera calculations for Top View (X-Z)
  const aspect = comp.width / comp.height
  const hfov = 2 * Math.atan(Math.tan(((ev.camera.fov / 2) * Math.PI) / 180) * aspect)
  const dir = Math.atan2(camTarget[0] - camPos[0], camTarget[2] - camPos[2])
  const fx = (sign: number): [number, number] => {
    const a = dir + (sign * hfov) / 2
    return [camPos[0] + Math.sin(a) * reach * 1.5, camPos[2] + Math.cos(a) * reach * 1.5]
  }
  const [lx, lz] = fx(-1)
  const [rx, rz] = fx(1)
  const aimScreenX = sx(camPos[0] + Math.sin(dir) * aimDist)
  const aimScreenZ = sz(camPos[2] + Math.cos(dir) * aimDist)
  const targetScreenX = sx(camTarget[0])
  const targetScreenZ = sz(camTarget[2])

  // Camera calculations for Side View (Z-Y)
  const vfov = (ev.camera.fov * Math.PI) / 180
  const dirSide = Math.atan2(camTarget[1] - camPos[1], camTarget[2] - camPos[2])
  const fxSide = (sign: number): [number, number] => {
    const a = dirSide + (sign * vfov) / 2
    return [camPos[2] + Math.cos(a) * reach * 1.5, camPos[1] + Math.sin(a) * reach * 1.5]
  }
  const [topSideZ, topSideY] = fxSide(1)
  const [botSideZ, botSideY] = fxSide(-1)
  const aimSideZ = camPos[2] + Math.cos(dirSide) * aimDist
  const aimSideY = camPos[1] + Math.sin(dirSide) * aimDist
  const aimScreenSideX = sideZ(aimSideZ)
  const aimScreenSideY = sideY(aimSideY)
  const targetScreenSideX = sideZ(camTarget[2])
  const targetScreenSideY = sideY(camTarget[1])
  const camScreenSideX = sideZ(camPos[2])
  const camScreenSideY = sideY(camPos[1])

  // Handle Drop of Assets directly into the 2.5D Depth Diagram
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const dropZ = Math.round(isSide ? unSideZ(e.clientX - rect.left) : unz(e.clientY - rect.top))
    const dropY = isSide ? Math.round(unSideY(e.clientY - rect.top)) : 0
    const dropX = isSide ? 0 : Math.round(unx(e.clientX - rect.left))

    const builtinData = e.dataTransfer.getData('application/x-pxs-builtin-asset')
    if (builtinData) {
      try {
        const item = JSON.parse(builtinData)
        await addLayerAtPosition(item, [dropX, dropY, dropZ], shotId)
        return
      } catch {
        /* ignore */
      }
    }

    const assetId = e.dataTransfer.getData('application/x-pxs-asset')
    if (assetId) {
      const asset = project.assets.find((a) => a.id === assetId)
      if (asset) {
        await addLayerAtPosition({ id: assetId, name: asset.name, kind: asset.kind }, [dropX, dropY, dropZ], shotId)
      }
    }
  }

  // Keyboard navigation for selected layer
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selected) return
    if (isSide) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        useEditor.getState().update((d) => {
          const l = d.layers.find((x) => x.id === selected)
          if (l) l.transform.position.value[2] -= e.shiftKey ? 200 : 50
        })
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        useEditor.getState().update((d) => {
          const l = d.layers.find((x) => x.id === selected)
          if (l) l.transform.position.value[2] += e.shiftKey ? 200 : 50
        })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        useEditor.getState().update((d) => {
          const l = d.layers.find((x) => x.id === selected)
          if (l) l.transform.position.value[1] += e.shiftKey ? 100 : 20
        })
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        useEditor.getState().update((d) => {
          const l = d.layers.find((x) => x.id === selected)
          if (l) l.transform.position.value[1] -= e.shiftKey ? 100 : 20
        })
      } else if (e.key === '[' || e.key === '{') {
        e.preventDefault()
        moveLayer(selected, 1)
      } else if (e.key === ']' || e.key === '}') {
        e.preventDefault()
        moveLayer(selected, -1)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelectedLayer()
      }
    } else {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        useEditor.getState().update((d) => {
          const l = d.layers.find((x) => x.id === selected)
          if (l) l.transform.position.value[0] -= e.shiftKey ? 100 : 20
        })
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        useEditor.getState().update((d) => {
          const l = d.layers.find((x) => x.id === selected)
          if (l) l.transform.position.value[0] += e.shiftKey ? 100 : 20
        })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        useEditor.getState().update((d) => {
          const l = d.layers.find((x) => x.id === selected)
          if (l) l.transform.position.value[2] -= e.shiftKey ? 200 : 50
        })
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        useEditor.getState().update((d) => {
          const l = d.layers.find((x) => x.id === selected)
          if (l) l.transform.position.value[2] += e.shiftKey ? 200 : 50
        })
      } else if (e.key === '[' || e.key === '{') {
        e.preventDefault()
        moveLayer(selected, 1)
      } else if (e.key === ']' || e.key === '}') {
        e.preventDefault()
        moveLayer(selected, -1)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelectedLayer()
      }
    }
  }

  return (
    <div
      className={`topview topview-canvas-wrap${isDragOver ? ' drag-over' : ''}`}
      ref={wrapRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden' }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={() => selectLayer(null)}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false)
      }}
      onDrop={handleDrop}
    >
      {/* Expanded View Switcher (When in full Viewport) */}
      {isExpanded && (
        <div className="topview-expanded-switcher">
          <div className="seg">
            <button
              type="button"
              className={`btn xs${viewMode === 'top' ? ' active' : ''}`}
              onClick={() => useView.getState().set({ topViewMode: 'top' })}
              title="Nhìn từ trên đỉnh (Top View X-Z): Căn vị trí trái - phải và độ sâu xa - gần"
            >
              ⬇️ Top (X-Z)
            </button>
            <button
              type="button"
              className={`btn xs${viewMode === 'side' ? ' active' : ''}`}
              onClick={() => useView.getState().set({ topViewMode: 'side' })}
              title="Nhìn từ cạnh hông (Side View Z-Y): Căn độ cao nâng - hạ và độ dốc sàn đất"
            >
              ➡️ Side (Z-Y)
            </button>
          </div>
        </div>
      )}

      {/* HUD Info Badges */}
      {(dragMode !== 'none' || hudText) && (
        <div className="tv-hud-badge">
          {hudText ||
            (dragMode === 'pos'
              ? isSide
                ? `Cam: [Y: ${Math.round(camPos[1])}, Z: ${Math.round(camPos[2])}]`
                : `Cam: [${Math.round(camPos[0])}, ${Math.round(camPos[2])}]`
              : isSide
                ? `Pitch: ${Math.round((dirSide * 180) / Math.PI)}°`
                : `Yaw: ${Math.round((dir * 180) / Math.PI)}°`)}
        </div>
      )}

      {isDragOver && (
        <div className="topview-drop-hint">
          {isSide
            ? 'Thả chuột để thêm Layer ảnh tại độ sâu và độ cao này'
            : 'Thả chuột để thêm Layer ảnh tại tọa độ độ sâu này'}
        </div>
      )}

      <svg
        width={size.w}
        height={size.h}
        style={{ display: 'block', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      >
        <defs>
          <linearGradient id="frustum" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="var(--accent-cyan)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--accent-cyan)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="frustum-side" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--accent-cyan)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--accent-cyan)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {isSide ? (
          <SideViewSvg
            size={size}
            pad={pad}
            camScreenSideX={camScreenSideX}
            camScreenSideY={camScreenSideY}
            topSideZ={topSideZ}
            topSideY={topSideY}
            botSideZ={botSideZ}
            botSideY={botSideY}
            aimScreenSideX={aimScreenSideX}
            aimScreenSideY={aimScreenSideY}
            targetScreenSideX={targetScreenSideX}
            targetScreenSideY={targetScreenSideY}
            sideZ={sideZ}
            sideY={sideY}
            layers={layers}
            selected={selected}
            startLayerDrag={startLayerDrag}
            startCamPosDrag={startCamPosDrag}
            startCamAngleDrag={startCamAngleDrag}
            startCamTargetDrag={startCamTargetDrag}
          />
        ) : (
          <TopViewSvg
            size={size}
            pad={pad}
            camPos={camPos}
            lx={lx}
            lz={lz}
            rx={rx}
            rz={rz}
            aimScreenX={aimScreenX}
            aimScreenZ={aimScreenZ}
            targetScreenX={targetScreenX}
            targetScreenZ={targetScreenZ}
            sx={sx}
            sz={sz}
            layers={layers}
            selected={selected}
            startLayerDrag={startLayerDrag}
            startCamPosDrag={startCamPosDrag}
            startCamAngleDrag={startCamAngleDrag}
            startCamTargetDrag={startCamTargetDrag}
          />
        )}
      </svg>
    </div>
  )
}

