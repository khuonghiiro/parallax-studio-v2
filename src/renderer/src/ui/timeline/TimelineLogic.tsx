import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import { toast } from '../../actions'
import { addTimelineLogic } from '../../project/timelineLogic'
import { ensureProjectWorkflow, compileWorkflowBlueprint, resolveConnectedWorkflowNodes, resolveNodeTargetBinding } from '../../project/workflowEngine'
import { WORKFLOW_LOGIC_NODE_CATALOG } from '../../project/workflowLogicNodes'
import { WorkflowNodeDraftDialog } from '../workflow/WorkflowNodeDraftDialog'
import '../../styles/timelineLogic.css'

export function TimelineLogic() {
  const project = useEditor((s) => s.project)
  const layerId = useEditor((s) => s.selectedLayerId)
  const shotId = useEditor((s) => s.selectedShotId)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const layer = project.layers.find((item) => item.id === layerId)
  const scope = layer?.shotId || shotId || 'all'
  const label = layer?.name ?? project.shots.find((item) => item.id === scope)?.name ?? 'Toàn dự án'
  const workflow = useMemo(() => ensureProjectWorkflow(project), [project])
  const nodes = workflow.nodes.filter((node) => node.params?.logicId && (layer
    ? resolveNodeTargetBinding(node, project, workflow).matchesLayer(layer)
    : scope === 'all' || node.params.shotId === 'all' || node.params.shotId === scope))
  const active = new Set(resolveConnectedWorkflowNodes(workflow).activeNodes.map((node) => node.id))
  const node = workflow.nodes.find((item) => item.id === editing)
  const add = (logicId: string) => {
    try {
      let id = ''
      useEditor.getState().update((draft) => { id = addTimelineLogic(draft, logicId, layer?.id, scope) })
      setAdding(false)
      setEditing(id)
    } catch (error) { toast(String(error)) }
  }
  return <>
    <div className="tl-logic-strip" data-mcp-region="timeline_logic">
      <strong>Logic</strong><span className="tl-logic-target" title={label}>{label}</span>
      <button id="tl-add-logic" className="btn sm" disabled={!!layer?.locked} onClick={() => setAdding(true)}>+ Thêm logic</button>
      <div className="tl-logic-items">
        {nodes.map((item) => <button key={item.id} data-logic-id={item.id} className={`tl-logic-chip${active.has(item.id) ? ' active' : ''}`}
          title={`${item.enabled ? active.has(item.id) ? 'Đang hoạt động' : 'Chưa nối nguồn' : 'Đã tắt'} · Bấm để cấu hình`}
          onClick={() => setEditing(item.id)}>{item.title}</button>)}
        {!nodes.length && <span className="tl-logic-empty">Chọn layer hoặc cảnh → thêm chuyển động, ánh sáng, camera…</span>}
      </div>
      <button className="btn ghost sm" onClick={() => {
        if (layer?.shotId) useEditor.getState().selectShot(layer.shotId)
        useView.getState().setTimelineTab('workflow')
        requestAnimationFrame(() => requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('pxs:wf-fit-view'))))
      }}>Xem sơ đồ ↗</button>
    </div>
    {adding && <TimelineLogicPicker label={label} query={query} setQuery={setQuery}
      onClose={() => setAdding(false)} onAdd={add} />}
    {node && <WorkflowNodeDraftDialog key={node.id} node={node} project={project} workflow={workflow}
      blueprint={compileWorkflowBlueprint(workflow, project)} onClose={() => setEditing(null)}
      onChangeNodePreset={() => {}} onUpdateNodeDirective={() => {}} onUpdateNodeParams={() => {}}
      onToggleNode={() => {}} onShowToast={toast} activeShotLabel={label} />}
  </>
}

function TimelineLogicPicker({ label, query, setQuery, onClose, onAdd }: {
  label: string; query: string; setQuery: (value: string) => void; onClose: () => void; onAdd: (id: string) => void
}) {
  const choices = WORKFLOW_LOGIC_NODE_CATALOG.filter((item) =>
    `${item.title} ${item.categoryLabel} ${item.description}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')))
  return createPortal(<div className="tl-logic-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="tl-logic-picker" data-mcp-dialog data-mcp-region="timeline_logic_picker" role="dialog" aria-modal="true" aria-label="Thêm logic"
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Escape') onClose()
          if (event.key === 'Tab') {
            const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input'))
            const first = controls[0], last = controls[controls.length - 1]
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
          }
        }}>
        <header><div><strong>Thêm logic</strong><p>Áp dụng cho {label} · Tự nối node trong Workflow</p></div>
          <button className="btn ghost" onClick={() => onClose()} aria-label="Đóng">×</button></header>
        <input autoFocus placeholder="Tìm chuyển động, ánh sáng, camera…" aria-label="Tìm logic" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="tl-logic-catalog">{choices.map((item) => <button key={item.id} data-add-logic={item.id} onClick={() => onAdd(item.id)}>
          <small>{item.categoryLabel}</small><strong>{item.icon} {item.title}</strong><span>{item.description}</span>
        </button>)}{!choices.length && <p>Không có logic phù hợp. Thử từ khóa khác.</p>}</div>
      </section>
    </div>, document.body)
}
