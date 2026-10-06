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
  screenToLocalZ
} from './topViewCameraMath'
import { TopViewControls } from './topview/TopViewControls'
import { useTopViewDrag } from './topview/useTopViewDrag'

export const TYPE_COLORS: Record<string, string> = {
  image: '#8b7bff',
  text: '#3dd6f5',
  solid: '#f59e6b',
  particles: '#ffc24b'
}

function getTopViewCorners(pos: Vec3, rot: Vec3, scale: Vec3, size: [number, number]): { p0: Vec3; p1: Vec3; p2: Vec3; p3: Vec3; isTilted: boolean } {
  const [w, h] = size
  const halfW = w / 2
  const halfH = h / 2
  const m = composeDepthMatrix(pos, rot, scale)
  const v = new THREE.Vector3()
  const p0 = threeToDepth(v.set(-halfW, -halfH, 0).applyMatrix4(m))
  const p1 = threeToDepth(v.set(halfW, -halfH, 0).applyMatrix4(m))
  const p2 = threeToDepth(v.set(halfW, halfH, 0).applyMatrix4(m))
  const p3 = threeToDepth(v.set(-halfW, halfH, 0).applyMatrix4(m))
  const isTilted = Math.abs(p0[2] - p3[2]) > 10
  return { p0, p1, p2, p3, isTilted }
}

export function useFocusShotId(): string | null {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const selectedShotId = useEditor((s) => s.selectedShotId)
  return useMemo(() => {
    if (selectedShotId && project.shots.some((s) => s.id === selectedShotId)) return selectedShotId
    return shotAtTime(project, time) ?? project.shots[0]?.id ?? null
  }, [project, time, selectedShotId])
}

export function TopView({ shotId, isExpanded = false }: { shotId: string | null; isExpanded?: boolean }) {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const selected = useEditor((s) => s.selectedLayerId)
  const selectLayer = useEditor((s) => s.selectLayer)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 300, h: 300 })
  const [isDragOver, setIsDragOver] = useState(false)

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

  const zs = [camPos[2], ...layers.map((l) => l.position[2])]
  const zMin = Math.min(...zs) - 300
  const zMax = Math.max(...zs, 0) + 400
  const xHalf = comp.width * 1.3
  const pad = 16

  const sx = (x: number): number => localToScreenX(x, size.w, pad, xHalf)
  const sz = (z: number): number => localToScreenZ(z, size.h, pad, zMin, zMax)
  const unx = (px: number): number => screenToLocalX(px, size.w, pad, xHalf)
  const unz = (py: number): number => screenToLocalZ(py, size.h, pad, zMin, zMax)

  const {
    dragMode,
    hudText,
    startLayerDrag,
    startCamPosDrag,
    startCamAngleDrag,
    startCamTargetDrag
  } = useTopViewDrag({ shotId, unx, unz })

  const aspect = comp.width / comp.height
  const hfov = 2 * Math.atan(Math.tan(((ev.camera.fov / 2) * Math.PI) / 180) * aspect)
  const dir = Math.atan2(camTarget[0] - camPos[0], camTarget[2] - camPos[2])
  const reach = zMax - zMin
  const fx = (sign: number): [number, number] => {
    const a = dir + (sign * hfov) / 2
    return [camPos[0] + Math.sin(a) * reach * 1.5, camPos[2] + Math.cos(a) * reach * 1.5]
  }
  const [lx, lz] = fx(-1)
  const [rx, rz] = fx(1)

  const aimDist = Math.max(80, Math.min(reach * 0.22, 160))
  const aimScreenX = sx(camPos[0] + Math.sin(dir) * aimDist)
  const aimScreenZ = sz(camPos[2] + Math.cos(dir) * aimDist)
  const targetScreenX = sx(camTarget[0])
  const targetScreenZ = sz(camTarget[2])

  // Handle Drop of Assets directly into the 2.5D Depth Diagram
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const dropX = Math.round(unx(e.clientX - rect.left))
    const dropZ = Math.round(unz(e.clientY - rect.top))

    const builtinData = e.dataTransfer.getData('application/x-pxs-builtin-asset')
    if (builtinData) {
      try {
        const item = JSON.parse(builtinData)
        await addLayerAtPosition(item, [dropX, 0, dropZ], shotId)
        return
      } catch {
        /* ignore */
      }
    }

    const assetId = e.dataTransfer.getData('application/x-pxs-asset')
    if (assetId) {
      const asset = project.assets.find((a) => a.id === assetId)
      if (asset) {
        await addLayerAtPosition({ id: assetId, name: asset.name, kind: asset.kind }, [dropX, 0, dropZ], shotId)
      }
    }
  }

  // Keyboard navigation for selected layer
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selected) return
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
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* HUD Info Badges */}
      {(dragMode !== 'none' || hudText) && (
        <div className="tv-hud-badge">
          {hudText || (dragMode === 'pos' ? `Cam: [${Math.round(camPos[0])}, ${Math.round(camPos[2])}]` : `Yaw: ${Math.round((dir * 180) / Math.PI)}°`)}
        </div>
      )}

      {isDragOver && (
        <div className="topview-drop-hint">
          Thả chuột để thêm Layer ảnh tại tọa độ độ sâu này
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
        </defs>

        {/* Depth Grid Lines */}
        {Array.from({ length: 9 }, (_, i) => {
          const y = pad + (i / 8) * (size.h - pad * 2)
          return <line key={i} x1={0} x2={size.w} y1={y} y2={y} stroke="var(--line-soft)" strokeWidth={1} />
        })}

        {/* Spatial Zone Labels */}
        <text className="tv-zone-label" x={12} y={sz(-150)}>Tiền cảnh (Foreground)</text>
        <text className="tv-zone-label" x={12} y={sz(350)}>Trung cảnh (Midground)</text>
        <text className="tv-zone-label" x={12} y={sz(1100)}>Hậu cảnh (Background)</text>

        {/* Focus Zero Plane (Z = 0) */}
        <line x1={0} x2={size.w} y1={sz(0)} y2={sz(0)} stroke="var(--line)" strokeDasharray="3 4" />
        <line x1={sx(0)} x2={sx(0)} y1={0} y2={size.h} stroke="var(--line-soft)" strokeDasharray="2 4" />
        <text className="tv-zero-label" x={Math.max(12, size.w - 78)} y={sz(0) - 4}>Z = 0 (Gốc)</text>

        {/* Camera Frustum */}
        <polygon
          points={`${sx(camPos[0])},${sz(camPos[2])} ${sx(lx)},${sz(lz)} ${sx(rx)},${sz(rz)}`}
          fill="url(#frustum)"
          stroke="var(--accent-cyan)"
          strokeOpacity={0.35}
        />

        {/* Line of Sight */}
        <line x1={sx(camPos[0])} y1={sz(camPos[2])} x2={aimScreenX} y2={aimScreenZ} stroke="var(--accent-cyan)" strokeWidth={2} strokeOpacity={0.8} />
        <line x1={aimScreenX} y1={aimScreenZ} x2={targetScreenX} y2={targetScreenZ} stroke="var(--accent-cyan)" strokeWidth={1.2} strokeDasharray="3 3" strokeOpacity={0.5} />

        {/* Target handle */}
        <g className="tv-cam-target" transform={`translate(${targetScreenX},${targetScreenZ})`} onPointerDown={startCamTargetDrag}>
          <title>Điểm nhìn camera: Kéo để xoay góc ngắm</title>
          <circle r={10} fill="transparent" />
          <circle r={5} fill="none" stroke="var(--accent-cyan)" strokeWidth={1.5} strokeOpacity={0.7} />
          <circle r={2} fill="var(--accent-cyan)" />
        </g>

        {/* Aim angle handle */}
        <g className="tv-cam-aim" transform={`translate(${aimScreenX},${aimScreenZ})`} onPointerDown={startCamAngleDrag}>
          <title>Xoay hướng nhìn camera</title>
          <circle r={12} fill="transparent" />
          <circle r={5} fill="var(--accent-cyan)" fillOpacity={0.25} stroke="var(--accent-cyan)" strokeWidth={1.5} />
        </g>

        {/* Layer horizontal segments in 3D */}
        {layers.map((l) => {
          const { p0, p1, p2, p3, isTilted } = getTopViewCorners(l.position, l.rotation, l.scale, l.size)
          const half = (l.size[0] * l.scale[0]) / 2
          const y = sz(l.position[2])
          const isSel = l.layer.id === selected
          const color = TYPE_COLORS[l.layer.type] || '#8b7bff'

          return (
            <g
              key={l.layer.id}
              className="tv-layer"
              onPointerDown={(e) => startLayerDrag(e, l.layer.id)}
              style={{ cursor: 'move' }}
            >
              <title>{`${l.layer.name}\nKéo để di chuyển (Trái/Phải X, Trước/Sau Z)\nShift: Khóa trục · Alt: Snap lưới`}</title>
              {isTilted ? (
                <polygon
                  points={`${sx(p0[0])},${sz(p0[2])} ${sx(p1[0])},${sz(p1[2])} ${sx(p2[0])},${sz(p2[2])} ${sx(p3[0])},${sz(p3[2])}`}
                  fill={color}
                  fillOpacity={isSel ? 0.4 : 0.15}
                  stroke={color}
                  strokeWidth={isSel ? 2.5 : 1.5}
                />
              ) : (
                <>
                  <line x1={sx(l.position[0] - half)} x2={sx(l.position[0] + half)} y1={y} y2={y} stroke="transparent" strokeWidth={16} />
                  <line
                    x1={sx(l.position[0] - half)}
                    x2={sx(l.position[0] + half)}
                    y1={y}
                    y2={y}
                    stroke={color}
                    strokeWidth={isSel ? 3.5 : 2}
                    strokeOpacity={l.active ? 1 : 0.4}
                    style={{ filter: isSel ? `drop-shadow(0 0 6px ${color})` : undefined }}
                  />
                </>
              )}
              <text
                className={`tv-label${isSel ? ' selected' : ''}`}
                x={sx(l.position[0] - half) + 4}
                y={y - 4}
                fill={isSel ? '#ffffff' : '#cbd5e1'}
              >
                {l.layer.name}
              </text>
            </g>
          )
        })}

        {/* Camera Position Dot */}
        <g className="tv-cam-group" transform={`translate(${sx(camPos[0])},${sz(camPos[2])})`} onPointerDown={startCamPosDrag}>
          <title>Vị trí Camera: Kéo để di chuyển (X, Z)</title>
          <circle r={16} fill="transparent" />
          <circle className="tv-cam-pulse" r={10} fill="none" stroke="var(--accent-cyan)" strokeOpacity={0.6} strokeWidth={1.5} />
          <circle r={5.5} fill="var(--accent-cyan)" />
        </g>
      </svg>

      {/* Floating Quick Layout Controls for Selected Layer */}
      <TopViewControls selectedLayerId={selected} />
    </div>
  )
}
