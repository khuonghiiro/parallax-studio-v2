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
      setStatus('Đã tắt dao động rời của các lớp')
    } else {
      setStatus(
        `Đã áp "${meta?.label ?? preset}" (${targetIds ? `${targetIds.length} lớp chọn` : `toàn cụm ${totalLayers} lớp`})`
      )
    }
  }

  return (
    <div className="lw-card-section lw-motion-harmony-card" data-mcp-region="layer_assembly_motion_harmony">
      <div className="lw-card-header">
        <span className="lw-card-title">Hòa âm dao động Layer 2.5D</span>
        <span className="lw-card-badge">
          {activeMotionLayers}/{totalLayers} lớp bật
        </span>
      </div>

      <p className="lw-harmony-desc">
        Phân bổ dao động sóng hài (Thở, Đung đưa, Lượn sóng, Lơ lửng) theo độ sâu Z 2.5D kèm lệch pha tỉ lệ vàng (0.618s) mà không cần vẽ trục xương.
      </p>

      <div className="lw-angle-seg-bar compact" role="radiogroup" aria-label="Phạm vi áp dụng Hòa âm 2.5D">
        <button
          type="button"
          role="radio"
          aria-checked={scope === 'all'}
          className={`lw-angle-seg-btn${scope === 'all' ? ' active' : ''}`}
          onClick={() => setScope('all')}
        >
          Toàn cụm ({totalLayers})
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={scope === 'selected'}
          className={`lw-angle-seg-btn${scope === 'selected' ? ' active' : ''}`}
          onClick={() => setScope('selected')}
          disabled={selectedIds.length === 0}
          title={selectedIds.length === 0 ? 'Chọn ít nhất 1 lớp trên sân khấu hoặc tab Lớp để bật chế độ này' : undefined}
        >
          Lớp chọn ({selectedIds.length})
        </button>
      </div>

      <div className="lw-plant-sliders lw-plant-init-box">
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
          <span className="lw-plant-slider-val">{ampMul}×</span>
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
          <span className="lw-plant-slider-val">{speedMul}×</span>
        </label>
        <label
          className="lw-harmony-stagger-check"
          title="Mỗi layer lệch nhau 0.618 giây để chuyển động tự nhiên, không bị đồng loạt"
        >
          <input
            type="checkbox"
            checked={staggerPhase}
            onChange={(e) => setStaggerPhase(e.target.checked)}
          />
          <span>So le nhịp tỉ lệ vàng (φ = 0.618s)</span>
        </label>
      </div>

      <div className="lw-studio-preset-grid" role="group" aria-label="Mẫu hòa âm chuyển động Layer 2.5D">
        {LAYER_HARMONY_PRESETS.map((p) => {
          const isReset = p.id === 'reset-none'
          return (
            <button
              key={p.id}
              type="button"
              className={`lw-studio-preset-item${isReset ? ' is-danger' : ''}`}
              disabled={totalLayers === 0}
              onClick={() => handleApplyPreset(p.id)}
              title={p.hint}
            >
              <span className="lw-studio-preset-name">{p.label}</span>
              <small className="lw-studio-preset-meta">{isReset ? 'Tắt dao động rời' : 'Theo tầng Z 2.5D'}</small>
            </button>
          )
        })}
      </div>

      {status && (
        <div role="status" className="lw-harmony-status">
          {status}
        </div>
      )}
    </div>
  )
}
