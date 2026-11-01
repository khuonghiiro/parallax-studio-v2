import React, { useMemo } from 'react'
import type { Project } from '@shared/types'
import { listTimeGroups } from '../../project/workflowTimeGroups'
import { acceptsSharedTime, timeGroupLabel, timeSource } from '../../project/workflowTiming'
import { IconWfTimeGroup, IconWfTimeUnlink } from './workflowIcons'
import { createTimeGroupFrom, linkTimeGroup, unlinkTimeGroup } from './timeGroupActions'
import { useWorkflowMultiSelect } from './workflowMultiSelect'
import '../../styles/workflowTimeGroups.css'

interface Props {
  project: Project
  onSelectNode: (nodeId: string | null) => void
}

/**
 * Thanh thao tác nổi khi chọn nhiều Node (giống selection toolbar của Figma / Blender):
 * gom vào nhóm Time mới, nối vào nhóm Time có sẵn, tách khỏi nhóm hoặc bỏ chọn — mỗi nút là một bước Undo.
 */
export const WorkflowV2SelectionBar: React.FC<Props> = ({ project, onSelectNode }) => {
  const ids = useWorkflowMultiSelect(s => s.ids)
  const clear = useWorkflowMultiSelect(s => s.clear)
  const groups = useMemo(() => listTimeGroups(project), [project])
  const wf = project.workflow
  const nodes = useMemo(() => (wf?.nodes ?? []).filter(n => ids.includes(n.id)), [wf, ids])
  if (!wf || nodes.length === 0) return null
  const timeable = nodes.filter(acceptsSharedTime)
  const bound = timeable.filter(n => timeSource(wf, n.id))
  const skipped = nodes.length - timeable.length

  return (
    <div className="wf-v2-selection-bar" data-mcp-region="workflow_selection_bar" role="toolbar" aria-label="Thao tác nhiều Node" onPointerDown={e => e.stopPropagation()}>
      <span className="wf-v2-sel-count" title={skipped ? `${skipped} Node cấu trúc (Cảnh, Nhóm, Vật liệu…) không dùng Time chung` : undefined}>
        <b>{nodes.length}</b> Node chọn
        {skipped > 0 && <small> · {timeable.length} nhận Time</small>}
      </span>
      <button
        type="button"
        className="wf-v2-sel-btn primary"
        disabled={!timeable.length}
        onClick={() => {
          const created = createTimeGroupFrom(timeable.map(n => n.id))
          if (created) { clear(); onSelectNode(created) }
        }}
        title="Tạo Node Time mới và nối mọi Node đang chọn vào — sửa 1 lần cho cả nhóm"
      >
        <IconWfTimeGroup width={13} height={13} />
        <span>Gom Time chung</span>
      </button>
      {groups.length > 0 && (
        <div className="wf-v2-sel-groups" aria-label="Nối vào nhóm Time có sẵn">
          {groups.map(g => (
            <button
              key={g.id}
              type="button"
              className="wf-v2-sel-chip"
              style={{ ['--tg-c' as string]: g.color }}
              disabled={!timeable.length}
              onClick={() => linkTimeGroup(g.id, timeable.map(n => n.id))}
              title={`Nối ${timeable.length} Node vào ${g.title} (${g.start.toFixed(1)}–${g.end.toFixed(1)}s)`}
            >
              → {timeGroupLabel(g)}
            </button>
          ))}
        </div>
      )}
      {bound.length > 0 && (
        <button type="button" className="wf-v2-sel-btn" onClick={() => unlinkTimeGroup(bound.map(n => n.id))} title="Tách các Node đang chọn khỏi nhóm Time, trở lại mốc riêng">
          <IconWfTimeUnlink width={13} height={13} />
          <span>Tách ({bound.length})</span>
        </button>
      )}
      <button type="button" className="wf-v2-sel-btn icon" onClick={clear} title="Bỏ chọn (Esc)" aria-label="Bỏ chọn">✕</button>
    </div>
  )
}
