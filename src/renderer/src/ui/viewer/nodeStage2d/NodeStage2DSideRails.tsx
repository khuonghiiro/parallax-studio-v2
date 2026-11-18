import React from 'react'
import type { WorkflowNode, WorkflowNodeParams } from '@shared/types'
import {
  IconAim,
  IconAlignStageCenter,
  IconAlignStageGround,
  IconBone,
  IconCamPanZoom2D,
  IconCamPullOut,
  IconCamPushIn,
  IconCinematicClapper,
  IconDepth25D,
  IconDepthBringFront,
  IconDepthPushBack,
  IconEaseHold,
  IconFlipHorizontal,
  IconGizmoBbox,
  IconLayerAssembly,
  IconLoopAnimate,
  IconMusic,
  IconOrbitCenter0,
  IconOrbitLeft25,
  IconOrbitRight25,
  IconPen,
  IconPerspective2D,
  IconPuzzle,
  IconRuleOfThirds,
  IconSelectPointer,
  IconSparkles,
  IconSun,
  IconVoiceDialogue,
  IconZoomIn,
  IconZoomOut
} from '../../icons'
import {
  resolveV2LogicCategory,
  resolveV2NodeLevel,
  type WorkflowV2SpawnCategory
} from '../../workflow/workflowV2Theme'
import type { StageLayerNodeContext } from './resolveNodeStageTarget'
import type { StageQuickAlignPreset } from './nodeStageQuickActions'

export interface NodeStage2DSideRailsProps {
  node: WorkflowNode | null
  ctx: StageLayerNodeContext
  isCamDirectorMode: boolean
  showCameraGuide: boolean
  activeShotId: string | null
  onSelectEntityRoot: () => void
  onQuickSpawnBboxMotion: () => void
  onQuickSpawnPathMotion: () => void
  onToggleCamDirectorMode: () => void
  onToggleCameraGuide: () => void
  onFlipHorizontal: () => void
  onQuickAlign: (preset: StageQuickAlignPreset) => void
  onStepDepthZ: (deltaZ: number) => void
  onSelectNode: (nodeId: string) => void
  onAttachLogic: (
    layerNodeId: string,
    category: WorkflowV2SpawnCategory,
    presetId?: string,
    extraParams?: Partial<WorkflowNodeParams>,
    customTitle?: string
  ) => void
  onOpenLayerWorkshop: () => void
  onSpawnCameraWaypoint: (mode: 'pan' | 'zoom-in' | 'zoom-out' | 'hold') => void
  onRotateCameraYaw: (yawDeg: number) => void
  onZoomStep: (delta: number) => void
}

function renderCategoryIcon(catId: WorkflowV2SpawnCategory): React.ReactNode {
  switch (catId) {
    case 'part_swap':
      return <IconPuzzle width={14} height={14} />
    case 'rig_bone':
      return <IconBone width={14} height={14} />
    case 'anim_fx':
      return <IconCinematicClapper width={14} height={14} />
    case 'fx':
      return <IconSparkles width={14} height={14} />
    case 'light':
      return <IconSun width={14} height={14} />
    case 'cave':
      return <IconPerspective2D width={14} height={14} />
    case 'subtitle':
      return <IconVoiceDialogue width={14} height={14} />
    case 'audio':
      return <IconMusic width={14} height={14} />
    case 'collision':
      return <IconAim width={14} height={14} />
    case 'material':
      return <IconDepth25D width={14} height={14} />
    case 'loop_anim':
      return <IconLoopAnimate width={14} height={14} />
    default:
      return <IconSparkles width={14} height={14} />
  }
}

export const NodeStage2DSideRails: React.FC<NodeStage2DSideRailsProps> = ({
  node,
  ctx,
  isCamDirectorMode,
  showCameraGuide,
  activeShotId,
  onSelectEntityRoot,
  onQuickSpawnBboxMotion,
  onQuickSpawnPathMotion,
  onToggleCamDirectorMode,
  onToggleCameraGuide,
  onFlipHorizontal,
  onQuickAlign,
  onStepDepthZ,
  onSelectNode,
  onAttachLogic,
  onOpenLayerWorkshop,
  onSpawnCameraWaypoint,
  onRotateCameraYaw,
  onZoomStep
}) => {
  const level = node ? resolveV2NodeLevel(node) : null
  const logicCat = node ? resolveV2LogicCategory(node) : undefined
  const isStandingOnEntityRoot = Boolean(
    !isCamDirectorMode &&
      node &&
      (level === 'layer' || logicCat === 'cluster_lock')
  )
  const isBboxMode = Boolean(node && logicCat === 'action' && node.params?.motionMode === 'bbox')
  const isPathMode = Boolean(node && logicCat === 'action' && node.params?.motionMode === 'path')
  const hasEntity = Boolean(ctx.activeLayer)
  const hasComposite = Boolean(ctx.activeLayer?.composite?.compositeId)

  // Ưu tiên 6 miền trực quan nhất trên thanh Rail phải để vừa khít chiều cao không cuộn (đầy đủ 100% miền nằm trong Menu Chuột Phải & Hành động)
  const PRIORITY_STAGE_CATS: WorkflowV2SpawnCategory[] = [
    'loop_anim',
    'part_swap',
    'anim_fx',
    'fx',
    'light',
    'cave',
    'subtitle'
  ]
  const seenCats = new Set<WorkflowV2SpawnCategory>(['action'])
  const rightCategories = (ctx.compatibleCategories ?? [])
    .filter((c) => {
      if (seenCats.has(c.id) || !PRIORITY_STAGE_CATS.includes(c.id)) return false
      seenCats.add(c.id)
      return true
    })
    .slice(0, 6)

  return (
    <>
      {/* THANH CÔNG CỤ DỌC BÊN TRÁI: Chế độ thao tác · Lộ trình Camera · Biến đổi không gian nhanh */}
      <aside
        className="vn2d-side-rail is-left"
        data-mcp-region="viewer_node2d_left_rail"
        role="toolbar"
        aria-label="Công cụ thao tác và biến đổi nhanh Khung 2D"
      >
        <button
          type="button"
          className={`vn2d-rail-btn${isStandingOnEntityRoot ? ' active' : ''}`}
          disabled={!ctx.layerOrClusterNode && !isCamDirectorMode}
          onClick={onSelectEntityRoot}
          title="Chọn & Kéo BBox gốc của Đối tượng / Cụm 2.5D"
          aria-label="Chọn và kéo BBox gốc"
        >
          <IconSelectPointer width={15} height={15} />
        </button>

        <button
          type="button"
          className={`vn2d-rail-btn${isBboxMode ? ' active' : ''}`}
          disabled={!hasEntity}
          onClick={onQuickSpawnBboxMotion}
          title={
            isBboxMode
              ? 'Đang chỉnh BBox Đầu → Đích (#1→#2) — Nhấp để nối thêm chặng BBox kế tiếp (+3s)'
              : 'Tạo hoặc chuyển sang kéo BBox Đầu → Đích (#1→#2)'
          }
          aria-label="Chuyển động BBox Đầu tới Đích"
        >
          <IconGizmoBbox width={15} height={15} />
          {ctx.bboxSteps.length > 0 && <span className="vn2d-rail-dot" />}
        </button>

        <button
          type="button"
          className={`vn2d-rail-btn${isPathMode ? ' active' : ''}`}
          disabled={!hasEntity}
          onClick={onQuickSpawnPathMotion}
          title="Vẽ tay quỹ đạo chuyển động tự do trực tiếp trên khung 2D"
          aria-label="Vẽ tay quỹ đạo chuyển động"
        >
          <IconPen width={14} height={14} />
        </button>

        <button
          type="button"
          className={`vn2d-rail-btn${showCameraGuide ? ' active' : ''}`}
          onClick={onToggleCameraGuide}
          title="Bật/Tắt Lưới bố cục 1/3 & Khung ngắm Camera tham chiếu trên sân khấu"
          aria-label="Khung ngắm Camera và lưới bố cục 1/3"
        >
          <IconRuleOfThirds width={14} height={14} />
        </button>

        <span className="vn2d-rail-sep" aria-hidden="true" />

        <button
          type="button"
          className="vn2d-rail-btn"
          disabled={!hasEntity}
          onClick={onFlipHorizontal}
          title="Lật ngang hướng nhìn của Đối tượng / Toàn bộ Cụm 2.5D (Flip X)"
          aria-label="Lật ngang đối tượng"
        >
          <IconFlipHorizontal width={15} height={15} />
        </button>

        <button
          type="button"
          className="vn2d-rail-btn"
          disabled={!hasEntity}
          onClick={() => onQuickAlign('center')}
          title="Căn tâm đối tượng vào chính giữa khung cảnh 16:9"
          aria-label="Căn giữa khung cảnh"
        >
          <IconAlignStageCenter width={15} height={15} />
        </button>

        <button
          type="button"
          className="vn2d-rail-btn"
          disabled={!hasEntity}
          onClick={() => onQuickAlign('ground')}
          title="Đặt đối tượng xuống đường mặt đất tiền cảnh (Đặt Đáy)"
          aria-label="Đặt chạm đường mặt đất"
        >
          <IconAlignStageGround width={15} height={15} />
        </button>

        <button
          type="button"
          className="vn2d-rail-btn"
          disabled={!hasEntity}
          onClick={() => onStepDepthZ(-80)}
          title="Đưa đối tượng lại gần Camera hơn (Z -80 · Tiền cảnh 2.5D)"
          aria-label="Đưa lại gần Camera"
        >
          <IconDepthBringFront width={15} height={15} />
        </button>

        <button
          type="button"
          className="vn2d-rail-btn"
          disabled={!hasEntity}
          onClick={() => onStepDepthZ(80)}
          title="Đẩy đối tượng lùi sâu ra hậu cảnh (Z +80 · Hậu cảnh 2.5D)"
          aria-label="Đẩy lùi ra hậu cảnh"
        >
          <IconDepthPushBack width={15} height={15} />
        </button>
      </aside>

      {/* THANH CÔNG CỤ DỌC BÊN PHẢI: Node Logic 2.5D 1 chạm (hoặc Đạo diễn Camera) + Thu phóng & Menu Chuột Phải */}
      <aside
        className="vn2d-side-rail is-right"
        data-mcp-region="viewer_node2d_right_rail"
        role="toolbar"
        aria-label="Công cụ gắn Node Logic 2.5D và điều phóng Khung 2D"
      >
        {isCamDirectorMode ? (
          <>
            <button
              type="button"
              className="vn2d-rail-btn"
              disabled={!activeShotId}
              onClick={() => onSpawnCameraWaypoint('zoom-in')}
              title="Thêm mốc Camera Đẩy cận (+ Zoom In) nối tiếp lộ trình"
              aria-label="Thêm mốc Camera đẩy cận"
            >
              <IconCamPushIn width={15} height={15} />
            </button>
            <button
              type="button"
              className="vn2d-rail-btn"
              disabled={!activeShotId}
              onClick={() => onSpawnCameraWaypoint('pan')}
              title="Thêm mốc Camera Lia ngang (+ Pan) sang vùng mới"
              aria-label="Thêm mốc Camera lia ngang"
            >
              <IconCamPanZoom2D width={15} height={15} />
            </button>
            <button
              type="button"
              className="vn2d-rail-btn"
              disabled={!activeShotId}
              onClick={() => onSpawnCameraWaypoint('zoom-out')}
              title="Thêm mốc Camera Kéo rộng (+ Pull Out) mở toàn cảnh"
              aria-label="Thêm mốc Camera kéo rộng"
            >
              <IconCamPullOut width={15} height={15} />
            </button>
            <button
              type="button"
              className="vn2d-rail-btn"
              disabled={!activeShotId}
              onClick={() => onSpawnCameraWaypoint('hold')}
              title="Thêm mốc Camera Giữ khung dừng ngắm (+ Hold)"
              aria-label="Thêm mốc Camera giữ khung"
            >
              <IconEaseHold width={15} height={15} />
            </button>

            <span className="vn2d-rail-sep" aria-hidden="true" />

            <button
              type="button"
              className="vn2d-rail-btn"
              onClick={() => onRotateCameraYaw(-20)}
              title="Xoay góc máy 3D nghiêng trái -20° (Parallax 2.5D)"
              aria-label="Nghiêng máy sang trái 20 độ"
            >
              <IconOrbitLeft25 width={15} height={15} />
            </button>
            <button
              type="button"
              className="vn2d-rail-btn"
              onClick={() => onRotateCameraYaw(0)}
              title="Đặt góc máy 3D về chính diện 0°"
              aria-label="Góc máy chính diện 0 độ"
            >
              <IconOrbitCenter0 width={15} height={15} />
            </button>
            <button
              type="button"
              className="vn2d-rail-btn"
              onClick={() => onRotateCameraYaw(20)}
              title="Xoay góc máy 3D nghiêng phải +20° (Parallax 2.5D)"
              aria-label="Nghiêng máy sang phải 20 độ"
            >
              <IconOrbitRight25 width={15} height={15} />
            </button>
          </>
        ) : (
          <>
            {rightCategories.map((cat) => {
              const attached = ctx.logicNodes.find((ln) => resolveV2LogicCategory(ln) === cat.id)
              const isActive = Boolean(
                attached &&
                  (node?.id === attached.id ||
                    (attached.params?.isPartHub &&
                      node?.params?.isPartChild &&
                      node?.params?.hierarchyParentNodeId === attached.id))
              )
              return (
                <button
                  key={`${cat.id}-${cat.presetId ?? ''}`}
                  type="button"
                  className={`vn2d-rail-btn${isActive ? ' active' : ''}`}
                  style={{ ['--logic-accent' as string]: cat.accent }}
                  title={
                    attached
                      ? `Chuyển sang chỉnh "${attached.title}" (${cat.label})`
                      : `Gắn mới ${cat.label} — ${cat.hint}`
                  }
                  aria-label={attached ? `Mở ${cat.label}` : `Gắn ${cat.label}`}
                  onClick={() => {
                    if (attached) {
                      onSelectNode(attached.id)
                    } else if (ctx.attachTargetNodeId) {
                      onAttachLogic(ctx.attachTargetNodeId, cat.id, cat.presetId)
                    }
                  }}
                >
                  {renderCategoryIcon(cat.id)}
                  {attached && (
                    <span
                      className="vn2d-rail-dot"
                      style={{ background: isActive ? '#ffffff' : cat.accent }}
                    />
                  )}
                </button>
              )
            })}

            {hasComposite && (
              <button
                type="button"
                className="vn2d-rail-btn"
                onClick={onOpenLayerWorkshop}
                title="Mở Xưởng Lắp Ráp & Gắn Xương 2.5D cho nhân vật/cụm này"
                aria-label="Mở Xưởng Lắp Ráp 2.5D"
              >
                <IconLayerAssembly width={15} height={15} />
              </button>
            )}
          </>
        )}

        <span className="vn2d-rail-sep" aria-hidden="true" />

        <button
          type="button"
          className="vn2d-rail-btn"
          onClick={() => onZoomStep(0.15)}
          title="Phóng to Màn Khung 2D (+15%)"
          aria-label="Phóng to khung 2D"
        >
          <IconZoomIn width={15} height={15} />
        </button>

        <button
          type="button"
          className="vn2d-rail-btn"
          onClick={() => onZoomStep(-0.15)}
          title="Thu nhỏ Màn Khung 2D (-15%)"
          aria-label="Thu nhỏ khung 2D"
        >
          <IconZoomOut width={15} height={15} />
        </button>
      </aside>
    </>
  )
}
