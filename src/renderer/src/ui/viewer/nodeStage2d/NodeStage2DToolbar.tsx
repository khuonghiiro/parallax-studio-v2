import React, { useEffect, useRef, useState } from 'react'
import type { Project, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { effectiveTimeParams } from '../../../project/workflowTiming'
import { getClusterPartShortName, getLayerDisplayName } from '../../../project/workflowV2Engine'
import { useView } from '../../../store/view'
import {
  IconAim,
  IconAlignStageCenter,
  IconAlignStageLeft,
  IconAlignStageRight,
  IconCamPanZoom2D,
  IconCamPushIn,
  IconCameraStage,
  IconChevronDown,
  IconCompFrame,
  IconContextDots,
  IconFitStage2D,
  IconGizmoBbox,
  IconLayers,
  IconLock,
  IconNodeCircuit,
  IconPad25D,
  IconPause,
  IconPen,
  IconPlay,
  IconPlus,
  IconSingle,
  IconSkipEnd,
  IconSkipStart,
  IconSparkles,
  IconSplit
} from '../../icons'
import { selectedViews } from '../taggedLayout'
import {
  cleanV2NodeTitle,
  resolveV2LogicCategory,
  resolveV2NodeLevel,
  resolveV2NodeTheme,
  type WorkflowV2SpawnCategory
} from '../../workflow/workflowV2Theme'
import type { StageQuickAlignPreset } from './nodeStageQuickActions'
import type { NodeStagePrimaryMode, StageLayerNodeContext } from './resolveNodeStageTarget'

export interface NodeStage2DToolbarProps {
  project: Project
  workflow: WorkflowGraph
  node: WorkflowNode | null
  ctx: StageLayerNodeContext
  cameraWaypoints: WorkflowNode[]
  isCamDirectorMode: boolean
  lastEntityLabel?: string
  primaryMode: NodeStagePrimaryMode
  overrideSceneView: boolean
  currentTime: number
  playing: boolean
  zoomPct: number
  scopeOverride: 'cluster' | 'part' | null
  onSelectNode: (nodeId: string) => void
  onToggleCamDirectorMode: () => void
  onToggleOverrideSceneView: (sceneView: boolean) => void
  onQuickSpawnBboxMotion: () => void
  onQuickSpawnPathMotion: () => void
  onSpawnFollowupStep: () => void
  onSpawnCameraWaypoint: (mode: 'pan' | 'zoom-in' | 'zoom-out' | 'hold') => void
  onSyncCameraToEntity: () => void
  onQuickAlign: (preset: StageQuickAlignPreset) => void
  onAttachLogic: (
    layerNodeId: string,
    category: WorkflowV2SpawnCategory,
    presetId?: string,
    extraParams?: Partial<WorkflowNodeParams>,
    customTitle?: string
  ) => void
  onToggleScopeOverride: () => void
  onScrubTime: (t: number) => void
  onTogglePlayNode: () => void
  onFitStage: () => void
  onOpenContextMenuAtButton?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

export const NodeStage2DToolbar: React.FC<NodeStage2DToolbarProps> = ({
  project,
  node,
  ctx,
  cameraWaypoints = [],
  isCamDirectorMode = false,
  lastEntityLabel,
  primaryMode,
  overrideSceneView,
  currentTime,
  playing,
  zoomPct,
  scopeOverride,
  onSelectNode,
  onToggleCamDirectorMode,
  onToggleOverrideSceneView,
  onQuickSpawnBboxMotion,
  onQuickSpawnPathMotion,
  onSpawnFollowupStep,
  onSpawnCameraWaypoint,
  onSyncCameraToEntity,
  onQuickAlign,
  onAttachLogic,
  onToggleScopeOverride,
  onScrubTime,
  onTogglePlayNode,
  onFitStage,
  onOpenContextMenuAtButton
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuWrapRef = useRef<HTMLDivElement>(null)
  const viewState = useView()
  const activeViews = selectedViews(viewState)
  const isSplitWithCam = activeViews.includes('camera') && activeViews.includes('node2d')

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (!menuWrapRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const level = node ? resolveV2NodeLevel(node) : null
  const logicCat = node ? resolveV2LogicCategory(node) : undefined
  const isOnBboxMotion = Boolean(node && logicCat === 'action' && node.params?.motionMode === 'bbox')
  const isOnPathMotion = Boolean(node && logicCat === 'action' && node.params?.motionMode === 'path')
  const canChainStep = Boolean(
    node && (node.params?.isPartChild || logicCat === 'action' || logicCat === 'anim_fx' || logicCat === 'collision')
  )
  const hasDualStage = primaryMode === 'logic_25d' || primaryMode === 'part_25d'
  const timing = node
    ? effectiveTimeParams(project, node, node.params ?? {})
    : { timeStart: 0, timeEnd: project.comp.duration || 5 }
  const tStart = timing.timeStart ?? 0
  const tEnd = timing.timeEnd ?? (project.comp.duration || 5)

  const rawLabel = ctx.activeLayer
    ? getLayerDisplayName(ctx.activeLayer)
    : node
      ? cleanV2NodeTitle(node.title)
      : 'Chưa chọn'
  const cleanShortTarget = rawLabel.replace(/\s*—.*$/, '').trim() || rawLabel

  const activeLogicNode = ctx.logicNodes.find(
    (ln) =>
      node?.id === ln.id ||
      Boolean(ln.params?.isPartHub && node?.params?.isPartChild && node?.params?.hierarchyParentNodeId === ln.id)
  )
  const isClusterEntity = ctx.layerOrClusterNode?.params?.logicCategory === 'cluster_lock'

  return (
    <div className="viewer-node2d-toolbar" data-mcp-region="viewer_node2d_tools">
      {/* CỤM TRÁI & GIỮA: Đối tượng / Lộ trình Camera · Chặng BBox · Căn nhanh */}
      <div className="vn2d-left-track">
        {/* Nút chuyển nhanh Đối tượng ⇄ Lộ trình Camera ngay trên thanh đầu */}
        <button
          type="button"
          className={`vn2d-tool-btn is-cam-switch${isCamDirectorMode ? ' active' : ''}`}
          onClick={onToggleCamDirectorMode}
          title={
            isCamDirectorMode
              ? `Quay lại chỉnh "${lastEntityLabel || 'Đối tượng'}" trên Khung 2D`
              : 'Chuyển sang đạo diễn Lộ trình Camera (#1 → #2 → #3) trực tiếp trên Khung 2D'
          }
        >
          <IconCameraStage width={12} height={12} />
          <span className="vn2d-cam-switch-txt">Lộ trình Cam</span>
          {cameraWaypoints.length > 0 && <em className="vn2d-count-badge">{cameraWaypoints.length}</em>}
        </button>

        {isCamDirectorMode ? (
          <>
            {lastEntityLabel && (
              <button
                type="button"
                className="vn2d-tool-btn vn2d-hide-narrow"
                onClick={onToggleCamDirectorMode}
                title={`Quay về chỉnh BBox của "${lastEntityLabel}"`}
              >
                <IconLayers width={11} height={11} />
                <span className="vn2d-entity-txt">{lastEntityLabel}</span>
              </button>
            )}

            {cameraWaypoints.length > 0 && (
              <div className="vn2d-seg-track" role="group" aria-label="Các mốc lộ trình Camera trong cảnh">
                {cameraWaypoints.map((wp, idx) => {
                  const isWpActive = node?.id === wp.id
                  const label = `#${(wp.params?.waypointLocalIndex ?? idx) + 1}`
                  return (
                    <button
                      key={wp.id}
                      type="button"
                      className={`vn2d-seg-item is-step${isWpActive ? ' active' : ''}`}
                      onClick={() => onSelectNode(wp.id)}
                      title={`${cleanV2NodeTitle(wp.title)} — Nhấp để nhảy tới mốc và kéo khung ngắm Camera`}
                    >
                      <span>{label}</span>
                    </button>
                  )
                })}
              </div>
            )}

            <button
              type="button"
              className="vn2d-tool-btn is-primary"
              onClick={() => onSpawnCameraWaypoint('zoom-in')}
              title="Thêm mốc Camera Đẩy cận (+ Zoom In) nối tiếp lộ trình quay"
            >
              <IconCamPushIn width={12} height={12} />
              <span>+ Đẩy cận</span>
            </button>

            <button
              type="button"
              className="vn2d-tool-btn vn2d-hide-narrow"
              onClick={() => onSpawnCameraWaypoint('pan')}
              title="Thêm mốc Camera Lia ngang (+ Pan) sang vùng khác trong cảnh"
            >
              <IconCamPanZoom2D width={12} height={12} />
              <span>+ Lia ngang</span>
            </button>
          </>
        ) : (
          <>
            {ctx.layerOrClusterNode && (
              <div className="vn2d-seg-track" role="group" aria-label="Đối tượng và các chặng BBox">
                <button
                  type="button"
                  className={`vn2d-seg-item is-entity${node?.id === ctx.layerOrClusterNode.id ? ' active' : ''}`}
                  onClick={() => onSelectNode(ctx.layerOrClusterNode!.id)}
                  title={`Đối tượng gốc: ${rawLabel} — Nhấp để chỉnh vị trí & cỡ BBox gốc`}
                >
                  {isClusterEntity ? <IconLock width={12} height={12} /> : <IconLayers width={12} height={12} />}
                  <span className="vn2d-entity-txt">{cleanShortTarget}</span>
                </button>

                {ctx.bboxSteps.map(({ node: step, number }) => (
                  <button
                    key={step.id}
                    type="button"
                    className={`vn2d-seg-item is-step${node?.id === step.id ? ' active' : ''}${!step.enabled ? ' is-off' : ''}`}
                    onClick={() => onSelectNode(step.id)}
                    title={`${step.title} — Kéo BBox #${number} → #${number + 1} trực tiếp trên khung`}
                  >
                    <IconGizmoBbox width={11} height={11} />
                    <span>
                      {number}→{number + 1}
                    </span>
                  </button>
                ))}

                {activeLogicNode && (
                  <button
                    type="button"
                    className="vn2d-seg-item active"
                    onClick={() => onSelectNode(activeLogicNode.id)}
                    title={`Đang chỉnh: ${activeLogicNode.title}`}
                  >
                    <IconNodeCircuit width={12} height={12} />
                    <span className="vn2d-logic-txt">{cleanV2NodeTitle(activeLogicNode.title)}</span>
                  </button>
                )}
              </div>
            )}

            {ctx.attachTargetNodeId && (
              <div className="vn2d-quick-tools" ref={menuWrapRef}>
                <button
                  type="button"
                  className="vn2d-tool-btn is-primary"
                  onClick={isOnBboxMotion ? onSpawnFollowupStep : onQuickSpawnBboxMotion}
                  title={
                    isOnBboxMotion
                      ? 'Nối thêm chặng BBox kế tiếp (+3s) xuất phát từ đích hiện tại'
                      : 'Tạo chuyển động kéo BBox Đầu → Đích (#1 → #2) trực tiếp trên khung'
                  }
                >
                  <IconPlus width={12} height={12} />
                  <span>{isOnBboxMotion ? 'Chặng tiếp' : 'BBox Đích'}</span>
                </button>

                <button
                  type="button"
                  className={`vn2d-tool-btn${isOnPathMotion ? ' active' : ''}`}
                  data-ai-id="toolbar-free-draw-path"
                  onClick={onQuickSpawnPathMotion}
                  aria-label="Vẽ quỹ đạo tự do"
                  title="Vẽ quỹ đạo chuyển động tự do trực tiếp bằng chuột trên Khung 2D"
                >
                  <IconPen width={12} height={12} />
                  <span className="vn2d-hide-compact">Vẽ tự do</span>
                </button>

                <button
                  type="button"
                  className={`vn2d-tool-btn${menuOpen ? ' active' : ''}`}
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  title="Chuyển nhanh giữa các Node đang gắn hoặc thêm Hành động / Hiệu ứng / Ánh sáng / Vietsub mới"
                >
                  <IconSparkles width={12} height={12} />
                  <span className="vn2d-action-txt">Hành động</span>
                  {ctx.logicNodes.length > 0 && <em className="vn2d-count-badge">{ctx.logicNodes.length}</em>}
                  <IconChevronDown width={11} height={11} />
                </button>

                <button
                  type="button"
                  className="vn2d-tool-btn vn2d-hide-compact"
                  onClick={onSyncCameraToEntity}
                  title={
                    isOnBboxMotion
                      ? 'Tự động tạo lộ trình Camera 3D lia bám mượt theo BBox #1 → #2 của đối tượng này'
                      : 'Đưa khung ngắm Camera 3D bắt gọn đối tượng đang chọn'
                  }
                >
                  <IconAim width={12} height={12} />
                  <span>{isOnBboxMotion ? 'Cam bám #1→#2' : 'Bám Cam'}</span>
                </button>

                {menuOpen && (
                  <div
                    className="vn2d-popover"
                    role="menu"
                    data-ai-surface="popup"
                    data-ai-surface-label="Menu Node & Hành động Khung 2D"
                  >
                    {ctx.logicNodes.length > 0 && (
                      <div className="vn2d-pop-section">
                        <div className="vn2d-pop-title">Đang gắn trên {cleanShortTarget}</div>
                        <div className="vn2d-pop-list">
                          {ctx.logicNodes.map((ln) => {
                            const th = resolveV2NodeTheme(ln)
                            const isSel =
                              node?.id === ln.id ||
                              Boolean(
                                ln.params?.isPartHub &&
                                  node?.params?.isPartChild &&
                                  node?.params?.hierarchyParentNodeId === ln.id
                              )
                            return (
                              <button
                                key={ln.id}
                                type="button"
                                role="menuitem"
                                className={`vn2d-pop-item${isSel ? ' active' : ''}`}
                                style={{ ['--logic-accent' as string]: th.accent }}
                                onClick={() => {
                                  onSelectNode(ln.id)
                                  setMenuOpen(false)
                                }}
                              >
                                <span className="vn2d-pop-dot" style={{ background: th.accent }} />
                                <span className="vn2d-pop-name">{cleanV2NodeTitle(ln.title)}</span>
                                <small>{th.badge}</small>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {ctx.partChildren.length > 0 && (
                      <div className="vn2d-pop-section">
                        <div className="vn2d-pop-title">Bộ phận con 2.5D</div>
                        <div className="vn2d-pop-grid">
                          {ctx.partChildren.map((ch) => (
                            <button
                              key={ch.id}
                              type="button"
                              role="menuitem"
                              className={`vn2d-pop-chip${node?.id === ch.id ? ' active' : ''}`}
                              onClick={() => {
                                onSelectNode(ch.id)
                                setMenuOpen(false)
                              }}
                            >
                              <span>{ch.params?.partGroupTitle || cleanV2NodeTitle(ch.title)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="vn2d-pop-section">
                      <div className="vn2d-pop-title">Tạo nhanh trên Khung 2D</div>
                      <div className="vn2d-pop-grid">
                        <button
                          type="button"
                          role="menuitem"
                          className="vn2d-pop-chip"
                          onClick={() => {
                            onQuickSpawnPathMotion()
                            setMenuOpen(false)
                          }}
                        >
                          <IconPen width={12} height={12} />
                          <span>Vẽ quỹ đạo tự do</span>
                        </button>
                        {canChainStep && !isOnBboxMotion && (
                          <button
                            type="button"
                            role="menuitem"
                            className="vn2d-pop-chip"
                            onClick={() => {
                              onSpawnFollowupStep()
                              setMenuOpen(false)
                            }}
                          >
                            <IconPlus width={12} height={12} />
                            <span>Nối chặng (+3s)</span>
                          </button>
                        )}
                        {ctx.compatibleCategories.map((cat) => (
                          <button
                            key={`${cat.id}-${cat.presetId ?? ''}`}
                            type="button"
                            role="menuitem"
                            className="vn2d-pop-chip"
                            style={{ ['--logic-accent' as string]: cat.accent }}
                            title={cat.hint}
                            onClick={() => {
                              onAttachLogic(ctx.attachTargetNodeId, cat.id, cat.presetId)
                              setMenuOpen(false)
                            }}
                          >
                            <span className="vn2d-pop-dot" style={{ background: cat.accent }} />
                            <span>{cat.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cụm Căn Nhanh Trái · Giữa · Phải trên màn rộng để lấp khoảng trống thanh trên hữu ích */}
            {ctx.activeLayer && (
              <div className="vn2d-seg-track vn2d-align-strip vn2d-hide-wide-only" role="group" aria-label="Căn vị trí nhanh trên khung 16:9">
                <button
                  type="button"
                  className="vn2d-icon-ctrl"
                  onClick={() => onQuickAlign('left')}
                  title="Đặt đối tượng sang vùng 1/3 Trái khung hình"
                  aria-label="Căn vùng trái"
                >
                  <IconAlignStageLeft width={12} height={12} />
                </button>
                <button
                  type="button"
                  className="vn2d-icon-ctrl"
                  onClick={() => onQuickAlign('center')}
                  title="Đặt đối tượng vào Chính giữa khung hình"
                  aria-label="Căn chính giữa"
                >
                  <IconAlignStageCenter width={12} height={12} />
                </button>
                <button
                  type="button"
                  className="vn2d-icon-ctrl"
                  onClick={() => onQuickAlign('right')}
                  title="Đặt đối tượng sang vùng 1/3 Phải khung hình"
                  aria-label="Căn vùng phải"
                >
                  <IconAlignStageRight width={12} height={12} />
                </button>
              </div>
            )}

            {ctx.clusterMemberCount > 1 && level === 'layer' && ctx.activeLayer && (
              <button
                type="button"
                className="vn2d-tool-btn vn2d-hide-narrow"
                onClick={onToggleScopeOverride}
                title="Chuyển phạm vi kéo giữa Riêng mảnh con đang chọn và Toàn bộ Cụm 2.5D"
              >
                {scopeOverride === 'cluster' ? <IconLock width={11} height={11} /> : <IconLayers width={11} height={11} />}
                <span>
                  {scopeOverride === 'cluster'
                    ? `Cả cụm (${ctx.clusterMemberCount})`
                    : getClusterPartShortName(ctx.activeLayer)}
                </span>
              </button>
            )}
          </>
        )}
      </div>

      {/* CỤM PHẢI: Chế độ 2.5D/Cảnh · Điều khiển chạy thử · Thu phóng · Chia đôi/Toàn khung */}
      <div className="vn2d-right-ops">
        {hasDualStage && (
          <div className="vn2d-seg-track" role="group" aria-label="Chuyển chế độ Khung 2.5D và Cảnh 2D">
            <button
              type="button"
              className={`vn2d-seg-item${!overrideSceneView ? ' active' : ''}`}
              onClick={() => onToggleOverrideSceneView(false)}
              title="Chỉnh trực tiếp vùng 2.5D / tia sáng / cửa hang / bộ phận"
            >
              <IconPad25D width={12} height={12} />
              <span>{primaryMode === 'part_25d' ? 'Bộ phận' : '2.5D'}</span>
            </button>
            <button
              type="button"
              className={`vn2d-seg-item${overrideSceneView ? ' active' : ''}`}
              onClick={() => onToggleOverrideSceneView(true)}
              title="Đặt vị trí BBox trên toàn khung Cảnh 16:9"
            >
              <IconCompFrame width={12} height={12} />
              <span>Cảnh</span>
            </button>
          </div>
        )}

        {node && (
          <div className="vn2d-transport-pill" role="group" aria-label="Phát thử và nhảy mốc Node">
            <button
              type="button"
              className="vn2d-icon-ctrl"
              onClick={() => onScrubTime(tStart)}
              title={`Về đầu khoảng chạy của Node (${tStart.toFixed(2)}s)`}
              aria-label="Về đầu Node"
            >
              <IconSkipStart width={12} height={12} />
            </button>
            <button
              type="button"
              className={`vn2d-icon-ctrl is-play${playing ? ' active' : ''}`}
              onClick={onTogglePlayNode}
              title={playing ? 'Dừng phát (Space)' : `Phát thử chuyển động (${tStart.toFixed(2)}s → ${tEnd.toFixed(2)}s)`}
              aria-label={playing ? 'Dừng phát' : 'Phát thử Node'}
            >
              {playing ? <IconPause width={12} height={12} /> : <IconPlay width={12} height={12} />}
            </button>
            <button
              type="button"
              className="vn2d-icon-ctrl"
              onClick={() => onScrubTime(tEnd)}
              title={`Tới đích khoảng chạy của Node (${tEnd.toFixed(2)}s)`}
              aria-label="Tới đích Node"
            >
              <IconSkipEnd width={12} height={12} />
            </button>
            <span className="vn2d-timecode" title={`Playhead: ${currentTime.toFixed(2)}s (${tStart.toFixed(1)}s–${tEnd.toFixed(1)}s)`}>
              {currentTime.toFixed(1)}s
            </span>
          </div>
        )}

        {(!hasDualStage || overrideSceneView) && (
          <button
            type="button"
            className="vn2d-fit-btn"
            onClick={onFitStage}
            title={`Đang hiển thị ${zoomPct}% — Nhấp để căn vừa khít khung 100% (Cuộn chuột để Zoom, Alt+Kéo để Lia)`}
            aria-label="Căn vừa khung 2D"
          >
            <IconFitStage2D width={13} height={13} />
            <span>{zoomPct}%</span>
          </button>
        )}

        {onOpenContextMenuAtButton && (
          <button
            type="button"
            className="vn2d-icon-ctrl is-expand"
            onClick={onOpenContextMenuAtButton}
            aria-label="Mở menu công cụ ngữ cảnh (Chuột phải)"
            title="Mở Menu Công Cụ Ngữ Cảnh (hoặc nhấp Chuột phải / Nhấn giữ trực tiếp lên Khung 2D)"
          >
            <IconContextDots width={13} height={13} />
          </button>
        )}

        <button
          type="button"
          className={`vn2d-icon-ctrl is-expand${!isSplitWithCam ? ' active' : ''}`}
          onClick={() => {
            if (isSplitWithCam) {
              viewState.openNodeStage2D('solo')
            } else {
              viewState.set({ activeViews: ['camera', 'node2d'], primary: 'node2d' })
            }
          }}
          aria-label={isSplitWithCam ? 'Phóng toàn khung 2D' : 'Chia đôi kèm Camera'}
          title={
            isSplitWithCam
              ? 'Phóng Màn Khung 2D chiếm trọn vùng Khung nhìn'
              : 'Chia đôi xem song song Camera Render + Màn Khung 2D'
          }
        >
          {isSplitWithCam ? <IconSingle width={13} height={13} /> : <IconSplit width={13} height={13} />}
        </button>
      </div>
    </div>
  )
}
