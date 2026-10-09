import type { Face3D } from '../types'
import type { MeshEditorTool } from './meshEditorTypes'
import { useMeshSelection } from './useMeshSelection'
import { BrushControls } from './BrushControls'
import { CurveControls } from './CurveControls'
import { LatticeControls } from './LatticeControls'
import { ModifierStack } from './ModifierStack'
import './meshEditor.css'

interface MeshEditorPanelProps {
  face: Face3D
  onUpdateFace: (patch: Partial<Face3D>) => void
}

const TOOLS: Array<{ id: MeshEditorTool; label: string; icon: string; title: string }> = [
  { id: 'bend', label: 'Uốn', icon: '🌀', title: 'Uốn cong quanh trục (Bend)' },
  { id: 'twist', label: 'Xoắn', icon: '🌪️', title: 'Xoắn vặn dọc trục (Twist)' },
  { id: 'taper', label: 'Loe/Thắt', icon: '📐', title: 'Loe miệng hoặc thuôn thắt (Taper)' },
  { id: 'grab', label: 'Kéo mềm', icon: '🖐️', title: 'Kéo mềm dẻo theo cọ (Grab brush)' },
  { id: 'inflate', label: 'Lồi/Lõm', icon: '🎈', title: 'Làm lồi hoặc lõm bề mặt (Inflate/Deflate)' },
  { id: 'smooth', label: 'Làm mượt', icon: '🫧', title: 'Làm mượt bề mặt mesh (Smooth brush)' },
  { id: 'crease', label: 'Gấp nếp', icon: '〰️', title: 'Tạo gờ sống / gân nếp gấp (Crease brush)' },
  { id: 'curve', label: 'Đường cong', icon: '➰', title: 'Uốn dọc theo spline Catmull-Rom' },
  { id: 'lattice', label: 'Khung FFD', icon: '🕸️', title: 'Khung nắn tự do 16 điểm (Lattice 4×4)' },
  { id: 'select', label: 'Chọn', icon: '🎯', title: 'Chọn vùng hoặc xem thông số' }
]

const REGION_OPTIONS: Array<{
  id: 'all' | 'bottom' | 'top' | 'left' | 'right' | 'curl'
  label: string
  desc: string
}> = [
  { id: 'all', label: 'Toàn bộ', desc: 'Uốn cong toàn bộ bề mặt' },
  { id: 'bottom', label: 'Mái hiên / Mép dưới', desc: 'Phần trên phẳng, chỉ uốn lượn mép dưới' },
  { id: 'top', label: 'Ngọn / Mép trên', desc: 'Gốc phẳng, uốn vểnh ngọn cánh hoa / lá cây' },
  { id: 'left', label: 'Cánh trái', desc: 'Chỉ uốn cong gập mép trái' },
  { id: 'right', label: 'Cánh phải', desc: 'Chỉ uốn cong gập mép phải' },
  { id: 'curl', label: 'Uốn xoăn / Sóng', desc: 'Uốn lượn sóng chữ S cho cánh hoa xoăn / lá dập dềnh' }
]

export function MeshEditorPanel({ face, onUpdateFace }: MeshEditorPanelProps) {
  const {
    activeTool,
    setActiveTool,
    brushSettings,
    updateBrushSettings,
    curveSettings,
    updateCurveSettings,
    latticeSettings,
    updateLatticeSettings
  } = useMeshSelection()

  const currentRegion = face.bendRegion || 'all'

  return (
    <div className="mesh-editor-panel">
      {/* 1. Toolbar chọn công cụ tạo hình mềm */}
      <div>
        <span className="field-sub-label">Bộ công cụ tạo hình mềm 3D:</span>
        <div className="mesh-editor-toolbar" style={{ marginTop: 4 }}>
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`mesh-tool-btn${activeTool === t.id ? ' active' : ''}`}
              onClick={() => setActiveTool(t.id)}
              title={t.title}
            >
              <span className="mesh-tool-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Bộ điều khiển chi tiết cho công cụ đang chọn */}
      {/* A. Công cụ Uốn (Bend) */}
      {activeTool === 'bend' && (
        <div className="mesh-editor-tool-controls">
          <div className="tool-controls-header">
            <span className="tool-title">🌀 Uốn Cong (Bend)</span>
          </div>

          {/* Vùng uốn */}
          <div style={{ marginTop: 6 }}>
            <span className="field-sub-label">Phạm vi uốn:</span>
            <div className="region-pills-row" style={{ marginTop: 2 }}>
              {REGION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`region-pill-btn${currentRegion === opt.id ? ' active' : ''}`}
                  onClick={() => onUpdateFace({ bendRegion: opt.id })}
                  title={opt.desc}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bend X */}
          <div className="rot-slider-row" style={{ marginTop: 8 }}>
            <span className="rot-label" title="Uốn cong vòm hình trụ theo chiều ngang">
              Uốn ngang (X)
            </span>
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={face.bendX || 0}
              onChange={(e) => onUpdateFace({ bendX: Number(e.target.value) })}
            />
            <span className="deg-value">{face.bendX || 0}%</span>
          </div>

          {/* Bend Y */}
          <div className="rot-slider-row" style={{ marginTop: 6 }}>
            <span className="rot-label" title="Uốn cong vểnh ngọn theo chiều dọc">
              Mép vểnh (Y)
            </span>
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={face.bendY || 0}
              onChange={(e) => onUpdateFace({ bendY: Number(e.target.value) })}
            />
            <span className="deg-value">{face.bendY || 0}%</span>
          </div>

          {/* S-Curl / Bend Lateral */}
          <div className="rot-slider-row" style={{ marginTop: 6 }}>
            <span className="rot-label" title="Uốn lượn sóng chữ S sang hai bên">
              Lượn sóng (S)
            </span>
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={face.bendLateral || 0}
              onChange={(e) => onUpdateFace({ bendLateral: Number(e.target.value) })}
            />
            <span className="deg-value">{face.bendLateral || 0}%</span>
          </div>
        </div>
      )}

      {/* B. Công cụ Xoắn (Twist) */}
      {activeTool === 'twist' && (
        <div className="mesh-editor-tool-controls">
          <div className="tool-controls-header">
            <span className="tool-title">🌪️ Xoắn Vặn Dọc Trục (Twist)</span>
          </div>
          <div className="rot-slider-row" style={{ marginTop: 8 }}>
            <span className="rot-label" title="Góc xoắn dọc theo chiều dài">
              Góc xoắn
            </span>
            <input
              type="range"
              min="-180"
              max="180"
              step="5"
              value={face.bendLateral || 0}
              onChange={(e) => onUpdateFace({ bendLateral: Number(e.target.value) })}
            />
            <span className="deg-value">{face.bendLateral || 0}°</span>
          </div>
          <div className="quick-snaps" style={{ marginTop: 4 }}>
            <button type="button" className="snap-btn" onClick={() => onUpdateFace({ bendLateral: -45 })}>
              -45°
            </button>
            <button type="button" className="snap-btn" onClick={() => onUpdateFace({ bendLateral: 0 })}>
              0° (Thẳng)
            </button>
            <button type="button" className="snap-btn" onClick={() => onUpdateFace({ bendLateral: 45 })}>
              +45°
            </button>
          </div>
        </div>
      )}

      {/* C. Công cụ Loe/Thắt (Taper) */}
      {activeTool === 'taper' && (
        <div className="mesh-editor-tool-controls">
          <div className="tool-controls-header">
            <span className="tool-title">📐 Loe Miệng / Thuôn Thắt (Taper)</span>
          </div>
          <div className="rot-slider-row" style={{ marginTop: 8 }}>
            <span className="rot-label" title="Tỷ lệ kích thước ngọn so với gốc">
              Tỷ lệ loe
            </span>
            <input
              type="range"
              min="0.2"
              max="2.5"
              step="0.05"
              value={face.taperRatio ?? 1.0}
              onChange={(e) => onUpdateFace({ taperRatio: Number(e.target.value) })}
            />
            <span className="deg-value">{(face.taperRatio ?? 1.0).toFixed(2)}x</span>
          </div>
          <div className="quick-snaps" style={{ marginTop: 4 }}>
            <button type="button" className="snap-btn" onClick={() => onUpdateFace({ taperRatio: 0.5 })}>
              0.5x (Thắt)
            </button>
            <button type="button" className="snap-btn" onClick={() => onUpdateFace({ taperRatio: 1.0 })}>
              1.0x (Đều)
            </button>
            <button type="button" className="snap-btn" onClick={() => onUpdateFace({ taperRatio: 1.8 })}>
              1.8x (Loe)
            </button>
          </div>
        </div>
      )}

      {/* D. Nhóm Cọ Điêu Khắc Mềm (Grab, Inflate, Smooth, Crease) */}
      {(activeTool === 'grab' ||
        activeTool === 'inflate' ||
        activeTool === 'smooth' ||
        activeTool === 'crease') && (
        <BrushControls
          tool={activeTool}
          settings={brushSettings}
          onChangeSettings={updateBrushSettings}
        />
      )}

      {/* E. Uốn Dọc Trục Cong (Curve) */}
      {activeTool === 'curve' && (
        <CurveControls
          settings={curveSettings}
          onChangeSettings={updateCurveSettings}
          onApplyPreset={(p) => {
            updateCurveSettings({ preset: p })
            if (p === 'c-curve') onUpdateFace({ bendY: 30, bendRegion: 'all' })
            else if (p === 's-curve') onUpdateFace({ bendLateral: 35, bendRegion: 'curl' })
            else if (p === 'droop') onUpdateFace({ bendY: 45, bendRegion: 'top' })
            else if (p === 'recurved') onUpdateFace({ bendY: -35, bendRegion: 'top' })
          }}
        />
      )}

      {/* F. Khung Nắn Tự Do (Lattice 4x4) */}
      {activeTool === 'lattice' && (
        <LatticeControls
          settings={latticeSettings}
          onChangeSettings={updateLatticeSettings}
          onResetLattice={() => {
            onUpdateFace({ bendX: 0, bendY: 0, bendLateral: 0 })
          }}
        />
      )}

      {/* 3. Danh sách Modifier Stack */}
      <ModifierStack face={face} onUpdateFace={onUpdateFace} />
    </div>
  )
}
