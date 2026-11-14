import { useCallback, useEffect, useRef, useState } from 'react'
import type { LayerComposite } from './types'
import { registerLayerAssemblySession } from './layerAssemblyBridge'
import { LayerAssemblyInspector } from './LayerAssemblyInspector'
import { LayerAssemblySidebar } from './LayerAssemblySidebar'
import { useLayerWorkshop } from './useLayerWorkshop'
import { useWorkshopPlayback } from './useWorkshopPlayback'
import { useWorkshopSave } from './useWorkshopSave'
import { useWorkshopShortcuts } from './useWorkshopShortcuts'
import { WorkshopTools } from './WorkshopTools'
import { WorkshopHeader, type WorkshopPrimaryMode } from './WorkshopHeader'
import { WorkshopAnimationTimeline } from './WorkshopAnimationTimeline'
import { WorkshopWorkspace } from './WorkshopWorkspace'
import { LayerAssemblyCutterWorkspace } from './cutter/LayerAssemblyCutterWorkspace'
import { getStoredComposites } from './layerAssemblyStorage'
import { SegmentedTabs, useResponsiveViewport } from '../primitives'
import { IconCube, IconLayers } from '../icons'
import { IconTabBoneRig } from './LayerWorkshopStudioIcons'
import '../../styles/layerAssembly.css'
import '../../styles/layerWorkshopTools.css'
import '../../styles/layerWorkshopRig.css'
import '../../styles/layerWorkshopPanels.css'
import '../../styles/layerWorkshopChrome.css'
import '../../styles/layerWorkshopStudio.css'
import '../../styles/layerWorkshopAnimateStudio.css'
import '../../styles/layerWorkshopBoneDepth.css'
import { WorkshopRightPanel, type WorkshopTab } from './WorkshopRightPanel'
import { useWorkshopLoopActions } from './useWorkshopLoopActions'
import { ensureRigClips } from './workshopRig'
import { CreateLayerAssemblyModal } from './CreateLayerAssemblyModal'
import { useRigToolStore, setRigToolState, closeCutoutPartRig, getRigToolState } from './rigToolStore'
import {
  clearActiveWorkshopSession,
  updateActiveWorkshopDraft
} from './layerAssemblySessionStorage'
import {
  DEFAULT_LAYER_WORKSHOP_COLUMN_PREFS,
  clampLeftSidebarWidth,
  clampRightPanelWidth,
  isDefaultLayerWorkshopColumnPrefs,
  loadLayerWorkshopColumnPrefs,
  resetLayerWorkshopColumnPrefs,
  saveLayerWorkshopColumnPrefs,
  type LayerWorkshopColumnPrefs
} from './layerAssemblyViewPrefs'

export type AssemblyWorkspaceView = '2d' | '3d' | 'split'
type LayerWorkshopResponsivePane = 'assets' | 'stage' | 'inspector'

export interface LayerAssemblyDialogProps {
  initialComposite?: LayerComposite | null
  initialTab?: WorkshopTab
  initialPrimaryMode?: WorkshopPrimaryMode
  initialBoneId?: string | null
  onClose: () => void
}

function IconAlert() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

export function LayerAssemblyDialog({
  initialComposite,
  initialTab,
  initialPrimaryMode,
  initialBoneId,
  onClose
}: LayerAssemblyDialogProps) {
  const state = useLayerWorkshop(initialComposite)
  const { composite, setComposite, history, undo, redo, createNew } = state
  const activeRig = composite.rig ? ensureRigClips(composite.rig).rig : undefined
  const [tab, setTab] = useState<WorkshopTab>(() => initialTab ?? 'layers')
  // Tab Loop luôn phát lặp vòng để hoạt ảnh Loop không dừng khi clip xương đặt "phát 1 lần"
  const playback = useWorkshopPlayback(activeRig?.duration, tab === 'loop' ? true : activeRig?.loop)

  useEffect(() => {
    // Tự động ngắt chế độ Bộ phận 2D (cutoutStageMode) khi đổi tab
    // để tránh bị kẹt overlay hoặc không biết tắt khi sang tab khác
    const rig = getRigToolState()
    if (rig.cutoutStageMode) {
      closeCutoutPartRig()
    }
    if (tab === 'layers' || tab === 'bones') {
      playback.setIsPlaying(false)
      playback.setTime(0)
    }
  }, [tab])
  const loopActions = useWorkshopLoopActions(state, playback, setTab)
  const [boneId, selectBone] = useState<string | null>(() => initialBoneId ?? null)
  const saving = useWorkshopSave(() => history.current, onClose, () => playback.time)
  const close = () => {
    clearActiveWorkshopSession()
    if (!saving.busy) onClose()
  }
  const { width: viewportWidth, breakpoint, isDrawerMode, isPhone: isMobile } = useResponsiveViewport()
  const [view, setView] = useState<AssemblyWorkspaceView>(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) return '2d'
    try {
      const saved = localStorage.getItem('pxs:layer-workshop-view')
      if (saved === '2d' || saved === 'split' || saved === '3d') return saved as AssemblyWorkspaceView
    } catch {}
    return '2d'
  })

  const handleSetView = (nextView: AssemblyWorkspaceView) => {
    setView(nextView)
    try {
      localStorage.setItem('pxs:layer-workshop-view', nextView)
    } catch {}
  }
  const [primaryMode, setPrimaryMode] = useState<WorkshopPrimaryMode>(() => initialPrimaryMode ?? 'assembly')
  const [showNewConfirm, setShowNewConfirm] = useState(false)
  const [isBrushActive, setIsBrushActive] = useState(false)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [colPrefs, setColPrefs] = useState<LayerWorkshopColumnPrefs>(() => loadLayerWorkshopColumnPrefs())
  const [draggingCol, setDraggingCol] = useState<'left' | 'right' | null>(null)
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [mobilePane, setMobilePane] = useState<LayerWorkshopResponsivePane>('stage')
  const rigTool = useRigToolStore()

  useEffect(() => {
    if (rigTool.requestedView) {
      handleSetView(rigTool.requestedView)
      setRigToolState({ requestedView: null })
    }
  }, [rigTool.requestedView])

  const updateColPrefs = (patch: Partial<LayerWorkshopColumnPrefs>) => {
    setColPrefs((prev) => {
      const next = { ...prev, ...patch }
      saveLayerWorkshopColumnPrefs(next)
      return next
    })
  }

  const handleResetColumns = () => {
    setColPrefs(resetLayerWorkshopColumnPrefs())
    setLeftSidebarOpen(true)
    setRightPanelOpen(true)
  }

  const startLeftColResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = colPrefs.leftSidebarWidth
    setDraggingCol('left')
    const onMove = (ev: PointerEvent) => {
      const nextW = clampLeftSidebarWidth(startW + (ev.clientX - startX))
      updateColPrefs({ leftSidebarWidth: nextW })
    }
    const onUp = () => {
      setDraggingCol(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startRightColResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = colPrefs.rightPanelWidth
    setDraggingCol('right')
    const onMove = (ev: PointerEvent) => {
      const nextW = clampRightPanelWidth(startW - (ev.clientX - startX))
      updateColPrefs({ rightPanelWidth: nextW })
    }
    const onUp = () => {
      setDraggingCol(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

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
      setIsTemplateModalOpen(true)
    }
  }

  const handleSaveAndCreateNew = async () => {
    setShowNewConfirm(false)
    const success = await saving.saveWithoutClosing()
    if (success) {
      setIsTemplateModalOpen(true)
    }
  }

  const handleDiscardAndCreateNew = () => {
    setShowNewConfirm(false)
    setIsTemplateModalOpen(true)
  }

  const handleCancelNew = () => {
    setShowNewConfirm(false)
  }

  // Tránh ghi JSON.stringify 200KB–400KB vào localStorage trên từng khung hình 60fps khi đang phát hoạt ảnh
  useEffect(() => {
    if (playback.isPlaying) return
    if (!composite || !composite.id) return
    const timer = window.setTimeout(() => {
      updateActiveWorkshopDraft(composite, {
        tab,
        primaryMode,
        selectedBoneId: boneId,
        time: playback.time
      })
    }, 280)
    return () => window.clearTimeout(timer)
  }, [composite, tab, primaryMode, boneId, playback.time, playback.isPlaying])

  useWorkshopShortcuts(state, playback.toggle, close, {
    primaryMode,
    tab,
    boneId,
    selectBone,
    time: playback.time,
    stopPlayback: () => playback.setIsPlaying(false),
    isErasing: isBrushActive && tab === 'layers'
  })

  const sessionLiveRef = useRef({
    primaryMode,
    setPrimaryMode,
    history,
    setComposite,
    state,
    playback,
    tab,
    setTab,
    isDrawerMode,
    setMobilePane,
    boneId,
    selectBone,
    undo,
    redo,
    saving,
    close
  })
  sessionLiveRef.current = {
    primaryMode,
    setPrimaryMode,
    history,
    setComposite,
    state,
    playback,
    tab,
    setTab,
    isDrawerMode,
    setMobilePane,
    boneId,
    selectBone,
    undo,
    redo,
    saving,
    close
  }

  useEffect(
    () =>
      registerLayerAssemblySession({
        getPrimaryMode: () => sessionLiveRef.current.primaryMode,
        setPrimaryMode: (m) => sessionLiveRef.current.setPrimaryMode(m),
        getComposite: () => sessionLiveRef.current.history.current,
        setComposite: (u) => sessionLiveRef.current.setComposite(u),
        getSelectedLayerId: () => sessionLiveRef.current.state.selectedLayerId,
        setSelectedLayerId: (id) => sessionLiveRef.current.state.select(id),
        getSelectedLayerIds: () => sessionLiveRef.current.state.selection,
        setSelectedLayerIds: (ids) => sessionLiveRef.current.state.setIds(ids),
        getIsPlaying: () => sessionLiveRef.current.playback.isPlaying,
        setIsPlaying: (p) => sessionLiveRef.current.playback.setIsPlaying(p),
        getTime: () => sessionLiveRef.current.playback.time,
        setTime: (t) => sessionLiveRef.current.playback.setTime(t),
        getTab: () => sessionLiveRef.current.tab,
        setTab: (nextTab) => {
          sessionLiveRef.current.setTab(nextTab)
          if (sessionLiveRef.current.isDrawerMode) sessionLiveRef.current.setMobilePane('inspector')
        },
        getSelectedBoneId: () => sessionLiveRef.current.boneId,
        setSelectedBoneId: (id) => sessionLiveRef.current.selectBone(id),
        undo: () => sessionLiveRef.current.undo(),
        redo: () => sessionLiveRef.current.redo(),
        canUndo: () => sessionLiveRef.current.history.canUndo,
        canRedo: () => sessionLiveRef.current.history.canRedo,
        save: () => sessionLiveRef.current.saving.save(),
        insertToScene: () => sessionLiveRef.current.saving.insert(),
        close: () => sessionLiveRef.current.close()
      }),
    []
  )

  const showLeftSidebar = isDrawerMode ? mobilePane === 'assets' : leftSidebarOpen
  const showCenterStage = isDrawerMode ? mobilePane === 'stage' : true
  const showRightPanel = isDrawerMode ? mobilePane === 'inspector' : rightPanelOpen
  const effectiveLeftWidth = isDrawerMode
    ? undefined
    : breakpoint === 'laptop'
      ? Math.max(196, Math.min(colPrefs.leftSidebarWidth, Math.round(viewportWidth * 0.2)))
      : colPrefs.leftSidebarWidth
  const effectiveRightWidth = isDrawerMode
    ? undefined
    : breakpoint === 'laptop'
      ? Math.max(276, Math.min(colPrefs.rightPanelWidth, Math.round(viewportWidth * 0.255)))
      : colPrefs.rightPanelWidth

  return (
    <div className="layer-workshop-overlay">
      <div
        className={`layer-workshop-dialog${isDrawerMode ? ' is-responsive-drawer' : ''}${isMobile ? ' is-mobile' : ''}${breakpoint === 'laptop' ? ' is-laptop' : ''}`}
        data-mcp-region="layer_assembly"
        data-mcp-dialog
        role="dialog"
        aria-modal="true"
        aria-label="Xưởng Lắp Ráp Layer"
        onPointerDownCapture={() => history.begin()}
      >
        <WorkshopHeader
          composite={composite}
          setComposite={setComposite}
          primaryMode={primaryMode}
          setPrimaryMode={setPrimaryMode}
          view={view}
          setView={handleSetView}
          busy={saving.busy}
          save={() => void saving.save()}
          insert={() => void saving.insert()}
          close={close}
          onNewModel={handleRequestNewModel}
          hasCustomColumns={!isDefaultLayerWorkshopColumnPrefs(colPrefs) || !leftSidebarOpen || !rightPanelOpen}
          onResetColumns={handleResetColumns}
          showPanelToggles={!isDrawerMode}
          leftSidebarOpen={leftSidebarOpen}
          rightPanelOpen={rightPanelOpen}
          onToggleLeftSidebar={() => setLeftSidebarOpen((v) => !v)}
          onToggleRightPanel={() => setRightPanelOpen((v) => !v)}
        />

        {primaryMode === 'assembly' ? (
          <>
            {isDrawerMode && (
              <div className="workshop-responsive-bar">
                <SegmentedTabs<LayerWorkshopResponsivePane>
                  variant="segmented"
                  size="sm"
                  mcpRegion="layer_assembly_responsive_tabs"
                  ariaLabel="Chuyển vùng Xưởng Lắp Ráp Layer"
                  value={mobilePane}
                  onChange={setMobilePane}
                  items={[
                    {
                      id: 'assets',
                      label: 'Kho & Mẫu',
                      icon: <IconLayers width={13} height={13} />,
                      badge: composite.layers.length
                    },
                    {
                      id: 'stage',
                      label: 'Sân khấu 2D/3D',
                      icon: <IconCube width={13} height={13} />
                    },
                    {
                      id: 'inspector',
                      label:
                        tab === 'bones'
                          ? 'Tạo xương'
                          : (tab === 'animation' || tab === 'plant')
                            ? 'Anim & Gió'
                            : 'Thuộc tính Lớp',
                      icon: <IconTabBoneRig width={13} height={13} />,
                      badge: activeRig?.bones.length || undefined
                    }
                  ]}
                />
              </div>
            )}

            {(!isDrawerMode || mobilePane === 'stage') && (
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
                estimate={() =>
                  state.run(
                    'estimate-frame',
                    undefined,
                    composite.layers.map((l) => l.id)
                  )
                }
              />
            )}

            {saving.error && (
              <div className="lw-error" role="alert">
                {saving.error}
              </div>
            )}

            <div className="layer-workshop-body" data-mcp-region="layer_assembly_workspace">
              {showLeftSidebar && (
                <LayerAssemblySidebar
                  composite={composite}
                  selectedLayerId={state.selectedLayerId}
                  onSelectLayer={state.select}
                  onAddLayerFromAsset={(name, path, url) => {
                    state.add(name, path, url)
                  }}
                  onAppendPresetLayers={state.append}
                  onAddLoopTemplate={loopActions.addLoopTemplateLayer}
                  onBindLoopTemplate={loopActions.bindLoopTemplate}
                  onDeleteLayer={(id) => state.run('delete', undefined, [id])}
                  onDuplicateLayer={(id) => state.run('duplicate', undefined, [id])}
                  onLoadComposite={(loaded) => {
                    setComposite(loaded)
                    if (loaded.layers[0]) {
                      state.select(loaded.layers[0].id)
                    }
                    if (isDrawerMode) setMobilePane('stage')
                  }}
                  width={effectiveLeftWidth}
                />
              )}

              {!isDrawerMode && leftSidebarOpen && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Co dãn độ rộng cột Tài nguyên bên trái"
                  className={`lw-col-splitter${draggingCol === 'left' ? ' active' : ''}`}
                  onPointerDown={startLeftColResize}
                  onDoubleClick={() =>
                    updateColPrefs({ leftSidebarWidth: DEFAULT_LAYER_WORKSHOP_COLUMN_PREFS.leftSidebarWidth })
                  }
                  title="Kéo trái/phải để co dãn cột Tài nguyên (Nháy đúp để về 260px)"
                >
                  <span className="lw-col-splitter-grip" />
                </div>
              )}

              <div className="lw-workspace-column" style={!showCenterStage ? { display: 'none' } : undefined}>
                <WorkshopWorkspace
                  state={state}
                  playback={playback}
                  view={view}
                  stageVisible={showCenterStage}
                  tab={tab}
                  onSelectTab={setTab}
                  boneId={boneId}
                  selectBone={selectBone}
                  onBrushModeChange={setIsBrushActive}
                  centerSplitRatio={colPrefs.centerSplitRatio}
                  onChangeCenterSplitRatio={(r) => updateColPrefs({ centerSplitRatio: r })}
                  onResetCenterSplitRatio={() =>
                    updateColPrefs({ centerSplitRatio: DEFAULT_LAYER_WORKSHOP_COLUMN_PREFS.centerSplitRatio })
                  }
                />
                {tab === 'animation' && (
                  <WorkshopAnimationTimeline
                    state={state}
                    playback={playback}
                    boneId={boneId}
                    selectBone={selectBone}
                  />
                )}
              </div>

              {!isDrawerMode && rightPanelOpen && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Co dãn độ rộng cột Công cụ bên phải"
                  className={`lw-col-splitter${draggingCol === 'right' ? ' active' : ''}`}
                  onPointerDown={startRightColResize}
                  onDoubleClick={() =>
                    updateColPrefs({ rightPanelWidth: DEFAULT_LAYER_WORKSHOP_COLUMN_PREFS.rightPanelWidth })
                  }
                  title="Kéo trái/phải để co dãn cột Công cụ bên phải (Nháy đúp để về 330px)"
                >
                  <span className="lw-col-splitter-grip" />
                </div>
              )}

              {showRightPanel && (
                <WorkshopRightPanel
                  state={state}
                  playback={playback}
                  tab={tab}
                  setTab={setTab}
                  boneId={boneId}
                  selectBone={selectBone}
                  width={effectiveRightWidth}
                >
                  <LayerAssemblyInspector
                    composite={composite}
                    setComposite={setComposite}
                    selectedLayerId={state.selectedLayerId}
                    selectedIds={state.selection}
                    onSelectLayer={state.select}
                    onSetIds={state.setIds}
                    onUpdateLayer={state.update}
                    onMoveLayer={state.moveLayer}
                    onAddLayer={() => state.add(`Lớp ${composite.layers.length + 1}`, '')}
                    onDeleteLayer={(id) => state.run('delete', undefined, [id])}
                    onDuplicateLayer={(id) => state.run('duplicate', undefined, [id])}
                    onMoveLayerOrder={state.move}
                    onBatchAction={state.run}
                    onAllAction={(action) =>
                      state.run(
                        action,
                        undefined,
                        composite.layers.map((l) => l.id)
                      )
                    }
                  />
                </WorkshopRightPanel>
              )}
            </div>
          </>
        ) : (
          <div className="layer-workshop-body">
            <LayerAssemblyCutterWorkspace state={state} />
          </div>
        )}

        <footer className="lw-status">
          <span>
            {composite.layers.length} lớp · {state.selection.length} đã chọn
            {activeRig?.bones.length ? ` · ${activeRig.bones.length} xương` : ''} ·{' '}
            {composite.layers.filter((l) => l.locked).length} khóa
          </span>
          <span>
            {tab === 'bones'
              ? 'Moho Rig: S chọn · A vẽ xương/Pin · T vùng uốn · Z thử bẻ khớp · B ẩn/hiện xương · M hiện lưới Mesh'
              : tab === 'animation'
                ? 'Moho/Animate: Kéo xương tạo dáng · Enter chốt bước · Shift+Kéo ghi Realtime · I bật IK · O Onion Skin · Giữ Space kéo lia view'
                : 'Ctrl+Z hoàn tác · Ctrl+D nhân bản · Mũi tên: dời 2D · Phím +/-: độ sâu Z · Chuyển tab Anim để diễn hoạt'}
          </span>
        </footer>
      </div>

      {showNewConfirm && (
        <div className="lw-confirm-backdrop" onClick={handleCancelNew}>
          <div
            className="lw-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Lưu thay đổi trước khi tạo mẫu mới"
            data-mcp-region="layer_assembly_confirm"
            data-mcp-dialog
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lw-confirm-title">
              <IconAlert />
              <span>Lưu thay đổi trước khi tạo mẫu mới?</span>
            </div>
            <div className="lw-confirm-desc">
              Mẫu layer &ldquo;<strong>{composite.name || 'Chưa đặt tên'}</strong>&rdquo; đang có các thay đổi chưa được
              lưu vào danh sách mẫu. Bạn có muốn lưu lại trước khi bắt đầu tạo mẫu mới không?
            </div>
            <div className="lw-confirm-actions">
              <button type="button" className="btn sm" onClick={handleCancelNew}>
                Hủy
              </button>
              <button
                type="button"
                className="btn sm lw-btn-discard-new"
                style={{ color: 'var(--text-dim)', border: '1px solid var(--line-soft)' }}
                onClick={handleDiscardAndCreateNew}
              >
                Không lưu
              </button>
              <button type="button" className="btn sm lw-btn-new-model" onClick={() => void handleSaveAndCreateNew()}>
                Lưu & Tạo mới
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateLayerAssemblyModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onSelectTemplate={(comp) => {
          createNew(comp)
          setIsTemplateModalOpen(false)
        }}
        onSelectBlank={() => {
          createNew()
          setIsTemplateModalOpen(false)
        }}
      />
    </div>
  )
}
