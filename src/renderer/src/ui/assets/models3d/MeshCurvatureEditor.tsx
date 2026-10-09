import type { Face3D } from './types'
import type { DepthProfileType, MotionType, MotionDirection, MotionAnchor } from './meshEffectsAE'
import { MeshEditorPanel } from './meshEditor/MeshEditorPanel'

interface MeshCurvatureEditorProps {
  face: Face3D
  onUpdateFace: (patch: Partial<Face3D>) => void
}

const GRID_RES_OPTIONS = [
  { val: 16, label: '16×16 (Nhanh)' },
  { val: 32, label: '32×32 (Mịn - Khuyên dùng)' },
  { val: 48, label: '48×48 (Rất nét)' }
]

const DEPTH_PROFILES: Array<{
  id: DepthProfileType
  label: string
  desc: string
  icon: string
}> = [
  { id: 'none', label: 'Phẳng 2D', desc: 'Không đùn sâu, giữ phẳng', icon: '⬛' },
  { id: 'luminance', label: 'Độ sáng', desc: 'Displacement Map: Sáng nhô cao, tối lõm sâu', icon: '💡' },
  { id: 'sphere', label: 'Phồng cầu', desc: 'Bulge effect: Phồng tròn vòm 3D ở tâm', icon: '🔮' },
  { id: 'cylinder', label: 'Lòng máng', desc: 'Uốn vòm hầm / hành lang có chiều sâu', icon: '🚇' },
  { id: 'slope', label: 'Mặt dốc', desc: 'Đáy dốc thoải ra phía trước camera', icon: '📐' },
  { id: 'ridge', label: 'Mái nhọn', desc: 'Gờ sống nhọn ở giữa dốc đều 2 bên', icon: '⛰️' }
]

const MOTION_PRESETS: Array<{
  id: MotionType
  label: string
  desc: string
  icon: string
}> = [
  { id: 'none', label: 'Tĩnh', desc: 'Không chuyển động', icon: '⏸️' },
  { id: 'wind', label: 'Gió thổi', desc: 'Đung đưa mềm mại từ gốc lên ngọn (Cây cối, cờ, tóc, vạt áo)', icon: '🍃' },
  { id: 'wave', label: 'Sóng nước', desc: 'Sóng dập dềnh 2.5D (Mặt nước, rèm vải, khói)', icon: '🌊' },
  { id: 'breathe', label: 'Nhịp thở', desc: 'Phồng xẹp lồng ngực tự nhiên (Nhân vật, sinh vật)', icon: '🫁' },
  { id: 'wiggle', label: 'AE Wiggle', desc: 'Dao động hữu cơ đa tần số After Effects Wiggle', icon: '〰️' }
]

const MOTION_ANCHORS: Array<{
  id: MotionAnchor
  label: string
}> = [
  { id: 'bottom', label: 'Ghim gốc' },
  { id: 'top', label: 'Ghim đỉnh' },
  { id: 'left', label: 'Ghim trái' },
  { id: 'center', label: 'Ghim tâm' },
  { id: 'all', label: 'Tự do' }
]

const MOTION_DIRECTIONS: Array<{
  id: MotionDirection
  label: string
}> = [
  { id: 'both', label: 'Đa hướng' },
  { id: 'horizontal', label: 'Ngang (X)' },
  { id: 'vertical', label: 'Dọc (Y)' },
  { id: 'depthZ', label: 'Độ sâu (Z)' }
]

export function MeshCurvatureEditor({ face, onUpdateFace }: MeshCurvatureEditorProps) {
  const currentRes = face.gridRes || 32
  const currentDepthProfile = face.depthProfile || 'none'
  const currentMotionType = face.motionType || 'none'
  const hiddenCount = face.hiddenCells?.length || 0

  return (
    <div className="inspector-field-group mesh-curvature-editor">
      <label className="group-label">Tạo Hình Mềm & Biến Dạng Mesh (Organic Sculpting)</label>

      {/* 1. Bộ công cụ tạo hình mềm hiện đại (Phase 4) */}
      <MeshEditorPanel face={face} onUpdateFace={onUpdateFace} />

      {/* 2. Độ chi tiết của lưới đa giác (Grid Resolution) */}
      <div className="grid-resolution-selector" style={{ marginTop: 12 }}>
        <span className="field-sub-label">Độ chi tiết lưới (Grid Presets):</span>
        <div className="grid-res-buttons" style={{ marginTop: 4 }}>
          {GRID_RES_OPTIONS.map((g) => (
            <button
              key={g.val}
              type="button"
              className={`res-btn${currentRes === g.val && !face.gridCols ? ' active' : ''}`}
              onClick={() => onUpdateFace({ gridRes: g.val, gridCols: undefined, gridRows: undefined })}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. A. After Effects 2.5D Depth Extrusion (Tạo Độ Sâu / Displacement Map) */}
      <details className="fi-sub-collapsible" style={{ marginTop: 10 }}>
        <summary className="fi-sub-summary">
          <span>✨ Tạo độ sâu 2.5D (AE Depth Extrusion)</span>
          {currentDepthProfile !== 'none' ? <span className="fi-badge-active">{currentDepthProfile}</span> : null}
        </summary>
        <div className="fi-sub-body">
          <div className="region-pills-row" style={{ marginTop: 4 }}>
            {DEPTH_PROFILES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`region-pill-btn${currentDepthProfile === p.id ? ' active' : ''}`}
                onClick={() => onUpdateFace({ depthProfile: p.id, depthIntensity: face.depthIntensity || 50 })}
                title={p.desc}
              >
                {p.icon} {p.label}
              </button>
            ))}
          </div>

          {currentDepthProfile !== 'none' && (
            <div style={{ marginTop: 8 }}>
              <div className="rot-slider-row">
                <span className="rot-label" title="Cường độ đùn lồi / lõm của chiều sâu">
                  Độ sâu (Z)
                </span>
                <input
                  type="range"
                  min="-150"
                  max="150"
                  step="1"
                  value={face.depthIntensity ?? 50}
                  onChange={(e) => onUpdateFace({ depthIntensity: Number(e.target.value) })}
                />
                <span className="deg-value">{face.depthIntensity ?? 50}%</span>
              </div>
              <div className="quick-snaps" style={{ marginTop: 4 }}>
                <button type="button" className="snap-btn" onClick={() => onUpdateFace({ depthIntensity: -50 })}>
                  -50% (Lõm)
                </button>
                <button type="button" className="snap-btn" onClick={() => onUpdateFace({ depthIntensity: 50 })}>
                  +50% (Vừa)
                </button>
                <button type="button" className="snap-btn" onClick={() => onUpdateFace({ depthIntensity: 100 })}>
                  +100% (Sâu)
                </button>
                <button
                  type="button"
                  className={`snap-btn${face.depthInvert ? ' active' : ''}`}
                  onClick={() => onUpdateFace({ depthInvert: !face.depthInvert })}
                  title="Đảo chiều lồi lõm"
                >
                  🔄 Đảo ngược
                </button>
              </div>
            </div>
          )}
        </div>
      </details>

      {/* 4. B. After Effects Procedural Mesh Motion (Tạo Chuyển Động từ Ảnh 2D) */}
      <details className="fi-sub-collapsible" style={{ marginTop: 6 }}>
        <summary className="fi-sub-summary">
          <span>🎬 Tạo chuyển động (AE Wave & Puppet)</span>
          {currentMotionType !== 'none' ? <span className="fi-badge-active">{currentMotionType}</span> : null}
        </summary>
        <div className="fi-sub-body">
          <div className="region-pills-row" style={{ marginTop: 4 }}>
            {MOTION_PRESETS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`region-pill-btn${currentMotionType === m.id ? ' active' : ''}`}
                onClick={() => onUpdateFace({ motionType: m.id })}
                title={m.desc}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {currentMotionType !== 'none' && (
            <div style={{ marginTop: 8 }}>
              {/* Tốc độ (Speed) */}
              <div className="rot-slider-row">
                <span className="rot-label" title="Tốc độ dao động">
                  Tốc độ
                </span>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.1"
                  value={face.motionSpeed ?? 1.0}
                  onChange={(e) => onUpdateFace({ motionSpeed: Number(e.target.value) })}
                />
                <span className="deg-value">{(face.motionSpeed ?? 1.0).toFixed(1)}x</span>
              </div>

              {/* Biên độ (Amplitude) */}
              <div className="rot-slider-row" style={{ marginTop: 4 }}>
                <span className="rot-label" title="Biên độ uốn lượn / đung đưa">
                  Biên độ
                </span>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="1"
                  value={face.motionAmplitude ?? 20}
                  onChange={(e) => onUpdateFace({ motionAmplitude: Number(e.target.value) })}
                />
                <span className="deg-value">{face.motionAmplitude ?? 20}%</span>
              </div>

              {/* Điểm neo (Anchor) */}
              <div style={{ marginTop: 6 }}>
                <span className="field-sub-label" style={{ fontSize: 9 }}>Điểm neo ghim (Anchor):</span>
                <div className="region-pills-row" style={{ marginTop: 2 }}>
                  {MOTION_ANCHORS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`region-pill-btn${(face.motionAnchor || 'bottom') === a.id ? ' active' : ''}`}
                      onClick={() => onUpdateFace({ motionAnchor: a.id })}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hướng dao động (Direction) */}
              <div style={{ marginTop: 6 }}>
                <span className="field-sub-label" style={{ fontSize: 9 }}>Hướng dao động:</span>
                <div className="region-pills-row" style={{ marginTop: 2 }}>
                  {MOTION_DIRECTIONS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`region-pill-btn${(face.motionDirection || 'both') === d.id ? ' active' : ''}`}
                      onClick={() => onUpdateFace({ motionDirection: d.id })}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </details>

      {/* 5. Khung lưới thủ công & Gọt tỉa ô thừa */}
      <details className="fi-sub-collapsible" style={{ marginTop: 6 }}>
        <summary className="fi-sub-summary">
          <span>🛠️ Khung lưới thủ công & Gọt ô thừa</span>
          {hiddenCount > 0 ? <span className="fi-badge-active">Đã gọt {hiddenCount} ô</span> : null}
        </summary>
        <div className="fi-sub-body">
          <div className="inspector-grid-2" style={{ marginTop: 4 }}>
            <div className="inspector-field">
              <label>Số cột (Cols)</label>
              <input
                type="number"
                min="2"
                max="64"
                className="input-text"
                value={face.gridCols || currentRes}
                onChange={(e) =>
                  onUpdateFace({ gridCols: Math.max(2, Math.min(64, Number(e.target.value))) })
                }
              />
            </div>
            <div className="inspector-field">
              <label>Số hàng (Rows)</label>
              <input
                type="number"
                min="2"
                max="64"
                className="input-text"
                value={face.gridRows || currentRes}
                onChange={(e) =>
                  onUpdateFace({ gridRows: Math.max(2, Math.min(64, Number(e.target.value))) })
                }
              />
            </div>
          </div>

          {/* Gọt tỉa ô */}
          <div style={{ marginTop: 8 }}>
            {hiddenCount > 0 ? (
              <button
                type="button"
                className="btn xs secondary"
                onClick={() => onUpdateFace({ hiddenCells: [] })}
                title="Khôi phục lại toàn bộ các ô lưới đã gọt tỉa"
              >
                Khôi phục toàn bộ lưới ({hiddenCount} ô)
              </button>
            ) : (
              <span className="trim-hint-text">
                Giữ phím <strong>Alt + Click</strong> chuột trái vào ô lưới trong không gian 3D để gọt tỉa ô thừa.
              </span>
            )}
          </div>
        </div>
      </details>
    </div>
  )
}
