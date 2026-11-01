import React, { useMemo, useRef, useState } from 'react'
import type { Project } from '@shared/types'
import { listTimeGroups, type TimeGroupSummary } from '../../project/workflowTimeGroups'
import { acceptsSharedTime, timeGroupLabel } from '../../project/workflowTiming'
import { dragTimeRange } from './WorkflowTimeRangeBar'
import { IconWfTimeGroup } from './workflowIcons'
import { createTimeGroupFrom, setTimeGroupRangeAction } from './timeGroupActions'
import { useWorkflowMultiSelect } from './workflowMultiSelect'
import '../../styles/workflowTimeGroups.css'

interface Props {
  project: Project
  duration: number
  /** Vị trí & bề rộng thật của rãnh thước thời gian để làn Time thẳng hàng tuyệt đối với vạch giây */
  trackLeft: number
  trackWidth: number
  selectedNodeId: string | null
  onSelectNode: (nodeId: string | null) => void
  onSetTime: (t: number) => void
}

type Preview = { id: string; start: number; end: number }

/** Xếp các nhóm vào ít hàng nhất có thể (nhóm không chồng thời gian dùng chung một hàng) */
function packRows(groups: TimeGroupSummary[]): TimeGroupSummary[][] {
  const rows: TimeGroupSummary[][] = []
  for (const g of groups) {
    const row = rows.find(r => r[r.length - 1].end <= g.start + 1e-3)
    if (row) row.push(g)
    else rows.push([g])
  }
  return rows
}

/**
 * Làn "Thời gian chung" dưới thước Workflow (giống work-area / linked clips của After Effects, Premiere):
 * mỗi Node Time là một thanh màu — kéo thân để dời cả nhóm, kéo 2 đầu để đổi khoảng, nhấp để chọn Node Time.
 * Mọi Layer, Logic và mốc lộ trình Camera nối vào nhóm ăn theo ngay, Timeline cập nhật đồng thời.
 */
export const WorkflowV2TimeLanes: React.FC<Props> = ({ project, duration, trackLeft, trackWidth, selectedNodeId, onSelectNode, onSetTime }) => {
  const groups = useMemo(() => listTimeGroups(project), [project])
  const rows = useMemo(() => packRows(groups), [groups])
  const multiIds = useWorkflowMultiSelect(s => s.ids)
  const [preview, setPreview] = useState<Preview | null>(null)
  const dragRef = useRef<{ moved: boolean } | null>(null)
  const safe = Math.max(1, duration)
  const pct = (t: number): number => Math.max(0, Math.min(100, (t / safe) * 100))

  const startDrag = (e: React.PointerEvent, g: TimeGroupSummary, mode: 'start' | 'end' | 'move'): void => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const initX = e.clientX
    const width = Math.max(60, trackWidth)
    dragRef.current = { moved: false }
    let latest: Preview | null = null
    const onMove = (ev: PointerEvent): void => {
      if (Math.abs(ev.clientX - initX) < 3 && !dragRef.current?.moved) return
      dragRef.current = { moved: true }
      const [s, en] = dragTimeRange(mode, g.start, g.end, ((ev.clientX - initX) / width) * safe, 0, safe)
      latest = { id: g.id, start: s, end: en }
      setPreview(latest)
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setPreview(null)
      if (latest && dragRef.current?.moved) {
        setTimeGroupRangeAction(g.id, latest.start, latest.end)
        if (mode !== 'move') onSetTime(mode === 'start' ? latest.start : latest.end)
      }
      dragRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const addGroup = (): void => {
    const wf = project.workflow
    const selected = wf?.nodes.find(n => n.id === selectedNodeId)
    const ids = multiIds.length ? multiIds : selected && acceptsSharedTime(selected) ? [selected.id] : []
    const created = createTimeGroupFrom(ids)
    if (created) onSelectNode(created)
  }

  return (
    <div className="wf-v2-time-lanes" data-mcp-region="workflow_time_lanes" onPointerDown={e => e.stopPropagation()}>
      <div className="wf-v2-time-lanes-head" style={{ width: trackLeft }}>
        <span className="wf-v2-time-lanes-title" title="Nhóm thời gian chung: sửa 1 lần, mọi Node nối vào ăn theo">
          <IconWfTimeGroup width={13} height={13} />
          <span className="wf-v2-time-lanes-label">Thời gian chung</span>
        </span>
        <button
          type="button"
          className="wf-v2-time-add-btn"
          onClick={addGroup}
          title={multiIds.length ? `Gom ${multiIds.length} Node đang chọn vào một nhóm Time mới` : 'Tạo nhóm Time mới (từ Node đang chọn nếu có)'}
        >
          + Time{multiIds.length ? ` (${multiIds.length})` : ''}
        </button>
      </div>
      <div className="wf-v2-time-lanes-rows" style={{ width: trackWidth }}>
        {rows.length === 0 && (
          <div className="wf-v2-time-lanes-empty">Chọn nhiều Node (Ctrl + nhấp / Shift + kéo khung) rồi bấm + Time để dùng chung một mốc thời gian</div>
        )}
        {rows.map((row, ri) => (
          <div key={ri} className="wf-v2-time-lane">
            {row.map((g) => {
              const live = preview?.id === g.id ? preview : g
              const active = selectedNodeId === g.id
              return (
                <div
                  key={g.id}
                  className={`wf-v2-time-bar${active ? ' active' : ''}${g.enabled ? '' : ' disabled'}${preview?.id === g.id ? ' dragging' : ''}`}
                  style={{ left: `${pct(live.start)}%`, width: `${Math.max(1.2, pct(live.end) - pct(live.start))}%`, ['--tg-c' as string]: g.color }}
                  onPointerDown={(e) => startDrag(e, g, 'move')}
                  onClick={() => onSelectNode(g.id)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={active}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectNode(g.id) } }}
                  title={`${g.title}\n${live.start.toFixed(2)}s → ${live.end.toFixed(2)}s · ${g.consumerIds.length} mục ăn theo\nKéo thân để dời cả nhóm · kéo 2 đầu để đổi khoảng`}
                >
                  <span className="wf-v2-time-bar-handle left" onPointerDown={(e) => startDrag(e, g, 'start')} />
                  <span className="wf-v2-time-bar-text">
                    <b>{timeGroupLabel(g)}</b>
                    <span className="wf-v2-time-bar-count">{g.consumerIds.length}</span>
                    {preview?.id === g.id && <span className="wf-v2-time-bar-live">{live.start.toFixed(1)}–{live.end.toFixed(1)}s</span>}
                  </span>
                  <span className="wf-v2-time-bar-handle right" onPointerDown={(e) => startDrag(e, g, 'end')} />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
