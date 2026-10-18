import type React from 'react'
import {
  MIXAMO_LANDMARK_META,
  MIXAMO_RING_GROUPS,
  type MixamoLandmarkId,
  type MixamoRingGroupMeta
} from './workshopMixamoAutoRig'

export interface MixamoMarkerDockProps {
  activeLandmarkId: MixamoLandmarkId | null
  onSelectLandmark: (id: MixamoLandmarkId) => void
  onStartDockDrag: (id: MixamoLandmarkId, e: React.PointerEvent) => void
  landmarks?: Record<MixamoLandmarkId, { x: number; y: number }>
}

/** Biểu tượng vòng tròn tâm rỗng chuẩn Mixamo (Hollow Ring + Center Dot) */
export function MixamoHollowRingIcon({
  color,
  size = 22,
  active = false,
  title
}: {
  color: string
  size?: number
  active?: boolean
  title?: string
}) {
  const half = size / 2
  const ringR = half - 3.2
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        display: 'block',
        filter: active ? `drop-shadow(0 0 5px ${color})` : 'none',
        transition: 'transform 0.12s ease'
      }}
    >
      {title && <title>{title}</title>}
      <circle
        cx={half}
        cy={half}
        r={ringR}
        fill="rgba(15, 23, 42, 0.45)"
        stroke="rgba(0, 0, 0, 0.85)"
        strokeWidth={4.2}
      />
      <circle
        cx={half}
        cy={half}
        r={ringR}
        fill="none"
        stroke={color}
        strokeWidth={2.8}
      />
      <line
        x1={half - 3.5}
        y1={half}
        x2={half + 3.5}
        y2={half}
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1}
      />
      <line
        x1={half}
        y1={half - 3.5}
        x2={half}
        y2={half + 3.5}
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1}
      />
      <circle
        cx={half}
        cy={half}
        r={2}
        fill="#ffffff"
        stroke="rgba(0,0,0,0.8)"
        strokeWidth={0.8}
      />
    </svg>
  )
}

/**
 * Khay dọc bên trái chứa 7 nhóm vòng tròn giải phẫu Mixamo
 * (Cằm, Hai Vai, Khuỷu tay, Cổ tay, Háng, Đầu gối, Cổ chân):
 * hỗ trợ kéo thả từ khay vào nhân vật hoặc click chọn từng bên Trái/Phải.
 */
export function MixamoMarkerDock({
  activeLandmarkId,
  onSelectLandmark,
  onStartDockDrag,
  landmarks
}: MixamoMarkerDockProps) {
  return (
    <div
      className="lw-mixamo-marker-dock"
      style={{
        width: '154px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '4px',
        padding: '6px',
        background: 'var(--bg-2)',
        borderRight: '1px solid var(--line-soft)',
        userSelect: 'none',
        overflowY: 'auto'
      }}
    >
      {MIXAMO_RING_GROUPS.map((group: MixamoRingGroupMeta) => {
        const isGroupActive = group.landmarkIds.includes(activeLandmarkId as MixamoLandmarkId)
        const primaryPt = landmarks?.[group.landmarkIds[0]]
        return (
          <div
            key={group.groupId}
            onClick={() => onSelectLandmark(group.landmarkIds[0])}
            title={`${group.title} (${group.viTitle}): ${group.hint}. Kéo vòng tròn thả vào nhân vật hoặc click để chọn.`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              padding: '5px 7px',
              borderRadius: '6px',
              border: `1px solid ${isGroupActive ? group.color : 'var(--line)'}`,
              background: isGroupActive
                ? `color-mix(in srgb, ${group.color} 15%, var(--bg-1))`
                : 'var(--bg-1)',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease, background 0.15s ease'
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: group.color,
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {group.viTitle}
              </div>
              <div
                style={{
                  fontSize: '8.5px',
                  color: 'var(--text-dim)',
                  lineHeight: 1.15,
                  marginTop: '1px'
                }}
              >
                {primaryPt ? `(${primaryPt.x}, ${primaryPt.y})` : group.title}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
              {group.landmarkIds.map((lmId, idx) => (
                <div
                  key={lmId}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    onStartDockDrag(lmId, e)
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectLandmark(lmId)
                  }}
                  style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}
                  title={
                    group.landmarkIds.length > 1
                      ? `Kéo hoặc chọn vòng ${group.viTitle} (${idx === 0 ? 'Trái' : 'Phải'})`
                      : `Kéo hoặc chọn vòng ${group.viTitle}`
                  }
                >
                  <MixamoHollowRingIcon
                    color={group.color}
                    size={20}
                    active={activeLandmarkId === lmId}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Sơ đồ hình nhân mẫu hướng dẫn vị trí đặt 7 nhóm vòng tròn giải phẫu Mixamo
 * (Cằm, Hai Vai, Khuỷu tay, Cổ tay, Háng, Đầu gối, Cổ chân).
 */
export function MixamoBodyReferenceGuide() {
  const markers = [
    { label: 'CHIN (Cằm)', color: '#00d4e5', pts: [{ x: 48, y: 39 }] },
    { label: 'SHOULDERS (Vai)', color: '#38bdf8', pts: [{ x: 33, y: 47 }, { x: 63, y: 47 }] },
    { label: 'ELBOWS (Khuỷu)', color: '#facc15', pts: [{ x: 24, y: 63 }, { x: 72, y: 63 }] },
    { label: 'WRISTS (Cổ tay)', color: '#84cc16', pts: [{ x: 14, y: 78 }, { x: 82, y: 78 }] },
    { label: 'GROIN (Háng)', color: '#ec4899', pts: [{ x: 48, y: 92 }] },
    { label: 'KNEES (Đầu gối)', color: '#fb923c', pts: [{ x: 38, y: 121 }, { x: 58, y: 121 }] },
    { label: 'ANKLES (Cổ chân)', color: '#f43f5e', pts: [{ x: 38, y: 150 }, { x: 58, y: 150 }] }
  ]

  return (
    <div
      className="lw-mixamo-reference-guide"
      style={{
        width: '132px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px',
        background: 'var(--bg-2)',
        borderLeft: '1px solid var(--line-soft)',
        userSelect: 'none'
      }}
      title="Sơ đồ mẫu vị trí đặt 12 vòng tròn giải phẫu (Cằm, 2 Vai, 2 Khuỷu tay, 2 Cổ tay, Háng, 2 Đầu gối, 2 Cổ chân)"
    >
      <div style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>
        📖 Sơ Đồ 7 Nhóm Khớp
      </div>
      <svg
        width="104"
        height="156"
        viewBox="0 0 96 164"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Trục đối xứng giữa */}
        <line
          x1={48}
          y1={8}
          x2={48}
          y2={158}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {/* Hình bóng nhân vật mẫu (Mannequin Silhouette) */}
        <g fill="rgba(148, 163, 184, 0.26)" stroke="rgba(148, 163, 184, 0.52)" strokeWidth={1.2}>
          {/* Đầu */}
          <ellipse cx={48} cy={24} rx={11.5} ry={13.5} />
          {/* Cổ */}
          <rect x={44} y={36} width={8} height={7} rx={2} />
          {/* Thân trên & Hông */}
          <path d="M33 44 Q48 42 63 44 L59 92 Q48 96 37 92 Z" />
          {/* Tay trái */}
          <path d="M33 46 L23 63 L13 78 L17 82 L28 66 L36 52 Z" />
          {/* Tay phải */}
          <path d="M63 46 L73 63 L83 78 L79 82 L68 66 L60 52 Z" />
          {/* Chân trái */}
          <path d="M37 92 L34 122 L34 152 L42 152 L43 122 L47 94 Z" />
          {/* Chân phải */}
          <path d="M59 92 L62 122 L62 152 L54 152 L53 122 L49 94 Z" />
        </g>

        {/* 12 vòng tròn màu chuẩn giải phẫu trên hình mẫu */}
        {markers.map((m) =>
          m.pts.map((pt, i) => (
            <g key={`${m.label}-${i}`} transform={`translate(${pt.x}, ${pt.y})`}>
              <circle r={5.2} fill="rgba(15, 23, 42, 0.72)" stroke="#000" strokeWidth={2} />
              <circle r={5.2} fill="none" stroke={m.color} strokeWidth={1.6} />
              <circle r={1.2} fill="#fff" />
            </g>
          ))
        )}
      </svg>

      {/* Chú thích 7 nhóm màu */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
        {MIXAMO_RING_GROUPS.map((g) => (
          <div
            key={g.groupId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '8.5px',
              color: 'var(--text-dim)',
              whiteSpace: 'nowrap'
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                border: `2px solid ${g.color}`,
                display: 'inline-block',
                flexShrink: 0
              }}
            />
            <strong style={{ color: g.color, fontSize: '8.5px' }}>{g.viTitle}</strong>
            <span style={{ opacity: 0.75, fontSize: '8px' }}>({g.landmarkIds.length})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Hiển thị 12 vòng tròn giải phẫu Mixamo (Cằm, 2 Vai, 2 Khuỷu tay, 2 Cổ tay, Háng, 2 Đầu gối, 2 Cổ chân)
 * + trục đối xứng ngay trên màn hình 2D chính khi đang ở tab Tạo xương để người dùng kéo thả trực tiếp.
 */
export function MixamoViewportRingsOverlay({
  landmarks,
  canvasHeight,
  activeLandmarkId,
  onStartDragLandmark
}: {
  landmarks: Record<MixamoLandmarkId, { x: number; y: number }>
  canvasHeight: number
  activeLandmarkId: MixamoLandmarkId | null
  onStartDragLandmark: (e: React.PointerEvent, id: MixamoLandmarkId, label: string, color: string) => void
}) {
  const halfH = canvasHeight / 2
  const coreMeta = MIXAMO_LANDMARK_META.filter((m) => m.isCoreMixamo !== false)

  return (
    <g className="lw-mixamo-viewport-rings">
      {/* Trục đối xứng dọc qua tâm Háng (GROIN) */}
      <line
        x1={landmarks.pelvis.x}
        y1={-halfH}
        x2={landmarks.pelvis.x}
        y2={halfH}
        stroke="rgba(255, 255, 255, 0.38)"
        strokeWidth={1.2}
        strokeDasharray="6 4"
        pointerEvents="none"
      />
      {coreMeta.map((m) => {
        const pt = landmarks[m.id]
        const isActive = activeLandmarkId === m.id
        const radius = isActive ? 13 : 10.5
        return (
          <g
            key={m.id}
            transform={`translate(${pt.x}, ${pt.y})`}
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => onStartDragLandmark(e, m.id, m.label, m.color)}
          >
            <title>
              {`${m.label} (${pt.x}, ${pt.y}): Kéo vòng tròn để định vị khớp xương (Giữ Alt để tắt đối xứng 2 bên)`}
            </title>
            <circle r={radius + 4} fill="transparent" />
            <circle
              r={radius}
              fill="rgba(15, 23, 42, 0.14)"
              stroke="rgba(0, 0, 0, 0.82)"
              strokeWidth={4.8}
            />
            <circle
              r={radius}
              fill="none"
              stroke={m.color}
              strokeWidth={isActive ? 3.8 : 3}
            />
            <line x1={-4} y1={0} x2={4} y2={0} stroke="rgba(255,255,255,0.55)" strokeWidth={0.9} />
            <line x1={0} y1={-4} x2={0} y2={4} stroke="rgba(255,255,255,0.55)" strokeWidth={0.9} />
            <circle r={2} fill="#ffffff" stroke="rgba(0,0,0,0.85)" strokeWidth={0.9} />
          </g>
        )
      })}
    </g>
  )
}


