import React, { useState } from 'react'
import type { GlowAnimation, GlowSide, Layer, LayerGlow } from '@shared/types'
import { useEditor } from '../../../store/editor'
import { ColorInput, NumberInput, Row, Select, Switch } from '../../controls'
import type { Setter } from '../types'
import { getAllGlowConfigs } from '../../../engine/layerGlow'

const NEON_PRESETS = [
  { name: 'Cyan Neon', color: '#3dd6f5' },
  { name: 'Vàng Kim', color: '#f59e0b' },
  { name: 'Hồng Neon', color: '#f43f5e' },
  { name: 'Xanh Ngọc', color: '#10b981' },
  { name: 'Tím Điện', color: '#a855f7' },
  { name: 'Đỏ Rực', color: '#ef4444' },
  { name: 'Trắng Băng', color: '#ffffff' }
]

export function GlowSection({ layer, set }: { layer: Layer; set: Setter }) {
  const currentTime = useEditor((s) => s.time)
  const glowConfigs = getAllGlowConfigs(layer)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const activeCandidate =
    glowConfigs.find((c) => c.id === selectedId) ??
    glowConfigs.find((c) => {
      const s = c.glow.startTime ?? 0
      const d = c.glow.duration ?? 0
      return currentTime >= s && (d === 0 || currentTime <= s + d)
    }) ??
    glowConfigs[glowConfigs.length - 1]

  const activeId = activeCandidate?.id ?? 'standalone'
  const glow: LayerGlow = activeCandidate?.glow ?? layer.glow ?? {
    enabled: false,
    startTime: 0,
    duration: 0,
    side: 'outer',
    color: '#3dd6f5',
    thickness: 8,
    intensity: 1.2,
    animated: 'none',
    speed: 2.0,
    minIntensity: 0.15
  }

  const setGlow = (patch: Partial<LayerGlow>, mergeKey = 'glow'): void => {
    set((l) => {
      if (activeId !== 'standalone' && l.appliedEffects) {
        const fx = l.appliedEffects.find((x) => x.id === activeId)
        if (fx && fx.glow) {
          fx.glow = { ...fx.glow, ...patch }
          if (patch.startTime !== undefined) fx.startTime = patch.startTime
          if (patch.duration !== undefined) fx.duration = patch.duration
          if (patch.enabled !== undefined) fx.enabled = patch.enabled
        }
      }
      l.glow = { ...(l.glow ?? glow), ...patch }
    }, mergeKey)
  }

  const toggleEnabled = (checked: boolean): void => {
    setGlow({ enabled: checked })
  }

  return (
    <div className="section">
      <div
        className="section-title"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
      >
        <span>
          Phát sáng viền {glowConfigs.length > 1 ? `(${glowConfigs.length})` : '(Neon)'}
        </span>
        <Switch
          id="glow-enabled"
          on={!!glow.enabled}
          onChange={toggleEnabled}
        />
      </div>

      {glowConfigs.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {glowConfigs.map((cfg) => {
            const isSel = cfg.id === activeId
            const color = cfg.glow.color || '#3dd6f5'
            const isOff = !cfg.glow.enabled
            return (
              <button
                key={cfg.id}
                type="button"
                className={`btn sm ${isSel ? 'primary' : 'ghost'}`}
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  borderColor: isSel ? color : undefined,
                  background: isSel ? color : undefined,
                  color: isSel ? '#000' : isOff ? 'var(--text-faint)' : undefined,
                  opacity: isOff ? 0.6 : 1
                }}
                onClick={() => setSelectedId(cfg.id)}
                title={`Chỉnh hiệu ứng: ${cfg.name || 'Neon'} (${(cfg.glow.startTime ?? 0).toFixed(1)}s)`}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: isOff ? 'var(--text-faint)' : color,
                    flexShrink: 0
                  }}
                />
                <span style={{ textDecoration: isOff ? 'line-through' : 'none' }}>
                  {cfg.name || 'Neon'}
                </span>
                <span style={{ fontSize: 9.5, opacity: 0.85 }}>
                  ({(cfg.glow.startTime ?? 0).toFixed(1)}s - {cfg.glow.duration ? `${cfg.glow.duration.toFixed(1)}s` : 'Hết'})
                </span>
              </button>
            )
          })}
        </div>
      )}

      {glow.enabled && (
        <>
          <Row label="Bắt đầu tại" title="Mốc thời gian (giây) bắt đầu chạy hiệu ứng phát sáng">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
              <NumberInput
                id="glow-start-time"
                value={glow.startTime ?? 0}
                min={0}
                step={0.1}
                precision={2}
                suffix="s"
                onChange={(v, key) => setGlow({ startTime: Math.max(0, v) }, key)}
              />
              <button
                type="button"
                className="btn sm ghost"
                style={{ fontSize: 10, padding: '2px 6px', whiteSpace: 'nowrap' }}
                onClick={() => setGlow({ startTime: Math.max(0, Math.round(currentTime * 100) / 100) })}
                title={`Đặt tại vị trí Playhead hiện tại (${currentTime.toFixed(2)}s)`}
              >
                Lấy Playhead ({currentTime.toFixed(1)}s)
              </button>
            </div>
          </Row>

          <Row label="Thời lượng" title="Thời gian duy trì hiệu ứng (0s = phát sáng liên tục cho đến hết layer)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
              <NumberInput
                id="glow-duration"
                value={glow.duration ?? 0}
                min={0}
                max={30}
                step={0.1}
                precision={1}
                suffix="s"
                onChange={(v, key) => setGlow({ duration: Math.max(0, v) }, key)}
              />
              <div style={{ display: 'flex', gap: 3 }}>
                {[
                  { label: '1s', val: 1.0 },
                  { label: '2s', val: 2.0 },
                  { label: 'Suốt layer', val: 0 }
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={`btn sm ${(glow.duration ?? 0) === item.val ? 'primary' : 'ghost'}`}
                    style={{ fontSize: 10, padding: '2px 5px', whiteSpace: 'nowrap' }}
                    onClick={() => setGlow({ duration: item.val })}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </Row>

          <Row label="Vị trí viền" title="Viền phát sáng bám theo đường nét alpha của hình (trong, ngoài hoặc cả hai)">
            <div style={{ display: 'flex', gap: 4, width: '100%' }}>
              <button
                type="button"
                className={`btn sm ${glow.side === 'outer' || !glow.side ? 'primary' : 'ghost'}`}
                style={{ flex: 1, padding: '2px 0', fontSize: '11px' }}
                onClick={() => setGlow({ side: 'outer' })}
                title="Chỉ phát sáng viền bên ngoài đường nét"
              >
                Viền ngoài
              </button>
              <button
                type="button"
                className={`btn sm ${glow.side === 'inner' ? 'primary' : 'ghost'}`}
                style={{ flex: 1, padding: '2px 0', fontSize: '11px' }}
                onClick={() => setGlow({ side: 'inner' })}
                title="Chỉ phát sáng viền bên trong mép hình"
              >
                Viền trong
              </button>
              <button
                type="button"
                className={`btn sm ${glow.side === 'both' ? 'primary' : 'ghost'}`}
                style={{ flex: 1, padding: '2px 0', fontSize: '11px' }}
                onClick={() => setGlow({ side: 'both' })}
                title="Phát sáng cả trong lẫn ngoài mép nét vẽ"
              >
                Cả trong &amp; ngoài
              </button>
            </div>
          </Row>

          <Row label="Màu Neon" title="Chọn màu ánh sáng phát quang">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ColorInput
                  value={glow.color ?? '#3dd6f5'}
                  onChange={(val, key) => setGlow({ color: val }, key)}
                  title="Chọn màu Neon"
                />
              </div>

              {/* Palette nhanh */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {NEON_PRESETS.map((p) => {
                  const isSelected = (glow.color ?? '#3dd6f5').toLowerCase() === p.color.toLowerCase()
                  return (
                    <button
                      key={p.color}
                      type="button"
                      onClick={() => setGlow({ color: p.color })}
                      title={`${p.name} (${p.color})`}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        backgroundColor: p.color,
                        border: isSelected ? '2px solid var(--text)' : '1px solid var(--line-soft)',
                        boxShadow: isSelected ? `0 0 8px ${p.color}` : 'none',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        transform: isSelected ? 'scale(1.2)' : 'scale(1)'
                      }}
                    />
                  )
                })}
              </div>
            </div>
          </Row>

          <Row label="Độ dày viền" title="Bán kính viền sáng bám theo nét vẽ (1 - 40px)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <input
                type="range"
                min={1}
                max={40}
                step={1}
                value={glow.thickness ?? 8}
                onChange={(e) => setGlow({ thickness: Number(e.target.value) }, 'glow-thickness')}
                style={{ flex: 1 }}
              />
              <NumberInput
                id="glow-thickness"
                value={glow.thickness ?? 8}
                min={1}
                max={40}
                step={1}
                precision={0}
                suffix="px"
                onChange={(v, key) => setGlow({ thickness: v }, key)}
              />
            </div>
          </Row>

          <Row label="Độ rực Neon" title="Độ đậm sáng phát quang (0.1 - 3.0)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <input
                type="range"
                min={0.1}
                max={3.0}
                step={0.1}
                value={glow.intensity ?? 1.2}
                onChange={(e) => setGlow({ intensity: Number(e.target.value) }, 'glow-intensity')}
                style={{ flex: 1 }}
              />
              <NumberInput
                id="glow-intensity"
                value={glow.intensity ?? 1.2}
                min={0.1}
                max={3.0}
                step={0.1}
                precision={1}
                onChange={(v, key) => setGlow({ intensity: v }, key)}
              />
            </div>
          </Row>

          <Row label="Hiệu ứng động" title="Chế độ nhấp nháy, thở hoặc chập chờn bóng neon">
            <Select
              id="glow-animation"
              value={glow.animated ?? 'none'}
              options={[
                { value: 'none', label: 'Sáng tĩnh (Không nhấp nháy)' },
                { value: 'breathe', label: 'Nhịp thở (Mờ dần rồi tỏ sáng dần)' },
                { value: 'blink', label: 'Nhấp nháy chớp tắt (Đèn hiệu)' },
                { value: 'flicker', label: 'Chập chờn đèn Neon (Thực tế)' }
              ]}
              onChange={(v) => setGlow({ animated: v as GlowAnimation })}
            />
          </Row>

          {glow.animated && glow.animated !== 'none' && (
            <>
              <Row label="Tần suất (Tốc độ)" title="Số chu kỳ nhấp nháy / nhịp thở mỗi giây">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <input
                    type="range"
                    min={0.2}
                    max={8.0}
                    step={0.2}
                    value={glow.speed ?? 2.0}
                    onChange={(e) => setGlow({ speed: Number(e.target.value) }, 'glow-speed')}
                    style={{ flex: 1 }}
                  />
                  <NumberInput
                    id="glow-speed"
                    value={glow.speed ?? 2.0}
                    min={0.2}
                    max={10.0}
                    step={0.2}
                    precision={1}
                    suffix=" Hz"
                    onChange={(v, key) => setGlow({ speed: v }, key)}
                  />
                </div>
              </Row>

              <Row label="Độ sáng tối thiểu" title="Độ mờ khi ở đáy chu kỳ nhấp nháy hoặc thở (0% = tắt hẳn, 80% = mờ nhẹ)">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    step={5}
                    value={Math.round((glow.minIntensity ?? 0.15) * 100)}
                    onChange={(e) => setGlow({ minIntensity: Number(e.target.value) / 100 }, 'glow-min-intensity')}
                    style={{ flex: 1 }}
                  />
                  <NumberInput
                    id="glow-min-intensity"
                    value={Math.round((glow.minIntensity ?? 0.15) * 100)}
                    min={0}
                    max={80}
                    step={5}
                    precision={0}
                    suffix="%"
                    onChange={(v, key) => setGlow({ minIntensity: v / 100 }, key)}
                  />
                </div>
              </Row>
            </>
          )}

          <p className="hint-text" style={{ margin: '6px 0 0' }}>
            Viền sáng tự động bám theo đường nét alpha thực tế của layer thay vì viền hình chữ nhật.
          </p>
        </>
      )}
    </div>
  )
}
