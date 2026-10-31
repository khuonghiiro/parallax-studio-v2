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
import { NumberInput, Row, Select, Slider } from './controls'
import { IconPause, IconPen, IconPlay, IconSparkles, IconTrash, IconUndo, IconX } from './icons'

const LOOK_MODE_OPTIONS: { value: LookTargetMode; label: string }[] = [
  { value: 'blend', label: '⚡ Kết hợp thông minh (Nhìn Cảnh & Hướng bay)' },
  { value: 'forward', label: '🚀 Nhìn thẳng phía trước (Flycam / FPV)' },
  { value: 'shots', label: '🎯 Luôn quay đầu nhìn vào Cảnh gần nhất' }
]

export function CameraSketchDialog() {
  const project = useEditor((s) => s.project)
  const theme = useView((s) => s.theme)
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
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
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

  const handleConnectAllShots = () => {
    const visibleShots = project.shots.filter((s) => s.visible)
    const source = visibleShots.length > 0 ? visibleShots : project.shots
    if (source.length === 0) return
    const shotWaypoints: Point2D[] = source.map((s) => ({
      x: Math.round(s.position.value[0]),
      z: Math.round(s.position.value[2] + 650)
    }))
    setPoints(shotWaypoints)
  }

  const handleAppendShotPoint = (shotX: number, shotZ: number) => {
    setPoints((prev) => [...prev, { x: Math.round(shotX), z: Math.round(shotZ + 650) }])
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

  const isLight = theme === 'light'
  const gridStroke = isLight ? 'rgba(15, 23, 42, 0.07)' : 'rgba(255, 255, 255, 0.05)'
  const axisColor = isLight ? '#64748b' : '#475569'
  const camMarkerColor = isLight ? '#0284c7' : '#3dd6f5'
  const pointStroke = isLight ? '#ffffff' : '#0f172a'
  const pointLabelFill = isLight ? '#334155' : '#94a3b8'

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal wide camera-sketch-modal" data-mcp-region="camera_sketch" data-mcp-dialog role="dialog">
        <div className="modal-head modal-head-row">
          <div className="modal-head-title-group">
            <span className="modal-head-badge">
              <IconPen width={15} height={15} />
            </span>
            <div>
              <h2>Vẽ đường bay Camera trên mặt phẳng 2D (Top-Down Floor)</h2>
              <p>
                Nhấn giữ chuột vẽ tự do hoặc click cắm các điểm trạm. Đường vẽ tự động làm mượt bằng Spline 3D và tạo keyframe Camera.
              </p>
            </div>
          </div>
          <button type="button" className="btn icon ghost sm modal-close-btn" onClick={close} title="Đóng (Esc)">
            <IconX width={14} height={14} />
          </button>
        </div>

        <div className="modal-body camera-sketch-body">
          {/* 2D Canvas Area */}
          <div className="camera-sketch-canvas">
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
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke={gridStroke} strokeWidth="1" />
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
                  <g opacity={0.35}>
                    <line x1={origin.x} y1={0} x2={origin.x} y2={canvasSize.h} stroke={axisColor} strokeDasharray="3 3" />
                    <line x1={0} y1={origin.y} x2={canvasSize.w} y2={origin.y} stroke={axisColor} strokeDasharray="3 3" />
                    <circle cx={origin.x} cy={origin.y} r={3} fill={axisColor} />
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
                      fillOpacity={isLight ? 0.2 : 0.15}
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
                  <g transform={`translate(${camSc.x}, ${camSc.y})`} opacity={0.85}>
                    <circle cx={0} cy={0} r={5} fill={camMarkerColor} />
                    <text x={0} y={15} fill={camMarkerColor} fontSize={9.5} fontWeight={600} textAnchor="middle">
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
                      fill={isFirst ? '#22c55e' : isLast ? '#f43f5e' : '#38bdf8'}
                      stroke={pointStroke}
                      strokeWidth={2}
                    />
                    <text x={8} y={-4} fill={pointLabelFill} fontSize={9} fontWeight={600}>
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
            <div className="camera-sketch-status">
              <span>{points.length === 0 ? '👉 Kéo chuột trên mặt sàn hoặc chọn trạm Cảnh bên phải' : `Đã chấm ${points.length} điểm trạm`}</span>
              <span>Mặt phẳng X-Z (Top View)</span>
            </div>
          </div>

          {/* Settings Sidebar */}
          <div className="camera-sketch-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Tool Mode */}
            <div>
              <label className="sketch-section-label">Chế độ vẽ đường bay</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                <button
                  type="button"
                  className={`btn sm${mode === 'freehand' ? ' primary' : ''}`}
                  onClick={() => setMode('freehand')}
                  title="Nhấn giữ chuột vẽ lượn tự do"
                >
                  🖌️ Vẽ tự do
                </button>
                <button
                  type="button"
                  className={`btn sm${mode === 'click' ? ' primary' : ''}`}
                  onClick={() => setMode('click')}
                  title="Click chuột để cắm từng điểm"
                >
                  📍 Cắm điểm
                </button>
              </div>
            </div>

            {/* Quick Shot Waypoints */}
            {project.shots.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="sketch-section-label">Chèn nhanh trạm Cảnh</label>
                  <button
                    type="button"
                    className="btn xs"
                    onClick={handleConnectAllShots}
                    title="Tự động tạo đường bay nối qua tất cả các cảnh"
                  >
                    ⚡ Nối tất cả Cảnh
                  </button>
                </div>
                <div className="sketch-shot-pills">
                  {project.shots.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="sketch-shot-pill"
                      onClick={() => handleAppendShotPoint(s.position.value[0], s.position.value[2])}
                      title={`Thêm điểm dừng trước ${s.name}`}
                    >
                      <span className="dot" style={{ background: s.color }} />
                      <span>+ {s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions for points */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="btn sm"
                disabled={points.length === 0}
                onClick={() => setPoints((p) => p.slice(0, -1))}
                title="Xoá điểm cuối"
                style={{ flex: 1 }}
              >
                <IconUndo width={13} height={13} /> Bỏ điểm cuối
              </button>
              <button
                type="button"
                className="btn sm"
                disabled={points.length < 3}
                onClick={() => setPoints((p) => simplifyPoints(p, 65))}
                title="Tối giản và làm mượt đường cong"
              >
                <IconSparkles width={13} height={13} /> Làm mượt
              </button>
              <button
                type="button"
                className="btn sm danger"
                disabled={points.length === 0}
                onClick={() => {
                  setPoints([])
                  setPlaying(false)
                }}
                title="Xoá toàn bộ nét vẽ"
              >
                <IconTrash width={13} height={13} />
              </button>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '2px 0' }} />

            {/* Look Target Mode */}
            <div>
              <label className="sketch-section-label" style={{ display: 'block', marginBottom: 6 }}>
                Hướng nhìn Camera
              </label>
              <Select
                size="sm"
                value={lookMode}
                options={LOOK_MODE_OPTIONS}
                onChange={(val) => setLookMode(val as LookTargetMode)}
              />
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
              type="button"
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
        <div className="modal-foot">
          <button type="button" className="btn" onClick={close}>
            Đóng
          </button>
          <button type="button" id="sketch-apply" className="btn primary" disabled={points.length < 2} onClick={handleApply}>
            ⚡ Áp dụng thành Camera 3D
          </button>
        </div>
      </div>
    </div>
  )
}

