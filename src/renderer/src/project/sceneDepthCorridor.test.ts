import { describe, expect, it } from 'vitest'
import { evaluate } from '../animation/keyframes'
import { referenceDistance } from '../animation/math'
import { choreographCinematicCameraRoute } from '../animation/cinematicCameraRoute'
import { createImageLayer, createProject, createShot } from './factory'
import {
  analyzeImageDepthCorridorFromRgba,
  evaluatePerspectiveCorridorAt,
  hyperbolicDepthScreenProgress,
  projectCorridorFootToWorld
} from './sceneDepthCorridor'
import { bakeBboxTargetMotionToScene } from './workflowV2BboxMotionAndCollision'

describe('sceneDepthCorridor & cinematicCameraRoute', () => {
  it('detects receding alley vanishing point and narrowing walkable corridor from pixel luminance', () => {
    const w = 160
    const h = 90
    const rgba = new Uint8Array(w * h * 4)
    const vx = 0.44
    const vy = 0.44
    for (let y = 0; y < h; y++) {
      const uvY = y / h
      const depthRatio = Math.max(0, Math.min(1, (0.92 - uvY) / (0.92 - vy)))
      const cx = 0.5 * (1 - depthRatio) + vx * depthRatio
      const halfW = 0.34 * (1 - depthRatio * 0.84) + 0.03
      for (let x = 0; x < w; x++) {
        const uvX = x / w
        const isSky = uvY < vy
        const isAlley = !isSky && Math.abs(uvX - cx) <= halfW
        const lum = isSky ? 92 : isAlley ? 188 : 34
        const i = (y * w + x) * 4
        rgba[i] = lum
        rgba[i + 1] = lum
        rgba[i + 2] = lum
        rgba[i + 3] = 255
      }
    }

    const res = analyzeImageDepthCorridorFromRgba(rgba, w, h, { width: 1920, height: 1080 })
    expect(res.corridorType).toBe('receding_alley')
    expect(res.widthNarrowingRatio).toBeGreaterThan(2.6)
    expect(res.vanishingPointUV[1]).toBeGreaterThan(0.35)
    expect(res.vanishingPointUV[1]).toBeLessThan(0.56)
    expect(res.corridorSpine.length).toBeGreaterThanOrEqual(6)
    const near = res.corridorSpine[0]
    const far = res.corridorSpine[res.corridorSpine.length - 1]
    expect(far.recommendedZ).toBeGreaterThan(near.recommendedZ + 300)
    expect(far.apparentScaleRatio).toBeLessThan(0.45)
  })

  it('inverts PerspectiveCamera projection so world pose keeps feet pinned to corridor screen coordinates', () => {
    const comp = { width: 1920, height: 1080 }
    const refD = referenceDistance(comp)
    const footOff = 175
    const poseFar = projectCorridorFootToWorld(comp, -135, 38, 960, 0.34, footOff)
    const projFar = refD / (poseFar.z + refD)
    expect(poseFar.x * projFar).toBeCloseTo(-135, 1)
    expect(poseFar.y * projFar - footOff * (poseFar.scaleRatio * projFar)).toBeCloseTo(38, 1)
    expect(poseFar.scaleRatio * projFar).toBeCloseTo(0.34, 2)

    const midProgress = hyperbolicDepthScreenProgress(0.5, 960, 110, comp)
    expect(midProgress).toBeLessThan(0.45) // Hyperbolic 1/(Z+d): slower apparent progress when deep in alley
  })

  it('bakes 15 perspective-corridor keyframes in bakeBboxTargetMotionToScene with hyperbolic Z scaling', () => {
    const project = createProject()
    const shot = createShot('Đèo Sương', [0, 0, 0], 0)
    project.shots.push(shot)
    const asset = {
      id: 'hero-a',
      name: 'Hero',
      kind: 'image' as const,
      mime: 'image/png',
      width: 240,
      height: 420
    }
    project.assets.push(asset)
    const layer = createImageLayer(asset, project.comp, 920, shot.id)
    layer.autoScale = false
    const startWorld = projectCorridorFootToWorld(project.comp, -120, 40, 920, 0.34, 150)
    const endWorld = projectCorridorFootToWorld(project.comp, -80, -300, 120, 0.86, 150)
    layer.transform.position.value = [startWorld.x, startWorld.y, startWorld.z]
    layer.transform.scale.value = [startWorld.scaleRatio, startWorld.scaleRatio, 1]
    project.layers.push(layer)

    bakeBboxTargetMotionToScene(
      project,
      [layer.id],
      {
        motionMode: 'bbox',
        bboxPathType: 'shortest',
        depthMode: 'depth_corridor',
        bboxStartZ: startWorld.z,
        bboxTargetX: endWorld.x,
        bboxTargetY: endWorld.y,
        bboxTargetZ: endWorld.z,
        bboxTargetScalePct: Math.round((endWorld.scaleRatio / startWorld.scaleRatio) * 100),
        corridorWaypoints: [
          [-120, 40],
          [-155, -85],
          [-65, -195],
          [-80, -300]
        ],
        corridorFootOffsetY: 150,
        timeStart: 0,
        timeEnd: 4
      },
      'corridor-test'
    )

    expect(layer.transform.position.keyframes.length).toBe(15)
    const posMid = evaluate(layer.transform.position, 2.0)
    expect(posMid[2]).toBeCloseTo(520, 0)
    const midSample = evaluatePerspectiveCorridorAt({
      comp: project.comp,
      startPos: [startWorld.x, startWorld.y, startWorld.z],
      targetX: endWorld.x,
      targetY: endWorld.y,
      startZ: startWorld.z,
      targetZ: endWorld.z,
      baseWorldScale: startWorld.scaleRatio,
      targetScaleRatio: endWorld.scaleRatio / startWorld.scaleRatio,
      u: 0.5,
      corridorWaypoints: [
        [-120, 40],
        [-155, -85],
        [-65, -195],
        [-80, -300]
      ],
      footOffsetY: 150
    })
    expect(posMid[0]).toBeCloseTo(midSample.x, 0)
  })

  it('choreographs multi-beat camera route with subject tracking, punch-zoom hitstop, and match-cut', () => {
    const project = createProject()
    const s1 = createShot('Cảnh 1', [0, 0, 0], 0)
    const s2 = createShot('Cảnh 2', [4000, 0, 0], 1)
    project.shots.push(s1, s2)
    const asset = { id: 'a1', name: 'A', kind: 'image' as const, mime: 'image/png', width: 200, height: 300 }
    project.assets.push(asset)
    const hero = createImageLayer(asset, project.comp, 200, s1.id)
    hero.transform.position.keyframes = [
      { id: 'k0', t: 0, value: [-300, -80, 700], ease: 'linear' },
      { id: 'k1', t: 4, value: [80, -160, 140], ease: 'linear' }
    ]
    project.layers.push(hero)

    const res = choreographCinematicCameraRoute(project, [
      { shotId: s1.id, kind: 'track_subject', start: 0, end: 4, subjectId: hero.id, cutAtEnd: true },
      {
        shotId: s2.id,
        kind: 'punch_zoom',
        start: 4,
        end: 8,
        impactRatio: 0.4,
        impactScale: 0.66,
        hitstopSec: 0.14,
        rollImpact: -2.8
      }
    ])

    expect(res.beatsApplied).toBe(2)
    expect(res.keyframeCount).toBeGreaterThanOrEqual(8)
    const preCut = project.camera.position.keyframes.find((k) => Math.abs(k.t - 3.996) < 0.01)
    expect(preCut?.ease).toBe('hold')
    const impactFov = evaluate(project.camera.fov, 5.6)
    expect(impactFov).toBeLessThan(37)
  })
})
