import type React from 'react'
import {
  MIXAMO_RING_GROUPS,
  type MixamoLandmarkId,
  type MixamoRingGroupMeta
} from './workshopMixamoAutoRig'

export interface MixamoMarkerDockProps {
  activeLandmarkId: MixamoLandmarkId | null
  onSelectLandmark: (id: MixamoLandmarkId) => void
  onStartDockDrag: (id: MixamoLandmarkId, e: React.PointerEvent) => void
}

/** Biểu tượng vòng tròn tâm rỗng chuẩn Mixamo (Hollow Ring + Center Dot) */
export function MixamoHollowRingIcon({
  color,
  size = 24,
  active = false,
  title
}: {
  color: string
  size?: number
  active?: boolean
  title?: string
}) {
  const half = size / 2
  const ringR = half - 3.5
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
        fill="rgba(15, 23, 42, 0.55)"
        stroke="rgba(0, 0, 0, 0.85)"
        strokeWidth={4.6}
      />
      <circle
        cx={half}
        cy={half}
        r={ringR}
        fill="none"
        stroke={color}
        strokeWidth={3.2}
      />
      <line
        x1={half - 4}
        y1={half}
        x2={half + 4}
        y2={half}
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1}
      />
      <line
        x1={half}
        y1={half - 4}
        x2={half}
        y2={half + 4}
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1}
      />
      <circle
        cx={half}
        cy={half}
        r={2.2}
        fill="#ffffff"
        stroke="rgba(0,0,0,0.8)"
        strokeWidth={0.8}
      />
    </svg>
  )
}

/**
 * Khay dọc bên trái chứa 5 nhóm vòng tròn Mixamo (CHIN, WRISTS, ELBOWS, KNEES, GROIN)
 * giống hệt giao diện Adobe Mixamo Auto-Rigger: hỗ trợ kéo thả từ khay vào nhân vật hoặc click chọn.
 */
export function MixamoMarkerDock({
  activeLandmarkId,
  onSelectLandmark,
  onStartDockDrag
}: MixamoMarkerDockProps) {
  return (
    <div
      className="lw-mixamo-marker-dock"
      style={{
        width: '88px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '3px',
        padding: '4px 4px',
        background: 'var(--bg-2)',
        borderRight: '1px solid var(--line-soft)',
        userSelect: 'none'
      }}
    >
      {MIXAMO_RING_GROUPS.map((group: MixamoRingGroupMeta) => {
        const isGroupActive = group.landmarkIds.includes(activeLandmarkId as MixamoLandmarkId)
        return (
          <div
            key={group.groupId}
            onClick={() => onSelectLandmark(group.landmarkIds[0])}
            title={`${group.title} (${group.viTitle}): ${group.hint}. Kéo vòng tròn thả vào nhân vật hoặc click để chọn.`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              minHeight: 0,
              padding: '2px 2px',
              borderRadius: '5px',
              border: `1px solid ${isGroupActive ? group.color : 'var(--line)'}`,
              background: isGroupActive
                ? `color-mix(in srgb, ${group.color} 15%, var(--bg-1))`
                : 'var(--bg-1)',
              cursor: 'grab',
              transition: 'border-color 0.15s ease, background 0.15s ease'
            }}
          >
            <div
              style={{
                fontSize: '8.5px',
                fontWeight: 800,
                letterSpacing: '0.03em',
                color: group.color,
                lineHeight: 1.05
              }}
            >
              {group.title} · {group.viTitle}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              {group.landmarkIds.map((lmId, idx) => (
                <div
                  key={lmId}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    onStartDockDrag(lmId, e)
                  }}
                  style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}
                  title={
                    group.landmarkIds.length > 1
                      ? `Kéo vòng ${group.viTitle} (${idx === 0 ? 'Trái' : 'Phải'}) thả vào nhân vật`
                      : `Kéo vòng ${group.viTitle} thả vào nhân vật`
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
 * Sơ đồ hình nhân mẫu hướng dẫn vị trí đặt 5 nhóm vòng tròn Mixamo (CHIN, WRISTS, ELBOWS, KNEES, GROIN)
 * trực quan giống hệt bảng hướng dẫn bên phải của Adobe Mixamo.
 */
export function MixamoBodyReferenceGuide() {
  const markers = [
    { label: 'CHIN (Cằm)', color: '#00d4e5', y: 40, pts: [{ x: 48, y: 40 }] },
    { label: 'WRISTS (Cổ tay)', color: '#8bc34a', y: 74, pts: [{ x: 14, y: 78 }, { x: 82, y: 78 }] },
    { label: 'ELBOWS (Khuỷu)', color: '#e6d74c', y: 60, pts: [{ x: 26, y: 63 }, { x: 70, y: 63 }] },
    { label: 'KNEES (Đầu gối)', color: '#e88e2d', y: 122, pts: [{ x: 37, y: 122 }, { x: 59, y: 122 }] },
    { label: 'GROIN (Háng)', color: '#e06287', y: 92, pts: [{ x: 48, y: 92 }] }
  ]

  return (
    <div
      className="lw-mixamo-reference-guide"
      style={{
        width: '124px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 6px',
        background: 'var(--bg-2)',
        borderLeft: '1px solid var(--line-soft)',
        userSelect: 'none'
      }}
      title="Sơ đồ mẫu vị trí đặt 8 vòng tròn định vị xương tự động (Mixamo Auto-Rigger)"
    >
      <div style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>
        📖 Mẫu Đặt 8 Điểm
      </div>
      <svg
        width="108"
        height="168"
        viewBox="0 0 96 168"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Trục đối xứng giữa */}
        <line
          x1={48}
          y1={8}
          x2={48}
          y2={162}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {/* Hình bóng nhân vật mẫu (Mannequin Silhouette) */}
        <g fill="rgba(148, 163, 184, 0.28)" stroke="rgba(148, 163, 184, 0.55)" strokeWidth={1.2}>
          {/* Đầu */}
          <ellipse cx={48} cy={25} rx={12} ry={14} />
          {/* Cổ */}
          <rect x={44} y={37} width={8} height={7} rx={2} />
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

        {/* 8 vòng tròn màu chuẩn Mixamo trên hình mẫu */}
        {markers.map((m) =>
          m.pts.map((pt, i) => (
            <g key={`${m.label}-${i}`} transform={`translate(${pt.x}, ${pt.y})`}>
              <circle r={6.2} fill="rgba(15, 23, 42, 0.7)" stroke="#000" strokeWidth={2.4} />
              <circle r={6.2} fill="none" stroke={m.color} strokeWidth={1.8} />
              <circle r={1.4} fill="#fff" />
            </g>
          ))
        )}
      </svg>

      {/* Chú thích 5 màu */}
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
            <strong style={{ color: g.color, fontSize: '8.5px' }}>{g.title}:</strong>
            <span>{g.viTitle}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Hiển thị 8 vòng tròn màu chuẩn Mixamo (CHIN, WRISTS, ELBOWS, KNEES, GROIN) + trục đối xứng
 * ngay trên màn hình 2D chính khi đang ở tab Tạo xương để người dùng kéo thả 8 điểm trực tiếp.
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
  const ringList: Array<{ id: MixamoLandmarkId; label: string; tag: string; color: string }> = [
    { id: 'neck', label: 'CHIN · Cằm', tag: 'CHIN', color: '#00d4e5' },
    { id: 'wristL', label: 'WRISTS · Cổ tay T', tag: 'WRIST', color: '#8bc34a' },
    { id: 'wristR', label: 'WRISTS · Cổ tay P', tag: 'WRIST', color: '#8bc34a' },
    { id: 'elbowL', label: 'ELBOWS · Khuỷu T', tag: 'ELBOW', color: '#e6d74c' },
    { id: 'elbowR', label: 'ELBOWS · Khuỷu P', tag: 'ELBOW', color: '#e6d74c' },
    { id: 'kneeL', label: 'KNEES · Đầu gối T', tag: 'KNEE', color: '#e88e2d' },
    { id: 'kneeR', label: 'KNEES · Đầu gối P', tag: 'KNEE', color: '#e88e2d' },
    { id: 'pelvis', label: 'GROIN · Háng (Gốc)', tag: 'GROIN', color: '#e06287' }
  ]

  return (
    <g className="lw-mixamo-viewport-rings">
      {/* Trục đối xứng dọc qua tâm Háng (GROIN) */}
      <line
        x1={landmarks.pelvis.x}
        y1={-halfH}
        x2={landmarks.pelvis.x}
        y2={halfH}
        stroke="rgba(255, 255, 255, 0.45)"
        strokeWidth={1.5}
        strokeDasharray="6 4"
        pointerEvents="none"
      />
      {ringList.map((r) => {
        const pt = landmarks[r.id]
        const isActive = activeLandmarkId === r.id
        const radius = isActive ? 15 : 12.5
        return (
          <g
            key={r.id}
            transform={`translate(${pt.x}, ${pt.y})`}
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => onStartDragLandmark(e, r.id, r.label, r.color)}
          >
            <title>
              {`${r.label}: Kéo vòng tròn để tự động căn chỉnh khung xương (Giữ Alt để tắt đối xứng 2 bên)`}
            </title>
            <circle r={radius + 4} fill="transparent" />
            <circle
              r={radius}
              fill="rgba(15, 23, 42, 0.2)"
              stroke="rgba(0, 0, 0, 0.85)"
              strokeWidth={6}
            />
            <circle
              r={radius}
              fill="none"
              stroke={r.color}
              strokeWidth={isActive ? 4.4 : 3.6}
            />
            <line x1={-4.5} y1={0} x2={4.5} y2={0} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
            <line x1={0} y1={-4.5} x2={0} y2={4.5} stroke="rgba(255,255,255,0.6)" strokeWidth={1} />
            <circle r={2.4} fill="#ffffff" stroke="rgba(0,0,0,0.85)" strokeWidth={1} />
          </g>
        )
      })}
    </g>
  )
}

