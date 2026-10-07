import type { Face3D } from './types'
import { IconLightning, IconMeshGrid, IconPin } from '../../icons'

export type ContextTab = 'grid' | 'depth' | 'motion' | 'bend'

interface Mesh2DHorizontalBarProps {
  face: Face3D
  activeTab: ContextTab
  setActiveTab: (tab: ContextTab) => void
  isManual: boolean
  cols: number
  rows: number
  rotation: number
  pinnedCellsCount: number
  selectedCellsCount: number
  onUpdateFace: (faceId: string, updates: Partial<Face3D>) => void
  handleSetGrid: (c: number, r: number) => void
  handleSetRotation: (deg: number) => void
  handleTogglePinSelected: () => void
}

export function Mesh2DHorizontalBar({
  face,
  activeTab,
  setActiveTab,
  isManual,
  cols,
  rows,
  rotation,
  pinnedCellsCount,
  selectedCellsCount,
  onUpdateFace,
  handleSetGrid,
  handleSetRotation,
  handleTogglePinSelected
}: Mesh2DHorizontalBarProps) {
  return (
    <div className="mesh2d-horizontal-bar">
      {/* Navigation Tabs */}
      <div className="mesh2d-tab-nav">
        <button
          type="button"
          className={`mesh2d-nav-btn${activeTab === 'grid' ? ' active' : ''}`}
          onClick={() => setActiveTab('grid')}
          title="Tùy chỉnh cấu trúc lưới Mesh (Số hàng/cột, xoay khung, chế độ tự động/thủ công)"
        >
          <span>📐 Lưới Mesh</span>
        </button>
        <button
          type="button"
          className={`mesh2d-nav-btn${activeTab === 'depth' ? ' active' : ''}`}
          onClick={() => setActiveTab('depth')}
          title="Độ sâu 2.5D After Effects (Đùn khối hình cầu, lăng trụ, dốc mái nghiêng)"
        >
          <span>✨ Chiều Sâu 2.5D</span>
          {face.depthProfile && face.depthProfile !== 'none' && (
            <span className="tab-counter-badge">ON</span>
          )}
        </button>
        <button
          type="button"
          className={`mesh2d-nav-btn${activeTab === 'motion' ? ' active' : ''}`}
          onClick={() => setActiveTab('motion')}
          title="Hoạt ảnh chuyển động vi mô After Effects (Gió thổi, thở, sóng lượn)"
        >
          <span>🎬 Hoạt Ảnh AE</span>
          {face.motionType && face.motionType !== 'none' && (
            <span className="tab-counter-badge">ON</span>
          )}
        </button>
        <button
          type="button"
          className={`mesh2d-nav-btn${activeTab === 'bend' ? ' active' : ''}`}
          onClick={() => setActiveTab('bend')}
          title="Ghim cố định (Starch Pin) & Uốn bẻ cong mesh theo trục"
        >
          <span>📌 Ghim & Bẻ</span>
          {(pinnedCellsCount > 0 || (face.bendX || 0) !== 0 || (face.bendY || 0) !== 0) && (
            <span className="tab-counter-badge">{pinnedCellsCount || '!'}</span>
          )}
        </button>
      </div>

      {/* Tab Sub-Row Controls */}
      <div className="mesh2d-tab-sub-row">
        {activeTab === 'grid' && (
          <>
            <div className="sub-group">
              <span className="sub-label">Chế độ:</span>
              <button
                type="button"
                className={`sub-pill-btn${!isManual ? ' active' : ''}`}
                onClick={() => onUpdateFace(face.id, { meshMode: 'auto' })}
                title="Tự động bám viền pixel và loại bỏ khoảng trong suốt"
              >
                <IconLightning size={12} /> Tự động
              </button>
              <button
                type="button"
                className={`sub-pill-btn${isManual ? ' active' : ''}`}
                onClick={() => onUpdateFace(face.id, { meshMode: 'manual' })}
                title="Khung lưới thủ công người dùng tự đặt"
              >
                <IconMeshGrid size={12} /> Thủ công
              </button>
            </div>

            <div className="sub-group">
              <span className="sub-label">Kích thước:</span>
              {[8, 16, 24, 32].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  className={`sub-pill-btn${cols === sz && rows === sz ? ' active' : ''}`}
                  onClick={() => handleSetGrid(sz, sz)}
                >
                  {sz}×{sz}
                </button>
              ))}
            </div>

            <div className="sub-group">
              <span className="sub-label">Xoay khung:</span>
              {[-45, 0, 45].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  className={`sub-pill-btn${rotation === deg ? ' active' : ''}`}
                  onClick={() => handleSetRotation(deg)}
                  title={`Xoay khung lưới ${deg}°`}
                >
                  {deg > 0 ? `+${deg}°` : `${deg}°`}
                </button>
              ))}
            </div>
          </>
        )}

        {activeTab === 'depth' && (
          <>
            <div className="sub-group">
              <span className="sub-label">Biên dạng:</span>
              {(
                [
                  ['none', 'Phẳng'],
                  ['sphere', 'Cầu lồi'],
                  ['cylinder', 'Trụ tròn'],
                  ['slope', 'Dốc mái'],
                  ['luminance', 'Độ sáng']
                ] as const
              ).map(([p, label]) => (
                <button
                  key={p}
                  type="button"
                  className={`sub-pill-btn${(face.depthProfile || 'none') === p ? ' active' : ''}`}
                  onClick={() => onUpdateFace(face.id, { depthProfile: p as any })}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="sub-group">
              <span className="sub-label">Độ sâu:</span>
              <input
                type="range"
                min="-60"
                max="60"
                step="2"
                value={face.depthIntensity ?? 20}
                onChange={(e) => onUpdateFace(face.id, { depthIntensity: Number(e.target.value) })}
                style={{ width: 80, accentColor: 'var(--accent)' }}
              />
              <span className="sub-val">{face.depthIntensity ?? 20}px</span>
            </div>

            <div className="sub-group">
              <button
                type="button"
                className={`sub-pill-btn${face.depthInvert ? ' active' : ''}`}
                onClick={() => onUpdateFace(face.id, { depthInvert: !face.depthInvert })}
                title="Đảo ngược hướng lồi/lõm của chiều sâu"
              >
                Đảo ngược
              </button>
            </div>
          </>
        )}

        {activeTab === 'motion' && (
          <>
            <div className="sub-group">
              <span className="sub-label">Kiểu:</span>
              {(
                [
                  ['none', 'Tắt'],
                  ['wind', 'Gió thổi'],
                  ['wave', 'Sóng lượn'],
                  ['breathe', 'Thở'],
                  ['wiggle', 'Rung nhẹ']
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  className={`sub-pill-btn${(face.motionType || 'none') === m ? ' active' : ''}`}
                  onClick={() => onUpdateFace(face.id, { motionType: m as any })}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="sub-group">
              <span className="sub-label">Tốc độ:</span>
              <input
                type="range"
                min="0.2"
                max="3.0"
                step="0.1"
                value={face.motionSpeed ?? 1.0}
                onChange={(e) => onUpdateFace(face.id, { motionSpeed: Number(e.target.value) })}
                style={{ width: 60, accentColor: 'var(--accent)' }}
              />
              <span className="sub-val">{(face.motionSpeed ?? 1.0).toFixed(1)}x</span>
            </div>

            <div className="sub-group">
              <span className="sub-label">Biên độ:</span>
              <input
                type="range"
                min="1"
                max="40"
                step="1"
                value={face.motionAmplitude ?? 12}
                onChange={(e) => onUpdateFace(face.id, { motionAmplitude: Number(e.target.value) })}
                style={{ width: 60, accentColor: 'var(--accent)' }}
              />
              <span className="sub-val">{face.motionAmplitude ?? 12}px</span>
            </div>
          </>
        )}

        {activeTab === 'bend' && (
          <>
            <div className="sub-group">
              <span className="sub-label">Uốn ngang (X):</span>
              <input
                type="range"
                min="-80"
                max="80"
                step="5"
                value={face.bendX ?? 0}
                onChange={(e) => onUpdateFace(face.id, { bendX: Number(e.target.value) })}
                style={{ width: 70, accentColor: 'var(--accent)' }}
              />
              <span className="sub-val">{face.bendX ?? 0}°</span>
            </div>

            <div className="sub-group">
              <span className="sub-label">Uốn dọc (Y):</span>
              <input
                type="range"
                min="-80"
                max="80"
                step="5"
                value={face.bendY ?? 0}
                onChange={(e) => onUpdateFace(face.id, { bendY: Number(e.target.value) })}
                style={{ width: 70, accentColor: 'var(--accent)' }}
              />
              <span className="sub-val">{face.bendY ?? 0}°</span>
            </div>

            {selectedCellsCount > 0 && (
              <div className="sub-group">
                <button
                  type="button"
                  className="sub-pill-btn gold"
                  onClick={handleTogglePinSelected}
                  title="Ghim cố định (Starch Pin): Vùng được ghim sẽ giữ nguyên vị trí"
                >
                  <IconPin size={12} /> Ghim/Tháo {selectedCellsCount} ô
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
