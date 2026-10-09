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
import { WorkshopHeader } from './WorkshopHeader'
import { WorkshopWorkspace } from './WorkshopWorkspace'
import { getStoredComposites } from './layerAssemblyStorage'
import '../../styles/layerAssembly.css'
import '../../styles/layerWorkshopTools.css'

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
  const playback = useWorkshopPlayback()
  const saving = useWorkshopSave(() => history.current, onClose)
  const close = () => { if (!saving.busy) onClose() }
  const [view, setView] = useState<AssemblyWorkspaceView>('split')
  const [showNewConfirm, setShowNewConfirm] = useState(false)

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
      createNew()
    }
  }

  const handleSaveAndCreateNew = async () => {
    setShowNewConfirm(false)
    const success = await saving.saveWithoutClosing()
    if (success) {
      createNew()
    }
  }

  const handleDiscardAndCreateNew = () => {
    setShowNewConfirm(false)
    createNew()
  }

  const handleCancelNew = () => {
    setShowNewConfirm(false)
  }

  useWorkshopShortcuts(state, playback.toggle, close)
  useEffect(() => registerLayerAssemblySession({
    getComposite: () => history.current, setComposite,
    getSelectedLayerId: () => state.selectedLayerId, setSelectedLayerId: state.select,
    getSelectedLayerIds: () => state.selection, setSelectedLayerIds: state.setIds,
    getIsPlaying: () => playback.isPlaying, setIsPlaying: playback.setIsPlaying,
    getTime: () => playback.time, setTime: playback.setTime,
    undo, redo, canUndo: () => history.canUndo, canRedo: () => history.canRedo,
    save: saving.save, insertToScene: saving.insert, close
  }), [composite, state.selection.join(','), playback.isPlaying, playback.time, saving.busy, onClose])
  return <div className="layer-workshop-overlay">
    <div className="layer-workshop-dialog" role="dialog" aria-modal="true" aria-label="Xưởng Lắp Ráp Layer" onPointerDownCapture={() => history.begin()}>
      <WorkshopHeader composite={composite} setComposite={setComposite} view={view} setView={setView}
        busy={saving.busy} save={() => void saving.save()} insert={() => void saving.insert()} close={close}
        onNewModel={handleRequestNewModel} />
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
          onLoadComposite={(loaded) => {
            setComposite(loaded)
            if (loaded.layers[0]) {
              state.select(loaded.layers[0].id)
            }
          }}
        />
        <div className="lw-workspace-column">
          <WorkshopWorkspace state={state} playback={playback} view={view} />
        </div>
        <LayerAssemblyInspector composite={composite} selectedLayerId={state.selectedLayerId} selectedIds={state.selection}
          onSelectLayer={state.select} onUpdateLayer={state.update} onAddLayer={() => state.add(`Lớp ${composite.layers.length + 1}`, '')}
          onDeleteLayer={(id) => state.run('delete', undefined, [id])} onDuplicateLayer={(id) => state.run('duplicate', undefined, [id])}
          onMoveLayerOrder={state.move} onBatchAction={state.run}
          onAllAction={(action) => state.run(action, undefined, composite.layers.map((l) => l.id))} />
      </div>
      <footer className="lw-status"><span>{composite.layers.length} lớp · {state.selection.length} đã chọn · {composite.layers.filter((l) => l.locked).length} khóa</span>
        <span>Ctrl+Z hoàn tác · Ctrl+D nhân bản · Mũi tên: dời 2D · Phím +/-: độ sâu Z · Space xem chuyển động</span></footer>
    </div>
    {showNewConfirm && (
      <div className="lw-confirm-backdrop" onClick={handleCancelNew}>
        <div className="lw-confirm-modal" onClick={(e) => e.stopPropagation()}>
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
              className="btn sm"
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
  </div>
}
