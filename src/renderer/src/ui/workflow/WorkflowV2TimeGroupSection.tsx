import React, { useEffect, useMemo, useState } from 'react'
import type { Project, WorkflowNode } from '@shared/types'
import { listTimeGroups } from '../../project/workflowTimeGroups'
import { TIME_GROUP_PALETTE, acceptsSharedTime, isTimeNode, timeGroupColor, timeGroupLabel, timeSource } from '../../project/workflowTiming'
import { cleanV2NodeTitle } from './workflowV2Theme'
import { IconWfTimeGroup, IconWfTimeUnlink } from './workflowIcons'
import {
  alignTimeGroupToPlayhead,
  createTimeGroupFrom,
  linkTimeGroup,
  unlinkTimeGroup,
  updateTimeGroupMetaAction
} from './timeGroupActions'
import { useWorkflowMultiSelect } from './workflowMultiSelect'
import '../../styles/workflowTimeGroups.css'

interface Props {
  node: WorkflowNode
  project: Project
  onSelectNode?: (nodeId: string) => void
}

/** Bảng quản lý Node Time: đổi tên, màu, căn Playhead, thêm Node đang chọn và danh sách thành viên ăn theo */
function TimeNodePanel({ node, project, onSelectNode }: Props): React.ReactElement {
  const multiIds = useWorkflowMultiSelect(s => s.ids)
  const [name, setName] = useState(node.title)
  useEffect(() => setName(node.title), [node.id, node.title])
  const color = timeGroupColor(node)
  const members = useMemo(() => {
    const wf = project.workflow
    const ids = new Set((wf?.edges ?? []).filter(e => e.fromNode === node.id && e.fromPort === 'time_range' && !e.disabled).map(e => e.toNode))
    return (wf?.nodes ?? []).filter(n => ids.has(n.id))
  }, [project.workflow, node.id])
  const addable = multiIds.filter(id => id !== node.id && !members.some(m => m.id === id))
  const commitName = (): void => {
    if (name.trim() && name.trim() !== node.title) updateTimeGroupMetaAction(node.id, { title: name.trim() })
  }

  return (
    <div className="wf-v2-tg-section" data-mcp-region="workflow_time_group">
      <div className="wf-v2-tg-row">
        <input
          className="wf-v2-tg-name"
          value={name}
          aria-label="Tên nhóm Time"
          onChange={e => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        />
        <button type="button" className="wf-v2-tg-btn" onClick={() => alignTimeGroupToPlayhead(node.id)} title="Dời cả nhóm để bắt đầu tại Playhead (giữ nguyên độ dài)">
          ⇤ Về Playhead
        </button>
      </div>
      <div className="wf-v2-tg-swatches" role="radiogroup" aria-label="Màu nhóm Time">
        {TIME_GROUP_PALETTE.map(c => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === color}
            className={`wf-v2-tg-swatch${c === color ? ' active' : ''}`}
            style={{ ['--tg-c' as string]: c }}
            onClick={() => updateTimeGroupMetaAction(node.id, { color: c })}
            title="Đổi màu nhận diện nhóm"
          />
        ))}
      </div>
      <div className="wf-v2-tg-row">
        <span className="wf-v2-insp-note">{members.length} mục ăn theo</span>
        {addable.length > 0 && (
          <button type="button" className="wf-v2-tg-btn" onClick={() => linkTimeGroup(node.id, addable)} title="Nối các Node đang chọn nhiều trên sơ đồ vào nhóm này">
            + Thêm {addable.length} Node đang chọn
          </button>
        )}
      </div>
      {members.length > 0 ? (
        <ul className="wf-v2-tg-members">
          {members.map(m => (
            <li key={m.id} className="wf-v2-tg-member">
              <button type="button" className="wf-v2-tg-member-name" title={m.title} onClick={() => onSelectNode?.(m.id)}>
                {cleanV2NodeTitle(m.title)}
              </button>
              <button type="button" className="wf-v2-tg-member-x" aria-label={`Tách ${m.title}`} title="Tách khỏi nhóm (trở lại mốc riêng)" onClick={() => unlinkTimeGroup([m.id])}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="wf-v2-tg-hint">Kéo dây từ cổng ⏱ của Node này sang Layer, Motion, Animation, FX, Âm thanh hoặc mốc lộ trình Camera — hoặc chọn nhiều Node rồi bấm “Thêm”.</p>
      )}
    </div>
  )
}

/** Bảng chọn nhóm Time cho Node thường: nối / đổi nhóm bằng 1 chạm, tạo nhóm mới hoặc tách ra dùng mốc riêng */
function ConsumerPanel({ node, project, onSelectNode }: Props): React.ReactElement {
  const groups = useMemo(() => listTimeGroups(project), [project])
  const source = timeSource(project.workflow, node.id)
  return (
    <div className="wf-v2-tg-section" data-mcp-region="workflow_time_group">
      <div className="wf-v2-tg-row">
        <span className="wf-v2-insp-note"><IconWfTimeGroup width={12} height={12} /> Thời gian chung</span>
        {groups.map(g => (
          <button
            key={g.id}
            type="button"
            className={`wf-v2-tg-chip${source?.id === g.id ? ' active' : ''}`}
            style={{ ['--tg-c' as string]: g.color }}
            aria-pressed={source?.id === g.id}
            onClick={() => (source?.id === g.id ? onSelectNode?.(g.id) : linkTimeGroup(g.id, [node.id]))}
            title={source?.id === g.id ? `Đang ăn theo ${g.title} — nhấp để mở Node Time` : `Ăn theo ${g.title} (${g.start.toFixed(1)}–${g.end.toFixed(1)}s)`}
          >
            {timeGroupLabel(g)} <small>{g.start.toFixed(1)}–{g.end.toFixed(1)}s</small>
          </button>
        ))}
        <button
          type="button"
          className="wf-v2-tg-btn"
          onClick={() => {
            const created = createTimeGroupFrom([node.id])
            if (created) onSelectNode?.(created)
          }}
          title="Tạo nhóm Time mới bắt đầu từ mốc hiện tại của Node này"
        >
          + Time mới
        </button>
        {source && (
          <button type="button" className="wf-v2-tg-btn" onClick={() => unlinkTimeGroup([node.id])} title="Tách khỏi nhóm, quay lại mốc thời gian riêng">
            <IconWfTimeUnlink width={12} height={12} /> Tách
          </button>
        )}
      </div>
      {!groups.length && (
        <p className="wf-v2-tg-hint">Nhiều Layer / Logic / mốc Camera có cùng mốc? Gom chúng vào một Node Time để sửa 1 lần cho tất cả (Ctrl + G trên sơ đồ).</p>
      )}
    </div>
  )
}

/** Section "Thời gian chung" trong Inspector Node — chỉ hiện với Node Time hoặc Node nhận được Time */
export const WorkflowV2TimeGroupSection: React.FC<Props> = (props) => {
  if (isTimeNode(props.node)) return <TimeNodePanel {...props} />
  if (!acceptsSharedTime(props.node)) return null
  return <ConsumerPanel {...props} />
}
