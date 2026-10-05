import { useState } from 'react'
import type { Vec3 } from '@shared/types'
import { addKeyframe, setValueAt } from '../../animation/keyframes'
import { referenceDistance } from '../../animation/math'
import { shotAtTime } from '../../animation/cameraPath'
import { CAMERA_PRESETS, applyCameraPreset } from '../../animation/presets'
import { evaluateScene, shotFramingPose, shotLocalToWorld } from '../../engine/evaluateScene'
import { findLayer, findShot, frameTolerance, useEditor } from '../../store/editor'
import { AnimRow, Row, Slider, Switch } from '../controls'
import { CameraControls } from '../CameraControls'
import { IconCamera } from '../icons'
import { KeyEaseSection } from './KeyEaseSection'

export function CameraInspector() {
  const project = useEditor((s) => s.project)
  const update = useEditor((s) => s.update)
  const time = useEditor((s) => s.time)
  const selectedLayer = useEditor((s) => findLayer(s.project, s.selectedLayerId))
  const selectedShotId = useEditor((s) => s.selectedShotId)
  const [intensity, setIntensity] = useState(1)
  const cam = project.camera
  const tol = frameTolerance(project)
  // Presets & reset act on the selected shot, else on the shot the camera currently looks at.
  const targetShot = findShot(project, selectedShotId) ?? findShot(project, shotAtTime(project, time))

  const focusOnSelected = (): void => {
    if (!selectedLayer) return
    const ev = evaluateScene(project, time)
    const lp = ev.layers.find((l) => l.layer.id === selectedLayer.id)?.worldPosition
    if (!lp) return
    const cp = ev.camera.position
    const dist = Math.round(Math.hypot(lp[0] - cp[0], lp[1] - cp[1], lp[2] - cp[2]))
    update((d) => {
      d.camera.dofEnabled = true
      if (d.camera.focusDistance.keyframes.length) addKeyframe(d.camera.focusDistance, time, dist)
      else d.camera.focusDistance.value = dist
    })
  }

  return (
    <>
      <CameraControls />

      <div className="section">
        <div className="section-title">
          <IconCamera width={13} height={13} /> Chuyển động camera mẫu (preset)
          {targetShot && (
            <>
              <span className="spacer" />
              <span className="shot-chip" style={{ ['--c' as string]: targetShot.color }} title="Preset sẽ áp dụng quanh cảnh này">
                {targetShot.name}
              </span>
            </>
          )}
        </div>
        <div className="preset-grid">
          {CAMERA_PRESETS.map((p) => (
            <button
              key={p.id}
              id={`preset-${p.id}`}
              className="preset"
              onClick={() =>
                update((d) =>
                  applyCameraPreset(d.camera, p.id, d.comp, 0, d.comp.duration, intensity, shotLocalToWorld(targetShot, 0))
                )
              }
            >
              <b>{p.label}</b>
              <span>{p.hint}</span>
            </button>
          ))}
        </div>
        <div style={{ height: 8 }} />
        <Row label="Cường độ">
          <Slider value={intensity} min={0.2} max={3} step={0.05} onChange={(v) => setIntensity(v)} format={(v) => `${v.toFixed(2)}×`} />
        </Row>
        <p className="hint-text" style={{ margin: '6px 0 0' }}>
          Preset thay thế keyframe camera hiện có và trải dài toàn bộ thời lượng.
          {project.shots.length > 1 && ' Để bay qua nhiều cảnh, dùng “Lộ trình camera” trong tab Cảnh.'}
        </p>
      </div>

      <div className="section">
        <div className="section-title">Camera</div>
        <AnimRow label="Vị trí" refp={{ kind: 'camera', prop: 'position' }} kind="vec3" step={1} precision={0} />
        <AnimRow label="Điểm nhìn" refp={{ kind: 'camera', prop: 'target' }} kind="vec3" step={1} precision={0} />
        <AnimRow label="FOV (°)" refp={{ kind: 'camera', prop: 'fov' }} kind="number" step={0.1} precision={1} min={5} max={120} />
        <AnimRow label="Fade đen %" refp={{ kind: 'camera', prop: 'fade' }} kind="number" step={0.5} precision={0} displayScale={100} min={0} max={100} />
      </div>

      <KeyEaseSection match={(r) => r.kind === 'camera'} />

      <div className="section">
        <div className="section-title">
          Độ sâu trường ảnh (DOF) <span className="spacer" />
          <Switch id="dof-toggle" on={cam.dofEnabled} onChange={(v) => update((d) => void (d.camera.dofEnabled = v))} />
        </div>
        <AnimRow label="Khoảng focus" refp={{ kind: 'camera', prop: 'focusDistance' }} kind="number" step={2} precision={0} min={1} />
        <AnimRow label="Khẩu độ" refp={{ kind: 'camera', prop: 'aperture' }} kind="number" step={0.01} precision={2} min={0} max={10} />
        <div style={{ height: 6 }} />
        <button className="btn sm" style={{ width: '100%', minWidth: 0 }} disabled={!selectedLayer} onClick={focusOnSelected} title="Đặt focus vào layer đang chọn">
          <span className="btn-label">Focus vào layer đang chọn</span>
        </button>
      </div>

      <div className="section">
        <div className="section-title">Rung tay (handheld)</div>
        <Row label="Biên độ">
          <Slider value={cam.shakeAmount} min={0} max={40} step={0.5} format={(v) => v.toFixed(1)} onChange={(v, k) => update((d) => void (d.camera.shakeAmount = v), k)} />
        </Row>
        <Row label="Tốc độ">
          <Slider value={cam.shakeSpeed} min={0.05} max={3} step={0.05} format={(v) => v.toFixed(2)} onChange={(v, k) => update((d) => void (d.camera.shakeSpeed = v), k)} />
        </Row>
      </div>

      <div className="section">
        <button
          className="btn sm"
          style={{ width: '100%', minWidth: 0, justifyContent: 'center' }}
          title={targetShot ? `Đưa camera về khung mặc định của “${targetShot.name}”` : 'Đưa camera về vị trí mặc định'}
          onClick={() =>
            update((d) => {
              const dd = referenceDistance(d.comp)
              const pose = targetShot ? shotFramingPose(d as typeof project, targetShot, time) : { position: [0, 0, -dd] as Vec3, target: [0, 0, 0] as Vec3 }
              setValueAt(d.camera.position, time, pose.position, tol)
              setValueAt(d.camera.target, time, pose.target, tol)
            })
          }
        >
          <span className="btn-label">
            {targetShot ? `Đưa camera về khung mặc định của “${targetShot.name}”` : 'Đưa camera về vị trí mặc định'}
          </span>
        </button>
      </div>
    </>
  )
}
