import { useState } from 'react'
import type { Face3D } from '../types'
import type { GizmoMode } from '../AssemblyViewport'
import {
  IconAxisMove,
  IconAxisRotate,
  IconCube,
  IconEye,
  IconEyeOff,
  IconFocus,
  IconGrid,
  IconWireframe,
  IconX
} from '../../../icons'

export type Assembly3DActiveTool =
  | 'gizmo'
  | 'bend'
  | 'taper'
  | 'lateral'
  | 'twist'
  | 'grab'
  | 'inflate'
  | 'smooth'
  | 'crease'
  | 'lattice'

export interface BrushSettings {
  radius: number
  strength: number
  invert: boolean
}

export interface Assembly3DVerticalPaletteProps {
  face: Face3D | null
  activeTool: Assembly3DActiveTool
  onChangeTool: (tool: Assembly3DActiveTool) => void
  onUpdateFace: (faceId: string, updates: Partial<Face3D>) => void
  gizmoMode: GizmoMode
  onChangeGizmoMode: (mode: GizmoMode) => void
  brushSettings: BrushSettings
  onChangeBrushSettings: (patch: Partial<BrushSettings>) => void
}

interface ToolDef {
  id: Assembly3DActiveTool
  title: string
  tag: string
  tagType: 'cyan' | 'amber' | 'green' | 'blue' | 'red'
  desc: string
  tip?: string
  icon: string
}

const TOOL_DEFS: Record<Assembly3DActiveTool, ToolDef> = {
  gizmo: {
    id: 'gizmo',
    title: 'Trục 3D (Gizmo Tool)',
    tag: 'Cơ bản',
    tagType: 'cyan',
    icon: '🎯',
    desc: 'Điều khiển di chuyển XYZ, 3 vòng xoay góc và 8 điểm mút co giãn khung 3D.',
    tip: '💡 Phím tắt: W (Di chuyển) · E (Xoay)'
  },
  bend: {
    id: 'bend',
    title: 'Uốn vòm (Arc Bend)',
    tag: 'Hình khối',
    tagType: 'blue',
    icon: '🌀',
    desc: 'Uốn cong vòm trụ tròn chuẩn xác 90°, 180° và uốn cong ngang/dọc.',
    tip: '🌊 Thích hợp tạo cánh hoa cúc, cuống lá, ống trúc'
  },
  taper: {
    id: 'taper',
    title: 'Loe / Thắt (Taper)',
    tag: 'Thuôn nhọn',
    tagType: 'green',
    icon: '📐',
    desc: 'Thu nhỏ ngọn (búp lá) hoặc phình to ngọn (cánh xòe) theo tỉ lệ 0.2x đến 2.0x.',
    tip: '🌱 Taper < 1.0 giúp đỉnh lá nhọn tự nhiên'
  },
  lateral: {
    id: 'lateral',
    title: 'Uốn S-Curve (Lateral)',
    tag: 'Lượn sóng',
    tagType: 'amber',
    icon: '➰',
    desc: 'Uốn trục dạt sang trái hoặc phải theo dáng cong lượn sóng chữ S tự nhiên.',
    tip: '🍃 Tạo độ uốn mềm mại cho ngọn cỏ, dải lụa'
  },
  twist: {
    id: 'twist',
    title: 'Xoắn vặn (Twist)',
    tag: 'Vặn xoắn',
    tagType: 'cyan',
    icon: '🌪️',
    desc: 'Xoắn vặn mặt phẳng quanh trục dọc tạo hình cánh quạt hoặc dải ruy băng.',
    tip: '⚡ Góc xoắn mượt mà từ -180° đến 180°'
  },
  grab: {
    id: 'grab',
    title: 'Kéo mềm (Grab Brush)',
    tag: 'Cọ nắn',
    tagType: 'blue',
    icon: '🖐️',
    desc: 'Dùng cọ kéo trực tiếp trên mesh để uốn lượn phập phồng tự do theo cử chỉ chuột.',
    tip: '🖌️ Kéo chuột trái trên mặt 3D để tạo dáng'
  },
  inflate: {
    id: 'inflate',
    title: 'Lồi / Lõm (Inflate Brush)',
    tag: 'Cọ khối',
    tagType: 'amber',
    icon: '🎈',
    desc: 'Làm phồng căng bề mặt 3D hoặc ấn lõm tạo lòng chảo theo bán kính cọ.',
    tip: '🔘 Giữ Alt hoặc bấm Đảo để chuyển sang lõm (-)'
  },
  smooth: {
    id: 'smooth',
    title: 'Làm mượt (Smooth Brush)',
    tag: 'Cọ mượt',
    tagType: 'green',
    icon: '🫧',
    desc: 'Vuốt phẳng mịn các nếp gấp gồ ghề và làm mềm cạnh chuyển tiếp.',
    tip: '✨ Giúp bề mặt cánh hoa láng mượt'
  },
  crease: {
    id: 'crease',
    title: 'Gấp nếp (Crease Brush)',
    tag: 'Gân lá',
    tagType: 'red',
    icon: '〰️',
    desc: 'Tạo nếp gấp sắc sảo, đường rãnh sống lá hoặc gân hoa nổi bật.',
    tip: '🌿 Thích hợp tạo đường sống lưng giữa phiến lá'
  },
  lattice: {
    id: 'lattice',
    title: 'Khung FFD (Lattice 3×3)',
    tag: 'Lưới tự do',
    tagType: 'cyan',
    icon: '🕸️',
    desc: 'Lưới 9 điểm mút điều khiển tự do để nắn hình dạng phức tạp trong không gian.',
    tip: '📐 Kéo các điểm mút để biến dạng tùy ý'
  }
}

interface TooltipState {
  title: string
  tag?: string
  tagType?: string
  desc: string
  tip?: string
  top: number
  left: number
}

export function Assembly3DVerticalPalette({
  face,
  activeTool,
  onChangeTool,
  onUpdateFace,
  gizmoMode,
  onChangeGizmoMode,
  brushSettings,
  onChangeBrushSettings
}: Assembly3DVerticalPaletteProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [popupVisible, setPopupVisible] = useState(true)

  const showTooltip = (e: React.MouseEvent<HTMLElement>, toolId: Assembly3DActiveTool) => {
    const def = TOOL_DEFS[toolId]
    if (!def) return
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({
      title: def.title,
      tag: def.tag,
      tagType: def.tagType,
      desc: def.desc,
      tip: def.tip,
      top: rect.top + rect.height / 2,
      left: rect.left
    })
  }

  const hideTooltip = () => setTooltip(null)

  const handleToolClick = (toolId: Assembly3DActiveTool) => {
    if (activeTool === toolId) {
      // Toggle popup visibility when clicking the active tool again
      setPopupVisible((v) => !v)
    } else {
      onChangeTool(toolId)
      setPopupVisible(true)
    }
    hideTooltip()
  }

  const updateProp = (patch: Partial<Face3D>) => {
    if (!face) return
    onUpdateFace(face.id, patch)
  }

function IconGizmo3D() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 12V3M12 3L9.5 5.5M12 3L14.5 5.5" />
      <path d="M12 12H21M21 12L18.5 9.5M21 12L18.5 14.5" />
      <path d="M12 12L5 19M5 19V16M5 19H8" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

function IconBendArc() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19C4 10 10 4 20 4" />
      <path d="M16 4H20V8" />
      <circle cx="4" cy="19" r="1.5" fill="currentColor" />
    </svg>
  )
}

function IconTaper() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4L4 20H20L15 4Z" />
      <line x1="12" y1="4" x2="12" y2="20" strokeDasharray="2 2" />
    </svg>
  )
}

function IconLateral() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 19C10 19 8 5 18 5" />
      <path d="M15 5H18V8" />
    </svg>
  )
}

function IconTwist() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.2-8.5" />
      <path d="M15 3.5V9h5.5" />
    </svg>
  )
}

function IconGrabBrush() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" fillOpacity="0.25" />
    </svg>
  )
}

function IconInflateBrush() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7V3M12 3L10 5M12 3L14 5" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  )
}

function IconSmoothBrush() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8c3-2 6-2 9 0s6 2 9 0" />
      <path d="M3 13c3-2 6-2 9 0s6 2 9 0" />
      <path d="M3 18c3-2 6-2 9 0s6 2 9 0" />
    </svg>
  )
}

function IconCreaseBrush() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7L12 17L21 7" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function IconLattice() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 2" />
      <circle cx="4" cy="4" r="1.8" fill="currentColor" />
      <circle cx="20" cy="4" r="1.8" fill="currentColor" />
      <circle cx="20" cy="20" r="1.8" fill="currentColor" />
      <circle cx="4" cy="20" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    </svg>
  )
}

  return (
    <>
      {/* 1. Left Vertical Palette matching Mesh2DVerticalPalette layout */}
      <div className="assembly-3d-vertical-palette" onScroll={hideTooltip}>
        {/* Transform / Gizmo Tool */}
        <button
          type="button"
          className={`mesh2d-v-tool-btn${activeTool === 'gizmo' ? ' active' : ''}`}
          onClick={() => handleToolClick('gizmo')}
          onMouseEnter={(e) => showTooltip(e, 'gizmo')}
          onMouseLeave={hideTooltip}
          aria-label={TOOL_DEFS.gizmo.title}
        >
          <IconGizmo3D />
        </button>

        <div className="mesh2d-palette-divider" />

        {/* Parametric Curve & Taper Tools */}
        <button
          type="button"
          className={`mesh2d-v-tool-btn${activeTool === 'bend' ? ' active' : ''}`}
          onClick={() => handleToolClick('bend')}
          onMouseEnter={(e) => showTooltip(e, 'bend')}
          onMouseLeave={hideTooltip}
          aria-label={TOOL_DEFS.bend.title}
        >
          <IconBendArc />
        </button>

        <button
          type="button"
          className={`mesh2d-v-tool-btn${activeTool === 'taper' ? ' active' : ''}`}
          onClick={() => handleToolClick('taper')}
          onMouseEnter={(e) => showTooltip(e, 'taper')}
          onMouseLeave={hideTooltip}
          aria-label={TOOL_DEFS.taper.title}
        >
          <IconTaper />
        </button>

        <button
          type="button"
          className={`mesh2d-v-tool-btn${activeTool === 'lateral' ? ' active' : ''}`}
          onClick={() => handleToolClick('lateral')}
          onMouseEnter={(e) => showTooltip(e, 'lateral')}
          onMouseLeave={hideTooltip}
          aria-label={TOOL_DEFS.lateral.title}
        >
          <IconLateral />
        </button>

        <button
          type="button"
          className={`mesh2d-v-tool-btn${activeTool === 'twist' ? ' active' : ''}`}
          onClick={() => handleToolClick('twist')}
          onMouseEnter={(e) => showTooltip(e, 'twist')}
          onMouseLeave={hideTooltip}
          aria-label={TOOL_DEFS.twist.title}
        >
          <IconTwist />
        </button>

        <div className="mesh2d-palette-divider" />

        {/* Sculpt Brush Tools */}
        <button
          type="button"
          className={`mesh2d-v-tool-btn${activeTool === 'grab' ? ' active' : ''}`}
          onClick={() => handleToolClick('grab')}
          onMouseEnter={(e) => showTooltip(e, 'grab')}
          onMouseLeave={hideTooltip}
          aria-label={TOOL_DEFS.grab.title}
        >
          <IconGrabBrush />
        </button>

        <button
          type="button"
          className={`mesh2d-v-tool-btn${activeTool === 'inflate' ? ' active' : ''}`}
          onClick={() => handleToolClick('inflate')}
          onMouseEnter={(e) => showTooltip(e, 'inflate')}
          onMouseLeave={hideTooltip}
          aria-label={TOOL_DEFS.inflate.title}
        >
          <IconInflateBrush />
        </button>

        <button
          type="button"
          className={`mesh2d-v-tool-btn${activeTool === 'smooth' ? ' active' : ''}`}
          onClick={() => handleToolClick('smooth')}
          onMouseEnter={(e) => showTooltip(e, 'smooth')}
          onMouseLeave={hideTooltip}
          aria-label={TOOL_DEFS.smooth.title}
        >
          <IconSmoothBrush />
        </button>

        <button
          type="button"
          className={`mesh2d-v-tool-btn${activeTool === 'crease' ? ' active' : ''}`}
          onClick={() => handleToolClick('crease')}
          onMouseEnter={(e) => showTooltip(e, 'crease')}
          onMouseLeave={hideTooltip}
          aria-label={TOOL_DEFS.crease.title}
        >
          <IconCreaseBrush />
        </button>

        <div className="mesh2d-palette-divider" />

        {/* Lattice FFD */}
        <button
          type="button"
          className={`mesh2d-v-tool-btn${activeTool === 'lattice' ? ' active' : ''}`}
          onClick={() => handleToolClick('lattice')}
          onMouseEnter={(e) => showTooltip(e, 'lattice')}
          onMouseLeave={hideTooltip}
          aria-label={TOOL_DEFS.lattice.title}
        >
          <IconLattice />
        </button>
      </div>

      {/* Flyout Tooltip positioned to the left of the vertical palette */}
      {tooltip && (
        <div
          className="vertical-tab-tooltip"
          role="tooltip"
          style={{
            position: 'fixed',
            left: tooltip.left - 8,
            top: tooltip.top,
            transform: 'translate(-100%, -50%)',
            zIndex: 20000
          }}
        >
          <div className="tooltip-title">
            <span>{tooltip.title}</span>
            {tooltip.tag && (
              <span className={`tooltip-tag-system tag-${tooltip.tagType || 'cyan'}`}>
                {tooltip.tag}
              </span>
            )}
          </div>
          <div className="tooltip-desc">{tooltip.desc}</div>
          {tooltip.tip && (
            <div className="tooltip-count">
              <span>{tooltip.tip}</span>
            </div>
          )}
        </div>
      )}

      {/* 2. Top Quick Controls Popup (Nằm gọn ở Top) */}
      {popupVisible && face && (
        <div className="assembly-3d-top-popup" role="dialog" aria-label="Bảng điều khiển nhanh">
          {/* TOOL: GIZMO */}
          {activeTool === 'gizmo' && (
            <div className="top-popup-content">
              <span className="top-popup-title">🎯 Trục 3D:</span>
              <button
                type="button"
                className={`mini-hud-chip${gizmoMode === 'translate' || gizmoMode === 'both' ? ' active' : ''}`}
                onClick={() => onChangeGizmoMode(gizmoMode === 'translate' ? 'off' : 'translate')}
              >
                Di chuyển (W)
              </button>
              <button
                type="button"
                className={`mini-hud-chip${gizmoMode === 'rotate' || gizmoMode === 'both' ? ' active' : ''}`}
                onClick={() => onChangeGizmoMode(gizmoMode === 'rotate' ? 'off' : 'rotate')}
              >
                Xoay (E)
              </button>
              <button
                type="button"
                className={`mini-hud-chip${gizmoMode === 'both' ? ' active' : ''}`}
                onClick={() => onChangeGizmoMode('both')}
              >
                Cả hai
              </button>
              <button
                type="button"
                className={`mini-hud-chip${gizmoMode === 'off' ? ' active' : ''}`}
                onClick={() => onChangeGizmoMode('off')}
              >
                Ẩn trục
              </button>
            </div>
          )}

          {/* TOOL: BEND */}
          {activeTool === 'bend' && (
            <div className="top-popup-content">
              <span className="top-popup-title">🌀 Uốn vòm:</span>
              <div className="top-popup-item">
                <span>Vòm Arc:</span>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  className="mini-hud-range"
                  value={face.arcAngle || 0}
                  onChange={(e) => updateProp({ arcAngle: Number(e.target.value) })}
                />
                <span className="top-popup-val">{face.arcAngle || 0}°</span>
              </div>
              <div className="top-popup-item">
                <span>Ngang (X):</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  className="mini-hud-range"
                  value={face.bendX || 0}
                  onChange={(e) => updateProp({ bendX: Number(e.target.value) })}
                />
                <span className="top-popup-val">{face.bendX || 0}%</span>
              </div>
              <div className="top-popup-item">
                <span>Dọc (Y):</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  className="mini-hud-range"
                  value={face.bendY || 0}
                  onChange={(e) => updateProp({ bendY: Number(e.target.value) })}
                />
                <span className="top-popup-val">{face.bendY || 0}%</span>
              </div>
              <button type="button" className="mini-hud-chip" onClick={() => updateProp({ arcAngle: 90 })}>
                90°
              </button>
              <button type="button" className="mini-hud-chip" onClick={() => updateProp({ arcAngle: 180 })}>
                180°
              </button>
              <button
                type="button"
                className="mini-hud-chip btn-reset"
                onClick={() => updateProp({ arcAngle: 0, bendX: 0, bendY: 0 })}
              >
                Phẳng (0)
              </button>
            </div>
          )}

          {/* TOOL: TAPER */}
          {activeTool === 'taper' && (
            <div className="top-popup-content">
              <span className="top-popup-title">📐 Loe / Thắt ngọn:</span>
              <div className="top-popup-item">
                <span>Tỉ lệ:</span>
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.05"
                  className="mini-hud-range"
                  value={face.taperRatio ?? 1.0}
                  onChange={(e) => updateProp({ taperRatio: Number(e.target.value) })}
                />
                <span className="top-popup-val">{(face.taperRatio ?? 1.0).toFixed(2)}x</span>
              </div>
              <button
                type="button"
                className={`mini-hud-chip${face.taperRatio === 0.4 ? ' active' : ''}`}
                onClick={() => updateProp({ taperRatio: 0.4 })}
              >
                Nhọn (0.4x)
              </button>
              <button
                type="button"
                className={`mini-hud-chip${face.taperRatio === 1.0 ? ' active' : ''}`}
                onClick={() => updateProp({ taperRatio: 1.0 })}
              >
                Chuẩn (1.0x)
              </button>
              <button
                type="button"
                className={`mini-hud-chip${face.taperRatio === 1.6 ? ' active' : ''}`}
                onClick={() => updateProp({ taperRatio: 1.6 })}
              >
                Xòe (1.6x)
              </button>
              <button
                type="button"
                className="mini-hud-chip btn-reset"
                onClick={() => updateProp({ taperRatio: 1.0 })}
              >
                Đặt lại
              </button>
            </div>
          )}

          {/* TOOL: LATERAL S-CURVE */}
          {activeTool === 'lateral' && (
            <div className="top-popup-content">
              <span className="top-popup-title">➰ Uốn cong trục:</span>
              <div className="top-popup-item">
                <span>Độ dạt:</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  className="mini-hud-range"
                  value={face.bendLateral || 0}
                  onChange={(e) => updateProp({ bendLateral: Number(e.target.value) })}
                />
                <span className="top-popup-val">{face.bendLateral || 0}%</span>
              </div>
              <button
                type="button"
                className={`mini-hud-chip${face.bendRegion === 'all' || !face.bendRegion ? ' active' : ''}`}
                onClick={() => updateProp({ bendRegion: 'all' })}
              >
                Toàn bộ
              </button>
              <button
                type="button"
                className={`mini-hud-chip${face.bendRegion === 'curl' ? ' active' : ''}`}
                onClick={() => updateProp({ bendRegion: 'curl' })}
              >
                Chữ S
              </button>
              <button
                type="button"
                className={`mini-hud-chip${face.bendRegion === 'top' ? ' active' : ''}`}
                onClick={() => updateProp({ bendRegion: 'top' })}
              >
                Ngọn
              </button>
              <button
                type="button"
                className="mini-hud-chip btn-reset"
                onClick={() => updateProp({ bendLateral: 0 })}
              >
                0%
              </button>
            </div>
          )}

          {/* TOOL: TWIST */}
          {activeTool === 'twist' && (
            <div className="top-popup-content">
              <span className="top-popup-title">🌪️ Xoắn vặn:</span>
              <div className="top-popup-item">
                <span>Góc xoắn:</span>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  className="mini-hud-range"
                  value={face.twistAngle || 0}
                  onChange={(e) => updateProp({ twistAngle: Number(e.target.value) })}
                />
                <span className="top-popup-val">{face.twistAngle || 0}°</span>
              </div>
              <button
                type="button"
                className="mini-hud-chip btn-reset"
                onClick={() => updateProp({ twistAngle: 0 })}
              >
                0°
              </button>
            </div>
          )}

          {/* BRUSH TOOLS (GRAB, INFLATE, SMOOTH, CREASE) */}
          {['grab', 'inflate', 'smooth', 'crease'].includes(activeTool) && (
            <div className="top-popup-content">
              <span className="top-popup-title">
                {activeTool === 'grab' && '🖐️ Cọ kéo mềm:'}
                {activeTool === 'inflate' && '🎈 Cọ lồi / lõm:'}
                {activeTool === 'smooth' && '🫧 Cọ làm mượt:'}
                {activeTool === 'crease' && '〰️ Cọ gấp nếp:'}
              </span>
              <div className="top-popup-item">
                <span>Bán kính:</span>
                <input
                  type="range"
                  min="5"
                  max="150"
                  step="1"
                  className="mini-hud-range"
                  value={brushSettings.radius}
                  onChange={(e) => onChangeBrushSettings({ radius: Number(e.target.value) })}
                />
                <span className="top-popup-val">{brushSettings.radius}px</span>
              </div>
              <div className="top-popup-item">
                <span>Lực:</span>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  className="mini-hud-range"
                  value={brushSettings.strength}
                  onChange={(e) => onChangeBrushSettings({ strength: Number(e.target.value) })}
                />
                <span className="top-popup-val">{(brushSettings.strength * 100).toFixed(0)}%</span>
              </div>
              {(activeTool === 'inflate' || activeTool === 'crease') && (
                <button
                  type="button"
                  className={`mini-hud-chip${brushSettings.invert ? ' active' : ''}`}
                  onClick={() => onChangeBrushSettings({ invert: !brushSettings.invert })}
                >
                  {brushSettings.invert ? 'Lõm vào (-)' : 'Phồng ra (+)'}
                </button>
              )}
              {Boolean(face.sculptOffsets && face.sculptOffsets.length > 0) && (
                <button
                  type="button"
                  className="mini-hud-chip btn-reset"
                  onClick={() => updateProp({ sculptOffsets: [] })}
                  title="Khôi phục mặt về hình dạng ban đầu trước khi vẽ cọ"
                >
                  Xóa nét cọ
                </button>
              )}
              <span className="top-popup-hint">💡 Kéo chuột trực tiếp trên mặt 3D để điêu khắc cục bộ</span>
            </div>
          )}

          {/* TOOL: LATTICE */}
          {activeTool === 'lattice' && (
            <div className="top-popup-content">
              <span className="top-popup-title">🕸️ Khung nắn FFD 3×3:</span>
              <span className="top-popup-hint">Kéo 9 điểm mút trên mặt 3D để nắn tự do</span>
              <button
                type="button"
                className="mini-hud-chip btn-reset"
                onClick={() => updateProp({ selectedCells: [] })}
              >
                Đặt lại khung
              </button>
            </div>
          )}

          <button
            type="button"
            className="top-popup-close"
            onClick={() => setPopupVisible(false)}
            title="Đóng bảng điều khiển (Bấm lại icon để mở)"
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
