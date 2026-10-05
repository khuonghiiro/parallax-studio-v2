import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { applyDrawnCameraTour } from '../actions'
import {
  getScene2DBounds,
  simplifyPoints,
  type LookTargetMode,
  type Point2D
} from '../animation/cameraSketch'
import { useEditor } from '../store/editor'
import { useView } from '../store/view'
import { NumberInput, Row, Slider } from './controls'
import { IconCamera, IconPause, IconPen, IconPlay, IconTrash, IconUndo } from './icons'

export function CameraSketchDialog() {
  const project = useEditor((s) => s.project)
  const close = (): void => useView.getState().openDialog(null)

  const [mode, setMode] = useState<'freehand' | 'click'>('freehand')
  const [lookMode, setLookMode] = useState<LookTargetMode>('blend')
  const [heightY, setHeightY] = useState(0)
  const [duration, setDuration] = useState(() => project.comp.duration)
  const [points, setPoints] = useState<Point2D[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [previewProgress, setPreviewProgress] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)

  const canvasRef = useRef<SVGSVGElement>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 680, h: 420 })

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setCanvasSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Keyboard shortcut ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // 2D Scene bounds on X-Z plane
  const bounds = useMemo(() => getScene2DBounds(project), [project])
  const pad = 40
  const scale = useMemo(() => {
    const sx = (canvasSize.w - pad * 2) / bounds.sizeX
    const sz = (canvasSize.h - pad * 2) / bounds.sizeZ
    return Math.max(0.01, Math.min(sx, sz))
  }, [canvasSize, bounds])

  const worldToScreen = (p: Point2D): { x: number; y: number } => ({
    x: canvasSize.w / 2 + (p.x - bounds.centerX) * scale,
    y: canvasSize.h / 2 + (p.z - bounds.centerZ) * scale
  })

  const screenToWorld = (sx: number, sy: number): Point2D => ({
    x: Math.round(bounds.centerX + (sx - canvasSize.w / 2) / scale),
    z: Math.round(bounds.centerZ + (sy - canvasSize.h / 2) / scale)
  })

  // Smooth spline curve for visual display & preview
  const curve = useMemo(() => {
    if (points.length < 2) return null
    const curvePoints = points.map((p) => new THREE.Vector3(p.x, heightY, p.z))
    return new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0.5)
  }, [points, heightY])

  // Screen spline path string
  const splinePathD = useMemo(() => {
    if (!curve) return ''
    const numSamples = Math.max(20, points.length * 15)
    let d = ''
    for (let i = 0; i <= numSamples; i++) {
      const u = i / numSamples
      const pt = curve.getPointAt(u)
      const sc = worldToScreen({ x: pt.x, z: pt.z })
      d += i === 0 ? `M ${sc.x} ${sc.y}` : ` L ${sc.x} ${sc.y}`
    }
    return d
  }, [curve, scale, canvasSize, bounds])

  // Preview animation loop
  useEffect(() => {
    if (!playing || !curve) {
      setPreviewProgress(null)
      return
    }
    let start: number | null = null
    let raf: number
    const animate = (timestamp: number) => {
      if (!start) start = timestamp
      const elapsed = (timestamp - start) / 1000
      const prog = (elapsed % duration) / duration
      setPreviewProgress(prog)
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [playing, curve, duration])

  // Pointer event handlers for drawing
  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const pt = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)

    if (mode === 'click') {
      setPoints((prev) => [...prev, pt])
    } else {
      setIsDrawing(true)
      setPoints([pt])
      const el = e.currentTarget as Element
      el.setPointerCapture(e.pointerId)
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || mode !== 'freehand') return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const pt = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    setPoints((prev) => [...prev, pt])
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawing) return
    setIsDrawing(false)
    try {
      const el = e.currentTarget as Element
      el.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    setPoints((prev) => simplifyPoints(prev, 50))
  }

  const handleApply = () => {
    if (points.length < 2) return
    applyDrawnCameraTour(points, {
      duration,
      heightY,
      lookMode,
      clearOldKeys: true
    })
    close()
  }

  // Preview position & orientation on canvas
  const previewData = useMemo(() => {
    if (!curve || previewProgress === null) return null
    const pos = curve.getPointAt(previewProgress)
    const tangent = curve.getTangentAt(previewProgress).normalize()
    const scPos = worldToScreen({ x: pos.x, z: pos.z })

    let tgt = pos.clone().add(tangent.clone().multiplyScalar(600))
    if (lookMode !== 'forward' && project.shots.length > 0) {
      let nearest = project.shots[0]
      let minD = Infinity
      for (const s of project.shots) {
        const d = Math.hypot(pos.x - s.position.value[0], pos.z - s.position.value[2])
        if (d < minD) {
          minD = d
          nearest = s
        }
      }
      const shotVec = new THREE.Vector3(nearest.position.value[0], heightY, nearest.position.value[2])
      if (lookMode === 'shots') {
        tgt = shotVec
      } else {
        const blendR = project.comp.width * 1.5
        const f = Math.max(0, Math.min(1, 1 - minD / blendR))
        tgt = pos.clone().add(tangent.clone().multiplyScalar(600)).lerp(shotVec, f * 0.8)
      }
    }
    const scTgt = worldToScreen({ x: tgt.x, z: tgt.z })
    const angle = Math.atan2(scTgt.y - scPos.y, scTgt.x - scPos.x) * (180 / Math.PI)
    return { pos: scPos, angle }
  }, [curve, previewProgress, lookMode, project.shots, heightY, scale, canvasSize, bounds])

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal wide" role="dialog" style={{ maxWidth: 980, width: '92vw' }}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="ico" style={{ background: '#38bdf8', color: '#0f172a', padding: 5, borderRadius: 6 }}>
              <IconPen width={18} height={18} />
            </span>
            <div>
              <h2 style={{ margin: 0 }}>Vẽ đường bay Camera trên mặt phẳng 2D (Top-Down Floor)</h2>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-faint)' }}>
                Nhấn giữ chuột vẽ tự do hoặc click cắm các điểm trạm. Đường vẽ tự động làm mượt bằng Spline 3D và tạo keyframe Camera.
              </p>
            </div>
          </div>
        </div>

        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
          {/* 2D Canvas Area */}
          <div
            style={{
              position: 'relative',
              background: '#090d16',
              borderRadius: 8,
              border: '1px solid var(--line)',
              overflow: 'hidden',
              userSelect: 'none',
              minHeight: 420
            }}
          >
            <svg
              ref={canvasRef}
              style={{ width: '100%', height: '100%', cursor: mode === 'freehand' ? 'crosshair' : 'pointer', display: 'block' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {/* Floor grid */}
              <defs>
                <pattern id="sketch-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                </pattern>
                <linearGradient id="path-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#sketch-grid)" />

              {/* Origin axes (0, 0) */}
              {(() => {
                const origin = worldToScreen({ x: 0, z: 0 })
                return (
                  <g opacity={0.3}>
                    <line x1={origin.x} y1={0} x2={origin.x} y2={canvasSize.h} stroke="#64748b" strokeDasharray="3 3" />
                    <line x1={0} y1={origin.y} x2={canvasSize.w} y2={origin.y} stroke="#64748b" strokeDasharray="3 3" />
                    <circle cx={origin.x} cy={origin.y} r={3} fill="#64748b" />
                  </g>
                )
              })()}

              {/* Render Shots as 2D nodes */}
              {project.shots.map((s) => {
                const sc = worldToScreen({ x: s.position.value[0], z: s.position.value[2] })
                const boxW = Math.max(30, (project.comp.width / 2) * scale)
                const boxH = Math.max(20, (project.comp.height / 3) * scale)
                return (
                  <g key={s.id} transform={`translate(${sc.x}, ${sc.y})`}>
                    <rect
                      x={-boxW / 2}
                      y={-boxH / 2}
                      width={boxW}
                      height={boxH}
                      rx={4}
                      fill={s.color}
                      fillOpacity={0.15}
                      stroke={s.color}
                      strokeWidth={1.5}
                    />
                    <circle cx={0} cy={0} r={4} fill={s.color} />
                    <text
                      x={0}
                      y={-boxH / 2 - 6}
                      fill={s.color}
                      fontSize={11}
                      fontWeight="bold"
                      textAnchor="middle"
                      style={{ pointerEvents: 'none' }}
                    >
                      {s.name}
                    </text>
                  </g>
                )
              })}

              {/* Current Camera Marker */}
              {(() => {
                const camSc = worldToScreen({ x: project.camera.position.value[0], z: project.camera.position.value[2] })
                return (
                  <g transform={`translate(${camSc.x}, ${camSc.y})`} opacity={0.75}>
                    <circle cx={0} cy={0} r={5} fill="#3dd6f5" />
                    <text x={0} y={15} fill="#3dd6f5" fontSize={9.5} textAnchor="middle">
                      Cam hiện tại
                    </text>
                  </g>
                )
              })()}

              {/* Drawn Spline Path */}
              {splinePathD && (
                <path d={splinePathD} fill="none" stroke="url(#path-grad)" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
              )}

              {/* Waypoints */}
              {points.map((p, i) => {
                const sc = worldToScreen(p)
                const isFirst = i === 0
                const isLast = i === points.length - 1
                return (
                  <g key={i} transform={`translate(${sc.x}, ${sc.y})`}>
                    <circle
                      cx={0}
                      cy={0}
                      r={isFirst || isLast ? 7 : 4.5}
                      fill={isFirst ? '#4ade80' : isLast ? '#f43f5e' : '#38bdf8'}
                      stroke="#0f172a"
                      strokeWidth={2}
                    />
                    <text x={8} y={-4} fill="#94a3b8" fontSize={9}>
                      {i + 1}
                    </text>
                  </g>
                )
              })}

              {/* Animated Preview Drone/Camera */}
              {previewData && (
                <g transform={`translate(${previewData.pos.x}, ${previewData.pos.y}) rotate(${previewData.angle})`}>
                  <polygon points="12,0 -8,-7 -4,0 -8,7" fill="#fbbf24" stroke="#000" strokeWidth={1} />
                  <circle cx={0} cy={0} r={12} fill="none" stroke="#fbbf24" strokeWidth={1.5} opacity={0.6} />
                </g>
              )}
            </svg>

            {/* Quick status bar on canvas */}
            <div
              style={{
                position: 'absolute',
                bottom: 8,
                left: 12,
                right: 12,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: 'var(--text-faint)',
                pointerEvents: 'none'
              }}
            >
              <span>{points.length === 0 ? '👉 Kéo chuột trên canvas để vẽ nét' : `Đã vẽ ${points.length} điểm`}</span>
              <span>X-Z Floor Plane (Top View)</span>
            </div>
          </div>

          {/* Settings Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Tool Mode */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase' }}>
                Chế độ vẽ
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                <button
                  className={`btn sm${mode === 'freehand' ? ' primary' : ''}`}
                  onClick={() => setMode('freehand')}
                  title="Nhấn giữ chuột vẽ lượn tự do"
                >
                  🖌️ Vẽ tự do
                </button>
                <button
                  className={`btn sm${mode === 'click' ? ' primary' : ''}`}
                  onClick={() => setMode('click')}
                  title="Click chuột để cắm từng điểm"
                >
                  📍 Cắm điểm
                </button>
              </div>
            </div>

            {/* Actions for points */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn sm"
                disabled={points.length === 0}
                onClick={() => setPoints((p) => p.slice(0, -1))}
                title="Xoá điểm cuối"
                style={{ flex: 1 }}
              >
                <IconUndo width={14} height={14} /> Bỏ điểm cuối
              </button>
              <button
                className="btn sm danger"
                disabled={points.length === 0}
                onClick={() => {
                  setPoints([])
                  setPlaying(false)
                }}
                title="Xoá toàn bộ nét vẽ"
              >
                <IconTrash width={14} height={14} />
              </button>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '4px 0' }} />

            {/* Look Target Mode */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase' }}>
                Hướng nhìn Camera
              </label>
              <select
                className="select sm"
                style={{ width: '100%', marginTop: 6 }}
                value={lookMode}
                onChange={(e) => setLookMode(e.target.value as LookTargetMode)}
              >
                <option value="blend">⚡ Kết hợp thông minh (Nhìn Cảnh & Hướng bay)</option>
                <option value="forward">🚀 Nhìn thẳng phía trước (Flycam/FPV)</option>
                <option value="shots">🎯 Luôn quay đầu nhìn vào Cảnh</option>
              </select>
            </div>

            {/* Height Y */}
            <div>
              <Row label="Độ cao Camera (Y)">
                <NumberInput value={heightY} onChange={setHeightY} step={20} min={-2000} max={2000} suffix="px" />
              </Row>
              <Slider value={heightY} min={-1000} max={1000} step={10} onChange={setHeightY} />
            </div>

            {/* Duration */}
            <div>
              <Row label="Thời lượng bay">
                <NumberInput value={duration} onChange={(v) => setDuration(Math.max(1, v))} step={0.5} min={1} max={60} suffix="s" />
              </Row>
            </div>

            {/* Preview Button */}
            <button
              className={`btn sm${playing ? ' primary' : ''}`}
              disabled={points.length < 2}
              onClick={() => setPlaying(!playing)}
              style={{ marginTop: 'auto' }}
            >
              {playing ? <IconPause width={14} height={14} /> : <IconPlay width={14} height={14} />}
              {playing ? 'Dừng xem trước' : 'Chạy thử đường vẽ'}
            </button>
          </div>
        </div>

        {/* Modal Foot */}
        <div className="modal-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
          <button className="btn" onClick={close}>
            Đóng
          </button>
          <button className="btn primary" disabled={points.length < 2} onClick={handleApply}>
            ⚡ Áp dụng thành Camera 3D
          </button>
        </div>
      </div>
    </div>
  )
}
