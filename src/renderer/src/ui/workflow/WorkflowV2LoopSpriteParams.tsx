import React from 'react'
import type { Layer, WorkflowNodeParams } from '@shared/types'
import { useView } from '../../store/view'
import { useLoopAnimator } from '../loopAnimator/loopAnimatorState'
import { OptionPills, ParamSlider } from './WorkflowV2NodeParams'

interface Props {
  p: WorkflowNodeParams
  layer?: Layer
  onUpdate: (patch: Partial<WorkflowNodeParams>, directiveLabel?: string) => void
}

export function WorkflowV2LoopSpriteParams({ p, layer, onUpdate }: Props): React.ReactElement {
  const handleOpenLoopStudio = (): void => {
    const templateId = layer?.type === 'image' ? layer.props.loopTemplateId : undefined
    useLoopAnimator.getState().open(templateId)
    useView.getState().openDialog('loop_animator')
  }

  return (
    <div className="vl-subcard" data-mcp-region="workflow_loop_params">
      <div className="vl-row-header">
        <span className="vl-title">🔁 Chu kỳ Hoạt ảnh Loop &amp; Tốc độ</span>
        <span className="vl-value-badge">
          {(p.loopSpeed ?? 1).toFixed(1)}x · {p.loopMode ?? 'loop'}
        </span>
      </div>
      <OptionPills
        cols={2}
        options={[
          { id: 'loop', label: '🔁 Lặp vô tận' },
          { id: 'ping-pong', label: '↔ Đảo chiều' },
          { id: 'once', label: '1️⃣ Chạy 1 lần' },
          { id: 'random', label: '🎲 Ngẫu nhiên' }
        ]}
        value={p.loopMode ?? 'loop'}
        onPick={(id) =>
          onUpdate(
            { animMode: 'loop_sprite', loopMode: id as 'loop' | 'ping-pong' | 'once' | 'random' },
            `Loop: ${id}`
          )
        }
      />
      <ParamSlider
        label="Tốc độ phát Loop"
        min={0.1}
        max={4.0}
        step={0.05}
        value={p.loopSpeed ?? 1}
        format={(v) => `${v.toFixed(2)}×`}
        onChange={(v) => onUpdate({ animMode: 'loop_sprite', loopSpeed: v })}
      />
      <div className="vl-row-header" style={{ marginTop: 6 }}>
        <span className="vl-title">⚡ Kết hợp Nhịp đập &amp; Độ mờ nháy</span>
        <span className="vl-value-badge">{p.loopRhythmMode ?? 'sync_both'}</span>
      </div>
      <OptionPills
        cols={2}
        options={[
          { id: 'none', label: '⏹ Tắt nhịp' },
          { id: 'flicker_opacity', label: '✨ Nháy độ mờ' },
          { id: 'pulse_scale', label: '💓 Tạo nhịp đập' },
          { id: 'sync_both', label: '🔥 Nhịp + Nháy' },
          { id: 'strobe_beat', label: '⚡ Chớp Beat' }
        ]}
        value={p.loopRhythmMode ?? 'sync_both'}
        onPick={(id) =>
          onUpdate(
            {
              animMode: 'loop_sprite',
              loopRhythmMode: id as 'none' | 'flicker_opacity' | 'pulse_scale' | 'sync_both' | 'strobe_beat',
              animFxPreset: id === 'flicker_opacity' ? 'loop_flicker' : 'loop_rhythm'
            },
            `Animation Loop: ${id}`
          )
        }
      />
      {(p.loopRhythmMode ?? 'sync_both') !== 'none' && (
        <>
          <ParamSlider
            label="Tần số nhịp (Hz)"
            min={0.2}
            max={12}
            step={0.1}
            value={p.loopRhythmRateHz ?? 2.5}
            format={(v) => `${v.toFixed(1)} Hz`}
            onChange={(v) => onUpdate({ animMode: 'loop_sprite', loopRhythmRateHz: v })}
          />
          <ParamSlider
            label="Cường độ nháy / nhịp"
            min={0.05}
            max={1}
            step={0.05}
            value={p.loopRhythmIntensity ?? 0.45}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdate({ animMode: 'loop_sprite', loopRhythmIntensity: v, intensity: v })}
          />
          <ParamSlider
            label="Độ mờ tối thiểu (Floor)"
            min={0.05}
            max={0.95}
            step={0.05}
            value={p.loopMinOpacity ?? 0.55}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onUpdate({ animMode: 'loop_sprite', loopMinOpacity: v })}
          />
          <ParamSlider
            label="Biên độ phóng nhịp Scale"
            min={2}
            max={45}
            step={1}
            value={p.loopScaleBeatPct ?? 12}
            format={(v) => `+${Math.round(v)}%`}
            onChange={(v) => onUpdate({ animMode: 'loop_sprite', loopScaleBeatPct: v })}
          />
        </>
      )}
      <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
        <button
          type="button"
          className="wf-v2-direct-btn"
          onClick={handleOpenLoopStudio}
          title="Mở Xưởng Tách Hoạt Ảnh Loop để chỉnh sửa khung cắt và Chroma Key"
        >
          ✎ Mở Xưởng Tách Hoạt Ảnh Loop
        </button>
      </div>
    </div>
  )
}
