import type { AssemblyLighting, SunPreset } from './types'
import { applySunPreset, normalizeLighting, SUN_PRESETS } from './assemblyLighting'
import { IconSun } from '../../icons'

interface AssemblyLightingSectionProps {
  lighting?: AssemblyLighting
  onChange: (updated: AssemblyLighting) => void
}

export function AssemblyLightingSection({ lighting: rawLighting, onChange }: AssemblyLightingSectionProps) {
  const lighting = normalizeLighting(rawLighting)

  const update = (patch: Partial<AssemblyLighting>) => {
    onChange({ ...lighting, ...patch })
  }

  const handleSelectPreset = (p: SunPreset) => {
    onChange(applySunPreset(lighting, p))
  }

  return (
    <details className="inspector-section fi-collapsible" open>
      <summary className="section-title">
        <span className="section-title-with-icon">
          <IconSun width={13} height={13} />
          <span>Ánh sáng & Bóng đổ</span>
        </span>
        <span className="fi-badge">{lighting.sun ? (lighting.shadows ? 'Nắng & Bóng' : 'Nắng') : 'Studio'}</span>
      </summary>

      <div className="adv-lighting-content">
        {/* Sun & Shadow toggles */}
        <div className="adv-toggle-row">
          <label className="adv-switch" title="Bật nắng mặt trời có hướng (tắt = ánh sáng studio đều, không bóng loá)">
            <input
              type="checkbox"
              checked={lighting.sun}
              onChange={(e) => update({ sun: e.target.checked })}
            />
            <span className="adv-slider" />
            <span className="adv-switch-label">Mặt trời có hướng</span>
          </label>

          <label className="adv-switch" title="Đổ bóng râm xuống mặt sàn và lên các bề mặt khác">
            <input
              type="checkbox"
              checked={lighting.shadows}
              disabled={!lighting.sun}
              onChange={(e) => update({ shadows: e.target.checked })}
            />
            <span className="adv-slider" />
            <span className="adv-switch-label">Đổ bóng râm</span>
          </label>
        </div>

        {/* Preset buttons */}
        <div className="adv-label">Thời điểm & Tông màu</div>
        <div className="adv-presets-grid" role="group" aria-label="Tông màu nắng">
          {SUN_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`adv-preset-btn${lighting.preset === p.id ? ' active' : ''}`}
              title={p.title}
              onClick={() => handleSelectPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Controls: Azimuth & Elevation */}
        {lighting.sun && (
          <div className="adv-sliders-group">
            <div className="inspector-row">
              <label htmlFor="sun-azimuth" title="Góc phương vị mặt trời: -180° đến 180°">Hướng nắng</label>
              <div className="range-with-value">
                <input
                  id="sun-azimuth"
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  value={lighting.azimuth}
                  onChange={(e) => update({ azimuth: Number(e.target.value), preset: 'auto' })}
                />
                <span className="scale-badge">{lighting.azimuth}°</span>
              </div>
            </div>

            <div className="inspector-row">
              <label htmlFor="sun-elevation" title="Độ cao mặt trời: 5° (hoàng hôn) đến 85° (đỉnh đầu)">Độ cao nắng</label>
              <div className="range-with-value">
                <input
                  id="sun-elevation"
                  type="range"
                  min="5"
                  max="85"
                  step="2"
                  value={lighting.elevation}
                  onChange={(e) => update({ elevation: Number(e.target.value), preset: 'auto' })}
                />
                <span className="scale-badge">{lighting.elevation}°</span>
              </div>
            </div>

            <div className="inspector-row">
              <label htmlFor="sun-intensity" title="Cường độ ánh sáng mặt trời">Cường độ nắng</label>
              <div className="range-with-value">
                <input
                  id="sun-intensity"
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.05"
                  value={lighting.intensity}
                  onChange={(e) => update({ intensity: Number(e.target.value) })}
                />
                <span className="scale-badge">{Math.round(lighting.intensity * 100)}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </details>
  )
}
