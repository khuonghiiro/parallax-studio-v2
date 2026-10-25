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
      return `Biên độ ${pct(p.intensity, 0.65)}${sharedTag}`
    case 'anim_fx': {
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
  return resolveV2NodeLevel(node) === 'logic' && resolveV2LogicCategory(node) !== 'camera'
}

function resolveThumb(node: WorkflowNode, project: Project): string | undefined {
  if (resolveV2NodeLevel(node) !== 'layer') return undefined
  const layer = project.layers.find((l) => l.id === node.params?.targetLayerIds?.[0])
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
  onScrubTime
}: WorkflowNodeCardV2Props) {
  const theme = resolveV2NodeTheme(node)
  const level = resolveV2NodeLevel(node)
  const collapsed = Boolean(node.params?.collapsedGroup)
  const thumb = resolveThumb(node, project)
  const hasOutput = level !== 'logic' || resolveV2LogicCategory(node) === 'material'

  const socket = (kind: 'in' | 'out'): React.ReactElement => {
    const isOut = kind === 'out'
    const port = isOut ? theme.portOut : theme.portIn
    return (
      <div
        className={`wf-v2-socket ${kind}`}
        title={isOut ? 'Kéo dây sang Node khác (thả ra khoảng trống để gắn nhanh Node Logic)' : 'Cổng nhận kết nối'}
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
      {level !== 'root' && socket('in')}
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
          {(level === 'group' || (node.type === 'camera_director' && !node.params?.isCameraWaypoint)) && (
            <button
              type="button"
              className={`wf-v2-icon-btn${collapsed ? ' collapsed' : ''}`}
              title={
                node.type === 'camera_director'
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
          {level !== 'root' && (
            <button
              type="button"
              className={`wf-v2-icon-btn ${node.enabled ? 'on' : 'off'}`}
              title={node.enabled ? 'Đang bật — nhấn để tắt' : 'Đang tắt — nhấn để bật'}
              aria-label={node.enabled ? 'Tắt node' : 'Bật node'}
              onClick={() => onToggleEnable(node.id)}
            >
              {node.enabled ? '●' : '○'}
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
          timeStart={node.params?.timeStart ?? 0}
          timeEnd={node.params?.timeEnd ?? maxDuration}
          minTime={0}
          maxTime={maxDuration}
          currentTime={currentTime}
          accentColor={theme.accent}
          readOnly={level === 'root'}
          onChangeRange={(s, e) => onUpdateParams(node.id, { timeStart: s, timeEnd: e })}
          onScrubTime={onScrubTime}
        />
      </div>
    </div>
  )
})
