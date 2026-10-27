import React, { useMemo, useRef, useState } from 'react'
import type { ImageProps, Vec3 } from '@shared/types'
import { assetStore } from '../../project/assets'
import {
  extractCompositeDynamicParts,
  getClusterMemberLayers,
  getClusterRootLayer
} from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import { LayerAssemblyDialog } from '../layerAssembly/LayerAssemblyDialog'
import { findCompositeTemplate } from '../layerAssembly/scenePartSwap'
import type { LayerComposite } from '../layerAssembly/types'
import { getCachedAlphaTrim, type AlphaTrimmedInfo } from './alphaTrimmedPreview'
import { OptionPills, ParamSlider, type WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'

interface JointDef {
  id: string
  label: string
  x: number
  y: number
  parent?: string
  color: string
}

const HUMANOID_JOINTS: JointDef[] = [
  { id: 'hips', label: 'Hông (Root)', x: 0.5, y: 0.56, color: '#f59e0b' },
  { id: 'spine', label: 'Bụng / Lưng', x: 0.5, y: 0.42, parent: 'hips', color: '#38bdf8' },
  { id: 'chest', label: 'Ngực', x: 0.5, y: 0.3, parent: 'spine', color: '#38bdf8' },
  { id: 'neck', label: 'Cổ', x: 0.5, y: 0.21, parent: 'chest', color: '#a855f7' },
  { id: 'head', label: 'Đầu', x: 0.5, y: 0.12, parent: 'neck', color: '#ec4899' },
  { id: 'l_shoulder', label: 'Vai T', x: 0.36, y: 0.29, parent: 'chest', color: '#10b981' },
  { id: 'l_elbow', label: 'Khuỷu T', x: 0.26, y: 0.41, parent: 'l_shoulder', color: '#10b981' },
  { id: 'l_hand', label: 'Bàn tay T', x: 0.2, y: 0.53, parent: 'l_elbow', color: '#10b981' },
  { id: 'r_shoulder', label: 'Vai P', x: 0.64, y: 0.29, parent: 'chest', color: '#06b6d4' },
  { id: 'r_elbow', label: 'Khuỷu P', x: 0.74, y: 0.41, parent: 'r_shoulder', color: '#06b6d4' },
  { id: 'r_hand', label: 'Bàn tay P', x: 0.8, y: 0.53, parent: 'r_elbow', color: '#06b6d4' },
  { id: 'l_thigh', label: 'Đùi T', x: 0.43, y: 0.68, parent: 'hips', color: '#f97316' },
  { id: 'l_foot', label: 'Bàn chân T', x: 0.41, y: 0.88, parent: 'l_thigh', color: '#f97316' },
  { id: 'r_thigh', label: 'Đùi P', x: 0.57, y: 0.68, parent: 'hips', color: '#fb7185' },
  { id: 'r_foot', label: 'Bàn chân P', x: 0.59, y: 0.88, parent: 'r_thigh', color: '#fb7185' }
]

const MIXAMO_JOINTS: JointDef[] = [
  { id: 'groin', label: 'Háng (Groin)', x: 0.5, y: 0.56, color: '#f59e0b' },
  { id: 'chin', label: 'Cằm (Chin)', x: 0.5, y: 0.22, parent: 'groin', color: '#ec4899' },
  { id: 'l_shoulder', label: 'Vai T', x: 0.35, y: 0.3, parent: 'chin', color: '#10b981' },
  { id: 'l_elbow', label: 'Khuỷu T', x: 0.25, y: 0.42, parent: 'l_shoulder', color: '#10b981' },
  { id: 'l_wrist', label: 'Cổ tay T', x: 0.18, y: 0.54, parent: 'l_elbow', color: '#10b981' },
  { id: 'r_shoulder', label: 'Vai P', x: 0.65, y: 0.3, parent: 'chin', color: '#06b6d4' },
  { id: 'r_elbow', label: 'Khuỷu P', x: 0.75, y: 0.42, parent: 'r_shoulder', color: '#06b6d4' },
  { id: 'r_wrist', label: 'Cổ tay P', x: 0.82, y: 0.54, parent: 'r_elbow', color: '#06b6d4' },
  { id: 'l_knee', label: 'Gối T', x: 0.42, y: 0.73, parent: 'groin', color: '#f97316' },
  { id: 'l_ankle', label: 'Cổ chân T', x: 0.41, y: 0.89, parent: 'l_knee', color: '#f97316' },
  { id: 'r_knee', label: 'Gối P', x: 0.58, y: 0.73, parent: 'groin', color: '#fb7185' },
  { id: 'r_ankle', label: 'Cổ chân P', x: 0.59, y: 0.89, parent: 'r_knee', color: '#fb7185' }
]

const CHAIN_JOINTS: JointDef[] = [
  { id: 'base', label: 'Gốc neo (Base)', x: 0.5, y: 0.84, color: '#f59e0b' },
  { id: 'mid', label: 'Đốt giữa (Mid)', x: 0.5, y: 0.52, parent: 'base', color: '#10b981' },
  { id: 'tip', label: 'Ngọn uốn (Tip)', x: 0.5, y: 0.18, parent: 'mid', color: '#38bdf8' }
]

interface SpriteBox {
  id: string
  url: string
  x: number
  y: number
  w: number
  h: number
}

function collectTargetLayerImageUrls(props: WorkflowV2NodeParamsProps): string[] {
  const { node, project } = props
  const ids = node.params?.targetLayerIds ?? []
  const first = project.layers.find((l) => ids.includes(l.id))
  const members = getClusterMemberLayers(project, node.params?.instanceId, first)
  const list = (members.length > 0 ? members : first ? [first] : []).filter((m) => m.visible !== false)
  const urls: string[] = []
  for (const m of list) {
    if (m.type !== 'image') continue
    const assetId = (m.props as ImageProps).assetId
    const rt = assetStore.get(assetId)
    const pa = project.assets.find((a) => a.id === assetId)
    const url = rt?.url || rt?.thumbUrl || pa?.dataUrl || pa?.path
    if (url) urls.push(url)
  }
  return urls
}

function resolveSpriteBoxes(
  props: WorkflowV2NodeParamsProps,
  frameX: number,
  frameY: number,
  frameW: number,
  frameH: number,
  trimmedMap?: Record<string, AlphaTrimmedInfo>
): SpriteBox[] {
  const { node, project } = props
  const ids = node.params?.targetLayerIds ?? []
  const first = project.layers.find((l) => ids.includes(l.id))
  const members = getClusterMemberLayers(project, node.params?.instanceId, first)
  const list = (members.length > 0 ? members : first ? [first] : []).filter((m) => m.visible !== false)
  const raw: { id: string; url: string; cx: number; cy: number; w: number; h: number; z: number }[] = []

  for (const m of list) {
    if (m.type !== 'image') continue
    const assetId = (m.props as ImageProps).assetId
    const rt = assetStore.get(assetId)
    const pa = project.assets.find((a) => a.id === assetId)
    const url = rt?.url || rt?.thumbUrl || pa?.dataUrl || pa?.path
    if (!url) continue
    const pos = m.transform?.position?.value ?? [0, 0, 0]
    const scl = m.transform?.scale?.value ?? [1, 1, 1]
    const sx = Math.abs(scl[0] ?? 1) >= 0.08 ? Math.abs(scl[0] ?? 1) : 1
    const sy = Math.abs(scl[1] ?? 1) >= 0.08 ? Math.abs(scl[1] ?? 1) : 1
    const rawW = rt?.meta.width || pa?.width || 300
    const rawH = rt?.meta.height || pa?.height || 300
    const trim = trimmedMap?.[url] ?? getCachedAlphaTrim(url)
    const displayUrl = trim ? trim.croppedUrl : url
    const effW = Math.max(8, (trim ? trim.trimW : rawW) * sx)
    const effH = Math.max(8, (trim ? trim.trimH : rawH) * sy)
    const cx =
      list.length === 1
        ? 0
        : (pos[0] ?? 0) + (trim ? trim.offsetRx * rawW * sx : 0)
    const cy =
      list.length === 1
        ? 0
        : -(pos[1] ?? 0) + (trim ? trim.offsetRy * rawH * sy : 0)
    raw.push({ id: m.id, url: displayUrl, cx, cy, w: effW, h: effH, z: pos[2] ?? 0 })
  }
  if (raw.length === 0) return []
  raw.sort((a, b) => a.z - b.z)

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const r of raw) {
    minX = Math.min(minX, r.cx - r.w / 2)
    maxX = Math.max(maxX, r.cx + r.w / 2)
    minY = Math.min(minY, r.cy - r.h / 2)
    maxY = Math.max(maxY, r.cy + r.h / 2)
  }
  const uW = Math.max(12, maxX - minX)
  const uH = Math.max(12, maxY - minY)
  const fit = Math.min(frameW / uW, frameH / uH)
  const ox = frameX + (frameW - uW * fit) / 2
  const oy = frameY + (frameH - uH * fit) / 2

  return raw.map((r) => ({
    id: r.id,
    url: r.url,
    x: ox + (r.cx - r.w / 2 - minX) * fit,
    y: oy + (r.cy - r.h / 2 - minY) * fit,
    w: r.w * fit,
    h: r.h * fit
  }))
}

/**
 * Node Gắn Xương (`rig_bone`) — Chuyên trách cấu trúc bộ xương 2.5D, vị trí khớp và liên kết bộ phận.
 */
export function WorkflowV2RigBoneParams(props: WorkflowV2NodeParamsProps): React.ReactElement {
  const { node, project, onUpdate } = props
  const editorUpdate = useEditor((s) => s.update)
  const p = node.params ?? {}
  const firstLayer = project.layers.find((l) => (p.targetLayerIds ?? []).includes(l.id))
  const members = useMemo(
    () => getClusterMemberLayers(project, p.instanceId, firstLayer),
    [project, p.instanceId, firstLayer]
  )
  const rootLayer = getClusterRootLayer(members) ?? firstLayer
  const dynamicParts = useMemo(
    () => extractCompositeDynamicParts(project, p.instanceId, firstLayer),
    [project, p.instanceId, firstLayer]
  )
  const spriteBoxes = useMemo(() => resolveSpriteBoxes(props, 36, 6, 168, 156), [props])

  const preset = p.rigBonePreset ?? 'humanoid_15'
  const softBinding = p.rigSoftBinding !== false
  const baseJoints =
    preset === 'mixamo_12' ? MIXAMO_JOINTS : preset === 'chain_3' ? CHAIN_JOINTS : HUMANOID_JOINTS

  const [jointOffsets, setJointOffsets] = useState<Record<string, { dx: number; dy: number }>>({})
  const [activeJointId, setActiveJointId] = useState<string>(baseJoints[0].id)
  const [editingComposite, setEditingComposite] = useState<LayerComposite | null>(null)
  const [showCompositeModal, setShowCompositeModal] = useState(false)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const joints = useMemo(
    () =>
      baseJoints.map((j) => ({
        ...j,
        x: Math.max(0.06, Math.min(0.94, j.x + (jointOffsets[j.id]?.dx ?? 0))),
        y: Math.max(0.06, Math.min(0.94, j.y + (jointOffsets[j.id]?.dy ?? 0)))
      })),
    [baseJoints, jointOffsets]
  )
  const byId = useMemo(() => new Map(joints.map((j) => [j.id, j])), [joints])
  const selectedJoint = byId.get(activeJointId) ?? joints[0]

  const startDragJoint = (e: React.PointerEvent, jointId: string): void => {
    e.stopPropagation()
    setActiveJointId(jointId)
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const base = baseJoints.find((j) => j.id === jointId)
    if (!base) return

    const onMove = (ev: PointerEvent): void => {
      const nx = (ev.clientX - rect.left) / Math.max(1, rect.width)
      const ny = (ev.clientY - rect.top) / Math.max(1, rect.height)
      const dx = Math.max(-0.4, Math.min(0.4, nx - base.x))
      const dy = Math.max(-0.4, Math.min(0.4, ny - base.y))
      setJointOffsets((prev) => ({ ...prev, [jointId]: { dx, dy } }))
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const cur = jointOffsets[jointId]
      if (cur && members.length > 0) {
        editorUpdate((d) => {
          for (const m of members) {
            const target = d.layers.find((x) => x.id === m.id)
            if (!target) continue
            const curRot = [...(target.transform.rotation.value ?? [0, 0, 0])] as Vec3
            curRot[2] = Number((cur.dx * 35).toFixed(1))
            target.transform.rotation.value = curRot
          }
        }, 'wf-rig-joint-pose')
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const openWorkshopRig = (): void => {
    const compId = rootLayer?.composite?.compositeId
    const found = findCompositeTemplate(compId)
    setEditingComposite(found ?? null)
    setShowCompositeModal(true)
  }

  return (
    <div className="vl-section-card" style={{ marginTop: 2 }}>
      <div className="vl-row-header">
        <span className="vl-title">🦴 Cấu Trúc Bộ Xương 2.5D</span>
        <span className="vl-value-badge">{joints.length} khớp</span>
      </div>

      <OptionPills
        cols={3}
        options={[
          { id: 'humanoid_15', label: '🧍 15 khớp' },
          { id: 'mixamo_12', label: '🎯 12 mốc' },
          { id: 'chain_3', label: '🌿 3 khớp' }
        ]}
        value={preset}
        onPick={(nextPreset) => {
          setJointOffsets({})
          onUpdate(
            { rigBonePreset: nextPreset },
            nextPreset === 'mixamo_12'
              ? 'Khung xương: Mixamo 12 mốc'
              : nextPreset === 'chain_3'
                ? 'Khung xương: Chuỗi 3 khớp'
                : 'Khung xương: Nhân vật 15 khớp'
          )
        }}
      />

      <div className="wf-v2-inline-editor-frame">
        <div className="wf-v2-inline-editor-head">
          <span>🎯 Khung đặt khớp 2.5D (Kéo điểm khớp)</span>
          <button
            type="button"
            className="wf-v2-mini-btn"
            onClick={() => setJointOffsets({})}
            title="Đặt lại vị trí các khớp xương về mặc định"
          >
            ↺ Đặt lại
          </button>
        </div>
        <svg
          ref={svgRef}
          className="wf-v2-inline-rig-svg"
          viewBox="0 0 240 168"
          aria-label="Khung gắn xương 2.5D"
        >
          <defs>
            <pattern id="wf-rig-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(148, 163, 184, 0.12)" strokeWidth="0.7" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="240" height="168" fill="url(#wf-rig-grid)" rx="6" />
          {spriteBoxes.map((sp) => (
            <image
              key={sp.id}
              href={sp.url}
              x={sp.x}
              y={sp.y}
              width={sp.w}
              height={sp.h}
              preserveAspectRatio="xMidYMid meet"
              opacity="0.45"
            />
          ))}
          <line x1="120" y1="8" x2="120" y2="160" stroke="rgba(56, 189, 248, 0.2)" strokeDasharray="3 3" />
          {joints.map((j) => {
            if (!j.parent) return null
            const parent = byId.get(j.parent)
            if (!parent) return null
            return (
              <line
                key={`bone-${parent.id}-${j.id}`}
                x1={parent.x * 240}
                y1={parent.y * 168}
                x2={j.x * 240}
                y2={j.y * 168}
                stroke={j.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.9"
              />
            )
          })}
          {joints.map((j) => {
            const isSel = j.id === selectedJoint?.id
            return (
              <g
                key={j.id}
                transform={`translate(${j.x * 240} ${j.y * 168})`}
                className="wf-v2-rig-joint-handle"
                onPointerDown={(e) => startDragJoint(e, j.id)}
              >
                <title>{`${j.label} — kéo để tinh chỉnh vị trí khớp`}</title>
                <circle r={isSel ? 7 : 5} fill={j.color} stroke="#0f172a" strokeWidth="1.6" />
                {isSel && <circle r={10} fill="none" stroke={j.color} strokeWidth="1.2" strokeDasharray="2 2" />}
              </g>
            )
          })}
        </svg>
        {selectedJoint && (
          <div className="wf-v2-inline-editor-foot">
            <span>
              Khớp: <strong>{selectedJoint.label}</strong>
            </span>
            <span className="mono">
              ({Math.round(selectedJoint.x * 100)}%, {Math.round(selectedJoint.y * 100)}%)
            </span>
          </div>
        )}
      </div>

      <div className="vl-subcard">
        <OptionPills
          cols={2}
          options={[
            { id: 'soft', label: '🌊 Uốn dẻo (Soft)' },
            { id: 'rigid', label: '🔩 Khớp cứng (Rigid)' }
          ]}
          value={softBinding ? 'soft' : 'rigid'}
          onPick={(mode) => onUpdate({ rigSoftBinding: mode === 'soft' })}
        />
        <ParamSlider
          label="Độ nhạy khớp"
          min={0.2}
          max={2.0}
          step={0.05}
          value={p.intensity ?? 1.0}
          onChange={(v) => onUpdate({ intensity: v })}
        />
      </div>

      {dynamicParts.length > 0 && (
        <div className="vl-subcard">
          <div className="wf-v2-insp-subhead" style={{ marginTop: 0 }}>
            🧩 Liên kết Bộ phận vào Khung Xương ({dynamicParts.length})
          </div>
          <div className="wf-v2-part-bone-grid">
            {dynamicParts.map((part) => (
              <span
                key={part.id}
                className="wf-v2-part-bone-tag"
                title={`Bộ phận "${part.title}" (${part.layerIds.length} mảnh)`}
              >
                <span>
                  {part.icon} {part.title}
                </span>
                <small>{part.layerIds.length} mảnh</small>
              </span>
            ))}
          </div>
        </div>
      )}

      <button type="button" className="wf-v2-ghost-btn" onClick={openWorkshopRig}>
        🦴 Mở Xưởng 2.5D &amp; Mixamo để gắn xương chi tiết…
      </button>

      {showCompositeModal && (
        <LayerAssemblyDialog
          initialComposite={editingComposite}
          onClose={() => setShowCompositeModal(false)}
        />
      )}
    </div>
  )
}

export {
  InlineMotionDesignerPad,
  resolveActionTargetLayerIds,
  PRESET_PATHS
} from './WorkflowV2MotionDesignerPad'
