import { guardWorkflowNodeEvent } from './workflowFocusGuard'
import { effectiveTimeParams, isTimeNode, timeSource } from '../../project/workflowTiming'
import React, { memo } from 'react'
import type { ImageProps, Project, WorkflowNode, WorkflowNodeParams, WorkflowPortKind } from '@shared/types'
import {
  WORKFLOW_V2_COLLISION_OPTIONS,
  WORKFLOW_V2_MATERIAL_OPTIONS
} from '../../project/workflowV2Engine'
import { WorkflowTimeRangeBar } from './WorkflowTimeRangeBar'
import {
  cleanV2NodeTitle,
  resolveV2LogicCategory,
  resolveV2NodeLevel,
  resolveV2NodeTheme
} from './workflowV2Theme'

export { resolveV2NodeTheme } from './workflowV2Theme'

export interface WorkflowNodeCardV2Props {
  node: WorkflowNode
  project: Project
  selected: boolean
  isConnectedToSelected?: boolean
  isDimmed?: boolean
  isActiveAtCurrentTime: boolean
  /** Node đang chạy trong luồng của cảnh camera đang quay */
  running?: boolean
  /** Trạng thái khi đang kéo dây: Node đích hợp lệ / không hợp lệ / đang rê vào */
  wireState?: 'valid' | 'invalid' | 'hover-valid' | 'hover-invalid'
  currentTime: number
  maxDuration: number
  childCount: number
  onSelect: (nodeId: string) => void
  onStartDragNode: (e: React.PointerEvent, node: WorkflowNode) => void
  onToggleEnable: (nodeId: string) => void
  onDeleteNode: (nodeId: string) => void
  onUpdateParams: (nodeId: string, patch: Partial<WorkflowNodeParams>, nextTitle?: string) => void
  onStartWireDrag: (e: React.PointerEvent, nodeId: string, port: WorkflowPortKind, isOutput: boolean) => void
  onScrubTime: (t: number) => void
  onSpawnCameraWaypoint?: (shotId: string, mode: 'pan' | 'zoom-in' | 'zoom-out' | 'hold', fromWaypointTime?: number) => void
}

const pct = (v: number | undefined, fallback: number): string => `${Math.round((v ?? fallback) * 100)}%`

/** Dòng tóm tắt ngắn gọn dưới tiêu đề thẻ (bổ sung thông số, không lặp lại tiêu đề) */
export function summarizeV2Node(node: WorkflowNode, childCount: number): string {
  const p = node.params ?? {}
  const level = resolveV2NodeLevel(node)
  const shared = p.sharedLayerNodeIds?.length ?? 1
  const sharedTag = shared > 1 ? ` · ${shared} layer` : ''
  if (level === 'root') return `${childCount} nhánh`
  if (level === 'group') return `${p.childLayerCount ?? childCount} layer`
  if (level === 'layer') {
    const z = Math.round(p.transformZ ?? 0)
    return `Z ${z >= 0 ? `+${z}` : z}`
  }
  switch (resolveV2LogicCategory(node)) {
    case 'time': return 'Nối tới các node dùng chung thời gian'
    case 'cluster_lock': {
      const locked = node.enabled !== false && p.lockedGroup !== false
      const totalCnt = p.childLayerCount ?? shared
      const lockedCnt = p.targetLayerIds?.length ?? shared
      return `${lockedCnt}/${totalCnt} khoá · ${locked ? 'Đang khoá' : 'Đang mở'}`
    }
    case 'part_swap': {
      if (p.isPartHub) {
        return `${p.childLayerCount ?? childCount} node con bộ phận`
      }
      if (p.isPartChild) {
        const cnt = p.targetLayerIds?.length ?? 1
        if (Math.abs(p.partRotDeg ?? 0) >= 1 || Math.abs(p.partOffsetX ?? 0) >= 1 || Math.abs(p.partOffsetY ?? 0) >= 1) {
          return `Xoay ${p.partRotDeg ?? 0}° · ${cnt} mảnh`
        }
        return `${cnt} mảnh · ${node.enabled ? 'Đang bật' : 'Đã tắt'}`
      }
      if (p.partGroupTitle) return `${p.partGroupTitle}${sharedTag}`
      if (p.swapMode === 'toggle_part') return `Bật/Tắt bộ phận${sharedTag}`
      if (p.swapMode === 'replace_template') return `Đổi cụm 2.5D`
      if (p.swapMode === 'replace_asset') return `Thay ảnh bộ phận`
      return `Biến thể bộ phận${sharedTag}`
    }
    case 'rig_bone': {
      const modeLabel =
        p.rigBonePreset === 'mixamo_12'
          ? '12 mốc Mixamo'
          : p.rigBonePreset === 'chain_3'
            ? '3 khớp Chuỗi'
            : '15 khớp 2.5D'
      return `${modeLabel}${p.rigSoftBinding !== false ? ' · Uốn dẻo' : ''}`
    }
    case 'material': {
      const opt = WORKFLOW_V2_MATERIAL_OPTIONS.find((m) => m.id === p.materialTag)
      return `Cứng ${pct(p.materialStiffness, opt?.defaultStiffness ?? 0.5)} · Nảy ${pct(p.materialBounciness, opt?.defaultBounciness ?? 0.5)}${sharedTag}`
    }
    case 'collision': {
      const opt = WORKFLOW_V2_COLLISION_OPTIONS.find((c) => c.id === p.collisionMode)
      if (shared < 2) return '⚠ Chờ nối Layer B'
      return `${shared} layer · Lực ${pct(p.collisionForce, opt?.defaultForce ?? 1.2)}`
    }
    case 'action':
      if (p.motionMode === 'bbox' || p.actionPreset === 'bbox_target') return `Đầu → Đích · ${p.bboxTargetScalePct ?? 135}%`
      if (p.customMotionPath && p.customMotionPath.length >= 2) {
        return `Quỹ đạo vẽ (${p.customMotionPath.length} mốc)`
      }
      if (p.rigActionPreset && p.rigActionPreset !== 'none') return `Xương: ${p.rigActionPreset}${sharedTag}`
      return `Biên độ ${pct(p.intensity, 0.65)}${sharedTag}`
    case 'anim_fx': {
      if (p.rigActionPreset && p.rigActionPreset !== 'none') {
        return `Clip 2.5D: ${p.rigActionPreset}${sharedTag}`
      }
      const cnt = p.animFxCount ? `${p.animFxCount} nhịp · ` : ''
      const dur = Math.max(0.1, Number(((p.timeEnd ?? 1) - (p.timeStart ?? 0)).toFixed(1)))
      return `${cnt}${dur}s${sharedTag}`
    }
    case 'cave':
      return `Độ tối ${pct(p.caveDarkness, 0.82)}`
    case 'light':
      return `Cường độ ${pct(p.intensity, 1.3)}`
    case 'fx':
      return `Cường độ ${pct(p.intensity, 1)}`
    case 'camera':
      if (p.isCameraWaypoint) {
        return `Zoom ${p.camZoomPct ?? 100}%${p.camYaw || p.camPitch || p.camRoll ? ' · 3D' : ''}`
      }
      return `${p.childLayerCount ?? childCount} cảnh con${p.enableDof ? ' · DOF' : ''}`
    default:
      return `Âm lượng ${pct(p.intensity, 1)}${p.autoLipSync ? ' · nhép môi' : ''}`
  }
}

/** Node Logic gắn vào Layer và các mốc lộ trình quay phụ (> #1) được phép xoá khỏi cây */
export function isDeletableV2Node(node: WorkflowNode): boolean {
  if (node.params?.isCameraWaypoint) return (node.params?.waypointIndex ?? 0) > 0
  const cat = resolveV2LogicCategory(node)
  return resolveV2NodeLevel(node) === 'logic' && cat !== 'camera' && cat !== 'cluster_lock'
}

function resolveThumb(node: WorkflowNode, project: Project): string | undefined {
  const level = resolveV2NodeLevel(node)
  const cat = resolveV2LogicCategory(node)
  if (level !== 'layer' && cat !== 'cluster_lock') return undefined
  const targetId = node.params?.rootLayerId ?? node.params?.targetLayerIds?.[0]
  const layer = project.layers.find((l) => l.id === targetId) ?? project.layers.find((l) => node.params?.targetLayerIds?.includes(l.id))
  if (!layer || layer.type !== 'image') return undefined
  const asset = project.assets.find((a) => a.id === (layer.props as ImageProps).assetId)
  return asset?.dataUrl || asset?.path
}

/**
 * Thẻ Node Workflow V2 gọn, chiều cao cố định (khớp `WF_V2_NODE_H`) để bố cục và hit-test chính xác.
 * Tham số chi tiết được chỉnh trong Bảng thuộc tính bên phải, không bung popover đè lên thẻ khác.
 */
export const WorkflowNodeCardV2 = memo(function WorkflowNodeCardV2({
  node,
  project,
  selected,
  isConnectedToSelected,
  isDimmed,
  isActiveAtCurrentTime,
  running,
  wireState,
  currentTime,
  maxDuration,
  childCount,
  onSelect,
  onStartDragNode,
  onToggleEnable,
  onDeleteNode,
  onUpdateParams,
  onStartWireDrag,
  onScrubTime,
  onSpawnCameraWaypoint
}: WorkflowNodeCardV2Props) {
  const timing = effectiveTimeParams(project, node, node.params ?? {})
  const sharedTime = timeSource(project.workflow, node.id)
  const theme = resolveV2NodeTheme(node)
  const level = resolveV2NodeLevel(node)
  const cat = resolveV2LogicCategory(node)
  const collapsed = Boolean(node.params?.collapsedGroup)
  const collapsedSubs = Boolean(node.params?.collapsedSubLayers)
  const thumb = resolveThumb(node, project)
  const hasOutput = isTimeNode(node) || level !== 'logic' || cat === 'action' || cat === 'collision' || cat === 'material' || cat === 'cluster_lock' || Boolean(node.params?.isPartHub)

  const socket = (kind: 'in' | 'out'): React.ReactElement => {
    const isOut = kind === 'out'
    const port = isOut ? theme.portOut : theme.portIn
    return (
      <div
        className={`wf-v2-socket ${kind}`}
        title={isOut ? (cat === 'action' || cat === 'collision' ? 'Nối chặng tiếp — kéo vào Node tiếp theo hoặc thả ra khoảng trống để tạo chặng mới' : 'Kéo dây sang Node khác (thả ra khoảng trống để gắn nhanh Node Logic)') : 'Cổng nhận kết nối'}
        onPointerDown={(e) => {
          e.stopPropagation()
          onStartWireDrag(e, node.id, port, isOut)
        }}
      >
        <span className="wf-v2-socket-dot" />
      </div>
    )
  }

  return (
    <div
      className={[
        'wf-v2-card',
        theme.levelClass,
        selected ? 'selected' : '',
        isConnectedToSelected ? 'connected-highlight' : '',
        isDimmed ? 'dimmed' : '',
        node.enabled ? '' : 'disabled',
        isActiveAtCurrentTime && node.enabled ? 'active-at-time' : '',
        running ? 'running' : '',
        wireState ? `wire-${wireState}` : ''
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ left: node.position.x, top: node.position.y, ['--wf-v2-accent' as string]: theme.accent }}
      data-node-id={node.id}
      title="Giữ Shift và bấm để chuyển sang node khác"
      onPointerDownCapture={e => { guardWorkflowNodeEvent(e, node.id) }}
      onClickCapture={e => { guardWorkflowNodeEvent(e, node.id) }}
      onKeyDownCapture={e => { if (['Enter', ' ', 'Delete'].includes(e.key)) guardWorkflowNodeEvent(e, node.id) }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onPointerDown={(e) => {
        onSelect(node.id)
        onStartDragNode(e, node)
      }}
      onClick={() => onSelect(node.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect(node.id)
        if (e.key === 'Delete' && isDeletableV2Node(node)) onDeleteNode(node.id)
      }}
    >
      <div className="wf-v2-card-accent-bar" />
      {level !== 'root' && !isTimeNode(node) && socket('in')}
      {hasOutput && socket('out')}

      <div className="wf-v2-card-header">
        {thumb ? (
          <div className="wf-v2-mini-thumb">
            <img src={thumb} alt="" draggable={false} />
          </div>
        ) : (
          <span className="wf-v2-card-icon" aria-hidden="true">{theme.icon}</span>
        )}
        <div className="wf-v2-card-titles">
          <div className="wf-v2-card-meta-row">
            <span className="wf-v2-card-badge">
              {node.params?.isCameraWaypoint && isActiveAtCurrentTime && node.enabled
                ? `BƯỚC ${(node.params.waypointLocalIndex ?? 0) + 1}`
                : theme.badge}
            </span>
            {node.params?.isCameraWaypoint && isActiveAtCurrentTime && node.enabled ? (
              <span className="wf-v2-cam-live-pill">ĐANG QUAY</span>
            ) : (
              <span className="wf-v2-card-sub">{summarizeV2Node(node, childCount)}</span>
            )}
          </div>
          <span className="wf-v2-card-title" title={node.title}>{cleanV2NodeTitle(node.title)}</span>
        </div>
        <div className="wf-v2-card-actions" onPointerDown={(e) => e.stopPropagation()}>
          {node.type === 'camera_director' && node.params?.shotId && onSpawnCameraWaypoint && (
            <button
              type="button"
              className="wf-v2-cam-add-btn"
              title={
                node.params?.isCameraWaypoint
                  ? `Chèn thêm mốc thời gian Camera ngay sau mốc #${node.params.waypointLabel ?? (node.params.waypointLocalIndex ?? 0) + 1}`
                  : 'Thêm mốc thời gian Camera mới vào cảnh này'
              }
              onClick={(event) => {
                event.stopPropagation()
                onSpawnCameraWaypoint(
                  node.params!.shotId!,
                  'zoom-in',
                  node.params?.isCameraWaypoint ? node.params.timeStart : undefined
                )
              }}
            >
              + Mốc
            </button>
          )}
          {(level === 'group' || Boolean(node.params?.isPartHub) || (node.type === 'camera_director' && !node.params?.isCameraWaypoint)) && (
            <button
              type="button"
              className={`wf-v2-icon-btn${collapsed ? ' collapsed' : ''}`}
              title={
                node.params?.isPartHub
                  ? collapsed
                    ? 'Bung các Node con Bộ phận ra trên sơ đồ'
                    : 'Thu gọn các Node con Bộ phận'
                  : node.type === 'camera_director'
                    ? collapsed
                      ? 'Mở rộng các cảnh con lộ trình quay'
                      : 'Thu gọn các cảnh con lộ trình quay'
                    : collapsed
                      ? 'Mở rộng các Layer trong nhóm'
                      : 'Thu gọn nhóm'
              }
              onClick={() => onUpdateParams(node.id, { collapsedGroup: !collapsed })}
            >
              {collapsed ? `+${node.params?.childLayerCount ?? childCount}` : '−'}
            </button>
          )}
          {cat === 'cluster_lock' && (
            <button
              type="button"
              className={`wf-v2-icon-btn${collapsedSubs ? ' collapsed' : ''}`}
              title={
                collapsedSubs
                  ? 'Bung toàn bộ các mảnh Layer con của cụm ra trên sơ đồ'
                  : 'Thu gọn các mảnh phụ của cụm trên sơ đồ (chỉ giữ Gốc neo)'
              }
              onClick={() => onUpdateParams(node.id, { collapsedSubLayers: !collapsedSubs })}
            >
              {collapsedSubs ? `+${Math.max(0, (node.params?.childLayerCount ?? 1) - 1)}` : '−'}
            </button>
          )}
          {level !== 'root' && (
            <button
              type="button"
              role="switch"
              aria-checked={node.enabled}
              className={`wf-v2-toggle-pill ${node.enabled ? 'on' : 'off'}`}
              title={
                cat === 'cluster_lock'
                  ? node.enabled
                    ? 'Đang khoá cả cụm — nhấn để mở khoá cụm (chỉnh lẻ từng mảnh)'
                    : 'Đang mở khoá cụm — nhấn để khoá cả cụm lại'
                  : node.enabled
                    ? 'Node đang BẬT — nhấn để TẮT tạm thời'
                    : 'Node đang TẮT — nhấn để BẬT lại'
              }
              aria-label={node.enabled ? 'Tắt node' : 'Bật node'}
              onClick={() => onToggleEnable(node.id)}
            >
              <span className="wf-v2-toggle-thumb" aria-hidden="true" />
              <span className="wf-v2-toggle-txt">
                {cat === 'cluster_lock' ? (node.enabled ? '🔒' : '🔓') : node.enabled ? 'BẬT' : 'TẮT'}
              </span>
            </button>
          )}
          {isDeletableV2Node(node) && (
            <button
              type="button"
              className="wf-v2-icon-btn danger"
              title="Xoá Node (gỡ luôn hiệu ứng khỏi Layer)"
              aria-label="Xoá node"
              onClick={() => onDeleteNode(node.id)}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="wf-v2-card-footer" onPointerDown={(e) => e.stopPropagation()}>
        <WorkflowTimeRangeBar
          timeStart={timing.timeStart ?? 0}
          timeEnd={timing.timeEnd ?? maxDuration}
          minTime={0}
          maxTime={maxDuration}
          currentTime={currentTime}
          accentColor={theme.accent}
          readOnly={level === 'root' || Boolean(sharedTime)}
          onChangeRange={(s, e) => onUpdateParams(node.id, { timeStart: s, timeEnd: e })}
          onScrubTime={onScrubTime}
        />
      </div>
    </div>
  )
})
