import React, { useRef, useState } from 'react'

export interface WorkflowV2BboxGimbalProps {
  cx: number
  cy: number
  boxW: number
  boxH: number
  rotZ: number
  rotY: number
  rotX: number
  zoom: number
  accentColor?: string
  onRotate: (rotZ: number, rotY: number, rotX: number) => void
  onStartDrag?: () => void
}

/**
 * Vòng xoay Gimbal 3D trực quan cho BBox đích của Node Motion
 * Gồm 3 trục xoay:
 * - Trục Z (Cyan #38bdf8): Xoay phẳng Roll 360° theo vòng chuột
 * - Trục Y (Emerald #10b981): Lật nghiêng 3D Yaw -80° đến +80° theo chiều ngang
 * - Trục X (Rose #f43f5e): Ngửa cúi 3D Pitch -80° đến +80° theo chiều dọc
 * Kèm HUD thông số góc xoay và nút reset về 0°.
 */
export const WorkflowV2BboxGimbal: React.FC<WorkflowV2BboxGimbalProps> = ({
  cx,
  cy,
  boxW,
  boxH,
  rotZ,
  rotY,
  rotX,
  zoom,
  onRotate,
  onStartDrag
}) => {
  const [activeAxis, setActiveAxis] = useState<'z' | 'y' | 'x' | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const r = Math.max(38, Math.min(112, Math.round(Math.hypot(boxW, boxH) * 0.46)))
  const safeZoom = Math.max(0.02, zoom)

  const handleDrag = (e: React.PointerEvent, axis: 'z' | 'y' | 'x'): void => {
    e.stopPropagation()
    e.preventDefault()
    onStartDrag?.()
    setActiveAxis(axis)

    const sx = e.clientX
    const sy = e.clientY

    // Tính tâm xoay thực tế trên viewport màn hình (screen client coords) để Math.atan2 chuẩn xác 100%
    const rect = svgRef.current?.getBoundingClientRect()
    const screenCx = (rect?.left ?? 0) + cx
    const screenCy = (rect?.top ?? 0) + cy
    const startAngle = Math.atan2(e.clientY - screenCy, e.clientX - screenCx)
    const initialZ = rotZ
    const initialY = rotY
    const initialX = rotX

    const onMove = (pev: PointerEvent): void => {
      if (axis === 'z') {
        const curAngle = Math.atan2(pev.clientY - screenCy, pev.clientX - screenCx)
        const deltaDeg = Math.round(((curAngle - startAngle) * 180) / Math.PI)
        let nextZ = Math.round((initialZ + deltaDeg) % 360)
        if (nextZ > 180) nextZ -= 360
        if (nextZ < -180) nextZ += 360
        onRotate(nextZ, initialY, initialX)
      } else if (axis === 'y') {
        const dx = (pev.clientX - sx) / safeZoom
        const nextY = Math.max(-80, Math.min(80, Math.round(initialY + dx * 0.45)))
        onRotate(initialZ, nextY, initialX)
      } else {
        const dy = -(pev.clientY - sy) / safeZoom
        const nextX = Math.max(-80, Math.min(80, Math.round(initialX + dy * 0.45)))
        onRotate(initialZ, initialY, nextX)
      }
    }

    const onUp = (): void => {
      setActiveAxis(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const hasRotation = rotZ !== 0 || rotY !== 0 || rotX !== 0

  return (
    <div
      className="wf-v2-bbox-gimbal-root"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 36
      }}
    >
      <svg
        ref={svgRef}
        className="wf-v2-bbox-gimbal-svg"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
          pointerEvents: 'none'
        }}
      >
        <defs>
          <filter id="gimbal-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.8" />
          </filter>
        </defs>

        {/* Trục X: Ngửa cúi 3D (Pitch - Rose #f43f5e) */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={r}
          ry={r * 0.36}
          fill="none"
          stroke="#f43f5e"
          strokeWidth={activeAxis === 'x' ? 3 : 1.75}
          strokeDasharray="4 2"
          opacity={activeAxis && activeAxis !== 'x' ? 0.3 : 0.85}
          style={{ cursor: 'ns-resize', pointerEvents: 'stroke' }}
          onPointerDown={(e) => handleDrag(e, 'x')}
        >
          <title>Trục X (Pitch): Kéo lên/xuống để ngửa hoặc cúi BBox 3D (-80° đến +80°)</title>
        </ellipse>
        {/* Handle trục X */}
        <circle
          cx={cx}
          cy={cy - r * 0.36}
          r={4}
          fill="#f43f5e"
          stroke="#ffffff"
          strokeWidth={1.5}
          style={{ cursor: 'ns-resize', pointerEvents: 'auto' }}
          onPointerDown={(e) => handleDrag(e, 'x')}
        />
        <circle
          cx={cx}
          cy={cy + r * 0.36}
          r={4}
          fill="#f43f5e"
          stroke="#ffffff"
          strokeWidth={1.5}
          style={{ cursor: 'ns-resize', pointerEvents: 'auto' }}
          onPointerDown={(e) => handleDrag(e, 'x')}
        />

        {/* Trục Y: Lật nghiêng 3D (Yaw - Emerald #10b981) */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={r * 0.36}
          ry={r}
          fill="none"
          stroke="#10b981"
          strokeWidth={activeAxis === 'y' ? 3 : 1.75}
          strokeDasharray="4 2"
          opacity={activeAxis && activeAxis !== 'y' ? 0.3 : 0.85}
          style={{ cursor: 'ew-resize', pointerEvents: 'stroke' }}
          onPointerDown={(e) => handleDrag(e, 'y')}
        >
          <title>Trục Y (Yaw): Kéo sang trái/phải để quay mặt BBox 3D (-80° đến +80°)</title>
        </ellipse>
        {/* Handle trục Y */}
        <circle
          cx={cx - r * 0.36}
          cy={cy}
          r={4}
          fill="#10b981"
          stroke="#ffffff"
          strokeWidth={1.5}
          style={{ cursor: 'ew-resize', pointerEvents: 'auto' }}
          onPointerDown={(e) => handleDrag(e, 'y')}
        />
        <circle
          cx={cx + r * 0.36}
          cy={cy}
          r={4}
          fill="#10b981"
          stroke="#ffffff"
          strokeWidth={1.5}
          style={{ cursor: 'ew-resize', pointerEvents: 'auto' }}
          onPointerDown={(e) => handleDrag(e, 'y')}
        />

        {/* Trục Z: Vòng xoay phẳng Roll (Cyan #38bdf8) */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={activeAxis === 'z' ? 3.5 : 2}
          opacity={activeAxis && activeAxis !== 'z' ? 0.3 : 0.9}
          style={{ cursor: 'crosshair', pointerEvents: 'stroke' }}
          onPointerDown={(e) => handleDrag(e, 'z')}
        >
          <title>Trục Z (Roll): Kéo xoay tròn quanh tâm để nghiêng BBox (-180° đến +180°)</title>
        </circle>
        {/* Handle trục Z tại đỉnh */}
        <circle
          cx={cx}
          cy={cy - r}
          r={4.5}
          fill="#38bdf8"
          stroke="#ffffff"
          strokeWidth={1.5}
          style={{ cursor: 'crosshair', pointerEvents: 'auto' }}
          onPointerDown={(e) => handleDrag(e, 'z')}
        />
        <circle
          cx={cx + r}
          cy={cy}
          r={4.5}
          fill="#38bdf8"
          stroke="#ffffff"
          strokeWidth={1.5}
          style={{ cursor: 'crosshair', pointerEvents: 'auto' }}
          onPointerDown={(e) => handleDrag(e, 'z')}
        />

        {/* Tâm Gimbal */}
        <circle cx={cx} cy={cy} r={3} fill="#ffffff" stroke="#0f172a" strokeWidth={1.5} />
      </svg>

      {/* HUD Hiển thị góc quay & Nút Reset về 0° */}
      <div
        className="wf-v2-bbox-gimbal-hud"
        style={{
          position: 'absolute',
          left: cx,
          top: cy + r + 12,
          transform: 'translateX(-50%)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 8px',
          borderRadius: 'var(--radius-sm, 4px)',
          background: 'rgba(15, 23, 42, 0.90)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.45)',
          fontSize: 10,
          fontFamily: 'monospace',
          color: '#ffffff',
          pointerEvents: 'auto',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          zIndex: 40
        }}
      >
        <span
          style={{ color: '#38bdf8', fontWeight: 600, cursor: 'pointer' }}
          title="Nhấp để xoay Z +15° (hoặc kéo vòng tròn cyan quanh BBox)"
          onClick={() => {
            let nextZ = Math.round((rotZ + 15) % 360)
            if (nextZ > 180) nextZ -= 360
            onRotate(nextZ, rotY, rotX)
          }}
        >
          ↻ Z: {rotZ}°
        </span>
        <span style={{ opacity: 0.35 }}>|</span>
        <span
          style={{ color: '#10b981', fontWeight: 600, cursor: 'pointer' }}
          title="Nhấp để lật Y +15° (hoặc kéo elip đứng màu xanh)"
          onClick={() => {
            const nextY = Math.max(-80, Math.min(80, rotY + 15))
            onRotate(rotZ, nextY, rotX)
          }}
        >
          ↔ Y: {rotY}°
        </span>
        <span style={{ opacity: 0.35 }}>|</span>
        <span
          style={{ color: '#f43f5e', fontWeight: 600, cursor: 'pointer' }}
          title="Nhấp để ngửa X +15° (hoặc kéo elip ngang màu đỏ)"
          onClick={() => {
            const nextX = Math.max(-80, Math.min(80, rotX + 15))
            onRotate(rotZ, rotY, nextX)
          }}
        >
          ↕ X: {rotX}°
        </span>
        {hasRotation && (
          <button
            type="button"
            onClick={() => onRotate(0, 0, 0)}
            style={{
              marginLeft: 4,
              padding: '1px 5px',
              fontSize: 9,
              fontWeight: 600,
              background: 'rgba(239, 68, 68, 0.25)',
              color: '#fca5a5',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              borderRadius: 'var(--radius-sm, 3px)',
              cursor: 'pointer'
            }}
            title="Đưa toàn bộ góc xoay Gimbal 3D về 0°"
          >
            ↺ 0°
          </button>
        )}
      </div>
    </div>
  )
}
