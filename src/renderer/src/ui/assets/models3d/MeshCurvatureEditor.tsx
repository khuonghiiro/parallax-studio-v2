import type { Face3D } from './types'
import type { DepthProfileType, MotionType, MotionDirection, MotionAnchor } from './meshEffectsAE'

interface MeshCurvatureEditorProps {
  face: Face3D
  onUpdateFace: (patch: Partial<Face3D>) => void
}

const REGION_OPTIONS: Array<{
  id: 'all' | 'bottom' | 'top' | 'left' | 'right'
  label: string
  desc: string
}> = [
  { id: 'all', label: 'Toàn bộ', desc: 'Uốn cong toàn bộ bề mặt' },
  { id: 'bottom', label: 'Mái hiên / Mép dưới', desc: 'Phần trên phẳng, chỉ uốn lượn mép dưới' },
  { id: 'top', label: 'Đỉnh mái / Mép trên', desc: 'Phần dưới phẳng, chỉ uốn cong đỉnh trên' },
  { id: 'left', label: 'Cánh trái', desc: 'Chỉ uốn cong gập mép trái' },
  { id: 'right', label: 'Cánh phải', desc: 'Chỉ uốn cong gập mép phải' }
]

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
  const currentRegion = face.bendRegion || 'all'
  const currentRes = face.gridRes || 32
  const currentDepthProfile = face.depthProfile || 'none'
  const currentMotionType = face.motionType || 'none'
  const hiddenCount = face.hiddenCells?.length || 0

  const handleResetHiddenCells = () => {
    onUpdateFace({ hiddenCells: [] })
  }

  return (
    <div className="inspector-field-group mesh-curvature-editor">
      <label className="group-label">Uốn lượn & Chỉnh sửa Mesh (Curvature & Sub-Mesh)</label>

      {/* Chế độ Mesh: Tự Động (Auto Pixel Trim) vs Thủ Công (Custom Grid Frame) */}
      <div className="mesh-mode-selector-row" style={{ marginBottom: 12 }}>
        <span className="field-sub-label">Phương thức tạo Mesh:</span>
        <div className="inspector-grid-2" style={{ marginTop: 4 }}>
          <button
            type="button"
            className={`snap-btn${face.meshMode !== 'manual' ? ' active' : ''}`}
            onClick={() => onUpdateFace({ meshMode: 'auto' })}
            title="Tự động phát hiện viền ảnh và chỉ tạo mesh tại vùng có pixel (loại bỏ khoảng trắng)"
          >
            ⚡ Mesh Tự Động
          </button>
          <button
            type="button"
            className={`snap-btn${face.meshMode === 'manual' ? ' active' : ''}`}
            onClick={() => onUpdateFace({ meshMode: 'manual' })}
            title="Tự tạo khung lưới đa giác, tùy chỉnh số cột/hàng, xoay góc lấy pixel nghiêng và bẻ uốn từng ô"
          >
            🛠️ Mesh Thủ Công
          </button>
        </div>
      </div>

      {/* A. After Effects 2.5D Depth Extrusion (Tạo Độ Sâu / Displacement Map) */}
      <div className="custom-mesh-frame-box" style={{ marginBottom: 12 }}>
        <div className="trim-header-row">
          <span className="field-sub-label">✨ Tạo Độ Sâu 2.5D (AE Depth Extrusion):</span>
          <span className="scale-badge" title="Tạo chiều sâu 3D từ ảnh 2D">
            {currentDepthProfile !== 'none' ? `${face.depthIntensity || 0}%` : '2D'}
          </span>
        </div>
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
              <button
                type="button"
                className="snap-btn"
                onClick={() => onUpdateFace({ depthIntensity: -50 })}
              >
                -50% (Lõm)
              </button>
              <button
                type="button"
                className="snap-btn"
                onClick={() => onUpdateFace({ depthIntensity: 50 })}
              >
                +50% (Vừa)
              </button>
              <button
                type="button"
                className="snap-btn"
                onClick={() => onUpdateFace({ depthIntensity: 100 })}
              >
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

      {/* B. After Effects Procedural Mesh Motion (Tạo Chuyển Động từ Ảnh 2D) */}
      <div className="custom-mesh-frame-box" style={{ marginBottom: 12 }}>
        <div className="trim-header-row">
          <span className="field-sub-label">🎬 Tạo Chuyển Động (AE Wave & Puppet):</span>
          <span className="scale-badge" title="Tạo hoạt ảnh sống động cho ảnh 2D">
            {currentMotionType !== 'none' ? 'Đang chạy' : 'Tĩnh'}
          </span>
        </div>
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

      {/* 1. Phạm vi uốn cong từng phần */}
      <div className="bend-region-picker">
        <span className="field-sub-label">Phạm vi uốn 1 phần (Region):</span>
        <div className="region-pills-row">
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

      {/* 2. Bend X - Uốn cong vòm ngang */}
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
      <div className="quick-snaps">
        <button type="button" className="snap-btn" onClick={() => onUpdateFace({ bendX: -50 })}>
          -50% (Lõm)
        </button>
        <button type="button" className="snap-btn" onClick={() => onUpdateFace({ bendX: 0 })}>
          0% (Phẳng)
        </button>
        <button type="button" className="snap-btn" onClick={() => onUpdateFace({ bendX: 50 })}>
          +50% (Vòm)
        </button>
      </div>

      {/* 3. Bend Y - Uốn cong vểnh mép dọc */}
      <div className="rot-slider-row" style={{ marginTop: 6 }}>
        <span className="rot-label" title="Uốn cong mép mái vểnh hoặc sóng uốn lượn theo chiều dọc">
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
      <div className="quick-snaps">
        <button type="button" className="snap-btn" onClick={() => onUpdateFace({ bendY: -30 })}>
          -30% (Cụp)
        </button>
        <button type="button" className="snap-btn" onClick={() => onUpdateFace({ bendY: 0 })}>
          0% (Phẳng)
        </button>
        <button type="button" className="snap-btn" onClick={() => onUpdateFace({ bendY: 30 })}>
          +30% (Vểnh)
        </button>
      </div>

      {/* 4. Độ chi tiết của lưới đa giác (Grid Resolution) */}
      <div className="grid-resolution-selector" style={{ marginTop: 10 }}>
        <span className="field-sub-label">Độ chi tiết lưới (Grid Presets):</span>
        <div className="grid-res-buttons">
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

      {/* 5. Khung lưới thủ công & Trục xoay căn khớp pixel nghiêng */}
      <div className="custom-mesh-frame-box" style={{ marginTop: 10 }}>
        <span className="field-sub-label">Tự tạo Khung lưới & Xoay lấy Pixel:</span>
        <div className="inspector-grid-2">
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

        {/* Trục xoay góc khung lưới (-180..180) */}
        <div className="rot-slider-row" style={{ marginTop: 6 }}>
          <span
            className="rot-label"
            title="Xoay khung lưới để căn khớp đường chéo của mái dốc hoặc chi tiết xiên"
          >
            Xoay khung
          </span>
          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            value={face.gridRotation || 0}
            onChange={(e) => onUpdateFace({ gridRotation: Number(e.target.value) })}
          />
          <span className="deg-value">{face.gridRotation || 0}°</span>
        </div>
        <div className="quick-snaps">
          <button type="button" className="snap-btn" onClick={() => onUpdateFace({ gridRotation: -45 })}>
            -45° (Mái trái)
          </button>
          <button type="button" className="snap-btn" onClick={() => onUpdateFace({ gridRotation: 0 })}>
            0° (Chuẩn)
          </button>
          <button type="button" className="snap-btn" onClick={() => onUpdateFace({ gridRotation: 45 })}>
            +45° (Mái phải)
          </button>
          <button type="button" className="snap-btn" onClick={() => onUpdateFace({ gridRotation: 90 })}>
            90° (Ngang)
          </button>
        </div>
      </div>

      {/* 6. Bẻ uốn & Xoay vùng ô mesh được chọn */}
      <div className="custom-mesh-frame-box" style={{ marginTop: 8 }}>
        <div className="trim-header-row">
          <span className="field-sub-label">Bẻ uốn vùng ô chọn:</span>
          <span className="scale-badge">
            {face.selectedCells?.length ? `Chọn ${face.selectedCells.length} ô` : 'Chưa chọn ô'}
          </span>
        </div>
        <div className="rot-slider-row">
          <span className="rot-label" title="Bẻ gập / uốn riêng các ô lưới đang được chọn">
            Bẻ gập ô
          </span>
          <input
            type="range"
            min="-90"
            max="90"
            step="1"
            value={face.cellBendAngle || 0}
            onChange={(e) => onUpdateFace({ cellBendAngle: Number(e.target.value) })}
          />
          <span className="deg-value">{face.cellBendAngle || 0}°</span>
        </div>
        <div className="quick-snaps">
          <button type="button" className="snap-btn" onClick={() => onUpdateFace({ cellBendAngle: -45 })}>
            -45°
          </button>
          <button type="button" className="snap-btn" onClick={() => onUpdateFace({ cellBendAngle: 0 })}>
            0° (Thẳng)
          </button>
          <button type="button" className="snap-btn" onClick={() => onUpdateFace({ cellBendAngle: 45 })}>
            +45°
          </button>
          {face.selectedCells?.length ? (
            <button
              type="button"
              className="snap-btn"
              onClick={() => onUpdateFace({ selectedCells: [] })}
              title="Bỏ chọn tất cả các ô"
            >
              Bỏ chọn ô
            </button>
          ) : null}
        </div>
      </div>

      {/* 7. Chỉnh sửa / Gọt tỉa từng ô lưới (Manual Mesh Cell Trimming) */}
      <div className="mesh-trim-management" style={{ marginTop: 10 }}>
        <div className="trim-header-row">
          <span className="field-sub-label">Gọt tỉa 1 phần ô lưới (Sub-mesh Erase):</span>
          {hiddenCount > 0 && <span className="hidden-cells-count">Đã gọt {hiddenCount} ô</span>}
        </div>
        <div className="trim-actions-row">
          {hiddenCount > 0 ? (
            <button
              type="button"
              className="btn xs secondary reset-mesh-btn"
              onClick={handleResetHiddenCells}
              title="Khôi phục lại toàn bộ các ô lưới đã gọt tỉa"
            >
              Khôi phục toàn bộ lưới ({hiddenCount})
            </button>
          ) : (
            <span className="trim-hint-text">
              Giữ phím <strong>Alt + Click</strong> chuột trái vào ô lưới trong không gian 3D để gọt/tỉa từng ô thừa.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
