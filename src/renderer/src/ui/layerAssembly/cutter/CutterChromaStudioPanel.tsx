import React, { useState } from 'react'
import type {
  ChromaCleanupMode,
  ChromaKeyColorType,
  ChromaKeySettings,
  EyedropperSample,
  EyedropperTarget
} from './types'
import { DEFAULT_CHROMA_SETTINGS } from './types'
import { PhotoshopEyedropperButton } from './PhotoshopEyedropperOverlay'
import { ColorInput } from '../../controls/ColorPicker'

export interface CutterChromaStudioPanelProps {
  chroma: ChromaKeySettings
  eyedropperTarget: EyedropperTarget | null
  eyedropperSample: EyedropperSample | null
  onChangeChroma: (patch: Partial<ChromaKeySettings>) => void
  onToggleEyedropper: (target: EyedropperTarget) => void
  onResetChroma: () => void
}

export function CutterChromaStudioPanel({
  chroma,
  eyedropperTarget,
  eyedropperSample,
  onChangeChroma,
  onToggleEyedropper,
  onResetChroma
}: CutterChromaStudioPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'chroma' | 'cleanup'>('chroma')

  const keyType: ChromaKeyColorType = chroma.keyColorType || 'custom'
  const isolationMode = chroma.isolationMode || 'outer_only'
  const cleanupMode: ChromaCleanupMode = chroma.cleanupMode || 'all'
  const fringeType: ChromaKeyColorType = chroma.fringeColorType || 'pure_white'
  const smoothColorType = chroma.smoothColorType || 'none'
  const isOriginalPreview = chroma.previewMode === 'original'

  const handleSelectKeyPreset = (type: ChromaKeyColorType, hex: string) => {
    onChangeChroma({
      enabled: true,
      keyColorType: type,
      keyColorHex: hex,
      fringeColorType: type,
      fringeColorHex: hex
    })
  }

  return (
    <div className="cutter-studio-panel">
      {/* Header chuyển đổi 2 Sub-tabs giống Xưởng Lắp Ráp 2D (AI-Render-Video) */}
      <div className="cutter-studio-panel-header">
        <div className="cutter-studio-subtabs">
          <button
            id="btn-cutter-subtab-chroma"
            type="button"
            className={`cutter-studio-subtab ${activeSubTab === 'chroma' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('chroma')}
          >
            🎨 1. Tách màu & Viền (Chroma Key)
          </button>
          <button
            id="btn-cutter-subtab-cleanup"
            type="button"
            className={`cutter-studio-subtab ${activeSubTab === 'cleanup' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('cleanup')}
          >
            🧹 2. Khử viền sượng & Lọc rác (Defringe & Despeckle)
          </button>
        </div>

        <div className="cutter-studio-header-right">
          {/* Nút chuyển đổi Đã tách nền vs Ảnh gốc */}
          <div className="cutter-preview-mode-group" title="Đối chiếu kết quả đã tách nền với ảnh gốc ban đầu">
            <button
              type="button"
              className={`cutter-preview-mode-btn ${!isOriginalPreview && chroma.enabled ? 'active' : ''}`}
              onClick={() => onChangeChroma({ enabled: true, previewMode: 'transparent' })}
            >
              🔍 Đã tách nền
            </button>
            <button
              type="button"
              className={`cutter-preview-mode-btn ${isOriginalPreview || !chroma.enabled ? 'active' : ''}`}
              onClick={() => onChangeChroma({ previewMode: isOriginalPreview ? 'transparent' : 'original' })}
            >
              🖼️ Ảnh gốc
            </button>
          </div>

          <button
            type="button"
            className="cutter-studio-reset-btn"
            onClick={onResetChroma}
            title="Khôi phục toàn bộ thông số tách nền & lọc rác về mặc định chuẩn"
          >
            ↺ Mặc định
          </button>
        </div>
      </div>

      {/* Nội dung Sub-tab 1: Tách màu & Viền (Chroma Key) */}
      {activeSubTab === 'chroma' ? (
        <div className="cutter-studio-body">
          {/* Hàng 1: Chọn màu nền nhanh + Nút Hút màu Photoshop + Phạm vi bóc tách */}
          <div className="cutter-studio-row-top">
            <div className="cutter-studio-field-group">
              <span className="cutter-field-label">Màu nền xóa:</span>
              <div className="cutter-color-preset-pills">
                <button
                  type="button"
                  className={`cutter-color-pill ${keyType === 'chroma_green' ? 'active green' : ''}`}
                  onClick={() => handleSelectKeyPreset('chroma_green', '#00FF00')}
                  title="Tách phông xanh lá chuẩn Studio (#00FF00)"
                >
                  <span className="pill-dot" style={{ background: '#00ff00' }} />
                  Xanh lá
                </button>
                <button
                  type="button"
                  className={`cutter-color-pill ${keyType === 'pure_white' ? 'active white' : ''}`}
                  onClick={() => handleSelectKeyPreset('pure_white', '#FFFFFF')}
                  title="Tách phông nền trắng tinh (#FFFFFF)"
                >
                  <span className="pill-dot" style={{ background: '#ffffff', border: '1px solid #888' }} />
                  Trắng tinh
                </button>
                <button
                  type="button"
                  className={`cutter-color-pill ${keyType === 'pure_black' ? 'active black' : ''}`}
                  onClick={() => handleSelectKeyPreset('pure_black', '#000000')}
                  title="Tách phông nền đen (#000000)"
                >
                  <span className="pill-dot" style={{ background: '#000000', border: '1px solid #666' }} />
                  Đen
                </button>
              </div>

              {/* Cụm Hút màu kiểu Adobe Photoshop + Chọn màu tùy chỉnh + Mã HEX */}
              <PhotoshopEyedropperButton
                id="btn-cutter-eyedropper"
                active={eyedropperTarget === 'key'}
                currentHex={chroma.keyColorHex}
                hoveredHex={eyedropperTarget === 'key' ? eyedropperSample?.hex : null}
                label="Hút màu"
                title="Bấm để bật Kính lúp Hút màu nền kiểu Adobe Photoshop (hiển thị vòng đối chiếu màu Mới/Cũ, lưới pixel 9x9 và mã #HEX)"
                onToggle={() => onToggleEyedropper('key')}
              />

              <div className="cutter-hex-picker-inline" title="Chỉnh màu thủ công hoặc nhập mã HEX">
                <ColorInput
                  compact
                  showText={false}
                  value={chroma.keyColorHex}
                  onChange={(hex) =>
                    onChangeChroma({
                      enabled: true,
                      keyColorType: 'custom',
                      keyColorHex: hex.toUpperCase()
                    })
                  }
                />
                <input
                  type="text"
                  className="cutter-hex-input"
                  value={chroma.keyColorHex.toUpperCase()}
                  maxLength={7}
                  onChange={(e) => {
                    const val = e.target.value
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                      onChangeChroma({
                        enabled: true,
                        keyColorType: 'custom',
                        keyColorHex: val.toUpperCase()
                      })
                    }
                  }}
                  title="Nhập trực tiếp mã màu HEX (ví dụ: #00FF00)"
                />
              </div>
            </div>

            {/* Phạm vi bóc tách: Bảo vệ ruột (BFS) vs Toàn bộ ảnh */}
            <div className="cutter-studio-field-group" style={{ marginLeft: 'auto' }}>
              <span className="cutter-field-label">Phạm vi tách:</span>
              <div className="cutter-isolation-group">
                <button
                  type="button"
                  className={`cutter-iso-btn ${isolationMode === 'outer_only' ? 'active' : ''}`}
                  onClick={() => onChangeChroma({ isolationMode: 'outer_only' })}
                  title="Bảo vệ ruột (BFS Flood-Fill từ 4 cạnh ngoài): Giữ nguyên lòng trắng mắt, răng, họa tiết áo bên trong nhân vật không bị đục thủng"
                >
                  🛡️ Bảo vệ ruột (BFS)
                </button>
                <button
                  type="button"
                  className={`cutter-iso-btn ${isolationMode === 'all' ? 'active' : ''}`}
                  onClick={() => onChangeChroma({ isolationMode: 'all' })}
                  title="Toàn bộ ảnh: Xóa tất cả các vùng trùng màu nền kể cả các khe hở kín bên trong"
                >
                  🌐 Toàn bộ ảnh
                </button>
              </div>
            </div>
          </div>

          {/* Hàng 2: 4 Thanh trượt thông số tách nền chuyên sâu */}
          <div className="cutter-studio-sliders-grid">
            {/* 1. Độ nhạy (Tolerance) */}
            <div className="cutter-slider-card">
              <div className="cutter-slider-head">
                <span>🎯 Độ nhạy xóa nền (Tolerance)</span>
                <strong>{chroma.tolerance}%</strong>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={chroma.tolerance}
                onChange={(e) => onChangeChroma({ tolerance: Number(e.target.value) })}
              />
            </div>

            {/* 2. Làm mềm biên (Feather) */}
            <div className="cutter-slider-card">
              <div className="cutter-slider-head">
                <span>🪶 Làm mềm biên (Feather)</span>
                <strong>{chroma.smoothness}px</strong>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                value={chroma.smoothness}
                onChange={(e) => onChangeChroma({ smoothness: Number(e.target.value) })}
              />
            </div>

            {/* 3. Giữ bóng đổ (Shadow Retention) */}
            <div className="cutter-slider-card">
              <div className="cutter-slider-head">
                <span>🌑 Giữ bóng đổ (Shadow)</span>
                <strong>{chroma.shadowRetention ?? 0}%</strong>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={chroma.shadowRetention ?? 0}
                onChange={(e) => onChangeChroma({ shadowRetention: Number(e.target.value) })}
              />
            </div>

            {/* 4. Viền nét Anime (Stroke Outline) */}
            <div className="cutter-slider-card">
              <div className="cutter-slider-head">
                <span>✨ Viền nét Anime (Stroke)</span>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ColorInput
                    compact
                    showText={false}
                    value={chroma.strokeColorHex || '#ffffff'}
                    onChange={(hex) => onChangeChroma({ strokeColorHex: hex })}
                  />
                  <strong>{chroma.strokeWidth ?? 0}px</strong>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                value={chroma.strokeWidth ?? 0}
                onChange={(e) => onChangeChroma({ strokeWidth: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>
      ) : (
        /* Nội dung Sub-tab 2: Khử viền sượng & Lọc rác (Defringe & Despeckle) */
        <div className="cutter-studio-body">
          {/* Hàng chọn Chế độ lọc */}
          <div className="cutter-studio-row-top">
            <div className="cutter-studio-field-group">
              <span className="cutter-field-label">Chế độ lọc:</span>
              <div className="cutter-isolation-group">
                {(
                  [
                    { id: 'all', label: '⚡ Kết hợp tất cả' },
                    { id: 'defringe', label: '🎨 Khử màu viền' },
                    { id: 'smooth', label: '✨ Gọt & Mịn viền' },
                    { id: 'despeckle', label: '🧹 Lọc bụi & Rác' }
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`cutter-iso-btn ${cleanupMode === m.id ? 'active' : ''}`}
                    onClick={() => onChangeChroma({ cleanupMode: m.id })}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Checkbox chỉ giữ cụm lớn nhất */}
            <label
              className="layer-cutter-check-pill"
              style={{ marginLeft: 'auto' }}
              title="Tự động loại bỏ toàn bộ các đốm/mảnh vụn trôi nổi bên ngoài, chỉ giữ lại cụm nhân vật/đạo cụ lớn nhất"
            >
              <input
                type="checkbox"
                checked={Boolean(chroma.keepLargestIslandOnly)}
                onChange={(e) => onChangeChroma({ keepLargestIslandOnly: e.target.checked })}
              />
              <span>🏝️ Chỉ giữ cụm lớn nhất</span>
            </label>
          </div>

          {/* 3 Khối điều khiển chuyên sâu: Defringe + Edge Choke/Smooth + Despeckle */}
          <div className="cutter-cleanup-columns">
            {/* Cột 1: Khử màu viền rác (Defringe) */}
            {(cleanupMode === 'all' || cleanupMode === 'defringe') && (
              <div className="cutter-cleanup-box">
                <div className="cutter-cleanup-box-head">
                  <span>🎨 Khử màu viền bám (Defringe)</span>
                  <div className="cutter-mini-color-bar">
                    <button
                      type="button"
                      className={`mini-color-dot ${fringeType === 'chroma_green' ? 'active' : ''}`}
                      style={{ background: '#00ff00' }}
                      onClick={() =>
                        onChangeChroma({ fringeColorType: 'chroma_green', fringeColorHex: '#00FF00' })
                      }
                      title="Khử viền ám xanh lá"
                    />
                    <button
                      type="button"
                      className={`mini-color-dot ${fringeType === 'pure_white' ? 'active' : ''}`}
                      style={{ background: '#ffffff' }}
                      onClick={() =>
                        onChangeChroma({ fringeColorType: 'pure_white', fringeColorHex: '#FFFFFF' })
                      }
                      title="Khử viền răng cưa trắng"
                    />
                    <button
                      type="button"
                      className={`mini-color-dot ${fringeType === 'pure_black' ? 'active' : ''}`}
                      style={{ background: '#000000' }}
                      onClick={() =>
                        onChangeChroma({ fringeColorType: 'pure_black', fringeColorHex: '#000000' })
                      }
                      title="Khử viền đen"
                    />
                    <PhotoshopEyedropperButton
                      active={eyedropperTarget === 'fringe'}
                      currentHex={chroma.fringeColorHex || chroma.keyColorHex}
                      hoveredHex={eyedropperTarget === 'fringe' ? eyedropperSample?.hex : null}
                      label="Hút viền"
                      onToggle={() => onToggleEyedropper('fringe')}
                    />
                  </div>
                </div>
                <div className="cutter-slider-card compact">
                  <div className="cutter-slider-head">
                    <span>Độ mạnh khử màu viền</span>
                    <strong>{chroma.defringeStrength ?? 45}%</strong>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={chroma.defringeStrength ?? 45}
                    onChange={(e) => onChangeChroma({ defringeStrength: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}

            {/* Cột 2: Gọt & Làm mịn viền (Edge Choke & Smooth) */}
            {(cleanupMode === 'all' || cleanupMode === 'smooth') && (
              <div className="cutter-cleanup-box">
                <div className="cutter-cleanup-box-head">
                  <span>✨ Gọt & Mịn viền (Choke & Smooth)</span>
                  <div className="cutter-mini-color-bar">
                    {(
                      [
                        { id: 'none', label: 'Gốc' },
                        { id: 'black', label: 'Đen' },
                        { id: 'white', label: 'Trắng' }
                      ] as const
                    ).map((sc) => (
                      <button
                        key={sc.id}
                        type="button"
                        className={`cutter-tiny-pill ${smoothColorType === sc.id ? 'active' : ''}`}
                        onClick={() => onChangeChroma({ smoothColorType: sc.id })}
                      >
                        {sc.label}
                      </button>
                    ))}
                    <PhotoshopEyedropperButton
                      active={eyedropperTarget === 'smooth'}
                      currentHex={chroma.smoothColorHex || '#000000'}
                      hoveredHex={eyedropperTarget === 'smooth' ? eyedropperSample?.hex : null}
                      label="Hút mịn"
                      onToggle={() => onToggleEyedropper('smooth')}
                    />
                  </div>
                </div>
                <div className="cutter-dual-sliders">
                  <div className="cutter-slider-card compact">
                    <div className="cutter-slider-head">
                      <span>✂️ Gọt lùi viền (Choke)</span>
                      <strong>{chroma.edgeChoke ?? 0}px</strong>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={chroma.edgeChoke ?? 0}
                      onChange={(e) => onChangeChroma({ edgeChoke: Number(e.target.value) })}
                    />
                  </div>
                  <div className="cutter-slider-card compact">
                    <div className="cutter-slider-head">
                      <span>✨ Khử răng cưa (Smooth)</span>
                      <strong>{chroma.edgeSmooth ?? 2}px</strong>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={chroma.edgeSmooth ?? 2}
                      onChange={(e) => onChangeChroma({ edgeSmooth: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Cột 3: Lọc bụi & Đốm vụn (Despeckle) */}
            {(cleanupMode === 'all' || cleanupMode === 'despeckle') && (
              <div className="cutter-cleanup-box">
                <div className="cutter-cleanup-box-head">
                  <span>🧹 Lọc bụi & Hạt sáng (Despeckle)</span>
                </div>
                <div className="cutter-dual-sliders">
                  <div className="cutter-slider-card compact">
                    <div className="cutter-slider-head">
                      <span>🧹 Xoá đốm rác nhỏ</span>
                      <strong>{chroma.despeckleSize ?? 16}px</strong>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={300}
                      value={chroma.despeckleSize ?? 16}
                      onChange={(e) => onChangeChroma({ despeckleSize: Number(e.target.value) })}
                    />
                  </div>
                  <div className="cutter-slider-card compact">
                    <div className="cutter-slider-head">
                      <span>✨ Khử hạt bụi sáng</span>
                      <strong>{chroma.whiteSpeckleSensitivity ?? 0}%</strong>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={chroma.whiteSpeckleSensitivity ?? 0}
                      onChange={(e) =>
                        onChangeChroma({ whiteSpeckleSensitivity: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export { DEFAULT_CHROMA_SETTINGS }
