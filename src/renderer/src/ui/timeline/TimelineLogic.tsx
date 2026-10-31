import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [menuOpen, setMenuOpen] = useState(false)
  const menuAnchorRef = useRef<HTMLDivElement>(null)
  const menuPopupRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })

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

  // Định vị dropdown menu
  useLayoutEffect(() => {
    if (!menuOpen || !menuAnchorRef.current) return
    const rect = menuAnchorRef.current.getBoundingClientRect()
    const width = 290
    const approxH = Math.min(360, entries.length * 36 + 80)
    const spaceBelow = window.innerHeight - rect.bottom
    const flipUp = spaceBelow < approxH && rect.top > approxH
    const top = flipUp ? rect.top - approxH - 4 : rect.bottom + 4
    let left = rect.left
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8)
    }
    setDropdownPos({ top, left })
  }, [menuOpen, entries.length])

  // Đóng khi click ngoài hoặc nhấn Escape
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (
        !menuAnchorRef.current?.contains(e.target as Node) &&
        !menuPopupRef.current?.contains(e.target as Node)
      ) {
        setMenuOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const openOrFocusLogicNode = (nodeId: string) => {
    const target = workflow.nodes.find((n) => n.id === nodeId)
    if (nodeId.startsWith('v2-') || Boolean(target?.params?.logicCategory)) {
      useEditor.getState().setInspectorTab('node')
      useEditor.getState().setSelectedWorkflowNodeId(nodeId)
      const v = useView.getState()
      v.setRightCollapsed(false)
      const eff = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-remote-effective') : null
      const isMobileOrTablet = eff === 'phone' || eff === 'tablet' || (typeof window !== 'undefined' && window.innerWidth <= 1120 && eff !== 'desktop')
      if (isMobileOrTablet) {
        v.setMobileTab('right')
        v.setTabletTab('right')
      }
      window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('pxs:select-workflow-v2-node', { detail: { nodeId, openInspector: true } })
        )
      }, 20)
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
          useEditor.getState().setInspectorTab('node')
          useEditor.getState().setSelectedWorkflowNodeId(detail.nodeId)
          window.setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('pxs:select-workflow-v2-node', { detail: { nodeId: detail.nodeId, openInspector: true } })
            )
          }, 20)
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

      {entries.length > 0 ? (
        <div className="tl-logic-menu-wrap" ref={menuAnchorRef}>
          <button
            type="button"
            className={`tl-logic-menu-trigger${menuOpen ? ' open' : ''}${entries.some((e) => e.enabled && e.connected) ? ' has-active' : ''}`}
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            title={`Xem ${entries.length} node logic đang gắn cho ${targetName}`}
          >
            <span className="tl-logic-menu-dot" />
            <span className="tl-logic-menu-label">
              Logic đang gắn <strong>({entries.length})</strong>
            </span>
            <span className="tl-logic-menu-arrow">▾</span>
          </button>

          {menuOpen &&
            createPortal(
              <div
                ref={menuPopupRef}
                className="tl-logic-dropdown"
                style={{
                  position: 'fixed',
                  top: `${dropdownPos.top}px`,
                  left: `${dropdownPos.left}px`,
                  zIndex: 70000
                }}
              >
                <div className="tl-logic-dropdown-head">
                  <span className="tl-logic-dropdown-title">
                    Logic đang gắn · {targetName} ({entries.length})
                  </span>
                  <button
                    type="button"
                    className="tl-logic-dropdown-close"
                    onClick={() => setMenuOpen(false)}
                    title="Đóng menu"
                  >
                    ×
                  </button>
                </div>
                <div className="tl-logic-dropdown-list">
                  {entries.map((entry) => (
                    <div
                      key={entry.node.id}
                      className={`tl-logic-dropdown-item${entry.connected && entry.enabled ? ' active' : ''}${!entry.enabled ? ' is-disabled' : ''}`}
                      style={{ ['--logic-accent' as string]: entry.categoryMeta.accent }}
                    >
                      <button
                        type="button"
                        className="tl-logic-dropdown-item-main"
                        title={`${entry.node.title} (${entry.categoryMeta.label}) — Click để mở bảng cấu hình`}
                        onClick={() => {
                          setMenuOpen(false)
                          openOrFocusLogicNode(entry.node.id)
                        }}
                      >
                        <span
                          className={`tl-logic-chip-dot${
                            !entry.enabled ? ' off' : entry.connected ? ' on' : ' warn'
                          }`}
                        />
                        <span className="tl-logic-chip-ico">{entry.icon}</span>
                        <span className="tl-logic-dropdown-item-name">{entry.shortTitle}</span>
                        <span
                          className="tl-logic-dropdown-item-cat"
                          style={{ color: entry.categoryMeta.accent }}
                        >
                          {entry.categoryMeta.label}
                        </span>
                      </button>
                      <div className="tl-logic-dropdown-item-actions">
                        <button
                          type="button"
                          className="tl-logic-item-toggle-btn"
                          title={entry.enabled ? 'Tạm tắt logic này' : 'Bật lại logic này'}
                          onClick={(e) => {
                            e.stopPropagation()
                            useEditor.getState().update((draft) => {
                              toggleTimelineLogicNode(draft, entry.node.id)
                            })
                          }}
                        >
                          {entry.enabled ? '● Bật' : '○ Tắt'}
                        </button>
                        <button
                          type="button"
                          className="tl-logic-item-del-btn"
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
                    </div>
                  ))}
                </div>
                <div className="tl-logic-dropdown-foot">
                  <button
                    type="button"
                    className="tl-logic-dropdown-add"
                    onClick={() => {
                      setMenuOpen(false)
                      openPickerWithCategory('all')
                    }}
                  >
                    + Thêm logic mới...
                  </button>
                </div>
              </div>,
              document.body
            )}
        </div>
      ) : (
        <span className="tl-logic-empty">Chưa gắn logic riêng</span>
      )}

      <div style={{ flex: 1 }} />

      <button
        type="button"
        className="tl-logic-wf-btn"
        title="Mở bảng Thuộc tính Node ở cột bên phải để cấu hình logic ngay trên Timeline"
        onClick={() => useEditor.getState().setInspectorTab('node')}
      >
        <span>🎛️ Thuộc tính Node</span>
      </button>

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
