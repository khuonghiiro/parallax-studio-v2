import { describe, expect, it } from 'vitest'
import { evaluate } from './keyframes'
import { choreographCinematicCameraRoute } from './cinematicCameraRoute'
import { createProject, createShot } from '../project/factory'
import { computeShotStageLayout, extractCameraFrames2D } from '../ui/viewer/animateCamera/animateCameraMath'
import { enrichCameraWaypoints } from '../ui/viewer/animateCamera/animateCameraRouteLogic'

describe('choreographCinematicCameraRoute — diverse 3D anime camera moves & smooth transitions', () => {
  it('generates rich CameraActionMode waypoints and silky camera.fade transitions across 4 shots', () => {
    const project = createProject()
    const s1 = createShot('Cảnh 1', [0, 0, 0], 0)
    const s2 = createShot('Cảnh 2', [10560, 0, 0], 1)
    const s3 = createShot('Cảnh 3', [21120, 0, 0], 2)
    const s4 = createShot('Cảnh 4', [31680, 0, 0], 3)
    project.shots.push(s1, s2, s3, s4)

    const res = choreographCinematicCameraRoute(project, [
      { shotId: s1.id, kind: 'crane_descent', start: 0, end: 2.8 },
      { shotId: s1.id, kind: 'whip_pan', start: 2.9, end: 4.5, transitionAtEnd: 'whip_glide' },
      { shotId: s2.id, kind: 'orbit_parallax', start: 4.5, end: 9.0, transitionAtEnd: 'silk_fade' },
      { shotId: s3.id, kind: 'punch_zoom', start: 9.0, end: 13.5, transitionAtEnd: 'flash_dissolve' },
      { shotId: s4.id, kind: 'hero_low_ascent', start: 13.5, end: 16.0 },
      { shotId: s4.id, kind: 'corkscrew_reveal', start: 16.2, end: 18.0 }
    ])

    expect(res.beatsApplied).toBe(6)
    expect(res.transitionsApplied).toBe(3)
    expect(res.endTime).toBe(18)

    // Smooth optical fade envelopes peak right on cross-shot boundaries and clear inside shots
    expect(evaluate(project.camera.fade, 1.5)).toBeCloseTo(0, 2)
    expect(evaluate(project.camera.fade, 4.5)).toBeGreaterThan(0.5)
    expect(evaluate(project.camera.fade, 9.0)).toBeGreaterThan(0.8)
    expect(evaluate(project.camera.fade, 13.5)).toBeGreaterThan(0.85)
    expect(evaluate(project.camera.fade, 15.0)).toBeCloseTo(0, 2)

    // CameraRouteInspector enrichment preserves distinct shots and diverse 3D action badges
    const layout = computeShotStageLayout(project)
    const frames = extractCameraFrames2D(project, layout)
    const waypoints = enrichCameraWaypoints(frames)

    expect(waypoints.length).toBeGreaterThanOrEqual(12)
    const modes = new Set(waypoints.map((w) => w.actionMode))
    expect(modes.has('crane-up')).toBe(true)
    expect(modes.has('crane-down')).toBe(true)
    expect(modes.has('whip-pan')).toBe(true)
    expect(modes.has('orbit-right')).toBe(true)
    expect(modes.has('extreme-closeup')).toBe(true)
    expect(modes.has('hero-low')).toBe(true)
    expect(modes.has('pull-out')).toBe(true)
    expect(modes.size).toBeGreaterThanOrEqual(7)
  })
})
