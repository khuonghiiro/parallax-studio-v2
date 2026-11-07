import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { useLayerWorkshop } from './useLayerWorkshop'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import type { AssemblyWorkspaceView } from './LayerAssemblyDialog'
import { LayerAssemblyViewport } from './LayerAssemblyViewport'
import { LayerAssembly3DViewport } from './LayerAssembly3DViewport'
import { LayerAssemblyTransportBar } from './LayerAssemblyTransportBar'
import { useResponsiveViewport } from '../primitives'
import { IconCube, IconImage } from '../icons'
import { evaluateRig, transformRigLayer } from '../../engine/layerRig'
import { ensureRigClips, extraSoftBoneIdsForLayer } from './workshopRig'
import type { WorkshopTab } from './WorkshopRightPanel'
import { loadLayerWorkshopViewPrefs, saveLayerWorkshopViewPrefs } from './layerAssemblyViewPrefs'
import type { BrushPreview } from './useLayerBrushEraser'
import { spinesForLayer } from '../../engine/plantSpine'
import { usePlantClockOffset, usePlantLiveClock } from './usePlantClock'
import { usePlantSpineEditor } from './plantSpineEditorStore'
import { useWorkshopSubTab } from './workshopSubTabStore'
import { grabbedSpine } from './plantSpineEdit'
import { toggleMotionSketchArmed } from './motionSketchStore'
import { buildManipulateTestRig, type BoneOverlayProps } from './WorkshopBoneOverlay'
import { inferFallbackBoneForStackedLayer } from './mohoRigHelpers'
import { confirmPoseAndStep } from './workshopStepRecord'
import { resetTestPoses, setRigToolState, useRigToolStore, toggleBoneLabels } from './rigToolStore'

export function WorkshopWorkspace({
  state,
  playback,
  view,
  stageVisible = true,
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
  stageVisible?: boolean
  tab: WorkshopTab
  onSelectTab?: (tab: WorkshopTab) => void
  boneId: string | null
  selectBone: (id: string | null) => void
  onBrushModeChange?: (active: boolean) => void
  centerSplitRatio?: number
  onChangeCenterSplitRatio?: (ratio: number) => void
  onResetCenterSplitRatio?: () => void
}) {
  const initialPrefs = useMemo(() => loadLayerWorkshopViewPrefs(), [])
  const [showBones2D, setShowBones2D] = useState(() => initialPrefs.showBones2D)
  const [showBones3D, setShowBones3D] = useState(() => initialPrefs.showBones3D)
  const [showMesh, setShowMesh] = useState(() => loadLayerWorkshopViewPrefs().showMesh)
  const [hasOpened3D, setHasOpened3D] = useState(() => view !== '2d')
  const [brushEditing, setBrushEditing] = useState(false)
  const [brushPreview, setBrushPreview] = useState<BrushPreview | null>(null)
  const [resizingSplit, setResizingSplit] = useState(false)
  const splitContainerRef = useRef<HTMLDivElement | null>(null)
  const prevTabRef = useRef(tab)
  const rigTool = useRigToolStore()
  const { width: viewportWidth } = useResponsiveViewport()
  const isStackedSplit = view === 'split' && viewportWidth <= 820

  const brushMode = useCallback(
    (editing: boolean) => {
      setBrushEditing(editing)
      onBrushModeChange?.(editing)
      if (editing) playback.setIsPlaying(false)
    },
    [playback.setIsPlaying, onBrushModeChange]
  )

  const toggleBones2D = useCallback(() => {
    setShowBones2D((v) => {
      const next = !v
      saveLayerWorkshopViewPrefs({ showBones2D: next, showBones: next })
      return next
    })
  }, [])

  const toggleBones3D = useCallback(() => {
    setShowBones3D((v) => {
      const next = !v
      saveLayerWorkshopViewPrefs({ showBones3D: next })
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
    if (view !== '2d' && !hasOpened3D) setHasOpened3D(true)
  }, [view, hasOpened3D])

  const handleConfirmStep = useCallback(() => {
    playback.setIsPlaying(false)
    const res = confirmPoseAndStep(state.composite, playback.time)
    state.setComposite(res.composite)
    playback.setTime(res.nextTime)
  }, [playback, state])

  useEffect(() => {
    if (prevTabRef.current !== tab) {
      if (tab === 'bones' || tab === 'animation') {
        if (view === '2d' && !showBones2D) setShowBones2D(true)
        else if (view === '3d' && !showBones3D) setShowBones3D(true)
        else if (view === 'split') {
          if (!showBones2D) setShowBones2D(true)
          if (!showBones3D) setShowBones3D(true)
        }
      }
      if (prevTabRef.current === 'animation') toggleMotionSketchArmed(false)
      if (prevTabRef.current === 'bones') {
        resetTestPoses()
        if (rigTool.tool === 'manipulate') setRigToolState({ tool: 'select' })
      }
      prevTabRef.current = tab
    }
  }, [tab, view, showBones2D, showBones3D, rigTool.tool])

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
      if (e.shiftKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault()
        toggleBoneLabels()
        return
      }
      if ((e.shiftKey && (e.key === 'b' || e.key === 'B')) || ((e.key === 'b' || e.key === 'B') && tab === 'bones')) {
        if (view === '3d') toggleBones3D()
        else toggleBones2D()
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMesh()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [toggleBones2D, toggleBones3D, toggleMesh, tab, view, handleConfirmStep])

  const normalizedRig = state.composite.rig ? ensureRigClips(state.composite.rig).rig : undefined
  const plantOffset = usePlantClockOffset(playback.time, playback.isPlaying, normalizedRig?.duration ?? 4)
  const plantEditor = usePlantSpineEditor()
  const [animSubTab] = useWorkshopSubTab('animation')
  const isPlantActive = tab === 'plant' || (tab === 'animation' && animSubTab === 'plant')
  const hasSpines = (state.composite.plantSpines?.length ?? 0) > 0
  const liveEnabled = isPlantActive && plantEditor.live && hasSpines && !playback.isPlaying
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
  const effectiveRig = useMemo(() => {
    if (!rig) return undefined
    if (animated) return rig
    return { ...rig, loop: false, tracks: {} }
  }, [rig, animated])
  const transforms = animated ? evaluateRig(animated, evalTime) : undefined

  const composite = useMemo(
    () => ({
      ...state.composite,
      rig: effectiveRig ?? state.composite.rig,
      layers: state.composite.layers.map((l) => {
        const bindPose = { x: l.x, y: l.y, rotation: l.rotation }
        const isSingleLayerChar = state.composite.layers.length === 1 && Boolean(effectiveRig?.bones.length)
        const isMultiLayerChar = state.composite.layers.length > 1
        const fallbackStackedBoneId =
          !l.boneId && isMultiLayerChar && effectiveRig?.bones.length
            ? inferFallbackBoneForStackedLayer(l, state.composite.layers, effectiveRig.bones)
            : undefined
        const effectiveBoneId = l.boneId ?? fallbackStackedBoneId ?? (isSingleLayerChar ? effectiveRig!.bones[0]?.id : undefined)
        const candidateExtraBones =
          effectiveRig && effectiveBoneId
            ? (l.extraBoneIds?.length ? l.extraBoneIds : extraSoftBoneIdsForLayer(state.composite.layers, effectiveRig, l.id, effectiveBoneId))
            : undefined
        const hasMultiLimbBones = Boolean(candidateExtraBones && candidateExtraBones.length > 0)
        const effectiveSoft = l.bindingMode === 'soft' || isSingleLayerChar || hasMultiLimbBones
        const extraBoneIds = effectiveSoft ? candidateExtraBones : undefined
        const boneTf = transforms && effectiveBoneId ? transforms.get(effectiveBoneId) : undefined
        const layerWithEffectiveBone = effectiveBoneId && !l.boneId ? { ...l, boneId: effectiveBoneId } : l
        const transformed =
          transforms && !effectiveSoft
            ? transformRigLayer(layerWithEffectiveBone, transforms)
            : boneTf?.zOrder
              ? { ...layerWithEffectiveBone, z: Number((l.z - boneTf.zOrder).toFixed(3)) }
              : layerWithEffectiveBone
        const layerSpines = !isErasing && !l.hidden ? spinesForLayer(shiftedSpines, l.id) : undefined
        return {
          ...transformed,
          ...(effectiveSoft ? { bindingMode: 'soft' as const, boneId: effectiveBoneId, isolateToBoundBones: isMultiLayerChar } : {}),
          ...(extraBoneIds?.length ? { extraBoneIds } : {}),
          ...(brushPreview?.id === l.id ? { imageUrl: brushPreview.imageUrl } : {}),
          ...(effectiveRig && !isErasing ? { previewRig: effectiveRig, bindPose } : {}),
          ...(layerSpines?.length ? { previewPlantSpines: layerSpines } : {}),
          ...(isErasing ? { bindingMode: 'rigid' as const, motion: { ...l.motion, type: 'none' as const } } : {}),
          locked: l.locked
        }
      })
    }),
    [state.composite, effectiveRig, transforms, isErasing, shiftedSpines, brushPreview]
  )

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
      const span = isStackedSplit ? rect.height : rect.width
      if (span <= 100) return
      const raw = isStackedSplit ? (ev.clientY - rect.top) / span : (ev.clientX - rect.left) / span
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
      <div
        ref={splitContainerRef}
        className={`layer-workshop-split-container${isStackedSplit ? ' is-stacked' : ''}`}
      >
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
              showBones={showBones2D}
              onToggleShowBones={toggleBones2D}
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
                      drawing: isPlantActive,
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
            aria-orientation={isStackedSplit ? 'horizontal' : 'vertical'}
            aria-label="Co dãn tỷ lệ khung 2D và 3D"
            className={`lw-col-splitter${isStackedSplit ? ' is-horizontal' : ''}${resizingSplit ? ' active' : ''}`}
            onPointerDown={handleStartSplitDrag}
            onDoubleClick={() => onResetCenterSplitRatio?.()}
            title="Kéo để co dãn khung 2D và 3D (Nháy đúp để về 50/50)"
          >
            <span className="lw-col-splitter-grip" />
          </div>
        )}
        {(hasOpened3D || view !== '2d') && (
          <div
            className="layer-workshop-split-pane right-pane"
            data-mcp-region="layer_assembly_viewport_3d"
            style={view === '2d' ? { display: 'none' } : undefined}
          >
            <div className="pane-header-tab">
              <span className="pane-title">
                <IconCube width={13} height={13} /> Chiều sâu 3D
              </span>
              <span className="pane-mode-chip">Phối cảnh 2.5D</span>
            </div>
            <LayerAssembly3DViewport
              {...props}
              active={stageVisible && view !== '2d'}
              showBones={showBones3D}
              onToggleShowBones={toggleBones3D}
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
