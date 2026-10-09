import type { useLayerWorkshop } from './useLayerWorkshop'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import type { AssemblyWorkspaceView } from './LayerAssemblyDialog'
import { LayerAssemblyViewport } from './LayerAssemblyViewport'
import { LayerAssembly3DViewport } from './LayerAssembly3DViewport'
import { LayerAssemblyTransportBar } from './LayerAssemblyTransportBar'
import { IconCube, IconImage } from '../icons'
import { evaluateRig, transformRigLayer } from '../../engine/layerRig'
import type { WorkshopTab } from './WorkshopRightPanel'

export function WorkshopWorkspace({ state, playback, view, tab, boneId, selectBone }: {
  state: ReturnType<typeof useLayerWorkshop>; playback: ReturnType<typeof useWorkshopPlayback>; view: AssemblyWorkspaceView
  tab: WorkshopTab; boneId: string | null; selectBone: (id: string | null) => void
}) {
  const animated = tab === 'animation' && state.composite.rig
  const transforms = animated ? evaluateRig(animated, playback.time) : undefined
  const composite = transforms ? { ...state.composite, layers: state.composite.layers.map((l) => ({ ...transformRigLayer(l, transforms), locked: true })) } : state.composite
  const props = {
    composite,
    selectedLayerId: state.selectedLayerId,
    selectedIds: state.selection,
    onSelectLayer: state.select,
    onUpdateLayer: tab === 'animation' ? () => {} : state.update,
    onAddLayerFromAsset: state.add,
    onAppendPresetLayers: state.append,
    time: playback.time
  }
  return <div className="layer-workshop-center-area">
    <div className="layer-workshop-split-container">
      {view !== '3d' && <div className="layer-workshop-split-pane left-pane">
        <div className="pane-header-tab"><span className="pane-title"><IconImage width={13} height={13} /> Bố cục 2D</span><span>Di chuyển & căn chỉnh</span></div>
        <LayerAssemblyViewport {...props} boneOverlay={tab === 'layers' ? undefined : { composite: state.composite, boneId, selectBone, setComposite: state.setComposite, time: playback.time, editing: tab === 'bones' }} onChangeComposite={state.setComposite} isPlaying={playback.isPlaying} onTogglePlay={playback.toggle} onSeekTime={playback.setTime} hideTransport />
      </div>}
      {view !== '2d' && <div className="layer-workshop-split-pane">
        <div className="pane-header-tab"><span className="pane-title"><IconCube width={13} height={13} /> Chiều sâu 3D</span><span>Xoay để kiểm tra lớp</span></div>
        <LayerAssembly3DViewport {...props} onChangeComposite={state.setComposite} />
      </div>}
      <LayerAssemblyTransportBar duration={state.composite.rig?.duration} isPlaying={playback.isPlaying} onTogglePlay={playback.toggle} time={playback.time} onSeekTime={playback.setTime} />
    </div>
  </div>
}
