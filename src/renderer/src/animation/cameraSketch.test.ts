import { describe, expect, it } from 'vitest'
import { createProject, createShot } from '../project/factory'
import {
  applyDrawnCameraPath,
  getScene2DBounds,
  simplifyPoints,
  type Point2D
} from './cameraSketch'

describe('cameraSketch algorithms', () => {
  it('simplifies dense raw points into essential waypoints', () => {
    // A straight line with 10 collinear points
    const linePoints: Point2D[] = []
    for (let i = 0; i <= 10; i++) {
      linePoints.push({ x: i * 100, z: 0 })
    }
    const simplified = simplifyPoints(linePoints, 50)
    // RDP should reduce straight collinear line to endpoints (or minimum 3 points)
    expect(simplified.length).toBeLessThanOrEqual(3)
    expect(simplified[0]).toEqual({ x: 0, z: 0 })
    expect(simplified[simplified.length - 1]).toEqual({ x: 1000, z: 0 })
  })

  it('preserves sharp corners in curved paths', () => {
    const lPath: Point2D[] = [
      { x: 0, z: 0 },
      { x: 500, z: 0 },
      { x: 500, z: 500 }
    ]
    const simplified = simplifyPoints(lPath, 30)
    expect(simplified.length).toBe(3)
    expect(simplified[1]).toEqual({ x: 500, z: 0 })
  })

  it('calculates 2D bounds of scene with shots and camera', () => {
    const project = createProject()
    project.shots.push(createShot('Shot 1', [-1000, 0, 500], 0))
    project.shots.push(createShot('Shot 2', [1500, 0, 2000], 1))

    const bounds = getScene2DBounds(project)
    expect(bounds.minX).toBeLessThan(-1000)
    expect(bounds.maxX).toBeGreaterThan(1500)
    expect(bounds.minZ).toBeLessThan(0)
    expect(bounds.maxZ).toBeGreaterThan(2000)
  })

  it('generates 3D camera keyframes from 2D points', () => {
    const project = createProject()
    project.shots.push(createShot('Shot 1', [0, 0, 0], 0))
    project.shots.push(createShot('Shot 2', [1000, 0, 1000], 1))

    const rawPoints: Point2D[] = [
      { x: 0, z: -1200 },
      { x: 0, z: 0 },
      { x: 500, z: 500 },
      { x: 1000, z: 1000 }
    ]

    const res = applyDrawnCameraPath(project, rawPoints, {
      duration: 10,
      heightY: 100,
      lookMode: 'blend'
    })

    expect(res.keyframeCount).toBeGreaterThanOrEqual(3)
    expect(res.duration).toBe(10)

    const cam = project.camera
    expect(cam.position.keyframes.length).toBe(res.keyframeCount)
    expect(cam.target.keyframes.length).toBe(res.keyframeCount)
    expect(cam.focusDistance.keyframes.length).toBe(res.keyframeCount)

    // Check first keyframe time and position
    expect(cam.position.keyframes[0].t).toBe(0)
    expect(cam.position.keyframes[0].value[1]).toBe(100) // height Y
    expect(cam.position.keyframes[cam.position.keyframes.length - 1].t).toBe(10)
  })

  it('supports forward lookMode (look along path tangent)', () => {
    const project = createProject()
    const rawPoints: Point2D[] = [
      { x: 0, z: 0 },
      { x: 1000, z: 0 }
    ]

    applyDrawnCameraPath(project, rawPoints, {
      duration: 5,
      lookMode: 'forward'
    })

    const cam = project.camera
    // When moving along +X, target should be ahead on +X
    const firstPos = cam.position.keyframes[0].value
    const firstTgt = cam.target.keyframes[0].value
    expect(firstTgt[0]).toBeGreaterThan(firstPos[0])
  })
})
