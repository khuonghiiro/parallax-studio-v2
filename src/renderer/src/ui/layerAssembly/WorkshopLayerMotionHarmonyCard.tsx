import { useState } from 'react'
import type { LayerComposite } from './types'
import {
  LAYER_HARMONY_PRESETS,
  applyLayerMotionHarmony,
  type LayerHarmonyPresetId
} from './workshopLayerMotionHarmony'

export interface WorkshopLayerMotionHarmonyCardProps {
  composite: LayerComposite
  selectedIds: string[]
  setComposite: (update: (prev: LayerComposite) => LayerComposite, key?: string) => void
}

export function WorkshopLayerMotionHarmonyCard({
  composite,
  selectedIds,
  setComposite
}: WorkshopLayerMotionHarmonyCardProps) {
  const [scope, setScope] = useState<'all' | 'selected'>('all')
  const [speedMul, setSpeedMul] = useState(1.0)
  const [ampMul, setAmpMul] = useState(1.0)
  const [staggerPhase, setStaggerPhase] = useState(true)
  const [status, setStatus] = useState('')

  const activeMotionLayers = composite.layers.filter((l) => l.motion && l.motion.type !== 'none').length
  const totalLayers = composite.layers.length

  const handleApplyPreset = (preset: LayerHarmonyPresetId) => {
    const targetIds = scope === 'selected' && selectedIds.length > 0 ? selectedIds : undefined
    setComposite(
      (prev) =>
        applyLayerMotionHarmony(prev, {
          preset,
          targetLayerIds: targetIds,
          speedMultiplier: speedMul,
          amplitudeMultiplier: ampMul,
          staggerPhase
        }),
      `motion-harmony:${preset}`
    )
    const meta = LAYER_HARMONY_PRESETS.find((p) => p.id === preset)
    if (preset === 'reset-none') {
      setStatus('✓ Đã tắt chuyển động rời của các mảnh Layer')
    } else {
      setStatus(
        `✓ Đã áp dụng "${meta?.label ?? preset}" (${targetIds ? `${targetIds.length} lớp chọn` : `toàn cụm ${totalLayers} lớp`})`
      )
    }
  }

  return (
    <div
      className="lw-plant-create-card lw-motion-harmony-card"
      data-mcp-region="layer_assembly_motion_harmony"
      style={{ marginBottom: '10px' }}
    >
      <div className="lw-plant-create-head">
        <span className="lw-plant-create-title">🌊 Hòa âm Motion Layer 2.5D</span>
        <span className="lw-plant-create-sub">
          {activeMotionLayers}/{totalLayers} lớp đang bật
        </span>
      </div>

      <p style={{ margin: '2px 0 8px', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.45 }}>
        Tự động phân bổ chuyển động sóng hài (Thở, Đung đưa, Lượn sóng, Lơ lửng) theo giải phẫu và độ sâu Z 2.5D kèm lệch pha Tỉ lệ vàng (0.618s).
      </p>

      {/* Phạm vi áp dụng */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
        <button
          type="button"
          className={`lw-plant-chip${scope === 'all' ? ' active' : ''}`}
          onClick={() => setScope('all')}
          style={{ flex: 1 }}
        >
          🌐 Toàn cụm ({totalLayers} lớp)
        </button>
        <button
          type="button"
          className={`lw-plant-chip${scope === 'selected' ? ' active' : ''}`}
          onClick={() => setScope('selected')}
          disabled={selectedIds.length === 0}
          style={{ flex: 1 }}
          title={selectedIds.length === 0 ? 'Chọn ít nhất 1 layer ở tab Layer để bật chế độ này' : undefined}
        >
          🎯 Lớp đang chọn ({selectedIds.length})
        </button>
      </div>

      {/* Thanh trượt tốc độ & biên độ */}
      <div className="lw-plant-sliders lw-plant-init-box" style={{ marginBottom: '6px' }}>
        <label className="lw-plant-slider" title="Hệ số nhân biên độ dao động của các mảnh Layer">
          <span className="lw-plant-slider-label">Hệ số biên độ</span>
          <input
            type="range"
            min={0.3}
            max={2.5}
            step={0.1}
            value={ampMul}
            onChange={(e) => setAmpMul(Number(e.target.value))}
          />
          <span className="lw-plant-slider-val">{ampMul}x</span>
        </label>
        <label className="lw-plant-slider" title="Hệ số nhân tốc độ chu kỳ chuyển động">
          <span className="lw-plant-slider-label">Hệ số tốc độ</span>
          <input
            type="range"
            min={0.3}
            max={2.5}
            step={0.1}
            value={speedMul}
            onChange={(e) => setSpeedMul(Number(e.target.value))}
          />
          <span className="lw-plant-slider-val">{speedMul}x</span>
        </label>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: 'var(--text-dim)', cursor: 'pointer', marginTop: '2px' }}
          title="Mỗi layer lệch nhau 0.618 giây để chuyển động tự nhiên, không bị đồng loạt như robot"
        >
          <input
            type="checkbox"
            checked={staggerPhase}
            onChange={(e) => setStaggerPhase(e.target.checked)}
          />
          <span>So le nhịp Tỉ lệ vàng (φ = 0.618s)</span>
        </label>
      </div>

      {/* Lưới 6 nút Hòa âm Motion 2.5D */}
      <div
        role="group"
        aria-label="Mẫu hòa âm chuyển động Layer 2.5D"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '5px'
        }}
      >
        {LAYER_HARMONY_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`btn xs ${p.id === 'reset-none' ? 'ghost' : ''}`}
            disabled={totalLayers === 0}
            onClick={() => handleApplyPreset(p.id)}
            title={p.hint}
            style={{
              justifyContent: 'flex-start',
              padding: '5px 7px',
              fontSize: '10.5px',
              borderRadius: 'var(--radius-sm, 4px)',
              color: p.id === 'reset-none' ? 'var(--danger, #ef4444)' : undefined
            }}
          >
            <span aria-hidden="true">{p.icon}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.label}
            </span>
          </button>
        ))}
      </div>

      {status && (
        <div
          role="status"
          style={{
            marginTop: '6px',
            padding: '4px 8px',
            borderRadius: '4px',
            background: 'var(--bg-1)',
            border: '1px solid var(--line-soft)',
            fontSize: '10.5px',
            color: 'var(--accent-cyan)'
          }}
        >
          {status}
        </div>
      )}
    </div>
  )
}
