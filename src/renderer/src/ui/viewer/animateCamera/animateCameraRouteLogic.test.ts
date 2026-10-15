import { describe, expect, it } from 'vitest'
import { createProject, createShot } from '../../../project/factory'
import {
  computeShotStageLayout,
  extractCameraFrames2D,
  applyStageFrameToDraft
} from './animateCameraMath'
import {
  buildReactFlowBezierPath,
  buildReactFlowSmoothStepPath,
  computeBubbleAnchorAttachment
} from './animateCameraEdgePaths'
import {
  alignWaypointInShot,
  applyCameraRoutePreset,
  applyWaypointActionMode,
  duplicateCameraWaypoint,
  enrichCameraWaypoints,
  panCameraToLayer2D,
  panCameraToShot,
  removeCameraWaypoint,
  reverseCameraRoute,
  updateCameraWaypoint,
  zoomCameraAtPoint
} from './animateCameraRouteLogic'

describe('animateCameraRouteLogic — Camera 2D Route Management & Parameter Tuning', () => {
  it('enriches camera frames with intuitive tags, durations and zoom percentages', () => {
    const p = createProject({ width: 1920, height: 1080, duration: 10 })
    const s1 = createShot('Cảnh 1', [0, 0, 0], 0)
    const s2 = createShot('Cảnh 2', [10560, 0, 0], 1)
    p.shots.push(s1, s2)
    const layout = computeShotStageLayout(p, 0)

    // Keyframe 1: Start at 0s
    applyStageFrameToDraft(p, layout, 0, layout[0].stageX, layout[0].stageY, 1.0, true)
    // Keyframe 2: Pan to Shot 2 at 2.5s
    applyStageFrameToDraft(p, layout, 2.5, layout[1].stageX, layout[1].stageY, 1.0, true)
    // Keyframe 3: Zoom In at 5.0s (scale = 0.5 -> 200% zoom)
    applyStageFrameToDraft(p, layout, 5.0, layout[1].stageX, layout[1].stageY, 0.5, true)

    const frames = extractCameraFrames2D(p, layout)
    const waypoints = enrichCameraWaypoints(frames)

    expect(waypoints).toHaveLength(3)
    expect(waypoints[0].tag).toBe('start')
    expect(waypoints[0].durationFromPrev).toBe(0)
    expect(waypoints[0].zoomPct).toBe(100)

    expect(waypoints[1].tag).toBe('pan')
    expect(waypoints[1].tagLabel).toContain('Cảnh 2')
    expect(waypoints[1].durationFromPrev).toBe(2.5)

    expect(waypoints[2].tag).toBe('zoom-in')
    expect(waypoints[2].zoomPct).toBe(200)
    expect(waypoints[2].durationFromPrev).toBe(2.5)
  })

  it('pans camera to target shot accurately', () => {
    const p = createProject({ width: 1920, height: 1080, duration: 6 })
    const s1 = createShot('Cảnh A', [0, 0, 0], 0)
    const s2 = createShot('Cảnh B', [5000, 0, 0], 1)
    p.shots.push(s1, s2)
    const layout = computeShotStageLayout(p, 0)

    panCameraToShot(p, layout, s2.id, 3.0, 1.0, 'easeInOut')

    const frames = extractCameraFrames2D(p, layout)
    const frameAt3 = frames.find((f) => Math.abs(f.time - 3.0) < 0.05)
    expect(frameAt3).toBeDefined()
    expect(frameAt3?.shotId).toBe(s2.id)
    expect(frameAt3?.stageX).toBe(layout[1].stageX)
    expect(frameAt3?.stageY).toBe(layout[1].stageY)
  })

  it('pans camera to 2D layer offset accurately', () => {
    const p = createProject({ width: 1920, height: 1080, duration: 6 })
    const s1 = createShot('Cảnh 1', [0, 0, 0], 0)
    p.shots.push(s1)
    const layout = computeShotStageLayout(p, 0)

    panCameraToLayer2D(p, layout, s1.id, 150, -75, 2.0, 0.6)

    const frames = extractCameraFrames2D(p, layout)
    const targetFrame = frames.find((f) => Math.abs(f.time - 2.0) < 0.05)
    expect(targetFrame).toBeDefined()
    expect(targetFrame?.stageX).toBe(layout[0].stageX + 150)
    expect(targetFrame?.stageY).toBe(layout[0].stageY - 75)
    expect(targetFrame?.scale).toBeCloseTo(0.6, 2)
  })

  it('zooms camera at point and adjusts frame scale', () => {
    const p = createProject({ width: 1920, height: 1080 })
    const layout = computeShotStageLayout(p, 0)

    zoomCameraAtPoint(p, layout, 1.5, 200, 100, 0.45)

    const frames = extractCameraFrames2D(p, layout)
    const zoomFrame = frames.find((f) => Math.abs(f.time - 1.5) < 0.05)
    expect(zoomFrame).toBeDefined()
    expect(zoomFrame?.scale).toBeCloseTo(0.45, 2)
  })

  it('updates camera waypoint parameters and moves timestamp without orphaned keys', () => {
    const p = createProject({ width: 1920, height: 1080, duration: 8 })
    const layout = computeShotStageLayout(p, 0)

    // Add initial frame at t = 2.0
    applyStageFrameToDraft(p, layout, 2.0, 100, 50, 1.0, true)

    // Update waypoint: move from 2.0s to 3.5s and update coordinates
    updateCameraWaypoint(p, layout, 2.0, {
      time: 3.5,
      stageX: 300,
      stageY: -100,
      scale: 0.7,
      ease: 'linear'
    })

    const frames = extractCameraFrames2D(p, layout)
    // Keyframe at 2.0 should be removed
    expect(frames.find((f) => Math.abs(f.time - 2.0) < 0.01)).toBeUndefined()

    // Keyframe at 3.5 should exist with new parameters
    const updated = frames.find((f) => Math.abs(f.time - 3.5) < 0.01)
    expect(updated).toBeDefined()
    expect(updated?.stageX).toBe(300)
    expect(updated?.stageY).toBe(-100)
    expect(updated?.scale).toBeCloseTo(0.7, 2)
    expect(updated?.ease).toBe('linear')
  })

  it('duplicates and removes camera waypoints safely', () => {
    const p = createProject({ width: 1920, height: 1080, duration: 10 })
    const layout = computeShotStageLayout(p, 0)

    applyStageFrameToDraft(p, layout, 0, 0, 0, 1.0, true)
    applyStageFrameToDraft(p, layout, 2.0, 150, 80, 0.8, true)

    const frames = extractCameraFrames2D(p, layout)
    expect(frames).toHaveLength(2)

    // Duplicate frame at 2.0 to 4.5s
    duplicateCameraWaypoint(p, layout, frames[1], 4.5)
    const afterDup = extractCameraFrames2D(p, layout)
    expect(afterDup).toHaveLength(3)
    expect(afterDup[2].time).toBe(4.5)
    expect(afterDup[2].stageX).toBe(150)

    // Remove frame at 2.0s
    const removed = removeCameraWaypoint(p, 2.0)
    expect(removed).toBe(true)
    const afterDel = extractCameraFrames2D(p, layout)
    expect(afterDel).toHaveLength(2)
    expect(afterDel.find((f) => Math.abs(f.time - 2.0) < 0.01)).toBeUndefined()
  })

  it('reverses camera route accurately', () => {
    const p = createProject({ width: 1920, height: 1080, duration: 6 })
    const layout = computeShotStageLayout(p, 0)

    applyStageFrameToDraft(p, layout, 0, 0, 0, 1.0, true)
    applyStageFrameToDraft(p, layout, 2, 200, 0, 0.8, true)
    applyStageFrameToDraft(p, layout, 6, 600, 0, 0.5, true)

    reverseCameraRoute(p)

    const reversed = extractCameraFrames2D(p, layout)
    expect(reversed[0].time).toBe(0)
    // The key that was at 6s with stageX=600 is now at 0s
    expect(reversed[0].stageX).toBe(600)
    // The key that was at 0s with stageX=0 is now at 6s
    expect(reversed[2].time).toBe(6)
    expect(reversed[2].stageX).toBe(0)
  })

  it('applies tour-all-shots and cinematic-zoom route presets', () => {
    const p = createProject({ width: 1920, height: 1080, duration: 9 })
    const s1 = createShot('Cảnh 1', [0, 0, 0], 0)
    const s2 = createShot('Cảnh 2', [5000, 0, 0], 1)
    const s3 = createShot('Cảnh 3', [10000, 0, 0], 2)
    p.shots.push(s1, s2, s3)
    const layout = computeShotStageLayout(p, 0)

    applyCameraRoutePreset(p, layout, 'tour-all-shots')
    const frames = extractCameraFrames2D(p, layout)
    expect(frames.length).toBeGreaterThanOrEqual(3)
    expect(frames[0].shotId).toBe(s1.id)
    expect(frames[1].shotId).toBe(s2.id)
    expect(frames[2].shotId).toBe(s3.id)
  })

  it('creates hold waypoints and applies tour-hold-and-pan & dolly-vertigo presets', () => {
    const p = createProject({ width: 1920, height: 1080, duration: 12 })
    const s1 = createShot('Cảnh A', [0, 0, 0], 0)
    const s2 = createShot('Cảnh B', [5000, 0, 0], 1)
    p.shots.push(s1, s2)
    const layout = computeShotStageLayout(p, 0)

    // Test tour-hold-and-pan: creates arrival + hold for each shot
    applyCameraRoutePreset(p, layout, 'tour-hold-and-pan')
    const frames = extractCameraFrames2D(p, layout)
    const waypoints = enrichCameraWaypoints(frames)
    expect(waypoints.length).toBe(4) // 2 shots * 2 frames each (arrival + hold)
    expect(waypoints[0].tag).toBe('start')
    expect(waypoints[1].tag).toBe('hold')
    expect(waypoints[1].tagLabel).toContain('Dừng ngắm')

    // Test dolly-vertigo preset
    applyCameraRoutePreset(p, layout, 'dolly-vertigo')
    const vertigoFrames = extractCameraFrames2D(p, layout)
    expect(vertigoFrames).toHaveLength(3)
    expect(vertigoFrames[0].scale).toBeCloseTo(1.4, 2)
    expect(vertigoFrames[1].scale).toBeCloseTo(0.45, 2)
    expect(vertigoFrames[2].scale).toBeCloseTo(1.0, 2)

    // Test panCameraToLayer2D with layerDepthZ (Rack Focus)
    panCameraToLayer2D(p, layout, s1.id, 100, 50, 4.0, 0.6, 'easeInOut', 250)
    expect(p.camera.focusDistance.keyframes.some((k) => Math.abs(k.t - 4.0) < 0.05)).toBe(true)
  })

  it('preserves existing stageX, stageY, yaw, pitch, and roll when performing partial updateCameraWaypoint', () => {
    const p = createProject({ width: 1920, height: 1080, duration: 10 })
    const s1 = createShot('Cảnh 1', [0, 0, 0], 0)
    const s2 = createShot('Cảnh 2', [10560, 0, 0], 1)
    p.shots.push(s1, s2)
    const layout = computeShotStageLayout(p, 0)

    // Place a keyframe on Shot 2 with custom offset and 3D angles
    applyStageFrameToDraft(p, layout, 3.0, layout[1].stageX + 240, layout[1].stageY - 120, 0.85, true, {
      yaw: 16,
      pitch: -8,
      roll: 9
    })

    // Partial update: only change scale (Zoom) and ease — must NOT reset stageX/stageY to Shot 1 (0, 0)
    updateCameraWaypoint(p, layout, 3.0, {
      scale: 0.55,
      ease: 'easeOut'
    })

    const frames = extractCameraFrames2D(p, layout)
    const updated = frames.find((f) => Math.abs(f.time - 3.0) < 0.05)
    expect(updated).toBeDefined()
    expect(updated?.shotId).toBe(s2.id)
    expect(updated?.stageX).toBe(layout[1].stageX + 240)
    expect(updated?.stageY).toBe(layout[1].stageY - 120)
    expect(updated?.scale).toBeCloseTo(0.55, 2)
    expect(updated?.yaw).toBeCloseTo(16, 0)
    expect(updated?.pitch).toBeCloseTo(-8, 0)
    expect(updated?.roll).toBeCloseTo(9, 1)
    expect(updated?.ease).toBe('easeOut')
  })

  it('shifts subsequent keyframes cleanly when ripple is enabled on updateCameraWaypoint', () => {
    const p = createProject({ width: 1920, height: 1080, duration: 12 })
    const layout = computeShotStageLayout(p, 0)

    applyStageFrameToDraft(p, layout, 0, 0, 0, 1.0, true)
    applyStageFrameToDraft(p, layout, 2.0, 200, 0, 0.8, true)
    applyStageFrameToDraft(p, layout, 5.0, 400, 0, 0.6, true)

    // Move keyframe at 2.0s to 3.5s (+1.5s) with ripple = true
    updateCameraWaypoint(p, layout, 2.0, {
      time: 3.5,
      ripple: true
    })

    const frames = extractCameraFrames2D(p, layout)
    expect(frames).toHaveLength(3)
    expect(frames[0].time).toBe(0)
    expect(frames[1].time).toBeCloseTo(3.5, 2)
    // Keyframe that was at 5.0s should shift by +1.5s to 6.5s
    expect(frames[2].time).toBeCloseTo(6.5, 2)
  })

  it('applies camera action modes (orbit, dutch-tilt, cut) and 2D shot alignments accurately', () => {
    const p = createProject({ width: 1920, height: 1080, duration: 10 })
    const s1 = createShot('Cảnh 1', [0, 0, 0], 0)
    p.shots.push(s1)
    const layout = computeShotStageLayout(p, 0)

    applyStageFrameToDraft(p, layout, 0, 0, 0, 1.0, true)
    applyStageFrameToDraft(p, layout, 3.0, 100, -50, 1.0, true)

    applyWaypointActionMode(p, layout, 3.0, 'orbit-left')
    let frames = extractCameraFrames2D(p, layout)
    expect(frames[1].yaw).toBeCloseTo(-25, 0)

    applyWaypointActionMode(p, layout, 3.0, 'dutch-tilt')
    frames = extractCameraFrames2D(p, layout)
    expect(Math.abs(frames[1].roll)).toBeCloseTo(12, 1)

    alignWaypointInShot(p, layout, 3.0, 'center')
    frames = extractCameraFrames2D(p, layout)
    expect(frames[1].stageX).toBe(layout[0].stageX)
    expect(frames[1].stageY).toBe(layout[0].stageY)

    // Test new presets: parallax-orbit and action-dutch-cut
    applyCameraRoutePreset(p, layout, 'parallax-orbit')
    frames = extractCameraFrames2D(p, layout)
    expect(frames).toHaveLength(2)
    expect(frames[0].yaw).toBeLessThan(0)
    expect(frames[1].yaw).toBeGreaterThan(0)
  })

  it('builds ReactFlow-style SmoothStep (orthogonal rounded) and Bezier (arc) SVG paths accurately', () => {
    const smoothOrtho = buildReactFlowSmoothStepPath(100, 100, 300, 220, 'horizontal', 14)
    expect(smoothOrtho).toContain('M 100 100')
    expect(smoothOrtho).toContain('Q ')
    expect(smoothOrtho).toContain('L 300 220')

    // Same-Y horizontal bridge should still produce rounded Q corners
    const smoothSameY = buildReactFlowSmoothStepPath(100, 150, 400, 150, 'horizontal', 14)
    expect(smoothSameY).toContain('Q ')

    const bezierArc = buildReactFlowBezierPath(100, 150, 400, 150, 'horizontal', 0.36)
    expect(bezierArc).toContain('M 100 150 C ')
    expect(bezierArc).toContain('400 150')

    const attachBelow = computeBubbleAnchorAttachment(200, 320, 200, 150, 18)
    expect(attachBelow.flowMode).toBe('vertical')
    expect(attachBelow.startY).toBeLessThan(320)

    const attachRight = computeBubbleAnchorAttachment(450, 150, 200, 150, 18)
    expect(attachRight.flowMode).toBe('horizontal')
    expect(attachRight.startX).toBeLessThan(450)
  })
})


