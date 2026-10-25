import React, { useEffect, useState } from 'react'
import type { Project, Shot, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { getLayerDisplayName } from '../../project/workflowV2Engine'
import { IconTrash } from '../icons'
import { WorkflowTimeRangeBar } from './WorkflowTimeRangeBar'
import { WorkflowV2JsonPanel } from './WorkflowV2JsonPanel'
import { WorkflowV2NodeParams } from './WorkflowV2NodeParams'
import { isDeletableV2Node, summarizeV2Node } from './WorkflowNodeCardV2'
import {
  WORKFLOW_V2_SPAWN_CATALOG,
  cleanV2NodeTitle,
  resolveV2NodeLevel,
  resolveV2NodeTheme,
  type WorkflowV2SpawnCategory
} from './workflowV2Theme'

export interface WorkflowV2InspectorProps {
  workflow: WorkflowGraph
  project: Project
  node: WorkflowNode | null
  currentTime: number
  shots: { shot: Shot; index: number }[]
  activeShotId: string | null
  focusedShotId: string | null
  jsonMode: boolean
  onSetJsonMode: (jsonMode: boolean) => void
  onSelectShotFocus: (shotId: string | null) => void
  onUpdateParams: (nodeId: string, patch: Partial<WorkflowNodeParams>, nextTitle?: string) => void
  onToggleEnable: (nodeId: string) => void
  onDeleteNode: (nodeId: string) => void
  onAttachLogic: (layerNodeId: string, category: WorkflowV2SpawnCategory) => void
  /** Nối thêm một Layer vào Node Logic (ví dụ chọn Layer B cho Node Va chạm) */
  onConnectLayer: (layerNodeId: string, logicNodeId: string) => void
  onScrubTime: (t: number) => void
}

/** Chọn nhanh Layer B (cùng cảnh) cho Node Va chạm đang chờ — thay cho việc tự đoán đối tượng va chạm */
const CollisionPartnerPicker: React.FC<{ workflow: WorkflowGraph; node: WorkflowNode; onPick: (layerNodeId: string) => void }> = ({ workflow, node, onPick }) => {
  const linked = new Set(node.params?.sharedLayerNodeIds ?? [])
  const candidates = workflow.nodes.filter(
    (n) => n.type === 'layer_assembly' && !n.params?.groupKind && n.params?.shotId === node.params?.shotId && !linked.has(n.id)
  )
  if (candidates.length === 0) return <em className="wf-v2-hint">Cảnh này không còn Layer nào khác để làm Layer B.</em>
  return (
    <div className="wf-v2-partner">
      <span className="wf-v2-hint">⚠ Chọn Layer B để va chạm có hiệu lực:</span>
      <div className="wf-v2-chip-grid">
        {candidates.slice(0, 10).map((c) => (
          <button key={c.id} type="button" className="wf-v2-spawn-chip" onClick={() => onPick(c.id)} title={c.title}>
            B · {cleanV2NodeTitle(c.title)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Ô nhập giây: gõ tự do, chỉ áp dụng khi Enter / rời ô, luôn kẹp trong [min, max] */
const TimeField: React.FC<{ label: string; value: number; min: number; max: number; disabled?: boolean; onCommit: (v: number) => void }> = ({
  label,
  value,
  min,
  max,
  disabled,
  onCommit
}) => {
  const [draft, setDraft] = useState(value.toFixed(2))
  useEffect(() => setDraft(value.toFixed(2)), [value])
  const commit = (): void => {
    const n = Number(draft.replace(',', '.'))
    if (!Number.isFinite(n)) return setDraft(value.toFixed(2))
    const clamped = Number(Math.max(min, Math.min(max, n)).toFixed(2))
    setDraft(clamped.toFixed(2))
    if (Math.abs(clamped - value) > 0.001) onCommit(clamped)
  }
  return (
    <label className="wf-v2-time-field">
      <span>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setDraft(value.toFixed(2))
        }}
      />
      <em>s</em>
    </label>
  )
}

function linkedLayerNames(node: WorkflowNode, project: Project): string[] {
  const ids = node.params?.targetLayerIds ?? []
  const names = project.layers.filter((l) => ids.includes(l.id) && (!l.composite || l.composite.isRoot)).map(getLayerDisplayName)
  return Array.from(new Set(names))
}

/** Bảng thuộc tính của Node đang chọn + Chế độ JSON Cảnh & Main trong Workflow V2 */
export const WorkflowV2Inspector: React.FC<WorkflowV2InspectorProps> = (props) => {
  const { node, project, workflow, currentTime, jsonMode, onSetJsonMode } = props

  const modeTabs = (
    <div className="wf-v2-insp-tabs" role="tablist" aria-label="Chế độ bảng bên phải">
      <button
        type="button"
        role="tab"
        aria-selected={!jsonMode}
        className={`wf-v2-insp-tab${!jsonMode ? ' active' : ''}`}
        onClick={() => onSetJsonMode(false)}
      >
        Thuộc tính Node
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={jsonMode}
        className={`wf-v2-insp-tab${jsonMode ? ' active' : ''}`}
        onClick={() => onSetJsonMode(true)}
      >
        <code>{'{ }'}</code> JSON Cảnh & Main
      </button>
    </div>
  )

  if (jsonMode) {
    return (
      <aside className="wf-v2-inspector json-open" data-mcp-region="workflow_inspector">
        {modeTabs}
        <WorkflowV2JsonPanel
          project={project}
          workflow={workflow}
          shots={props.shots}
          activeShotId={props.activeShotId}
          focusedShotId={props.focusedShotId}
          onSelectShotFocus={props.onSelectShotFocus}
        />
      </aside>
    )
  }

  if (!node) {
    return (
      <aside className="wf-v2-inspector" data-mcp-region="workflow_inspector">
        {modeTabs}
        <div className="wf-v2-insp-empty">Chọn một Node trên sơ đồ để xem thông số, hoặc chuyển sang tab <b>JSON Cảnh &amp; Main</b> để xem/sửa JSON độc lập từng cảnh.</div>
      </aside>
    )
  }
  const theme = resolveV2NodeTheme(node)
  const level = resolveV2NodeLevel(node)
  const duration = Math.max(1, project.comp.duration || 5)
  const tStart = node.params?.timeStart ?? 0
  const tEnd = node.params?.timeEnd ?? duration
  const timeLocked = level === 'root'
  const childCount = workflow.edges.filter((e) => e.fromNode === node.id).length
  const linked = level === 'logic' ? linkedLayerNames(node, project) : []
  const update = (patch: Partial<WorkflowNodeParams>, title?: string): void => props.onUpdateParams(node.id, patch, title)

  return (
    <aside className="wf-v2-inspector" data-mcp-region="workflow_inspector" style={{ ['--wf-v2-accent' as string]: theme.accent }}>
      {modeTabs}
      <header className="wf-v2-insp-head">
        <span className="wf-v2-insp-icon" aria-hidden="true">{theme.icon}</span>
        <div className="wf-v2-insp-titles">
          <span className="wf-v2-insp-badge">{theme.badge}</span>
          <strong title={node.title}>{cleanV2NodeTitle(node.title)}</strong>
          <small>{summarizeV2Node(node, childCount)}</small>
        </div>
        {level !== 'root' && (
          <button
            type="button"
            className={`wf-v2-insp-toggle${node.enabled ? ' on' : ''}`}
            role="switch"
            aria-checked={node.enabled}
            title={node.enabled ? 'Đang bật — nhấn để tắt' : 'Đang tắt — nhấn để bật'}
            onClick={() => props.onToggleEnable(node.id)}
          >
            <span />
          </button>
        )}
        {isDeletableV2Node(node) && (
          <button type="button" className="wf-v2-insp-del" title="Xoá Node (gỡ luôn hiệu ứng khỏi Layer)" aria-label="Xoá node" onClick={() => props.onDeleteNode(node.id)}>
            <IconTrash width={13} height={13} />
          </button>
        )}
      </header>

      <div className="wf-v2-insp-body">
        <section className="wf-v2-insp-sec">
          <div className="wf-v2-insp-sec-title">
            Khoảng thời gian
            {timeLocked && <span className="wf-v2-insp-note">theo phạm vi cảnh</span>}
          </div>
          <div className="wf-v2-time-fields">
            <TimeField label="Bắt đầu" value={tStart} min={0} max={tEnd - 0.1} disabled={timeLocked} onCommit={(v) => update({ timeStart: v })} />
            <TimeField label="Kết thúc" value={tEnd} min={tStart + 0.1} max={duration} disabled={timeLocked} onCommit={(v) => update({ timeEnd: v })} />
            <span className="wf-v2-time-dur">{(tEnd - tStart).toFixed(2)}s</span>
          </div>
          <WorkflowTimeRangeBar
            timeStart={tStart}
            timeEnd={tEnd}
            maxTime={duration}
            currentTime={currentTime}
            accentColor={theme.accent}
            readOnly={timeLocked}
            onChangeRange={(s, e) => update({ timeStart: s, timeEnd: e })}
            onScrubTime={props.onScrubTime}
          />
        </section>

        {level === 'logic' && (
          <section className="wf-v2-insp-sec">
            <div className="wf-v2-insp-sec-title">Áp dụng cho</div>
            <div className="wf-v2-linked">
              {linked.length ? linked.map((name) => <span key={name}>{name}</span>) : <em>Chưa nối Layer nào — kéo dây từ một Layer vào Node này</em>}
            </div>
            {node.params?.logicCategory === 'collision' && (node.params?.sharedLayerNodeIds?.length ?? 0) < 2 && (
              <CollisionPartnerPicker workflow={workflow} node={node} onPick={(layerNodeId) => props.onConnectLayer(layerNodeId, node.id)} />
            )}
          </section>
        )}

        {level !== 'root' && level !== 'group' && (
          <section className="wf-v2-insp-sec">
            <div className="wf-v2-insp-sec-title">Thông số</div>
            <WorkflowV2NodeParams node={node} project={project} onUpdate={update} onScrubTime={props.onScrubTime} />
          </section>
        )}

        {level === 'layer' && (
          <section className="wf-v2-insp-sec">
            <div className="wf-v2-insp-sec-title">Gắn thêm logic</div>
            <div className="wf-v2-chip-grid">
              {WORKFLOW_V2_SPAWN_CATALOG.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="wf-v2-spawn-chip"
                  style={{ ['--wf-v2-accent' as string]: item.accent }}
                  onClick={() => props.onAttachLogic(node.id, item.id)}
                >
                  <span aria-hidden="true">{item.icon}</span> {item.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {(level === 'root' || level === 'group') && (
          <section className="wf-v2-insp-sec">
            <p className="wf-v2-hint">
              {level === 'root'
                ? 'Cảnh là một cụm trong không gian chung. Khoảng thời gian lấy theo lộ trình camera (giống dải "Cảnh đang quay" trên Timeline); dây Camera bên trái nối sang cảnh kế tiếp.'
                : 'Bật/tắt nhóm sẽ ẩn/hiện mọi Layer con. Thu hẹp khoảng thời gian của nhóm sẽ cắt các Layer con vào trong khoảng đó.'}
            </p>
            {level === 'group' && (
              <button type="button" className="wf-v2-ghost-btn" onClick={() => update({ collapsedGroup: !node.params?.collapsedGroup })}>
                {node.params?.collapsedGroup ? 'Mở rộng nhóm trên sơ đồ' : 'Thu gọn nhóm trên sơ đồ'}
              </button>
            )}
          </section>
        )}
      </div>
    </aside>
  )
}
