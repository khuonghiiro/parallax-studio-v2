import type { CurveSettings, CurvePreset } from './meshEditorTypes'

interface CurveControlsProps {
  settings: CurveSettings
  onChangeSettings: (patch: Partial<CurveSettings>) => void
  onApplyPreset: (preset: CurvePreset) => void
  onResetCurve?: () => void
}

const PRESET_OPTIONS: Array<{ id: CurvePreset; label: string; icon: string; desc: string }> = [
  { id: 'c-curve', label: 'Cong chữ C', icon: '🌙', desc: 'Uốn cong hình cung tròn đều đặn' },
  { id: 's-curve', label: 'Sóng chữ S', icon: '〰️', desc: 'Uốn lượn sóng 2 chiều tự nhiên' },
  { id: 'droop', label: 'Vòm rủ ngọn', icon: '🌾', desc: 'Đầu lá/cành uốn gập rủ xuống' },
  { id: 'recurved', label: 'Vểnh ngược', icon: '🎺', desc: 'Đầu cánh hoa loa kèn/rum vểnh xòe ra ngoài' }
]

export function CurveControls({
  settings,
  onChangeSettings,
  onApplyPreset,
  onResetCurve
}: CurveControlsProps) {
  return (
    <div className="mesh-editor-tool-controls curve-controls">
      <div className="tool-controls-header">
        <span className="tool-title">〰️ Uốn Dọc Trục Cong (Spline Curve)</span>
        {onResetCurve && (
          <button type="button" className="btn xs secondary" onClick={onResetCurve} title="Khôi phục đường thẳng">
            Đặt lại đường cong
          </button>
        )}
      </div>

      {/* Preset dáng cong */}
      <div style={{ marginTop: 8 }}>
        <span className="field-sub-label">Dáng cong mẫu (Curve Presets):</span>
        <div className="region-pills-row" style={{ marginTop: 4 }}>
          {PRESET_OPTIONS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`region-pill-btn${settings.preset === p.id ? ' active' : ''}`}
              onClick={() => onApplyPreset(p.id)}
              title={p.desc}
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Số điểm điều khiển (3, 4, 5) */}
      <div style={{ marginTop: 8 }}>
        <span className="field-sub-label">Số điểm kiểm soát:</span>
        <div className="quick-snaps" style={{ marginTop: 4 }}>
          {([3, 4, 5] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={`snap-btn${settings.numPoints === n ? ' active' : ''}`}
              onClick={() => onChangeSettings({ numPoints: n })}
            >
              {n} Điểm
            </button>
          ))}
        </div>
      </div>

      {/* Độ căng đường cong (Spline Tension) */}
      <div className="rot-slider-row" style={{ marginTop: 8 }}>
        <span className="rot-label" title="Độ căng của đường cong Catmull-Rom">
          Độ căng
        </span>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={Math.round(settings.tension * 100)}
          onChange={(e) => onChangeSettings({ tension: Number(e.target.value) / 100 })}
        />
        <span className="deg-value">{(settings.tension * 100).toFixed(0)}%</span>
      </div>

      <div className="trim-hint-text" style={{ marginTop: 8 }}>
        💡 Nhấp chuột trên khung nhìn 3D để kéo các điểm kiểm soát uốn cong cánh hoa hoặc lá.
      </div>
    </div>
  )
}
