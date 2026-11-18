import React from 'react'
import type { WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { StudioTooltip, type StudioTooltipBadgeTone } from '../../controls/StudioTooltip'
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

interface RailIconButtonProps {
  side: 'right' | 'left'
  title: string
  description: string
  badge?: string
  badgeTone?: StudioTooltipBadgeTone
  active?: boolean
  disabled?: boolean
  style?: React.CSSProperties
  onClick: () => void
  children: React.ReactNode
}

const RailIconButton: React.FC<RailIconButtonProps> = ({
  side,
  title,
  description,
  badge,
  badgeTone = 'cyan',
  active = false,
  disabled = false,
  style,
  onClick,
  children
}) => (
  <StudioTooltip
    title={title}
    description={description}
    badge={badge}
    badgeTone={badgeTone}
    placement={side}
    disabled={disabled}
  >
    <button
      type="button"
      className={`vn2d-rail-btn${active ? ' active' : ''}`}
      disabled={disabled}
      style={style}
      onClick={onClick}
      aria-label={title}
    >
      {children}
    </button>
  </StudioTooltip>
)

export const NodeStage2DSideRails: React.FC<NodeStage2DSideRailsProps> = ({
  node,
  ctx,
  isCamDirectorMode,
  showCameraGuide,
  activeShotId,
  onSelectEntityRoot,
  onQuickSpawnBboxMotion,
  onQuickSpawnPathMotion,
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
    !isCamDirectorMode && node && (level === 'layer' || logicCat === 'cluster_lock')
  )
  const isBboxMode = Boolean(node && logicCat === 'action' && node.params?.motionMode === 'bbox')
  const isPathMode = Boolean(node && logicCat === 'action' && node.params?.motionMode === 'path')
  const hasEntity = Boolean(ctx.activeLayer)
  const hasComposite = Boolean(ctx.activeLayer?.composite?.compositeId)

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
      {/* THANH CÔNG CỤ DỌC BÊN TRÁI (placement="right" đồng bộ với thanh Icon Tài nguyên) */}
      <aside
        className="vn2d-side-rail is-left"
        data-mcp-region="viewer_node2d_left_rail"
        role="toolbar"
        aria-label="Công cụ thao tác và biến đổi nhanh Khung 2D"
      >
        <RailIconButton
          side="right"
          title="Chọn & kéo BBox gốc"
          badge={isStandingOnEntityRoot ? 'Đang chọn' : 'Gốc'}
          badgeTone={isStandingOnEntityRoot ? 'green' : 'cyan'}
          description="Di chuyển vị trí hoặc nắm 4 góc chỉnh kích thước gốc của Đối tượng / Cụm 2.5D"
          active={isStandingOnEntityRoot}
          disabled={!ctx.layerOrClusterNode && !isCamDirectorMode}
          onClick={onSelectEntityRoot}
        >
          <IconSelectPointer width={15} height={15} />
        </RailIconButton>

        <RailIconButton
          side="right"
          title={isBboxMode ? 'Nối chặng BBox kế tiếp' : 'Chuyển động BBox #1 → #2'}
          badge={ctx.bboxSteps.length > 0 ? `${ctx.bboxSteps.length} chặng` : 'BBox'}
          badgeTone="cyan"
          description={
            isBboxMode
              ? 'Nối thêm chặng BBox kế tiếp (+3s) xuất phát từ đích hiện tại'
              : 'Tạo hoặc chuyển sang kéo khung BBox Đầu → Đích trực tiếp trên sân khấu'
          }
          active={isBboxMode}
          disabled={!hasEntity}
          onClick={onQuickSpawnBboxMotion}
        >
          <IconGizmoBbox width={15} height={15} />
          {ctx.bboxSteps.length > 0 && <span className="vn2d-rail-dot" />}
        </RailIconButton>

        <RailIconButton
          side="right"
          title="Vẽ quỹ đạo tự do"
          badge={isPathMode ? 'Đang vẽ' : 'Tự do'}
          badgeTone="amber"
          description="Kéo chuột vẽ đường đi tự do; vẽ xong sẽ hiện BBox Đích để chỉnh cỡ & góc xoay"
          active={isPathMode}
          disabled={!hasEntity}
          onClick={onQuickSpawnPathMotion}
        >
          <IconPen width={14} height={14} />
        </RailIconButton>

        <RailIconButton
          side="right"
          title="Lưới 1/3 & Khung ngắm Camera"
          badge={showCameraGuide ? 'Đang bật' : 'Tham chiếu'}
          badgeTone={showCameraGuide ? 'green' : 'neutral'}
          description="Hiển thị lưới bố cục 1/3 và khung hình thực tế mà Camera 3D sẽ ghi lại"
          active={showCameraGuide}
          onClick={onToggleCameraGuide}
        >
          <IconRuleOfThirds width={14} height={14} />
        </RailIconButton>

        <span className="vn2d-rail-sep" aria-hidden="true" />

        <RailIconButton
          side="right"
          title="Lật ngang hướng nhìn"
          badge="Flip X"
          badgeTone="neutral"
          description="Đảo chiều quay mặt trái ⇄ phải của Layer hoặc toàn bộ Cụm 2.5D quanh tâm gốc"
          disabled={!hasEntity}
          onClick={onFlipHorizontal}
        >
          <IconFlipHorizontal width={15} height={15} />
        </RailIconButton>

        <RailIconButton
          side="right"
          title="Căn giữa khung 16:9"
          badge="X=0, Y=0"
          badgeTone="neutral"
          description="Đưa đối tượng về ngay chính tâm khung cảnh hiện tại"
          disabled={!hasEntity}
          onClick={() => onQuickAlign('center')}
        >
          <IconAlignStageCenter width={15} height={15} />
        </RailIconButton>

        <RailIconButton
          side="right"
          title="Đặt chân chạm mặt đất"
          badge="Đặt đáy"
          badgeTone="neutral"
          description="Hạ đối tượng xuống đường mặt đất tiền cảnh chuẩn tỉ lệ 1/3 dưới"
          disabled={!hasEntity}
          onClick={() => onQuickAlign('ground')}
        >
          <IconAlignStageGround width={15} height={15} />
        </RailIconButton>

        <RailIconButton
          side="right"
          title="Đưa lại gần Camera"
          badge="Z -80"
          badgeTone="cyan"
          description="Kéo đối tượng tiến lên lớp tiền cảnh gần ống kính hơn (tăng hiệu ứng Parallax)"
          disabled={!hasEntity}
          onClick={() => onStepDepthZ(-80)}
        >
          <IconDepthBringFront width={15} height={15} />
        </RailIconButton>

        <RailIconButton
          side="right"
          title="Đẩy lùi sâu hậu cảnh"
          badge="Z +80"
          badgeTone="neutral"
          description="Đẩy đối tượng ra xa ống kính về lớp hậu cảnh phía sau"
          disabled={!hasEntity}
          onClick={() => onStepDepthZ(80)}
        >
          <IconDepthPushBack width={15} height={15} />
        </RailIconButton>
      </aside>

      {/* THANH CÔNG CỤ DỌC BÊN PHẢI (placement="left" mở vào trong sân khấu không bao giờ tràn mép phải) */}
      <aside
        className="vn2d-side-rail is-right"
        data-mcp-region="viewer_node2d_right_rail"
        role="toolbar"
        aria-label="Công cụ gắn Node Logic 2.5D và điều phóng Khung 2D"
      >
        {isCamDirectorMode ? (
          <>
            <RailIconButton
              side="left"
              title="Thêm mốc Camera Đẩy cận"
              badge="+ Zoom In"
              badgeTone="green"
              description="Tạo mốc khung ngắm thu hẹp để máy quay đẩy cận cảnh vào chủ thể"
              disabled={!activeShotId}
              onClick={() => onSpawnCameraWaypoint('zoom-in')}
            >
              <IconCamPushIn width={15} height={15} />
            </RailIconButton>
            <RailIconButton
              side="left"
              title="Thêm mốc Camera Lia ngang"
              badge="+ Pan"
              badgeTone="cyan"
              description="Tạo mốc lia máy sang vị trí khác trong cảnh mà giữ nguyên độ phóng đại"
              disabled={!activeShotId}
              onClick={() => onSpawnCameraWaypoint('pan')}
            >
              <IconCamPanZoom2D width={15} height={15} />
            </RailIconButton>
            <RailIconButton
              side="left"
              title="Thêm mốc Camera Kéo rộng"
              badge="+ Pull Out"
              badgeTone="amber"
              description="Tạo mốc mở rộng khung ngắm bao quát toàn bộ bối cảnh"
              disabled={!activeShotId}
              onClick={() => onSpawnCameraWaypoint('zoom-out')}
            >
              <IconCamPullOut width={15} height={15} />
            </RailIconButton>
            <RailIconButton
              side="left"
              title="Thêm mốc Giữ khung dừng ngắm"
              badge="+ Hold"
              badgeTone="neutral"
              description="Giữ yên khung hình Camera trong một nhịp thoại hoặc hành động"
              disabled={!activeShotId}
              onClick={() => onSpawnCameraWaypoint('hold')}
            >
              <IconEaseHold width={15} height={15} />
            </RailIconButton>

            <span className="vn2d-rail-sep" aria-hidden="true" />

            <RailIconButton
              side="left"
              title="Nghiêng máy sang trái"
              badge="-20°"
              badgeTone="cyan"
              description="Xoay góc nhìn 3D của Camera sang trái tạo chiều sâu Parallax 2.5D"
              onClick={() => onRotateCameraYaw(-20)}
            >
              <IconOrbitLeft25 width={15} height={15} />
            </RailIconButton>
            <RailIconButton
              side="left"
              title="Góc máy chính diện"
              badge="0°"
              badgeTone="neutral"
              description="Đặt lại góc xoay ngang của Camera về thẳng chính diện"
              onClick={() => onRotateCameraYaw(0)}
            >
              <IconOrbitCenter0 width={15} height={15} />
            </RailIconButton>
            <RailIconButton
              side="left"
              title="Nghiêng máy sang phải"
              badge="+20°"
              badgeTone="cyan"
              description="Xoay góc nhìn 3D của Camera sang phải tạo chiều sâu Parallax 2.5D"
              onClick={() => onRotateCameraYaw(20)}
            >
              <IconOrbitRight25 width={15} height={15} />
            </RailIconButton>
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
                <RailIconButton
                  key={`${cat.id}-${cat.presetId ?? ''}`}
                  side="left"
                  title={cat.label}
                  badge={attached ? 'Đã gắn' : 'Gắn mới'}
                  badgeTone={attached ? 'green' : 'cyan'}
                  description={attached ? `Nhấp để chỉnh "${attached.title}"` : cat.hint}
                  active={isActive}
                  style={{ ['--logic-accent' as string]: cat.accent }}
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
                </RailIconButton>
              )
            })}

            {hasComposite && (
              <RailIconButton
                side="left"
                title="Xưởng Lắp Ráp & Xương 2.5D"
                badge="Xưởng"
                badgeTone="amber"
                description="Mở Xưởng 2.5D để tinh chỉnh các mảnh bộ phận, gắn xương và tạo động tác"
                onClick={onOpenLayerWorkshop}
              >
                <IconLayerAssembly width={15} height={15} />
              </RailIconButton>
            )}
          </>
        )}

        <span className="vn2d-rail-sep" aria-hidden="true" />

        <RailIconButton
          side="left"
          title="Phóng to Khung 2D"
          badge="+15%"
          badgeTone="neutral"
          description="Phóng to mặt bàn dựng 2D để căn chỉnh BBox chi tiết (hoặc cuộn chuột)"
          onClick={() => onZoomStep(0.15)}
        >
          <IconZoomIn width={15} height={15} />
        </RailIconButton>

        <RailIconButton
          side="left"
          title="Thu nhỏ Khung 2D"
          badge="-15%"
          badgeTone="neutral"
          description="Thu nhỏ mặt bàn dựng 2D để bao quát khoảng ngoài rìa khung 16:9"
          onClick={() => onZoomStep(-0.15)}
        >
          <IconZoomOut width={15} height={15} />
        </RailIconButton>
      </aside>
    </>
  )
}
