import { describe, expect, it } from 'vitest'
import { createProject, createShot, createSolidLayer } from '../../../project/factory'
import { evaluateScene } from '../../../engine/evaluateScene'
import {
  applyStageFrameToDraft,
  computeShotStageLayout,
  evaluateLiveCameraFrame2D,
  extractCameraFrames2D,
  projectShotLayers2D,
  stageFrameTo3DCamera
} from './animateCameraMath'

describe('animateCameraMath — Adobe Animate 2D Camera Stage & Multi-Shot Mapping', () => {
  it('maps multiple 3D shots onto non-overlapping 2D stage boxes', () => {
    const p = createProject({ width: 1920, height: 1080 })
    const s1 = createShot('Cảnh 1', [0, 0, 0], 0)
    const s2 = createShot('Cảnh 2', [10560, 0, 0], 1)
    const s3 = createShot('Cảnh 3 (Sâu Z)', [10560, 0, 7680], 2)
    p.shots.push(s1, s2, s3)

    const layout = computeShotStageLayout(p, 0)
    expect(layout).toHaveLength(3)
    expect(layout[0].stageX).toBe(0)
    expect(layout[1].stageX).toBeGreaterThan(1920)
    // s3 has same X/Y as s2 but different Z: should be offset so it never overlaps s2 on the 2D stage
    expect(Math.abs(layout[2].stageX - layout[1].stageX)).toBeGreaterThanOrEqual(1920)
  })

  it('projects a shot’s stacked 3D layers onto its 2D plane in back-to-front order', () => {
    const p = createProject({ width: 1920, height: 1080 })
    const s1 = createShot('Cảnh 1', [0, 0, 0], 0)
    p.shots.push(s1)

    const fg = createSolidLayer(p.comp)
    fg.name = 'Tiền cảnh gần'
    fg.shotId = s1.id
    fg.transform.position.value = [100, 50, -300]

    const bg = createSolidLayer(p.comp)
    bg.name = 'Hậu cảnh xa'
    bg.shotId = s1.id
    bg.transform.position.value = [0, 0, 1200]

    p.layers.push(fg, bg)

    const ev = evaluateScene(p, 0)
    const projected = projectShotLayers2D(p, ev, s1.id, true)
    expect(projected).toHaveLength(2)
    // Back-to-front: bg (z=1200) drawn before fg (z=-300)
    expect(projected[0].name).toBe('Hậu cảnh xa')
    expect(projected[1].name).toBe('Tiền cảnh gần')
    // Since autoScale is true on solid layers, background at z=1200 projects to its exact nominal 2D size
    expect(Math.round(projected[0].width)).toBe(bg.props.width)
    expect(Math.round(projected[0].height)).toBe(bg.props.height)
  })

  it('converts smaller/larger 2D camera frames to 3D zoom-in and zoom-out keyframes and interpolates smoothly', () => {
    const p = createProject({ width: 1920, height: 1080, duration: 8 })
    const s1 = createShot('Cảnh 1', [0, 0, 0], 0)
    const s2 = createShot('Cảnh 2', [10560, 0, 0], 1)
    p.shots.push(s1, s2)

    const layout = computeShotStageLayout(p, 0)

    // Frame 1 at t=0s on Cảnh 1 (100% scale)
    applyStageFrameToDraft(p, layout, 0, layout[0].stageX, layout[0].stageY, 1.0, true)
    // Frame 2 at t=2s panned to Cảnh 2 (100% scale)
    applyStageFrameToDraft(p, layout, 2, layout[1].stageX, layout[1].stageY, 1.0, true)
    // Frame 3 at t=4s nested smaller (60% scale -> Zoom In) inside Cảnh 2
    applyStageFrameToDraft(p, layout, 4, layout[1].stageX + 120, layout[1].stageY - 80, 0.6, true)

    const frames = extractCameraFrames2D(p, layout)
    expect(frames).toHaveLength(3)
    expect(frames[0].shotId).toBe(s1.id)
    expect(frames[0].scale).toBeCloseTo(1.0, 2)

    expect(frames[1].shotId).toBe(s2.id)
    expect(frames[1].scale).toBeCloseTo(1.0, 2)

    expect(frames[2].shotId).toBe(s2.id)
    expect(frames[2].scale).toBeCloseTo(0.6, 2)
    // Smaller 2D camera frame (< 1.0) means 3D camera moved closer to the shot (Zoom In)
    const dist2 = Math.abs(frames[1].target3D[2] - frames[1].position3D[2])
    const dist3 = Math.abs(frames[2].target3D[2] - frames[2].position3D[2])
    expect(dist3).toBeLessThan(dist2)

    // Live camera frame at t=3s (midway between Frame 2 and Frame 3) should have intermediate scale
    const mid = evaluateLiveCameraFrame2D(p, layout, frames, 3.0)
    expect(mid.scale).toBeLessThan(1.0)
    expect(mid.scale).toBeGreaterThan(0.6)

    // Check stageFrameTo3DCamera larger frame (> 1.0 -> Zoom Out)
    const zoomedOut = stageFrameTo3DCamera(p, layout, layout[1].stageX, layout[1].stageY, 1.4)
    expect(zoomedOut.focusDistance).toBeGreaterThan(dist2)
  })

  it('preserves and interpolates 3D spherical angles (yaw, pitch) and Dutch angle roll', () => {
    const p = createProject({ width: 1920, height: 1080, duration: 6 })
    const s1 = createShot('Cảnh 1', [0, 0, 0], 0)
    p.shots.push(s1)
    const layout = computeShotStageLayout(p, 0)

    applyStageFrameToDraft(p, layout, 0, 0, 0, 1.0, true, {
      yaw: -15,
      pitch: 10,
      roll: -6
    })
    applyStageFrameToDraft(p, layout, 4, 150, -50, 0.8, true, {
      yaw: 20,
      pitch: -12,
      roll: 12
    })

    const frames = extractCameraFrames2D(p, layout)
    expect(frames).toHaveLength(2)
    expect(frames[0].yaw).toBeCloseTo(-15, 0)
    expect(frames[0].pitch).toBeCloseTo(10, 0)
    expect(frames[0].roll).toBeCloseTo(-6, 1)

    expect(frames[1].yaw).toBeCloseTo(20, 0)
    expect(frames[1].pitch).toBeCloseTo(-12, 0)
    expect(frames[1].roll).toBeCloseTo(12, 1)

    const mid = evaluateLiveCameraFrame2D(p, layout, frames, 2.0)
    expect(mid.roll).toBeGreaterThan(-6)
    expect(mid.roll).toBeLessThan(12)
  })
})

