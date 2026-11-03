import React from 'react'
import type { Layer, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { createTimeGroup, layerNodeIdOf, linkToTimeGroup } from '../../project/workflowTimeGroups'
import { timeGroupLabel, timeSource } from '../../project/workflowTiming'
import { LOOP_COMBO_FX_OPTIONS, normalizeLoopComboFx, toggleLoopComboFx } from '../../project/workflowV2LoopCombo'
import { WORKFLOW_V2_ANIM_FX_OPTIONS } from '../../project/workflowV2Options'
import { useEditor } from '../../store/editor'
import { OptionPills, ParamSlider, type WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'
import '../../styles/workflowLoopLifecycle.css'

type UpdateFn = (patch: Partial<WorkflowNodeParams>, directiveLabel?: string) => void

const END_ACTIONS: { id: 'hold' | 'hide' | 'fade_out'; label: string }[] = [
  { id: 'hold', label: '⏸ Giữ cuối' },
  { id: 'hide', label: '🙈 Ẩn ngay' },
  { id: 'fade_out', label: '🌫 Mờ rồi ẩn' }
]

/** Vòng đời Loop: số lần chạy, hiện dần lúc xuất hiện, hành vi khi kết thúc (giữ / ẩn / mờ dần) */
export function WorkflowV2LoopLifecycleSection({ p, onUpdate }: { p: WorkflowNodeParams; onUpdate: UpdateFn }): React.ReactElement {
  const isOnce = (p.loopMode ?? 'loop') === 'once'
  const endAction = p.loopEndAction ?? 'hold'
  const playCount = p.loopPlayCount ?? 1
  return (
    <div className="vl-subcard wf-loop-lifecycle" data-mcp-region="workflow_loop_lifecycle">
      <div className="vl-row-header">
        <span className="vl-title">🎬 Xuất hiện &amp; Kết thúc</span>
        <span className="vl-value-badge">{isOnce ? `${playCount} lần` : 'theo thời gian Node'}</span>
      </div>
      {isOnce && (
        <ParamSlider
          label="Số lần chạy"
          min={1}
          max={10}
          step={1}
          value={playCount}
          format={(v) => `${Math.round(v)} lần`}
          onChange={(v) => onUpdate({ animMode: 'loop_sprite', loopPlayCount: Math.round(v) })}
        />
      )}
      <ParamSlider
        label="Hiện dần (mờ → nét)"
        min={0}
        max={3}
        step={0.1}
        value={p.loopFadeInSec ?? 0}
        format={(v) => (v <= 0 ? 'Tắt' : `${v.toFixed(1)}s`)}
        onChange={(v) => onUpdate({ animMode: 'loop_sprite', loopFadeInSec: Number(v.toFixed(2)) })}
      />
      <span className="wf-loop-hint">{isOnce ? 'Khi chạy hết số lần:' : 'Khi hết thời gian Node / Node Time:'}</span>
      <OptionPills
        cols={3}
        options={END_ACTIONS}
        value={endAction}
        onPick={(id) => onUpdate({ animMode: 'loop_sprite', loopEndAction: id }, `Loop kết thúc: ${id}`)}
      />
      {endAction === 'fade_out' && (
        <ParamSlider
          label="Thời gian mờ dần"
          min={0.1}
          max={3}
          step={0.1}
          value={p.loopFadeOutSec ?? 0.5}
          format={(v) => `${v.toFixed(1)}s`}
          onChange={(v) => onUpdate({ animMode: 'loop_sprite', loopFadeOutSec: Number(v.toFixed(2)) })}
        />
      )}
    </div>
  )
}

/** Kết hợp hiệu ứng Keyframe / Neon FX chạy song song với Loop (mỗi nhóm thuộc tính 1 hiệu ứng) */
export function WorkflowV2LoopComboFxSection({ p, onUpdate }: { p: WorkflowNodeParams; onUpdate: UpdateFn }): React.ReactElement {
  const active = normalizeLoopComboFx(p.loopComboFx)
  return (
    <div className="vl-subcard wf-loop-combo" data-mcp-region="workflow_loop_combo_fx">
      <div className="vl-row-header">
        <span className="vl-title">✨ Kết hợp hiệu ứng FX</span>
        <span className="vl-value-badge">{active.length ? `${active.length} hiệu ứng` : 'Chưa kết hợp'}</span>
      </div>
      <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {LOOP_COMBO_FX_OPTIONS.map((c) => {
          const opt = WORKFLOW_V2_ANIM_FX_OPTIONS.find((o) => o.id === c.id)
          const on = active.includes(c.id)
          return (
            <button
              key={c.id}
              type="button"
              className={`wf-v2-opt-pill${on ? ' active' : ''}`}
              aria-pressed={on}
              title={`${opt?.label ?? c.id} — chọn hiệu ứng khác cùng nhóm sẽ thay thế`}
              onClick={() => onUpdate({ animMode: 'loop_sprite', loopComboFx: toggleLoopComboFx(active, c.id) }, `Loop + ${c.id}`)}
            >
              <span className="wf-v2-opt-pill-txt">{opt?.shortLabel ?? c.id}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function findMotionNode(nodes: WorkflowNode[], layerId: string): WorkflowNode | undefined {
  return nodes.find((n) => n.params?.logicCategory === 'action' && (n.params?.targetLayerIds ?? []).includes(layerId))
}

/** Đồng bộ thời gian Loop với Node Motion qua Node Time chung (tạo nhóm mới hoặc nối vào nhóm đang có) */
function syncLoopWithMotionTime(nodeId: string, motionId: string | undefined): void {
  useEditor.getState().update((d) => {
    const wf = d.workflow
    if (!wf) return
    const loopNode = wf.nodes.find((n) => n.id === nodeId)
    const motionNode = motionId ? wf.nodes.find((n) => n.id === motionId) : undefined
    if (!loopNode) return
    const existing = timeSource(wf, loopNode.id) ?? (motionNode ? timeSource(wf, motionNode.id) : undefined)
    const members = [loopNode, ...(motionNode ? [motionNode] : [])]
    if (existing) linkToTimeGroup(d, existing.id, members)
    else createTimeGroup(d, members)
  }, 'Loop: đồng bộ Node Time')
}

/** Trạng thái & nút kết hợp nhanh Node Loop với Node Time và Node Motion trong Workflow */
export function WorkflowV2LoopLinksSection({ props, layer }: { props: WorkflowV2NodeParamsProps; layer?: Layer }): React.ReactElement | null {
  const { node, project, onAttachLogic } = props
  const wf = project.workflow
  if (!layer || !wf) return null
  const clock = timeSource(wf, node.id)
  const motion = findMotionNode(wf.nodes, layer.id)
  const motionClock = motion ? timeSource(wf, motion.id) : undefined
  const shared = Boolean(clock && motionClock && clock.id === motionClock.id)
  return (
    <div className="vl-subcard wf-loop-links" data-mcp-region="workflow_loop_links">
      <div className="vl-row-header">
        <span className="vl-title">🔗 Kết hợp Node khác</span>
        <span className="vl-value-badge">{shared ? 'Đồng bộ Time + Motion' : clock ? 'Đã nối Time' : 'Độc lập'}</span>
      </div>
      <div className="wf-loop-link-row">
        <span className="wf-loop-chip" style={clock ? { borderColor: clock.params?.timeGroupColor } : undefined}>
          ⏱ {clock ? `${timeGroupLabel(clock)} · ${(clock.params?.timeStart ?? 0).toFixed(1)}s → ${(clock.params?.timeEnd ?? 0).toFixed(1)}s` : 'Chưa nối Node Time'}
        </span>
        <span className="wf-loop-chip">🏃 {motion ? motion.title : 'Chưa có Node Motion'}</span>
      </div>
      <div className="wf-loop-link-row">
        {!motion && onAttachLogic && (
          <button type="button" className="wf-v2-mini-btn" onClick={() => onAttachLogic(layerNodeIdOf(layer.id), 'action')}>
            + Thêm Node Motion
          </button>
        )}
        {(!clock || (motion && !shared)) && (
          <button
            type="button"
            className="wf-v2-mini-btn"
            title="Nối Loop (và Motion nếu có) vào chung 1 Node Time: sửa Time 1 lần là cả Loop, hiện/ẩn và Motion cùng ăn theo"
            onClick={() => syncLoopWithMotionTime(node.id, motion?.id)}
          >
            ⏱ {motion ? 'Đồng bộ Time với Motion' : 'Tạo Node Time chung'}
          </button>
        )}
      </div>
    </div>
  )
}
