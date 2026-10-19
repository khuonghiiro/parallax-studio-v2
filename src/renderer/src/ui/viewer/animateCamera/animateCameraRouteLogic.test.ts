import { describe, expect, it } from 'vitest'
import { createProject, createShot } from '../../../project/factory'
import { evaluateCamera } from '../../../engine/evaluateScene'
import {
  computeShotStageLayout,
  evaluateLiveCameraFrame2D,
  extractCameraFrames2D,
  applyStageFrameToDraft
} from './animateCameraMath'
import {
  buildReactFlowBezierPath,
  buildReactFlowSmoothStepPath,
  computeBubbleAnchorAttachment
} from './animateCameraEdgePaths'
import { computeCalloutBubbleNodes } from './calloutBubbleLayout'
import {
  alignWaypointInShot,
  appendShotCameraWaypoint,
  applyCameraRoutePreset,
  applyWaypointActionMode,
  duplicateCameraWaypoint,
  enrichCameraWaypoints,
  ensureShotWaypointTime,
  findActiveWaypointIndexAtTime,
  panCameraToLayer2D,
  panCameraToShot,
  removeCameraWaypoint,
  reverseCameraRoute,
  spawnNextCameraWaypoint,
  updateCameraWaypoint,
  updateWaypointStepDuration,
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
    expect(waypoints[0].isFirstOfShot).toBe(true)

    expect(waypoints[1].tag).toBe('pan')
    expect(waypoints[1].tagLabel).toContain('Cảnh 2')
    expect(waypoints[1].durationFromPrev).toBe(2.5)
    expect(waypoints[1].isFirstOfShot).toBe(true)

    expect(waypoints[2].tag).toBe('zoom-in')
    expect(waypoints[2].zoomPct).toBe(200)
    expect(waypoints[2].durationFromPrev).toBe(2.5)
    expect(waypoints[2].isFirstOfShot).toBe(false)
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

  it('spawns and targets a new waypoint on a newly created shot instead of modifying an old shot active circle', () => {
    const p = createProject({ width: 1920, height: 1080, duration: 8 })
    const s1 = createShot('Cảnh 1', [0, 0, 0], 0)
    const s2 = createShot('Cảnh 2', [10560, 0, 0], 1)
    const s3 = createShot('Cảnh 3', [21120, 0, 0], 2)
    p.shots.push(s1, s2, s3)
    const layout = computeShotStageLayout(p, 0)

    applyStageFrameToDraft(p, layout, 0, layout[0].stageX, layout[0].stageY, 1.0, true)
    applyStageFrameToDraft(p, layout, 3.0, layout[1].stageX, layout[1].stageY, 1.0, true)

    // User creates/activates Cảnh 3 while playhead is at 3.0s (Cảnh 2)
    const tNew = ensureShotWaypointTime(p, layout, s3.id, 3.0, true)
    expect(tNew).toBeGreaterThan(3.0)

    const frames = extractCameraFrames2D(p, layout)
    expect(frames).toHaveLength(3)
    // Old waypoint on Cảnh 2 at 3.0s must remain untouched on Cảnh 2
    expect(frames[1].shotId).toBe(s2.id)
    // New waypoint at tNew must belong to Cảnh 3
    expect(frames[2].shotId).toBe(s3.id)
    expect(frames[2].time).toBeCloseTo(tNew, 2)

    // Calling appendShotCameraWaypoint on a 4th shot appends after the last waypoint
    const s4 = createShot('Cảnh 4', [31680, 0, 0], 3)
    p.shots.push(s4)
    const layout4 = computeShotStageLayout(p, 0)
    const t4 = appendShotCameraWaypoint(p, layout4, s4.id, 2.0)
    expect(t4).toBeCloseTo(tNew + 2.0, 2)
  })

  it('tracks stepDuration intervals accurately: #1 lasts 2s [0..2.0s], at 2.01s switches to #2 lasting 3s [2.0..5.0s]', () => {
    const p = createProject({ width: 1920, height: 1080, duration: 10 })
    const s1 = createShot('Cảnh 1', [0, 0, 0], 0)
    const s2 = createShot('Cảnh 2', [10560, 0, 0], 1)
    const s3 = createShot('Cảnh 3', [21120, 0, 0], 2)
    p.shots.push(s1, s2, s3)
    const layout = computeShotStageLayout(p, 0)

    // Create 3 waypoints initially at 0s, 1.5s, 4.0s
    applyStageFrameToDraft(p, layout, 0.0, layout[0].stageX, layout[0].stageY, 1.0, true)
    applyStageFrameToDraft(p, layout, 1.5, layout[1].stageX, layout[1].stageY, 0.8, true)
    applyStageFrameToDraft(p, layout, 4.0, layout[2].stageX, layout[2].stageY, 0.6, true)

    // User sets #1 duration to 2.0s and #2 duration to 3.0s
    updateWaypointStepDuration(p, layout, 0, { stepDuration: 2.0 })
    updateWaypointStepDuration(p, layout, 1, { stepDuration: 3.0 })

    const frames = extractCameraFrames2D(p, layout)
    const waypoints = enrichCameraWaypoints(frames)

    expect(waypoints[0].time).toBeCloseTo(0.0, 2)
    expect(waypoints[0].stepDuration).toBeCloseTo(2.0, 2)
    expect(waypoints[0].endTime).toBeCloseTo(2.0, 2)

    expect(waypoints[1].time).toBeCloseTo(2.0, 2)
    expect(waypoints[1].stepDuration).toBeCloseTo(3.0, 2)
    expect(waypoints[1].endTime).toBeCloseTo(5.0, 2)

    expect(waypoints[2].time).toBeCloseTo(5.0, 2)

    // Verify active waypoint interval selection:
    // During [0.0s .. 1.99s], #1 (index 0) is active
    expect(findActiveWaypointIndexAtTime(waypoints, 0.0)).toBe(0)
    expect(findActiveWaypointIndexAtTime(waypoints, 1.2)).toBe(0)
    expect(findActiveWaypointIndexAtTime(waypoints, 1.99)).toBe(0)

    // At 2.00s and 2.01s, #2 (index 1) becomes active and stays active for 3s until 5.0s
    expect(findActiveWaypointIndexAtTime(waypoints, 2.0)).toBe(1)
    expect(findActiveWaypointIndexAtTime(waypoints, 2.01)).toBe(1)
    expect(findActiveWaypointIndexAtTime(waypoints, 3.5)).toBe(1)
    expect(findActiveWaypointIndexAtTime(waypoints, 4.99)).toBe(1)

    // At 5.01s, #3 (index 2) becomes active
    expect(findActiveWaypointIndexAtTime(waypoints, 5.01)).toBe(2)
  })

  it('honors per-waypoint delaySec (buffer before action) and actionDurationSec (fewer seconds = faster, more seconds = slower)', () => {
    const p = createProject({ width: 1920, height: 1080, duration: 8 })
    const s1 = createShot('Cảnh 1', [0, 0, 0], 0)
    p.shots.push(s1)
    const layout = computeShotStageLayout(p, 0)

    // #1 at 0.0s: scale 1.0 (100%)
    applyStageFrameToDraft(p, layout, 0.0, layout[0].stageX, layout[0].stageY, 1.0, true)
    // #2 at 4.0s: push-in to scale 0.5 (200%), linear easing for exact math check
    applyStageFrameToDraft(p, layout, 4.0, layout[0].stageX, layout[0].stageY, 0.5, true, {
      ease: 'linear'
    })

    // Configure #2: wait 1.0s buffer (delaySec = 1.0), then push-in fast over 1.0s (actionDurationSec = 1.0)
    updateWaypointStepDuration(p, layout, 1, {
      delaySec: 1.0,
      actionDurationSec: 1.0
    })

    const frames = extractCameraFrames2D(p, layout)
    // During buffer [0.0s .. 1.0s], camera holds at scale 1.0
    const liveAt0_8 = evaluateLiveCameraFrame2D(p, layout, frames, 0.8)
    expect(liveAt0_8.scale).toBeCloseTo(1.0, 2)

    // Halfway through the 1.0s fast action (at t = 1.5s), camera is halfway to 0.5 (scale = 0.75)
    const liveAt1_5 = evaluateLiveCameraFrame2D(p, layout, frames, 1.5)
    expect(liveAt1_5.scale).toBeCloseTo(0.75, 2)

    // After the fast 1.0s action finishes (at t = 2.5s), camera has already reached scale 0.5 and holds
    const liveAt2_5 = evaluateLiveCameraFrame2D(p, layout, frames, 2.5)
    expect(liveAt2_5.scale).toBeCloseTo(0.5, 2)

    // 3D evaluateCamera also matches the buffer and fast action timing
    const camAt0_8 = evaluateCamera(p, 0.8)
    const camAt2_5 = evaluateCamera(p, 2.5)
    expect(camAt2_5.focusDistance).toBeLessThan(camAt0_8.focusDistance)
  })

  it('positions callout bubbles without overlapping any shot canvas, shot header, or neighboring bubble', () => {
    const p = createProject({ width: 1920, height: 1080, duration: 12 })
    // 2-row layout matching user scenario: Shot 3 at [21120, 0, 0] and Shot 4 directly below at [21120, -14200, 0]
    const s1 = createShot('Cảnh 1', [0, 0, 0], 0)
    const s2 = createShot('Cảnh 2', [10560, 0, 0], 1)
    const s3 = createShot('Cảnh 3', [21120, 0, 0], 2)
    const s4 = createShot('Cảnh 4', [21120, -14200, 0], 3)
    p.shots.push(s1, s2, s3, s4)
    const layout = computeShotStageLayout(p, 0)

    applyStageFrameToDraft(p, layout, 0.0, layout[0].stageX, layout[0].stageY, 1.0, true)
    applyStageFrameToDraft(p, layout, 2.0, layout[1].stageX, layout[1].stageY, 0.8, true)
    applyStageFrameToDraft(p, layout, 4.0, layout[2].stageX, layout[2].stageY, 1.0, true)
    applyStageFrameToDraft(p, layout, 6.0, layout[2].stageX + 40, layout[2].stageY, 0.6, true)
    applyStageFrameToDraft(p, layout, 8.0, layout[3].stageX, layout[3].stageY, 0.9, true)

    const frames = extractCameraFrames2D(p, layout)
    const waypoints = enrichCameraWaypoints(frames)
    const stageToScreen = (sx: number, sy: number) => ({ x: sx, y: sy })
    const bubbles = computeCalloutBubbleNodes(layout, waypoints, 1.0, stageToScreen, {})
    expect(bubbles).toHaveLength(5)

    // Every bubble must stay outside every shot box + header margin
    for (const b of bubbles) {
      for (const box of layout) {
        const left = box.stageX - box.width / 2 - 20
        const right = box.stageX + box.width / 2 + 20
        const top = box.stageY - box.height / 2 - 42
        const bottom = box.stageY + box.height / 2 + 20
        const insideObstacle =
          b.bubbleX > left && b.bubbleX < right && b.bubbleY > top && b.bubbleY < bottom
        expect(insideObstacle).toBe(false)
      }
    }

    // No two bubbles may collide with each other
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const dist = Math.hypot(
          bubbles[i].bubbleX - bubbles[j].bubbleX,
          bubbles[i].bubbleY - bubbles[j].bubbleY
        )
        expect(dist).toBeGreaterThanOrEqual(48)
      }
    }
  })

  it('updates delaySec, actionDurationSec, and pose sliders/buttons across all camera action modes without sticking or leaking roll', () => {
    const p = createProject({ width: 1920, height: 1080, duration: 12 })
    const s1 = createShot('Cảnh 1', [0, 0, 0], 0)
    const s2 = createShot('Cảnh 2', [10560, 0, 0], 1)
    p.shots.push(s1, s2)
    const layout = computeShotStageLayout(p, 0)

    applyStageFrameToDraft(p, layout, 0.0, layout[0].stageX, layout[0].stageY, 1.0, true)
    applyStageFrameToDraft(p, layout, 4.0, layout[0].stageX, layout[0].stageY, 0.58, true)
    applyStageFrameToDraft(p, layout, 6.0, layout[1].stageX, layout[1].stageY, 1.0, true)

    // 1. Shrink actionDurationSec on #1 to 0.5s (Rất nhanh) and delaySec to 0.5s
    updateWaypointStepDuration(p, layout, 0, { delaySec: 0.5 })
    updateWaypointStepDuration(p, layout, 0, { actionDurationSec: 0.5 })

    let wps = enrichCameraWaypoints(extractCameraFrames2D(p, layout))
    expect(wps[0].delaySec).toBe(0.5)
    expect(wps[0].actionDurationSec).toBe(0.5)
    expect(wps[0].stepDuration).toBe(1.0)
    expect(wps[1].time).toBe(1.0)

    // 2. Increase actionDurationSec to 4.5s (Rất chậm), then back to 1.0s (Nhanh), and delaySec back to 0s
    updateWaypointStepDuration(p, layout, 0, { actionDurationSec: 4.5 })
    wps = enrichCameraWaypoints(extractCameraFrames2D(p, layout))
    expect(wps[0].actionDurationSec).toBe(4.5)
    expect(wps[0].stepDuration).toBe(5.0)

    updateWaypointStepDuration(p, layout, 0, { delaySec: 0, actionDurationSec: 1.0 })
    wps = enrichCameraWaypoints(extractCameraFrames2D(p, layout))
    expect(wps[0].delaySec).toBe(0)
    expect(wps[0].actionDurationSec).toBe(1.0)
    expect(wps[0].stepDuration).toBe(1.0)

    // 3. Apply dutch-tilt on #2 (1.0s) and verify #1 (0.0s) and #3 (3.0s) do NOT inherit roll
    applyWaypointActionMode(p, layout, wps[1].time, 'dutch-tilt')
    wps = enrichCameraWaypoints(extractCameraFrames2D(p, layout))
    expect(wps[1].actionMode).toBe('dutch-tilt')
    expect(Math.abs(wps[1].roll)).toBeGreaterThanOrEqual(8)
    expect(wps[0].roll).toBe(0)
    expect(wps[2].roll).toBe(0)

    // 4. Switch #2 to push-in and verify roll/yaw/pitch reset to 0 and zoomPct updates cleanly
    applyWaypointActionMode(p, layout, wps[1].time, 'push-in')
    updateCameraWaypoint(p, layout, wps[1].time, { scale: 100 / 180 })
    wps = enrichCameraWaypoints(extractCameraFrames2D(p, layout))
    expect(wps[1].actionMode).toBe('push-in')
    expect(wps[1].roll).toBe(0)
    expect(wps[1].yaw).toBe(0)
    expect(wps[1].pitch).toBe(0)
    expect(wps[1].zoomPct).toBe(180)
  })

  it('inserts supplementary waypoints (#5.1, #5.2, #6.1) into an earlier shot without renumbering subsequent shots to #10, and updates delaySec independently', () => {
    const p = createProject({ width: 1920, height: 1080, duration: 24 })
    const s1 = createShot('Cảnh 1', [0, 0, 0], 0)
    const s2 = createShot('Cảnh 2', [10560, 0, 0], 1)
    const s3 = createShot('Cảnh 3', [21120, 0, 0], 2)
    p.shots.push(s1, s2, s3)
    const layout = computeShotStageLayout(p, 0)

    // Cảnh 1: #1 (0s), #2 (2s), #3 (4s)
    applyStageFrameToDraft(p, layout, 0, layout[0].stageX, layout[0].stageY, 1.0, true)
    applyStageFrameToDraft(p, layout, 2, layout[0].stageX + 100, layout[0].stageY, 0.85, true)
    applyStageFrameToDraft(p, layout, 4, layout[0].stageX - 100, layout[0].stageY, 0.75, true)
    // Cảnh 2: #4 (6s), #5 (8s), #6 (10s)
    applyStageFrameToDraft(p, layout, 6, layout[1].stageX, layout[1].stageY, 1.0, true)
    applyStageFrameToDraft(p, layout, 8, layout[1].stageX + 120, layout[1].stageY, 0.8, true)
    applyStageFrameToDraft(p, layout, 10, layout[1].stageX - 120, layout[1].stageY, 0.7, true)
    // Cảnh 3: #7 (12s), #8 (14s), #9 (16s)
    applyStageFrameToDraft(p, layout, 12, layout[2].stageX, layout[2].stageY, 1.0, true)
    applyStageFrameToDraft(p, layout, 14, layout[2].stageX + 150, layout[2].stageY, 0.8, true)
    applyStageFrameToDraft(p, layout, 16, layout[2].stageX - 150, layout[2].stageY, 0.65, true)

    let wps = enrichCameraWaypoints(extractCameraFrames2D(p, layout))
    expect(wps.map((w) => w.displayLabel)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])

    // User selects #5 (index 4 in Cảnh 2) and spawns two supplementary steps (#5.1, #5.2)
    const wp5 = wps.find((w) => w.displayLabel === '5')!
    expect(wp5.nextSpawnLabel).toBe('5.1')

    const res5_1 = spawnNextCameraWaypoint(p, layout, {
      mode: 'zoom-in',
      activeTime: wp5.time,
      selectedShotId: s2.id,
      fromWaypointTime: wp5.time
    })!
    expect(res5_1.displayLabel).toBe('5.1')
    wps = enrichCameraWaypoints(extractCameraFrames2D(p, layout))
    const wp5_1 = wps.find((w) => Math.abs(w.time - res5_1.nextTime) < 0.01)!
    expect(wp5_1.displayLabel).toBe('5.1')
    expect(wp5_1.shotId).toBe(s2.id)
    expect(wp5_1.nextSpawnLabel).toBe('5.2')

    // Spawn second supplementary step (#5.2) either from #5 or from #5.1
    const wp5After = wps.find((w) => w.displayLabel === '5')!
    expect(wp5After.nextSpawnLabel).toBe('5.2')
    const res5_2 = spawnNextCameraWaypoint(p, layout, {
      mode: 'pan',
      activeTime: wp5After.time,
      selectedShotId: s2.id,
      fromWaypointTime: wp5After.time
    })!
    expect(res5_2.displayLabel).toBe('5.2')
    wps = enrichCameraWaypoints(extractCameraFrames2D(p, layout))
    const wp5_2 = wps.find((w) => Math.abs(w.time - res5_2.nextTime) < 0.01)!
    expect(wp5_2.displayLabel).toBe('5.2')
    expect(wp5_2.shotId).toBe(s2.id)

    // Verify all labels: #6 in Cảnh 2 and #7, #8, #9 in Cảnh 3 remain intact (no #10!)
    expect(wps.map((w) => w.displayLabel)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '5.1',
      '5.2',
      '6',
      '7',
      '8',
      '9'
    ])

    // Even at #6 (last waypoint of Cảnh 2 right before Cảnh 3's #7), spawning stays inside Cảnh 2 as #6.1
    const wp6 = wps.find((w) => w.displayLabel === '6')!
    expect(wp6.nextSpawnLabel).toBe('6.1')
    const res6_1 = spawnNextCameraWaypoint(p, layout, {
      mode: 'zoom-out',
      activeTime: wp6.time,
      selectedShotId: s2.id,
      fromWaypointTime: wp6.time
    })!
    expect(res6_1.displayLabel).toBe('6.1')
    wps = enrichCameraWaypoints(extractCameraFrames2D(p, layout))
    const wp6_1 = wps.find((w) => Math.abs(w.time - res6_1.nextTime) < 0.01)!
    expect(wp6_1.displayLabel).toBe('6.1')
    expect(wp6_1.shotId).toBe(s2.id)
    expect(wps.map((w) => w.displayLabel)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '5.1',
      '5.2',
      '6',
      '6.1',
      '7',
      '8',
      '9'
    ])

    // Verify independent delaySec slider/button adjustments on transition #5 -> #5.1
    const idx5 = wps.findIndex((w) => w.displayLabel === '5')
    const initialActionDur = wps[idx5].actionDurationSec
    updateWaypointStepDuration(p, layout, idx5, { delaySec: 1.5 })
    wps = enrichCameraWaypoints(extractCameraFrames2D(p, layout))
    expect(wps[idx5].delaySec).toBeCloseTo(1.5, 2)
    expect(wps[idx5].actionDurationSec).toBeCloseTo(initialActionDur, 2)
    expect(wps[idx5].stepDuration).toBeCloseTo(1.5 + initialActionDur, 2)

    // Reduce delaySec to 0.5s — stepDuration must shrink accordingly while keeping actionDurationSec intact
    updateWaypointStepDuration(p, layout, idx5, { delaySec: 0.5 })
    wps = enrichCameraWaypoints(extractCameraFrames2D(p, layout))
    expect(wps[idx5].delaySec).toBeCloseTo(0.5, 2)
    expect(wps[idx5].actionDurationSec).toBeCloseTo(initialActionDur, 2)
    expect(wps[idx5].stepDuration).toBeCloseTo(0.5 + initialActionDur, 2)
  })
})


