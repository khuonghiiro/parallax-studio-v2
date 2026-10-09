import type { useLayerWorkshop } from './useLayerWorkshop'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import type { AssemblyWorkspaceView } from './LayerAssemblyDialog'
import { LayerAssemblyViewport } from './LayerAssemblyViewport'
import { LayerAssembly3DViewport } from './LayerAssembly3DViewport'
import { LayerAssemblyTransportBar } from './LayerAssemblyTransportBar'
import { IconCube, IconImage } from '../icons'

export function WorkshopWorkspace({ state, playback, view }: {
  state: ReturnType<typeof useLayerWorkshop>; playback: ReturnType<typeof useWorkshopPlayback>; view: AssemblyWorkspaceView
}) {
  const props = { composite: state.composite, selectedLayerId: state.selectedLayerId,
    selectedIds: state.selection, onSelectLayer: state.select, onUpdateLayer: state.update, time: playback.time }
  return <div className="layer-workshop-center-area">
    <div className="layer-workshop-split-container">
      {view !== '3d' && <div className="layer-workshop-split-pane left-pane">
        <div className="pane-header-tab"><span className="pane-title"><IconImage width={13} height={13} /> Bố cục 2D</span><span>Di chuyển & căn chỉnh</span></div>
        <LayerAssemblyViewport {...props} isPlaying={playback.isPlaying} onTogglePlay={playback.toggle} onSeekTime={playback.setTime} hideTransport />
      </div>}
      {view !== '2d' && <div className="layer-workshop-split-pane">
        <div className="pane-header-tab"><span className="pane-title"><IconCube width={13} height={13} /> Chiều sâu 3D</span><span>Xoay để kiểm tra lớp</span></div>
        <LayerAssembly3DViewport {...props} onChangeComposite={state.setComposite} />
      </div>}
      <LayerAssemblyTransportBar isPlaying={playback.isPlaying} onTogglePlay={playback.toggle} time={playback.time} onSeekTime={playback.setTime} />
    </div>
  </div>
}
