import React from 'react'
import type { AssemblyLighting, SunPreset } from '../assets/models3d/types'
import {
  applySunPreset,
  normalizeLighting,
  SUN_PRESETS,
  resolveSkyAtmosphere,
  DEFAULT_LIGHTING
} from '../assets/models3d/assemblyLighting'
import { IconSun, IconMoon, IconX } from '../icons'

export interface LightingControlPopoverProps {
  lighting: AssemblyLighting
  onChangeLighting: (lighting: AssemblyLighting) => void
  onClose: () => void
  style?: React.CSSProperties
}

export function LightingControlPopover({
  lighting: rawLighting,
  onChangeLighting,
  onClose,
  style
}: LightingControlPopoverProps) {
  const lighting = normalizeLighting(rawLighting)
  const isNight = lighting.preset === 'night'
  const atmosphere = resolveSkyAtmosphere(lighting, true)

  const update = (patch: Partial<AssemblyLighting>) => {
    onChangeLighting({ ...lighting, ...patch })
  }

  const handleSelectPreset = (p: SunPreset) => {
    onChangeLighting(applySunPreset(lighting, p))
  }

  return (
    <div
      className="layer-workshop-popover-menu"
      style={{
        position: 'fixed',
        width: '285px',
        maxHeight: 'calc(100vh - 160px)',
        overflowY: 'auto',
        padding: '12px 14px',
        gap: '10px',
        zIndex: 30000,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
        ...style
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--line-soft)',
          paddingBottom: '6px'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: 'var(--text)',
            fontWeight: 700,
            letterSpacing: '0.4px'
          }}
        >
          {isNight ? <IconMoon width={13} height={13} /> : <IconSun width={13} height={13} />}
          <span>HƯỚNG SÁNG & ĐỔ BÓNG 3D</span>
        </div>
        <button
          type="button"
          className="btn xs icon"
          onClick={onClose}
          aria-label="Đóng bảng hướng sáng"
          style={{ width: '18px', height: '18px', padding: 0 }}
        >
          <IconX width={12} height={12} />
        </button>
      </div>

      {/* 1. Công tắc Mặt trời & Đổ bóng */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '8px',
          background: 'var(--bg-2)',
          padding: '6px 8px',
          borderRadius: '4px',
          border: '1px solid var(--line-soft)'
        }}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '10.5px',
            color: 'var(--text)',
            cursor: 'pointer'
          }}
          title="Bật nguồn sáng mặt trời/mặt trăng có hướng"
        >
          <input
            type="checkbox"
            checked={lighting.sun}
            onChange={(e) => update({ sun: e.target.checked })}
            style={{ cursor: 'pointer' }}
          />
          <span>Mặt trời có hướng</span>
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '10.5px',
            color: lighting.sun ? 'var(--text)' : 'var(--text-faint)',
            cursor: lighting.sun ? 'pointer' : 'default'
          }}
          title="Đổ bóng râm giữa các layer và xuống sàn"
        >
          <input
            type="checkbox"
            checked={lighting.shadows}
            disabled={!lighting.sun}
            onChange={(e) => update({ shadows: e.target.checked })}
            style={{ cursor: lighting.sun ? 'pointer' : 'default' }}
          />
          <span>Đổ bóng râm</span>
        </label>
      </div>

      {/* 2. Presets Thời điểm ngày và đêm */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-faint)', fontWeight: 600 }}>
            THỜI ĐIỂM & TÔNG MÀU:
          </span>
          <span style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
            {atmosphere.icon} {atmosphere.label}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
          {SUN_PRESETS.map((p) => {
            const active = lighting.preset === p.id
            return (
              <button
                key={p.id}
                type="button"
                className={`btn xs${active ? ' primary' : ''}`}
                style={{
                  padding: '3px 4px',
                  fontSize: '10px',
                  fontWeight: active ? 600 : 400
                }}
                title={p.title}
                onClick={() => handleSelectPreset(p.id)}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Thanh trượt Hướng nắng, Độ cao, Cường độ (Khi bật mặt trời) */}
      {lighting.sun ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Hướng nắng (Azimuth) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
              <span style={{ color: 'var(--text-dim)' }}>Hướng nắng (Góc ngang):</span>
              <strong style={{ color: 'var(--text)' }}>{lighting.azimuth}°</strong>
            </div>
            <input
              type="range"
              min="-180"
              max="180"
              step="5"
              value={lighting.azimuth}
              onChange={(e) => update({ azimuth: Number(e.target.value), preset: 'auto' })}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-faint)' }}>
              <span>-180° Trái</span>
              <span>0° Thẳng</span>
              <span>+180° Phải</span>
            </div>
          </div>

          {/* Độ cao mặt trời (Elevation) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
              <span style={{ color: 'var(--text-dim)' }}>Độ cao mặt trời (Góc đứng):</span>
              <strong style={{ color: 'var(--accent)' }}>{lighting.elevation}°</strong>
            </div>
            <input
              type="range"
              min="5"
              max="85"
              step="2"
              value={lighting.elevation}
              onChange={(e) => update({ elevation: Number(e.target.value), preset: 'auto' })}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-faint)' }}>
              <span>5° Sát đất (Bóng dài)</span>
              <span>45° Xiên</span>
              <span>85° Đỉnh đầu</span>
            </div>
          </div>

          {/* Cường độ ánh sáng (Intensity) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
              <span style={{ color: 'var(--text-dim)' }}>Cường độ chiếu sáng:</span>
              <strong style={{ color: 'var(--text)' }}>{Math.round(lighting.intensity * 100)}%</strong>
            </div>
            <input
              type="range"
              min="0.2"
              max="2.0"
              step="0.05"
              value={lighting.intensity}
              onChange={(e) => update({ intensity: Number(e.target.value) })}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>
        </div>
      ) : (
        <div
          style={{
            fontSize: '10px',
            color: 'var(--text-dim)',
            padding: '8px',
            background: 'var(--bg-2)',
            borderRadius: '4px',
            lineHeight: 1.4
          }}
        >
          💡 <strong>Chế độ Studio trung tính:</strong> Ánh sáng tản đều khắp mọi phía, màu sắc ảnh giữ nguyên bản, không đổ bóng loá.
        </div>
      )}

      {/* 4. Tác vụ nhanh */}
      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
        <button
          type="button"
          className="btn xs"
          style={{ flex: 1, padding: '3px 4px', fontSize: '10px' }}
          onClick={() => handleSelectPreset('noon')}
          title="Chuyển nhanh sang ban ngày nắng sáng"
        >
          ☀️ Ban ngày
        </button>
        <button
          type="button"
          className="btn xs"
          style={{ flex: 1, padding: '3px 4px', fontSize: '10px' }}
          onClick={() => handleSelectPreset('night')}
          title="Chuyển nhanh sang ban đêm ánh trăng huyền ảo"
        >
          🌙 Ban đêm
        </button>
        <button
          type="button"
          className="btn xs"
          style={{ flex: 1, padding: '3px 4px', fontSize: '10px' }}
          onClick={() => update({ azimuth: lighting.azimuth >= 0 ? lighting.azimuth - 180 : lighting.azimuth + 180, preset: 'auto' })}
          title="Xoay ngược hướng chiếu sáng 180°"
        >
          🔄 Đảo hướng
        </button>
        <button
          type="button"
          className="btn xs"
          style={{ flex: 1, padding: '3px 4px', fontSize: '10px' }}
          onClick={() => onChangeLighting(DEFAULT_LIGHTING)}
          title="Đặt lại thiết lập ánh sáng mặc định"
        >
          Mặc định
        </button>
      </div>
    </div>
  )
}
