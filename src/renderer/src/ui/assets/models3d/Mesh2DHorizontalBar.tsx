import type { Face3D, OrigamiFoldLine, Warp3x3Preset } from './types'
import { IconLightning, IconMeshGrid, IconPin, IconWarpGrid, IconOrigamiFold } from '../../icons'

export type ContextTab = 'grid' | 'warp3x3' | 'fold' | 'depth' | 'motion' | 'bend'

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
  const fold = face.foldLine
  const isFoldEnabled = fold?.enabled ?? false
  const foldAngle = fold?.angle ?? 45
  const foldSide = fold?.foldSide || 'sideA'

  // Quick fold presets
  const applyFoldPreset = (preset: 'horizontal' | 'vertical' | 'diag45' | 'roof30') => {
    let p1: [number, number] = [0.05, 0.5]
    let p2: [number, number] = [0.95, 0.5]
    let angle = 90

    if (preset === 'horizontal') {
      p1 = [0.05, 0.5]
      p2 = [0.95, 0.5]
      angle = 90
    } else if (preset === 'vertical') {
      p1 = [0.5, 0.05]
      p2 = [0.5, 0.95]
      angle = 90
    } else if (preset === 'diag45') {
      p1 = [0.05, 0.05]
      p2 = [0.95, 0.95]
      angle = 60
    } else if (preset === 'roof30') {
      p1 = [0.05, 0.35]
      p2 = [0.95, 0.35]
      angle = 45
    }

    onUpdateFace(face.id, {
      foldLine: {
        enabled: true,
        p1,
        p2,
        foldSide: fold?.foldSide || 'sideA',
        angle: fold?.angle || angle
      }
    })
  }

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
          className={`mesh2d-nav-btn${activeTab === 'warp3x3' ? ' active' : ''}`}
          onClick={() => setActiveTab('warp3x3')}
          title="Lưới uốn 3×3 chuẩn Photoshop: Nếp gấp cầu thang, vòm cong, uốn góc"
        >
          <IconWarpGrid size={13} />
          <span>Lưới 3×3 & Bậc</span>
          {face.warp3x3Mode && face.warp3x3Mode !== 'none' && (
            <span className="tab-counter-badge cyan">3×3</span>
          )}
        </button>

        <button
          type="button"
          className={`mesh2d-nav-btn${activeTab === 'fold' ? ' active' : ''}`}
          onClick={() => setActiveTab('fold')}
          title="Nếp gấp Origami 3D: Chia ảnh theo đường kẻ và gấp góc 3D như hộp bìa"
        >
          <IconOrigamiFold size={13} />
          <span>Gấp Origami</span>
          {isFoldEnabled && <span className="tab-counter-badge amber">FOLD</span>}
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
        {/* 1. Lưới Mesh */}
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

        {/* 2. Photoshop 3x3 Warp Grid & Stairs */}
        {activeTab === 'warp3x3' && (
          <>
            <div className="sub-group">
              <span className="sub-label">Kiểu 3×3:</span>
              {(
                [
                  ['none', 'Tắt'],
                  ['stairs', '🪜 Cầu thang'],
                  ['arch', 'Vòm cong'],
                  ['corner', 'Góc chữ L'],
                  ['wave', 'Sóng uốn']
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={`sub-pill-btn${(face.warp3x3Mode || 'none') === mode ? ' active' : ''}`}
                  onClick={() => onUpdateFace(face.id, { warp3x3Mode: mode as Warp3x3Preset })}
                >
                  {label}
                </button>
              ))}
            </div>

            {face.warp3x3Mode && face.warp3x3Mode !== 'none' && (
              <div className="sub-group">
                <span className="sub-label">
                  {face.warp3x3Mode === 'stairs' ? 'Độ cao bậc:' : 'Cường độ:'}
                </span>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={face.warp3x3Intensity ?? 30}
                  onChange={(e) => onUpdateFace(face.id, { warp3x3Intensity: Number(e.target.value) })}
                  style={{ width: 80, accentColor: 'var(--accent-cyan)' }}
                />
                <span className="sub-val">{face.warp3x3Intensity ?? 30}px</span>
              </div>
            )}
          </>
        )}

        {/* 3. Origami 3D Fold Line */}
        {activeTab === 'fold' && (
          <>
            <div className="sub-group">
              <button
                type="button"
                className={`sub-pill-btn${isFoldEnabled ? ' active' : ''}`}
                onClick={() => {
                  const nextState = !isFoldEnabled
                  onUpdateFace(face.id, {
                    foldLine: {
                      enabled: nextState,
                      p1: fold?.p1 || [0.05, 0.5],
                      p2: fold?.p2 || [0.95, 0.5],
                      foldSide: fold?.foldSide || 'sideA',
                      angle: fold?.angle || 60
                    }
                  })
                }}
              >
                {isFoldEnabled ? '✓ Đang bật nếp gấp' : 'Bật nếp gấp Origami'}
              </button>
            </div>

            {isFoldEnabled && (
              <>
                <div className="sub-group">
                  <span className="sub-label">Mẫu nhanh:</span>
                  <button
                    type="button"
                    className="sub-pill-btn"
                    onClick={() => applyFoldPreset('horizontal')}
                    title="Gấp ngang giữa ảnh 90°"
                  >
                    Ngang 50%
                  </button>
                  <button
                    type="button"
                    className="sub-pill-btn"
                    onClick={() => applyFoldPreset('vertical')}
                    title="Gấp dọc giữa ảnh 90°"
                  >
                    Dọc 50%
                  </button>
                  <button
                    type="button"
                    className="sub-pill-btn"
                    onClick={() => applyFoldPreset('diag45')}
                    title="Đường chéo 45°"
                  >
                    Chéo 45°
                  </button>
                  <button
                    type="button"
                    className="sub-pill-btn"
                    onClick={() => applyFoldPreset('roof30')}
                    title="Nếp dốc mái 35%"
                  >
                    Mái hiên
                  </button>
                </div>

                <div className="sub-group">
                  <span className="sub-label">Góc gập:</span>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="5"
                    value={foldAngle}
                    onChange={(e) =>
                      onUpdateFace(face.id, {
                        foldLine: {
                          ...fold!,
                          angle: Number(e.target.value)
                        }
                      })
                    }
                    style={{ width: 80, accentColor: '#f59e0b' }}
                  />
                  <span className="sub-val" style={{ color: '#fbbf24' }}>
                    {foldAngle > 0 ? `+${foldAngle}°` : `${foldAngle}°`}
                  </span>
                </div>

                <div className="sub-group">
                  <button
                    type="button"
                    className="sub-pill-btn gold"
                    onClick={() =>
                      onUpdateFace(face.id, {
                        foldLine: {
                          ...fold!,
                          foldSide: foldSide === 'sideA' ? 'sideB' : 'sideA'
                        }
                      })
                    }
                    title="Đổi bên gập (Bên A hoặc Bên B)"
                  >
                    Đổi bên gấp ({foldSide === 'sideA' ? 'Phần A' : 'Phần B'})
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* 4. Chiều Sâu 2.5D */}
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

        {/* 5. Hoạt Ảnh AE */}
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

        {/* 6. Ghim & Bẻ */}
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
