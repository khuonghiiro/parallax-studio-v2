import type React from 'react'
import type { EvaluatedLayer } from '../../engine/evaluateScene'
import { getTopViewCorners, TYPE_COLORS } from './topViewCommon'

interface SideViewSvgProps {
  size: { w: number; h: number }
  pad: number
  camScreenSideX: number
  camScreenSideY: number
  topSideZ: number
  topSideY: number
  botSideZ: number
  botSideY: number
  aimScreenSideX: number
  aimScreenSideY: number
  targetScreenSideX: number
  targetScreenSideY: number
  sideZ: (z: number) => number
  sideY: (y: number) => number
  layers: EvaluatedLayer[]
  selected: string | null
  startLayerDrag: (e: React.PointerEvent, id: string) => void
  startCamPosDrag: (e: React.PointerEvent) => void
  startCamAngleDrag: (e: React.PointerEvent) => void
  startCamTargetDrag: (e: React.PointerEvent) => void
}

export function SideViewSvg({
  size,
  pad,
  camScreenSideX,
  camScreenSideY,
  topSideZ,
  topSideY,
  botSideZ,
  botSideY,
  aimScreenSideX,
  aimScreenSideY,
  targetScreenSideX,
  targetScreenSideY,
  sideZ,
  sideY,
  layers,
  selected,
  startLayerDrag,
  startCamPosDrag,
  startCamAngleDrag,
  startCamTargetDrag
}: SideViewSvgProps) {
  return (
    <>
      {/* Depth Grid Lines (Vertical) */}
      {Array.from({ length: 9 }, (_, i) => {
        const x = pad + (i / 8) * (size.w - pad * 2)
        return <line key={i} x1={x} x2={x} y1={0} y2={size.h} stroke="var(--line-soft)" strokeWidth={1} />
      })}

      {/* Height Horizon Plane (Y = 0) */}
      <line x1={0} x2={size.w} y1={sideY(0)} y2={sideY(0)} stroke="var(--line)" strokeDasharray="3 4" />
      {/* Zero Depth Plane (Z = 0) */}
      <line x1={sideZ(0)} x2={sideZ(0)} y1={0} y2={size.h} stroke="var(--line-soft)" strokeDasharray="2 4" />

      {/* Spatial Zone Labels (Top of screen) */}
      <text className="tv-zone-label" x={sideZ(-150)} y={18}>Tiền cảnh</text>
      <text className="tv-zone-label" x={sideZ(350)} y={18}>Trung cảnh</text>
      <text className="tv-zone-label" x={sideZ(1100)} y={18}>Hậu cảnh</text>

      {/* Reference Zero Labels */}
      <text className="tv-zero-label" x={12} y={sideY(0) - 4}>Y = 0 (Chân trời)</text>
      <text className="tv-zero-label" x={sideZ(0) + 4} y={size.h - 10}>Z = 0 (Gốc)</text>

      {/* Camera Frustum (Side View Vertical Field of View) */}
      <polygon
        points={`${camScreenSideX},${camScreenSideY} ${sideZ(topSideZ)},${sideY(topSideY)} ${sideZ(botSideZ)},${sideY(botSideY)}`}
        fill="url(#frustum-side)"
        stroke="var(--accent-cyan)"
        strokeOpacity={0.35}
      />

      {/* Line of Sight */}
      <line x1={camScreenSideX} y1={camScreenSideY} x2={aimScreenSideX} y2={aimScreenSideY} stroke="var(--accent-cyan)" strokeWidth={2} strokeOpacity={0.8} />
      <line x1={aimScreenSideX} y1={aimScreenSideY} x2={targetScreenSideX} y2={targetScreenSideY} stroke="var(--accent-cyan)" strokeWidth={1.2} strokeDasharray="3 3" strokeOpacity={0.5} />

      {/* Target handle */}
      <g className="tv-cam-target" transform={`translate(${targetScreenSideX},${targetScreenSideY})`} onPointerDown={startCamTargetDrag}>
        <title>Điểm nhìn camera: Kéo để nâng hạ độ cao Y và độ sâu Z</title>
        <circle r={10} fill="transparent" />
        <circle r={5} fill="none" stroke="var(--accent-cyan)" strokeWidth={1.5} strokeOpacity={0.7} />
        <circle r={2} fill="var(--accent-cyan)" />
      </g>

      {/* Aim angle handle (Pitch) */}
      <g className="tv-cam-aim" transform={`translate(${aimScreenSideX},${aimScreenSideY})`} onPointerDown={startCamAngleDrag}>
        <title>Góc nghiêng camera (Pitch): Kéo để ngửa lên / chúi xuống</title>
        <circle r={12} fill="transparent" />
        <circle r={5} fill="var(--accent-cyan)" fillOpacity={0.25} stroke="var(--accent-cyan)" strokeWidth={1.5} />
      </g>

      {/* Layers in Side View */}
      {layers.map((l) => {
        const { p0, p1, p2, p3 } = getTopViewCorners(l.position, l.rotation, l.scale, l.size)
        const halfH = (l.size[1] * l.scale[1]) / 2
        const isSel = l.layer.id === selected
        const color = TYPE_COLORS[l.layer.type] || '#8b7bff'
        const isTilted = Math.abs(p0[2] - p3[2]) > 10 || Math.abs(p0[1] - p2[1]) < halfH * 0.8

        return (
          <g
            key={l.layer.id}
            className="tv-layer"
            onPointerDown={(e) => startLayerDrag(e, l.layer.id)}
            style={{ cursor: 'move' }}
          >
            <title>{`${l.layer.name}\nKéo để di chuyển (Độ sâu Z, Độ cao Y)\nShift: Khóa trục · Alt: Snap lưới`}</title>
            {isTilted ? (
              <polygon
                points={`${sideZ(p0[2])},${sideY(p0[1])} ${sideZ(p1[2])},${sideY(p1[1])} ${sideZ(p2[2])},${sideY(p2[1])} ${sideZ(p3[2])},${sideY(p3[1])}`}
                fill={color}
                fillOpacity={isSel ? 0.4 : 0.15}
                stroke={color}
                strokeWidth={isSel ? 2.5 : 1.5}
              />
            ) : (
              <>
                <line
                  x1={sideZ(l.position[2])}
                  x2={sideZ(l.position[2])}
                  y1={sideY(l.position[1] - halfH)}
                  y2={sideY(l.position[1] + halfH)}
                  stroke="transparent"
                  strokeWidth={16}
                />
                <line
                  x1={sideZ(l.position[2])}
                  x2={sideZ(l.position[2])}
                  y1={sideY(l.position[1] - halfH)}
                  y2={sideY(l.position[1] + halfH)}
                  stroke={color}
                  strokeWidth={isSel ? 3.5 : 2}
                  strokeOpacity={l.active ? 1 : 0.4}
                  style={{ filter: isSel ? `drop-shadow(0 0 6px ${color})` : undefined }}
                />
              </>
            )}
            <text
              className={`tv-label${isSel ? ' selected' : ''}`}
              x={sideZ(l.position[2]) + 4}
              y={sideY(l.position[1] + halfH) - 4}
              fill={isSel ? '#ffffff' : '#cbd5e1'}
            >
              {l.layer.name}
            </text>
          </g>
        )
      })}

      {/* Camera Position Dot (Side View) */}
      <g className="tv-cam-group" transform={`translate(${camScreenSideX},${camScreenSideY})`} onPointerDown={startCamPosDrag}>
        <title>Vị trí Camera: Kéo để di chuyển (Z, Y)</title>
        <circle r={16} fill="transparent" />
        <circle className="tv-cam-pulse" r={10} fill="none" stroke="var(--accent-cyan)" strokeOpacity={0.6} strokeWidth={1.5} />
        <circle r={5.5} fill="var(--accent-cyan)" />
      </g>
    </>
  )
}
