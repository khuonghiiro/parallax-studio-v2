import React, { useState } from 'react'
import type {
  ChromaKeySettings,
  ChromaKeyColorType,
  ChromaShadowMode
} from '../layerAssembly/cutter/types'
import { ColorInput } from '../controls/ColorPicker'

export interface PhotoStudioChromaBarProps {
  chroma: ChromaKeySettings
  onChangeChroma: (patch: Partial<ChromaKeySettings>) => void
  onPickEyedropper: () => void
}

export function PhotoStudioChromaBar({
  chroma,
  onChangeChroma,
  onPickEyedropper
}: PhotoStudioChromaBarProps) {
  const [subTab, setSubTab] = useState<'basic' | 'advanced'>('basic')

  const keyType: ChromaKeyColorType = chroma.keyColorType || 'custom'
  const isolationMode = chroma.isolationMode || 'outer_only'
  const shadowMode: ChromaShadowMode =
    chroma.shadowMode && chroma.shadowMode !== 'off'
      ? chroma.shadowMode
      : chroma.keepShadows
        ? 'include'
        : 'off'

  const handleSelectColorPreset = (type: ChromaKeyColorType, hex: string) => {
    onChangeChroma({
      enabled: true,
      keyColorType: type,
      keyColorHex: hex,
      keyColor: hex,
      fringeColorType: type,
      fringeColorHex: hex
    })
  }

  const handleSelectShadowMode = (mode: ChromaShadowMode) => {
    onChangeChroma({
      enabled: true,
      shadowMode: mode,
      keepShadows: mode !== 'off'
    })
  }

  return (
    <div className="ps-chroma-strip" data-mcp-region="photo_editor_chroma">
      {/* Hàng 1: Switch Bật/Tắt + Preset màu + Giữ ruột BFS + Tab chuyển đổi */}
      <div className="ps-chroma-row-1">
        {/* Toggle On/Off */}
        <label className="ps-toggle-label" title="Bật/Tắt thuật toán tách phông Chroma">
          <input
            type="checkbox"
            checked={chroma.enabled}
            onChange={(e) => onChangeChroma({ enabled: e.target.checked })}
          />
          <span className="ps-toggle-text">Tách nền</span>
        </label>

        {/* View mode */}
        <div className="ps-segmented-pill" role="radiogroup">
          <button
            type="button"
            className={`ps-seg-item ${chroma.previewMode !== 'original' ? 'active' : ''}`}
            onClick={() => onChangeChroma({ previewMode: 'transparent' })}
          >
            Đã tách
          </button>
          <button
            type="button"
            className={`ps-seg-item ${chroma.previewMode === 'original' ? 'active' : ''}`}
            onClick={() => onChangeChroma({ previewMode: 'original' })}
          >
            Ảnh gốc
          </button>
        </div>

        {/* Sub-tab chuyển đổi */}
        <div className="ps-subtab-group">
          <button
            type="button"
            className={`ps-subtab-btn ${subTab === 'basic' ? 'active' : ''}`}
            onClick={() => setSubTab('basic')}
          >
            Tách màu
          </button>
          <button
            type="button"
            className={`ps-subtab-btn ${subTab === 'advanced' ? 'active' : ''}`}
            onClick={() => setSubTab('advanced')}
          >
            Khử viền & Đốm
          </button>
        </div>

        {/* Mẫu màu chuẩn */}
        <div className="ps-color-presets">
          <button
            type="button"
            className={`ps-color-chip green ${keyType === 'chroma_green' ? 'active' : ''}`}
            onClick={() => handleSelectColorPreset('chroma_green', '#00DB4E')}
            title="Phông Xanh lá tiêu chuẩn (#00DB4E)"
          >
            <span className="chip-dot" style={{ background: '#00DB4E' }} />
            <span>Xanh</span>
          </button>
          <button
            type="button"
            className={`ps-color-chip blue ${keyType === 'chroma_blue' ? 'active' : ''}`}
            onClick={() => handleSelectColorPreset('chroma_blue', '#0055FF')}
            title="Phông Xanh lam (#0055FF)"
          >
            <span className="chip-dot" style={{ background: '#0055FF' }} />
            <span>Lam</span>
          </button>
          <button
            type="button"
            className={`ps-color-chip white ${keyType === 'pure_white' ? 'active' : ''}`}
            onClick={() => handleSelectColorPreset('pure_white', '#FFFFFF')}
            title="Phông Trắng (#FFFFFF)"
          >
            <span className="chip-dot" style={{ background: '#FFFFFF' }} />
            <span>Trắng</span>
          </button>
          <button
            type="button"
            className={`ps-color-chip black ${keyType === 'pure_black' ? 'active' : ''}`}
            onClick={() => handleSelectColorPreset('pure_black', '#000000')}
            title="Phông Đen (#000000)"
          >
            <span className="chip-dot" style={{ background: '#000000' }} />
            <span>Đen</span>
          </button>

          {/* Hút màu & ColorInput */}
          <div className="ps-custom-color-wrap">
            <button
              type="button"
              className={`ps-eyedropper-btn ${keyType === 'custom' ? 'active' : ''}`}
              onClick={onPickEyedropper}
              title="Bật kính lúp hút màu trực tiếp từ ảnh"
            >
              💉 Hút màu
            </button>
            <ColorInput
              compact
              showText={false}
              value={chroma.keyColorHex || '#00DB4E'}
              onChange={(hex: string) => handleSelectColorPreset('custom', hex)}
            />
            <span className="ps-hex-text">{chroma.keyColorHex || '#00DB4E'}</span>
          </div>
        </div>

        {/* Giữ ruột BFS vs Toàn bộ */}
        <div className="ps-segmented-pill" role="radiogroup">
          <button
            type="button"
            className={`ps-seg-item ${isolationMode === 'outer_only' ? 'active' : ''}`}
            onClick={() => onChangeChroma({ isolationMode: 'outer_only' })}
            title="Chỉ tách nền ngoài biên, bảo vệ vùng mắt, áo trắng hoặc chi tiết cùng màu bên trong"
          >
            Giữ ruột (BFS)
          </button>
          <button
            type="button"
            className={`ps-seg-item ${isolationMode === 'all' ? 'active' : ''}`}
            onClick={() => onChangeChroma({ isolationMode: 'all' })}
            title="Tách toàn bộ pixel trùng màu trên khắp bức ảnh"
          >
            Toàn bộ
          </button>
        </div>
      </div>

      {/* Hàng 2: Thanh trượt thông số */}
      {subTab === 'basic' ? (
        <div className="ps-chroma-sliders">
          <div className="ps-slider-cell" title="Dung sai nhận diện màu nền">
            <span className="cell-label">Độ nhạy</span>
            <input
              type="range"
              min={0}
              max={100}
              value={chroma.tolerance}
              onChange={(e) => onChangeChroma({ tolerance: Number(e.target.value) })}
            />
            <span className="cell-val">{chroma.tolerance}%</span>
          </div>

          <div className="ps-slider-cell" title="Làm mềm mờ biên ngoài (Feather không răng cưa)">
            <span className="cell-label">Mềm biên</span>
            <input
              type="range"
              min={0}
              max={20}
              value={chroma.smoothness}
              onChange={(e) => onChangeChroma({ smoothness: Number(e.target.value) })}
            />
            <span className="cell-val">{chroma.smoothness}px</span>
          </div>

          <div className="ps-slider-cell" title="Gọt bớt lớp viền lem ám màu">
            <span className="cell-label">Gọt viền</span>
            <input
              type="range"
              min={0}
              max={8}
              value={chroma.edgeChoke ?? 0}
              onChange={(e) => onChangeChroma({ edgeChoke: Number(e.target.value) })}
            />
            <span className="cell-val">{chroma.edgeChoke ?? 0}px</span>
          </div>

          <div className="ps-slider-cell stroke-cell" title="Vẽ viền nét mịn ngoài nhân vật">
            <span className="cell-label">Viền nét</span>
            <ColorInput
              compact
              showText={false}
              value={chroma.strokeColorHex || '#ffffff'}
              onChange={(hex: string) => onChangeChroma({ strokeColorHex: hex })}
            />
            <input
              type="range"
              min={0}
              max={10}
              value={chroma.strokeWidth ?? 0}
              onChange={(e) => onChangeChroma({ strokeWidth: Number(e.target.value) })}
            />
            <span className="cell-val">{chroma.strokeWidth ?? 0}px</span>
          </div>

          {/* Bóng mờ */}
          <div className="ps-shadow-modes">
            <span className="cell-label">Bóng mờ:</span>
            <button
              type="button"
              className={`ps-seg-item ${shadowMode === 'off' ? 'active' : ''}`}
              onClick={() => handleSelectShadowMode('off')}
            >
              Xoá bóng
            </button>
            <button
              type="button"
              className={`ps-seg-item ${shadowMode === 'include' ? 'active' : ''}`}
              onClick={() => handleSelectShadowMode('include')}
              title="Giữ lại bóng mờ, mây khói bán trong suốt và khử ám màu nền"
            >
              ☁ Lấy cả bóng
            </button>
            <button
              type="button"
              className={`ps-seg-item ${shadowMode === 'only' ? 'active' : ''}`}
              onClick={() => handleSelectShadowMode('only')}
              title="Chỉ lấy riêng bóng mờ, bỏ vật thể đặc"
            >
              👻 Chỉ lấy bóng
            </button>
          </div>

          <label className="ps-checkbox-label" title="Khử triệt để màu nền phản chiếu vào bóng mờ">
            <input
              type="checkbox"
              checked={chroma.shadowUnmixColor !== false}
              onChange={(e) => onChangeChroma({ shadowUnmixColor: e.target.checked })}
            />
            <span>Khử ám nền</span>
          </label>
        </div>
      ) : (
        <div className="ps-chroma-sliders">
          <div className="ps-slider-cell" title="Khử tràn màu nền vào viền (Defringe & Despill)">
            <span className="cell-label">Khử màu viền</span>
            <input
              type="range"
              min={0}
              max={100}
              value={chroma.defringeStrength ?? 45}
              onChange={(e) => onChangeChroma({ defringeStrength: Number(e.target.value) })}
            />
            <span className="cell-val">{chroma.defringeStrength ?? 45}%</span>
          </div>

          <div className="ps-slider-cell" title="Khử răng cưa viền (Edge Smooth)">
            <span className="cell-label">Lọc răng cưa</span>
            <input
              type="range"
              min={0}
              max={10}
              value={chroma.edgeSmooth ?? 2}
              onChange={(e) => onChangeChroma({ edgeSmooth: Number(e.target.value) })}
            />
            <span className="cell-val">{chroma.edgeSmooth ?? 2}px</span>
          </div>

          <div className="ps-slider-cell" title="Xoá đốm rác li ti bị sót ngoài nền">
            <span className="cell-label">Xoá đốm rác</span>
            <input
              type="range"
              min={0}
              max={300}
              value={chroma.despeckleSize ?? 16}
              onChange={(e) => onChangeChroma({ despeckleSize: Number(e.target.value) })}
            />
            <span className="cell-val">{chroma.despeckleSize ?? 16}px</span>
          </div>

          <label className="ps-checkbox-label" title="Tự động dọn quầng mờ sáng quanh mép ảnh">
            <input
              type="checkbox"
              checked={chroma.removeSoftHalo !== false}
              onChange={(e) => onChangeChroma({ removeSoftHalo: e.target.checked })}
            />
            <span>Xoá quầng mờ</span>
          </label>
        </div>
      )}
    </div>
  )
}
