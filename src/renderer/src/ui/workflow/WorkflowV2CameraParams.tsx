import React, { useMemo, useState } from 'react'
import type { EaseName, Vec3 } from '@shared/types'
import { toast } from '../../actions'
import { setValueAt } from '../../animation/keyframes'
import { referenceDistance } from '../../animation/math'
import { CAMERA_PRESETS, applyCameraPreset, type CameraPreset } from '../../animation/presets'
import { evaluateScene, shotFramingPose, shotLocalToWorld } from '../../engine/evaluateScene'
import { getLayerDisplayName } from '../../project/workflowV2Engine'
import { findLayer, findShot, frameTolerance, useEditor } from '../../store/editor'
import { CameraControls } from '../CameraControls'
import { computeShotStageLayout, projectShotLayers2D } from '../viewer/animateCamera/animateCameraMath'
import {
  alignWaypointInShot,
  panCameraToLayer2D,
  updateCameraWaypoint,
  updateWaypointStepDuration
} from '../viewer/animateCamera/animateCameraRouteLogic'
import { OptionPills, ParamSlider, type WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'

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

const EASE_OPTIONS: { id: EaseName; label: string }[] = [
  { id: 'easeInOut', label: 'Mượt (Ease)' },
  { id: 'linear', label: 'Đều (Linear)' },
  { id: 'easeIn', label: 'Vào chậm' },
  { id: 'easeOut', label: 'Ra chậm' },
  { id: 'hold', label: '⚡ Cắt cảnh' }
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
  const p = node.params ?? {}
  const tStart = p.timeStart ?? 0
  const wpIdx = p.waypointIndex ?? 0
  const stepDur = p.camStepDuration ?? Math.max(0.4, Number(((p.timeEnd ?? tStart + 2) - tStart).toFixed(2)))
  const curEase = (p.camEase ?? 'easeInOut') as EaseName

  const stageLayout = useMemo(() => computeShotStageLayout(project, 0), [project])
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

  const handleAimLayer = (layerId: string): void => {
    const target = shotLayers.find((l) => l.id === layerId)
    if (!target) return
    editorUpdate((draft) => {
      const layout = computeShotStageLayout(draft, 0)
      panCameraToLayer2D(
        draft,
        layout,
        p.shotId ?? null,
        target.offsetX,
        target.offsetY,
        tStart,
        p.camScale ?? 1,
        curEase,
        target.zDepth
      )
    })
    onScrubTime(tStart)
    toast(`🎯 Đã hướng mốc #${p.waypointLabel ?? wpIdx + 1} vào "${target.name}"`)
  }

  return (
    <>
      <div className="wf-v2-insp-subhead">Động tác quay tại mốc #{p.waypointLabel ?? wpIdx + 1}</div>
      <OptionPills
        cols={2}
        options={[...CAM_WAYPOINT_MODES]}
        value={(p.camActionMode as (typeof CAM_WAYPOINT_MODES)[number]['id']) ?? 'pan'}
        onPick={(id) => onUpdate({ camActionMode: id })}
      />

      <div className="wf-v2-insp-subhead">Thu phóng &amp; Thời lượng bước</div>
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
        label="Đệm dừng"
        min={0}
        max={4}
        step={0.2}
        value={0}
        format={(v) => (v > 0 ? `+${v.toFixed(1)}s` : '0s')}
        onChange={handleDelayChange}
      />

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

      <div className="wf-v2-insp-subhead">Căn vị trí nhanh trong cảnh</div>
      <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {ALIGN_BUTTONS.map((btn) => (
          <button
            key={btn.id}
            type="button"
            className="wf-v2-opt-pill"
            onClick={() => handleAlign(btn.id)}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="wf-v2-insp-subhead">Nhịp chuyển cảnh (Easing)</div>
      <OptionPills cols={3} options={EASE_OPTIONS} value={curEase} onPick={handleEaseChange} />

      {shotLayers.length > 0 && (
        <>
          <div className="wf-v2-insp-subhead">Ngắm nhanh vào Layer trong cảnh</div>
          <div className="wf-v2-chip-grid">
            {shotLayers.slice(0, 8).map((l) => (
              <button
                key={l.id}
                type="button"
                className="wf-v2-spawn-chip"
                title={`Căn tâm khung camera của mốc này vào Layer "${l.name}"`}
                onClick={() => handleAimLayer(l.id)}
              >
                🎯 {l.name}
              </button>
            ))}
          </div>
        </>
      )}

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

export function WorkflowV2CameraParams(props: WorkflowV2NodeParamsProps): React.ReactElement {
  const { node, project, workflow, onUpdate, onScrubTime, onSelectNode, onSpawnCameraWaypoint } = props
  const editorUpdate = useEditor((s) => s.update)
  const time = useEditor((s) => s.time)
  const selectedLayer = useEditor((s) => findLayer(s.project, s.selectedLayerId))
  const [presetIntensity, setPresetIntensity] = useState<number>(node.params?.intensity ?? 1)
  const [show3DControls, setShow3DControls] = useState(false)

  const p = node.params ?? {}
  if (p.isCameraWaypoint) return <WorkflowV2CameraWaypointParams {...props} />

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

  const addMilestoneAtPlayhead = (): void => {
    const shotStart = p.timeStart ?? 0
    const shotEnd = p.timeEnd ?? project.comp.duration ?? 5
    const tClamped = Number(
      Math.max(shotStart + 0.2, Math.min(shotEnd - 0.2, time >= shotStart && time <= shotEnd ? time : (shotStart + shotEnd) / 2)).toFixed(2)
    )
    editorUpdate((d) => {
      const evAtT = evaluateScene(d as typeof project, tClamped)
      setValueAt(d.camera.position, tClamped, evAtT.camera.position, tol)
      setValueAt(d.camera.target, tClamped, evAtT.camera.target, tol)
      setValueAt(d.camera.fov, tClamped, evAtT.camera.fov, tol)
    }, 'cam-add-milestone-playhead')
    onScrubTime(tClamped)
    toast(`⏱️ Đã thêm mốc thời gian Camera tại ${tClamped.toFixed(2)}s`)
  }

  const cam = project.camera
  const tol = frameTolerance(project)
  const targetShot = findShot(project, p.shotId ?? null)
  const ev = evaluateScene(project, time)
  const camEv = ev.camera
  const dofEnabled = Boolean(cam?.dofEnabled ?? p.enableDof)
  const shakeAmt = cam?.shakeAmount ?? p.camShakeAmount ?? 0
  const shakeSpd = cam?.shakeSpeed ?? p.camShakeSpeed ?? 2.2

  const updateCameraPosAxis = (axis: 0 | 1 | 2, val: number): void => {
    editorUpdate((d) => {
      const next: Vec3 = [...camEv.position] as Vec3
      next[axis] = val
      setValueAt(d.camera.position, time, next, tol)
    }, `cam-pos-${axis}`)
  }

  const updateCameraFov = (fov: number): void => {
    editorUpdate((d) => setValueAt(d.camera.fov, time, fov, tol), 'cam-fov')
  }

  const updateCameraFade = (fade: number): void => {
    editorUpdate((d) => {
      if (!d.camera.fade) d.camera.fade = { value: 0, keyframes: [] }
      setValueAt(d.camera.fade, time, fade, tol)
    }, 'cam-fade')
  }

  const resetCameraToShot = (): void => {
    editorUpdate((d) => {
      const shot = p.shotId ? findShot(d, p.shotId) : undefined
      if (shot) {
        const pose = shotFramingPose(d as typeof project, shot, time)
        setValueAt(d.camera.position, time, pose.position, tol)
        setValueAt(d.camera.target, time, pose.target, tol)
      } else {
        const z = referenceDistance(d.comp)
        setValueAt(d.camera.position, time, [0, 0, -z], tol)
        setValueAt(d.camera.target, time, [0, 0, 0], tol)
      }
      setValueAt(d.camera.fov, time, 45, tol)
    })
    toast(targetShot ? `🎥 Đã căn camera về khung chuẩn của "${targetShot.name}"` : '🎥 Đã đưa camera về khung chuẩn')
  }

  const applyPresetToShot = (presetId: CameraPreset): void => {
    const startSec = p.timeStart ?? time
    const durSec = Math.max(1.2, Math.min(4.0, (p.timeEnd ?? startSec + 2.5) - startSec))
    const foundPreset = CAMERA_PRESETS.find((x) => x.id === presetId)
    editorUpdate((d) => {
      const shot = p.shotId ? findShot(d, p.shotId) : undefined
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
    const dx = lp[0] - camEv.position[0]
    const dy = lp[1] - camEv.position[1]
    const dz = lp[2] - camEv.position[2]
    const dist = Math.round(Math.hypot(dx, dy, dz))
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

  return (
    <>
      <div className="wf-v2-insp-subhead">
        ⏱️ Mốc thời gian Camera trong cảnh ({shotWaypoints.length} mốc)
      </div>
      {shotWaypoints.length > 0 && (
        <div className="wf-v2-cam-wp-list">
          {shotWaypoints.map((wp, idx) => {
            const wpStart = wp.params?.timeStart ?? 0
            const wpEnd = wp.params?.timeEnd ?? wpStart + 1
            const isAtTime = time >= wpStart - 0.02 && time <= wpEnd + 0.02
            return (
              <div
                key={wp.id}
                className={`wf-v2-cam-wp-row${isAtTime ? ' is-live' : ''}`}
              >
                <button
                  type="button"
                  className="wf-v2-cam-wp-select"
                  title={`Chọn và nhảy tới mốc "${wp.title}" (${wpStart.toFixed(1)}s – ${wpEnd.toFixed(1)}s)`}
                  onClick={() => {
                    onScrubTime(wpStart)
                    onSelectNode?.(wp.id)
                  }}
                >
                  <span className="wp-badge">#{wp.params?.waypointLabel ?? idx + 1}</span>
                  <span className="wp-title">{wp.title.replace(/^#[\d.]+\s*·\s*/, '')}</span>
                  <span className="wp-time">
                    {wpStart.toFixed(1)}s–{wpEnd.toFixed(1)}s
                  </span>
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
          title="Chèn một mốc keyframe Camera mới ngay tại vị trí Playhead (hoặc giữa cảnh)"
          onClick={addMilestoneAtPlayhead}
        >
          <span className="wf-v2-opt-pill-txt">
            📍 + Thêm mốc thời gian tại Playhead ({time.toFixed(1)}s)
          </span>
        </button>
        {p.shotId &&
          onSpawnCameraWaypoint &&
          CAM_SPAWN_BUTTONS.map((btn) => (
            <button
              key={btn.mode}
              type="button"
              className="wf-v2-opt-pill"
              title={`Thêm mốc thời gian Camera (${btn.label}) nối tiếp vào lộ trình của cảnh này`}
              onClick={() => onSpawnCameraWaypoint(p.shotId!, btn.mode)}
            >
              <span className="wf-v2-opt-pill-txt">{btn.label} (+2s)</span>
            </button>
          ))}
      </div>

      <div className="wf-v2-insp-subhead">
        Tư thế 3D &amp; Ống kính {targetShot ? `(${targetShot.name})` : ''}
      </div>
      <ParamSlider
        label="Vị trí X"
        min={-2400}
        max={2400}
        step={10}
        value={Math.round(camEv.position[0])}
        format={(v) => `${Math.round(v)}px`}
        onChange={(v) => updateCameraPosAxis(0, v)}
      />
      <ParamSlider
        label="Vị trí Y"
        min={-1600}
        max={1600}
        step={10}
        value={Math.round(camEv.position[1])}
        format={(v) => `${Math.round(v)}px`}
        onChange={(v) => updateCameraPosAxis(1, v)}
      />
      <ParamSlider
        label="Khoảng Z"
        min={-800}
        max={3600}
        step={10}
        value={Math.round(camEv.position[2])}
        format={(v) => `${Math.round(v)}px`}
        onChange={(v) => updateCameraPosAxis(2, v)}
      />
      <ParamSlider
        label="Ống kính"
        min={15}
        max={100}
        step={1}
        value={Math.round(camEv.fov)}
        format={(v) => `${Math.round(v)}°`}
        onChange={updateCameraFov}
      />
      <ParamSlider
        label="Mờ đen"
        min={0}
        max={1}
        step={0.02}
        value={camEv.fade}
        onChange={updateCameraFade}
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

      <div className="wf-v2-insp-subhead">Chuyển động Camera mẫu (Preset)</div>
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

      <div className="wf-v2-insp-subhead">Độ sâu trường ảnh (DOF)</div>
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
            onChange={(v) =>
              editorUpdate((d) => setValueAt(d.camera.focusDistance, time, v, tol), 'cam-focus')
            }
          />
          <ParamSlider
            label="Khẩu độ"
            min={0}
            max={2}
            step={0.02}
            value={camEv.aperture}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) =>
              editorUpdate((d) => setValueAt(d.camera.aperture, time, v, tol), 'cam-aperture')
            }
          />
          <button
            type="button"
            className="wf-v2-ghost-btn"
            disabled={!selectedLayer}
            onClick={focusOnSelectedLayer}
          >
            🎯 Focus vào Layer đang chọn {selectedLayer ? `(${getLayerDisplayName(selectedLayer)})` : ''}
          </button>
        </>
      )}

      <div className="wf-v2-insp-subhead">Rung máy cầm tay (Handheld Shake)</div>
      <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <button
          type="button"
          className={`wf-v2-opt-pill${shakeAmt === 0 ? ' active' : ''}`}
          onClick={() => setShakeQuick(0, 1)}
        >
          Tắt
        </button>
        <button
          type="button"
          className={`wf-v2-opt-pill${shakeAmt === 4 ? ' active' : ''}`}
          onClick={() => setShakeQuick(4, 1.5)}
        >
          ✋ Nhẹ
        </button>
        <button
          type="button"
          className={`wf-v2-opt-pill${shakeAmt === 12 ? ' active' : ''}`}
          onClick={() => setShakeQuick(12, 2.5)}
        >
          🚶 Bước
        </button>
        <button
          type="button"
          className={`wf-v2-opt-pill${shakeAmt === 22 ? ' active' : ''}`}
          onClick={() => setShakeQuick(22, 4.0)}
        >
          💥 Mạnh
        </button>
      </div>
      <ParamSlider
        label="Biên độ"
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

      {p.shotId && onSpawnCameraWaypoint && (
        <>
          <div className="wf-v2-insp-subhead">Thêm cảnh con vào lộ trình quay</div>
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
        </>
      )}
    </>
  )
}
