import { useState, useCallback, useEffect } from 'react'
import type { useLayerWorkshop } from './useLayerWorkshop'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import type { AssemblyWorkspaceView } from './LayerAssemblyDialog'
import { LayerAssemblyViewport } from './LayerAssemblyViewport'
import { LayerAssembly3DViewport } from './LayerAssembly3DViewport'
import { LayerAssemblyTransportBar } from './LayerAssemblyTransportBar'
import { IconCube, IconImage } from '../icons'
import { evaluateRig, transformRigLayer } from '../../engine/layerRig'
import { ensureRigClips } from './workshopRig'
import type { WorkshopTab } from './WorkshopRightPanel'
import { loadLayerWorkshopViewPrefs, saveLayerWorkshopViewPrefs } from './layerAssemblyViewPrefs'
import type { BrushPreview } from './useLayerBrushEraser'

export function WorkshopWorkspace({ state, playback, view, tab, onSelectTab, boneId, selectBone, onBrushModeChange }: {
  state: ReturnType<typeof useLayerWorkshop>; playback: ReturnType<typeof useWorkshopPlayback>; view: AssemblyWorkspaceView
  tab: WorkshopTab; onSelectTab?: (tab: WorkshopTab) => void; boneId: string | null; selectBone: (id: string | null) => void
  onBrushModeChange?: (active: boolean) => void
}) {
  const [showBones, setShowBones] = useState(() => loadLayerWorkshopViewPrefs().showBones)
  const [showMesh, setShowMesh] = useState(() => loadLayerWorkshopViewPrefs().showMesh)
  const [brushEditing, setBrushEditing] = useState(false)
  const [brushPreview, setBrushPreview] = useState<BrushPreview | null>(null)
  const brushMode = useCallback((editing: boolean) => {
    setBrushEditing(editing)
    onBrushModeChange?.(editing)
    if (editing) playback.setIsPlaying(false)
  }, [playback.setIsPlaying, onBrushModeChange])

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
    if ((tab === 'bones' || tab === 'animation') && !showBones) {
      setShowBones(true)
    }
  }, [tab, showBones])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return
      // Shift+B hoặc B (chỉ khi ở tab bones) để bật/tắt hiển thị xương
      if ((e.shiftKey && (e.key === 'b' || e.key === 'B')) || ((e.key === 'b' || e.key === 'B') && tab === 'bones')) {
        toggleBones()
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMesh()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [toggleBones, toggleMesh, tab])

  const normalizedRig = state.composite.rig ? ensureRigClips(state.composite.rig).rig : undefined
  const rig = normalizedRig
  const isErasing = brushEditing && tab === 'layers' && !playback.isPlaying
  const animated = !isErasing && (tab === 'animation' || playback.isPlaying || playback.time > 0) && rig
  const transforms = animated ? evaluateRig(animated, playback.time) : undefined
  const composite = {
    ...state.composite,
    rig: normalizedRig ?? state.composite.rig,
    layers: state.composite.layers.map((l) => {
      const bindPose = { x: l.x, y: l.y, rotation: l.rotation }
      const transformed = transforms ? transformRigLayer(l, transforms) : l
      return {
        ...transformed,
        ...(brushPreview?.id === l.id ? { imageUrl: brushPreview.imageUrl } : {}),
        ...(rig && !isErasing ? { previewRig: rig, bindPose } : {}),
        ...(isErasing ? { bindingMode: 'rigid' as const, motion: { ...l.motion, type: 'none' as const } } : {}),
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
    time: playback.time,
    tab,
    onSelectTab
  }
  return <div className="layer-workshop-center-area">
    <div className="layer-workshop-split-container">
      {view !== '3d' && <div className="layer-workshop-split-pane left-pane">
        <div className="pane-header-tab"><span className="pane-title"><IconImage width={13} height={13} /> Bố cục 2D</span><span>Di chuyển & căn chỉnh</span></div>
        <LayerAssemblyViewport
          {...props}
          onSelectTab={onSelectTab}
          brushSourceLayer={state.composite.layers.find((l) => l.id === state.selectedLayerId) ?? null}
          onBrushPreview={setBrushPreview}
          onBrushModeChange={brushMode}
          showBones={showBones}
          onToggleShowBones={toggleBones}
          showMesh={showMesh}
          onToggleShowMesh={toggleMesh}
          boneOverlay={isErasing ? undefined : { composite: { ...state.composite, rig: normalizedRig ?? state.composite.rig }, boneId, selectBone, setComposite: state.setComposite, time: playback.time, editing: tab === 'bones' }}
          onChangeComposite={state.setComposite}
          isPlaying={playback.isPlaying}
          onTogglePlay={playback.toggle}
          onSeekTime={playback.setTime}
          hideTransport
          view={view}
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
      {!isErasing && (
        <LayerAssemblyTransportBar
          duration={rig?.duration ?? state.composite.rig?.duration}
          isPlaying={playback.isPlaying}
          onTogglePlay={playback.toggle}
          time={playback.time}
          onSeekTime={playback.setTime}
        />
      )}
    </div>
  </div>
}
