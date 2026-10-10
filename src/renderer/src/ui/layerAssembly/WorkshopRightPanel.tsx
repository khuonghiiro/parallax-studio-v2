import { useState, type ReactNode } from 'react'
import type { useLayerWorkshop } from './useLayerWorkshop'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import { WorkshopRigPanel } from './WorkshopRigPanel'
import { WorkshopAnimationPanel } from './WorkshopAnimationPanel'
import { applyRigAction, type RigAction } from './workshopRig'

export type WorkshopTab = 'layers' | 'bones' | 'animation'
export function WorkshopRightPanel({ state, playback, tab, setTab, boneId, selectBone, children }: {
  state: ReturnType<typeof useLayerWorkshop>; playback: ReturnType<typeof useWorkshopPlayback>
  tab: WorkshopTab; setTab: (tab: WorkshopTab) => void; boneId: string | null
  selectBone: (id: string | null) => void; children: ReactNode
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
  return <aside className="lw-right-column">
    <div className="lw-right-tabs" role="tablist" aria-label="Công cụ lắp ráp">
      {([['layers', 'Layer'], ['bones', 'Tạo xương'], ['animation', 'Animation']] as const).map(([id, title]) =>
        <button key={id} role="tab" id={`lw-tab-${id}`} aria-controls={`lw-panel-${id}`} aria-selected={tab === id}
          onClick={() => { setTab(id); setError(''); playback.setIsPlaying(false); playback.setTime(0) }}>{title}</button>)}
    </div>
    {error && <div className="lw-error" role="alert">{error}</div>}
    <div className="lw-right-content" role="tabpanel" id={`lw-panel-${tab}`} aria-labelledby={`lw-tab-${tab}`}>
      {tab === 'layers' ? children : tab === 'bones' ? <WorkshopRigPanel {...props} /> : <WorkshopAnimationPanel {...props} playback={playback} />}
    </div>
  </aside>
}
