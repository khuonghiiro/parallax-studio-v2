import React from 'react'
import type { Project, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import {
  WORKFLOW_V2_ACTION_OPTIONS,
  WORKFLOW_V2_CAMERA_OPTIONS,
  WORKFLOW_V2_CAVE_OPTIONS,
  WORKFLOW_V2_COLLISION_OPTIONS,
  WORKFLOW_V2_FX_OPTIONS,
  WORKFLOW_V2_LIGHT_OPTIONS,
  WORKFLOW_V2_MATERIAL_OPTIONS,
  getLayerDisplayName
} from '../../project/workflowV2Engine'
import { resolveV2LogicCategory } from './workflowV2Theme'

const LIGHT_SWATCHES = ['#38bdf8', '#fbbf24', '#f97316', '#a855f7', '#34d399', '#f43f5e', '#ffffff']

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

const shortLabel = (label: string): string => label.replace(/\s*\(.*\)/, '').replace(/\s*\/.*$/, '')

function MaterialParams({ node, onUpdate }: WorkflowV2NodeParamsProps): React.ReactElement {
  const p = node.params ?? {}
  const opt = WORKFLOW_V2_MATERIAL_OPTIONS.find((m) => m.id === (p.materialTag ?? 'jelly_slime')) ?? WORKFLOW_V2_MATERIAL_OPTIONS[0]
  const shared = p.sharedLayerNodeIds?.length ?? 1
  return (
    <>
      <OptionPills
        options={WORKFLOW_V2_MATERIAL_OPTIONS.map((m) => ({ id: m.id, label: m.shortLabel }))}
        value={opt.id}
        onPick={(id) => {
          const next = WORKFLOW_V2_MATERIAL_OPTIONS.find((m) => m.id === id)!
          onUpdate(
            {
              materialTag: next.id,
              materialStiffness: next.defaultStiffness,
              materialBounciness: next.defaultBounciness,
              materialGravity: next.defaultGravity
            },
            `Vật liệu: ${next.label}`
          )
        }}
      />
      <p className="wf-v2-hint">
        <strong>Khi va chạm:</strong> {opt.deformDesc}
        {shared > 1 ? ` · Dùng chung cho ${shared} Layer` : ''}
      </p>
      {/* Dải phải phủ trọn giá trị preset (Đá 2.1, Kim loại 2.2 độ cứng; Thạch 1.55 độ nảy) */}
      <ParamSlider label="Độ cứng" min={0.1} max={2.5} step={0.05} value={p.materialStiffness ?? opt.defaultStiffness} onChange={(v) => onUpdate({ materialStiffness: v })} />
      <ParamSlider label="Độ nảy" min={0} max={2} step={0.05} value={p.materialBounciness ?? opt.defaultBounciness} onChange={(v) => onUpdate({ materialBounciness: v })} />
    </>
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
      {/* Khớp đúng dải kẹp của engine va chạm (0.2 – 2.5) để kéo slider không làm sai giá trị preset */}
      <ParamSlider label="Lực va đập" min={0.2} max={2.5} step={0.05} value={p.collisionForce ?? opt.defaultForce} onChange={(v) => onUpdate({ collisionForce: v })} />
      <ParamSlider label="Biến dạng" min={0.2} max={2.5} step={0.05} value={p.deformIntensity ?? opt.defaultDeform} onChange={(v) => onUpdate({ deformIntensity: v })} />
      <button type="button" className="wf-v2-ghost-btn" onClick={() => onScrubTime(tHit)}>
        Tua tới khoảnh khắc va chạm ({tHit.toFixed(2)}s)
      </button>
    </>
  )
}

function ActionParams({ node, onUpdate }: WorkflowV2NodeParamsProps): React.ReactElement {
  const p = node.params ?? {}
  return (
    <>
      <OptionPills
        cols={4}
        options={WORKFLOW_V2_ACTION_OPTIONS.map((o) => ({ id: o.id, label: shortLabel(o.label) }))}
        value={p.actionPreset ?? 'float'}
        onPick={(id) => onUpdate({ actionPreset: id }, `Hành động: ${WORKFLOW_V2_ACTION_OPTIONS.find((o) => o.id === id)!.label}`)}
      />
      <ParamSlider label="Biên độ" min={0.1} max={1.8} step={0.05} value={p.intensity ?? 0.65} onChange={(v) => onUpdate({ intensity: v })} />
    </>
  )
}

function CaveParams({ node, onUpdate }: WorkflowV2NodeParamsProps): React.ReactElement {
  const p = node.params ?? {}
  return (
    <>
      <OptionPills
        options={WORKFLOW_V2_CAVE_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
        value={p.caveArchShape ?? 'arch'}
        onPick={(id) => onUpdate({ caveArchShape: id }, `Hang động: ${WORKFLOW_V2_CAVE_OPTIONS.find((o) => o.id === id)!.label}`)}
      />
      <ParamSlider label="Độ tối" min={0.2} max={1} step={0.05} value={p.caveDarkness ?? p.intensity ?? 0.82} onChange={(v) => onUpdate({ caveDarkness: v, intensity: v })} />
    </>
  )
}

function LightParams({ node, onUpdate }: WorkflowV2NodeParamsProps): React.ReactElement {
  const p = node.params ?? {}
  const color = p.lightColor ?? '#38bdf8'
  return (
    <>
      <OptionPills
        options={WORKFLOW_V2_LIGHT_OPTIONS.map((o) => ({ id: o.id, label: shortLabel(o.label) }))}
        value={p.lightMode ?? 'rim'}
        onPick={(id) => onUpdate({ lightMode: id }, `Ánh sáng: ${WORKFLOW_V2_LIGHT_OPTIONS.find((o) => o.id === id)!.label}`)}
      />
      <div className="wf-v2-swatch-row" role="group" aria-label="Màu ánh sáng">
        {LIGHT_SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            className={`wf-v2-swatch${color.toLowerCase() === hex ? ' active' : ''}`}
            style={{ background: hex }}
            title={hex}
            onClick={() => onUpdate({ lightColor: hex })}
          />
        ))}
      </div>
      <ParamSlider label="Cường độ" min={0.2} max={2.5} step={0.1} value={p.intensity ?? 1.3} onChange={(v) => onUpdate({ intensity: v })} />
    </>
  )
}

function FxParams({ node, onUpdate }: WorkflowV2NodeParamsProps): React.ReactElement {
  const p = node.params ?? {}
  return (
    <>
      <OptionPills
        options={WORKFLOW_V2_FX_OPTIONS.map((o) => ({ id: o.id, label: shortLabel(o.label) }))}
        value={p.fxKind ?? 'wind_physics'}
        onPick={(id) => onUpdate({ fxKind: id }, `Hiệu ứng: ${WORKFLOW_V2_FX_OPTIONS.find((o) => o.id === id)!.label}`)}
      />
      <ParamSlider label="Cường độ" min={0.1} max={2} step={0.1} value={p.intensity ?? 1} onChange={(v) => onUpdate({ intensity: v })} />
    </>
  )
}

function AudioParams({ node, onUpdate }: WorkflowV2NodeParamsProps): React.ReactElement {
  const p = node.params ?? {}
  return (
    <>
      <ParamSlider label="Âm lượng" min={0} max={1.5} step={0.05} value={p.intensity ?? 1} onChange={(v) => onUpdate({ intensity: v })} />
      <OptionPills
        cols={2}
        options={[
          { id: 'off', label: 'Không nhép môi' },
          { id: 'on', label: 'Nhép môi tự động' }
        ]}
        value={p.autoLipSync ? 'on' : 'off'}
        onPick={(id) => onUpdate({ autoLipSync: id === 'on' })}
      />
    </>
  )
}

const CAM_WAYPOINT_MODES = [
  { id: 'establishing', label: '🏛 Chuẩn 100%' },
  { id: 'push-in', label: '🔍+ Đẩy cận' },
  { id: 'pull-out', label: '🔍- Kéo rộng' },
  { id: 'pan', label: '↔ Lia ngang' },
  { id: 'hold', label: '⏸ Dừng ngắm' },
  { id: 'orbit-right', label: '↻ Quỹ đạo 3D' }
] as const

const CAM_SPAWN_BUTTONS: { mode: 'zoom-in' | 'zoom-out' | 'pan' | 'hold'; label: string }[] = [
  { mode: 'zoom-in', label: '+ Đẩy cận' },
  { mode: 'zoom-out', label: '+ Kéo rộng' },
  { mode: 'pan', label: '+ Lia ngang' },
  { mode: 'hold', label: '+ Dừng ngắm' }
]

function CameraWaypointParams({ node, onUpdate, onScrubTime, onSpawnCameraWaypoint }: WorkflowV2NodeParamsProps): React.ReactElement {
  const p = node.params ?? {}
  const tStart = p.timeStart ?? 0
  const stepDur = p.camStepDuration ?? Math.max(0.4, Number(((p.timeEnd ?? tStart + 2) - tStart).toFixed(2)))
  return (
    <>
      <OptionPills
        cols={2}
        options={[...CAM_WAYPOINT_MODES]}
        value={(p.camActionMode as (typeof CAM_WAYPOINT_MODES)[number]['id']) ?? 'pan'}
        onPick={(id) => onUpdate({ camActionMode: id })}
      />
      <ParamSlider
        label="Zoom khung"
        min={40}
        max={240}
        step={5}
        value={p.camZoomPct ?? 100}
        format={(v) => `${Math.round(v)}%`}
        onChange={(v) => onUpdate({ camZoomPct: v })}
      />
      <ParamSlider
        label="Thời lượng"
        min={0.4}
        max={8}
        step={0.2}
        value={stepDur}
        format={(v) => `${v.toFixed(1)}s`}
        onChange={(v) => onUpdate({ camStepDuration: v })}
      />
      <ParamSlider
        label="Góc ngang"
        min={-60}
        max={60}
        step={2}
        value={p.camYaw ?? 0}
        format={(v) => `${v > 0 ? `+${Math.round(v)}` : Math.round(v)}°`}
        onChange={(v) => onUpdate({ camYaw: v })}
      />
      <ParamSlider
        label="Góc ngẩng"
        min={-45}
        max={45}
        step={2}
        value={p.camPitch ?? 0}
        format={(v) => `${v > 0 ? `+${Math.round(v)}` : Math.round(v)}°`}
        onChange={(v) => onUpdate({ camPitch: v })}
      />
      <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <button type="button" className="wf-v2-ghost-btn" onClick={() => onScrubTime(tStart)}>
          ▶ Xem tại {tStart.toFixed(1)}s
        </button>
        {p.shotId && onSpawnCameraWaypoint && (
          <button
            type="button"
            className="wf-v2-ghost-btn"
            title="Chèn thêm một cảnh phụ ngay sau mốc này trong cùng cảnh"
            onClick={() => onSpawnCameraWaypoint(p.shotId!, 'zoom-in', tStart)}
          >
            + Chèn cảnh phụ
          </button>
        )}
      </div>
    </>
  )
}

function CameraParams(props: WorkflowV2NodeParamsProps): React.ReactElement {
  const { node, onUpdate, onSpawnCameraWaypoint } = props
  const p = node.params ?? {}
  if (p.isCameraWaypoint) return <CameraWaypointParams {...props} />
  return (
    <>
      <OptionPills
        cols={2}
        options={WORKFLOW_V2_CAMERA_OPTIONS.map((o) => ({ id: o.id, label: shortLabel(o.label) }))}
        value={p.camPreset ?? 'dollyIn'}
        onPick={(id) => onUpdate({ camPreset: id }, `Camera: ${WORKFLOW_V2_CAMERA_OPTIONS.find((o) => o.id === id)!.label}`)}
      />
      <OptionPills
        cols={2}
        options={[
          { id: 'off', label: 'Tắt DOF' },
          { id: 'on', label: 'Bật DOF' }
        ]}
        value={p.enableDof ? 'on' : 'off'}
        onPick={(id) => onUpdate({ enableDof: id === 'on' })}
      />
      {p.shotId && onSpawnCameraWaypoint && (
        <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {CAM_SPAWN_BUTTONS.map((btn) => (
            <button
              key={btn.mode}
              type="button"
              className="wf-v2-opt-pill"
              title={`Thêm cảnh con (${btn.label}) vào lộ trình quay của cảnh này`}
              onClick={() => onSpawnCameraWaypoint(p.shotId!, btn.mode)}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

function LayerParams({ node, onUpdate }: WorkflowV2NodeParamsProps): React.ReactElement {
  const z = Math.round(node.params?.transformZ ?? 0)
  return (
    <ParamSlider
      label="Độ sâu Z"
      min={-600}
      max={3600}
      step={10}
      value={z}
      format={(v) => (v >= 0 ? `+${Math.round(v)}` : `${Math.round(v)}`)}
      onChange={(v) => onUpdate({ transformZ: v })}
    />
  )
}

const LOGIC_EDITORS: Record<string, React.FC<WorkflowV2NodeParamsProps>> = {
  material: MaterialParams,
  collision: CollisionParams,
  action: ActionParams,
  cave: CaveParams,
  light: LightParams,
  fx: FxParams,
  audio: AudioParams,
  camera: CameraParams
}

/** Bộ chỉnh tham số theo đúng loại Node (dùng trong Bảng thuộc tính Workflow V2) */
export const WorkflowV2NodeParams: React.FC<WorkflowV2NodeParamsProps> = (props) => {
  const { node } = props
  if (node.type === 'scene_shot' || node.params?.groupKind) return null
  if (node.type === 'layer_assembly') return <LayerParams {...props} />
  const Editor = LOGIC_EDITORS[resolveV2LogicCategory(node)]
  return Editor ? <Editor {...props} /> : null
}
