import React from 'react'
import type { Layer, LoopEndAction, WorkflowNodeParams } from '@shared/types'
import { LOOP_MAX_PLAY_COUNT } from '../../project/loopLifecycle'
import { openLoopAnimatorInPlace } from '../loopAnimator/loopAnimatorLauncher'
import { OptionPills, ParamSlider, type WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'

type DualProps =
  | WorkflowV2NodeParamsProps
  | {
      p: WorkflowNodeParams
      layer?: Layer
      onUpdate: (patch: Partial<WorkflowNodeParams>, directiveLabel?: string) => void
      nodeProps?: WorkflowV2NodeParamsProps
    }

function resolveLoopTargetLayer(props: DualProps): {
  p: WorkflowNodeParams
  layer?: Layer
  onUpdate: (patch: Partial<WorkflowNodeParams>, directiveLabel?: string) => void
} {
  if ('node' in props) {
    const p = props.node.params ?? {}
    const ids = p.targetLayerIds ?? []
    const layer =
      props.project.layers.find((l) => ids.includes(l.id) && (!l.composite || l.composite.isRoot)) ??
      props.project.layers.find((l) => ids.includes(l.id))
    return { p, layer, onUpdate: props.onUpdate }
  }
  return { p: props.p, layer: props.layer, onUpdate: props.onUpdate }
}

/**
 * Node Animation Loop (`logicCategory: 'loop_anim'`):
 * Đơn trách nhiệm — chỉ chứa thông số điều khiển chu kỳ phát lặp của tài nguyên Animate Loop / GIF
 * (Kiểu lặp, Tốc độ phát, Số vòng lặp khi chạy 1 lần, Giữ frame cuối / Ẩn khi hết vòng, Lệch pha).
 * Không gộp chung hiệu ứng mờ dần hay nhịp đập (do Node Hiệu ứng đảm nhiệm).
 */
export const WorkflowV2LoopSpriteParams: React.FC<DualProps> = (rawProps) => {
  const { p, layer, onUpdate } = resolveLoopTargetLayer(rawProps)
  const loopMode = p.loopMode ?? (layer?.type === 'image' ? layer.props.loopMode : undefined) ?? 'loop'
  const loopSpeed = p.loopSpeed ?? (layer?.type === 'image' ? layer.props.speed : undefined) ?? 1
  const playCount = p.loopPlayCount ?? (layer?.type === 'image' ? layer.props.loopPlayCount : undefined) ?? 1
  const endAction: LoopEndAction =
    p.loopEndAction === 'hide' || (layer?.type === 'image' && layer.props.loopEndAction === 'hide')
      ? 'hide'
      : 'hold'
  const timeOffset = p.loopTimeOffset ?? (layer?.type === 'image' ? layer.props.timeOffset : undefined) ?? 0
  const autoPlayPaused =
    p.loopAutoPlayPaused ?? (layer?.type === 'image' ? layer.props.autoPlayPaused : undefined) ?? true

  const handleOpenLoopStudio = (): void => {
    const templateId = layer?.type === 'image' ? layer.props.loopTemplateId : undefined
    openLoopAnimatorInPlace(templateId)
  }

  return (
    <div className="vl-section-card" style={{ marginTop: 2 }} data-mcp-region="workflow_loop_params">
      <div className="vl-subcard">
        <div className="vl-row-header">
          <span className="vl-title">🔁 Chu kỳ phát Hoạt ảnh Loop</span>
          <span className="vl-value-badge">
            {loopSpeed.toFixed(1)}x · {loopMode}
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
          value={loopMode}
          onPick={(id) => {
            const nextMode = id as 'loop' | 'ping-pong' | 'once' | 'random'
            const modeLabel =
              nextMode === 'ping-pong'
                ? 'Đảo chiều'
                : nextMode === 'once'
                  ? `Chạy ${playCount} lần`
                  : nextMode === 'random'
                    ? 'Ngẫu nhiên'
                    : 'Lặp vô tận'
            onUpdate(
              {
                animMode: 'loop_sprite',
                loopMode: nextMode,
                ...(nextMode === 'once' && !p.loopPlayCount ? { loopPlayCount: 1 } : {})
              },
              `Animation Loop: ${loopSpeed.toFixed(1)}x · ${modeLabel}`
            )
          }}
        />
        <ParamSlider
          label="Tốc độ phát Loop"
          min={0.1}
          max={4.0}
          step={0.05}
          value={loopSpeed}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(v) => onUpdate({ animMode: 'loop_sprite', loopSpeed: v })}
        />

        {loopMode === 'once' && (
          <>
            <ParamSlider
              label="Số vòng lặp (khi Chạy 1 lần)"
              min={1}
              max={LOOP_MAX_PLAY_COUNT}
              step={1}
              value={playCount}
              format={(v) => `${Math.round(v)} vòng`}
              onChange={(v) =>
                onUpdate(
                  { animMode: 'loop_sprite', loopPlayCount: Math.round(v) },
                  `Animation Loop: ${loopSpeed.toFixed(1)}x · Chạy ${Math.round(v)} lần`
                )
              }
            />
            <div className="vl-row-header" style={{ marginTop: 4 }}>
              <span className="vl-subtitle">Khi chạy hết số vòng</span>
            </div>
            <OptionPills
              cols={2}
              options={[
                { id: 'hold', label: '⏸ Giữ frame cuối' },
                { id: 'hide', label: '🙈 Ẩn đi ngay' }
              ]}
              value={endAction === 'hide' ? 'hide' : 'hold'}
              onPick={(id) =>
                onUpdate(
                  { animMode: 'loop_sprite', loopEndAction: id as LoopEndAction },
                  id === 'hide' ? 'Loop: Ẩn khi hết vòng' : 'Loop: Giữ frame cuối'
                )
              }
            />
          </>
        )}

        <ParamSlider
          label="Lệch pha bắt đầu"
          min={0}
          max={3.0}
          step={0.05}
          value={timeOffset}
          format={(v) => `${v.toFixed(2)}s`}
          onChange={(v) => onUpdate({ animMode: 'loop_sprite', loopTimeOffset: v })}
        />

        <OptionPills
          cols={2}
          options={[
            { id: 'on', label: '▶ Tự lặp khi dừng' },
            { id: 'off', label: '⏸ Dừng theo Timeline' }
          ]}
          value={autoPlayPaused ? 'on' : 'off'}
          onPick={(id) => onUpdate({ animMode: 'loop_sprite', loopAutoPlayPaused: id === 'on' })}
        />

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
    </div>
  )
}
