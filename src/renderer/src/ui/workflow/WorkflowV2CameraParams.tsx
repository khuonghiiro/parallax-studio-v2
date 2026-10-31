import React, { useMemo, useState } from 'react'
import type { EaseName, Vec3 } from '@shared/types'
import { toast } from '../../actions'
import { setValueAt } from '../../animation/keyframes'
import { referenceDistance } from '../../animation/math'
import { CAMERA_PRESETS, applyCameraPreset, type CameraPreset } from '../../animation/presets'
import { evaluateScene, shotFramingPose, shotLocalToWorld } from '../../engine/evaluateScene'
import {
  analyzeWaypointBBoxTransition,
  getShotWorldCenter3D,
  transitionCameraWaypointToTargetBBox
} from '../../project/shotSpatial3D'
import { getLayerDisplayName } from '../../project/workflowV2Engine'
import { findLayer, findShot, frameTolerance, useEditor } from '../../store/editor'
import { CameraControls } from '../CameraControls'
import {
  computeShotStageLayout,
  extractCameraFrames2D,
  projectShotLayers2D
} from '../viewer/animateCamera/animateCameraMath'
import {
  alignWaypointInShot,
  updateCameraWaypoint,
  updateWaypointStepDuration
} from '../viewer/animateCamera/animateCameraRouteLogic'
import { ShotSpatial3DPad } from './ShotSpatial3DPad'
import { OptionPills, ParamSlider, type WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'

const CAM_WAYPOINT_MODES = [
  { id: 'establishing', label: '🏛 Khung chuẩn 100%' },
  { id: 'push-in', label: '🔍+ Đẩy cận' },
  { id: 'pull-out', label: '🔍- Kéo rộng' },
  { id: 'pan', label: '↔ Lia BBox 1→2' },
  { id: 'hold', label: '⏸ Dừng ngắm' },
  { id: 'orbit-right', label: '↻ Quỹ đạo 3D' }
] as const

const CAM_SPAWN_BUTTONS: { mode: 'zoom-in' | 'zoom-out' | 'pan' | 'hold'; label: string }[] = [
  { mode: 'zoom-in', label: '+ 🔍 Đẩy cận' },
  { mode: 'zoom-out', label: '+ 🔭 Kéo rộng' },
  { mode: 'pan', label: '+ ↔ Lia khung' },
  { mode: 'hold', label: '+ ⏸ Dừng ngắm' }
]

const EASE_OPTIONS: { id: EaseName; label: string }[] = [
  { id: 'easeInOut', label: '🌊 Lia mượt' },
  { id: 'linear', label: '📏 Đều tốc' },
  { id: 'hold', label: '⚡ Cắt tức thì' }
]

const ALIGN_BUTTONS: { id: 'left' | 'center' | 'right' | 'top' | 'bottom' | 'reset-angles'; label: string }[] = [
  { id: 'left', label: '⬅ Trái' },
  { id: 'center', label: '🎯 Giữa' },
  { id: 'right', label: 'Phải ➡' },
  { id: 'top', label: '⬆ Trên' },
  { id: 'bottom', label: '⬇ Dưới' },
  { id: 'reset-angles', label: '↺ Reset góc' }
]

export function WorkflowV2CameraWaypointParams({
  node,
  project,
  onUpdate,
  onScrubTime,
  onSpawnCameraWaypoint
}: WorkflowV2NodeParamsProps): React.ReactElement {
  const editorUpdate = useEditor((s) => s.update)
  const [wpTab, setWpTab] = useState<'action' | 'angle'>('action')
  const [transitionStyle, setTransitionStyle] = useState<'fly' | 'cut'>(
    node.params?.camEase === 'hold' ? 'cut' : 'fly'
  )

  const p = node.params ?? {}
  const tStart = p.timeStart ?? 0
  const wpIdx = p.waypointIndex ?? 0
  const stepDur = p.camStepDuration ?? Math.max(0.4, Number(((p.timeEnd ?? tStart + 2) - tStart).toFixed(2)))
  const curEase = (p.camEase ?? 'easeInOut') as EaseName

  const stageLayout = useMemo(() => computeShotStageLayout(project, 0), [project])
  const frames2D = useMemo(() => extractCameraFrames2D(project, stageLayout), [project, stageLayout])
  const curFrameIdx = useMemo(() => {
    const byTime = frames2D.findIndex((f) => Math.abs(f.time - tStart) <= 0.05)
    return byTime >= 0 ? byTime : Math.min(frames2D.length - 1, Math.max(0, wpIdx))
  }, [frames2D, tStart, wpIdx])

  const prevFrame = curFrameIdx > 0 ? frames2D[curFrameIdx - 1] : null
  const curFrame = frames2D[curFrameIdx] ?? null
  const bboxAnalysis = useMemo(
    () => analyzeWaypointBBoxTransition(prevFrame, curFrame),
    [prevFrame, curFrame]
  )

  const ev = useMemo(() => evaluateScene(project, tStart), [project, tStart])
  const shotLayers = useMemo(() => {
    if (!p.shotId) return []
    const idx = stageLayout.findIndex((b) => b.shotId === p.shotId)
    return projectShotLayers2D(project, ev, p.shotId, idx === 0)
  }, [project, ev, p.shotId, stageLayout])

  const handleAlign = (align: 'left' | 'center' | 'right' | 'top' | 'bottom' | 'reset-angles'): void => {
    editorUpdate((draft) => {
      const layout = computeShotStageLayout(draft, 0)
      alignWaypointInShot(draft, layout, tStart, align)
    })
    onScrubTime(tStart)
  }

  const handleEaseChange = (ease: EaseName): void => {
    setTransitionStyle(ease === 'hold' ? 'cut' : 'fly')
    editorUpdate((draft) => {
      const layout = computeShotStageLayout(draft, 0)
      updateCameraWaypoint(draft, layout, tStart, { ease })
    })
    onUpdate({ camEase: ease })
  }

  const handleDelayChange = (delaySec: number): void => {
    editorUpdate((draft) => {
      const layout = computeShotStageLayout(draft, 0)
      updateWaypointStepDuration(draft, layout, wpIdx, { delaySec })
    })
  }

  const handleTransitionToShotBBox = (targetShotId: string, shotName: string): void => {
    editorUpdate((draft) => {
      transitionCameraWaypointToTargetBBox(draft, tStart, {
        shotId: targetShotId,
        style: transitionStyle
      })
    }, 'cam-wp-transition-shot')
    onUpdate({
      camEase: transitionStyle === 'cut' ? 'hold' : 'easeInOut',
      camTransitionTargetShotId: targetShotId
    })
    onScrubTime(tStart)
    toast(
      transitionStyle === 'cut'
        ? `⚡ Đã cắt chuyển cảnh tức thì sang BBox "${shotName}"`
        : `🚀 Đã lia Camera chuyển cảnh mượt sang BBox "${shotName}"`
    )
  }

  const handleSnapToLayerBBox = (layerId: string, layerName: string): void => {
    editorUpdate((draft) => {
      transitionCameraWaypointToTargetBBox(draft, tStart, {
        shotId: p.shotId,
        layerIds: [layerId],
        style: transitionStyle
      })
    }, 'cam-wp-snap-layer-bbox')
    onUpdate({ camTransitionTargetLayerId: layerId })
    onScrubTime(tStart)
    toast(`🎯 Đã bắt khung BBox "${layerName}" tại mốc #${p.waypointLabel ?? wpIdx + 1}`)
  }

  const activeModeId =
    bboxAnalysis.relation === 'smaller' && p.camActionMode === 'pull-out'
      ? 'push-in'
      : bboxAnalysis.relation === 'larger' && p.camActionMode === 'push-in'
        ? 'pull-out'
        : (p.camActionMode ?? 'pan')

  return (
    <div className="wf-cam-wp-panel">
      {/* Banner kiểm tra quan hệ hình học BBox 1 -> BBox 2 */}
      <div className="wf-cam-bbox-guard" data-mcp-region="workflow_cam_bbox_guard">
        <div className="wf-cam-bbox-guard-row">
          <span className="wf-cam-bbox-tag">
            {prevFrame ? `BBox #${curFrameIdx}: ${bboxAnalysis.prevWidthPx}px (${bboxAnalysis.prevZoomPct}%)` : 'Mốc đầu lộ trình'}
          </span>
          {prevFrame && <span className="wf-cam-bbox-arrow">➔</span>}
          {curFrame && (
            <span className="wf-cam-bbox-tag is-cur">
              {`BBox #${curFrameIdx + 1}: ${bboxAnalysis.curWidthPx}px (${bboxAnalysis.curZoomPct}%)`}
            </span>
          )}
        </div>
        <div className="wf-cam-bbox-verdict">{bboxAnalysis.summaryBadge}</div>
      </div>

      <div className="wf-v2-seg-tabs" role="tablist" aria-label="Cấu hình mốc Camera">
        <button
          type="button"
          role="tab"
          aria-selected={wpTab === 'action'}
          className={`wf-v2-seg-tab${wpTab === 'action' ? ' active' : ''}`}
          onClick={() => setWpTab('action')}
        >
          🎬 Động tác &amp; Chuyển cảnh
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={wpTab === 'angle'}
          className={`wf-v2-seg-tab${wpTab === 'angle' ? ' active' : ''}`}
          onClick={() => setWpTab('angle')}
        >
          🧭 Góc 3D &amp; Căn khung
        </button>
      </div>

      {wpTab === 'action' && (
        <>
          <div className="wf-v2-insp-subhead">Động tác hợp lệ theo cỡ BBox 1 → BBox 2</div>
          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {CAM_WAYPOINT_MODES.map((m) => {
              const blocked = bboxAnalysis.isContradictoryWithCurrentBBox(m.id)
              const reason = bboxAnalysis.contradictionReason(m.id)
              const isSelected = !blocked && activeModeId === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={blocked}
                  className={`wf-v2-opt-pill${isSelected ? ' active' : ''}${blocked ? ' is-blocked' : ''}`}
                  title={
                    blocked
                      ? `🔒 Không hợp lệ với cỡ BBox hiện tại: ${reason}`
                      : `Áp dụng động tác "${m.label}" cho mốc #${p.waypointLabel ?? wpIdx + 1}`
                  }
                  onClick={() => onUpdate({ camActionMode: m.id })}
                >
                  <span className="wf-v2-opt-pill-txt">{blocked ? `🔒 ${m.label.replace(/^[^\s]+\s/, '')}` : m.label}</span>
                </button>
              )
            })}
          </div>

          {/* Khu vực Chuyển cảnh sang BBox Cảnh đích hoặc BBox Chủ thể */}
          <div className="wf-cam-transition-box">
            <div className="wf-v2-subsec-head">
              <span>🎬 Chuyển cảnh tới BBox Cảnh / Chủ thể</span>
              <div className="wf-cam-style-mini">
                <button
                  type="button"
                  className={`wf-v2-mini-btn${transitionStyle === 'fly' ? ' active' : ''}`}
                  onClick={() => handleEaseChange('easeInOut')}
                >
                  🚀 Lia mượt
                </button>
                <button
                  type="button"
                  className={`wf-v2-mini-btn${transitionStyle === 'cut' ? ' active' : ''}`}
                  onClick={() => handleEaseChange('hold')}
                >
                  ⚡ Cắt cảnh
                </button>
              </div>
            </div>

            {project.shots.length > 0 && (
              <div className="wf-v2-chip-grid">
                {project.shots.map((s, idx) => {
                  const isTarget = (curFrame?.shotId ?? p.shotId) === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`wf-v2-spawn-chip${isTarget ? ' is-selected' : ''}`}
                      title={`Đưa mốc Camera này chuyển thẳng tới BBox của "${s.name}"`}
                      onClick={() => handleTransitionToShotBBox(s.id, s.name)}
                    >
                      {transitionStyle === 'cut' ? '⚡' : '🎬'} BBox #{idx + 1} {s.name.replace(/^#\d+\s*/, '')}
                    </button>
                  )
                })}
              </div>
            )}

            {shotLayers.length > 0 && (
              <>
                <div className="wf-v2-subsec-head" style={{ marginTop: 4 }}>
                  <span>🎯 Bắt gọn BBox Chủ thể trong cảnh</span>
                </div>
                <div className="wf-v2-chip-grid">
                  {shotLayers.slice(0, 8).map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className="wf-v2-spawn-chip"
                      title={`Đưa Camera bắt khớp khung BBox của "${l.name}"`}
                      onClick={() => handleSnapToLayerBBox(l.id, l.name)}
                    >
                      🎯 {l.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <ParamSlider
            label="Cỡ Zoom BBox"
            min={40}
            max={240}
            step={5}
            value={p.camZoomPct ?? bboxAnalysis.curZoomPct}
            format={(v) => `${Math.round(v)}%`}
            onChange={(v) => onUpdate({ camZoomPct: v })}
          />
          <ParamSlider
            label="Thời lượng bước"
            min={0.4}
            max={8}
            step={0.2}
            value={stepDur}
            format={(v) => `${v.toFixed(1)}s`}
            onChange={(v) => onUpdate({ camStepDuration: v })}
          />
          <ParamSlider
            label="Đệm dừng"
            min={0}
            max={4}
            step={0.2}
            value={0}
            format={(v) => (v > 0 ? `+${v.toFixed(1)}s` : '0s')}
            onChange={handleDelayChange}
          />

          <div className="wf-v2-insp-subhead">Nhịp chuyển động (Easing)</div>
          <OptionPills cols={3} options={EASE_OPTIONS} value={curEase} onPick={handleEaseChange} />
        </>
      )}

      {wpTab === 'angle' && (
        <>
          <div className="wf-v2-insp-subhead">Góc xoay 3D (Yaw · Pitch · Roll)</div>
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
          <ParamSlider
            label="Nghiêng máy"
            min={-35}
            max={35}
            step={1}
            value={p.camRoll ?? 0}
            format={(v) => `${v > 0 ? `+${Math.round(v)}` : Math.round(v)}°`}
            onChange={(v) => onUpdate({ camRoll: v })}
          />

          <div className="wf-v2-insp-subhead">Căn khung nhanh trong cảnh</div>
          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {ALIGN_BUTTONS.map((btn) => (
              <button key={btn.id} type="button" className="wf-v2-opt-pill" onClick={() => handleAlign(btn.id)}>
                {btn.label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginTop: 4 }}>
        <button type="button" className="wf-v2-ghost-btn" onClick={() => onScrubTime(tStart)}>
          ▶ Xem tại {tStart.toFixed(1)}s
        </button>
        {p.shotId && onSpawnCameraWaypoint && (
          <button
            type="button"
            className="wf-v2-ghost-btn"
            title="Chèn thêm một mốc quay nối tiếp ngay sau mốc này"
            onClick={() => onSpawnCameraWaypoint(p.shotId!, 'zoom-in', tStart)}
          >
            + Chèn mốc tiếp
          </button>
        )}
      </div>
    </div>
  )
}

export function WorkflowV2CameraParams(props: WorkflowV2NodeParamsProps): React.ReactElement {
  return props.node.params?.isCameraWaypoint ? (
    <WorkflowV2CameraWaypointParams key={props.node.id} {...props} />
  ) : (
    <WorkflowV2CameraShotParams key={props.node.id} {...props} />
  )
}

function WorkflowV2CameraShotParams(props: WorkflowV2NodeParamsProps): React.ReactElement {
  const { node, project, workflow, onUpdate, onScrubTime, onSelectNode, onSpawnCameraWaypoint } = props
  const editorUpdate = useEditor((s) => s.update)
  const time = useEditor((s) => s.time)
  const selectedLayer = useEditor((s) => findLayer(s.project, s.selectedLayerId))
  const [camTab, setCamTab] = useState<'route' | 'space3d' | 'lens'>('route')
  const [presetIntensity, setPresetIntensity] = useState<number>(node.params?.intensity ?? 1)
  const [show3DControls, setShow3DControls] = useState(false)

  const p = node.params ?? {}
  const cam = project.camera
  const tol = frameTolerance(project)
  const activeShotId = p.shotId ?? project.shots[0]?.id ?? null
  const targetShot = findShot(project, activeShotId)
  const shotCenter3D: Vec3 = useMemo(
    () => (activeShotId ? getShotWorldCenter3D(project, activeShotId) : [0, 0, 0]),
    [project, activeShotId]
  )
  const refZ = Math.round(referenceDistance(project.comp))

  const shotWaypoints = useMemo(
    () =>
      (workflow?.nodes ?? [])
        .filter(
          (n) =>
            n.type === 'camera_director' &&
            Boolean(n.params?.isCameraWaypoint) &&
            (p.shotId ? n.params?.shotId === p.shotId : n.params?.hierarchyParentNodeId === node.id)
        )
        .sort((a, b) => (a.params?.timeStart ?? 0) - (b.params?.timeStart ?? 0)),
    [workflow?.nodes, p.shotId, node.id]
  )

  const ev = evaluateScene(project, time)
  const camEv = ev.camera
  const dofEnabled = Boolean(cam?.dofEnabled ?? p.enableDof)
  const shakeAmt = cam?.shakeAmount ?? p.camShakeAmount ?? 0
  const shakeSpd = cam?.shakeSpeed ?? p.camShakeSpeed ?? 2.2

  // Offset tương đối của Camera so với tâm không gian Cảnh hiện tại (không bao giờ bị kẹp cứng ở Cảnh 2/3!)
  const relCamX = Math.round(camEv.position[0] - shotCenter3D[0])
  const relCamY = Math.round(camEv.position[1] - shotCenter3D[1])
  const relCamZ = Math.round(camEv.position[2] - (shotCenter3D[2] + refZ))

  const updateCameraRelativeAxis = (axis: 0 | 1 | 2, relVal: number): void => {
    editorUpdate((d) => {
      const nextPos: Vec3 = [...camEv.position] as Vec3
      const nextTarget: Vec3 = [...camEv.target] as Vec3
      if (axis === 0) {
        const worldX = shotCenter3D[0] + relVal
        const dx = worldX - nextPos[0]
        nextPos[0] = worldX
        nextTarget[0] += dx
      } else if (axis === 1) {
        const worldY = shotCenter3D[1] + relVal
        const dy = worldY - nextPos[1]
        nextPos[1] = worldY
        nextTarget[1] += dy
      } else {
        nextPos[2] = shotCenter3D[2] + refZ + relVal
      }
      setValueAt(d.camera.position, time, nextPos, tol)
      setValueAt(d.camera.target, time, nextTarget, tol)
    }, `cam-rel-pos-${axis}`)
  }

  const addMilestoneAtPlayhead = (): void => {
    const shotStart = p.timeStart ?? 0
    const shotEnd = p.timeEnd ?? project.comp.duration ?? 5
    const tClamped = Number(
      Math.max(
        shotStart + 0.2,
        Math.min(shotEnd - 0.2, time >= shotStart && time <= shotEnd ? time : (shotStart + shotEnd) / 2)
      ).toFixed(2)
    )
    editorUpdate((d) => {
      const evAtT = evaluateScene(d as typeof project, tClamped)
      setValueAt(d.camera.position, tClamped, evAtT.camera.position, tol)
      setValueAt(d.camera.target, tClamped, evAtT.camera.target, tol)
      setValueAt(d.camera.fov, tClamped, evAtT.camera.fov, tol)
    }, 'cam-add-milestone-playhead')
    onScrubTime(tClamped)
    toast(`⏱️ Đã thêm mốc lộ trình Camera tại ${tClamped.toFixed(2)}s`)
  }

  const spawnTransitionToOtherShot = (destShotId: string, destName: string, style: 'fly' | 'cut'): void => {
    const shotEnd = p.timeEnd ?? project.comp.duration ?? 5
    const atT = Number(Math.max(0.2, shotEnd - 0.2).toFixed(2))
    editorUpdate((d) => {
      transitionCameraWaypointToTargetBBox(d, atT, { shotId: destShotId, style })
    }, 'cam-spawn-shot-transition')
    onScrubTime(atT)
    toast(
      style === 'cut'
        ? `⚡ Đã tạo mốc cắt chuyển cảnh sang "${destName}" tại ${atT}s`
        : `🚀 Đã tạo lộ trình lia chuyển cảnh sang "${destName}" tại ${atT}s`
    )
  }

  const resetCameraToShot = (): void => {
    editorUpdate((d) => {
      const shot = activeShotId ? findShot(d, activeShotId) : undefined
      if (shot) {
        const pose = shotFramingPose(d as typeof project, shot, time)
        setValueAt(d.camera.position, time, pose.position, tol)
        setValueAt(d.camera.target, time, pose.target, tol)
      } else {
        const z = referenceDistance(d.comp)
        setValueAt(d.camera.position, time, [0, 0, z], tol)
        setValueAt(d.camera.target, time, [0, 0, 0], tol)
      }
      setValueAt(d.camera.fov, time, 45, tol)
    })
    toast(targetShot ? `🎥 Đã căn Camera về khung chuẩn của "${targetShot.name}"` : '🎥 Đã đưa Camera về khung chuẩn')
  }

  const applyPresetToShot = (presetId: CameraPreset): void => {
    const startSec = p.timeStart ?? time
    const durSec = Math.max(1.2, Math.min(4.0, (p.timeEnd ?? startSec + 2.5) - startSec))
    const foundPreset = CAMERA_PRESETS.find((x) => x.id === presetId)
    editorUpdate((d) => {
      const shot = activeShotId ? findShot(d, activeShotId) : undefined
      applyCameraPreset(
        d.camera,
        presetId,
        d.comp,
        startSec,
        durSec,
        presetIntensity,
        shotLocalToWorld(shot, startSec)
      )
    })
    onUpdate({ camPreset: presetId, intensity: presetIntensity }, `Camera: ${foundPreset?.label ?? presetId}`)
    onScrubTime(startSec)
    toast(`🎬 Đã áp dụng mẫu Camera "${foundPreset?.label ?? presetId}"`)
  }

  const focusOnSelectedLayer = (): void => {
    if (!selectedLayer) return
    const lp = ev.layers.find((l) => l.layer.id === selectedLayer.id)?.worldPosition
    if (!lp) return
    const dist = Math.round(
      Math.hypot(lp[0] - camEv.position[0], lp[1] - camEv.position[1], lp[2] - camEv.position[2])
    )
    editorUpdate((d) => {
      d.camera.dofEnabled = true
      setValueAt(d.camera.focusDistance, time, dist, tol)
    })
    onUpdate({ enableDof: true })
    toast(`🎯 Đã lấy nét DOF vào "${getLayerDisplayName(selectedLayer)}" (${dist}px)`)
  }

  const setShakeQuick = (amount: number, speed: number): void => {
    editorUpdate((d) => {
      d.camera.shakeAmount = amount
      d.camera.shakeSpeed = speed
    })
    onUpdate({ camShakeAmount: amount, camShakeSpeed: speed })
  }

  const otherShots = project.shots.filter((s) => s.id !== activeShotId)

  return (
    <div className="wf-cam-shot-panel">
      <div className="wf-v2-seg-tabs" role="tablist" aria-label="Cấu hình Camera 3D">
        <button
          type="button"
          role="tab"
          aria-selected={camTab === 'route'}
          className={`wf-v2-seg-tab${camTab === 'route' ? ' active' : ''}`}
          onClick={() => setCamTab('route')}
        >
          🎬 Lộ trình ({shotWaypoints.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={camTab === 'space3d'}
          className={`wf-v2-seg-tab${camTab === 'space3d' ? ' active' : ''}`}
          onClick={() => setCamTab('space3d')}
        >
          🌌 Không gian 3D
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={camTab === 'lens'}
          className={`wf-v2-seg-tab${camTab === 'lens' ? ' active' : ''}`}
          onClick={() => setCamTab('lens')}
        >
          📷 Ống kính &amp; Rung
        </button>
      </div>

      {camTab === 'route' && (
        <>
          <div className="wf-v2-subsec-head">
            <span>⏱️ Các mốc quay trong cảnh ({shotWaypoints.length})</span>
            <button
              type="button"
              className="wf-v2-mini-btn"
              onClick={() => onUpdate({ collapsedGroup: !p.collapsedGroup })}
            >
              {p.collapsedGroup ? 'Bung trên sơ đồ' : 'Thu gọn sơ đồ'}
            </button>
          </div>

          {shotWaypoints.length > 0 && (
            <div className="wf-v2-cam-wp-list">
              {shotWaypoints.map((wp, idx) => {
                const wpStart = wp.params?.timeStart ?? 0
                const wpEnd = wp.params?.timeEnd ?? wpStart + 1
                const isAtTime = time >= wpStart - 0.02 && time <= wpEnd + 0.02
                return (
                  <div key={wp.id} className={`wf-v2-cam-wp-row${isAtTime ? ' is-live' : ''}`}>
                    <button
                      type="button"
                      className="wf-v2-cam-wp-select"
                      onClick={() => {
                        onScrubTime(wpStart)
                        onSelectNode?.(wp.id)
                      }}
                    >
                      <span className="wp-badge">#{wp.params?.waypointLabel ?? idx + 1}</span>
                      <span className="wp-title">{wp.title.replace(/^#[\d.]+\s*·\s*/, '')}</span>
                      <span className="wp-time">{wpStart.toFixed(1)}s–{wpEnd.toFixed(1)}s</span>
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <button
              type="button"
              className="wf-v2-opt-pill active"
              style={{ gridColumn: '1 / -1' }}
              onClick={addMilestoneAtPlayhead}
            >
              <span className="wf-v2-opt-pill-txt">📍 + Ghi mốc Camera tại Playhead ({time.toFixed(1)}s)</span>
            </button>
            {p.shotId &&
              onSpawnCameraWaypoint &&
              CAM_SPAWN_BUTTONS.map((btn) => (
                <button
                  key={btn.mode}
                  type="button"
                  className="wf-v2-opt-pill"
                  onClick={() => onSpawnCameraWaypoint(p.shotId!, btn.mode)}
                >
                  <span className="wf-v2-opt-pill-txt">{btn.label}</span>
                </button>
              ))}
          </div>

          {otherShots.length > 0 && (
            <div className="wf-cam-transition-box">
              <div className="wf-v2-subsec-head">
                <span>🎬 Chuyển cảnh nhanh tới BBox Cảnh khác</span>
              </div>
              <div className="wf-v2-chip-grid">
                {otherShots.map((s) => (
                  <React.Fragment key={s.id}>
                    <button
                      type="button"
                      className="wf-v2-spawn-chip"
                      title={`Lia Camera 3D mượt từ cảnh này sang BBox của "${s.name}"`}
                      onClick={() => spawnTransitionToOtherShot(s.id, s.name, 'fly')}
                    >
                      🚀 Lia tới {s.name}
                    </button>
                    <button
                      type="button"
                      className="wf-v2-spawn-chip"
                      title={`Cắt chuyển cảnh tức thì sang BBox của "${s.name}"`}
                      onClick={() => spawnTransitionToOtherShot(s.id, s.name, 'cut')}
                    >
                      ⚡ Cắt tới {s.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          <div className="wf-v2-insp-subhead">Mẫu chuyển động Camera (Preset)</div>
          <ParamSlider
            label="Cường độ"
            min={0.2}
            max={2.5}
            step={0.05}
            value={presetIntensity}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={setPresetIntensity}
          />
          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {CAMERA_PRESETS.map((pr) => (
              <button
                key={pr.id}
                type="button"
                className={`wf-v2-opt-pill${p.camPreset === pr.id ? ' active' : ''}`}
                title={pr.hint}
                onClick={() => applyPresetToShot(pr.id)}
              >
                {pr.label}
              </button>
            ))}
          </div>
        </>
      )}

      {camTab === 'space3d' && (
        <>
          {activeShotId && <ShotSpatial3DPad project={project} shotId={activeShotId} />}

          <div className="wf-v2-insp-subhead">
            Độ lệch Camera so với tâm {targetShot ? `"${targetShot.name}"` : 'Cảnh'}
          </div>
          <ParamSlider
            label="Lệch ngang ΔX"
            min={-2400}
            max={2400}
            step={10}
            value={Math.max(-2400, Math.min(2400, relCamX))}
            format={(v) => `${v >= 0 ? '+' : ''}${Math.round(v)}px`}
            onChange={(v) => updateCameraRelativeAxis(0, v)}
          />
          <ParamSlider
            label="Lệch dọc ΔY"
            min={-1600}
            max={1600}
            step={10}
            value={Math.max(-1600, Math.min(1600, relCamY))}
            format={(v) => `${v >= 0 ? '+' : ''}${Math.round(v)}px`}
            onChange={(v) => updateCameraRelativeAxis(1, v)}
          />
          <ParamSlider
            label="Độ sâu ΔZ"
            min={-1400}
            max={2400}
            step={10}
            value={Math.max(-1400, Math.min(2400, relCamZ))}
            format={(v) => `${v >= 0 ? '+' : ''}${Math.round(v)}px`}
            onChange={(v) => updateCameraRelativeAxis(2, v)}
          />

          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <button type="button" className="wf-v2-ghost-btn" onClick={resetCameraToShot}>
              ↺ Về khung chuẩn cảnh
            </button>
            <button
              type="button"
              className={`wf-v2-ghost-btn${show3DControls ? ' active' : ''}`}
              onClick={() => setShow3DControls((v) => !v)}
            >
              {show3DControls ? 'Ẩn bàn xoay 3D' : '🧭 Mở bàn xoay 3D'}
            </button>
          </div>

          {show3DControls && (
            <div className="wf-v2-cam-rig-embed">
              <CameraControls />
            </div>
          )}
        </>
      )}

      {camTab === 'lens' && (
        <>
          <ParamSlider
            label="Ống kính (FOV)"
            min={15}
            max={100}
            step={1}
            value={Math.round(camEv.fov)}
            format={(v) => `${Math.round(v)}°`}
            onChange={(fov) => editorUpdate((d) => setValueAt(d.camera.fov, time, fov, tol), 'cam-fov')}
          />
          <ParamSlider
            label="Mờ đen (Fade)"
            min={0}
            max={1}
            step={0.02}
            value={camEv.fade}
            onChange={(fade) =>
              editorUpdate((d) => {
                if (!d.camera.fade) d.camera.fade = { value: 0, keyframes: [] }
                setValueAt(d.camera.fade, time, fade, tol)
              }, 'cam-fade')
            }
          />

          <div className="wf-v2-insp-subhead">Độ sâu trường ảnh (DOF Xoá phông)</div>
          <OptionPills
            cols={2}
            options={[
              { id: 'off', label: 'Tắt DOF' },
              { id: 'on', label: 'Bật DOF (Xoá phông)' }
            ]}
            value={dofEnabled ? 'on' : 'off'}
            onPick={(id) => {
              const next = id === 'on'
              editorUpdate((d) => {
                d.camera.dofEnabled = next
              })
              onUpdate({ enableDof: next })
            }}
          />
          {dofEnabled && (
            <>
              <ParamSlider
                label="Lấy nét"
                min={50}
                max={2500}
                step={10}
                value={Math.round(camEv.focusDistance)}
                format={(v) => `${Math.round(v)}px`}
                onChange={(v) => editorUpdate((d) => setValueAt(d.camera.focusDistance, time, v, tol), 'cam-focus')}
              />
              <ParamSlider
                label="Khẩu độ"
                min={0}
                max={2}
                step={0.02}
                value={camEv.aperture}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => editorUpdate((d) => setValueAt(d.camera.aperture, time, v, tol), 'cam-aperture')}
              />
              <button
                type="button"
                className="wf-v2-ghost-btn"
                disabled={!selectedLayer}
                onClick={focusOnSelectedLayer}
              >
                🎯 Lấy nét vào Layer đang chọn {selectedLayer ? `(${getLayerDisplayName(selectedLayer)})` : ''}
              </button>
            </>
          )}

          <div className="wf-v2-insp-subhead">Rung máy cầm tay (Handheld Shake)</div>
          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {[
              { amt: 0, spd: 1, label: 'Tắt' },
              { amt: 4, spd: 1.5, label: '✋ Nhẹ' },
              { amt: 12, spd: 2.5, label: '🚶 Bước' },
              { amt: 22, spd: 4.0, label: '💥 Mạnh' }
            ].map((sh) => (
              <button
                key={sh.label}
                type="button"
                className={`wf-v2-opt-pill${shakeAmt === sh.amt ? ' active' : ''}`}
                onClick={() => setShakeQuick(sh.amt, sh.spd)}
              >
                {sh.label}
              </button>
            ))}
          </div>
          <ParamSlider
            label="Biên độ rung"
            min={0}
            max={40}
            step={0.5}
            value={shakeAmt}
            format={(v) => `${v.toFixed(1)}px`}
            onChange={(v) => {
              editorUpdate((d) => {
                d.camera.shakeAmount = v
              }, 'cam-shake-amt')
              onUpdate({ camShakeAmount: v })
            }}
          />
          <ParamSlider
            label="Tốc độ rung"
            min={0.2}
            max={8}
            step={0.1}
            value={shakeSpd}
            format={(v) => `${v.toFixed(1)}Hz`}
            onChange={(v) => {
              editorUpdate((d) => {
                d.camera.shakeSpeed = v
              }, 'cam-shake-spd')
              onUpdate({ camShakeSpeed: v })
            }}
          />
        </>
      )}
    </div>
  )
}
