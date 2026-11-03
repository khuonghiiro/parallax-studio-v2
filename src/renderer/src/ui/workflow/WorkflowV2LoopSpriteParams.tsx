import React from 'react'
import type { Layer, LoopEndAction, LoopTriggerMode, WorkflowNodeParams } from '@shared/types'
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
 * Đơn trách nhiệm — điều khiển chu kỳ phát lặp của tài nguyên Animate Loop / GIF
 * (Kiểu lặp, Tốc độ phát, Số vòng lặp, Chuỗi Nhóm hiệu ứng nối tiếp / Kết hợp tại Frame,
 * Thời gian chờ `loopDelaySec`, Thời lượng giữ `loopHoldDurationSec`, và Vị trí chạy của nhóm).
 */
export const WorkflowV2LoopSpriteParams: React.FC<DualProps> = (rawProps) => {
  const { p, layer, onUpdate } = resolveLoopTargetLayer(rawProps)
  const ovr = layer?.type === 'image' ? layer.props.loopOverrides : undefined
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
  const tintColor =
    p.loopTintColor !== undefined
      ? p.loopTintColor
      : (layer?.type === 'image' ? (layer.props.loopColor?.tintColor ?? ovr?.color?.tintColor) : undefined) ?? null
  const brightness =
    p.loopBrightness ??
    (layer?.type === 'image' ? (layer.props.loopColor?.brightness ?? ovr?.color?.brightness) : undefined) ?? 1.0
  const hueRotate =
    p.loopHueRotate ??
    (layer?.type === 'image' ? (layer.props.loopColor?.hueRotate ?? ovr?.color?.hueRotate) : undefined) ?? 0
  const loopJsonPath = layer?.type === 'image' ? layer.props.loopJsonPath : undefined

  // Thông số Nhóm hiệu ứng nối tiếp / kết hợp frame
  const groupIndex = p.loopGroupIndex ?? ovr?.groupIndex ?? 0
  const totalGroups = p.loopTotalGroups ?? ovr?.totalGroups ?? 1
  const groupName = p.loopGroupName ?? ovr?.groupName ?? (layer?.name || `Nhóm #${groupIndex + 1}`)
  const triggerMode: LoopTriggerMode =
    p.loopTriggerMode ?? ovr?.triggerMode ?? 'sequential'
  const triggerFrameIndex = p.loopTriggerFrameIndex ?? ovr?.triggerFrameIndex ?? 1
  const delaySec = p.loopDelaySec ?? ovr?.delaySec ?? 0
  const holdDurationSec = p.loopHoldDurationSec ?? ovr?.holdDurationSec ?? 0
  const groupOffsetX = p.loopGroupOffsetX ?? ovr?.offsetX ?? 0
  const groupOffsetY = p.loopGroupOffsetY ?? ovr?.offsetY ?? 0
  const groupScale = p.loopGroupScale ?? ovr?.scale ?? 1

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

        {/* Cấu hình Nhóm hiệu ứng nối tiếp / Kết hợp Frame / Chờ giây / Giữ thời gian */}
        <div className="vl-row-header" style={{ marginTop: 10 }}>
          <span className="vl-subtitle">
            🔗 Nhóm hiệu ứng & Thời lượng giữ ({groupName})
          </span>
          <span className="vl-value-badge">
            Nhóm #{groupIndex + 1}/{Math.max(1, totalGroups)}
          </span>
        </div>

        {(groupIndex > 0 || totalGroups > 1) && (
          <>
            <OptionPills
              cols={3}
              options={[
                { id: 'sequential', label: '⏭ Nối tiếp' },
                { id: 'on_frame', label: '⚡ Tại Frame' },
                { id: 'parallel', label: '⇉ Song song' }
              ]}
              value={triggerMode}
              onPick={(id) =>
                onUpdate(
                  { animMode: 'loop_sprite', loopTriggerMode: id as LoopTriggerMode },
                  `Loop Nhóm #${groupIndex + 1}: Khởi chạy ${id}`
                )
              }
            />
            {triggerMode === 'on_frame' && (
              <ParamSlider
                label={`Kích hoạt tại Frame của Nhóm #${Math.max(1, groupIndex)}`}
                min={1}
                max={32}
                step={1}
                value={triggerFrameIndex}
                format={(v) => `Frame #${Math.round(v)}`}
                onChange={(v) =>
                  onUpdate(
                    { animMode: 'loop_sprite', loopTriggerFrameIndex: Math.round(v) },
                    `Loop Nhóm #${groupIndex + 1}: Chạy tại Frame #${Math.round(v)}`
                  )
                }
              />
            )}
          </>
        )}

        <ParamSlider
          label={
            groupIndex > 0
              ? 'Thời gian chờ trước khi chạy nhóm này'
              : 'Thời gian chờ bắt đầu (Delay)'
          }
          min={0}
          max={10.0}
          step={0.05}
          value={delaySec}
          format={(v) => `${v.toFixed(2)}s`}
          onChange={(v) =>
            onUpdate(
              { animMode: 'loop_sprite', loopDelaySec: Number(v.toFixed(2)) },
              `Loop Nhóm #${groupIndex + 1}: Chờ ${v.toFixed(2)}s`
            )
          }
        />

        <ParamSlider
          label="Thời lượng giữ hiệu ứng (0s = Tự động)"
          min={0}
          max={20.0}
          step={0.1}
          value={holdDurationSec}
          format={(v) => (v <= 0.01 ? 'Tự động' : `${v.toFixed(1)}s`)}
          onChange={(v) =>
            onUpdate(
              { animMode: 'loop_sprite', loopHoldDurationSec: Number(v.toFixed(1)) },
              v <= 0.01
                ? `Loop Nhóm #${groupIndex + 1}: Giữ tự động`
                : `Loop Nhóm #${groupIndex + 1}: Giữ ${v.toFixed(1)}s`
            )
          }
        />

        {/* Chọn nhanh thời lượng giữ cho hiệu ứng (VD: giữ vòng xoáy lâu sau khi sét đánh) */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2, marginBottom: 6 }}>
          {[
            { sec: 0, label: 'Tự động' },
            { sec: 1.5, label: '1.5s' },
            { sec: 3.0, label: '3.0s' },
            { sec: 5.0, label: '5.0s' },
            { sec: 8.0, label: '8.0s' },
            { sec: 12.0, label: '12s' }
          ].map((preset) => {
            const active = Math.abs(holdDurationSec - preset.sec) < 0.06
            return (
              <button
                key={preset.label}
                type="button"
                className={`btn xs ${active ? 'primary' : 'ghost'}`}
                style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4 }}
                onClick={() =>
                  onUpdate(
                    { animMode: 'loop_sprite', loopHoldDurationSec: preset.sec },
                    `Loop Nhóm #${groupIndex + 1}: Giữ ${preset.label}`
                  )
                }
              >
                ⏱ {preset.label}
              </button>
            )
          })}
        </div>

        <ParamSlider
          label="Căn vị trí chạy X (khớp điểm chạm)"
          min={-600}
          max={600}
          step={2}
          value={groupOffsetX}
          format={(v) => `${v >= 0 ? '+' : ''}${Math.round(v)}px`}
          onChange={(v) => onUpdate({ animMode: 'loop_sprite', loopGroupOffsetX: Math.round(v) })}
        />

        <ParamSlider
          label="Căn vị trí chạy Y (khớp điểm chạm)"
          min={-600}
          max={600}
          step={2}
          value={groupOffsetY}
          format={(v) => `${v >= 0 ? '+' : ''}${Math.round(v)}px`}
          onChange={(v) => onUpdate({ animMode: 'loop_sprite', loopGroupOffsetY: Math.round(v) })}
        />

        <ParamSlider
          label="Tỉ lệ kích thước nhóm"
          min={0.2}
          max={3.0}
          step={0.05}
          value={groupScale}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onUpdate({ animMode: 'loop_sprite', loopGroupScale: Number(v.toFixed(2)) })}
        />

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

        {/* Màu sắc & Bộ lọc Kế thừa (Override từ animation.json) */}
        <div className="vl-row-header" style={{ marginTop: 10 }}>
          <span className="vl-subtitle">🎨 Màu phủ kế thừa (Override)</span>
          {Boolean(tintColor || brightness !== 1 || hueRotate !== 0) && (
            <button
              type="button"
              className="btn xs ghost"
              style={{ fontSize: 10, padding: '2px 6px' }}
              onClick={() => onUpdate({ loopTintColor: null, loopBrightness: 1.0, loopHueRotate: 0 }, 'Loop: Đặt lại màu gốc')}
              title="Khôi phục màu mặc định từ file animation.json"
            >
              ↺ Đặt lại
            </button>
          )}
        </div>

        {/* Bảng chọn màu nhanh 1-click */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4, marginBottom: 6 }}>
          {[
            { id: 'original', color: null, label: 'Gốc' },
            { id: 'fire', color: '#f97316', label: '🔥 Cam' },
            { id: 'ice', color: '#38bdf8', label: '❄ Lam' },
            { id: 'magic', color: '#a855f7', label: '✨ Tím' },
            { id: 'poison', color: '#22c55e', label: '🌿 Lục' },
            { id: 'gold', color: '#eab308', label: '⚡ Vàng' }
          ].map((chip) => {
            const isSel = chip.color === null ? !tintColor : tintColor === chip.color
            return (
              <button
                key={chip.id}
                type="button"
                className={`btn xs ${isSel ? 'primary' : 'ghost'}`}
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 4,
                  borderColor: isSel ? 'var(--accent)' : 'var(--line-soft)',
                  background: chip.color
                    ? `color-mix(in srgb, ${chip.color} 25%, var(--bg-2))`
                    : 'var(--bg-2)'
                }}
                onClick={() => onUpdate({ loopTintColor: chip.color }, `Loop: Đổi màu ${chip.label}`)}
              >
                {chip.label}
              </button>
            )
          })}
        </div>

        <ParamSlider
          label="Độ sáng (Brightness)"
          min={0.3}
          max={2.0}
          step={0.05}
          value={brightness}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onUpdate({ loopBrightness: v })}
        />

        <ParamSlider
          label="Xoay vòng màu (Hue Rotate)"
          min={-180}
          max={180}
          step={5}
          value={hueRotate}
          format={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}°`}
          onChange={(v) => onUpdate({ loopHueRotate: Math.round(v) })}
        />

        {loopJsonPath && (
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-faint)', wordBreak: 'break-all' }}>
            📁 Kế thừa từ: <code>{loopJsonPath}</code>
          </div>
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
    </div>
  )
}
