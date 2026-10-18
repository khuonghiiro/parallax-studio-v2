import { useMemo, useRef, useState } from 'react'
import type { AssembledLayerItem, AssetTable, LayerComposite } from './types'
import { useLayerAssetImage } from './useLayerAssetImage'
import {
  MIXAMO_LANDMARK_META,
  autoDetectLandmarksFromComposite,
  buildHumanoidBonesFromLandmarks,
  createScaledLandmarks,
  moveLandmarkPoint,
  type MixamoLandmarkId,
  type MixamoLandmarks
} from './workshopMixamoAutoRig'

export interface MixamoLandmarkPlacerProps {
  composite?: LayerComposite
  landmarks: MixamoLandmarks
  onChange: (next: MixamoLandmarks) => void
}

const SIZE_PRESETS = [
  { label: '👶 Nhỏ (60%)', scale: 0.6, title: 'Khung xương nhỏ cho nhân vật Chibi / Trẻ em' },
  { label: '🧒 Vừa (80%)', scale: 0.8, title: 'Khung xương cỡ vừa (80%)' },
  { label: '🧍 Chuẩn (100%)', scale: 1.0, title: 'Khung xương tỉ lệ người chuẩn (100%)' },
  { label: '🦸 Lớn (130%)', scale: 1.3, title: 'Khung xương lớn cho nhân vật cao to (130%)' }
]

function LandmarkLayerImg({
  layer,
  assetTable
}: {
  layer: AssembledLayerItem
  assetTable?: AssetTable
}) {
  const imageUrl = useLayerAssetImage(layer.asset || layer.assetPath, layer.imageUrl, assetTable)
  if (!imageUrl) return null
  const scale = Math.max(0.05, layer.scale || 1)
  const rot = layer.rotation || 0
  return (
    <img
      src={imageUrl}
      alt={layer.name}
      draggable={false}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) translate(${layer.x}px, ${layer.y}px) rotate(${rot}deg) scale(${scale})`,
        transformOrigin: '50% 50%',
        opacity: Math.min(0.88, layer.opacity ?? 1),
        pointerEvents: 'none',
        userSelect: 'none',
        maxWidth: 'none'
      }}
    />
  )
}

export function MixamoLandmarkPlacer({
  composite,
  landmarks,
  onChange
}: MixamoLandmarkPlacerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [draggingId, setDraggingId] = useState<MixamoLandmarkId | null>(null)
  const [hoveredId, setHoveredId] = useState<MixamoLandmarkId | null>(null)
  const [symmetry, setSymmetry] = useState<boolean>(true)
  const [uniformScale, setUniformScale] = useState<number>(100)

  const compW = Math.max(320, composite?.width || 550)
  const compH = Math.max(360, composite?.height || 600)
  const halfW = compW / 2
  const halfH = compH / 2
  // Quy đổi kích thước hiển thị chấm tròn theo kích thước khung composite
  const pinScale = Math.max(1, Math.min(2.2, Math.max(compW, compH) / 480))

  const previewBones = useMemo(() => buildHumanoidBonesFromLandmarks(landmarks), [landmarks])

  const visibleLayers = useMemo(
    () =>
      (composite?.layers ?? [])
        .filter((l) => !l.hidden)
        .slice()
        .sort((a, b) => b.z - a.z),
    [composite]
  )

  const clientToSvgPoint = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current
    if (!svg) return null
    const ctm = typeof svg.getScreenCTM === 'function' ? svg.getScreenCTM() : null
    if (ctm) {
      const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
      return {
        x: Math.max(-halfW + 10, Math.min(halfW - 10, Math.round(pt.x))),
        y: Math.max(-halfH + 10, Math.min(halfH - 10, Math.round(pt.y)))
      }
    }
    const rect = svg.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    const x = -halfW + ((clientX - rect.left) / rect.width) * compW
    const y = -halfH + ((clientY - rect.top) / rect.height) * compH
    return {
      x: Math.max(-halfW + 10, Math.min(halfW - 10, Math.round(x))),
      y: Math.max(-halfH + 10, Math.min(halfH - 10, Math.round(y)))
    }
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingId) return
    const pt = clientToSvgPoint(e.clientX, e.clientY)
    if (!pt) return
    onChange(moveLandmarkPoint(landmarks, draggingId, pt, symmetry))
  }

  const handlePointerUp = () => {
    if (draggingId) setDraggingId(null)
  }

  const baseLandmarks = useMemo(
    () => (composite ? autoDetectLandmarksFromComposite(composite) : createScaledLandmarks(1)),
    [composite]
  )

  const scaleFromBase = (ratio: number): MixamoLandmarks => {
    const cx = baseLandmarks.pelvis.x
    const cy = 0
    const next = {} as MixamoLandmarks
    for (const [k, pt] of Object.entries(baseLandmarks) as Array<[MixamoLandmarkId, { x: number; y: number }]>) {
      next[k] = {
        x: Math.round(cx + (pt.x - cx) * ratio),
        y: Math.round(cy + (pt.y - cy) * ratio)
      }
    }
    return next
  }

  const handleApplyScalePreset = (scale: number) => {
    setUniformScale(Math.round(scale * 100))
    onChange(scaleFromBase(scale))
  }

  const handleAutoFit = () => {
    setUniformScale(100)
    onChange(baseLandmarks)
  }

  const activeMeta = MIXAMO_LANDMARK_META.find((m) => m.id === (draggingId || hoveredId))

  return (
    <div
      className="lw-mixamo-landmark-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-0)',
        border: '1px solid var(--line)',
        borderRadius: '8px',
        overflow: 'hidden'
      }}
    >
      {/* Header + Symmetry Toggle */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '4px',
          padding: '6px 10px',
          background: 'var(--bg-2)',
          borderBottom: '1px solid var(--line-soft)',
          fontSize: '11px'
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>
          📍 Gắn Điểm Định Vị Xương (Mixamo Auto-Rig)
        </span>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '10.5px',
            color: 'var(--text-dim)',
            cursor: 'pointer'
          }}
          title="Khi kéo điểm bên Trái, điểm bên Phải tự động đối xứng theo trục Hông"
        >
          <input
            type="checkbox"
            checked={symmetry}
            onChange={(e) => setSymmetry(e.target.checked)}
            style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <span>🪞 Đối xứng 2 bên</span>
        </label>
      </div>

      {/* Thanh chọn nhanh kích cỡ nhân vật */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 8px',
          background: 'var(--bg-1)',
          borderBottom: '1px solid var(--line-soft)'
        }}
      >
        <button
          type="button"
          className="btn xs primary"
          onClick={handleAutoFit}
          title="Tự động đo kích thước layer nhân vật để đặt khung xương vừa khít"
          style={{ fontSize: '10px', padding: '2px 7px' }}
        >
          🎯 Tự khớp ảnh
        </button>
        {SIZE_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="btn xs"
            onClick={() => handleApplyScalePreset(p.scale)}
            title={p.title}
            style={{ fontSize: '10px', padding: '2px 6px' }}
          >
            {p.label}
          </button>
        ))}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: 'auto',
            fontSize: '10px',
            color: 'var(--text-dim)'
          }}
          title="Thu phóng nhanh toàn bộ khung điểm xương cho vừa nhân vật nhỏ/lớn"
        >
          <span>Cỡ:</span>
          <input
            type="range"
            min={35}
            max={160}
            step={5}
            value={uniformScale}
            onChange={(e) => {
              const val = Number(e.target.value)
              setUniformScale(val)
              onChange(scaleFromBase(val / 100))
            }}
            style={{ width: '64px', accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <strong style={{ minWidth: '30px', color: 'var(--text)' }}>{uniformScale}%</strong>
        </div>
      </div>

      {/* Canvas đặt điểm nhấn trên nhân vật */}
      <div
        style={{
          position: 'relative',
          height: '260px',
          width: '100%',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`${-halfW} ${-halfH} ${compW} ${compH}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            cursor: draggingId ? 'grabbing' : 'crosshair'
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Hiển thị đúng toàn bộ các layer của nhân vật trong cùng hệ tọa độ composite */}
          {visibleLayers.length > 0 && (
            <foreignObject
              x={-halfW}
              y={-halfH}
              width={compW}
              height={compH}
              style={{ pointerEvents: 'none', overflow: 'visible' }}
            >
              <div
                style={{
                  position: 'relative',
                  width: `${compW}px`,
                  height: `${compH}px`,
                  pointerEvents: 'none',
                  overflow: 'hidden'
                }}
              >
                {visibleLayers.map((layer) => (
                  <LandmarkLayerImg
                    key={layer.id}
                    layer={layer}
                    assetTable={composite?.assets}
                  />
                ))}
              </div>
            </foreignObject>
          )}

          {/* Trục tâm tham chiếu */}
          <line
            x1={-halfW}
            y1={0}
            x2={halfW}
            y2={0}
            stroke="var(--line-soft)"
            strokeWidth={1.5 * pinScale}
            strokeDasharray="4 4"
          />
          <line
            x1={landmarks.pelvis.x}
            y1={-halfH}
            x2={landmarks.pelvis.x}
            y2={halfH}
            stroke="rgba(56, 189, 248, 0.3)"
            strokeWidth={1.5 * pinScale}
            strokeDasharray="5 5"
          />

          {/* Vẽ các đoạn xương được tự động nối từ các điểm nhấn */}
          {previewBones.map((b) => {
            const rad = (b.angle * Math.PI) / 180
            const tx = b.x + Math.cos(rad) * b.length
            const ty = b.y + Math.sin(rad) * b.length
            return (
              <g key={b.id} style={{ pointerEvents: 'none' }}>
                <line
                  x1={b.x}
                  y1={b.y}
                  x2={tx}
                  y2={ty}
                  stroke="rgba(15, 23, 42, 0.8)"
                  strokeWidth={5 * pinScale}
                  strokeLinecap="round"
                />
                <line
                  x1={b.x}
                  y1={b.y}
                  x2={tx}
                  y2={ty}
                  stroke="#38bdf8"
                  strokeWidth={2.5 * pinScale}
                  strokeDasharray={`${5 * pinScale} ${2.5 * pinScale}`}
                  strokeLinecap="round"
                />
              </g>
            )
          })}

          {/* Vẽ 14 điểm nhấn kéo thả (Mixamo Landmarks) */}
          {MIXAMO_LANDMARK_META.map((meta) => {
            const pt = landmarks[meta.id]
            const isActive = draggingId === meta.id || hoveredId === meta.id
            const outerR = (isActive ? 13 : 9.5) * pinScale
            const innerR = (isActive ? 5.5 : 4.2) * pinScale
            return (
              <g
                key={meta.id}
                transform={`translate(${pt.x}, ${pt.y})`}
                style={{ cursor: 'grab' }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  e.currentTarget.setPointerCapture(e.pointerId)
                  setDraggingId(meta.id)
                }}
                onPointerEnter={() => setHoveredId(meta.id)}
                onPointerLeave={() => setHoveredId((prev) => (prev === meta.id ? null : prev))}
              >
                <circle
                  r={outerR}
                  fill="rgba(15, 23, 42, 0.65)"
                  stroke={meta.color}
                  strokeWidth={(isActive ? 2.8 : 2) * pinScale}
                />
                <circle r={innerR} fill={meta.color} />
                {isActive && (
                  <text
                    x={0}
                    y={-outerR - 6 * pinScale}
                    textAnchor="middle"
                    fill="#ffffff"
                    stroke="rgba(0,0,0,0.85)"
                    strokeWidth={3.5 * pinScale}
                    paintOrder="stroke"
                    fontSize={12 * pinScale}
                    fontWeight="700"
                    style={{ pointerEvents: 'none' }}
                  >
                    {meta.label} ({pt.x}, {pt.y})
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Chú thích chân trang */}
        <div
          style={{
            position: 'absolute',
            bottom: '5px',
            left: '8px',
            right: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '10px',
            color: '#f8fafc',
            background: 'rgba(15, 23, 42, 0.72)',
            padding: '2px 8px',
            borderRadius: '4px',
            pointerEvents: 'none'
          }}
        >
          {activeMeta ? (
            <span style={{ color: activeMeta.color, fontWeight: 600 }}>
              🎯 {activeMeta.label}: ({landmarks[activeMeta.id].x}, {landmarks[activeMeta.id].y}) — Xương tự co giãn theo điểm
            </span>
          ) : (
            <span>
              💡 Kéo các vòng tròn đặt vào Đầu, Ngực, Hông, Khuỷu tay, Đầu gối nhân vật
            </span>
          )}
          <span>15 khớp tự động</span>
        </div>
      </div>
    </div>
  )
}
