import { useEffect, useState } from 'react'
import type { LayerComposite } from './types'
import { registerLayerAssemblySession } from './layerAssemblyBridge'
import { LayerAssemblyInspector } from './LayerAssemblyInspector'
import { LayerAssemblySidebar } from './LayerAssemblySidebar'
import { useLayerWorkshop } from './useLayerWorkshop'
import { useWorkshopPlayback } from './useWorkshopPlayback'
import { useWorkshopSave } from './useWorkshopSave'
import { useWorkshopShortcuts } from './useWorkshopShortcuts'
import { WorkshopTools } from './WorkshopTools'
import { WorkshopHeader, type WorkshopPrimaryMode } from './WorkshopHeader'
import { WorkshopAnimationTimeline } from './WorkshopAnimationTimeline'
import { WorkshopWorkspace } from './WorkshopWorkspace'
import { LayerAssemblyCutterWorkspace } from './cutter/LayerAssemblyCutterWorkspace'
import { getStoredComposites } from './layerAssemblyStorage'
import '../../styles/layerAssembly.css'
import '../../styles/layerWorkshopTools.css'
import '../../styles/layerWorkshopRig.css'
import '../../styles/layerWorkshopPanels.css'
import '../../styles/layerWorkshopChrome.css'
import { WorkshopRightPanel, type WorkshopTab } from './WorkshopRightPanel'
import { ensureRigClips } from './workshopRig'
import { CreateLayerAssemblyModal } from './CreateLayerAssemblyModal'
import {
  DEFAULT_LAYER_WORKSHOP_COLUMN_PREFS,
  clampLeftSidebarWidth,
  clampRightPanelWidth,
  isDefaultLayerWorkshopColumnPrefs,
  loadLayerWorkshopColumnPrefs,
  resetLayerWorkshopColumnPrefs,
  saveLayerWorkshopColumnPrefs,
  type LayerWorkshopColumnPrefs
} from './layerAssemblyViewPrefs'

export type AssemblyWorkspaceView = '2d' | '3d' | 'split'
export interface LayerAssemblyDialogProps { initialComposite?: LayerComposite | null; onClose: () => void }

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

export function LayerAssemblyDialog({ initialComposite, onClose }: LayerAssemblyDialogProps) {
  const state = useLayerWorkshop(initialComposite)
  const { composite, setComposite, history, undo, redo, createNew } = state
  const activeRig = composite.rig ? ensureRigClips(composite.rig).rig : undefined
  const playback = useWorkshopPlayback(activeRig?.duration, activeRig?.loop)
  const [tab, setTab] = useState<WorkshopTab>('layers')
  const [boneId, selectBone] = useState<string | null>(null)
  const saving = useWorkshopSave(() => history.current, onClose, () => playback.time)
  const close = () => { if (!saving.busy) onClose() }
  const [view, setView] = useState<AssemblyWorkspaceView>('split')
  const [primaryMode, setPrimaryMode] = useState<WorkshopPrimaryMode>('assembly')
  const [showNewConfirm, setShowNewConfirm] = useState(false)
  const [isBrushActive, setIsBrushActive] = useState(false)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [colPrefs, setColPrefs] = useState<LayerWorkshopColumnPrefs>(() => loadLayerWorkshopColumnPrefs())
  const [draggingCol, setDraggingCol] = useState<'left' | 'right' | null>(null)

  const updateColPrefs = (patch: Partial<LayerWorkshopColumnPrefs>) => {
    setColPrefs((prev) => {
      const next = { ...prev, ...patch }
      saveLayerWorkshopColumnPrefs(next)
      return next
    })
  }

  const handleResetColumns = () => {
    setColPrefs(resetLayerWorkshopColumnPrefs())
  }

  const startLeftColResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = colPrefs.leftSidebarWidth
    setDraggingCol('left')
    const onMove = (ev: PointerEvent) => {
      const nextW = clampLeftSidebarWidth(startW + (ev.clientX - startX))
      updateColPrefs({ leftSidebarWidth: nextW })
    }
    const onUp = () => {
      setDraggingCol(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startRightColResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = colPrefs.rightPanelWidth
    setDraggingCol('right')
    const onMove = (ev: PointerEvent) => {
      const nextW = clampRightPanelWidth(startW - (ev.clientX - startX))
      updateColPrefs({ rightPanelWidth: nextW })
    }
    const onUp = () => {
      setDraggingCol(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Kiểm tra xem composite hiện tại có thay đổi chưa lưu hay không
  const hasUnsavedChanges = (): boolean => {
    if (!composite.layers.length) return false
    if (history.canUndo) return true
    const storedList = getStoredComposites()
    const match = storedList.find((c) => c.id === composite.id)
    if (!match) return true
    if (match.name !== composite.name) return true
    if (match.layers.length !== composite.layers.length) return true
    return JSON.stringify(match.layers) !== JSON.stringify(composite.layers)
  }

  const handleRequestNewModel = () => {
    if (hasUnsavedChanges()) {
      setShowNewConfirm(true)
    } else {
      setIsTemplateModalOpen(true)
    }
  }

  const handleSaveAndCreateNew = async () => {
    setShowNewConfirm(false)
    const success = await saving.saveWithoutClosing()
    if (success) {
      setIsTemplateModalOpen(true)
    }
  }

  const handleDiscardAndCreateNew = () => {
    setShowNewConfirm(false)
    setIsTemplateModalOpen(true)
  }

  const handleCancelNew = () => {
    setShowNewConfirm(false)
  }

  useWorkshopShortcuts(state, playback.toggle, close, {
    primaryMode,
    tab,
    boneId,
    selectBone,
    isErasing: isBrushActive && tab === 'layers'
  })
  useEffect(() => registerLayerAssemblySession({
    getPrimaryMode: () => primaryMode, setPrimaryMode,
    getComposite: () => history.current, setComposite,
    getSelectedLayerId: () => state.selectedLayerId, setSelectedLayerId: state.select,
    getSelectedLayerIds: () => state.selection, setSelectedLayerIds: state.setIds,
    getIsPlaying: () => playback.isPlaying, setIsPlaying: playback.setIsPlaying,
    getTime: () => playback.time, setTime: playback.setTime,
    getTab: () => tab, setTab, getSelectedBoneId: () => boneId, setSelectedBoneId: selectBone,
    undo, redo, canUndo: () => history.canUndo, canRedo: () => history.canRedo,
    save: saving.save, insertToScene: saving.insert, close
  }), [composite, state.selection.join(','), playback.isPlaying, playback.time, saving.busy, onClose, tab, boneId, primaryMode])
  return <div className="layer-workshop-overlay">
    <div className="layer-workshop-dialog" role="dialog" aria-modal="true" aria-label="Xưởng Lắp Ráp Layer" onPointerDownCapture={() => history.begin()}>
      <WorkshopHeader composite={composite} setComposite={setComposite} primaryMode={primaryMode} setPrimaryMode={setPrimaryMode} view={view} setView={setView}
        busy={saving.busy} save={() => void saving.save()} insert={() => void saving.insert()} close={close}
        onNewModel={handleRequestNewModel}
        hasCustomColumns={!isDefaultLayerWorkshopColumnPrefs(colPrefs)}
        onResetColumns={handleResetColumns} />
      {primaryMode === 'assembly' ? (
        <>
          <WorkshopTools
            count={state.selection.length}
            total={composite.layers.length}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            undo={undo}
            redo={redo}
            selectAll={() => state.setIds(composite.layers.map((l) => l.id))}
            clear={() => state.select(null)}
            run={state.run}
            composite={composite}
            setComposite={setComposite}
            estimate={() => state.run('estimate-frame', undefined, composite.layers.map((l) => l.id))}
          />
          {saving.error && <div className="lw-error" role="alert">{saving.error}</div>}
          <div className="layer-workshop-body">
            <LayerAssemblySidebar
              composite={composite}
              selectedLayerId={state.selectedLayerId}
              onSelectLayer={state.select}
              onAddLayerFromAsset={state.add}
              onAppendPresetLayers={state.append}
              onDeleteLayer={(id) => state.run('delete', undefined, [id])}
              onDuplicateLayer={(id) => state.run('duplicate', undefined, [id])}
              onLoadComposite={(loaded) => {
                setComposite(loaded)
                if (loaded.layers[0]) {
                  state.select(loaded.layers[0].id)
                }
              }}
              width={colPrefs.leftSidebarWidth}
            />
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Co dãn độ rộng cột Tài nguyên bên trái"
              className={`lw-col-splitter${draggingCol === 'left' ? ' active' : ''}`}
              onPointerDown={startLeftColResize}
              onDoubleClick={() => updateColPrefs({ leftSidebarWidth: DEFAULT_LAYER_WORKSHOP_COLUMN_PREFS.leftSidebarWidth })}
              title="Kéo trái/phải để co dãn cột Tài nguyên (Nháy đúp để về 260px)"
            >
              <span className="lw-col-splitter-grip" />
            </div>
            <div className="lw-workspace-column">
              <WorkshopWorkspace
                state={state}
                playback={playback}
                view={view}
                tab={tab}
                onSelectTab={setTab}
                boneId={boneId}
                selectBone={selectBone}
                onBrushModeChange={setIsBrushActive}
                centerSplitRatio={colPrefs.centerSplitRatio}
                onChangeCenterSplitRatio={(r) => updateColPrefs({ centerSplitRatio: r })}
                onResetCenterSplitRatio={() => updateColPrefs({ centerSplitRatio: DEFAULT_LAYER_WORKSHOP_COLUMN_PREFS.centerSplitRatio })}
              />
              {tab === 'animation' && <WorkshopAnimationTimeline state={state} playback={playback} boneId={boneId} selectBone={selectBone} />}
            </div>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Co dãn độ rộng cột Công cụ bên phải"
              className={`lw-col-splitter${draggingCol === 'right' ? ' active' : ''}`}
              onPointerDown={startRightColResize}
              onDoubleClick={() => updateColPrefs({ rightPanelWidth: DEFAULT_LAYER_WORKSHOP_COLUMN_PREFS.rightPanelWidth })}
              title="Kéo trái/phải để co dãn cột Công cụ bên phải (Nháy đúp để về 330px)"
            >
              <span className="lw-col-splitter-grip" />
            </div>
            <WorkshopRightPanel state={state} playback={playback} tab={tab} setTab={setTab} boneId={boneId} selectBone={selectBone} width={colPrefs.rightPanelWidth}>
            <LayerAssemblyInspector composite={composite} setComposite={setComposite} selectedLayerId={state.selectedLayerId} selectedIds={state.selection}
              onSelectLayer={state.select} onSetIds={state.setIds} onUpdateLayer={state.update} onMoveLayer={state.moveLayer}
              onAddLayer={() => state.add(`Lớp ${composite.layers.length + 1}`, '')}
              onDeleteLayer={(id) => state.run('delete', undefined, [id])} onDuplicateLayer={(id) => state.run('duplicate', undefined, [id])}
              onMoveLayerOrder={state.move} onBatchAction={state.run}
              onAllAction={(action) => state.run(action, undefined, composite.layers.map((l) => l.id))} />
            </WorkshopRightPanel>
          </div>
        </>
      ) : (
        <div className="layer-workshop-body">
          <LayerAssemblyCutterWorkspace state={state} />
        </div>
      )}
      <footer className="lw-status"><span>{composite.layers.length} lớp · {state.selection.length} đã chọn · {composite.layers.filter((l) => l.locked).length} khóa</span>
        <span>Ctrl+Z hoàn tác · Ctrl+D nhân bản · Mũi tên: dời 2D · Phím +/-: độ sâu Z · Space xem chuyển động</span></footer>
    </div>
    {showNewConfirm && (
      <div className="lw-confirm-backdrop" onClick={handleCancelNew}>
        <div className="lw-confirm-modal" role="dialog" aria-modal="true" aria-label="Lưu thay đổi trước khi tạo mẫu mới"
          data-mcp-region="layer_assembly_confirm" data-mcp-dialog onClick={(e) => e.stopPropagation()}>
          <div className="lw-confirm-title">
            <IconAlert />
            <span>Lưu thay đổi trước khi tạo mẫu mới?</span>
          </div>
          <div className="lw-confirm-desc">
            Mẫu layer &ldquo;<strong>{composite.name || 'Chưa đặt tên'}</strong>&rdquo; đang có các thay đổi chưa được lưu vào danh sách mẫu. Bạn có muốn lưu lại trước khi bắt đầu tạo mẫu mới không?
          </div>
          <div className="lw-confirm-actions">
            <button type="button" className="btn sm" onClick={handleCancelNew}>
              Hủy
            </button>
            <button
              type="button"
              className="btn sm lw-btn-discard-new"
              style={{ color: 'var(--text-dim)', border: '1px solid var(--line-soft)' }}
              onClick={handleDiscardAndCreateNew}
            >
              Không lưu
            </button>
            <button
              type="button"
              className="btn sm lw-btn-new-model"
              onClick={() => void handleSaveAndCreateNew()}
            >
              Lưu & Tạo mới
            </button>
          </div>
        </div>
      </div>
    )}

    <CreateLayerAssemblyModal
      isOpen={isTemplateModalOpen}
      onClose={() => setIsTemplateModalOpen(false)}
      onSelectTemplate={(comp) => {
        createNew(comp)
        setIsTemplateModalOpen(false)
      }}
      onSelectBlank={() => {
        createNew()
        setIsTemplateModalOpen(false)
      }}
    />
  </div>
}
