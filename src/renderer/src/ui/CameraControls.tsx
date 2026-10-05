import { useMemo } from 'react'
import * as THREE from 'three'
import type { Animatable, Project, Vec3 } from '@shared/types'
import { addKeyframe, evaluate, setValueAt } from '../animation/keyframes'
import { referenceDistance } from '../animation/math'
import { shotAtTime } from '../animation/cameraPath'
import { evaluateScene, shotFramingPose } from '../engine/evaluateScene'
import { depthToThree, threeToDepth } from '../engine/spatial'
import { findLayer, findShot, frameTolerance, useEditor } from '../store/editor'
import { Row, Slider } from './controls'
import { IconCamera, IconFocus, IconPlane, IconTrash } from './icons'

const DEG = 180 / Math.PI

export function CameraControls() {
  const project = useEditor((s) => s.project)
  const update = useEditor((s) => s.update)
  const time = useEditor((s) => s.time)
  const setTime = useEditor((s) => s.setTime)
  const selectedShotId = useEditor((s) => s.selectedShotId)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)

  const cam = project.camera
  const tol = frameTolerance(project)

  // Current target shot (selected shot, else shot camera currently points at)
  const currentShot = findShot(project, selectedShotId) ?? findShot(project, shotAtTime(project, time))
  const selectedLayer = findLayer(project, selectedLayerId)

  // Keyframes analysis
  const keyTimes = useMemo(() => {
    const ts = cam.position.keyframes.map((k) => k.t)
    return Array.from(new Set(ts)).sort((a, b) => a - b)
  }, [cam.position.keyframes])

  const currentKeyIndex = keyTimes.findIndex((t) => Math.abs(t - time) <= tol)
  const isOnKey = currentKeyIndex >= 0

  // Spherical angles relative to target
  const ev = useMemo(() => evaluateScene(project, time), [project, time])
  const pos = ev.camera.position
  const tgt = ev.camera.target

  const threeP = useMemo(() => depthToThree(pos), [pos])
  const threeT = useMemo(() => depthToThree(tgt), [tgt])

  const spherical = useMemo(() => {
    const dx = threeP.x - threeT.x
    const dy = threeP.y - threeT.y
    const dz = threeP.z - threeT.z
    const dist = Math.max(10, Math.hypot(dx, dy, dz))
    const pitch = Math.asin(Math.max(-1, Math.min(1, dy / dist))) * DEG
    const yaw = Math.atan2(dx, dz) * DEG
    return { yaw, pitch, dist }
  }, [threeP, threeT])

  // Move camera in spherical coordinates around target
  const applySpherical = (newYaw: number, newPitch: number, newDist: number, mergeKey?: string): void => {
    const yawRad = newYaw * (Math.PI / 180)
    const pitchRad = Math.max(-85, Math.min(85, newPitch)) * (Math.PI / 180)
    const nx = threeT.x + newDist * Math.cos(pitchRad) * Math.sin(yawRad)
    const ny = threeT.y + newDist * Math.sin(pitchRad)
    const nz = threeT.z + newDist * Math.cos(pitchRad) * Math.cos(yawRad)
    const newPos = threeToDepth(new THREE.Vector3(nx, ny, nz))

    update((d) => {
      setValueAt(d.camera.position, time, newPos, tol)
      setValueAt(d.camera.focusDistance, time, Math.round(newDist), tol)
    }, mergeKey)
  }

  // Keyframe point actions
  const addOrUpdateKey = (): void => {
    update((d) => {
      const curPos = evaluate(d.camera.position, time)
      const curTgt = evaluate(d.camera.target, time)
      const curFoc = evaluate(d.camera.focusDistance, time)
      addKeyframe(d.camera.position, time, curPos, 'easeInOut')
      addKeyframe(d.camera.target, time, curTgt, 'easeInOut')
      addKeyframe(d.camera.focusDistance, time, Math.round(curFoc), 'easeInOut')
    })
  }

  const deleteCurrentKey = (): void => {
    if (!isOnKey) return
    update((d) => {
      const del = (a: Animatable<unknown>) => {
        a.keyframes = a.keyframes.filter((k) => Math.abs(k.t - time) > tol)
      }
      del(d.camera.position)
      del(d.camera.target)
      del(d.camera.focusDistance)
    })
  }

  const clearAllKeys = (): void => {
    if (window.confirm('Xoá tất cả keyframe để đưa camera về trạng thái tĩnh?')) {
      update((d) => {
        const curPos = evaluate(d.camera.position, time)
        const curTgt = evaluate(d.camera.target, time)
        d.camera.position.keyframes = []
        d.camera.position.value = curPos
        d.camera.target.keyframes = []
        d.camera.target.value = curTgt
        d.camera.focusDistance.keyframes = []
      })
    }
  }

  const jumpPrev = (): void => {
    const prev = [...keyTimes].reverse().find((t) => t < time - tol)
    if (prev !== undefined) setTime(prev)
  }

  const jumpNext = (): void => {
    const next = keyTimes.find((t) => t > time + tol)
    if (next !== undefined) setTime(next)
  }

  // Quick target aiming
  const aimAtShot = (shotId: string): void => {
    const s = findShot(project, shotId)
    if (!s) return
    update((d) => {
      const pose = shotFramingPose(d as Project, s, time)
      setValueAt(d.camera.position, time, pose.position, tol)
      setValueAt(d.camera.target, time, pose.target, tol)
      setValueAt(d.camera.focusDistance, time, Math.round(referenceDistance(d.comp)), tol)
    })
  }

  const aimAtLayer = (layerId: string): void => {
    const el = ev.layers.find((l) => l.layer.id === layerId)
    if (!el) return
    const lp = el.worldPosition
    const curDist = Math.hypot(lp[0] - pos[0], lp[1] - pos[1], lp[2] - pos[2])
    const dist = curDist > 50 ? curDist : referenceDistance(project.comp)
    const newPos: Vec3 = [lp[0], lp[1], lp[2] - dist]
    update((d) => {
      setValueAt(d.camera.target, time, lp, tol)
      setValueAt(d.camera.position, time, newPos, tol)
      setValueAt(d.camera.focusDistance, time, Math.round(dist), tol)
    })
  }

  const fitFramingDistance = (): void => {
    const targetDist = referenceDistance(project.comp)
    applySpherical(spherical.yaw, spherical.pitch, targetDist)
  }

  return (
    <>
      {/* 1. Point / Waypoint Navigator */}
      <div className="section">
        <div className="section-title">
          <IconCamera width={13} height={13} /> Điểm di chuyển Camera (Waypoints)
          <span className="spacer" />
          <span className="badge-count">
            {keyTimes.length > 0 ? `${keyTimes.length} điểm` : 'Tĩnh'}
          </span>
        </div>

        <div className="cam-waypoint-bar">
          <div className="cam-point-info">
            {isOnKey ? (
              <span className="active-key-pill">
                📍 Điểm {currentKeyIndex + 1}/{keyTimes.length} ({time.toFixed(2)}s)
              </span>
            ) : (
              <span className="time-pill">
                ⏱ {time.toFixed(2)}s {keyTimes.length > 0 ? '(giữa các điểm)' : '(chưa có điểm)'}
              </span>
            )}
          </div>

          <div className="cam-nav-btns">
            <button
              className="btn sm"
              onClick={jumpPrev}
              disabled={keyTimes.length === 0 || time <= keyTimes[0] + tol}
              title="Nhảy về điểm camera trước"
            >
              ◀ Trước
            </button>

            <button
              className={`btn sm ${isOnKey ? 'secondary' : 'primary'}`}
              onClick={addOrUpdateKey}
              title={isOnKey ? 'Cập nhật lại điểm camera này' : 'Đặt điểm camera (keyframe) tại thời điểm này'}
            >
              {isOnKey ? '✓ Cập nhật điểm' : '+ Đặt điểm camera'}
            </button>

            <button
              className="btn sm"
              onClick={jumpNext}
              disabled={keyTimes.length === 0 || time >= keyTimes[keyTimes.length - 1] - tol}
              title="Nhảy tới điểm camera sau"
            >
              Sau ▶
            </button>

            {isOnKey && (
              <button
                className="btn sm danger icon"
                onClick={deleteCurrentKey}
                title="Xoá điểm camera tại thời điểm này"
              >
                <IconTrash />
              </button>
            )}
          </div>
        </div>

        {keyTimes.length > 0 && (
          <div className="cam-points-strip">
            {keyTimes.map((t, idx) => {
              const isCur = Math.abs(t - time) <= tol
              return (
                <button
                  key={t}
                  className={`cam-point-dot${isCur ? ' active' : ''}`}
                  onClick={() => setTime(t)}
                  title={`Điểm ${idx + 1} tại ${t.toFixed(2)}s`}
                >
                  {idx + 1}
                </button>
              )
            })}
            <button
              className="cam-clear-all"
              onClick={clearAllKeys}
              title="Xoá tất cả keyframe để chuyển camera về cố định"
            >
              Dọn sạch
            </button>
          </div>
        )}
      </div>

      {/* 2. Visual Camera Orbit & Angle Controls */}
      <div className="section">
        <div className="section-title">
          Góc quay & Điều khiển Camera
          {currentShot && (
            <>
              <span className="spacer" />
              <span className="shot-chip" style={{ ['--c' as string]: currentShot.color }}>
                {currentShot.name}
              </span>
            </>
          )}
        </div>

        {/* Sliders for Orbit, Pitch, Distance */}
        <Row label="Xoay quanh tâm" title="Quay camera vòng quanh mục tiêu (Orbit Yaw)">
          <Slider
            value={Math.round(spherical.yaw)}
            min={-180}
            max={180}
            step={1}
            format={(v) => `${v}°`}
            onChange={(v, k) => applySpherical(v, spherical.pitch, spherical.dist, k ? `cam-yaw-${k}` : undefined)}
          />
        </Row>

        <Row label="Góc ngẩng / cúi" title="Góc nhìn từ trên cao xuống hoặc dưới thấp lên (Pitch/Tilt)">
          <Slider
            value={Math.round(spherical.pitch)}
            min={-75}
            max={75}
            step={1}
            format={(v) => `${v > 0 ? '+' : ''}${v}°`}
            onChange={(v, k) => applySpherical(spherical.yaw, v, spherical.dist, k ? `cam-pitch-${k}` : undefined)}
          />
        </Row>

        <Row label="Khoảng cách" title="Khoảng cách từ camera tới điểm nhìn">
          <Slider
            value={Math.round(spherical.dist)}
            min={100}
            max={6000}
            step={10}
            format={(v) => `${v}px`}
            onChange={(v, k) => applySpherical(spherical.yaw, spherical.pitch, v, k ? `cam-dist-${k}` : undefined)}
          />
        </Row>

        {/* Quick Angle Preset Buttons */}
        <div className="cam-angle-grid">
          <button
            className="cam-angle-btn"
            onClick={() => applySpherical(0, 0, spherical.dist)}
            title="Góc nhìn thẳng trực diện cảnh (0°)"
          >
            0° Thẳng
          </button>
          <button
            className="cam-angle-btn"
            onClick={() => applySpherical(-30, 0, spherical.dist)}
            title="Góc nhìn chéo từ bên trái 30°"
          >
            -30° Trái
          </button>
          <button
            className="cam-angle-btn"
            onClick={() => applySpherical(30, 0, spherical.dist)}
            title="Góc nhìn chéo từ bên phải 30°"
          >
            +30° Phải
          </button>
          <button
            className="cam-angle-btn"
            onClick={() => applySpherical(-45, 0, spherical.dist)}
            title="Góc nhìn chéo từ bên trái 45°"
          >
            -45° Trái
          </button>
          <button
            className="cam-angle-btn"
            onClick={() => applySpherical(45, 0, spherical.dist)}
            title="Góc nhìn chéo từ bên phải 45°"
          >
            +45° Phải
          </button>
          <button
            className="cam-angle-btn"
            onClick={() => applySpherical(0, 22, spherical.dist)}
            title="Góc nhìn từ trên cao xuống 22°"
          >
            +22° Cao
          </button>
          <button
            className="cam-angle-btn"
            onClick={() => applySpherical(0, -15, spherical.dist)}
            title="Góc nhìn từ dưới thấp lên -15°"
          >
            -15° Thấp
          </button>
          <button
            className="cam-angle-btn"
            onClick={() => applySpherical(0, 75, spherical.dist)}
            title="Góc nhìn thẳng từ trên đỉnh đầu xuống (75°)"
          >
            75° Đỉnh
          </button>
        </div>

        {/* Target and Framing Tools */}
        <div className="cam-aim-actions">
          {currentShot && (
            <button
              className="btn sm"
              onClick={() => aimAtShot(currentShot.id)}
              title={`Căn góc nhìn thẳng vào cảnh “${currentShot.name}”`}
            >
              <IconPlane /> Nhắm vào “{currentShot.name}”
            </button>
          )}

          {selectedLayer && (
            <button
              className="btn sm"
              onClick={() => aimAtLayer(selectedLayer.id)}
              title={`Nhắm camera vào layer “${selectedLayer.name}”`}
            >
              <IconFocus /> Nhắm vào Layer “{selectedLayer.name}”
            </button>
          )}

          <button
            className="btn sm"
            onClick={fitFramingDistance}
            title="Đặt khoảng cách vừa vặn khung hình tiêu chuẩn"
          >
            📐 Vừa vặn khung hình
          </button>
        </div>
      </div>
    </>
  )
}
