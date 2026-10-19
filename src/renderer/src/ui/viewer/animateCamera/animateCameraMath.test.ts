import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { evaluateCamera } from '../../../engine/evaluateScene'
import { applyEvaluatedCamera } from '../../../engine/renderTypes'
import { createProject, createShot, shotSpacing } from '../../../project/factory'
import {
  applyStageFrameToDraft,
  computeShotStageLayout,
  evaluateLiveCameraFrame2D,
  extractCameraFrames2D,
  pose3DToStageFrame
} from './animateCameraMath'
import {
  applyCameraRoutePreset,
  applyWaypointActionMode,
  CAMERA_ACTION_MODES,
  enrichCameraWaypoints,
  shiftSubsequentCameraKeyframes
} from './animateCameraRouteLogic'

function makeThreeShotProject() {
  const project = createProject({ duration: 16 })
  const spacing = shotSpacing(project.comp)
  project.shots = [
    createShot('Cảnh 1', [0, 0, 0], 0),
    createShot('Cảnh 2', [spacing, 0, 0], 1),
    createShot('Cảnh 3', [spacing * 2, 0, 0], 2)
  ]
  return project
}

describe('animateCameraMath inter-shot transition & route ordering', () => {
  it('interpolates monotonically between Shot 1 and Shot 2 without looping across the 2D stage', () => {
    const project = makeThreeShotProject()
    const layout = computeShotStageLayout(project, 0)
    expect(layout.length).toBe(3)

    const shot1 = layout[0]
    const shot2 = layout[1]

    applyStageFrameToDraft(project, layout, 0, shot1.stageX, shot1.stageY, 1.0, true)
    applyStageFrameToDraft(project, layout, 4, shot1.stageX, shot1.stageY, 0.58, true)
    applyStageFrameToDraft(project, layout, 6, shot2.stageX, shot2.stageY, 1.0, true)

    const frames = extractCameraFrames2D(project, layout)
    let prevX = shot1.stageX
    for (const t of [4.0, 4.4, 4.8, 5.0, 5.2, 5.6, 6.0]) {
      const live = evaluateLiveCameraFrame2D(project, layout, frames, t)
      expect(live.stageX).toBeGreaterThanOrEqual(prevX - 2)
      expect(live.stageX).toBeLessThanOrEqual(shot2.stageX + 2)
      prevX = live.stageX
    }

    // Midpoint 3D pose between Shot 1 and Shot 2 also maps to the midpoint between Shot 1 and Shot 2 on the 2D stage
    const mid3DX = (shot1.worldOrigin[0] + shot2.worldOrigin[0]) / 2
    const midMapped = pose3DToStageFrame(
      project,
      layout,
      [mid3DX, 0, -1484],
      [mid3DX, 0, 0],
      0
    )
    const expectedMidStageX = Math.round((shot1.stageX + shot2.stageX) / 2)
    expect(Math.abs(midMapped.stageX - expectedMidStageX)).toBeLessThanOrEqual(4)
  })

  it('shifts subsequent camera keyframes forward when inserting a new waypoint in the middle', () => {
    const project = makeThreeShotProject()
    const layout = computeShotStageLayout(project, 0)

    applyStageFrameToDraft(project, layout, 0, layout[0].stageX, layout[0].stageY, 1.0, true)
    applyStageFrameToDraft(project, layout, 4, layout[1].stageX, layout[1].stageY, 1.0, true)

    shiftSubsequentCameraKeyframes(project, 0, 2.0)
    expect(project.camera.position.keyframes.map((k) => k.t)).toEqual([0, 6])
    expect(project.camera.target.keyframes.map((k) => k.t)).toEqual([0, 6])
  })

  it('supports all 20 professional camera action modes and preserves their classification', () => {
    const project = makeThreeShotProject()
    const layout = computeShotStageLayout(project, 0)
    applyStageFrameToDraft(project, layout, 0, layout[0].stageX, layout[0].stageY, 1.0, true)
    applyStageFrameToDraft(project, layout, 2, layout[0].stageX, layout[0].stageY, 1.0, true)

    expect(CAMERA_ACTION_MODES.length).toBe(20)
    for (const def of CAMERA_ACTION_MODES) {
      applyWaypointActionMode(project, layout, 2, def.id)
      const waypoints = enrichCameraWaypoints(extractCameraFrames2D(project, layout))
      const wp = waypoints.find((w) => Math.abs(w.time - 2) < 0.05)
      expect(wp).toBeDefined()
      expect(wp?.actionMode).toBe(def.id)
      expect(wp?.tagLabel).toBe(def.badgeLabel)
    }
  })

  it('applies the 4 new professional full-route presets across shots cleanly', () => {
    const project = makeThreeShotProject()
    const layout = computeShotStageLayout(project, 0)

    for (const preset of [
      'hero-crane-epic',
      'whip-action-rush',
      'aerial-drone-sweep',
      'dramatic-story-reveal'
    ] as const) {
      applyCameraRoutePreset(project, layout, preset)
      const waypoints = enrichCameraWaypoints(extractCameraFrames2D(project, layout))
      expect(waypoints.length).toBeGreaterThanOrEqual(6)
    }
  })

  it('supports extreme zoom magnification up to 2000% (scale = 0.05) and synchronizes 3D optical FOV with 2D filmstrip', () => {
    const project = makeThreeShotProject()
    const layout = computeShotStageLayout(project, 0)
    applyStageFrameToDraft(project, layout, 0, layout[2].stageX, layout[2].stageY, 0.05, true)
    const waypoints = enrichCameraWaypoints(extractCameraFrames2D(project, layout))
    expect(waypoints[0].scale).toBeCloseTo(0.05, 2)
    expect(waypoints[0].zoomPct).toBe(2000)

    const evCam = evaluateCamera(project, 0)
    const cam3d = new THREE.PerspectiveCamera()
    applyEvaluatedCamera(cam3d, evCam, 16 / 9)

    // Physical camera remains at reference distance (~1483.64) in front of z=0 so multi-depth layers (z=-130..+1650)
    // are never clipped and all scale uniformly by ~20x via optical FOV narrowing.
    expect(cam3d.position.z).toBeCloseTo(evCam.refDistance!, 1)
    const tanRatio = Math.tan((cam3d.fov * Math.PI) / 360) / Math.tan((40 * Math.PI) / 360)
    expect(tanRatio).toBeCloseTo(waypoints[0].scale, 3)
  })
})
