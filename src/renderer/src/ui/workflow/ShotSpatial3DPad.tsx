import React, { useMemo, useRef } from 'react'
import type { Project, Vec3 } from '@shared/types'
import { flyToShot, toast } from '../../actions'
import {
  SHOT_3D_PLACEMENT_PRESETS,
  getShotWorldCenter3D,
  placeShotRelativeToAnchor3D,
  translateShotInWorld3D,
  type Shot3DPlacementPreset
} from '../../project/shotSpatial3D'
import { useEditor } from '../../store/editor'

interface ShotSpatial3DPadProps {
  project: Project
  shotId: string
  compact?: boolean
}

export function ShotSpatial3DPad({
  project,
  shotId,
  compact = false
}: ShotSpatial3DPadProps): React.ReactElement | null {
  const editorUpdate = useEditor((s) => s.update)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const activeShotIdx = project.shots.findIndex((s) => s.id === shotId)
  const activeShot = activeShotIdx >= 0 ? project.shots[activeShotIdx] : undefined

  const shotCenters = useMemo(
    () =>
      project.shots.map((s, idx) => ({
        shot: s,
        idx,
        pos: getShotWorldCenter3D(project, s.id)
      })),
    [project]
  )

  if (!activeShot) return null

  const compW = Math.max(640, project.comp.width || 1920)
  const compH = Math.max(360, project.comp.height || 1080)
  const boxW = compW * 1.35
  const boxH = compH * 1.35

  const bounds = useMemo(() => {
    let minX = -boxW
    let maxX = boxW
    let minSvgY = -boxH
    let maxSvgY = boxH
    for (const item of shotCenters) {
      const sx = item.pos[0]
      const sy = -item.pos[1]
      minX = Math.min(minX, sx - boxW * 0.9)
      maxX = Math.max(maxX, sx + boxW * 0.9)
      minSvgY = Math.min(minSvgY, sy - boxH * 0.9)
      maxSvgY = Math.max(maxSvgY, sy + boxH * 0.9)
    }
    const padX = Math.max(compW * 0.9, (maxX - minX) * 0.14)
    const padY = Math.max(compH * 0.9, (maxSvgY - minSvgY) * 0.18)
    const vx = minX - padX
    const vy = minSvgY - padY
    const vw = Math.max(compW * 4, maxX - minX + padX * 2)
    const vh = Math.max(compH * 3.2, maxSvgY - minSvgY + padY * 2)
    return { vx, vy, vw, vh }
  }, [shotCenters, boxW, boxH, compW, compH])

  const activePos = shotCenters[activeShotIdx]?.pos ?? [0, 0, 0]
  const anchorShot = activeShotIdx > 0 ? project.shots[activeShotIdx - 1] : project.shots[1]

  const applyPlacementPreset = (preset: Shot3DPlacementPreset, label: string): void => {
    editorUpdate((draft) => {
      placeShotRelativeToAnchor3D(draft, shotId, preset)
    }, `shot-3d-preset-${shotId}`)
    toast(`🌌 Đã đặt "${activeShot.name}" (${label}) — Camera 3D tự cập nhật hướng lia`)
  }

  const commitAxis = (axis: 0 | 1 | 2, val: number): void => {
    if (!Number.isFinite(val)) return
    const next: Vec3 = [...activePos] as Vec3
    next[axis] = Math.round(val)
    editorUpdate((draft) => {
      translateShotInWorld3D(draft, shotId, next, { syncCamera: true })
    }, `shot-3d-axis-${shotId}-${axis}`)
  }

  const beginDragShot = (e: React.PointerEvent<SVGGElement>, targetShotId: string, startWorld: Vec3): void => {
    if (e.button !== 0 || !svgRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const rect = svgRef.current.getBoundingClientRect()
    if (rect.width < 10 || rect.height < 10) return
    const startClientX = e.clientX
    const startClientY = e.clientY
    const scaleX = bounds.vw / rect.width
    const scaleY = bounds.vh / rect.height

    const onMove = (ev: PointerEvent): void => {
      const dxWorld = Math.round((ev.clientX - startClientX) * scaleX)
      const dyWorld = Math.round(-(ev.clientY - startClientY) * scaleY)
      const nextPos: Vec3 = [startWorld[0] + dxWorld, startWorld[1] + dyWorld, startWorld[2]]
      editorUpdate((draft) => {
        translateShotInWorld3D(draft, targetShotId, nextPos, { syncCamera: true })
      }, `shot-3d-drag-${targetShotId}`)
    }

    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  return (
    <div className="wf-shot-spatial-pad" data-mcp-region="workflow_shot_spatial_pad">
      <div className="wf-shot-spatial-head">
        <div>
          <strong>🌌 Bản đồ Không gian Cảnh 3D</strong>
          <span>Kéo cảnh tự do Lên/Xuống/Chéo/Sâu Z — Camera 3D tự lia theo</span>
        </div>
        <button
          type="button"
          className="wf-v2-mini-btn"
          title="Đưa Camera bay tới kiểm tra góc nhìn của cảnh này"
          onClick={() => flyToShot(shotId)}
        >
          🎥 Bay tới
        </button>
      </div>

      <svg
        ref={svgRef}
        className="wf-shot-spatial-svg"
        viewBox={`${bounds.vx} ${bounds.vy} ${bounds.vw} ${bounds.vh}`}
        role="img"
        aria-label="Bản đồ bố trí không gian 3D các cảnh"
      >
        <defs>
          <marker
            id="wf-shot-cam-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--accent-cyan)" />
          </marker>
        </defs>

        {/* Trục gốc tọa độ mảnh */}
        <line
          x1={bounds.vx}
          y1={0}
          x2={bounds.vx + bounds.vw}
          y2={0}
          stroke="var(--line-soft)"
          strokeDasharray="120 120"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={0}
          y1={bounds.vy}
          x2={0}
          y2={bounds.vy + bounds.vh}
          stroke="var(--line-soft)"
          strokeDasharray="120 120"
          vectorEffect="non-scaling-stroke"
        />

        {/* Đường bay chuyển cảnh của Camera 3D giữa các Cảnh */}
        {shotCenters.map((cur, i) => {
          if (i === 0) return null
          const prev = shotCenters[i - 1]
          return (
            <line
              key={`route-${prev.shot.id}-${cur.shot.id}`}
              x1={prev.pos[0]}
              y1={-prev.pos[1]}
              x2={cur.pos[0]}
              y2={-cur.pos[1]}
              stroke="var(--accent-cyan)"
              strokeWidth={2}
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
              markerEnd="url(#wf-shot-cam-arrow)"
            />
          )
        })}

        {/* Các hộp không gian Cảnh (kéo trực tiếp trên bản đồ) */}
        {shotCenters.map(({ shot, idx, pos }) => {
          const isCurrent = shot.id === shotId
          const sx = pos[0]
          const sy = -pos[1]
          const zLabel = pos[2] !== 0 ? ` · Z${pos[2] > 0 ? `+${pos[2]}` : pos[2]}` : ''
          return (
            <g
              key={shot.id}
              className={`wf-shot-spatial-node${isCurrent ? ' is-active' : ''}`}
              transform={`translate(${sx} ${sy})`}
              onPointerDown={(e) => beginDragShot(e, shot.id, pos)}
              style={{ cursor: 'grab' }}
            >
              <title>{`Kéo để di chuyển "${shot.name}" trong không gian 3D (${pos[0]}, ${pos[1]}, ${pos[2]})`}</title>
              <rect
                x={-boxW / 2}
                y={-boxH / 2}
                width={boxW}
                height={boxH}
                rx={Math.round(boxH * 0.14)}
                fill={isCurrent ? 'color-mix(in srgb, var(--accent) 24%, var(--bg-2))' : 'var(--bg-2)'}
                stroke={isCurrent ? 'var(--accent-cyan)' : shot.color || 'var(--line)'}
                strokeWidth={isCurrent ? 2.4 : 1.4}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={0}
                y={-boxH * 0.06}
                textAnchor="middle"
                fill="var(--text)"
                fontSize={Math.round(boxH * 0.28)}
                fontWeight={700}
              >
                {`#${idx + 1} ${shot.name.replace(/^#\d+\s*/, '').slice(0, 12)}`}
              </text>
              <text
                x={0}
                y={boxH * 0.26}
                textAnchor="middle"
                fill="var(--text-dim)"
                fontSize={Math.round(boxH * 0.21)}
              >
                {`(${pos[0]}, ${pos[1]})${zLabel}`}
              </text>
            </g>
          )
        })}
      </svg>

      {project.shots.length > 1 && (
        <>
          <div className="wf-v2-subsec-head" style={{ marginTop: 4 }}>
            <span>🧭 Đặt hướng chuyển cảnh nhanh {anchorShot && activeShotIdx > 0 ? `(so với #${activeShotIdx})` : ''}</span>
          </div>
          <div className="wf-shot-preset-grid">
            {SHOT_3D_PLACEMENT_PRESETS.map((pr) => (
              <button
                key={pr.id}
                type="button"
                className="wf-v2-opt-pill"
                title={pr.hint}
                onClick={() => applyPlacementPreset(pr.id, pr.label)}
              >
                <span className="wf-v2-opt-pill-txt">{pr.icon} {pr.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {!compact && (
        <div className="wf-shot-xyz-row">
          <label className="wf-shot-xyz-field">
            <span>X (Ngang)</span>
            <input
              type="number"
              step={200}
              value={activePos[0]}
              aria-label="Tọa độ X của cảnh"
              onChange={(e) => commitAxis(0, Number(e.target.value))}
            />
          </label>
          <label className="wf-shot-xyz-field">
            <span>Y (Dọc)</span>
            <input
              type="number"
              step={200}
              value={activePos[1]}
              aria-label="Tọa độ Y của cảnh"
              onChange={(e) => commitAxis(1, Number(e.target.value))}
            />
          </label>
          <label className="wf-shot-xyz-field">
            <span>Z (Chiều sâu)</span>
            <input
              type="number"
              step={200}
              value={activePos[2]}
              aria-label="Tọa độ Z của cảnh"
              onChange={(e) => commitAxis(2, Number(e.target.value))}
            />
          </label>
        </div>
      )}
    </div>
  )
}
