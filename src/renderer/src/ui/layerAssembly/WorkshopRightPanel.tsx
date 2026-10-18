import { useState, type ReactNode } from 'react'
import type { useLayerWorkshop } from './useLayerWorkshop'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import { WorkshopRigPanel } from './WorkshopRigPanel'
import { WorkshopAnimationPanel } from './WorkshopAnimationPanel'
import { WorkshopPlantPanel } from './WorkshopPlantPanel'
import { applyRigAction, type RigAction } from './workshopRig'

export type WorkshopTab = 'layers' | 'bones' | 'animation' | 'plant'
export function WorkshopRightPanel({ state, playback, tab, setTab, boneId, selectBone, width = 330, children }: {
  state: ReturnType<typeof useLayerWorkshop>; playback: ReturnType<typeof useWorkshopPlayback>
  tab: WorkshopTab; setTab: (tab: WorkshopTab) => void; boneId: string | null
  selectBone: (id: string | null) => void; width?: number; children: ReactNode
}) {
  const [error, setError] = useState('')
  const run = (action: RigAction) => {
    try { state.setComposite((c) => applyRigAction(c, action)); setError('') }
    catch (err) { setError(err instanceof Error ? err.message : String(err)) }
  }
  const props = {
    composite: state.composite,
    selectedIds: state.selection,
    selectedLayerId: state.selectedLayerId,
    selectLayer: state.select,
    boneId,
    selectBone,
    run
  }
  return <aside className="lw-right-column" style={{ width: `${width}px`, minWidth: '250px' }}>
    <div className="lw-right-tabs" role="tablist" aria-label="Công cụ lắp ráp">
      {([['layers', 'Layer'], ['bones', 'Tạo xương'], ['animation', 'Animation'], ['plant', 'Thực vật']] as const).map(([id, title]) =>
        <button key={id} role="tab" id={`lw-tab-${id}`} aria-controls={`lw-panel-${id}`} aria-selected={tab === id}
          onClick={() => { setTab(id); setError(''); playback.setIsPlaying(false); playback.setTime(0) }}>{title}</button>)}
    </div>
    {error && <div className="lw-error" role="alert">{error}</div>}
    <div className="lw-right-content" role="tabpanel" id={`lw-panel-${tab}`} aria-labelledby={`lw-tab-${tab}`}>
      {tab === 'layers' ? children
        : tab === 'bones' ? <WorkshopRigPanel {...props} />
        : tab === 'plant' ? (
          <WorkshopPlantPanel
            composite={state.composite}
            setComposite={state.setComposite}
            selectedIds={state.selection}
            isPlaying={playback.isPlaying}
            onTogglePlay={playback.toggle}
          />
        )
        : <WorkshopAnimationPanel {...props} playback={playback} setComposite={state.setComposite} />}
    </div>
  </aside>
}
