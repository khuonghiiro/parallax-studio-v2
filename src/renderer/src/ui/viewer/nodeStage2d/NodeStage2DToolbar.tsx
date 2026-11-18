import React, { useState } from 'react'
import type { Project, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { effectiveTimeParams } from '../../../project/workflowTiming'
import { getClusterPartShortName, getLayerDisplayName } from '../../../project/workflowV2Engine'
import { useView } from '../../../store/view'
import { selectedViews } from '../taggedLayout'
import {
  cleanV2NodeTitle,
  resolveV2LogicCategory,
  resolveV2NodeLevel,
  resolveV2NodeTheme,
  type WorkflowV2SpawnCategory
} from '../../workflow/workflowV2Theme'
import type { NodeStagePrimaryMode, StageLayerNodeContext } from './resolveNodeStageTarget'

export interface NodeStage2DToolbarProps {
  project: Project
  workflow: WorkflowGraph
  node: WorkflowNode | null
  ctx: StageLayerNodeContext
  primaryMode: NodeStagePrimaryMode
  overrideSceneView: boolean
  currentTime: number
  playing: boolean
  zoomPct: number
  scopeOverride: 'cluster' | 'part' | null
  onSelectNode: (nodeId: string) => void
  onToggleOverrideSceneView: (sceneView: boolean) => void
  onQuickSpawnBboxMotion: () => void
  onQuickSpawnPathMotion: () => void
  onSpawnFollowupStep: () => void
  onSpawnCameraWaypoint?: (shotId: string) => void
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
  onZoomStep: (delta: number) => void
  onFitStage: () => void
}

export const NodeStage2DToolbar: React.FC<NodeStage2DToolbarProps> = ({
  project,
  node,
  ctx,
  primaryMode,
  overrideSceneView,
  currentTime,
  playing,
  zoomPct,
  scopeOverride,
  onSelectNode,
  onToggleOverrideSceneView,
  onQuickSpawnBboxMotion,
  onQuickSpawnPathMotion,
  onSpawnFollowupStep,
  onSpawnCameraWaypoint,
  onAttachLogic,
  onToggleScopeOverride,
  onScrubTime,
  onTogglePlayNode,
  onZoomStep,
  onFitStage
}) => {
  const [moreActionsOpen, setMoreActionsOpen] = useState(false)
  const viewState = useView()
  const activeViews = selectedViews(viewState)
  const isSplitWithCam = activeViews.includes('camera') && activeViews.includes('node2d')

  const level = node ? resolveV2NodeLevel(node) : null
  const logicCat = node ? resolveV2LogicCategory(node) : undefined
  const canChainStep = Boolean(
    node && (node.params?.isPartChild || logicCat === 'action' || logicCat === 'anim_fx' || logicCat === 'collision')
  )
  const hasDualStage = primaryMode === 'logic_25d' || primaryMode === 'part_25d'
  const timing = node ? effectiveTimeParams(project, node, node.params ?? {}) : { timeStart: 0, timeEnd: project.comp.duration || 5 }
  const tStart = timing.timeStart ?? 0
  const tEnd = timing.timeEnd ?? (project.comp.duration || 5)

  const targetLabel = ctx.activeLayer ? getLayerDisplayName(ctx.activeLayer) : node ? cleanV2NodeTitle(node.title) : 'Chưa chọn đối tượng'

  return (
    <div className="viewer-node2d-toolbar" data-mcp-region="viewer_node2d_tools">
      {/* Cụm trái + giữa: Chuyển nhanh Node của Layer/Cụm & Tạo nhanh Hành động/Chuyển động trực tiếp */}
      <div className="vn2d-mid-scroll">
        {ctx.layerOrClusterNode && (
          <button
            type="button"
            className={`vn2d-pill is-entity${node?.id === ctx.layerOrClusterNode.id ? ' active' : ''}`}
            onClick={() => onSelectNode(ctx.layerOrClusterNode!.id)}
            title={`Chọn gốc "${targetLabel}" để kéo vị trí & kích thước BBox gốc`}
          >
            <span>{ctx.layerOrClusterNode.params?.logicCategory === 'cluster_lock' ? '🔒' : '🖼'}</span>
            <span className="vn2d-pill-txt">{targetLabel}</span>
          </button>
        )}

        {ctx.bboxSteps.map(({ node: step, number }) => (
          <button
            key={step.id}
            type="button"
            className={`vn2d-pill is-bbox-step${node?.id === step.id ? ' active' : ''}${!step.enabled ? ' is-off' : ''}`}
            onClick={() => onSelectNode(step.id)}
            title={`${step.title} — Kéo BBox #${number} → #${number + 1} trực tiếp trên sân khấu`}
          >
            <span>▣</span>
            <span>#{number}→#{number + 1}</span>
          </button>
        ))}

        {ctx.logicNodes.map((ln) => {
          const th = resolveV2NodeTheme(ln)
          const isSel =
            node?.id === ln.id ||
            Boolean(ln.params?.isPartHub && node?.params?.isPartChild && node?.params?.hierarchyParentNodeId === ln.id)
          return (
            <button
              key={ln.id}
              type="button"
              className={`vn2d-pill${isSel ? ' active' : ''}${!ln.enabled ? ' is-off' : ''}`}
              style={{ ['--logic-accent' as string]: th.accent }}
              onClick={() => onSelectNode(ln.id)}
              title={`${ln.title} — Nhấp để chỉnh trực tiếp trên Màn Khung 2D`}
            >
              <span>{th.icon}</span>
              <span className="vn2d-pill-txt">{cleanV2NodeTitle(ln.title)}</span>
            </button>
          )
        })}

        {ctx.partChildren.length > 0 && logicCat === 'part_swap' && (
          <div className="vn2d-inline-group" role="group" aria-label="Bộ phận con">
            {ctx.partChildren.map((ch) => (
              <button
                key={ch.id}
                type="button"
                className={`vn2d-pill${node?.id === ch.id ? ' active' : ''}`}
                onClick={() => onSelectNode(ch.id)}
                title={`Chỉnh tư thế / biến thể bộ phận "${ch.params?.partGroupTitle || cleanV2NodeTitle(ch.title)}"`}
              >
                <span>{ch.params?.partIcon || '🧩'}</span>
                <span className="vn2d-pill-txt">{ch.params?.partGroupTitle || cleanV2NodeTitle(ch.title)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Nút tạo nhanh Chuyển động BBox, Vẽ Quỹ đạo, Nối chặng & Hành động ngay trên Màn Khung 2D */}
        {ctx.attachTargetNodeId && (
          <>
            <span className="vn2d-sep" />
            <button
              type="button"
              className="vn2d-action-cta"
              onClick={onQuickSpawnBboxMotion}
              title="Tạo ngay chuyển động kéo BBox Đầu → Đích (#1 → #2) trực tiếp trên Màn Khung 2D"
            >
              🎯 + BBox Đích
            </button>
            <button
              type="button"
              className="vn2d-action-btn"
              onClick={onQuickSpawnPathMotion}
              title="Tạo hoặc mở công cụ vẽ tay đường bay chuyển động ngay trên Màn Khung 2D"
            >
              ✏️ + Vẽ đường đi
            </button>
            {canChainStep && (
              <button
                type="button"
                className="vn2d-action-btn is-chain"
                onClick={onSpawnFollowupStep}
                title="Tạo chặng hành động nối tiếp (+3s) ngay sau mốc kết thúc hiện tại"
              >
                + Chặng tiếp
              </button>
            )}
            {ctx.compatibleCategories.length > 0 && (
              <button
                type="button"
                className={`vn2d-action-btn${moreActionsOpen ? ' active' : ''}`}
                onClick={() => setMoreActionsOpen((v) => !v)}
                aria-expanded={moreActionsOpen}
                title="Gắn thêm Hành động nhân vật, Hiệu ứng FX, Ánh sáng 2.5D, Cửa hang, Bộ phận, Vietsub..."
              >
                ⚡ + Hành động ▾
              </button>
            )}
          </>
        )}

        {node?.type === 'camera_director' && node.params?.shotId && onSpawnCameraWaypoint && (
          <>
            <span className="vn2d-sep" />
            <button
              type="button"
              className="vn2d-action-cta"
              onClick={() => onSpawnCameraWaypoint(node.params!.shotId!)}
              title="Thêm mốc khung ngắm Camera mới trên Màn Khung 2D"
            >
              🎥 + Mốc Camera
            </button>
          </>
        )}

        {ctx.clusterMemberCount > 1 && level === 'layer' && ctx.activeLayer && (
          <button
            type="button"
            className="vn2d-action-btn"
            onClick={onToggleScopeOverride}
            title="Chuyển nhanh chế độ kéo giữa Riêng mảnh con hoặc Toàn bộ Cụm 2.5D"
          >
            {scopeOverride === 'cluster'
              ? `🔒 Cả cụm (${ctx.clusterMemberCount})`
              : `🎯 Riêng: ${getClusterPartShortName(ctx.activeLayer)}`}
          </button>
        )}

        {hasDualStage && (
          <>
            <span className="vn2d-sep" />
            <div className="vn2d-seg" role="group" aria-label="Chuyển chế độ Khung 2.5D và Cảnh 2D">
              <button
                type="button"
                className={`vn2d-seg-btn${!overrideSceneView ? ' active' : ''}`}
                onClick={() => onToggleOverrideSceneView(false)}
                title="Chỉnh chuyên sâu tia sáng 2.5D, cửa hang, vùng UV hoặc bộ phận con"
              >
                {primaryMode === 'part_25d' ? '🧩 Khung Bộ phận' : '✨ Khung 2.5D'}
              </button>
              <button
                type="button"
                className={`vn2d-seg-btn${overrideSceneView ? ' active' : ''}`}
                onClick={() => onToggleOverrideSceneView(true)}
                title="Xem và kéo vị trí BBox trực tiếp trên toàn khung Cảnh 16:9"
              >
                🎬 Cảnh 2D
              </button>
            </div>
          </>
        )}
      </div>

      {/* Cụm phải cố định: Phát thử ngay trên Khung 2D, Tua nhanh Đầu/Đích, Zoom & Chia đôi cùng Camera */}
      <div className="vn2d-right-ops">
        {node && (
          <div className="vn2d-transport" role="group" aria-label="Phát thử và tua nhanh Node">
            <button
              type="button"
              className="vn2d-icon-btn"
              onClick={() => onScrubTime(tStart)}
              title={`Về đầu khoảng chạy của Node (${tStart.toFixed(2)}s)`}
              aria-label="Về mốc đầu Node"
            >
              ⏮
            </button>
            <button
              type="button"
              className={`vn2d-play-btn${playing ? ' is-playing' : ''}`}
              onClick={onTogglePlayNode}
              title={playing ? 'Dừng phát (Space)' : `Phát thử chuyển động từ ${tStart.toFixed(2)}s → ${tEnd.toFixed(2)}s`}
            >
              {playing ? '⏸ Dừng' : '▶ Chạy'}
            </button>
            <button
              type="button"
              className="vn2d-icon-btn"
              onClick={() => onScrubTime(tEnd)}
              title={`Tới đích khoảng chạy của Node (${tEnd.toFixed(2)}s)`}
              aria-label="Tới mốc đích Node"
            >
              ⏭
            </button>
            <span className="vn2d-time-readout" title="Thời gian hiện tại trên Màn Khung 2D">
              {currentTime.toFixed(2)}s
            </span>
          </div>
        )}

        {(!hasDualStage || overrideSceneView) && (
          <div className="vn2d-zoom-group" role="group" aria-label="Thu phóng Màn Khung 2D">
            <button
              type="button"
              className="vn2d-icon-btn"
              onClick={() => onZoomStep(-0.15)}
              title="Thu nhỏ sân khấu 2D (Cuộn chuột xuống)"
              aria-label="Thu nhỏ khung 2D"
            >
              −
            </button>
            <button
              type="button"
              className="vn2d-zoom-pct"
              onClick={onFitStage}
              title="Nhấp để căn vừa khít 100% khung cảnh (Cuộn chuột để Zoom, kéo nền trống hoặc Alt+Kéo để Lia)"
            >
              {zoomPct}%
            </button>
            <button
              type="button"
              className="vn2d-icon-btn"
              onClick={() => onZoomStep(0.15)}
              title="Phóng to sân khấu 2D (Cuộn chuột lên)"
              aria-label="Phóng to khung 2D"
            >
              +
            </button>
          </div>
        )}

        <button
          type="button"
          className={`vn2d-layout-btn${isSplitWithCam ? ' active' : ''}`}
          onClick={() => {
            if (isSplitWithCam) {
              viewState.openNodeStage2D('solo')
            } else {
              viewState.set({ activeViews: ['camera', 'node2d'], primary: 'node2d' })
            }
          }}
          title={
            isSplitWithCam
              ? 'Đang xem song song Camera Render + Khung 2D — nhấn để phóng Khung 2D toàn vùng'
              : 'Chia đôi xem song song Camera Render thực tế + Màn Khung 2D cạnh nhau'
          }
        >
          {isSplitWithCam ? '⛶ Toàn khung' : '◫ Kèm Camera'}
        </button>
      </div>

      {/* Dải pop-down chọn nhanh Node Logic gắn thêm trực tiếp trên Màn Khung 2D */}
      {moreActionsOpen && ctx.attachTargetNodeId && ctx.compatibleCategories.length > 0 && (
        <div className="vn2d-spawn-drawer" role="region" aria-label="Tạo nhanh Hành động & Logic cho đối tượng">
          <span className="vn2d-spawn-label">Thêm cho {targetLabel}:</span>
          {ctx.compatibleCategories.map((cat) => (
            <button
              key={`${cat.id}-${cat.presetId ?? ''}`}
              type="button"
              className="vn2d-spawn-chip"
              style={{ ['--logic-accent' as string]: cat.accent }}
              title={cat.hint}
              onClick={() => {
                onAttachLogic(ctx.attachTargetNodeId, cat.id, cat.presetId)
                setMoreActionsOpen(false)
              }}
            >
              <span aria-hidden="true">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
