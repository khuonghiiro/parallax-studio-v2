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
import '../../styles/layerAssembly.css'
import '../../styles/layerWorkshopTools.css'

export type AssemblyWorkspaceView = '2d' | '3d' | 'split'
export interface LayerAssemblyDialogProps { initialComposite?: LayerComposite | null; onClose: () => void }

export function LayerAssemblyDialog({ initialComposite, onClose }: LayerAssemblyDialogProps) {
  const state = useLayerWorkshop(initialComposite)
  const { composite, setComposite, history, undo, redo } = state
  const playback = useWorkshopPlayback()
  const saving = useWorkshopSave(() => history.current, onClose)
  const close = () => { if (!saving.busy) onClose() }
  const [view, setView] = useState<AssemblyWorkspaceView>('split')
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
        busy={saving.busy} save={() => void saving.save()} insert={() => void saving.insert()} close={close} />
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
        <span>Ctrl+Z hoàn tác · Ctrl+D nhân bản · Space xem chuyển động</span></footer>
    </div>
  </div>
}
