import React from 'react'
import type { Project, WorkflowNode, WorkflowNodeParams } from '@shared/types'
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
import {
  WorkflowV2AudioParams,
  WorkflowV2LayerParams,
  WorkflowV2MaterialParams,
  WorkflowV2ShotParams
} from './WorkflowV2SceneAndLayerParams'
import { resolveV2LogicCategory } from './workflowV2Theme'

type UpdateFn = (patch: Partial<WorkflowNodeParams>, nextTitle?: string) => void

export interface WorkflowV2NodeParamsProps {
  node: WorkflowNode
  project: Project
  onUpdate: UpdateFn
  onScrubTime: (t: number) => void
  onSpawnCameraWaypoint?: (shotId: string, mode: 'pan' | 'zoom-in' | 'zoom-out' | 'hold', fromWaypointTime?: number) => void
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
}> = ({ label, value, min, max, step, format = pct, onChange }) => (
  <label className="wf-v2-param-row">
    <span className="wf-v2-param-label">{label}</span>
    <input
      type="range"
      className="wf-v2-slider"
      min={min}
      max={max}
      step={step}
      value={Math.max(min, Math.min(max, value))}
      onChange={(e) => onChange(Number(e.target.value))}
    />
    <strong>{format(value)}</strong>
  </label>
)

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
    <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`wf-v2-opt-pill${value === opt.id ? ' active' : ''}`}
          title={opt.label}
          onClick={() => onPick(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function CollisionParams({ node, project, onUpdate, onScrubTime }: WorkflowV2NodeParamsProps): React.ReactElement {
  const p = node.params ?? {}
  const opt = WORKFLOW_V2_COLLISION_OPTIONS.find((c) => c.id === (p.collisionMode ?? 'elastic_bounce')) ?? WORKFLOW_V2_COLLISION_OPTIONS[0]
  const striker = project.layers.find((l) => l.id === (p.strikerLayerId ?? p.targetLayerIds?.[0]))
  const target = project.layers.find(
    (l) => l.id === (p.targetColliderLayerId ?? p.targetLayerIds?.find((id) => id !== striker?.id))
  )
  const tHit = Number(((p.timeStart ?? 0) + ((p.timeEnd ?? 0) - (p.timeStart ?? 0)) * 0.45).toFixed(2))
  return (
    <>
      <div className="wf-v2-pair">
        <span className="wf-v2-pair-tag" title="Chủ thể A — lao tới va đập">A · {striker ? getLayerDisplayName(striker) : 'Chưa có'}</span>
        <button
          type="button"
          className="wf-v2-mini-btn"
          disabled={!striker || !target}
          title="Đổi vai trò Chủ thể A và Mục tiêu B"
          onClick={() => striker && target && onUpdate({ strikerLayerId: target.id, targetColliderLayerId: striker.id })}
        >
          ⇄
        </button>
        <span className="wf-v2-pair-tag" title="Mục tiêu B — chịu lực & biến dạng">B · {target ? getLayerDisplayName(target) : 'Nối thêm 1 Layer'}</span>
      </div>
      <OptionPills
        cols={2}
        options={WORKFLOW_V2_COLLISION_OPTIONS.map((c) => ({ id: c.id, label: c.shortLabel }))}
        value={opt.id}
        onPick={(id) => {
          const next = WORKFLOW_V2_COLLISION_OPTIONS.find((c) => c.id === id)!
          onUpdate({ collisionMode: next.id, collisionForce: next.defaultForce, deformIntensity: next.defaultDeform }, `Va chạm: ${next.label}`)
        }}
      />
      <p className="wf-v2-hint">{opt.description}</p>
      <ParamSlider label="Lực va đập" min={0.2} max={2.5} step={0.05} value={p.collisionForce ?? opt.defaultForce} onChange={(v) => onUpdate({ collisionForce: v })} />
      <ParamSlider label="Biến dạng" min={0.2} max={2.5} step={0.05} value={p.deformIntensity ?? opt.defaultDeform} onChange={(v) => onUpdate({ deformIntensity: v })} />
      <button type="button" className="wf-v2-ghost-btn" onClick={() => onScrubTime(tHit)}>
        Tua tới khoảnh khắc va chạm ({tHit.toFixed(2)}s)
      </button>
    </>
  )
}

const LOGIC_EDITORS: Record<string, React.FC<WorkflowV2NodeParamsProps>> = {
  cluster_lock: WorkflowV2ClusterLockParams,
  part_swap: WorkflowV2PartSwapParams,
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
  if (node.type === 'scene_shot') return <WorkflowV2ShotParams {...props} />
  if (node.type === 'layer_assembly') return <WorkflowV2LayerParams {...props} />
  const Editor = LOGIC_EDITORS[resolveV2LogicCategory(node)]
  return Editor ? <Editor {...props} /> : null
}
