import React, { useEffect, useRef, useState } from 'react'
import type { Project, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import {
  WORKFLOW_V2_COLLISION_OPTIONS,
  getLayerDisplayName
} from '../../project/workflowV2Engine'
import {
  WorkflowV2ActionParams,
  WorkflowV2AnimFxParams,
  WorkflowV2FxParams
} from './WorkflowV2AnimAndFxParams'
import { WorkflowV2CameraParams } from './WorkflowV2CameraParams'
import {
  WorkflowV2ClusterLockParams,
  WorkflowV2PartSwapParams
} from './WorkflowV2ClusterAndPartParams'
import { WorkflowV2CaveParams, WorkflowV2LightParams } from './WorkflowV2LightAndCaveParams'
import { WorkflowV2RigBoneParams } from './WorkflowV2MotionAndRigEditors'
import {
  WorkflowV2AudioParams,
  WorkflowV2LayerParams,
  WorkflowV2MaterialParams,
  WorkflowV2ShotParams
} from './WorkflowV2SceneAndLayerParams'
import { resolveV2LogicCategory, type WorkflowV2SpawnCategory } from './workflowV2Theme'

type UpdateFn = (patch: Partial<WorkflowNodeParams>, nextTitle?: string) => void

export interface WorkflowV2NodeParamsProps {
  node: WorkflowNode
  project: Project
  workflow?: WorkflowGraph
  onUpdate: UpdateFn
  onScrubTime: (t: number) => void
  onSelectNode?: (nodeId: string) => void
  onAttachLogic?: (
    layerNodeId: string,
    category: WorkflowV2SpawnCategory,
    presetId?: string,
    extraParams?: Partial<WorkflowNodeParams>,
    customTitle?: string
  ) => void
  onSpawnFollowupNode?: (durationSec?: number) => void
  onSpawnCameraWaypoint?: (shotId: string, mode: 'pan' | 'zoom-in' | 'zoom-out' | 'hold', fromWaypointTime?: number) => void
  onConnectLayer?: (layerNodeId: string, logicNodeId: string) => void
  onDisconnectEdge?: (edgeId: string) => void
  onToggleEdgeDisable?: (edgeId: string) => void
}

const pct = (v: number): string => `${Math.round(v * 100)}%`

export const ParamSlider: React.FC<{
  label: string
  value: number
  min: number
  max: number
  step: number
  format?: (v: number) => string
  onChange: (v: number) => void
  layout?: 'grid' | 'stacked'
}> = ({ label, value, min, max, step, format = pct, onChange, layout = 'grid' }) => {
  const [localVal, setLocalVal] = useState(value)
  const isDraggingRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const pendingValRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalVal(value)
    }
  }, [value])

  const flush = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (pendingValRef.current !== null) {
      onChange(pendingValRef.current)
      pendingValRef.current = null
    }
  }

  const handleInput = (val: number) => {
    setLocalVal(val)
    pendingValRef.current = val
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        if (pendingValRef.current !== null) {
          onChange(pendingValRef.current)
        }
      })
    }
  }

  const handlePointerDown = () => {
    isDraggingRef.current = true
  }

  const handlePointerUp = () => {
    isDraggingRef.current = false
    flush()
  }

  const currentDisplayVal = isDraggingRef.current ? localVal : value

  if (layout === 'stacked') {
    return (
      <label className="wf-v2-param-row stacked">
        <div className="wf-v2-param-head">
          <span className="wf-v2-param-label">{label}</span>
          <strong>{format(currentDisplayVal)}</strong>
        </div>
        <input
          type="range"
          className="wf-v2-slider"
          min={min}
          max={max}
          step={step}
          value={Math.max(min, Math.min(max, localVal))}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onChange={(e) => handleInput(Number(e.target.value))}
        />
      </label>
    )
  }
  return (
    <label className="wf-v2-param-row">
      <span className="wf-v2-param-label">{label}</span>
      <input
        type="range"
        className="wf-v2-slider"
        min={min}
        max={max}
        step={step}
        value={Math.max(min, Math.min(max, localVal))}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onChange={(e) => handleInput(Number(e.target.value))}
      />
      <strong>{format(currentDisplayVal)}</strong>
    </label>
  )
}

export function OptionPills<T extends string>({
  options,
  value,
  onPick,
  cols = 3
}: {
  options: { id: T; label: string }[]
  value: T
  onPick: (id: T) => void
  cols?: number
}): React.ReactElement {
  return (
    <div
      className="wf-v2-pill-grid"
      data-cols={cols}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {options.map((opt, idx) => {
        const spanFull = cols === 2 && options.length % 2 === 1 && idx === options.length - 1
        return (
          <button
            key={opt.id}
            type="button"
            className={`wf-v2-opt-pill${value === opt.id ? ' active' : ''}`}
            style={spanFull ? { gridColumn: '1 / -1' } : undefined}
            title={opt.label}
            onClick={() => onPick(opt.id)}
          >
            <span className="wf-v2-opt-pill-txt">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function CollisionParams({ node, project, workflow, onUpdate, onScrubTime, onConnectLayer }: WorkflowV2NodeParamsProps): React.ReactElement {
  const p = node.params ?? {}
  const opt = WORKFLOW_V2_COLLISION_OPTIONS.find((c) => c.id === (p.collisionMode ?? 'elastic_bounce')) ?? WORKFLOW_V2_COLLISION_OPTIONS[0]
  const striker = project.layers.find((l) => l.id === (p.strikerLayerId ?? p.targetLayerIds?.[0]))
  const target = project.layers.find(
    (l) => l.id === (p.targetColliderLayerId ?? p.targetLayerIds?.find((id) => id !== striker?.id))
  )
  const tStart = p.timeStart ?? 0
  const tEnd = p.timeEnd ?? project.comp.duration ?? 5
  const tHit = Number((tStart + (tEnd - tStart) * 0.45).toFixed(2))

  // Danh sách các Layer khác trong cùng cảnh để chọn nhanh làm Mục tiêu B (nếu chưa nối hoặc muốn đổi nhanh)
  const candidateTargets = project.layers.filter((l) => {
    if (!l.visible || l.id === striker?.id) return false
    if (l.type === 'particles' || (l.type === 'solid' && Boolean(l.props.pattern))) return false
    if (striker?.composite?.instanceId && l.composite?.instanceId === striker.composite.instanceId) return false
    if (l.composite?.instanceId && !l.composite.isRoot) return false
    if (p.shotId && l.shotId && l.shotId !== p.shotId) return false
    return true
  })

  return (
    <div className="vl-section-card" style={{ marginTop: 2, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="wf-v2-pair">
        <span className="wf-v2-pair-tag" title="Chủ thể A — di chuyển / lao tới va đập">
          A · {striker ? getLayerDisplayName(striker) : 'Chưa có'}
        </span>
        <button
          type="button"
          className="wf-v2-mini-btn"
          disabled={!striker || !target}
          title="Đổi vai trò Chủ thể A và Mục tiêu B"
          onClick={() => striker && target && onUpdate({ strikerLayerId: target.id, targetColliderLayerId: striker.id })}
        >
          ⇄
        </button>
        <span className="wf-v2-pair-tag" title="Mục tiêu B — vật cản chịu lực & biến dạng">
          B · {target ? getLayerDisplayName(target) : 'Chọn Layer B bên dưới'}
        </span>
      </div>

      {candidateTargets.length > 0 && (
        <div className="vl-subcard" style={{ padding: '6px 7px' }}>
          <div className="vl-row-header" style={{ marginBottom: 4 }}>
            <span className="vl-subtitle">🎯 Chọn Layer B (Vật cản bị va chạm khi di chuyển)</span>
          </div>
          <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {candidateTargets.slice(0, 6).map((cand) => {
              const isSel = target?.id === cand.id
              return (
                <button
                  key={cand.id}
                  type="button"
                  className={`vl-pill-btn ${isSel ? 'active-amber' : ''}`}
                  onClick={() => {
                    const layerNodeId =
                      workflow?.nodes.find(
                        (n) =>
                          (n.type === 'layer_assembly' || n.params?.logicCategory === 'cluster_lock') &&
                          n.params?.targetLayerIds?.includes(cand.id)
                      )?.id ?? `v2-layer-${cand.id}`
                    onConnectLayer?.(layerNodeId, node.id)
                    onUpdate(
                      {
                        strikerLayerId: striker?.id,
                        targetColliderLayerId: cand.id,
                        targetLayerIds: Array.from(new Set([...(p.targetLayerIds ?? []), ...(striker ? [striker.id] : []), cand.id]))
                      },
                      `Va chạm: ${striker ? getLayerDisplayName(striker) : 'A'} 💥 ${getLayerDisplayName(cand)}`
                    )
                  }}
                >
                  💥 {getLayerDisplayName(cand)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <OptionPills
        cols={2}
        options={WORKFLOW_V2_COLLISION_OPTIONS.map((c) => ({ id: c.id, label: c.shortLabel }))}
        value={opt.id}
        onPick={(id) => {
          const next = WORKFLOW_V2_COLLISION_OPTIONS.find((c) => c.id === id)!
          onUpdate({ collisionMode: next.id, collisionForce: next.defaultForce, deformIntensity: next.defaultDeform }, `Va chạm: ${next.label}`)
        }}
      />
      <p className="wf-v2-hint" style={{ margin: 0 }}>{opt.description}</p>
      <div className="vl-subcard" style={{ padding: '6px 7px' }}>
        <ParamSlider
          layout="stacked"
          label="Lực va đập (Xung lực)"
          min={0.2}
          max={2.5}
          step={0.05}
          value={p.collisionForce ?? opt.defaultForce}
          onChange={(v) => onUpdate({ collisionForce: v })}
        />
        <ParamSlider
          layout="stacked"
          label="Độ biến dạng đàn hồi (Mesh / Squash)"
          min={0.2}
          max={2.5}
          step={0.05}
          value={p.deformIntensity ?? opt.defaultDeform}
          onChange={(v) => onUpdate({ deformIntensity: v })}
        />
      </div>
      <button type="button" className="wf-v2-ghost-btn" onClick={() => onScrubTime(tHit)}>
        ▶ Tua tới khoảnh khắc va chạm ({tHit.toFixed(2)}s)
      </button>
    </div>
  )
}

const LOGIC_EDITORS: Record<string, React.FC<WorkflowV2NodeParamsProps>> = {
  cluster_lock: WorkflowV2ClusterLockParams,
  part_swap: WorkflowV2PartSwapParams,
  rig_bone: WorkflowV2RigBoneParams,
  material: WorkflowV2MaterialParams,
  collision: CollisionParams,
  action: WorkflowV2ActionParams,
  anim_fx: WorkflowV2AnimFxParams,
  cave: WorkflowV2CaveParams,
  light: WorkflowV2LightParams,
  fx: WorkflowV2FxParams,
  audio: WorkflowV2AudioParams,
  camera: WorkflowV2CameraParams
}

/** Bộ chỉnh tham số theo đúng loại Node (dùng trong Bảng thuộc tính Workflow V2) */
export const WorkflowV2NodeParams: React.FC<WorkflowV2NodeParamsProps> = (props) => {
  const { node } = props
  if (node.params?.groupKind) return null
  if (node.params?.logicCategory === 'cluster_lock') return <WorkflowV2ClusterLockParams {...props} />
  if (node.params?.logicCategory === 'part_swap') return <WorkflowV2PartSwapParams {...props} />
  if (node.params?.logicCategory === 'rig_bone') return <WorkflowV2RigBoneParams {...props} />
  if (node.type === 'scene_shot') return <WorkflowV2ShotParams {...props} />
  if (node.type === 'layer_assembly') return <WorkflowV2LayerParams {...props} />
  const Editor = LOGIC_EDITORS[resolveV2LogicCategory(node)]
  return Editor ? <Editor {...props} /> : null
}
