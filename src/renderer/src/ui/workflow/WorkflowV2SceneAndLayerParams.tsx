import React from 'react'
import type { AutoOrientMode, BlendMode, LayerPhysicsColliderZone, LayerPhysicsConfig, Vec3 } from '@shared/types'
import { flyToShot, updateAudioTrack } from '../../actions'
import { evaluate, setValueAt } from '../../animation/keyframes'
import { evaluateScene } from '../../engine/evaluateScene'
import { getProjectAudioTracks } from '../../project/audioTracks'
import {
  WORKFLOW_V2_MATERIAL_OPTIONS,
  getClusterMemberLayers,
  getClusterPartShortName,
  getClusterRootLayer,
  setClusterRootLayer
} from '../../project/workflowV2Engine'
import { findLayer, findShot, frameTolerance, useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import { AssetReplaceModal } from '../inspector/AssetReplaceModal'
import { OptionPills, ParamSlider, type WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'

const SHOT_COLOR_SWATCHES = [
  '#38bdf8',
  '#4ade80',
  '#f59e0b',
  '#a855f7',
  '#ec4899',
  '#2dd4bf',
  '#f87171',
  '#60a5fa'
]

const POSE_3D_PRESETS: { id: string; label: string; rot: Vec3 }[] = [
  { id: 'stand', label: '🧍 Đứng (0°)', rot: [0, 0, 0] },
  { id: 'ground', label: '🛣 Mặt đất (-90°)', rot: [-90, 0, 0] },
  { id: 'slope', label: '📐 Nghiêng (-45°)', rot: [-45, 0, 0] },
  { id: 'ceiling', label: '☁️ Trần (90°)', rot: [90, 0, 0] }
]

const ANCHOR_PRESETS: { id: string; label: string; anchor: Vec3 }[] = [
  { id: 'center', label: '✦ Tâm', anchor: [0, 0, 0] },
  { id: 'bottom', label: '⬇ Chân', anchor: [0, -0.5, 0] },
  { id: 'top', label: '⬆ Đỉnh', anchor: [0, 0.5, 0] },
  { id: 'left', label: '⬅ Trái', anchor: [-0.5, 0, 0] },
  { id: 'right', label: '➡ Phải', anchor: [0.5, 0, 0] }
]

const BLEND_OPTIONS: { id: BlendMode; label: string }[] = [
  { id: 'normal', label: 'Thường' },
  { id: 'add', label: 'Cộng sáng' },
  { id: 'screen', label: 'Màn sáng' },
  { id: 'multiply', label: 'Nhân tối' }
]

const AUTO_ORIENT_OPTIONS: { id: AutoOrientMode; label: string }[] = [
  { id: 'none', label: 'Mặt phẳng cố định' },
  { id: 'camera-y', label: 'Hướng Cam (Trục Y)' },
  { id: 'camera', label: 'Hướng Cam 3D' }
]

const COLLIDER_ZONE_OPTIONS: { id: LayerPhysicsColliderZone; label: string }[] = [
  { id: 'full', label: '✦ Toàn bộ' },
  { id: 'top_surface', label: '⬆ Mặt trên' },
  { id: 'foot_bottom', label: '⬇ Đáy chân' },
  { id: 'trunk_center', label: '🌲 Thân giữa' },
  { id: 'fist_hand', label: '✊ Điểm đấm' },
  { id: 'custom_uv', label: '📐 Vùng UV' }
]

export function WorkflowV2ShotParams({ node, project }: WorkflowV2NodeParamsProps): React.ReactElement {
  const editorUpdate = useEditor((s) => s.update)
  const time = useEditor((s) => s.time)
  const shot = findShot(project, node.params?.shotId ?? null)
  const tol = frameTolerance(project)

  if (!shot) {
    return (
      <p className="wf-v2-hint">
        Đây là cụm Layer dùng chung xuyên suốt toàn dự án (không khóa riêng vào một Cảnh cố định).
      </p>
    )
  }

  const pos = evaluate(shot.position, time)
  const rot = evaluate(shot.rotation, time)

  const setShotPosAxis = (axis: 0 | 1 | 2, val: number): void => {
    editorUpdate((d) => {
      const s = findShot(d, shot.id)
      if (!s) return
      const next: Vec3 = [...pos] as Vec3
      next[axis] = val
      setValueAt(s.position, time, next, tol)
    }, `shot-pos-${axis}`)
  }

  const setShotRotAxis = (axis: 0 | 1 | 2, val: number): void => {
    editorUpdate((d) => {
      const s = findShot(d, shot.id)
      if (!s) return
      const next: Vec3 = [...rot] as Vec3
      next[axis] = val
      setValueAt(s.rotation, time, next, tol)
    }, `shot-rot-${axis}`)
  }

  return (
    <>
      <div className="wf-v2-insp-subhead">Màu nhận diện Cảnh</div>
      <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }}>
        {SHOT_COLOR_SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            className={`wf-v2-opt-pill${shot.color === hex ? ' active' : ''}`}
            style={{ background: hex, minHeight: 22, borderColor: shot.color === hex ? '#ffffff' : 'transparent' }}
            title={`Đặt màu cảnh ${hex}`}
            onClick={() =>
              editorUpdate((d) => {
                const s = findShot(d, shot.id)
                if (s) s.color = hex
              })
            }
          />
        ))}
      </div>

      <div className="wf-v2-insp-subhead">Vị trí 3D của Cảnh trong không gian</div>
      <ParamSlider
        label="Vị trí X"
        min={-4000}
        max={4000}
        step={20}
        value={Math.round(pos[0])}
        format={(v) => `${Math.round(v)}px`}
        onChange={(v) => setShotPosAxis(0, v)}
      />
      <ParamSlider
        label="Vị trí Y"
        min={-2400}
        max={2400}
        step={20}
        value={Math.round(pos[1])}
        format={(v) => `${Math.round(v)}px`}
        onChange={(v) => setShotPosAxis(1, v)}
      />
      <ParamSlider
        label="Độ sâu Z"
        min={-3000}
        max={3000}
        step={20}
        value={Math.round(pos[2])}
        format={(v) => `${Math.round(v)}px`}
        onChange={(v) => setShotPosAxis(2, v)}
      />

      <div className="wf-v2-insp-subhead">Góc xoay 3D của Cảnh</div>
      <ParamSlider
        label="Xoay Y (Yaw)"
        min={-180}
        max={180}
        step={2}
        value={Math.round(rot[1])}
        format={(v) => `${Math.round(v)}°`}
        onChange={(v) => setShotRotAxis(1, v)}
      />
      <ParamSlider
        label="Xoay X (Pitch)"
        min={-90}
        max={90}
        step={2}
        value={Math.round(rot[0])}
        format={(v) => `${Math.round(v)}°`}
        onChange={(v) => setShotRotAxis(0, v)}
      />

      <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <button
          type="button"
          className="wf-v2-ghost-btn"
          onClick={() => flyToShot(shot.id)}
        >
          🎥 Camera bay tới cảnh
        </button>
        <button
          type="button"
          className="wf-v2-ghost-btn"
          onClick={() => useView.getState().requestFocus('shot', shot.id)}
        >
          🧭 Xem trong 3D
        </button>
      </div>
    </>
  )
}

export function WorkflowV2LayerParams({ node, project, onUpdate }: WorkflowV2NodeParamsProps): React.ReactElement {
  const editorUpdate = useEditor((s) => s.update)
  const time = useEditor((s) => s.time)
  const [showReplaceAsset, setShowReplaceAsset] = React.useState(false)
  const tol = frameTolerance(project)
  const targetId = node.params?.targetLayerIds?.[0] ?? null
  const layer = findLayer(project, targetId)
  const clusterInstId = layer?.composite?.instanceId ?? layer?.model3d?.instanceId
  const clusterMembers = clusterInstId ? getClusterMemberLayers(project, clusterInstId, layer) : []
  const clusterRoot = getClusterRootLayer(clusterMembers)
  const isClusterRoot = Boolean(layer && clusterRoot?.id === layer.id)
  const isClusterLocked = Boolean(layer?.composite?.lockedGroup ?? layer?.model3d?.lockedGroup)
  const ev = evaluateScene(project, time)
  const evLayer = layer ? ev.layers.find((l) => l.layer.id === layer.id) : undefined

  const x = Math.round(evLayer ? evLayer.position[0] : (node.params?.transformX ?? 0))
  const y = Math.round(evLayer ? evLayer.position[1] : (node.params?.transformY ?? 0))
  const z = Math.round(evLayer ? evLayer.position[2] : (node.params?.transformZ ?? 0))
  const scalePct = Math.round((evLayer ? evLayer.scale[0] : 1) * 100)
  const opacityPct = Math.round((evLayer ? evLayer.opacity : 1) * 100)
  const rotZ = Math.round(evLayer ? evLayer.rotation[2] : 0)
  const rotX = Math.round(evLayer ? evLayer.rotation[0] : 0)

  const setLayerScale = (pctVal: number): void => {
    if (!layer) return
    const s = Math.max(0.05, pctVal / 100)
    editorUpdate((d) => {
      const l = findLayer(d, layer.id)
      if (l) setValueAt(l.transform.scale, time, [s, s, 1], tol)
    }, 'layer-scale')
  }

  const setLayerOpacity = (pctVal: number): void => {
    if (!layer) return
    const op = Math.max(0, Math.min(1, pctVal / 100))
    editorUpdate((d) => {
      const l = findLayer(d, layer.id)
      if (l) setValueAt(l.transform.opacity, time, op, tol)
    }, 'layer-opacity')
  }

  const setLayerRotZ = (deg: number): void => {
    if (!layer) return
    editorUpdate((d) => {
      const l = findLayer(d, layer.id)
      if (!l) return
      const cur = evLayer?.rotation ?? ([0, 0, 0] as Vec3)
      setValueAt(l.transform.rotation, time, [cur[0], cur[1], deg], tol)
    }, 'layer-rot-z')
  }

  const setLayerPose3D = (rot: Vec3): void => {
    if (!layer) return
    editorUpdate((d) => {
      const l = findLayer(d, layer.id)
      if (l) setValueAt(l.transform.rotation, time, rot, tol)
    })
  }

  const curAnchor: Vec3 = layer?.transform.anchor ? evaluate(layer.transform.anchor, time) : [0, 0, 0]
  const activeAnchorId =
    ANCHOR_PRESETS.find(
      (a) =>
        Math.abs(curAnchor[0] - a.anchor[0]) < 0.08 &&
        Math.abs(curAnchor[1] - a.anchor[1]) < 0.08
    )?.id ?? 'center'

  return (
    <>
      {layer && clusterMembers.length > 1 && (
        <>
          <div className="wf-v2-pair">
            <span className="wf-v2-pair-tag" title="Mảnh con thuộc Cụm 2.5D / Khối 3D — chỉnh riêng mảnh này không làm hỏng các mảnh khác">
              {isClusterLocked ? '🔒' : '🔓'} Cụm: {layer.composite?.compositeName || layer.model3d?.modelName || '2.5D'} ·{' '}
              {isClusterRoot ? '⚓ Gốc neo' : `Mảnh: ${getClusterPartShortName(layer)}`}
            </span>
          </div>
          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {layer.composite && !isClusterRoot && (
              <button
                type="button"
                className="wf-v2-opt-pill"
                onClick={() =>
                  editorUpdate((d) => {
                    const members = getClusterMemberLayers(d, clusterInstId, layer)
                    setClusterRootLayer(members, layer.id)
                  })
                }
              >
                ⚓ Đặt mảnh này làm Gốc neo
              </button>
            )}
            {layer.type === 'image' && (
              <button
                type="button"
                className="wf-v2-opt-pill"
                onClick={() => setShowReplaceAsset(true)}
              >
                🖼 Đổi ảnh mảnh này…
              </button>
            )}
          </div>
        </>
      )}

      <div className="wf-v2-insp-subhead">Tọa độ &amp; Chiều sâu 2.5D (Riêng mảnh này)</div>
      <ParamSlider
        label="Tọa độ X"
        min={-1600}
        max={1600}
        step={10}
        value={x}
        format={(v) => `${Math.round(v)}px`}
        onChange={(v) => onUpdate({ transformX: v })}
      />
      <ParamSlider
        label="Tọa độ Y"
        min={-1200}
        max={1200}
        step={10}
        value={y}
        format={(v) => `${Math.round(v)}px`}
        onChange={(v) => onUpdate({ transformY: v })}
      />
      <ParamSlider
        label="Độ sâu Z"
        min={-600}
        max={3600}
        step={10}
        value={z}
        format={(v) => (v >= 0 ? `+${Math.round(v)}` : `${Math.round(v)}`)}
        onChange={(v) => onUpdate({ transformZ: v })}
      />

      {layer && (
        <>
          <div className="wf-v2-insp-subhead">Kích thước · Xoay · Độ rõ</div>
          <ParamSlider
            label="Tỉ lệ (Scale)"
            min={10}
            max={300}
            step={2}
            value={scalePct}
            format={(v) => `${Math.round(v)}%`}
            onChange={setLayerScale}
          />
          <ParamSlider
            label="Xoay Z"
            min={-180}
            max={180}
            step={2}
            value={rotZ}
            format={(v) => `${Math.round(v)}°`}
            onChange={setLayerRotZ}
          />
          <ParamSlider
            label="Độ rõ (Opacity)"
            min={0}
            max={100}
            step={2}
            value={opacityPct}
            format={(v) => `${Math.round(v)}%`}
            onChange={setLayerOpacity}
          />

          <div className="wf-v2-insp-subhead">Dáng mặt phẳng 3D nhanh</div>
          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {POSE_3D_PRESETS.map((p3) => (
              <button
                key={p3.id}
                type="button"
                className={`wf-v2-opt-pill${Math.abs(rotX - p3.rot[0]) <= 2 ? ' active' : ''}`}
                onClick={() => setLayerPose3D(p3.rot)}
              >
                {p3.label}
              </button>
            ))}
          </div>

          <div className="wf-v2-insp-subhead">Điểm tâm xoay (Anchor Point)</div>
          <OptionPills
            cols={5}
            options={ANCHOR_PRESETS.map((a) => ({ id: a.id, label: a.label }))}
            value={activeAnchorId}
            onPick={(id) => {
              const found = ANCHOR_PRESETS.find((a) => a.id === id)
              if (!found) return
              editorUpdate((d) => {
                const l = findLayer(d, layer.id)
                if (!l) return
                if (!l.transform.anchor) l.transform.anchor = { value: [...found.anchor], keyframes: [] }
                else setValueAt(l.transform.anchor, time, [...found.anchor], tol)
              })
            }}
          />

          <div className="wf-v2-insp-subhead">Hoà trộn &amp; Hướng nhìn Camera</div>
          <OptionPills
            cols={4}
            options={BLEND_OPTIONS}
            value={layer.blendMode}
            onPick={(bm) =>
              editorUpdate((d) => {
                const l = findLayer(d, layer.id)
                if (l) l.blendMode = bm
              })
            }
          />
          <OptionPills
            cols={3}
            options={AUTO_ORIENT_OPTIONS}
            value={layer.autoOrient ?? 'none'}
            onPick={(mode) =>
              editorUpdate((d) => {
                const l = findLayer(d, layer.id)
                if (l) l.autoOrient = mode
              })
            }
          />
          <ParamSlider
            label="Mờ vào (Fade In)"
            min={0}
            max={3}
            step={0.1}
            value={layer.fadeIn ?? 0}
            format={(v) => `${v.toFixed(1)}s`}
            onChange={(v) =>
              editorUpdate((d) => {
                const l = findLayer(d, layer.id)
                if (l) l.fadeIn = v
              })
            }
          />
          <ParamSlider
            label="Mờ ra (Fade Out)"
            min={0}
            max={3}
            step={0.1}
            value={layer.fadeOut ?? 0}
            format={(v) => `${v.toFixed(1)}s`}
            onChange={(v) =>
              editorUpdate((d) => {
                const l = findLayer(d, layer.id)
                if (l) l.fadeOut = v
              })
            }
          />
          {showReplaceAsset && layer.type === 'image' && (
            <AssetReplaceModal
              layerId={layer.id}
              currentAssetId={layer.props.assetId}
              layerName={layer.name}
              onClose={() => setShowReplaceAsset(false)}
            />
          )}
        </>
      )}
    </>
  )
}

export function WorkflowV2MaterialParams({ node, project, onUpdate }: WorkflowV2NodeParamsProps): React.ReactElement {
  const editorUpdate = useEditor((s) => s.update)
  const p = node.params ?? {}
  const opt =
    WORKFLOW_V2_MATERIAL_OPTIONS.find((m) => m.id === (p.materialTag ?? 'jelly_slime')) ??
    WORKFLOW_V2_MATERIAL_OPTIONS[0]
  const shared = p.sharedLayerNodeIds?.length ?? 1
  const targetLayer = findLayer(project, p.targetLayerIds?.[0] ?? null)
  const phy = targetLayer?.physics
  const damping = phy?.damping ?? 0.35
  const hitSensitivity = phy?.hitSensitivity ?? 1.0
  const colliderZone = phy?.colliderZone ?? 'full'

  const patchTargetPhysics = (patch: Partial<LayerPhysicsConfig>): void => {
    const ids = new Set(p.targetLayerIds ?? [])
    editorUpdate((d) => {
      for (const l of d.layers) {
        if (!ids.has(l.id)) continue
        l.physics = {
          ...(l.physics ?? { enabled: true, material: opt.id }),
          ...patch
        }
      }
    })
  }

  return (
    <>
      <div className="wf-v2-insp-subhead">Nhãn chất liệu đàn hồi</div>
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

      <div className="wf-v2-insp-subhead">Độ đàn hồi &amp; Trọng lực</div>
      <ParamSlider
        label="Độ cứng"
        min={0.1}
        max={2.5}
        step={0.05}
        value={p.materialStiffness ?? opt.defaultStiffness}
        onChange={(v) => onUpdate({ materialStiffness: v })}
      />
      <ParamSlider
        label="Độ nảy"
        min={0}
        max={2}
        step={0.05}
        value={p.materialBounciness ?? opt.defaultBounciness}
        onChange={(v) => onUpdate({ materialBounciness: v })}
      />
      <ParamSlider
        label="Trọng lực"
        min={0}
        max={1.5}
        step={0.05}
        value={p.materialGravity ?? opt.defaultGravity}
        onChange={(v) => onUpdate({ materialGravity: v })}
      />
      <ParamSlider
        label="Hệ số cản"
        min={0.05}
        max={0.95}
        step={0.05}
        value={damping}
        onChange={(v) => patchTargetPhysics({ damping: v })}
      />
      <ParamSlider
        label="Độ nhạy lực"
        min={0.2}
        max={2.5}
        step={0.05}
        value={hitSensitivity}
        onChange={(v) => patchTargetPhysics({ hitSensitivity: v })}
      />

      <div className="wf-v2-insp-subhead">Vùng nhận va chạm trên Mesh (Collider Zone)</div>
      <OptionPills
        cols={3}
        options={COLLIDER_ZONE_OPTIONS}
        value={colliderZone}
        onPick={(zone) => patchTargetPhysics({ colliderZone: zone })}
      />
    </>
  )
}

export function WorkflowV2AudioParams({ node, project, onUpdate }: WorkflowV2NodeParamsProps): React.ReactElement {
  const p = node.params ?? {}
  const targetIds = new Set(p.targetLayerIds ?? [])
  const instanceIds = new Set(
    project.layers
      .filter((l) => targetIds.has(l.id))
      .flatMap((l) => [l.composite?.instanceId, l.model3d?.instanceId])
      .filter((v): v is string => Boolean(v))
  )
  const tracks = getProjectAudioTracks(project)
  const linkedTrack = tracks.find(
    (tr) => tr.targetId && (targetIds.has(tr.targetId) || instanceIds.has(tr.targetId))
  )
  const asset = linkedTrack ? project.assets.find((a) => a.id === linkedTrack.assetId) : undefined

  const updateLinkedTrack = (patch: Parameters<typeof updateAudioTrack>[1]): void => {
    if (!linkedTrack) return
    updateAudioTrack(linkedTrack.id, patch)
  }

  return (
    <>
      {linkedTrack && (
        <div className="wf-v2-pair">
          <span className="wf-v2-pair-tag" title="Tệp âm thanh đang gắn với Layer">
            🔊 {linkedTrack.name || asset?.name || 'Track âm thanh'}
          </span>
        </div>
      )}

      <div className="wf-v2-insp-subhead">Âm lượng &amp; Nhép môi tự động</div>
      <ParamSlider
        label="Âm lượng"
        min={0}
        max={1.5}
        step={0.05}
        value={linkedTrack?.volume ?? p.intensity ?? 1}
        onChange={(v) => onUpdate({ intensity: v })}
      />
      <OptionPills
        cols={2}
        options={[
          { id: 'off', label: 'Không nhép môi' },
          { id: 'on', label: '👄 Nhép môi tự động' }
        ]}
        value={(linkedTrack?.lipSyncEnabled ?? p.autoLipSync) ? 'on' : 'off'}
        onPick={(id) => onUpdate({ autoLipSync: id === 'on' })}
      />

      {linkedTrack && (
        <>
          <div className="wf-v2-insp-subhead">Tốc độ phát · Lặp lại · Phai âm</div>
          <ParamSlider
            label="Tốc độ phát"
            min={0.5}
            max={2.0}
            step={0.05}
            value={linkedTrack.playbackRate ?? 1}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={(v) => updateLinkedTrack({ playbackRate: v })}
          />
          <ParamSlider
            label="Fade In"
            min={0}
            max={3}
            step={0.1}
            value={linkedTrack.fadeIn ?? 0}
            format={(v) => `${v.toFixed(1)}s`}
            onChange={(v) => updateLinkedTrack({ fadeIn: v })}
          />
          <ParamSlider
            label="Fade Out"
            min={0}
            max={3}
            step={0.1}
            value={linkedTrack.fadeOut ?? 0}
            format={(v) => `${v.toFixed(1)}s`}
            onChange={(v) => updateLinkedTrack({ fadeOut: v })}
          />
          <OptionPills
            cols={2}
            options={[
              { id: 'once', label: 'Phát 1 lần' },
              { id: 'loop', label: '🔁 Lặp lại liên tục' }
            ]}
            value={linkedTrack.loop ? 'loop' : 'once'}
            onPick={(id) => updateLinkedTrack({ loop: id === 'loop' })}
          />
          <button
            type="button"
            className="wf-v2-ghost-btn"
            onClick={() => useView.getState().openAudioDialog('waveform')}
          >
            🎚 Mở Xưởng Âm Thanh (Sóng âm &amp; Mixer)
          </button>
        </>
      )}
    </>
  )
}
