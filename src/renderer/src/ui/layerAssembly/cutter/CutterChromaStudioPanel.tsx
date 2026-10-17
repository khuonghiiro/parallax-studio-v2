import React, { useState } from 'react'
import type {
  ChromaKeyColorType,
  ChromaKeySettings,
  ChromaShadowMode,
  ChromaShadowType,
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
  onToggleEyedropper
}: CutterChromaStudioPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'chroma' | 'cleanup'>('chroma')

  const keyType: ChromaKeyColorType = chroma.keyColorType || 'custom'
  const isolationMode = chroma.isolationMode || 'outer_only'
  const fringeType: ChromaKeyColorType = chroma.fringeColorType || 'pure_white'
  const smoothColorType = chroma.smoothColorType || 'none'
  const shadowMode: ChromaShadowMode =
    chroma.shadowMode && chroma.shadowMode !== 'off'
      ? chroma.shadowMode
      : chroma.keepShadows
        ? 'include'
        : 'off'
  const shadowType: ChromaShadowType = chroma.shadowType || 'auto'
  const shadowRetention =
    chroma.shadowRetention && chroma.shadowRetention > 0 ? chroma.shadowRetention : 68
  const shadowSolidThreshold = chroma.shadowSolidThreshold ?? 62
  const shadowUnmixColor = chroma.shadowUnmixColor ?? true

  const handleSelectShadowMode = (mode: ChromaShadowMode) => {
    onChangeChroma({
      enabled: true,
      shadowMode: mode,
      keepShadows: mode !== 'off',
      ...(mode !== 'off' && (!chroma.shadowRetention || chroma.shadowRetention <= 0)
        ? { shadowRetention: 68 }
        : {})
    })
  }

  const handleSelectShadowType = (type: ChromaShadowType) => {
    onChangeChroma({
      enabled: true,
      shadowType: type,
      shadowMode: shadowMode === 'off' ? 'include' : shadowMode,
      keepShadows: true,
      ...(!chroma.shadowRetention || chroma.shadowRetention <= 0 ? { shadowRetention: 68 } : {})
    })
  }

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
      {/* Hàng 1: Tab chuyển đổi + Mẫu màu / Hút màu / Phạm vi (Cao chỉ 28px, căn thẳng hàng hoàn hảo) */}
      <div className="cutter-studio-panel-header">
        {/* 2 Sub-tabs gọn gàng */}
        <div className="cutter-studio-subtabs">
          <button
            id="btn-cutter-subtab-chroma"
            type="button"
            className={`cutter-studio-subtab ${activeSubTab === 'chroma' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('chroma')}
          >
            Tách màu
          </button>
          <button
            id="btn-cutter-subtab-cleanup"
            type="button"
            className={`cutter-studio-subtab ${activeSubTab === 'cleanup' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('cleanup')}
          >
            Khử viền
          </button>
        </div>

        <div className="cutter-studio-divider-v" />

        {/* Nội dung thanh Preset & Lựa chọn theo Sub-tab */}
        {activeSubTab === 'chroma' ? (
          <div className="cutter-studio-inline-bar">
            {/* Presets màu phổ biến */}
            <div className="cutter-color-preset-pills">
              <button
                type="button"
                className={`cutter-color-pill ${keyType === 'chroma_green' ? 'active green' : ''}`}
                onClick={() => handleSelectKeyPreset('chroma_green', '#00DB4E')}
                title="Tách phông xanh lá chuẩn Studio (#00DB4E)"
              >
                <span className="pill-dot" style={{ background: '#00DB4E' }} />
                <span>Xanh</span>
              </button>
              <button
                type="button"
                className={`cutter-color-pill ${keyType === 'chroma_blue' ? 'active blue' : ''}`}
                onClick={() => handleSelectKeyPreset('chroma_blue', '#005CE6')}
                title="Tách phông xanh dương chuẩn Studio (#005CE6)"
              >
                <span className="pill-dot" style={{ background: '#005CE6' }} />
                <span>Lam</span>
              </button>
              <button
                type="button"
                className={`cutter-color-pill ${keyType === 'pure_white' ? 'active white' : ''}`}
                onClick={() => handleSelectKeyPreset('pure_white', '#FFFFFF')}
                title="Tách phông nền trắng (#FFFFFF)"
              >
                <span className="pill-dot" style={{ background: '#ffffff', border: '1px solid #777' }} />
                <span>Trắng</span>
              </button>
              <button
                type="button"
                className={`cutter-color-pill ${keyType === 'pure_black' ? 'active black' : ''}`}
                onClick={() => handleSelectKeyPreset('pure_black', '#000000')}
                title="Tách phông nền đen (#000000)"
              >
                <span className="pill-dot" style={{ background: '#000000', border: '1px solid #555' }} />
                <span>Đen</span>
              </button>
            </div>

            {/* Kính lúp Hút Màu Photoshop */}
            <PhotoshopEyedropperButton
              id="btn-cutter-eyedropper"
              active={eyedropperTarget === 'key'}
              currentHex={chroma.keyColorHex}
              hoveredHex={eyedropperTarget === 'key' ? eyedropperSample?.hex : null}
              label="Hút màu"
              title="Bấm để bật Kính lúp Pixel hút màu nền trực tiếp trên ảnh (ESC để huỷ)"
              onToggle={() => onToggleEyedropper('key')}
            />

            {/* Chế độ Bảo vệ ruột (BFS Flood Fill từ ngoài vào) */}
            <div className="cutter-isolation-group" style={{ marginLeft: 'auto' }}>
              <button
                type="button"
                className={`cutter-iso-btn ${isolationMode === 'outer_only' ? 'active' : ''}`}
                onClick={() => onChangeChroma({ isolationMode: 'outer_only' })}
                title="Bảo vệ ruột (BFS): Giữ nguyên lòng trắng mắt, răng, hoạ tiết áo bên trong"
              >
                Giữ ruột (BFS)
              </button>
              <button
                type="button"
                className={`cutter-iso-btn ${isolationMode === 'all' ? 'active' : ''}`}
                onClick={() => onChangeChroma({ isolationMode: 'all' })}
                title="Toàn bộ ảnh: Xoá tất cả các vùng trùng màu nền kể cả khe hở kín bên trong"
              >
                Toàn bộ
              </button>
            </div>
          </div>
        ) : (
          <div className="cutter-studio-inline-bar">
            {/* Màu viền cần khử */}
            <span className="cutter-field-label">Màu viền:</span>
            <div className="cutter-mini-color-bar">
              <button
                type="button"
                className={`mini-color-dot ${fringeType === 'chroma_green' ? 'active' : ''}`}
                style={{ background: '#00DB4E' }}
                onClick={() =>
                  onChangeChroma({ fringeColorType: 'chroma_green', fringeColorHex: '#00DB4E' })
                }
                title="Khử viền ám xanh lá"
              />
              <button
                type="button"
                className={`mini-color-dot ${fringeType === 'chroma_blue' ? 'active' : ''}`}
                style={{ background: '#005CE6' }}
                onClick={() =>
                  onChangeChroma({ fringeColorType: 'chroma_blue', fringeColorHex: '#005CE6' })
                }
                title="Khử viền ám xanh dương"
              />
              <button
                type="button"
                className={`mini-color-dot ${fringeType === 'pure_white' ? 'active' : ''}`}
                style={{ background: '#ffffff', border: '1px solid #777' }}
                onClick={() =>
                  onChangeChroma({ fringeColorType: 'pure_white', fringeColorHex: '#FFFFFF' })
                }
                title="Khử viền răng cưa trắng"
              />
              <button
                type="button"
                className={`mini-color-dot ${fringeType === 'pure_black' ? 'active' : ''}`}
                style={{ background: '#000000', border: '1px solid #555' }}
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

            {/* Tông màu mịn viền */}
            <span className="cutter-field-label" style={{ marginLeft: 6 }}>
              Mịn viền:
            </span>
            <div className="cutter-isolation-group">
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
                  className={`cutter-iso-btn ${smoothColorType === sc.id ? 'active' : ''}`}
                  onClick={() => onChangeChroma({ smoothColorType: sc.id })}
                >
                  {sc.label}
                </button>
              ))}
            </div>

            {/* Chỉ giữ cụm lớn nhất */}
            <label
              className="layer-cutter-check-pill"
              style={{ marginLeft: 'auto', height: 23 }}
              title="Tự động lọc sạch toàn bộ các đốm rác trôi nổi bên ngoài, chỉ giữ lại nhân vật chính"
            >
              <input
                type="checkbox"
                checked={Boolean(chroma.keepLargestIslandOnly)}
                onChange={(e) => onChangeChroma({ keepLargestIslandOnly: e.target.checked })}
              />
              <span>Chỉ giữ cụm lớn nhất</span>
            </label>
          </div>
        )}
      </div>

      {/* Hàng 2: Lưới 4 Thanh Trượt Inline Siêu Gọn (Chỉ cao 26px, phẳng phiu, chuẩn Studio) */}
      {activeSubTab === 'chroma' ? (
        <div className="cutter-studio-sliders-grid">
          <div className="cutter-slider-inline" title="Độ nhạy xóa nền (Tolerance)">
            <span className="slider-label">Độ nhạy</span>
            <input
              type="range"
              min={0}
              max={100}
              value={chroma.tolerance}
              onChange={(e) => onChangeChroma({ tolerance: Number(e.target.value) })}
            />
            <span className="slider-val">{chroma.tolerance}%</span>
          </div>

          <div className="cutter-slider-inline" title="Làm mềm biên (Feather / Smoothness)">
            <span className="slider-label">Mềm biên</span>
            <input
              type="range"
              min={0}
              max={20}
              value={chroma.smoothness}
              onChange={(e) => onChangeChroma({ smoothness: Number(e.target.value) })}
            />
            <span className="slider-val">{chroma.smoothness}px</span>
          </div>

          <div className="cutter-slider-inline" title="Gọt lùi viền ám (Choke)">
            <span className="slider-label">Gọt viền</span>
            <input
              type="range"
              min={0}
              max={8}
              value={chroma.edgeChoke ?? 0}
              onChange={(e) => onChangeChroma({ edgeChoke: Number(e.target.value) })}
            />
            <span className="slider-val">{chroma.edgeChoke ?? 0}px</span>
          </div>

          <div className="cutter-slider-inline" title="Viền nét Anime (Stroke)">
            <span className="slider-label">Viền nét</span>
            <ColorInput
              compact
              showText={false}
              value={chroma.strokeColorHex || '#ffffff'}
              onChange={(hex) => onChangeChroma({ strokeColorHex: hex })}
            />
            <input
              type="range"
              min={0}
              max={10}
              value={chroma.strokeWidth ?? 0}
              onChange={(e) => onChangeChroma({ strokeWidth: Number(e.target.value) })}
            />
            <span className="slider-val">{chroma.strokeWidth ?? 0}px</span>
          </div>
        </div>
      ) : (
        <div className="cutter-studio-sliders-grid">
          <div className="cutter-slider-inline" title="Khử màu viền (Defringe)">
            <span className="slider-label">Khử màu viền</span>
            <input
              type="range"
              min={0}
              max={100}
              value={chroma.defringeStrength ?? 45}
              onChange={(e) => onChangeChroma({ defringeStrength: Number(e.target.value) })}
            />
            <span className="slider-val">{chroma.defringeStrength ?? 45}%</span>
          </div>

          <div className="cutter-slider-inline" title="Khử răng cưa viền (Edge Smooth)">
            <span className="slider-label">Lọc răng cưa</span>
            <input
              type="range"
              min={0}
              max={10}
              value={chroma.edgeSmooth ?? 2}
              onChange={(e) => onChangeChroma({ edgeSmooth: Number(e.target.value) })}
            />
            <span className="slider-val">{chroma.edgeSmooth ?? 2}px</span>
          </div>

          <div className="cutter-slider-inline" title="Xoá các đốm rác nhỏ (Despeckle)">
            <span className="slider-label">Xoá đốm rác</span>
            <input
              type="range"
              min={0}
              max={300}
              value={chroma.despeckleSize ?? 16}
              onChange={(e) => onChangeChroma({ despeckleSize: Number(e.target.value) })}
            />
            <span className="slider-val">{chroma.despeckleSize ?? 16}px</span>
          </div>

          <div className="cutter-slider-inline" title="Khử hạt bụi sáng bên trong">
            <span className="slider-label">Lọc bụi sáng</span>
            <input
              type="range"
              min={0}
              max={100}
              value={chroma.whiteSpeckleSensitivity ?? 0}
              onChange={(e) =>
                onChangeChroma({ whiteSpeckleSensitivity: Number(e.target.value) })
              }
            />
            <span className="slider-val">{chroma.whiteSpeckleSensitivity ?? 0}%</span>
          </div>
        </div>
      )}

      {/* Hàng 3: Tách Bóng Mờ / Mây Khói Bán Trong Suốt (Color Unmixing trên phông xanh & mọi màu nền) */}
      <div className="cutter-shadow-extraction-bar">
        <div className="cutter-shadow-mode-section">
          <span className="cutter-field-label">Bóng mờ:</span>
          <div className="cutter-shadow-mode-group" role="group" aria-label="Chế độ tách bóng mờ">
            <button
              id="btn-cutter-shadow-off"
              type="button"
              className={`cutter-shadow-mode-btn ${shadowMode === 'off' ? 'active' : ''}`}
              onClick={() => handleSelectShadowMode('off')}
              title="Xoá bóng mờ / mây mờ cùng với màu nền như thông thường"
            >
              Xoá bóng
            </button>
            <button
              id="btn-cutter-shadow-include"
              type="button"
              className={`cutter-shadow-mode-btn ${shadowMode === 'include' ? 'active include' : ''}`}
              onClick={() => handleSelectShadowMode('include')}
              title="Giữ lại cả vật thể đặc lẫn bóng mờ / mây khói bán trong suốt và tự động khử màu nền pha trộn"
            >
              ☁️ Lấy cả bóng
            </button>
            <button
              id="btn-cutter-shadow-only"
              type="button"
              className={`cutter-shadow-mode-btn ${shadowMode === 'only' ? 'active only' : ''}`}
              onClick={() => handleSelectShadowMode('only')}
              title="Chỉ tách riêng lớp bóng mờ / mây khói bán trong suốt (loại bỏ nhân vật/vật thể đặc) để làm layer độc lập"
            >
              👻 Chỉ lấy bóng
            </button>
          </div>

          <div className="cutter-studio-divider-v" />

          <span className="cutter-field-label">Loại:</span>
          <div className="cutter-isolation-group">
            {(
              [
                {
                  id: 'auto',
                  label: 'Tự động',
                  title: 'Tự động nhận diện cả bóng sáng (mây, sương, hào quang) lẫn bóng đổ tối'
                },
                {
                  id: 'light',
                  label: 'Mây/Sáng',
                  title: 'Chỉ lọc lấy mây mờ, khói sương, hào quang sáng pha trên nền'
                },
                {
                  id: 'dark',
                  label: 'Bóng tối',
                  title: 'Chỉ lọc lấy bóng đổ tối (drop shadow / ambient shadow) trên nền'
                }
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                id={`btn-cutter-shadow-type-${st.id}`}
                type="button"
                className={`cutter-iso-btn ${shadowMode !== 'off' && shadowType === st.id ? 'active' : ''}`}
                onClick={() => handleSelectShadowType(st.id)}
                title={st.title}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {shadowMode !== 'off' && (
          <div className="cutter-shadow-tuning-section">
            <div
              className="cutter-slider-inline cutter-shadow-slider"
              title="Độ đậm và độ nhạy giữ lại bóng mờ / mây khói (Shadow Retention)"
            >
              <span className="slider-label">Độ đậm</span>
              <input
                type="range"
                min={5}
                max={100}
                value={shadowRetention}
                onChange={(e) => onChangeChroma({ shadowRetention: Number(e.target.value) })}
              />
              <span className="slider-val">{shadowRetention}%</span>
            </div>

            <div
              className="cutter-slider-inline cutter-shadow-slider"
              title="Ngưỡng phân tách giữa vật thể đặc và bóng bán trong suốt (Solid Cutoff)"
            >
              <span className="slider-label">Độ đặc</span>
              <input
                type="range"
                min={30}
                max={90}
                value={shadowSolidThreshold}
                onChange={(e) => onChangeChroma({ shadowSolidThreshold: Number(e.target.value) })}
              />
              <span className="slider-val">{shadowSolidThreshold}%</span>
            </div>

            <label
              className="layer-cutter-check-pill cutter-shadow-unmix-pill"
              title="Tự động giải phương trình pha màu (Color Unmixing) để khử sạch màu xanh/màu nền khỏi đám mây hoặc bóng tối"
            >
              <input
                type="checkbox"
                checked={shadowUnmixColor}
                onChange={(e) => onChangeChroma({ shadowUnmixColor: e.target.checked })}
              />
              <span>Khử ám nền</span>
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

export { DEFAULT_CHROMA_SETTINGS }

