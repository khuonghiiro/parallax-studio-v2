import React, { useEffect, useRef, useState } from 'react'
import type { Project, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { effectiveTimeParams } from '../../../project/workflowTiming'
import { getClusterPartShortName, getLayerDisplayName } from '../../../project/workflowV2Engine'
import { useView } from '../../../store/view'
import { StudioTooltip } from '../../controls/StudioTooltip'
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
      {/* CỤM TRÁI & GIỮA: Chuyển Lộ trình Camera · Đối tượng & Chặng BBox · Thao tác chính */}
      <div className="vn2d-left-track">
        <StudioTooltip
          title={isCamDirectorMode ? 'Quay về chỉnh Đối tượng' : 'Đạo diễn Lộ trình Camera'}
          badge={cameraWaypoints.length > 0 ? `${cameraWaypoints.length} mốc` : 'Camera'}
          badgeTone="green"
          description={
            isCamDirectorMode
              ? `Trở lại chỉnh BBox của "${lastEntityLabel || 'Đối tượng'}" trên Khung 2D`
              : 'Chuyển sang chỉnh các mốc khung ngắm Camera (#1 → #2 → #3) trực tiếp trên Khung 2D'
          }
          placement="bottom"
        >
          <button
            type="button"
            className={`vn2d-tool-btn is-cam-switch${isCamDirectorMode ? ' active' : ''}`}
            onClick={onToggleCamDirectorMode}
            aria-label="Đạo diễn Lộ trình Camera"
          >
            <IconCameraStage width={12} height={12} />
            <span className="vn2d-cam-switch-txt">Lộ trình Cam</span>
            {cameraWaypoints.length > 0 && <em className="vn2d-count-badge">{cameraWaypoints.length}</em>}
          </button>
        </StudioTooltip>

        {isCamDirectorMode ? (
          <>
            {lastEntityLabel && (
              <StudioTooltip
                title={`Quay về "${lastEntityLabel}"`}
                badge="Đối tượng"
                badgeTone="cyan"
                description="Trở lại chỉnh vị trí & chuyển động BBox của đối tượng trên sân khấu"
                placement="bottom"
              >
                <button
                  type="button"
                  className="vn2d-tool-btn vn2d-hide-narrow"
                  onClick={onToggleCamDirectorMode}
                  aria-label={`Quay về chỉnh ${lastEntityLabel}`}
                >
                  <IconLayers width={11} height={11} />
                  <span className="vn2d-entity-txt">{lastEntityLabel}</span>
                </button>
              </StudioTooltip>
            )}

            {cameraWaypoints.length > 0 && (
              <div className="vn2d-seg-track" role="group" aria-label="Các mốc lộ trình Camera trong cảnh">
                {cameraWaypoints.map((wp, idx) => {
                  const isWpActive = node?.id === wp.id
                  const label = `#${(wp.params?.waypointLocalIndex ?? idx) + 1}`
                  return (
                    <StudioTooltip
                      key={wp.id}
                      title={cleanV2NodeTitle(wp.title)}
                      badge={isWpActive ? 'Đang chọn' : `Mốc ${label}`}
                      badgeTone={isWpActive ? 'green' : 'cyan'}
                      description="Nhấp để nhảy tới mốc và kéo khung ngắm Camera trực tiếp"
                      placement="bottom"
                    >
                      <button
                        type="button"
                        className={`vn2d-seg-item is-step${isWpActive ? ' active' : ''}`}
                        onClick={() => onSelectNode(wp.id)}
                        aria-label={`Mốc Camera ${label}`}
                      >
                        <span>{label}</span>
                      </button>
                    </StudioTooltip>
                  )
                })}
              </div>
            )}

            <StudioTooltip
              title="Thêm mốc Camera Đẩy cận"
              badge="+ Zoom In"
              badgeTone="green"
              description="Tạo mốc khung ngắm thu hẹp nối tiếp vào lộ trình quay của cảnh"
              placement="bottom"
            >
              <button
                type="button"
                className="vn2d-tool-btn is-primary"
                onClick={() => onSpawnCameraWaypoint('zoom-in')}
                aria-label="Thêm mốc Đẩy cận"
              >
                <IconCamPushIn width={12} height={12} />
                <span>+ Đẩy cận</span>
              </button>
            </StudioTooltip>

            <StudioTooltip
              title="Thêm mốc Camera Lia ngang"
              badge="+ Pan"
              badgeTone="cyan"
              description="Tạo mốc lia máy sang vị trí khác trong cảnh mà giữ nguyên độ phóng"
              placement="bottom"
            >
              <button
                type="button"
                className="vn2d-tool-btn vn2d-hide-narrow"
                onClick={() => onSpawnCameraWaypoint('pan')}
                aria-label="Thêm mốc Lia ngang"
              >
                <IconCamPanZoom2D width={12} height={12} />
                <span>+ Lia ngang</span>
              </button>
            </StudioTooltip>
          </>
        ) : (
          <>
            {ctx.layerOrClusterNode && (
              <div className="vn2d-seg-track" role="group" aria-label="Đối tượng và các chặng BBox">
                <StudioTooltip
                  title={rawLabel}
                  badge={isClusterEntity ? 'Cụm 2.5D' : 'Layer gốc'}
                  badgeTone={node?.id === ctx.layerOrClusterNode.id ? 'green' : 'cyan'}
                  description="Nhấp để chỉnh vị trí gốc và kích thước chuẩn của đối tượng trên cảnh"
                  placement="bottom"
                >
                  <button
                    type="button"
                    className={`vn2d-seg-item is-entity${node?.id === ctx.layerOrClusterNode.id ? ' active' : ''}`}
                    onClick={() => onSelectNode(ctx.layerOrClusterNode!.id)}
                    aria-label={`Đối tượng gốc ${cleanShortTarget}`}
                  >
                    {isClusterEntity ? <IconLock width={12} height={12} /> : <IconLayers width={12} height={12} />}
                    <span className="vn2d-entity-txt">{cleanShortTarget}</span>
                  </button>
                </StudioTooltip>

                {ctx.bboxSteps.map(({ node: step, number }) => {
                  const isStepActive = node?.id === step.id
                  return (
                    <StudioTooltip
                      key={step.id}
                      title={cleanV2NodeTitle(step.title)}
                      badge={`Chặng ${number}→${number + 1}`}
                      badgeTone={isStepActive ? 'green' : 'cyan'}
                      description={`Kéo khung BBox #${number} → #${number + 1}, uốn đường cong hoặc xoay 3D trực tiếp`}
                      placement="bottom"
                    >
                      <button
                        type="button"
                        className={`vn2d-seg-item is-step${isStepActive ? ' active' : ''}${!step.enabled ? ' is-off' : ''}`}
                        onClick={() => onSelectNode(step.id)}
                        aria-label={`Chặng BBox ${number} sang ${number + 1}`}
                      >
                        <IconGizmoBbox width={11} height={11} />
                        <span>
                          {number}→{number + 1}
                        </span>
                      </button>
                    </StudioTooltip>
                  )
                })}

                {ctx.attachTargetNodeId && ctx.bboxSteps.length > 0 && (
                  <StudioTooltip
                    title="Nối thêm chặng BBox kế tiếp"
                    badge="+3s"
                    badgeTone="cyan"
                    description="Tạo tiếp chặng BBox mới xuất phát nối liền từ vị trí đích hiện tại"
                    placement="bottom"
                  >
                    <button
                      type="button"
                      className="vn2d-seg-item is-add-step"
                      onClick={isOnBboxMotion ? onSpawnFollowupStep : onQuickSpawnBboxMotion}
                      aria-label="Nối chặng BBox kế tiếp"
                    >
                      <IconPlus width={11} height={11} />
                    </button>
                  </StudioTooltip>
                )}

                {activeLogicNode && (
                  <StudioTooltip
                    title={cleanV2NodeTitle(activeLogicNode.title)}
                    badge="Đang chỉnh"
                    badgeTone="amber"
                    description="Node hiệu ứng / logic đang kích hoạt trên đối tượng này"
                    placement="bottom"
                  >
                    <button
                      type="button"
                      className="vn2d-seg-item active"
                      onClick={() => onSelectNode(activeLogicNode.id)}
                      aria-label={`Đang chỉnh ${cleanV2NodeTitle(activeLogicNode.title)}`}
                    >
                      <IconNodeCircuit width={12} height={12} />
                      <span className="vn2d-logic-txt">{cleanV2NodeTitle(activeLogicNode.title)}</span>
                    </button>
                  </StudioTooltip>
                )}
              </div>
            )}

            {ctx.attachTargetNodeId && (
              <div className="vn2d-quick-tools" ref={menuWrapRef}>
                {ctx.bboxSteps.length === 0 && (
                  <StudioTooltip
                    title="Tạo chuyển động BBox #1 → #2"
                    badge="Motion"
                    badgeTone="cyan"
                    description="Đặt ngay khung BBox Đích để kéo hướng di chuyển, tỉ lệ & uốn đường cong"
                    placement="bottom"
                  >
                    <button
                      type="button"
                      className="vn2d-tool-btn is-primary"
                      onClick={onQuickSpawnBboxMotion}
                      aria-label="Thêm BBox Đích"
                    >
                      <IconPlus width={12} height={12} />
                      <span>BBox Đích</span>
                    </button>
                  </StudioTooltip>
                )}

                <StudioTooltip
                  title="Danh sách Node & Thêm Hành động"
                  badge={`${ctx.logicNodes.length} Node`}
                  badgeTone="cyan"
                  description="Chuyển nhanh giữa các Node đang gắn hoặc thêm Hành động, Hiệu ứng, Ánh sáng, Vietsub"
                  placement="bottom"
                  disabled={menuOpen}
                >
                  <button
                    type="button"
                    className={`vn2d-tool-btn${menuOpen ? ' active' : ''}`}
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-label="Menu Hành động và Node"
                  >
                    <IconSparkles width={12} height={12} />
                    <span className="vn2d-action-txt">Hành động</span>
                    {ctx.logicNodes.length > 0 && <em className="vn2d-count-badge">{ctx.logicNodes.length}</em>}
                    <IconChevronDown width={11} height={11} />
                  </button>
                </StudioTooltip>

                <StudioTooltip
                  title={isOnBboxMotion ? 'Camera bám theo BBox #1 → #2' : 'Đưa Camera bắt gọn đối tượng'}
                  badge="Camera 3D"
                  badgeTone="green"
                  description={
                    isOnBboxMotion
                      ? 'Tự động tạo lộ trình Camera 3D lia bám mượt từ BBox #1 sang BBox #2'
                      : 'Lia tâm khung ngắm Camera 3D hiện tại vào đúng đối tượng đang chọn'
                  }
                  placement="bottom"
                >
                  <button
                    type="button"
                    className="vn2d-tool-btn vn2d-hide-compact"
                    onClick={onSyncCameraToEntity}
                    aria-label={isOnBboxMotion ? 'Camera bám BBox 1 sang 2' : 'Bám Camera'}
                  >
                    <IconAim width={12} height={12} />
                    <span>{isOnBboxMotion ? 'Cam bám' : 'Bám Cam'}</span>
                  </button>
                </StudioTooltip>

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

            {/* Cụm Căn Nhanh chỉ gồm Icon -> bọc StudioTooltip theo chuẩn tooltip-standard */}
            {ctx.activeLayer && (
              <div
                className="vn2d-seg-track vn2d-align-strip vn2d-hide-wide-only"
                role="group"
                aria-label="Căn vị trí nhanh trên khung 16:9"
              >
                <StudioTooltip
                  title="Căn vùng 1/3 Trái"
                  badge="Trái"
                  badgeTone="neutral"
                  description="Đặt đối tượng sang đường bố cục 1/3 bên trái khung hình"
                  placement="bottom"
                >
                  <button
                    type="button"
                    className="vn2d-icon-ctrl"
                    onClick={() => onQuickAlign('left')}
                    aria-label="Căn vùng trái"
                  >
                    <IconAlignStageLeft width={12} height={12} />
                  </button>
                </StudioTooltip>
                <StudioTooltip
                  title="Căn chính giữa khung"
                  badge="Giữa"
                  badgeTone="neutral"
                  description="Đưa đối tượng về ngay tâm khung cảnh 16:9"
                  placement="bottom"
                >
                  <button
                    type="button"
                    className="vn2d-icon-ctrl"
                    onClick={() => onQuickAlign('center')}
                    aria-label="Căn chính giữa"
                  >
                    <IconAlignStageCenter width={12} height={12} />
                  </button>
                </StudioTooltip>
                <StudioTooltip
                  title="Căn vùng 1/3 Phải"
                  badge="Phải"
                  badgeTone="neutral"
                  description="Đặt đối tượng sang đường bố cục 1/3 bên phải khung hình"
                  placement="bottom"
                >
                  <button
                    type="button"
                    className="vn2d-icon-ctrl"
                    onClick={() => onQuickAlign('right')}
                    aria-label="Căn vùng phải"
                  >
                    <IconAlignStageRight width={12} height={12} />
                  </button>
                </StudioTooltip>
              </div>
            )}

            {ctx.clusterMemberCount > 1 && level === 'layer' && ctx.activeLayer && (
              <StudioTooltip
                title="Phạm vi kéo BBox Cụm 2.5D"
                badge={scopeOverride === 'cluster' ? 'Toàn cụm' : 'Riêng mảnh'}
                badgeTone="amber"
                description="Chuyển giữa kéo riêng mảnh bộ phận đang chọn hoặc kéo đồng bộ toàn bộ Cụm 2.5D"
                placement="bottom"
              >
                <button
                  type="button"
                  className="vn2d-tool-btn vn2d-hide-narrow"
                  onClick={onToggleScopeOverride}
                  aria-label="Chuyển phạm vi kéo Cụm hoặc Mảnh"
                >
                  {scopeOverride === 'cluster' ? <IconLock width={11} height={11} /> : <IconLayers width={11} height={11} />}
                  <span>
                    {scopeOverride === 'cluster'
                      ? `Cả cụm (${ctx.clusterMemberCount})`
                      : getClusterPartShortName(ctx.activeLayer)}
                  </span>
                </button>
              </StudioTooltip>
            )}
          </>
        )}
      </div>

      {/* CỤM PHẢI: Các nút điều khiển Icon bọc StudioTooltip chuẩn Studio */}
      <div className="vn2d-right-ops">
        {hasDualStage && (
          <div className="vn2d-seg-track" role="group" aria-label="Chuyển chế độ Khung 2.5D và Cảnh 2D">
            <StudioTooltip
              title={primaryMode === 'part_25d' ? 'Khung Bộ phận 2.5D' : 'Bàn điều khiển 2.5D'}
              badge={!overrideSceneView ? 'Đang mở' : '2.5D'}
              badgeTone="cyan"
              description="Chỉnh trực tiếp vùng tia sáng, cửa hang chiều sâu hoặc đổi bộ phận nhân vật"
              placement="bottom"
            >
              <button
                type="button"
                className={`vn2d-seg-item${!overrideSceneView ? ' active' : ''}`}
                onClick={() => onToggleOverrideSceneView(false)}
                aria-label={primaryMode === 'part_25d' ? 'Chế độ Bộ phận 2.5D' : 'Chế độ 2.5D'}
              >
                <IconPad25D width={12} height={12} />
                <span>{primaryMode === 'part_25d' ? 'Bộ phận' : '2.5D'}</span>
              </button>
            </StudioTooltip>
            <StudioTooltip
              title="Đặt BBox trên toàn Cảnh 16:9"
              badge={overrideSceneView ? 'Đang mở' : 'Cảnh'}
              badgeTone="green"
              description="Xem và kéo đặt vị trí đối tượng trực tiếp trên toàn khung cảnh 16:9"
              placement="bottom"
            >
              <button
                type="button"
                className={`vn2d-seg-item${overrideSceneView ? ' active' : ''}`}
                onClick={() => onToggleOverrideSceneView(true)}
                aria-label="Chế độ toàn Cảnh 16:9"
              >
                <IconCompFrame width={12} height={12} />
                <span>Cảnh</span>
              </button>
            </StudioTooltip>
          </div>
        )}

        {node && (
          <div className="vn2d-transport-pill" role="group" aria-label="Phát thử và nhảy mốc Node">
            <StudioTooltip
              title="Về đầu khoảng chạy Node"
              badge={`${tStart.toFixed(2)}s`}
              badgeTone="cyan"
              description="Đưa đầu đọc Playhead về đúng mốc bắt đầu của Node đang chọn"
              placement="bottom"
            >
              <button
                type="button"
                className="vn2d-icon-ctrl"
                onClick={() => onScrubTime(tStart)}
                aria-label="Về đầu Node"
              >
                <IconSkipStart width={12} height={12} />
              </button>
            </StudioTooltip>
            <StudioTooltip
              title={playing ? 'Dừng phát thử' : 'Phát thử chuyển động'}
              badge="Space"
              badgeTone="green"
              description="Xem trực tiếp hành trình chuyển động trên cả Khung 2D và Camera 3D"
              meta={`Khoảng chạy: ${tStart.toFixed(2)}s → ${tEnd.toFixed(2)}s`}
              placement="bottom"
            >
              <button
                type="button"
                className={`vn2d-icon-ctrl is-play${playing ? ' active' : ''}`}
                onClick={onTogglePlayNode}
                aria-label={playing ? 'Dừng phát' : 'Phát thử Node'}
              >
                {playing ? <IconPause width={12} height={12} /> : <IconPlay width={12} height={12} />}
              </button>
            </StudioTooltip>
            <StudioTooltip
              title="Tới đích khoảng chạy Node"
              badge={`${tEnd.toFixed(2)}s`}
              badgeTone="amber"
              description="Nhảy nhanh tới thời điểm kết thúc để kiểm tra tư thế & vị trí đích"
              placement="bottom"
            >
              <button
                type="button"
                className="vn2d-icon-ctrl"
                onClick={() => onScrubTime(tEnd)}
                aria-label="Tới đích Node"
              >
                <IconSkipEnd width={12} height={12} />
              </button>
            </StudioTooltip>
            <span className="vn2d-timecode" title={`Playhead: ${currentTime.toFixed(2)}s (${tStart.toFixed(1)}s–${tEnd.toFixed(1)}s)`}>
              {currentTime.toFixed(1)}s
            </span>
          </div>
        )}

        {(!hasDualStage || overrideSceneView) && (
          <StudioTooltip
            title="Căn vừa khít khung 100%"
            badge={`${zoomPct}%`}
            badgeTone="neutral"
            description="Đặt lại độ thu phóng & vị trí lia bàn dựng (Cuộn chuột để Zoom, Alt+Kéo để Lia)"
            placement="bottom"
          >
            <button
              type="button"
              className="vn2d-fit-btn"
              onClick={onFitStage}
              aria-label="Căn vừa khung 2D"
            >
              <IconFitStage2D width={13} height={13} />
              <span>{zoomPct}%</span>
            </button>
          </StudioTooltip>
        )}

        {onOpenContextMenuAtButton && (
          <StudioTooltip
            title="Menu công cụ ngữ cảnh"
            badge="Chuột phải"
            badgeTone="cyan"
            description="Mở bảng thao tác nhanh theo Đối tượng / Cụm / Camera (hoặc Chuột phải lên sân khấu)"
            placement="bottom"
          >
            <button
              type="button"
              className="vn2d-icon-ctrl is-expand"
              onClick={onOpenContextMenuAtButton}
              aria-label="Mở menu công cụ ngữ cảnh (Chuột phải)"
            >
              <IconContextDots width={13} height={13} />
            </button>
          </StudioTooltip>
        )}

        <StudioTooltip
          title={isSplitWithCam ? 'Phóng toàn vùng Khung nhìn' : 'Chia đôi kèm Camera 3D'}
          badge={isSplitWithCam ? 'Toàn khung' : 'Chia đôi'}
          badgeTone="cyan"
          description={
            isSplitWithCam
              ? 'Mở rộng Màn Khung 2D chiếm trọn khu vực trung tâm để chỉnh sửa rộng rãi'
              : 'Xem song song kết quả Camera 3D bên trái và Màn Khung 2D bên phải'
          }
          placement="bottom"
        >
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
          >
            {isSplitWithCam ? <IconSingle width={13} height={13} /> : <IconSplit width={13} height={13} />}
          </button>
        </StudioTooltip>
      </div>
    </div>
  )
}
