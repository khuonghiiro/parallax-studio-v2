import type { BrushSettings, BrushFalloff, MeshEditorTool } from './meshEditorTypes'

interface BrushControlsProps {
  tool: MeshEditorTool
  settings: BrushSettings
  onChangeSettings: (patch: Partial<BrushSettings>) => void
  onResetBrush?: () => void
}

const FALLOFF_OPTIONS: Array<{ id: BrushFalloff; label: string; desc: string }> = [
  { id: 'smooth', label: 'Mượt (Smooth)', desc: 'Lực cọ giảm dần theo đường cong cosin mềm mại' },
  { id: 'linear', label: 'Tuyến tính (Linear)', desc: 'Lực cọ giảm đều theo khoảng cách hình nón' },
  { id: 'sharp', label: 'Sắc cạnh (Sharp)', desc: 'Tập trung mạnh ở tâm cọ, viền sắc' }
]

export function BrushControls({
  tool,
  settings,
  onChangeSettings,
  onResetBrush
}: BrushControlsProps) {
  const isSculpt = tool === 'grab' || tool === 'inflate' || tool === 'smooth' || tool === 'crease'
  if (!isSculpt) return null

  const toolName =
    tool === 'grab'
      ? 'Kéo mềm (Grab)'
      : tool === 'inflate'
        ? 'Lồi/Lõm (Inflate)'
        : tool === 'smooth'
          ? 'Làm mượt (Smooth)'
          : 'Gấp nếp (Crease)'

  return (
    <div className="mesh-editor-tool-controls brush-controls">
      <div className="tool-controls-header">
        <span className="tool-title">🖌️ {toolName}</span>
        {onResetBrush && (
          <button type="button" className="btn xs secondary" onClick={onResetBrush} title="Khôi phục thông số cọ">
            Đặt lại cọ
          </button>
        )}
      </div>

      {/* Bán kính cọ (Radius) */}
      <div className="rot-slider-row" style={{ marginTop: 8 }}>
        <span className="rot-label" title="Bán kính vùng ảnh hưởng của cọ (px)">
          Bán kính
        </span>
        <input
          type="range"
          min="10"
          max="200"
          step="5"
          value={settings.radius}
          onChange={(e) => onChangeSettings({ radius: Number(e.target.value) })}
        />
        <span className="deg-value">{settings.radius}px</span>
      </div>

      {/* Cường độ cọ (Strength) */}
      <div className="rot-slider-row" style={{ marginTop: 6 }}>
        <span className="rot-label" title="Cường độ biến dạng của cọ">
          Cường độ
        </span>
        <input
          type="range"
          min="5"
          max="100"
          step="5"
          value={settings.strength}
          onChange={(e) => onChangeSettings({ strength: Number(e.target.value) })}
        />
        <span className="deg-value">{settings.strength}%</span>
      </div>

      {/* Loại suy giảm lực cọ (Falloff) */}
      <div style={{ marginTop: 8 }}>
        <span className="field-sub-label">Kiểu suy giảm lực (Falloff):</span>
        <div className="region-pills-row" style={{ marginTop: 4 }}>
          {FALLOFF_OPTIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`region-pill-btn${settings.falloff === f.id ? ' active' : ''}`}
              onClick={() => onChangeSettings({ falloff: f.id })}
              title={f.desc}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tùy chọn bảo vệ gốc & Mặt trước */}
      <div className="quick-snaps" style={{ marginTop: 8 }}>
        <button
          type="button"
          className={`snap-btn${settings.pinRoot ? ' active' : ''}`}
          onClick={() => onChangeSettings({ pinRoot: !settings.pinRoot })}
          title="Khóa cứng các đỉnh ở dải gốc (cuống cánh/lá) không bị kéo biến dạng"
        >
          {settings.pinRoot ? '📌 Đang ghim gốc' : '📍 Ghim gốc'}
        </button>
        <button
          type="button"
          className={`snap-btn${settings.frontFacingOnly ? ' active' : ''}`}
          onClick={() => onChangeSettings({ frontFacingOnly: !settings.frontFacingOnly })}
          title="Chỉ tác động lên các đỉnh đang hướng về phía camera"
        >
          👁️ Chỉ mặt trước
        </button>
      </div>
    </div>
  )
}
