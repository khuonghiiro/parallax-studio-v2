import { useState } from 'react'
import type { Face3D } from '../types'
import type { GizmoMode } from '../AssemblyViewport'
import './meshEditor.css'

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

interface Assembly3DToolHUDProps {
  face: Face3D | null
  activeTool: Assembly3DActiveTool
  onChangeTool: (tool: Assembly3DActiveTool) => void
  onUpdateFace: (faceId: string, updates: Partial<Face3D>) => void
  gizmoMode: GizmoMode
  onChangeGizmoMode: (mode: GizmoMode) => void
}

interface ToolDef {
  id: Assembly3DActiveTool
  name: string
  icon: string
  tooltip: string
  shortcut?: string
}

const TOOLS: ToolDef[] = [
  { id: 'gizmo', name: 'Trục 3D', icon: '🎯', tooltip: 'Di chuyển XYZ, Xoay & Co giãn Bounding box' },
  { id: 'bend', name: 'Uốn vòm', icon: '🌀', tooltip: 'Uốn cong vòm Arc và cong ngang/dọc' },
  { id: 'taper', name: 'Loe / Thắt', icon: '📐', tooltip: 'Thu nhỏ ngọn hoặc phình to đáy/ngọn lá' },
  { id: 'lateral', name: 'Uốn S-Curve', icon: '➰', tooltip: 'Uốn cong trục sóng dạt sang trái/phải' },
  { id: 'twist', name: 'Xoắn vặn', icon: '🌪️', tooltip: 'Xoắn vặn mặt phẳng quanh trục' },
  { id: 'grab', name: 'Kéo mềm', icon: '🖐️', tooltip: 'Cọ kéo đỉnh mềm mại tạo nếp lượn tự nhiên' },
  { id: 'inflate', name: 'Lồi / Lõm', icon: '🎈', tooltip: 'Cọ làm phồng căng hoặc ấn lõm lòng chảo' },
  { id: 'smooth', name: 'Làm mượt', icon: '🫧', tooltip: 'Cọ vuốt phẳng mịn các nếp nhăn và gờ cạnh' },
  { id: 'crease', name: 'Gấp nếp', icon: '〰️', tooltip: 'Cọ tạo gân sống lá và nếp gấp sắc sảo' },
  { id: 'lattice', name: 'Khung FFD', icon: '🕸️', tooltip: 'Lưới điều khiển 3x3 nắn tự do toàn mặt' }
]

export function Assembly3DToolHUD({
  face,
  activeTool,
  onChangeTool,
  onUpdateFace,
  gizmoMode,
  onChangeGizmoMode
}: Assembly3DToolHUDProps) {
  const [hudCollapsed, setHudCollapsed] = useState(false)

  // Brush settings state (local preview)
  const [brushRadius, setBrushRadius] = useState(60)
  const [brushStrength, setBrushStrength] = useState(0.5)
  const [brushInvert, setBrushInvert] = useState(false)

  const handleToolClick = (toolId: Assembly3DActiveTool) => {
    if (activeTool === toolId) {
      // Toggle HUD expansion when clicking active tool
      setHudCollapsed((c) => !c)
    } else {
      onChangeTool(toolId)
      setHudCollapsed(false)
    }
  }

  const updateProp = (patch: Partial<Face3D>) => {
    if (!face) return
    onUpdateFace(face.id, patch)
  }

  return (
    <div className="assembly-3d-hud-container" role="region" aria-label="Bộ công cụ tạo hình mềm 3D">
      {/* Top Floating Glass Toolbar */}
      <div className="assembly-3d-hud-toolbar">
        {TOOLS.map((t) => {
          const isActive = activeTool === t.id
          return (
            <button
              key={t.id}
              type="button"
              className={`a3d-hud-btn${isActive ? ' active' : ''}`}
              onClick={() => handleToolClick(t.id)}
              title={`${t.name}: ${t.tooltip}`}
              aria-pressed={isActive}
            >
              <span className="a3d-hud-icon">{t.icon}</span>
              <span className="a3d-hud-label">{t.name}</span>
            </button>
          )
        })}
      </div>

      {/* Mini Quick Control HUD Bar for Active Tool */}
      {!hudCollapsed && face && (
        <div className="assembly-3d-mini-hud">
          {/* TOOL: GIZMO CONTROLS */}
          {activeTool === 'gizmo' && (
            <div className="mini-hud-group">
              <span className="mini-hud-title">🎯 Trục Gizmo:</span>
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

          {/* TOOL: BEND ARC & CURVATURE */}
          {activeTool === 'bend' && (
            <div className="mini-hud-row">
              <div className="mini-hud-slider-item">
                <span className="mini-hud-label">Vòm Arc:</span>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  className="mini-hud-range"
                  value={face.arcAngle || 0}
                  onChange={(e) => updateProp({ arcAngle: Number(e.target.value) })}
                />
                <span className="mini-hud-val">{face.arcAngle || 0}°</span>
              </div>

              <div className="mini-hud-slider-item">
                <span className="mini-hud-label">Ngang (Bend X):</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  className="mini-hud-range"
                  value={face.bendX || 0}
                  onChange={(e) => updateProp({ bendX: Number(e.target.value) })}
                />
                <span className="mini-hud-val">{face.bendX || 0}%</span>
              </div>

              <div className="mini-hud-slider-item">
                <span className="mini-hud-label">Dọc (Bend Y):</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  className="mini-hud-range"
                  value={face.bendY || 0}
                  onChange={(e) => updateProp({ bendY: Number(e.target.value) })}
                />
                <span className="mini-hud-val">{face.bendY || 0}%</span>
              </div>

              <div className="mini-hud-actions">
                <button
                  type="button"
                  className="mini-hud-chip"
                  onClick={() => updateProp({ arcAngle: 90 })}
                >
                  Vòm 90°
                </button>
                <button
                  type="button"
                  className="mini-hud-chip"
                  onClick={() => updateProp({ arcAngle: 180 })}
                >
                  Trụ 180°
                </button>
                <button
                  type="button"
                  className="mini-hud-chip btn-reset"
                  onClick={() => updateProp({ arcAngle: 0, bendX: 0, bendY: 0 })}
                  title="Đặt lại uốn cong về phẳng"
                >
                  Phẳng (0)
                </button>
              </div>
            </div>
          )}

          {/* TOOL: TAPER */}
          {activeTool === 'taper' && (
            <div className="mini-hud-row">
              <div className="mini-hud-slider-item" style={{ minWidth: 260 }}>
                <span className="mini-hud-label">Tỉ lệ Taper:</span>
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.05"
                  className="mini-hud-range"
                  value={face.taperRatio ?? 1.0}
                  onChange={(e) => updateProp({ taperRatio: Number(e.target.value) })}
                />
                <span className="mini-hud-val">{(face.taperRatio ?? 1.0).toFixed(2)}x</span>
              </div>

              <div className="mini-hud-actions">
                <button
                  type="button"
                  className={`mini-hud-chip${face.taperRatio === 0.4 ? ' active' : ''}`}
                  onClick={() => updateProp({ taperRatio: 0.4 })}
                  title="Thắt nhọn đầu ngọn (búp lá / nụ hoa)"
                >
                  Thắt nhọn (0.4x)
                </button>
                <button
                  type="button"
                  className={`mini-hud-chip${face.taperRatio === 1.0 ? ' active' : ''}`}
                  onClick={() => updateProp({ taperRatio: 1.0 })}
                  title="Tỉ lệ đều chuẩn không co giãn"
                >
                  Chuẩn (1.0x)
                </button>
                <button
                  type="button"
                  className={`mini-hud-chip${face.taperRatio === 1.6 ? ' active' : ''}`}
                  onClick={() => updateProp({ taperRatio: 1.6 })}
                  title="Loe to ngọn (cánh xòe)"
                >
                  Loe xòe (1.6x)
                </button>
                <button
                  type="button"
                  className="mini-hud-chip btn-reset"
                  onClick={() => updateProp({ taperRatio: 1.0 })}
                >
                  Đặt lại
                </button>
              </div>
            </div>
          )}

          {/* TOOL: LATERAL S-CURVE */}
          {activeTool === 'lateral' && (
            <div className="mini-hud-row">
              <div className="mini-hud-slider-item" style={{ minWidth: 240 }}>
                <span className="mini-hud-label">Độ dạt trục:</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  className="mini-hud-range"
                  value={face.bendLateral || 0}
                  onChange={(e) => updateProp({ bendLateral: Number(e.target.value) })}
                />
                <span className="mini-hud-val">{face.bendLateral || 0}%</span>
              </div>

              <div className="mini-hud-actions">
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
                  title="Uốn lượn chữ S tự nhiên"
                >
                  Chữ S (Curl)
                </button>
                <button
                  type="button"
                  className={`mini-hud-chip${face.bendRegion === 'top' ? ' active' : ''}`}
                  onClick={() => updateProp({ bendRegion: 'top' })}
                  title="Chỉ uốn dạt phần ngọn"
                >
                  Ngọn
                </button>
                <button
                  type="button"
                  className="mini-hud-chip btn-reset"
                  onClick={() => updateProp({ bendLateral: 0 })}
                >
                  Thẳng (0%)
                </button>
              </div>
            </div>
          )}

          {/* TOOL: TWIST */}
          {activeTool === 'twist' && (
            <div className="mini-hud-row">
              <div className="mini-hud-slider-item" style={{ minWidth: 260 }}>
                <span className="mini-hud-label">Góc xoắn Twist:</span>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  className="mini-hud-range"
                  value={face.twistAngle || 0}
                  onChange={(e) => updateProp({ twistAngle: Number(e.target.value) })}
                />
                <span className="mini-hud-val">{face.twistAngle || 0}°</span>
              </div>
              <div className="mini-hud-actions">
                <button
                  type="button"
                  className="mini-hud-chip btn-reset"
                  onClick={() => updateProp({ twistAngle: 0 })}
                >
                  Thẳng (0°)
                </button>
              </div>
            </div>
          )}

          {/* TOOL: BRUSHES (GRAB, INFLATE, SMOOTH, CREASE) */}
          {['grab', 'inflate', 'smooth', 'crease'].includes(activeTool) && (
            <div className="mini-hud-row">
              <div className="mini-hud-slider-item">
                <span className="mini-hud-label">Bán kính cọ:</span>
                <input
                  type="range"
                  min="15"
                  max="200"
                  className="mini-hud-range"
                  value={brushRadius}
                  onChange={(e) => setBrushRadius(Number(e.target.value))}
                />
                <span className="mini-hud-val">{brushRadius}px</span>
              </div>

              <div className="mini-hud-slider-item">
                <span className="mini-hud-label">Lực cọ:</span>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  className="mini-hud-range"
                  value={brushStrength}
                  onChange={(e) => setBrushStrength(Number(e.target.value))}
                />
                <span className="mini-hud-val">{(brushStrength * 100).toFixed(0)}%</span>
              </div>

              {activeTool === 'inflate' && (
                <button
                  type="button"
                  className={`mini-hud-chip${brushInvert ? ' active' : ''}`}
                  onClick={() => setBrushInvert((v) => !v)}
                >
                  {brushInvert ? 'Lõm vào (-)' : 'Phồng ra (+)'}
                </button>
              )}

              {activeTool === 'crease' && (
                <button
                  type="button"
                  className={`mini-hud-chip${brushInvert ? ' active' : ''}`}
                  onClick={() => setBrushInvert((v) => !v)}
                >
                  {brushInvert ? 'Rãnh sống (-)' : 'Gờ gân (+)'}
                </button>
              )}

              <span className="mini-hud-hint">💡 Kéo chuột trực tiếp trên mặt 3D để điêu khắc</span>
            </div>
          )}

          {/* TOOL: LATTICE FFD */}
          {activeTool === 'lattice' && (
            <div className="mini-hud-row">
              <span className="mini-hud-title">🕸️ Khung nắn FFD 3×3:</span>
              <button
                type="button"
                className="mini-hud-chip active"
                onClick={() => {
                  /* toggle lattice overlay */
                }}
              >
                Hiển thị lưới 3×3
              </button>
              <button
                type="button"
                className="mini-hud-chip btn-reset"
                onClick={() => {
                  updateProp({ selectedCells: [] })
                }}
              >
                Đặt lại khung
              </button>
              <span className="mini-hud-hint">Kéo 9 điểm mút trên mặt 3D để nắn tự do</span>
            </div>
          )}

          <button
            type="button"
            className="mini-hud-close"
            onClick={() => setHudCollapsed(true)}
            title="Thu gọn bảng điều khiển nhanh"
          >
            ✕
          </button>
        </div>
      )}

      {/* When face is not selected */}
      {!face && (
        <div className="assembly-3d-mini-hud mini-hud-empty">
          <span>💡 Hãy chọn một mặt phẳng 3D trên màn hình để sử dụng bộ công cụ tạo hình mềm.</span>
        </div>
      )}
    </div>
  )
}
