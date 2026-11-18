import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { getClusterPartShortName, getLayerDisplayName } from '../../../project/workflowV2Engine'
import {
  IconAim,
  IconAlignStageCenter,
  IconAlignStageGround,
  IconCamPanZoom2D,
  IconCamPullOut,
  IconCamPushIn,
  IconCameraStage,
  IconDepthBringFront,
  IconDepthPushBack,
  IconEye,
  IconFlipHorizontal,
  IconGizmoBbox,
  IconLayerAssembly,
  IconLayers,
  IconLock,
  IconPen,
  IconPropPosition,
  IconPropScale,
  IconTrash
} from '../../icons'
import { isDeletableV2Node } from '../../workflow/WorkflowNodeCardV2'
import {
  cleanV2NodeTitle,
  resolveV2LogicCategory,
  resolveV2NodeLevel,
  type WorkflowV2SpawnCategory
} from '../../workflow/workflowV2Theme'
import type { StageContextHitInfo, StageQuickAlignPreset } from './nodeStageQuickActions'
import type { StageLayerNodeContext } from './resolveNodeStageTarget'

export interface NodeStage2DContextMenuProps {
  hit: StageContextHitInfo
  node: WorkflowNode | null
  ctx: StageLayerNodeContext
  isCamDirectorMode: boolean
  useClusterTransform: boolean
  onClose: () => void
  onPlaceBbox2Here: (hit: StageContextHitInfo) => void
  onMoveEntityHere: (hit: StageContextHitInfo) => void
  onAimCameraHere: (hit: StageContextHitInfo) => void
  onSyncCameraToEntity: () => void
  onQuickSpawnPathMotion: () => void
  onToggleCamDirectorMode: () => void
  onSpawnCameraWaypoint: (mode: 'pan' | 'zoom-in' | 'zoom-out' | 'hold') => void
  onFlipHorizontal: () => void
  onQuickAlign: (preset: StageQuickAlignPreset) => void
  onResetScale: () => void
  onStepDepthZ: (deltaZ: number) => void
  onToggleScopeOverride: () => void
  onOpenLayerWorkshop: () => void
  onSelectNode: (nodeId: string) => void
  onAttachLogic: (
    layerNodeId: string,
    category: WorkflowV2SpawnCategory,
    presetId?: string,
    extraParams?: Partial<WorkflowNodeParams>,
    customTitle?: string
  ) => void
  onToggleEnableNode: (nodeId: string) => void
  onDeleteNode: (nodeId: string) => void
}

export const NodeStage2DContextMenu: React.FC<NodeStage2DContextMenuProps> = ({
  hit,
  node,
  ctx,
  isCamDirectorMode,
  useClusterTransform,
  onClose,
  onPlaceBbox2Here,
  onMoveEntityHere,
  onAimCameraHere,
  onSyncCameraToEntity,
  onQuickSpawnPathMotion,
  onToggleCamDirectorMode,
  onSpawnCameraWaypoint,
  onFlipHorizontal,
  onQuickAlign,
  onResetScale,
  onStepDepthZ,
  onToggleScopeOverride,
  onOpenLayerWorkshop,
  onSelectNode,
  onAttachLogic,
  onToggleEnableNode,
  onDeleteNode
}) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: hit.clientX, top: hit.clientY })

  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const left = Math.max(8, Math.min(hit.clientX, vw - rect.width - 8))
    const top = Math.max(8, Math.min(hit.clientY, vh - rect.height - 8))
    setPos({ left, top })
  }, [hit.clientX, hit.clientY])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const hasEntity = Boolean(ctx.activeLayer)
  const hasComposite = Boolean(ctx.activeLayer?.composite?.compositeId)
  const logicCat = node ? resolveV2LogicCategory(node) : undefined
  const isOnBboxMotion = Boolean(node && logicCat === 'action' && node.params?.motionMode === 'bbox')
  const canManageNode = Boolean(node && resolveV2NodeLevel(node) === 'logic' && logicCat !== 'cluster_lock')
  const canDeleteNode = Boolean(node && isDeletableV2Node(node))

  const rawLabel = ctx.activeLayer
    ? getLayerDisplayName(ctx.activeLayer)
    : node
      ? cleanV2NodeTitle(node.title)
      : 'Sân khấu Cảnh 2D'
  const cleanTitle = rawLabel.replace(/\s*—.*$/, '').trim() || rawLabel

  const kicker = isCamDirectorMode
    ? 'Lộ trình Camera'
    : ctx.clusterMemberCount > 1
      ? useClusterTransform
        ? `Cụm 2.5D · ${ctx.clusterMemberCount} mảnh`
        : `Mảnh con · ${ctx.activeLayer ? getClusterPartShortName(ctx.activeLayer) : ''}`
      : hasEntity
        ? 'Layer 2.5D'
        : 'Sân khấu 2D'

  const runAndClose = (fn: () => void) => () => {
    fn()
    onClose()
  }

  return createPortal(
    <>
      <div
        className="vn2d-context-backdrop"
        onClick={onClose}
        onPointerDown={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        ref={menuRef}
        className="vn2d-context-menu"
        data-mcp-region="viewer_node2d_context_menu"
        role="menu"
        data-ai-surface="popup"
        data-ai-surface-label="Menu Chuột Phải Khung 2D"
        style={{ left: pos.left, top: pos.top }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="vn2d-ctx-header">
          <div className="vn2d-ctx-title-wrap">
            <span className="vn2d-ctx-kicker">{kicker}</span>
            <strong className="vn2d-ctx-title">{cleanTitle}</strong>
          </div>
          <span className="vn2d-ctx-coords" title="Toạ độ không gian 2.5D tại điểm nhấp chuột phải">
            X {hit.worldX} · Y {hit.worldY}
          </span>
        </div>

        {/* Nhóm 1: Thao tác đặt trực tiếp tại vị trí chuột phải & Đồng bộ Camera */}
        <div className="vn2d-ctx-sec">
          <span className="vn2d-ctx-sec-label">Tại vị trí con trỏ &amp; Chuyển động</span>
          <div className="vn2d-ctx-grid">
            {hasEntity && (
              <button
                type="button"
                role="menuitem"
                className="vn2d-ctx-btn is-primary is-span-2"
                onClick={runAndClose(() => onPlaceBbox2Here(hit))}
                title="Đặt khung BBox Đích #2 tới đúng vị trí vừa nhấp chuột phải (tự tạo Node BBox nếu chưa có)"
              >
                <IconGizmoBbox width={13} height={13} />
                <span>Đặt BBox Đích #2 tới điểm này ({hit.worldX}, {hit.worldY})</span>
              </button>
            )}

            {hasEntity && (
              <button
                type="button"
                role="menuitem"
                className="vn2d-ctx-btn"
                onClick={runAndClose(() => onMoveEntityHere(hit))}
                title="Dời gốc của Đối tượng / Cụm 2.5D tới vị trí con trỏ"
              >
                <IconPropPosition width={13} height={13} />
                <span>Dời tới điểm này</span>
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              className={`vn2d-ctx-btn${!hasEntity ? ' is-span-2' : ''}`}
              onClick={runAndClose(() => onAimCameraHere(hit))}
              title="Lia tâm khung ngắm Camera tới đúng điểm vừa nhấp trên cảnh"
            >
              <IconAim width={13} height={13} />
              <span>Lia Cam tới đây</span>
            </button>

            {hasEntity && (
              <button
                type="button"
                role="menuitem"
                className="vn2d-ctx-btn"
                onClick={runAndClose(onQuickSpawnPathMotion)}
                title="Chuyển sang vẽ tay đường đi chuyển động tự do trên sân khấu"
              >
                <IconPen width={13} height={13} />
                <span>Vẽ quỹ đạo tự do</span>
              </button>
            )}

            {hasEntity && (
              <button
                type="button"
                role="menuitem"
                className="vn2d-ctx-btn is-cam"
                onClick={runAndClose(onSyncCameraToEntity)}
                title="Tự động tạo keyframe Camera 3D lia bám theo BBox #1→#2 hoặc bắt gọn chủ thể"
              >
                <IconCameraStage width={13} height={13} />
                <span>{isOnBboxMotion ? 'Cam bám #1→#2' : 'Cam bắt chủ thể'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Nhóm 2: Đạo diễn Lộ trình Camera ngay trên Màn Khung 2D */}
        <div className="vn2d-ctx-sec">
          <span className="vn2d-ctx-sec-label">Lộ trình Camera trên Khung 2D</span>
          <div className="vn2d-ctx-grid">
            <button
              type="button"
              role="menuitem"
              className="vn2d-ctx-btn"
              onClick={runAndClose(() => onSpawnCameraWaypoint('zoom-in'))}
            >
              <IconCamPushIn width={13} height={13} />
              <span>+ Mốc Đẩy cận</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="vn2d-ctx-btn"
              onClick={runAndClose(() => onSpawnCameraWaypoint('pan'))}
            >
              <IconCamPanZoom2D width={13} height={13} />
              <span>+ Mốc Lia ngang</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="vn2d-ctx-btn"
              onClick={runAndClose(() => onSpawnCameraWaypoint('zoom-out'))}
            >
              <IconCamPullOut width={13} height={13} />
              <span>+ Mốc Kéo rộng</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className={`vn2d-ctx-btn${isCamDirectorMode ? ' active' : ''}`}
              onClick={runAndClose(onToggleCamDirectorMode)}
            >
              <IconCameraStage width={13} height={13} />
              <span>{isCamDirectorMode ? 'Về Đối tượng' : 'Mở các mốc Cam'}</span>
            </button>
          </div>
        </div>

        {/* Nhóm 3: Biến đổi nhanh Đối tượng / Cụm 2.5D */}
        {hasEntity && (
          <div className="vn2d-ctx-sec">
            <span className="vn2d-ctx-sec-label">Biến đổi nhanh &amp; Cụm 2.5D</span>
            <div className="vn2d-ctx-grid">
              <button type="button" role="menuitem" className="vn2d-ctx-btn" onClick={runAndClose(onFlipHorizontal)}>
                <IconFlipHorizontal width={13} height={13} />
                <span>Lật ngang (Flip X)</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="vn2d-ctx-btn"
                onClick={runAndClose(() => onQuickAlign('center'))}
              >
                <IconAlignStageCenter width={13} height={13} />
                <span>Căn giữa khung</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="vn2d-ctx-btn"
                onClick={runAndClose(() => onQuickAlign('ground'))}
              >
                <IconAlignStageGround width={13} height={13} />
                <span>Đặt chạm mặt đất</span>
              </button>
              <button type="button" role="menuitem" className="vn2d-ctx-btn" onClick={runAndClose(onResetScale)}>
                <IconPropScale width={13} height={13} />
                <span>Đặt lại cỡ chuẩn</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="vn2d-ctx-btn"
                onClick={runAndClose(() => onStepDepthZ(-80))}
              >
                <IconDepthBringFront width={13} height={13} />
                <span>Gần Cam (Z -80)</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="vn2d-ctx-btn"
                onClick={runAndClose(() => onStepDepthZ(80))}
              >
                <IconDepthPushBack width={13} height={13} />
                <span>Lùi nền (Z +80)</span>
              </button>

              {ctx.clusterMemberCount > 1 && (
                <button
                  type="button"
                  role="menuitem"
                  className="vn2d-ctx-btn"
                  onClick={runAndClose(onToggleScopeOverride)}
                >
                  {useClusterTransform ? <IconLayers width={13} height={13} /> : <IconLock width={13} height={13} />}
                  <span>{useClusterTransform ? 'Chỉnh riêng mảnh' : `Khoá cả cụm (${ctx.clusterMemberCount})`}</span>
                </button>
              )}

              {hasComposite && (
                <button
                  type="button"
                  role="menuitem"
                  className={`vn2d-ctx-btn${ctx.clusterMemberCount <= 1 ? ' is-span-2' : ''}`}
                  onClick={runAndClose(onOpenLayerWorkshop)}
                >
                  <IconLayerAssembly width={13} height={13} />
                  <span>Mở Xưởng 2.5D</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Nhóm 4: Gắn hoặc chuyển nhanh sang các Node Logic 2.5D */}
        {ctx.attachTargetNodeId && (ctx.compatibleCategories ?? []).length > 0 && (
          <div className="vn2d-ctx-sec">
            <span className="vn2d-ctx-sec-label">Node Logic &amp; Hiệu ứng 2.5D</span>
            <div className="vn2d-ctx-grid">
              {(ctx.compatibleCategories ?? [])
                .filter((c) => c.id !== 'action')
                .map((cat) => {
                  const attached = ctx.logicNodes.find(
                    (ln) =>
                      resolveV2LogicCategory(ln) === cat.id &&
                      (!cat.presetId || !ln.preset || ln.preset === cat.presetId)
                  )
                  const isActive = Boolean(attached && node?.id === attached.id)
                  return (
                    <button
                      key={`ctx-${cat.id}-${cat.presetId ?? ''}`}
                      type="button"
                      role="menuitem"
                      className={`vn2d-ctx-btn${isActive ? ' active' : ''}`}
                      style={{ ['--logic-accent' as string]: cat.accent }}
                      title={cat.hint}
                      onClick={runAndClose(() => {
                        if (attached) {
                          onSelectNode(attached.id)
                        } else {
                          onAttachLogic(ctx.attachTargetNodeId, cat.id, cat.presetId)
                        }
                      })}
                    >
                      <span className="vn2d-pop-dot" style={{ background: cat.accent }} />
                      <span>{cat.label}</span>
                    </button>
                  )
                })}
            </div>
          </div>
        )}

        {/* Nhóm 5: Bật/Tắt hoặc Xoá Node đang đứng */}
        {(canManageNode || canDeleteNode) && node && (
          <div className="vn2d-ctx-sec">
            <div className="vn2d-ctx-grid">
              {canManageNode && (
                <button
                  type="button"
                  role="menuitem"
                  className={`vn2d-ctx-btn${!canDeleteNode ? ' is-span-2' : ''}`}
                  onClick={runAndClose(() => onToggleEnableNode(node.id))}
                >
                  <IconEye width={13} height={13} />
                  <span>{node.enabled ? 'Tạm tắt Node này' : 'Bật lại Node này'}</span>
                </button>
              )}
              {canDeleteNode && (
                <button
                  type="button"
                  role="menuitem"
                  className={`vn2d-ctx-btn is-danger${!canManageNode ? ' is-span-2' : ''}`}
                  onClick={runAndClose(() => onDeleteNode(node.id))}
                >
                  <IconTrash width={13} height={13} />
                  <span>Xoá Node đang chọn</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  )
}
