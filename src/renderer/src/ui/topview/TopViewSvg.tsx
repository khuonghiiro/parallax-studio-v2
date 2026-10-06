import type React from 'react'
import type { Vec3 } from '@shared/types'
import type { EvaluatedLayer } from '../../engine/evaluateScene'
import { getTopViewCorners, TYPE_COLORS } from './topViewCommon'

interface TopViewSvgProps {
  size: { w: number; h: number }
  pad: number
  camPos: Vec3
  lx: number
  lz: number
  rx: number
  rz: number
  aimScreenX: number
  aimScreenZ: number
  targetScreenX: number
  targetScreenZ: number
  sx: (x: number) => number
  sz: (z: number) => number
  layers: EvaluatedLayer[]
  selected: string | null
  startLayerDrag: (e: React.PointerEvent, id: string) => void
  startCamPosDrag: (e: React.PointerEvent) => void
  startCamAngleDrag: (e: React.PointerEvent) => void
  startCamTargetDrag: (e: React.PointerEvent) => void
}

export function TopViewSvg({
  size,
  pad,
  camPos,
  lx,
  lz,
  rx,
  rz,
  aimScreenX,
  aimScreenZ,
  targetScreenX,
  targetScreenZ,
  sx,
  sz,
  layers,
  selected,
  startLayerDrag,
  startCamPosDrag,
  startCamAngleDrag,
  startCamTargetDrag
}: TopViewSvgProps) {
  return (
    <>
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
    </>
  )
}
