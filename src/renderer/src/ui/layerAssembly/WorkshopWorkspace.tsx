import { useState, useCallback, useEffect } from 'react'
import type { useLayerWorkshop } from './useLayerWorkshop'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import type { AssemblyWorkspaceView } from './LayerAssemblyDialog'
import { LayerAssemblyViewport } from './LayerAssemblyViewport'
import { LayerAssembly3DViewport } from './LayerAssembly3DViewport'
import { LayerAssemblyTransportBar } from './LayerAssemblyTransportBar'
import { IconCube, IconImage } from '../icons'
import { evaluateRig, transformRigLayer } from '../../engine/layerRig'
import type { WorkshopTab } from './WorkshopRightPanel'
import { loadLayerWorkshopViewPrefs, saveLayerWorkshopViewPrefs } from './layerAssemblyViewPrefs'

export function WorkshopWorkspace({ state, playback, view, tab, boneId, selectBone }: {
  state: ReturnType<typeof useLayerWorkshop>; playback: ReturnType<typeof useWorkshopPlayback>; view: AssemblyWorkspaceView
  tab: WorkshopTab; boneId: string | null; selectBone: (id: string | null) => void
}) {
  const [showBones, setShowBones] = useState(() => loadLayerWorkshopViewPrefs().showBones)
  const [showMesh, setShowMesh] = useState(() => loadLayerWorkshopViewPrefs().showMesh)

  const toggleBones = useCallback(() => {
    setShowBones((v) => {
      const next = !v
      saveLayerWorkshopViewPrefs({ showBones: next })
      return next
    })
  }, [])

  const toggleMesh = useCallback(() => {
    setShowMesh((v) => {
      const next = !v
      saveLayerWorkshopViewPrefs({ showMesh: next })
      return next
    })
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return
      if (e.key === 'b' || e.key === 'B') {
        toggleBones()
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMesh()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [toggleBones, toggleMesh])

  const rig = state.composite.rig
  const animated = (tab === 'animation' || playback.isPlaying || playback.time > 0) && rig
  const transforms = animated ? evaluateRig(animated, playback.time) : undefined
  const composite = {
    ...state.composite,
    layers: state.composite.layers.map((l) => {
      const bindPose = { x: l.x, y: l.y, rotation: l.rotation }
      const transformed = transforms ? transformRigLayer(l, transforms) : l
      return {
        ...transformed,
        ...(rig ? { previewRig: rig, bindPose } : {}),
        locked: l.locked
      }
    })
  }
  const props = {
    composite,
    selectedLayerId: state.selectedLayerId,
    selectedIds: state.selection,
    onSelectLayer: state.select,
    onUpdateLayer: state.update,
    onAddLayerFromAsset: state.add,
    onAppendPresetLayers: state.append,
    time: playback.time
  }
  return <div className="layer-workshop-center-area">
    <div className="layer-workshop-split-container">
      {view !== '3d' && <div className="layer-workshop-split-pane left-pane">
        <div className="pane-header-tab"><span className="pane-title"><IconImage width={13} height={13} /> Bố cục 2D</span><span>Di chuyển & căn chỉnh</span></div>
        <LayerAssemblyViewport
          {...props}
          showBones={showBones}
          onToggleShowBones={toggleBones}
          showMesh={showMesh}
          onToggleShowMesh={toggleMesh}
          boneOverlay={tab === 'layers' ? undefined : { composite: state.composite, boneId, selectBone, setComposite: state.setComposite, time: playback.time, editing: tab === 'bones' }}
          onChangeComposite={state.setComposite}
          isPlaying={playback.isPlaying}
          onTogglePlay={playback.toggle}
          onSeekTime={playback.setTime}
          hideTransport
        />
      </div>}
      {view !== '2d' && <div className="layer-workshop-split-pane">
        <div className="pane-header-tab"><span className="pane-title"><IconCube width={13} height={13} /> Chiều sâu 3D</span><span>Xoay để kiểm tra lớp</span></div>
        <LayerAssembly3DViewport
          {...props}
          showBones={showBones}
          onToggleShowBones={toggleBones}
          showMesh={showMesh}
          onToggleShowMesh={toggleMesh}
          onChangeComposite={state.setComposite}
        />
      </div>}
      <LayerAssemblyTransportBar duration={state.composite.rig?.duration} isPlaying={playback.isPlaying} onTogglePlay={playback.toggle} time={playback.time} onSeekTime={playback.setTime} />
    </div>
  </div>
}
