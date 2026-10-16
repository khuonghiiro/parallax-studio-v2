import React, { useState } from 'react'
import type {
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
  onToggleEyedropper
}: CutterChromaStudioPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'chroma' | 'cleanup'>('chroma')

  const keyType: ChromaKeyColorType = chroma.keyColorType || 'custom'
  const isolationMode = chroma.isolationMode || 'outer_only'
  const fringeType: ChromaKeyColorType = chroma.fringeColorType || 'pure_white'
  const smoothColorType = chroma.smoothColorType || 'none'

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
      {/* Hàng 1: Chuyển đổi 2 Sub-tabs + Chọn màu nền / Hút màu / Phạm vi tách ngay trên cùng 1 hàng gọn gàng */}
      <div className="cutter-studio-panel-header">
        <div className="cutter-studio-subtabs">
          <button
            id="btn-cutter-subtab-chroma"
            type="button"
            className={`cutter-studio-subtab ${activeSubTab === 'chroma' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('chroma')}
          >
            1. Tách màu &amp; Viền (Chroma Key)
          </button>
          <button
            id="btn-cutter-subtab-cleanup"
            type="button"
            className={`cutter-studio-subtab ${activeSubTab === 'cleanup' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('cleanup')}
          >
            2. Khử viền &amp; Lọc rác (Defringe)
          </button>
        </div>

        {activeSubTab === 'chroma' ? (
          <div className="cutter-studio-inline-bar">
            <div className="cutter-color-preset-pills">
              <button
                type="button"
                className={`cutter-color-pill ${keyType === 'chroma_green' ? 'active green' : ''}`}
                onClick={() => handleSelectKeyPreset('chroma_green', '#00DB4E')}
                title="Tách phông xanh lá chuẩn Studio"
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
                Trắng
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

            <PhotoshopEyedropperButton
              id="btn-cutter-eyedropper"
              active={eyedropperTarget === 'key'}
              currentHex={chroma.keyColorHex}
              hoveredHex={eyedropperTarget === 'key' ? eyedropperSample?.hex : null}
              label="Hút màu"
              title="Bấm để bật Kính lúp Hút màu nền kiểu Adobe Photoshop (hiển thị vòng đối chiếu màu Mới/Cũ, lưới pixel 9x9 và mã #HEX)"
              onToggle={() => onToggleEyedropper('key')}
            />

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

            <div className="cutter-isolation-group" style={{ marginLeft: 'auto' }}>
              <button
                type="button"
                className={`cutter-iso-btn ${isolationMode === 'outer_only' ? 'active' : ''}`}
                onClick={() => onChangeChroma({ isolationMode: 'outer_only' })}
                title="Bảo vệ ruột (BFS Flood-Fill từ 4 cạnh ngoài): Giữ nguyên lòng trắng mắt, răng, họa tiết áo bên trong nhân vật"
              >
                Bảo vệ ruột (BFS)
              </button>
              <button
                type="button"
                className={`cutter-iso-btn ${isolationMode === 'all' ? 'active' : ''}`}
                onClick={() => onChangeChroma({ isolationMode: 'all' })}
                title="Toàn bộ ảnh: Xóa tất cả các vùng trùng màu nền kể cả các khe hở kín bên trong"
              >
                Toàn bộ ảnh
              </button>
            </div>
          </div>
        ) : (
          <div className="cutter-studio-inline-bar">
            <span className="cutter-field-label">Màu viền:</span>
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

            <span className="cutter-field-label" style={{ marginLeft: 4 }}>
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

            <label
              className="layer-cutter-check-pill"
              style={{ marginLeft: 'auto', height: 24 }}
              title="Tự động loại bỏ toàn bộ các đốm/mảnh vụn trôi nổi bên ngoài, chỉ giữ lại cụm nhân vật/đạo cụ lớn nhất"
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

      {/* Hàng 2: Lưới 4 Thanh trượt thông số đồng bộ cho cả 2 Sub-tabs */}
      {activeSubTab === 'chroma' ? (
        <div className="cutter-studio-sliders-grid">
          <div className="cutter-slider-card">
            <div className="cutter-slider-head">
              <span>Độ nhạy xóa nền (Tolerance)</span>
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

          <div className="cutter-slider-card">
            <div className="cutter-slider-head">
              <span>Làm mềm biên (Feather)</span>
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

          <div className="cutter-slider-card">
            <div className="cutter-slider-head">
              <span>Gọt lùi viền ám (Choke)</span>
              <strong>{chroma.edgeChoke ?? 0}px</strong>
            </div>
            <input
              type="range"
              min={0}
              max={8}
              value={chroma.edgeChoke ?? 0}
              onChange={(e) => onChangeChroma({ edgeChoke: Number(e.target.value) })}
            />
          </div>

          <div className="cutter-slider-card">
            <div className="cutter-slider-head">
              <span>Viền nét Anime (Stroke)</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
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
      ) : (
        <div className="cutter-studio-sliders-grid">
          <div className="cutter-slider-card">
            <div className="cutter-slider-head">
              <span>Khử màu viền (Defringe)</span>
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

          <div className="cutter-slider-card">
            <div className="cutter-slider-head">
              <span>Khử răng cưa (Smooth)</span>
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

          <div className="cutter-slider-card">
            <div className="cutter-slider-head">
              <span>Xoá đốm rác nhỏ (Despeckle)</span>
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

          <div className="cutter-slider-card">
            <div className="cutter-slider-head">
              <span>Khử hạt bụi sáng</span>
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
      )}
    </div>
  )
}

export { DEFAULT_CHROMA_SETTINGS }
