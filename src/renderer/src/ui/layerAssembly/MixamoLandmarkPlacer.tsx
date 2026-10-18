import { useEffect, useMemo, useRef, useState } from 'react'
import type { AssembledLayerItem, AssetTable, LayerComposite } from './types'
import { useLayerAssetImage } from './useLayerAssetImage'
import {
  MIXAMO_CORE_LANDMARK_IDS,
  MIXAMO_LANDMARK_META,
  autoDetectLandmarksFromComposite,
  buildHumanoidBonesFromLandmarks,
  createScaledLandmarks,
  moveLandmarkPoint,
  syncDerivedLandmarksFromCore8,
  type MixamoLandmarkId,
  type MixamoLandmarks
} from './workshopMixamoAutoRig'
import { MixamoBodyReferenceGuide, MixamoMarkerDock } from './MixamoReferenceGuide'

export interface MixamoLandmarkPlacerProps {
  composite?: LayerComposite
  landmarks: MixamoLandmarks
  onChange: (next: MixamoLandmarks) => void
  compact?: boolean
}

const SIZE_PRESETS = [
  { label: '👶 Nhỏ (60%)', scale: 0.6, title: 'Khung xương nhỏ cho nhân vật Chibi / Trẻ em' },
  { label: '🧒 Vừa (80%)', scale: 0.8, title: 'Khung xương cỡ vừa (80%)' },
  { label: '🧍 Chuẩn (100%)', scale: 1.0, title: 'Khung xương tỉ lệ người chuẩn (100%)' },
  { label: '🦸 Lớn (130%)', scale: 1.3, title: 'Khung xương lớn cho nhân vật cao to (130%)' }
]

const PLACE_SEQUENCE: MixamoLandmarkId[] = ['neck', 'wristL', 'elbowL', 'kneeL', 'pelvis']

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
        opacity: Math.min(0.92, layer.opacity ?? 1),
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
  onChange,
  compact = false
}: MixamoLandmarkPlacerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [draggingId, setDraggingId] = useState<MixamoLandmarkId | null>(null)
  const [hoveredId, setHoveredId] = useState<MixamoLandmarkId | null>(null)
  const [selectedDockId, setSelectedDockId] = useState<MixamoLandmarkId | null>('neck')
  const [symmetry, setSymmetry] = useState<boolean>(true)
  const [showBonesPreview, setShowBonesPreview] = useState<boolean>(false)
  const [showExtraJoints, setShowExtraJoints] = useState<boolean>(false)
  const [showGuide, setShowGuide] = useState<boolean>(!compact)
  const [uniformScale, setUniformScale] = useState<number>(100)

  const compW = Math.max(320, composite?.width || 550)
  const compH = Math.max(360, composite?.height || 600)
  const halfW = compW / 2
  const halfH = compH / 2
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

  // Hỗ trợ kéo vòng tròn trực tiếp từ Khay bên trái (Dock) sang vùng nhân vật
  useEffect(() => {
    if (!draggingId) return
    const handleWinMove = (e: PointerEvent) => {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      if (
        e.clientX >= rect.left - 20 &&
        e.clientX <= rect.right + 20 &&
        e.clientY >= rect.top - 20 &&
        e.clientY <= rect.bottom + 20
      ) {
        const pt = clientToSvgPoint(e.clientX, e.clientY)
        if (pt) {
          onChange(moveLandmarkPoint(landmarks, draggingId, pt, symmetry, true))
        }
      }
    }
    const handleWinUp = () => {
      setDraggingId(null)
    }
    window.addEventListener('pointermove', handleWinMove)
    window.addEventListener('pointerup', handleWinUp)
    return () => {
      window.removeEventListener('pointermove', handleWinMove)
      window.removeEventListener('pointerup', handleWinUp)
    }
  }, [draggingId, landmarks, symmetry, onChange])

  const handleCanvasClick = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingId || !selectedDockId) return
    const pt = clientToSvgPoint(e.clientX, e.clientY)
    if (!pt) return
    onChange(moveLandmarkPoint(landmarks, selectedDockId, pt, symmetry, true))
    const idx = PLACE_SEQUENCE.indexOf(selectedDockId)
    if (idx >= 0 && idx < PLACE_SEQUENCE.length - 1) {
      setSelectedDockId(PLACE_SEQUENCE[idx + 1])
    }
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
    return syncDerivedLandmarksFromCore8(next)
  }

  const handleApplyScalePreset = (scale: number) => {
    setUniformScale(Math.round(scale * 100))
    onChange(scaleFromBase(scale))
  }

  const handleAutoFit = () => {
    setUniformScale(100)
    onChange(syncDerivedLandmarksFromCore8(baseLandmarks))
  }

  const visibleMetaList = useMemo(
    () =>
      showExtraJoints
        ? MIXAMO_LANDMARK_META
        : MIXAMO_LANDMARK_META.filter((m) => MIXAMO_CORE_LANDMARK_IDS.includes(m.id)),
    [showExtraJoints]
  )

  const activeMeta = MIXAMO_LANDMARK_META.find(
    (m) => m.id === (draggingId || hoveredId || selectedDockId)
  )

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
      {/* Header + Toggles */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          padding: '6px 10px',
          background: 'var(--bg-2)',
          borderBottom: '1px solid var(--line-soft)',
          fontSize: '11px'
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--text)' }}>
          🎯 Đặt 8 Vòng Tròn Định Vị Xương (Mixamo Auto-Rigger)
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '10px',
              color: 'var(--text-dim)',
              cursor: 'pointer'
            }}
            title="Khi kéo vòng Cổ tay / Khuỷu tay / Đầu gối 1 bên, bên kia tự động đối xứng qua trục Háng (GROIN)"
          >
            <input
              type="checkbox"
              checked={symmetry}
              onChange={(e) => setSymmetry(e.target.checked)}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <span>🪞 Đối xứng</span>
          </label>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '10px',
              color: 'var(--text-dim)',
              cursor: 'pointer'
            }}
            title="Hiện bộ 15 xương tự động nối từ 8 vòng tròn Mixamo"
          >
            <input
              type="checkbox"
              checked={showBonesPreview}
              onChange={(e) => setShowBonesPreview(e.target.checked)}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <span>🦴 Xương</span>
          </label>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '10px',
              color: 'var(--text-dim)',
              cursor: 'pointer'
            }}
            title="Hiện thêm 6 khớp phụ (Đỉnh đầu, Ngực, 2 Vai, 2 Cổ chân) để tinh chỉnh thủ công nếu cần"
          >
            <input
              type="checkbox"
              checked={showExtraJoints}
              onChange={(e) => setShowExtraJoints(e.target.checked)}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <span>+6 khớp phụ</span>
          </label>
          <button
            type="button"
            className={`btn xs ${showGuide ? 'primary' : 'ghost'}`}
            onClick={() => setShowGuide((v) => !v)}
            style={{ fontSize: '9.5px', padding: '1px 6px' }}
            title="Ẩn/hiện sơ đồ hình nhân hướng dẫn đặt 5 màu vòng tròn Mixamo"
          >
            📖 Mẫu
          </button>
        </div>
      </div>

      {/* Thanh chọn nhanh kích cỡ nhân vật */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '4px',
          padding: '5px 8px',
          background: 'var(--bg-1)',
          borderBottom: '1px solid var(--line-soft)'
        }}
      >
        <button
          type="button"
          className="btn xs primary"
          onClick={handleAutoFit}
          title="Tự động đo kích thước layer nhân vật để đặt 8 vòng tròn Mixamo vừa khít"
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
            style={{ width: '56px', accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <strong style={{ minWidth: '28px', color: 'var(--text)' }}>{uniformScale}%</strong>
        </div>
      </div>

      {/* Bố cục 3 cột giống hệt Mixamo Auto-Rigger: [Khay 5 nhóm vòng tròn] | [Khung nhân vật + Trục đối xứng] | [Sơ đồ mẫu] */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          height: compact ? '255px' : '285px',
          width: '100%',
          overflow: 'hidden'
        }}
      >
        {/* Cột 1: Khay 5 nhóm vòng tròn Mixamo (CHIN, WRISTS, ELBOWS, KNEES, GROIN) */}
        <MixamoMarkerDock
          activeLandmarkId={draggingId || hoveredId || selectedDockId}
          onSelectLandmark={(id) => setSelectedDockId(id)}
          onStartDockDrag={(id) => {
            setSelectedDockId(id)
            setDraggingId(id)
          }}
        />

        {/* Cột 2: Sân khấu nhân vật + 8 Vòng tròn rỗng Mixamo */}
        <div
          style={{
            position: 'relative',
            flex: 1,
            minWidth: 0,
            height: '100%',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            background:
              'radial-gradient(circle at 50% 45%, rgba(30, 41, 59, 0.55), rgba(15, 23, 42, 0.92))'
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
            onPointerDown={handleCanvasClick}
          >
            {/* Hiển thị toàn bộ các layer của nhân vật */}
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

            {/* Đường trục đối xứng dọc đi qua tâm Háng (GROIN) giống hệt Mixamo */}
            <line
              x1={landmarks.pelvis.x}
              y1={-halfH}
              x2={landmarks.pelvis.x}
              y2={halfH}
              stroke="rgba(255, 255, 255, 0.65)"
              strokeWidth={1.6 * pinScale}
            />
            <line
              x1={-halfW}
              y1={landmarks.pelvis.y}
              x2={halfW}
              y2={landmarks.pelvis.y}
              stroke="rgba(224, 98, 135, 0.28)"
              strokeWidth={1.2 * pinScale}
              strokeDasharray="4 4"
            />

            {/* Vẽ 15 đoạn xương tự động được nội suy từ 8 vòng tròn */}
            {showBonesPreview &&
              previewBones.map((b) => {
                const rad = (b.angle * Math.PI) / 180
                const tx = b.x + Math.cos(rad) * b.length
                const ty = b.y + Math.sin(rad) * b.length
                return (
                  <g key={b.id} style={{ pointerEvents: 'none', opacity: 0.65 }}>
                    <line
                      x1={b.x}
                      y1={b.y}
                      x2={tx}
                      y2={ty}
                      stroke="rgba(15, 23, 42, 0.85)"
                      strokeWidth={4.2 * pinScale}
                      strokeLinecap="round"
                    />
                    <line
                      x1={b.x}
                      y1={b.y}
                      x2={tx}
                      y2={ty}
                      stroke="#38bdf8"
                      strokeWidth={2 * pinScale}
                      strokeDasharray={`${4 * pinScale} ${2.5 * pinScale}`}
                      strokeLinecap="round"
                    />
                  </g>
                )
              })}

            {/* Vẽ 8 Vòng Tròn Rỗng Chuẩn Mixamo (CHIN, WRISTS, ELBOWS, KNEES, GROIN) */}
            {visibleMetaList.map((meta) => {
              const pt = landmarks[meta.id]
              const isActive =
                draggingId === meta.id || hoveredId === meta.id || selectedDockId === meta.id
              const isCore = meta.isCoreMixamo !== false
              const ringR = (isCore ? (isActive ? 15.5 : 13) : isActive ? 9 : 7) * pinScale
              return (
                <g
                  key={meta.id}
                  transform={`translate(${pt.x}, ${pt.y})`}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    setSelectedDockId(meta.id)
                    setDraggingId(meta.id)
                  }}
                  onPointerEnter={() => setHoveredId(meta.id)}
                  onPointerLeave={() => setHoveredId((prev) => (prev === meta.id ? null : prev))}
                >
                  {/* Vòng viền đen tương phản bên ngoài */}
                  <circle
                    r={ringR}
                    fill="rgba(15, 23, 42, 0.22)"
                    stroke="rgba(0, 0, 0, 0.85)"
                    strokeWidth={(isCore ? 6.4 : 4) * pinScale}
                  />
                  {/* Vòng màu rỗng đặc trưng của Mixamo */}
                  <circle
                    r={ringR}
                    fill="none"
                    stroke={meta.color}
                    strokeWidth={(isCore ? (isActive ? 4.6 : 3.8) : 2.4) * pinScale}
                  />
                  {/* Chữ thập ngắm tâm bên trong vòng tròn */}
                  {isCore && (
                    <>
                      <line
                        x1={-5 * pinScale}
                        y1={0}
                        x2={5 * pinScale}
                        y2={0}
                        stroke="rgba(255,255,255,0.55)"
                        strokeWidth={1.1 * pinScale}
                      />
                      <line
                        x1={0}
                        y1={-5 * pinScale}
                        x2={0}
                        y2={5 * pinScale}
                        stroke="rgba(255,255,255,0.55)"
                        strokeWidth={1.1 * pinScale}
                      />
                    </>
                  )}
                  {/* Chấm tâm chính xác */}
                  <circle
                    r={(isCore ? 2.6 : 2) * pinScale}
                    fill="#ffffff"
                    stroke="rgba(0,0,0,0.85)"
                    strokeWidth={1.1 * pinScale}
                  />

                  {/* Nhãn hiển thị khi rê chuột hoặc đang chọn */}
                  {isActive && (
                    <text
                      x={0}
                      y={-ringR - 6 * pinScale}
                      textAnchor="middle"
                      fill="#ffffff"
                      stroke="rgba(0,0,0,0.9)"
                      strokeWidth={3.5 * pinScale}
                      paintOrder="stroke"
                      fontSize={11.5 * pinScale}
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

          {/* Thanh trạng thái hướng dẫn phía dưới sân khấu */}
          <div
            style={{
              position: 'absolute',
              bottom: '4px',
              left: '6px',
              right: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '9.5px',
              color: '#f8fafc',
              background: 'rgba(15, 23, 42, 0.78)',
              padding: '2px 7px',
              borderRadius: '4px',
              pointerEvents: 'none'
            }}
          >
            {activeMeta ? (
              <span style={{ color: activeMeta.color, fontWeight: 700 }}>
                🎯 {activeMeta.label}: ({landmarks[activeMeta.id].x}, {landmarks[activeMeta.id].y})
              </span>
            ) : (
              <span>💡 Kéo 8 vòng tròn đặt vào Cằm, Cổ tay, Khuỷu tay, Đầu gối, Háng</span>
            )}
            <span>8 điểm → 15 xương</span>
          </div>
        </div>

        {/* Cột 3: Sơ đồ hình nhân mẫu 5 màu (giống Ảnh 1 của Mixamo) */}
        {showGuide && <MixamoBodyReferenceGuide />}
      </div>
    </div>
  )
}
