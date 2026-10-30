import { effectiveTimeParams, timeSource } from '../../project/workflowTiming'
import React, { useEffect, useMemo, useState } from 'react'
import type { Project, Shot, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import {
  getCompatibleLogicCatalogForNode,
  getLayerDisplayName,
  spawnTimedFollowupNodeV2,
  syncWorkflowV2NodeToProject
} from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import { IconTrash } from '../icons'
import { WorkflowTimeRangeBar } from './WorkflowTimeRangeBar'
import { WorkflowV2DirectStagePreview } from './WorkflowV2DirectStagePreview'
import { WorkflowV2JsonPanel } from './WorkflowV2JsonPanel'
import {
  WorkflowV2NodeSwitcherBar,
  resolveActiveLayerForInspector
} from './WorkflowV2LayerLogicSection'
import { WorkflowV2Logic25DPreview } from './WorkflowV2Logic25DPreview'
import { WorkflowV2NodeParams } from './WorkflowV2NodeParams'
import { isDeletableV2Node, summarizeV2Node } from './WorkflowNodeCardV2'
import {
  cleanV2NodeTitle,
  resolveV2NodeLevel,
  resolveV2NodeTheme,
  type WorkflowV2SpawnCategory
} from './workflowV2Theme'

export interface WorkflowV2InspectorProps {
  workflow: WorkflowGraph
  project: Project
  node: WorkflowNode | null
  selectedLayerId?: string | null
  currentTime: number
  shots: { shot: Shot; index: number }[]
  activeShotId: string | null
  focusedShotId: string | null
  jsonMode: boolean
  /** Khi nhúng vào cột phải chung (Inspector), ẩn thanh tab trùng lặp và chiếm 100% bề rộng cột */
  embedded?: boolean
  hideModeTabs?: boolean
  isColumnExpanded?: boolean
  onToggleColumnExpanded?: () => void
  onSetJsonMode: (jsonMode: boolean) => void
  onSelectShotFocus: (shotId: string | null) => void
  onUpdateParams: (nodeId: string, patch: Partial<WorkflowNodeParams>, nextTitle?: string) => void
  onToggleEnable: (nodeId: string) => void
  onDeleteNode: (nodeId: string) => void
  onAttachLogic: (
    layerNodeId: string,
    category: WorkflowV2SpawnCategory,
    presetId?: string,
    extraParams?: Partial<WorkflowNodeParams>,
    customTitle?: string
  ) => void
  onSpawnCameraWaypoint?: (shotId: string, mode: 'pan' | 'zoom-in' | 'zoom-out' | 'hold', fromWaypointTime?: number) => void
  onSelectNode?: (nodeId: string) => void
  /** Nối thêm một Layer vào Node Logic hoặc Khoá Cụm */
  onConnectLayer: (layerNodeId: string, logicNodeId: string) => void
  onDisconnectEdge?: (edgeId: string) => void
  onToggleEdgeDisable?: (edgeId: string) => void
  onScrubTime: (t: number) => void
}

/** Chọn nhanh Layer B (cùng cảnh) cho Node Va chạm đang chờ — thay cho việc tự đoán đối tượng va chạm */
const CollisionPartnerPicker: React.FC<{ workflow: WorkflowGraph; node: WorkflowNode; onPick: (layerNodeId: string) => void }> = ({ workflow, node, onPick }) => {
  const linked = new Set(node.params?.sharedLayerNodeIds ?? [])
  const candidates = workflow.nodes.filter(
    (n) => n.type === 'layer_assembly' && !n.params?.groupKind && n.params?.shotId === node.params?.shotId && !linked.has(n.id)
  )
  if (candidates.length === 0) return <em className="wf-v2-hint">Cảnh này không còn Layer nào khác để làm Layer B.</em>
  return (
    <div className="wf-v2-partner">
      <span className="wf-v2-hint">⚠ Chọn Layer B để va chạm có hiệu lực:</span>
      <div className="wf-v2-chip-grid">
        {candidates.slice(0, 10).map((c) => (
          <button key={c.id} type="button" className="wf-v2-spawn-chip" onClick={() => onPick(c.id)} title={c.title}>
            B · {cleanV2NodeTitle(c.title)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Ô nhập giây: gõ tự do, chỉ áp dụng khi Enter / rời ô, luôn kẹp trong [min, max] */
const TimeField: React.FC<{ label: string; value: number; min: number; max: number; disabled?: boolean; onCommit: (v: number) => void }> = ({
  label,
  value,
  min,
  max,
  disabled,
  onCommit
}) => {
  const [draft, setDraft] = useState(value.toFixed(2))
  useEffect(() => setDraft(value.toFixed(2)), [value])
  const commit = (): void => {
    const n = Number(draft.replace(',', '.'))
    if (!Number.isFinite(n)) return setDraft(value.toFixed(2))
    const clamped = Number(Math.max(min, Math.min(max, n)).toFixed(2))
    setDraft(clamped.toFixed(2))
    if (Math.abs(clamped - value) > 0.001) onCommit(clamped)
  }
  return (
    <label className="wf-v2-time-field">
      <span>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setDraft(value.toFixed(2))
        }}
      />
      <em>s</em>
    </label>
  )
}

function linkedLayerNames(node: WorkflowNode, project: Project): string[] {
  const ids = node.params?.targetLayerIds ?? []
  const matched = project.layers.filter((l) => ids.includes(l.id))
  const roots = matched.filter((l) => !l.composite || l.composite.isRoot)
  const names = (roots.length > 0 ? roots : matched).map(getLayerDisplayName)
  return Array.from(new Set(names))
}

const DIRECT_STAGE_KEY = 'pxs:wf-v2-direct-stage-open'
const LOGIC_PAD_KEY = 'pxs:wf-v2-logic-pad-open'
const INSPECTOR_WIDTH_KEY = 'pxs:wf-v2-inspector-width'
const MIN_INSPECTOR_W = 280
const MAX_INSPECTOR_W = 680
const DEFAULT_INSPECTOR_W = 380

function readCachedInspectorWidth(): number {
  const raw = Number(localStorage.getItem(INSPECTOR_WIDTH_KEY))
  if (Number.isFinite(raw) && raw >= MIN_INSPECTOR_W && raw <= MAX_INSPECTOR_W) return Math.round(raw)
  return DEFAULT_INSPECTOR_W
}

/** Bảng thuộc tính của Node đang chọn + Chế độ JSON Cảnh & Main trong Workflow V2 & Timeline */
export const WorkflowV2Inspector: React.FC<WorkflowV2InspectorProps> = (props) => {
  const { node, project, workflow, currentTime, jsonMode, embedded, hideModeTabs, onSetJsonMode } = props
  const [inspectorWidth, setInspectorWidth] = useState<number>(readCachedInspectorWidth)
  const [resizingWidth, setResizingWidth] = useState(false)
  const [directStageOpen, setDirectStageOpen] = useState(() => localStorage.getItem(DIRECT_STAGE_KEY) !== '0')
  const [logicPadOpen, setLogicPadOpen] = useState(() => localStorage.getItem(LOGIC_PAD_KEY) !== '0')

  useEffect(() => {
    if (node?.params?.logicCategory === 'action' && node.params.motionMode !== 'cycle') setDirectStageOpen(true)
  }, [node?.id, node?.params?.logicCategory, node?.params?.motionMode])

  const activeLayer = resolveActiveLayerForInspector(project, node, props.selectedLayerId ?? null)
  const compat = useMemo(
    () =>
      node
        ? getCompatibleLogicCatalogForNode(node, project)
        : { parentKind: 'other' as const, categories: [], dynamicParts: [] },
    [node, project]
  )

  const toggleDirectStage = (): void => {
    setDirectStageOpen((prev) => {
      const next = !prev
      localStorage.setItem(DIRECT_STAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  const toggleLogicPad = (): void => {
    setLogicPadOpen((prev) => {
      const next = !prev
      localStorage.setItem(LOGIC_PAD_KEY, next ? '1' : '0')
      return next
    })
  }

  const startResizeWidth = (e: React.PointerEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = inspectorWidth
    setResizingWidth(true)

    const onMove = (ev: PointerEvent): void => {
      const delta = startX - ev.clientX
      const nextW = Math.round(Math.max(MIN_INSPECTOR_W, Math.min(MAX_INSPECTOR_W, startW + delta)))
      setInspectorWidth(nextW)
      localStorage.setItem(INSPECTOR_WIDTH_KEY, String(nextW))
    }
    const onUp = (): void => {
      setResizingWidth(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const resizerHandle = embedded ? null : (
    <div
      className={`wf-v2-insp-resizer${resizingWidth ? ' dragging' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="Kéo co dãn độ rộng cột Thuộc tính Node"
      title="Kéo trái/phải để co dãn độ rộng cột Thuộc tính Node (tự lưu cache)"
      onPointerDown={startResizeWidth}
    />
  )

  const modeTabs = hideModeTabs ? null : (
    <div className="wf-v2-insp-tabs" role="tablist" aria-label="Chế độ bảng bên phải">
      <button
        type="button"
        role="tab"
        aria-selected={!jsonMode}
        className={`wf-v2-insp-tab${!jsonMode ? ' active' : ''}`}
        onClick={() => onSetJsonMode(false)}
      >
        Thuộc tính Node
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={jsonMode}
        className={`wf-v2-insp-tab${jsonMode ? ' active' : ''}`}
        onClick={() => onSetJsonMode(true)}
      >
        <code>{'{ }'}</code> JSON Cảnh &amp; Main
      </button>
      {props.onToggleColumnExpanded && (
        <button
          type="button"
          className={`wf-v2-insp-expand-btn${props.isColumnExpanded ? ' active' : ''}`}
          title={
            props.isColumnExpanded
              ? 'Đang mở rộng toàn cột phải — nhấn để thu về chế độ chia đôi trên/dưới'
              : 'Mở rộng chiếm trọn cột phải màn hình (4 tab trên giữ nguyên, 2 tab Node & JSON nằm dưới đáy)'
          }
          onClick={props.onToggleColumnExpanded}
        >
          {props.isColumnExpanded ? '⤡ Chia đôi' : '⤢ Mở rộng'}
        </button>
      )}
    </div>
  )

  const wrapStyle = embedded ? undefined : { width: inspectorWidth }

  if (jsonMode) {
    return (
      <aside className={`wf-v2-inspector json-open${embedded ? ' is-embedded' : ''}`} data-mcp-region="workflow_inspector" style={wrapStyle}>
        {resizerHandle}
        {modeTabs}
        <WorkflowV2JsonPanel
          project={project}
          workflow={workflow}
          shots={props.shots}
          activeShotId={props.activeShotId}
          focusedShotId={props.focusedShotId}
          onSelectShotFocus={props.onSelectShotFocus}
        />
      </aside>
    )
  }

  if (!node) {
    return (
      <aside className={`wf-v2-inspector${embedded ? ' is-embedded' : ''}`} data-mcp-region="workflow_inspector" style={wrapStyle}>
        {resizerHandle}
        {modeTabs}
        {activeLayer && props.onSelectNode && (
          <WorkflowV2NodeSwitcherBar
            workflow={workflow}
            project={project}
            layer={activeLayer}
            activeNode={null}
            onSelectNode={props.onSelectNode}
            onAttachLogic={props.onAttachLogic}
          />
        )}
        <div className="wf-v2-insp-empty">
          Chọn một Layer hoặc Node trên Timeline / Sơ đồ để xem đúng thông số logic của Node đó, hoặc chuyển sang tab <b>JSON Cảnh</b> để xem/sửa JSON từng cảnh.
        </div>
      </aside>
    )
  }

  const theme = resolveV2NodeTheme(node)
  const level = resolveV2NodeLevel(node)
  const logicCat = node.params?.logicCategory
  const isClusterLock = logicCat === 'cluster_lock'
  const isLayerOrCamBboxNode =
    level === 'layer' ||
    isClusterLock ||
    logicCat === 'action' ||
    logicCat === 'collision' ||
    node.type === 'camera_director' ||
    Boolean(node.params?.isCameraWaypoint)
  const isLayerLogicNode = level === 'logic' && !isClusterLock && node.type !== 'camera_director' && !node.params?.isCameraWaypoint
  const show25DPreview =
    isLayerLogicNode && Boolean(logicCat && ['light', 'cave', 'material', 'fx'].includes(logicCat))
  const canChainTimedStep =
    Boolean(node.params?.isPartChild) || logicCat === 'anim_fx' || logicCat === 'action' || logicCat === 'collision'
  const duration = Math.max(1, project.comp.duration || 5)
  const timing = effectiveTimeParams(project, node, node.params ?? {})
  const source = timeSource(workflow, node.id)
  const tStart = timing.timeStart ?? 0
  const tEnd = timing.timeEnd ?? duration
  const timeLocked = level === 'root' || Boolean(source)
  const childCount = workflow.edges.filter((e) => e.fromNode === node.id).length
  const linked = logicCat === 'time'
    ? workflow.edges.filter(e => e.fromNode === node.id && e.fromPort === 'time_range' && !e.disabled).map(e => workflow.nodes.find(n => n.id === e.toNode)?.title ?? e.toNode)
    : level === 'logic' ? linkedLayerNames(node, project) : []
  const update = (patch: Partial<WorkflowNodeParams>, title?: string): void => props.onUpdateParams(node.id, patch, title)

  const handleSpawnFollowup = (stepDur = 3.0): void => {
    let createdId: string | null = null
    let nextStart = tEnd
    useEditor.getState().update((draft) => {
      const wf = (draft.workflow ?? workflow) as WorkflowGraph
      const res = spawnTimedFollowupNodeV2(wf, node.id, stepDur)
      if (!res) return
      draft.workflow = res.workflow
      createdId = res.createdNodeId
      const createdNode = res.workflow.nodes.find((n) => n.id === res.createdNodeId)
      if (createdNode) {
        draft.comp.duration = Math.max(draft.comp.duration, createdNode.params?.timeEnd ?? 0)
        nextStart = createdNode.params?.timeStart ?? tEnd
        syncWorkflowV2NodeToProject(draft as Project, createdNode)
      }
    }, 'wf-v2-spawn-followup')
    if (createdId) {
      props.onScrubTime(nextStart)
      props.onSelectNode?.(createdId)
    }
  }

  return (
    <aside
      className={`wf-v2-inspector${embedded ? ' is-embedded' : ''}`}
      data-mcp-region="workflow_inspector"
      style={{ ...wrapStyle, ['--wf-v2-accent' as string]: theme.accent }}
    >
      {resizerHandle}
      {modeTabs}
      <header className="wf-v2-insp-head">
        <span className="wf-v2-insp-icon" aria-hidden="true">{theme.icon}</span>
        <div className="wf-v2-insp-titles">
          <span className="wf-v2-insp-badge">{theme.badge}</span>
          <strong title={node.title}>{cleanV2NodeTitle(node.title)}</strong>
          <small>{summarizeV2Node(node, childCount)}</small>
        </div>
        {isLayerOrCamBboxNode && (
          <button
            type="button"
            className={`wf-v2-insp-bbox-toggle${directStageOpen ? ' active' : ''}`}
            title={directStageOpen ? 'Đang bật khung chỉnh BBox 2D cố định — nhấn để ẩn' : 'Bật khung chỉnh BBox 2D cố định trên đầu bảng'}
            onClick={toggleDirectStage}
          >
            🎯 BBox
          </button>
        )}
        {show25DPreview && (
          <button
            type="button"
            className={`wf-v2-insp-bbox-toggle${logicPadOpen ? ' active' : ''}`}
            title={logicPadOpen ? 'Đang bật Khung chỉnh 2.5D cố định — nhấn để ẩn' : 'Bật Khung chỉnh 2.5D cố định trên đầu bảng cho Node Logic này'}
            onClick={toggleLogicPad}
          >
            🎛️ 2.5D
          </button>
        )}
        {level !== 'root' && (
          <button
            type="button"
            className={`wf-v2-insp-toggle ${node.enabled ? 'on' : 'off'}`}
            role="switch"
            aria-checked={node.enabled}
            title={node.enabled ? 'Node đang BẬT — nhấn để TẮT' : 'Node đang TẮT — nhấn để BẬT'}
            onClick={() => props.onToggleEnable(node.id)}
          >
            <span className="wf-v2-insp-toggle-thumb" aria-hidden="true" />
            <span className="wf-v2-insp-toggle-txt">{node.enabled ? 'BẬT' : 'TẮT'}</span>
          </button>
        )}
        {isDeletableV2Node(node) && (
          <button type="button" className="wf-v2-insp-del" title="Xoá Node (gỡ luôn hiệu ứng khỏi Layer)" aria-label="Xoá node" onClick={() => props.onDeleteNode(node.id)}>
            <IconTrash width={13} height={13} />
          </button>
        )}
      </header>

      {level !== 'logic' && activeLayer && props.onSelectNode && (
        <WorkflowV2NodeSwitcherBar
          workflow={workflow}
          project={project}
          layer={activeLayer}
          activeNode={node}
          onSelectNode={props.onSelectNode}
          onAttachLogic={props.onAttachLogic}
        />
      )}

      {/* Vùng ghim cố định (không cuộn theo danh sách thông số bên dưới) cho Khung BBox 2D & Khung chỉnh 2.5D */}
      {(isLayerOrCamBboxNode || show25DPreview) && (
        <div className="wf-v2-insp-pinned-preview">
          {isLayerOrCamBboxNode && (
            <WorkflowV2DirectStagePreview
              node={node}
              project={project}
              workflow={workflow}
              currentTime={currentTime}
              open={directStageOpen}
              onToggleOpen={toggleDirectStage}
              onUpdateParams={props.onUpdateParams}
              onSelectNode={props.onSelectNode}
              onScrubTime={props.onScrubTime}
            />
          )}

          {show25DPreview && (
            <WorkflowV2Logic25DPreview
              node={node}
              project={project}
              currentTime={currentTime}
              open={logicPadOpen}
              onToggleOpen={toggleLogicPad}
              onUpdateParams={props.onUpdateParams}
              onScrubTime={props.onScrubTime}
            />
          )}
        </div>
      )}

      <div className="wf-v2-insp-body">
        <section className="wf-v2-insp-sec workflow-node-timing" data-mcp-region="workflow_motion_timing">
          <div className="wf-v2-insp-sec-title">
            <span>Tiến trình Thời gian</span>
            {timeLocked ? (
              <span className="wf-v2-insp-note">{source ? `Theo ${source.title} · ngắt dây để dùng riêng` : 'theo phạm vi cảnh'}</span>
            ) : linked.length > 0 ? (
              <span className="wf-v2-insp-target-badge" title={`Áp dụng cho: ${linked.join(', ')}`}>
                🎯 {linked[0]}{linked.length > 1 ? ` +${linked.length - 1}` : ''}
              </span>
            ) : null}
          </div>
          <div className="wf-v2-time-fields">
            <TimeField label="Từ" value={tStart} min={0} max={tEnd - 0.1} disabled={timeLocked} onCommit={(v) => update({ timeStart: v })} />
            <TimeField label="Đến" value={tEnd} min={tStart + 0.1} max={duration} disabled={timeLocked} onCommit={(v) => update({ timeEnd: v })} />
            <span className="wf-v2-time-dur">{(tEnd - tStart).toFixed(2)}s</span>
          </div>
          {!timeLocked && (
            <div className="wf-v2-time-quick-row">
              <button
                type="button"
                className="wf-v2-time-quick-btn"
                title={`Đặt mốc bắt đầu tại vị trí Playhead hiện tại (${currentTime.toFixed(2)}s)`}
                onClick={() => {
                  const span = Math.max(0.5, Number((tEnd - tStart).toFixed(2)))
                  const s = Number(Math.max(0, Math.min(duration - 0.2, currentTime)).toFixed(2))
                  const e = Number(Math.min(duration, s + span).toFixed(2))
                  update({ timeStart: s, timeEnd: Math.max(s + 0.2, e) })
                }}
              >
                📍 Từ Playhead
              </button>
              <button
                type="button"
                className={`wf-v2-time-quick-btn${Math.abs(tEnd - tStart - 1.5) < 0.08 ? ' active' : ''}`}
                title="Đặt thời lượng hành động 1.5 giây"
                onClick={() => update({ timeEnd: Number(Math.min(duration, tStart + 1.5).toFixed(2)) })}
              >
                1.5s
              </button>
              <button
                type="button"
                className={`wf-v2-time-quick-btn${Math.abs(tEnd - tStart - 3.0) < 0.08 ? ' active' : ''}`}
                title="Đặt thời lượng hành động 3.0 giây (ví dụ: 15s – 18s)"
                onClick={() => update({ timeEnd: Number(Math.min(duration, tStart + 3.0).toFixed(2)) })}
              >
                3.0s
              </button>
              <button
                type="button"
                className={`wf-v2-time-quick-btn${tStart <= 0.05 && tEnd >= duration - 0.05 ? ' active' : ''}`}
                title="Kéo dài xuyên suốt toàn cảnh"
                onClick={() => update({ timeStart: 0, timeEnd: duration })}
              >
                ↔ Toàn cảnh
              </button>
              {canChainTimedStep && (
                <button
                  type="button"
                  className="wf-v2-time-quick-btn chain-cta"
                  title="Tạo nối tiếp một Node hành động 3s ngay sau mốc hiện tại (ví dụ: 15s–18s)"
                  onClick={() => handleSpawnFollowup(3.0)}
                >
                  + Chặng tiếp (+3s)
                </button>
              )}
              {node.type === 'camera_director' && node.params?.shotId && props.onSpawnCameraWaypoint && (
                <button
                  type="button"
                  className="wf-v2-time-quick-btn chain-cta"
                  title={
                    node.params?.isCameraWaypoint
                      ? `Chèn thêm mốc thời gian Camera ngay sau mốc #${node.params.waypointLabel ?? (node.params.waypointLocalIndex ?? 0) + 1}`
                      : 'Thêm mốc thời gian Camera mới vào lộ trình quay của cảnh này'
                  }
                  onClick={() =>
                    props.onSpawnCameraWaypoint!(
                      node.params!.shotId!,
                      'zoom-in',
                      node.params?.isCameraWaypoint ? node.params.timeStart : undefined
                    )
                  }
                >
                  + Thêm mốc Camera
                </button>
              )}
            </div>
          )}
          <WorkflowTimeRangeBar
            timeStart={tStart}
            timeEnd={tEnd}
            maxTime={duration}
            currentTime={currentTime}
            accentColor={theme.accent}
            readOnly={timeLocked}
            onChangeRange={(s, e) => update({ timeStart: s, timeEnd: e })}
            onScrubTime={props.onScrubTime}
          />
        </section>

        {level === 'logic' &&
          node.type !== 'camera_director' &&
          !node.params?.isPartChild &&
          (logicCat === 'time' || logicCat === 'collision' || linked.length === 0 || linked.length > 1) && (
          <section className="wf-v2-insp-sec">
            <div className="wf-v2-insp-sec-title">Áp dụng cho</div>
            <div className="wf-v2-linked">
              {linked.length ? linked.map((name) => <span key={name}>{name}</span>) : <em>{logicCat === 'time' ? 'Kéo cổng ra của Time tới Layer hoặc node cần dùng chung thời gian.' : 'Chưa nối Layer nào — kéo dây từ một Layer vào Node này'}</em>}
            </div>
            {node.params?.logicCategory === 'collision' && (node.params?.sharedLayerNodeIds?.length ?? 0) < 2 && (
              <CollisionPartnerPicker workflow={workflow} node={node} onPick={(layerNodeId) => props.onConnectLayer(layerNodeId, node.id)} />
            )}
          </section>
        )}

        {node.type === 'camera_director' && !node.params?.isCameraWaypoint && (
          <section className="wf-v2-insp-sec">
            <div className="wf-v2-insp-sec-title">Các cảnh con trong lộ trình quay</div>
            <div className="wf-v2-chip-grid">
              {workflow.nodes
                .filter((n) => n.type === 'camera_director' && Boolean(n.params?.isCameraWaypoint) && n.params?.shotId === node.params?.shotId)
                .sort((a, b) => (a.params?.waypointLocalIndex ?? 0) - (b.params?.waypointLocalIndex ?? 0))
                .map((wp) => {
                  const wpTheme = resolveV2NodeTheme(wp)
                  return (
                    <button
                      key={wp.id}
                      type="button"
                      className="wf-v2-spawn-chip"
                      style={{ ['--wf-v2-accent' as string]: wpTheme.accent }}
                      title={`${wp.title} (${(wp.params?.timeStart ?? 0).toFixed(1)}s – ${(wp.params?.timeEnd ?? 0).toFixed(1)}s)`}
                      onClick={() => props.onSelectNode?.(wp.id)}
                    >
                      {wpTheme.icon} {cleanV2NodeTitle(wp.title)}
                    </button>
                  )
                })}
            </div>
            <button type="button" className="wf-v2-ghost-btn" onClick={() => update({ collapsedGroup: !node.params?.collapsedGroup })}>
              {node.params?.collapsedGroup ? 'Mở rộng các cảnh con trên sơ đồ' : 'Thu gọn các cảnh con trên sơ đồ'}
            </button>
          </section>
        )}

        {level !== 'group' && logicCat !== 'time' && (
          <section className="wf-v2-insp-sec">
            <div className="wf-v2-insp-sec-title">Thông số</div>
            <WorkflowV2NodeParams
              node={node}
              project={project}
              workflow={workflow}
              onUpdate={update}
              onScrubTime={props.onScrubTime}
              onSelectNode={props.onSelectNode}
              onAttachLogic={props.onAttachLogic}
              onSpawnFollowupNode={handleSpawnFollowup}
              onSpawnCameraWaypoint={props.onSpawnCameraWaypoint}
              onConnectLayer={props.onConnectLayer}
              onDisconnectEdge={props.onDisconnectEdge}
              onToggleEdgeDisable={props.onToggleEdgeDisable}
            />
          </section>
        )}

        {(level === 'layer' || isClusterLock) && (
          <section className="wf-v2-insp-sec">
            <div className="wf-v2-insp-sec-title">
              Gắn thêm Node Logic con ({compat.parentKind === 'composite_25d' ? 'Cụm 2.5D' : compat.parentKind === 'model_3d' ? 'Khối 3D' : 'Layer 2.5D'})
            </div>
            <div className="wf-v2-chip-grid">
              {compat.categories.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="wf-v2-spawn-chip"
                  style={{ ['--wf-v2-accent' as string]: item.accent }}
                  title={item.hint}
                  onClick={() => props.onAttachLogic(node.id, item.id)}
                >
                  <span aria-hidden="true">{item.icon}</span> {item.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {(level === 'root' || level === 'group') && (
          <section className="wf-v2-insp-sec">
            <p className="wf-v2-hint">
              {level === 'root'
                ? 'Cảnh là một cụm trong không gian chung. Khoảng thời gian lấy theo lộ trình camera (giống dải "Cảnh đang quay" trên Timeline); dây Camera bên trái nối sang cảnh kế tiếp.'
                : 'Bật/tắt nhóm sẽ ẩn/hiện mọi Layer con. Thu hẹp khoảng thời gian của nhóm sẽ cắt các Layer con vào trong khoảng đó.'}
            </p>
            {level === 'group' && (
              <button type="button" className="wf-v2-ghost-btn" onClick={() => update({ collapsedGroup: !node.params?.collapsedGroup })}>
                {node.params?.collapsedGroup ? 'Mở rộng nhóm trên sơ đồ' : 'Thu gọn nhóm trên sơ đồ'}
              </button>
            )}
          </section>
        )}
      </div>
    </aside>
  )
}
