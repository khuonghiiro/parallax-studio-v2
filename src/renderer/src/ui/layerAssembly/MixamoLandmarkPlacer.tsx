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
  syncSpineLandmarks,
  type MixamoLandmarkId,
  type MixamoLandmarks
} from './workshopMixamoAutoRig'
import { MixamoBodyReferenceGuide, MixamoHollowRingIcon, MixamoMarkerDock } from './MixamoReferenceGuide'
import { MixamoPlacerToolbar, MixamoRingChips } from './MixamoPlacerToolbar'

export interface MixamoLandmarkPlacerProps {
  composite?: LayerComposite
  landmarks: MixamoLandmarks
  onChange: (next: MixamoLandmarks) => void
  compact?: boolean
  fullHeight?: boolean
}

const PLACE_SEQUENCE: MixamoLandmarkId[] = [
  'neck',
  'shoulderL',
  'elbowL',
  'wristL',
  'pelvis',
  'kneeL',
  'ankleL'
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
        opacity: Math.min(0.95, layer.opacity ?? 1),
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
  compact = false,
  fullHeight = false
}: MixamoLandmarkPlacerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [draggingId, setDraggingId] = useState<MixamoLandmarkId | null>(null)
  const [hoveredId, setHoveredId] = useState<MixamoLandmarkId | null>(null)
  const [selectedDockId, setSelectedDockId] = useState<MixamoLandmarkId>('neck')
  const [symmetry, setSymmetry] = useState<boolean>(true)
  const [showBonesPreview, setShowBonesPreview] = useState<boolean>(true)
  const [showExtraJoints, setShowExtraJoints] = useState<boolean>(false)
  const [showGuide, setShowGuide] = useState<boolean>(!compact)
  const [uniformScale, setUniformScale] = useState<number>(100)
  const [zoom, setZoom] = useState<number>(1)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState<boolean>(false)

  const compW = Math.max(320, composite?.width || 550)
  const compH = Math.max(360, composite?.height || 600)
  const halfW = compW / 2
  const halfH = compH / 2
  const viewW = compW / zoom
  const viewH = compH / zoom
  const viewX = -viewW / 2 - pan.x
  const viewY = -viewH / 2 - pan.y
  const pinScale = Math.max(0.85, Math.min(1.85, Math.max(compW, compH) / 520)) / Math.sqrt(zoom)

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
        x: Math.max(-halfW + 6, Math.min(halfW - 6, Math.round(pt.x))),
        y: Math.max(-halfH + 6, Math.min(halfH - 6, Math.round(pt.y)))
      }
    }
    const rect = svg.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    const x = viewX + ((clientX - rect.left) / rect.width) * viewW
    const y = viewY + ((clientY - rect.top) / rect.height) * viewH
    return {
      x: Math.max(-halfW + 6, Math.min(halfW - 6, Math.round(x))),
      y: Math.max(-halfH + 6, Math.min(halfH - 6, Math.round(y)))
    }
  }

  // Hỗ trợ kéo vòng tròn trực tiếp từ Khay bên trái hoặc trên nhân vật
  useEffect(() => {
    if (!draggingId) return
    const handleWinMove = (e: PointerEvent) => {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      if (
        e.clientX >= rect.left - 24 &&
        e.clientX <= rect.right + 24 &&
        e.clientY >= rect.top - 24 &&
        e.clientY <= rect.bottom + 24
      ) {
        const pt = clientToSvgPoint(e.clientX, e.clientY)
        if (pt) {
          onChange(moveLandmarkPoint(landmarks, draggingId, pt, symmetry && !e.altKey, true))
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
  }, [draggingId, landmarks, symmetry, onChange, zoom, pan])

  const handleCanvasPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button === 1 || e.shiftKey) {
      e.preventDefault()
      setIsPanning(true)
      const startX = e.clientX
      const startY = e.clientY
      const startPan = { ...pan }
      const rect = e.currentTarget.getBoundingClientRect()
      const factorX = rect.width > 0 ? viewW / rect.width : 1
      const factorY = rect.height > 0 ? viewH / rect.height : 1
      const onMove = (ev: PointerEvent) => {
        setPan({
          x: Math.round(startPan.x + (ev.clientX - startX) * factorX),
          y: Math.round(startPan.y + (ev.clientY - startY) * factorY)
        })
      }
      const onUp = () => {
        setIsPanning(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      return
    }
    if (draggingId || !selectedDockId) return
    const pt = clientToSvgPoint(e.clientX, e.clientY)
    if (!pt) return
    onChange(moveLandmarkPoint(landmarks, selectedDockId, pt, symmetry && !e.altKey, true))
    const idx = PLACE_SEQUENCE.indexOf(selectedDockId)
    if (idx >= 0 && idx < PLACE_SEQUENCE.length - 1) {
      setSelectedDockId(PLACE_SEQUENCE[idx + 1])
    }
  }

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const delta = e.deltaY < 0 ? 0.15 : -0.15
    setZoom((z) => Math.max(0.6, Math.min(2.8, Number((z + delta).toFixed(2)))))
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
    return syncSpineLandmarks(next)
  }

  const handleApplyScalePreset = (scale: number) => {
    setUniformScale(Math.round(scale * 100))
    onChange(scaleFromBase(scale))
  }

  const handleAutoFit = () => {
    setUniformScale(100)
    setZoom(1)
    setPan({ x: 0, y: 0 })
    onChange(syncSpineLandmarks(baseLandmarks))
  }

  const visibleMetaList = useMemo(
    () =>
      showExtraJoints
        ? MIXAMO_LANDMARK_META
        : MIXAMO_LANDMARK_META.filter((m) => MIXAMO_CORE_LANDMARK_IDS.includes(m.id)),
    [showExtraJoints]
  )

  const activeId: MixamoLandmarkId = draggingId || hoveredId || selectedDockId || 'neck'
  const activeMeta =
    MIXAMO_LANDMARK_META.find((m) => m.id === activeId) ?? MIXAMO_LANDMARK_META[0]
  const activePt = landmarks[activeMeta.id]

  const updateActiveCoord = (axis: 'x' | 'y', val: number) => {
    if (!Number.isFinite(val)) return
    const nextPt = {
      x: axis === 'x' ? Math.round(val) : activePt.x,
      y: axis === 'y' ? Math.round(val) : activePt.y
    }
    onChange(moveLandmarkPoint(landmarks, activeMeta.id, nextPt, symmetry, true))
  }

  return (
    <div
      className="lw-mixamo-landmark-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: fullHeight ? 1 : undefined,
        minHeight: fullHeight ? 0 : undefined,
        height: fullHeight ? '100%' : undefined,
        background: 'var(--bg-0)',
        border: '1px solid var(--line)',
        borderRadius: '8px',
        overflow: 'hidden'
      }}
    >
      <MixamoPlacerToolbar
        compact={compact}
        scale={uniformScale}
        onAutoFit={handleAutoFit}
        onScalePreset={handleApplyScalePreset}
        onScaleSlider={(val) => {
          setUniformScale(val)
          onChange(scaleFromBase(val / 100))
        }}
        symmetry={symmetry}
        setSymmetry={setSymmetry}
        showBones={showBonesPreview}
        setShowBones={setShowBonesPreview}
        showExtra={showExtraJoints}
        setShowExtra={setShowExtraJoints}
        showGuide={showGuide}
        setShowGuide={setShowGuide}
      />

      {compact && <MixamoRingChips activeId={activeId} onSelect={(id) => setSelectedDockId(id)} />}

      {/* Bố cục chính: [Khay 7 nhóm khớp (khi không compact)] | [Sân khấu nhân vật phóng to/thu nhỏ] | [Sơ đồ mẫu] */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          flex: fullHeight ? 1 : undefined,
          minHeight: fullHeight ? '360px' : undefined,
          height: fullHeight ? '100%' : compact ? '270px' : '380px',
          width: '100%',
          overflow: 'hidden'
        }}
      >
        {!compact && (
          <MixamoMarkerDock
            activeLandmarkId={activeId}
            onSelectLandmark={(id) => setSelectedDockId(id)}
            onStartDockDrag={(id) => {
              setSelectedDockId(id)
              setDraggingId(id)
            }}
            landmarks={landmarks}
          />
        )}

        {/* Sân khấu nhân vật trung tâm — hoàn toàn sạch, không có chữ hay thanh trạng thái đè lên nhân vật */}
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
              'radial-gradient(circle at 50% 45%, rgba(30, 41, 59, 0.52), rgba(15, 23, 42, 0.94))'
          }}
        >
          {/* Cụm nút Phóng to / Thu nhỏ gọn ở góc trên bên phải */}
          <div
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              zIndex: 5,
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              padding: '2px 4px',
              borderRadius: '5px',
              background: 'rgba(15, 23, 42, 0.72)',
              border: '1px solid rgba(148, 163, 184, 0.22)',
              backdropFilter: 'blur(4px)'
            }}
          >
            <button
              type="button"
              className="btn xs ghost"
              onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.2).toFixed(2))))}
              title="Thu nhỏ khung nhìn (Lăn chuột xuống)"
              style={{ padding: '0 5px', height: '18px', fontSize: '10px', color: '#e2e8f0' }}
            >
              −
            </button>
            <button
              type="button"
              className="btn xs ghost"
              onClick={() => {
                setZoom(1)
                setPan({ x: 0, y: 0 })
              }}
              title="Đặt lại phóng đại 100% và căn giữa (Giữ Shift + kéo chuột để dịch chuyển khung nhìn)"
              style={{ padding: '0 5px', height: '18px', fontSize: '9.5px', color: '#e2e8f0' }}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              className="btn xs ghost"
              onClick={() => setZoom((z) => Math.min(2.8, Number((z + 0.2).toFixed(2))))}
              title="Phóng to khung nhìn để đặt khớp thật chuẩn (Lăn chuột lên)"
              style={{ padding: '0 5px', height: '18px', fontSize: '10px', color: '#e2e8f0' }}
            >
              +
            </button>
          </div>

          <svg
            ref={svgRef}
            viewBox={`${viewX} ${viewY} ${viewW} ${viewH}`}
            preserveAspectRatio="xMidYMid meet"
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              cursor: isPanning ? 'grabbing' : draggingId ? 'grabbing' : 'crosshair'
            }}
            onPointerDown={handleCanvasPointerDown}
            onWheel={handleWheel}
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

            {/* Đường trục đối xứng dọc qua tâm Háng (GROIN) */}
            <line
              x1={landmarks.pelvis.x}
              y1={-halfH}
              x2={landmarks.pelvis.x}
              y2={halfH}
              stroke="rgba(255, 255, 255, 0.42)"
              strokeWidth={1.2 * pinScale}
              strokeDasharray={`${5 * pinScale} ${4 * pinScale}`}
            />
            <line
              x1={-halfW}
              y1={landmarks.pelvis.y}
              x2={halfW}
              y2={landmarks.pelvis.y}
              stroke="rgba(236, 72, 153, 0.25)"
              strokeWidth={1 * pinScale}
              strokeDasharray={`${4 * pinScale} ${4 * pinScale}`}
            />

            {/* Vẽ 15 đoạn xương tự động nối từ 12 vòng tròn giải phẫu */}
            {showBonesPreview &&
              previewBones.map((b) => {
                const rad = (b.angle * Math.PI) / 180
                const tx = b.x + Math.cos(rad) * b.length
                const ty = b.y + Math.sin(rad) * b.length
                return (
                  <g key={b.id} style={{ pointerEvents: 'none', opacity: 0.62 }}>
                    <line
                      x1={b.x}
                      y1={b.y}
                      x2={tx}
                      y2={ty}
                      stroke="rgba(15, 23, 42, 0.8)"
                      strokeWidth={3.2 * pinScale}
                      strokeLinecap="round"
                    />
                    <line
                      x1={b.x}
                      y1={b.y}
                      x2={tx}
                      y2={ty}
                      stroke="#38bdf8"
                      strokeWidth={1.6 * pinScale}
                      strokeDasharray={`${3.5 * pinScale} ${2.2 * pinScale}`}
                      strokeLinecap="round"
                    />
                  </g>
                )
              })}

            {/* Vẽ 12 Vòng Tròn Rỗng Giải Phẫu (Cằm, 2 Vai, 2 Khuỷu tay, 2 Cổ tay, Háng, 2 Đầu gối, 2 Cổ chân) */}
            {visibleMetaList.map((meta) => {
              const pt = landmarks[meta.id]
              const isDraggingThis = draggingId === meta.id
              const isActive =
                isDraggingThis || hoveredId === meta.id || selectedDockId === meta.id
              const isCore = meta.isCoreMixamo !== false
              const ringR = (isCore ? (isActive ? 11.5 : 9.5) : isActive ? 7.5 : 6) * pinScale
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
                  <title>{`${meta.label} (${pt.x}, ${pt.y})`}</title>
                  {/* Vùng bắt chuột rộng rãi nhưng trong suốt */}
                  <circle r={ringR + 4 * pinScale} fill="transparent" />
                  {/* Vòng viền đen tương phản bên ngoài */}
                  <circle
                    r={ringR}
                    fill={isDraggingThis ? 'transparent' : 'rgba(15, 23, 42, 0.14)'}
                    stroke="rgba(0, 0, 0, 0.82)"
                    strokeWidth={(isCore ? 4.4 : 3.2) * pinScale}
                  />
                  {/* Vòng màu rỗng đặc trưng của Mixamo */}
                  <circle
                    r={ringR}
                    fill="none"
                    stroke={meta.color}
                    strokeWidth={(isCore ? (isActive ? 3.2 : 2.6) : 2) * pinScale}
                  />
                  {/* Chữ thập ngắm tâm mảnh giúp nhìn xuyên thấu chi tiết nhân vật bên dưới */}
                  <line
                    x1={-4 * pinScale}
                    y1={0}
                    x2={4 * pinScale}
                    y2={0}
                    stroke="rgba(255,255,255,0.65)"
                    strokeWidth={0.9 * pinScale}
                  />
                  <line
                    x1={0}
                    y1={-4 * pinScale}
                    x2={0}
                    y2={4 * pinScale}
                    stroke="rgba(255,255,255,0.65)"
                    strokeWidth={0.9 * pinScale}
                  />
                  <circle
                    r={(isCore ? 1.8 : 1.5) * pinScale}
                    fill="#ffffff"
                    stroke="rgba(0,0,0,0.85)"
                    strokeWidth={0.8 * pinScale}
                  />
                </g>
              )
            })}
          </svg>
        </div>

        {/* Cột 3: Sơ đồ hình nhân mẫu 7 nhóm khớp (khi bật) */}
        {!compact && showGuide && <MixamoBodyReferenceGuide />}
      </div>

      {/* Thanh thông tin & vi chỉnh toạ độ nằm BÊN DƯỚI sân khấu (tuyệt đối không đè lên nhân vật) */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '5px 10px',
          background: 'var(--bg-2)',
          borderTop: '1px solid var(--line-soft)',
          fontSize: '10.5px',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <MixamoHollowRingIcon color={activeMeta.color} size={16} active />
          <strong style={{ color: activeMeta.color, whiteSpace: 'nowrap' }}>
            {activeMeta.label}
          </strong>
          <span style={{ color: 'var(--text-dim)', fontSize: '9.5px' }}>
            (Giữ Alt khi kéo để chỉnh 1 bên)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--text-dim)', fontSize: '10px' }}>
            <span>X:</span>
            <input
              type="number"
              className="input-text xs"
              value={activePt.x}
              onChange={(e) => updateActiveCoord('x', Number(e.target.value))}
              style={{ width: '52px', height: '20px', padding: '1px 4px', fontSize: '10px' }}
            />
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--text-dim)', fontSize: '10px' }}>
            <span>Y:</span>
            <input
              type="number"
              className="input-text xs"
              value={activePt.y}
              onChange={(e) => updateActiveCoord('y', Number(e.target.value))}
              style={{ width: '52px', height: '20px', padding: '1px 4px', fontSize: '10px' }}
            />
          </label>
          <span style={{ fontSize: '9.5px', color: 'var(--text-faint)' }}>
            12 điểm → 15 xương
          </span>
        </div>
      </div>
    </div>
  )
}

