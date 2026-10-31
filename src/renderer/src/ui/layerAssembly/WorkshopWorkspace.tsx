import { useState, useCallback, useEffect, useRef } from 'react'
import type { useLayerWorkshop } from './useLayerWorkshop'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import type { AssemblyWorkspaceView } from './LayerAssemblyDialog'
import { LayerAssemblyViewport } from './LayerAssemblyViewport'
import { LayerAssembly3DViewport } from './LayerAssembly3DViewport'
import { LayerAssemblyTransportBar } from './LayerAssemblyTransportBar'
import { IconCube, IconImage } from '../icons'
import { evaluateRig, transformRigLayer } from '../../engine/layerRig'
import { ensureRigClips, extraSoftBoneIdsForLayer } from './workshopRig'
import type { WorkshopTab } from './WorkshopRightPanel'
import { loadLayerWorkshopViewPrefs, saveLayerWorkshopViewPrefs } from './layerAssemblyViewPrefs'
import type { BrushPreview } from './useLayerBrushEraser'
import { spinesForLayer } from '../../engine/plantSpine'
import { usePlantClockOffset, usePlantLiveClock } from './usePlantClock'
import { usePlantSpineEditor } from './plantSpineEditorStore'
import { grabbedSpine } from './plantSpineEdit'
import { toggleMotionSketchArmed } from './motionSketchStore'
import { buildManipulateTestRig, type BoneOverlayProps } from './WorkshopBoneOverlay'
import { confirmPoseAndStep } from './workshopStepRecord'
import { resetTestPoses, setRigToolState, useRigToolStore } from './rigToolStore'

export function WorkshopWorkspace({
  state,
  playback,
  view,
  tab,
  onSelectTab,
  boneId,
  selectBone,
  onBrushModeChange,
  centerSplitRatio = 0.5,
  onChangeCenterSplitRatio,
  onResetCenterSplitRatio
}: {
  state: ReturnType<typeof useLayerWorkshop>
  playback: ReturnType<typeof useWorkshopPlayback>
  view: AssemblyWorkspaceView
  tab: WorkshopTab
  onSelectTab?: (tab: WorkshopTab) => void
  boneId: string | null
  selectBone: (id: string | null) => void
  onBrushModeChange?: (active: boolean) => void
  centerSplitRatio?: number
  onChangeCenterSplitRatio?: (ratio: number) => void
  onResetCenterSplitRatio?: () => void
}) {
  const [showBones, setShowBones] = useState(() => loadLayerWorkshopViewPrefs().showBones)
  const [showMesh, setShowMesh] = useState(() => loadLayerWorkshopViewPrefs().showMesh)
  const [brushEditing, setBrushEditing] = useState(false)
  const [brushPreview, setBrushPreview] = useState<BrushPreview | null>(null)
  const [resizingSplit, setResizingSplit] = useState(false)
  const splitContainerRef = useRef<HTMLDivElement | null>(null)
  const prevTabRef = useRef(tab)
  const rigTool = useRigToolStore()

  const brushMode = useCallback(
    (editing: boolean) => {
      setBrushEditing(editing)
      onBrushModeChange?.(editing)
      if (editing) playback.setIsPlaying(false)
    },
    [playback.setIsPlaying, onBrushModeChange]
  )

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

  const handleConfirmStep = useCallback(() => {
    playback.setIsPlaying(false)
    let nextTime = playback.time
    state.setComposite((c) => {
      const res = confirmPoseAndStep(c, playback.time)
      nextTime = res.nextTime
      return res.composite
    })
    playback.setTime(nextTime)
  }, [playback, state])

  useEffect(() => {
    if (prevTabRef.current !== tab) {
      if ((tab === 'bones' || tab === 'animation') && !showBones) {
        setShowBones(true)
      }
      if (prevTabRef.current === 'animation') toggleMotionSketchArmed(false)
      if (prevTabRef.current === 'bones') {
        resetTestPoses()
        if (rigTool.tool === 'manipulate') setRigToolState({ tool: 'select' })
      }
      prevTabRef.current = tab
    }
  }, [tab, showBones, rigTool.tool])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const tag = el?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable) return
      if (document.querySelector('.lw-new-motion-backdrop, .lw-retarget-backdrop')) return

      if (e.key === 'Enter' && tab === 'animation' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (tag === 'button') return
        e.preventDefault()
        handleConfirmStep()
        return
      }
      // Phím tắt công cụ Moho Pro trong tab Tạo xương (S = Chọn, A = Vẽ xương, T = Vùng ảnh hưởng, Z = Thử khớp)
      if (tab === 'bones' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const k = e.key.toLowerCase()
        if (k === 's') {
          resetTestPoses()
          setRigToolState({ tool: 'select' })
          return
        }
        if (k === 'a') {
          resetTestPoses()
          setRigToolState({ tool: 'add' })
          return
        }
        if (k === 't') {
          resetTestPoses()
          setRigToolState({ tool: 'strength', showInfluence: true })
          return
        }
        if (k === 'z' && !e.shiftKey) {
          setRigToolState({ tool: 'manipulate' })
          return
        }
      }
      if ((e.shiftKey && (e.key === 'b' || e.key === 'B')) || ((e.key === 'b' || e.key === 'B') && tab === 'bones')) {
        toggleBones()
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMesh()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [toggleBones, toggleMesh, tab, handleConfirmStep])

  const normalizedRig = state.composite.rig ? ensureRigClips(state.composite.rig).rig : undefined
  const plantOffset = usePlantClockOffset(playback.time, playback.isPlaying, normalizedRig?.duration ?? 4)
  const plantEditor = usePlantSpineEditor()
  const hasSpines = (state.composite.plantSpines?.length ?? 0) > 0
  const liveEnabled = tab === 'plant' && plantEditor.live && hasSpines && !playback.isPlaying
  const plantLive = usePlantLiveClock(liveEnabled, !plantEditor.dragging && !plantEditor.grab)
  const plantTime = plantOffset + plantLive
  const shiftedSpines = (state.composite.plantSpines ?? []).map((s) => {
    const grabbed =
      plantEditor.grab?.spineId === s.id
        ? grabbedSpine(s, plantEditor.grab.angle, plantEditor.grab.stretch ?? 0)
        : s
    return plantTime ? { ...grabbed, phaseOffset: (grabbed.phaseOffset ?? 0) + plantTime } : grabbed
  })

  const isManipulatingRigTest =
    tab === 'bones' &&
    rigTool.tool === 'manipulate' &&
    Boolean(normalizedRig?.bones.length) &&
    Object.keys(rigTool.testPoses).length > 0

  const rig = normalizedRig
    ? isManipulatingRigTest
      ? buildManipulateTestRig(normalizedRig, rigTool.testPoses)
      : { ...normalizedRig, loop: playback.isPlaying && normalizedRig.loop }
    : undefined

  const evalTime = isManipulatingRigTest ? 0 : playback.time
  const isErasing = brushEditing && tab === 'layers' && !playback.isPlaying
  const animated = !isErasing && (isManipulatingRigTest || tab === 'animation' || playback.isPlaying || playback.time > 0) && rig
  const transforms = animated ? evaluateRig(animated, evalTime) : undefined

  const composite = {
    ...state.composite,
    rig: rig ?? state.composite.rig,
    layers: state.composite.layers.map((l) => {
      const bindPose = { x: l.x, y: l.y, rotation: l.rotation }
      const implicitSingleSoft = !l.boneId && state.composite.layers.length === 1 && Boolean(rig?.bones.length)
      const effectiveSoft = l.bindingMode === 'soft' || implicitSingleSoft
      const effectiveBoneId = l.boneId ?? (implicitSingleSoft ? rig!.bones[0]?.id : undefined)
      const extraBoneIds =
        effectiveSoft && rig ? extraSoftBoneIdsForLayer(state.composite.layers, rig, l.id, effectiveBoneId) : undefined
      const transformed = transforms && !effectiveSoft ? transformRigLayer(l, transforms) : l
      const layerSpines = !isErasing && !l.hidden ? spinesForLayer(shiftedSpines, l.id) : undefined
      return {
        ...transformed,
        ...(implicitSingleSoft ? { bindingMode: 'soft' as const, boneId: effectiveBoneId } : {}),
        ...(extraBoneIds?.length ? { extraBoneIds } : {}),
        ...(brushPreview?.id === l.id ? { imageUrl: brushPreview.imageUrl } : {}),
        ...(rig && !isErasing ? { previewRig: rig, bindPose } : {}),
        ...(layerSpines?.length ? { previewPlantSpines: layerSpines } : {}),
        ...(isErasing ? { bindingMode: 'rigid' as const, motion: { ...l.motion, type: 'none' as const } } : {}),
        locked: l.locked
      }
    })
  }

  const boneOverlay: BoneOverlayProps = {
    composite: { ...state.composite, rig: normalizedRig ?? state.composite.rig },
    boneId,
    selectBone,
    setComposite: state.setComposite,
    stopPlayback: () => playback.setIsPlaying(false),
    cancelGesture: state.cancelGesture,
    beginGesture: () => state.history.begin(),
    endGesture: () => state.history.end(),
    seek: playback.setTime,
    playFrom: (t: number) => {
      playback.setTime(t)
      playback.setIsPlaying(true)
    },
    time: evalTime,
    editing: tab === 'bones'
  }

  const props = {
    composite,
    selectedLayerId: state.selectedLayerId,
    selectedIds: state.selection,
    onSelectLayer: state.select,
    onUpdateLayer: state.update,
    onAddLayerFromAsset: state.add,
    onAppendPresetLayers: state.append,
    time: evalTime,
    tab,
    onSelectTab
  }

  const handleStartSplitDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onChangeCenterSplitRatio) return
    e.preventDefault()
    e.stopPropagation()
    setResizingSplit(true)
    const onMove = (ev: PointerEvent) => {
      const container = splitContainerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      if (rect.width <= 100) return
      const raw = (ev.clientX - rect.left) / rect.width
      onChangeCenterSplitRatio(Math.max(0.2, Math.min(0.8, Number(raw.toFixed(3)))))
    }
    const onUp = () => {
      setResizingSplit(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const stage2dModeLabel =
    tab === 'bones'
      ? rigTool.tool === 'add'
        ? 'Vẽ xương Moho (A)'
        : rigTool.tool === 'strength'
          ? 'Vùng ảnh hưởng (T)'
          : rigTool.tool === 'manipulate'
            ? 'Thử bẻ khớp (Z)'
            : 'Chỉnh khớp Frame 0 (S)'
      : tab === 'animation'
        ? `Diễn hoạt · ${playback.time.toFixed(2)}s`
        : 'Di chuyển & căn chỉnh'

  return (
    <div className="layer-workshop-center-area">
      <div ref={splitContainerRef} className="layer-workshop-split-container">
        {view !== '3d' && (
          <div
            className="layer-workshop-split-pane left-pane"
            data-mcp-region="layer_assembly_viewport_2d"
            style={
              view === 'split'
                ? { flex: `0 0 calc(${(centerSplitRatio * 100).toFixed(2)}% - 3px)` }
                : undefined
            }
          >
            <div className="pane-header-tab">
              <span className="pane-title">
                <IconImage width={13} height={13} /> Sân khấu 2D
              </span>
              <span className="pane-mode-chip">{stage2dModeLabel}</span>
            </div>
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
              sketchOverlay={
                isErasing
                  ? undefined
                  : {
                      ...boneOverlay,
                      playFrom: (t: number) => {
                        playback.setTime(t)
                        playback.setIsPlaying(true)
                      },
                      seek: playback.setTime
                    }
              }
              boneOverlay={isErasing ? undefined : boneOverlay}
              plantOverlay={
                isErasing
                  ? undefined
                  : {
                      composite: state.composite,
                      setComposite: state.setComposite,
                      selectedIds: state.selection,
                      time: playback.time + plantTime,
                      drawing: tab === 'plant',
                      beginGesture: () => state.history.begin(),
                      endGesture: () => state.history.end()
                    }
              }
              onChangeComposite={state.setComposite}
              isPlaying={playback.isPlaying}
              onTogglePlay={playback.toggle}
              onSeekTime={playback.setTime}
              hideTransport
              view={view}
            />
          </div>
        )}
        {view === 'split' && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Co dãn tỷ lệ khung 2D và 3D"
            className={`lw-col-splitter${resizingSplit ? ' active' : ''}`}
            onPointerDown={handleStartSplitDrag}
            onDoubleClick={() => onResetCenterSplitRatio?.()}
            title="Kéo trái/phải để co dãn khung 2D và 3D (Nháy đúp để về 50/50)"
          >
            <span className="lw-col-splitter-grip" />
          </div>
        )}
        {view !== '2d' && (
          <div className="layer-workshop-split-pane right-pane" data-mcp-region="layer_assembly_viewport_3d">
            <div className="pane-header-tab">
              <span className="pane-title">
                <IconCube width={13} height={13} /> Chiều sâu 3D
              </span>
              <span className="pane-mode-chip">Phối cảnh 2.5D</span>
            </div>
            <LayerAssembly3DViewport
              {...props}
              showBones={showBones}
              onToggleShowBones={toggleBones}
              showMesh={showMesh}
              onToggleShowMesh={toggleMesh}
              onChangeComposite={state.setComposite}
              boneId={boneId}
              selectBone={selectBone}
            />
          </div>
        )}
        {!isErasing && tab !== 'animation' && (
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
  )
}
