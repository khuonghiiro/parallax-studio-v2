import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import { toast } from '../../actions'
import { ensureProjectWorkflow, compileWorkflowBlueprint } from '../../project/workflowEngine'
import { listTimelineLogicNodes, removeTimelineLogicNode, toggleTimelineLogicNode } from '../../project/timelineLogic'
import { WORKFLOW_V2_LOGIC_CATEGORIES } from '../../project/workflowV2LogicPresets'
import { TimelineLogicPickerV2, toV2PickerCategory, type TimelinePickerCategory } from './TimelineLogicPickerV2'
import { WorkflowNodeDraftDialog } from '../workflow/WorkflowNodeDraftDialog'
import '../../styles/timelineLogic.css'

export function TimelineLogic() {
  const project = useEditor((s) => s.project)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)
  const selectedShotId = useEditor((s) => s.selectedShotId)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [initialCategory, setInitialCategory] = useState<TimelinePickerCategory>('all')
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)

  const workflow = useMemo(() => ensureProjectWorkflow(project), [project])
  const layer = project.layers.find((item) => item.id === selectedLayerId)
  const shotId = layer?.shotId || selectedShotId || 'all'
  const shot = project.shots.find((item) => item.id === shotId)

  const scopeKind = layer ? 'LAYER' : shot ? 'CẢNH' : 'DỰ ÁN'
  const targetName = layer ? layer.name : shot ? shot.name : 'Toàn dự án'

  const entries = useMemo(
    () => listTimelineLogicNodes(project, workflow, layer, shotId),
    [project, workflow, layer, shotId]
  )

  const editingNode = workflow.nodes.find((item) => item.id === editingNodeId) ?? null

  // Dải chip logic: lăn chuột dọc để cuộn ngang, hiện vệt mờ ở mép khi còn chip bị khuất
  const itemsRef = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState({ left: false, right: false })
  const updateOverflow = useCallback(() => {
    const el = itemsRef.current
    if (!el) return
    const left = el.scrollLeft > 2
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
    setOverflow((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
  }, [])
  useEffect(() => {
    const el = itemsRef.current
    if (!el) return
    updateOverflow()
    const ro = new ResizeObserver(updateOverflow)
    ro.observe(el)
    const onWheel = (e: WheelEvent): void => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      ro.disconnect()
      el.removeEventListener('wheel', onWheel)
    }
  }, [updateOverflow])
  useEffect(updateOverflow, [entries, updateOverflow])

  const openOrFocusLogicNode = (nodeId: string) => {
    const target = workflow.nodes.find((n) => n.id === nodeId)
    if (nodeId.startsWith('v2-') || Boolean(target?.params?.logicCategory)) {
      useView.getState().setTimelineTab('workflow')
      window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('pxs:select-workflow-v2-node', { detail: { nodeId } })
        )
      }, 30)
      return
    }
    setEditingNodeId(nodeId)
  }

  useEffect(() => {
    const onOpenPicker = (e: Event) => {
      const detail = (e as CustomEvent<{ layerId?: string; category?: string }>).detail
      if (detail?.layerId) {
        useEditor.getState().selectLayer(detail.layerId)
      }
      setInitialCategory(toV2PickerCategory(detail?.category))
      setPickerOpen(true)
    }
    const onOpenNode = (e: Event) => {
      const detail = (e as CustomEvent<{ nodeId?: string }>).detail
      if (detail?.nodeId) {
        if (detail.nodeId.startsWith('v2-')) {
          useView.getState().setTimelineTab('workflow')
          window.setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('pxs:select-workflow-v2-node', { detail: { nodeId: detail.nodeId } })
            )
          }, 30)
        } else {
          setEditingNodeId(detail.nodeId)
        }
      }
    }
    window.addEventListener('pxs:open-timeline-logic-picker', onOpenPicker)
    window.addEventListener('pxs:open-timeline-logic-node', onOpenNode)
    return () => {
      window.removeEventListener('pxs:open-timeline-logic-picker', onOpenPicker)
      window.removeEventListener('pxs:open-timeline-logic-node', onOpenNode)
    }
  }, [])

  const openPickerWithCategory = (cat: TimelinePickerCategory) => {
    if (layer?.locked) return
    setInitialCategory(cat)
    setPickerOpen(true)
  }

  return (
    <div className="tl-logic-strip" data-mcp-region="timeline_logic">
      <div className="tl-logic-target-pill" title={`Đích gắn logic hiện tại: ${scopeKind} · ${targetName}`}>
        <span className={`tl-logic-scope-tag scope-${layer ? 'layer' : shot ? 'shot' : 'project'}`}>
          {scopeKind}
        </span>
        <span className="tl-logic-target">{targetName}</span>
      </div>

      <button
        id="tl-add-logic"
        type="button"
        className="tl-logic-add-btn"
        disabled={Boolean(layer?.locked)}
        title={layer?.locked ? 'Mở khóa layer để thêm logic' : `Thêm Node Logic cho ${targetName}`}
        onClick={() => openPickerWithCategory('all')}
      >
        <span className="tl-logic-add-plus">+</span>
        <span>Thêm logic</span>
      </button>

      <div className="tl-logic-quick-cats" role="group" aria-label="Nhóm logic nhanh">
        {WORKFLOW_V2_LOGIC_CATEGORIES.slice(0, 5).map((cat) => (
          <button
            key={cat.id}
            type="button"
            className="tl-logic-cat-pill"
            disabled={Boolean(layer?.locked)}
            style={{ ['--logic-accent' as string]: cat.accent }}
            title={`Mở kho ${cat.label} cho ${targetName}`}
            onClick={() => openPickerWithCategory(cat.id)}
          >
            <span className="cat-ico">{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      <span className="tl-logic-divider" />

      <div
        ref={itemsRef}
        className={`tl-logic-items${overflow.left ? ' fade-left' : ''}${overflow.right ? ' fade-right' : ''}`}
        role="list"
        aria-label="Danh sách logic đang gắn"
        onScroll={updateOverflow}
      >
        {entries.map((entry) => (
          <div
            key={entry.node.id}
            role="listitem"
            className={`tl-logic-chip-wrap${entry.connected && entry.enabled ? ' active' : ''}${!entry.enabled ? ' is-disabled' : ''}`}
            style={{ ['--logic-accent' as string]: entry.categoryMeta.accent }}
          >
            <button
              type="button"
              className={`tl-logic-chip${entry.connected && entry.enabled ? ' active' : ''}`}
              data-logic-id={entry.node.id}
              title={`${entry.node.title} (${entry.categoryMeta.label}) · ${
                !entry.enabled
                  ? 'Đang tạm tắt'
                  : entry.connected
                    ? 'Đang hoạt động thông mạch'
                    : 'Chưa nối nguồn'
              } — Click để mở bảng cấu hình`}
              onClick={() => openOrFocusLogicNode(entry.node.id)}
            >
              <span
                className={`tl-logic-chip-dot${
                  !entry.enabled ? ' off' : entry.connected ? ' on' : ' warn'
                }`}
              />
              <span className="tl-logic-chip-ico">{entry.icon}</span>
              <span className="tl-logic-chip-title">{entry.shortTitle}</span>
            </button>
            <button
              type="button"
              className="tl-logic-chip-action"
              title={entry.enabled ? 'Tạm tắt logic này' : 'Bật lại logic này'}
              aria-label={entry.enabled ? `Tắt ${entry.shortTitle}` : `Bật ${entry.shortTitle}`}
              onClick={(e) => {
                e.stopPropagation()
                useEditor.getState().update((draft) => {
                  toggleTimelineLogicNode(draft, entry.node.id)
                })
              }}
            >
              {entry.enabled ? '●' : '○'}
            </button>
            <button
              type="button"
              className="tl-logic-chip-action remove"
              title="Gỡ logic này khỏi luồng"
              aria-label={`Xóa ${entry.shortTitle}`}
              onClick={(e) => {
                e.stopPropagation()
                useEditor.getState().update((draft) => {
                  removeTimelineLogicNode(draft, entry.node.id)
                })
              }}
            >
              ×
            </button>
          </div>
        ))}
        {entries.length === 0 && (
          <span className="tl-logic-empty">
            Chưa gắn node logic riêng · Chọn nhanh nhóm bên trái hoặc bấm <strong>+ Thêm logic</strong>
          </span>
        )}
      </div>

      <button
        type="button"
        className="tl-logic-wf-btn"
        title="Mở Sơ đồ Node-Port (Workflow Studio) để xem toàn bộ dây nối"
        onClick={() => useView.getState().setTimelineTab('workflow')}
      >
        <span>Sơ đồ Node</span>
        <span className="tl-logic-wf-count">{entries.length}</span>
      </button>

      {pickerOpen && (
        <TimelineLogicPickerV2
          layer={layer}
          targetName={targetName}
          scopeKind={scopeKind}
          initialCategory={initialCategory}
          onClose={() => setPickerOpen(false)}
          onAdded={openOrFocusLogicNode}
        />
      )}

      {editingNode && (
        <WorkflowNodeDraftDialog
          key={editingNode.id}
          node={editingNode}
          project={project}
          workflow={workflow}
          blueprint={compileWorkflowBlueprint(workflow, project)}
          onClose={() => setEditingNodeId(null)}
          onChangeNodePreset={() => {}}
          onUpdateNodeDirective={() => {}}
          onUpdateNodeParams={() => {}}
          onToggleNode={() => {}}
          onShowToast={toast}
          activeShotLabel={targetName}
        />
      )}
    </div>
  )
}
