import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { Face3D } from './types'
import { joinFaces, joinPointsUV } from './assemblyJoin'
import { faceMatrix } from './assemblyGeometry'
import { applyClipSuggestions, faceClipPlanes, faceClipRules, hiddenImagePolygon, pruneClipRefs, suggestClipRules } from './assemblyClip'
import { applySunPreset, normalizeLighting, resolveLightRig, sunDirection } from './assemblyLighting'

const face = (id: string, over: Partial<Face3D> = {}): Face3D => ({
  id, name: id, width: 400, height: 300, position: [0, 0, 0], rotation: [0, 0, 0], ...over
})

/** World (three space) position of a UV point on a face. */
const worldAt = (f: Face3D, u: number, v: number): THREE.Vector3 =>
  new THREE.Vector3((u - 0.5) * f.width, (v - 0.5) * f.height, 0).applyMatrix4(faceMatrix(f))

describe('assemblyJoin', () => {
  it('uses opaque bounds for edge start/end points', () => {
    const f = face('a')
    expect(joinPointsUV(f, 'left', [0.1, 0.2, 0.9, 0.8])).toEqual([[0.1, 0.8], [0.1, 0.2]])
    expect(joinPointsUV(f, 'right')).toEqual([[1, 1], [1, 0]])
    expect(joinPointsUV({ ...f, joinPoints: [[0.3, 0.9], [0.3, 0.1]] }, 'points')).toEqual([[0.3, 0.9], [0.3, 0.1]])
  })

  it('snaps the source right edge onto the target left edge with a 90° fold', () => {
    const front = face('front')
    const side = face('side', { width: 300, height: 150, position: [900, 400, 100], rotation: [10, 20, 30] })
    const res = joinFaces([front, side], { targetId: 'front', sourceId: 'side', targetEdge: 'left', sourceEdge: 'right' })
    const moved = res.faces.find((f) => f.id === 'side')!
    // Shorter source grows to the target edge length (300 / 150 = 2).
    expect(res.scaledFaceId).toBe('side')
    expect(moved.height).toBeCloseTo(300, 1)
    // Seam endpoints coincide.
    expect(worldAt(moved, 1, 1).distanceTo(worldAt(front, 0, 1))).toBeLessThan(0.5)
    expect(worldAt(moved, 1, 0).distanceTo(worldAt(front, 0, 0))).toBeLessThan(0.5)
    // Folded behind the front face (depth grows away from the viewer) and perpendicular.
    expect(moved.position[2]).toBeGreaterThan(0)
    const nFront = new THREE.Vector3(0, 0, 1).transformDirection(faceMatrix(front))
    const nSide = new THREE.Vector3(0, 0, 1).transformDirection(faceMatrix(moved))
    expect(Math.abs(nFront.dot(nSide))).toBeLessThan(1e-3)
    // Outward facing: the left wall looks to the left.
    expect(nSide.x).toBeLessThan(-0.99)
  })

  it('grows the target when its segment is the shorter one', () => {
    const a = face('a', { height: 100 })
    const b = face('b', { height: 400 })
    const res = joinFaces([a, b], { targetId: 'a', sourceId: 'b', targetEdge: 'right', sourceEdge: 'left', angle: 0 })
    expect(res.scaledFaceId).toBe('a')
    const a2 = res.faces.find((f) => f.id === 'a')!
    const b2 = res.faces.find((f) => f.id === 'b')!
    expect(a2.height).toBeCloseTo(400, 1)
    expect(worldAt(b2, 0, 1).distanceTo(worldAt(a2, 1, 1))).toBeLessThan(0.5)
    // angle 0 continues the plane to the right.
    expect(b2.position[0]).toBeGreaterThan(a2.position[0])
    expect(Math.abs(b2.position[2])).toBeLessThan(0.5)
  })

  it('rejects joining a face with itself', () => {
    expect(() => joinFaces([face('a')], { targetId: 'a', sourceId: 'a', targetEdge: 'left', sourceEdge: 'right' })).toThrow()
  })
})

describe('assemblyClip', () => {
  // Gable wall (front, vertical) poking above a roof slope tilted 45° over it.
  const wall = face('wall', { width: 400, height: 400, position: [0, 0, 0] })
  const roof = face('roof', { width: 500, height: 600, position: [0, 150, 0], rotation: [-60, 0, 0] })

  it('hides the smaller part of a face on the far side of the clipper plane', () => {
    const rules = faceClipRules({ ...wall, clipBy: ['roof'] }, [wall, roof])
    expect(rules).toHaveLength(1)
    const planes = faceClipPlanes({ ...wall, clipBy: ['roof'] }, [wall, roof], 1)
    // Wall bottom stays, wall top corner is clipped.
    expect(planes[0].distanceToPoint(new THREE.Vector3(0, -190, 0))).toBeGreaterThan(0)
    expect(planes[0].distanceToPoint(new THREE.Vector3(0, 199, 0))).toBeLessThan(0)
  })

  it('bakes the hidden half-plane into image pixels', () => {
    const [rule] = faceClipRules({ ...wall, clipBy: ['roof'] }, [wall, roof])
    const poly = hiddenImagePolygon(wall, rule, 100, 100)!
    expect(poly.length).toBeGreaterThanOrEqual(3)
    // Hidden region touches the top of the image only.
    expect(Math.min(...poly.map((p) => p[1]))).toBe(0)
    expect(Math.max(...poly.map((p) => p[1]))).toBeLessThan(60)
  })

  it('suggests the roof as clipper of the wall, not the other way round', () => {
    const s = suggestClipRules([wall, roof])
    expect(s.some((x) => x.faceId === 'wall' && x.clipperId === 'roof')).toBe(true)
    expect(s.some((x) => x.faceId === 'roof' && x.clipperId === 'wall')).toBe(false)
    const applied = applyClipSuggestions([wall, roof], s)
    expect(applied[0].clipBy).toEqual(['roof'])
    expect(pruneClipRefs([applied[0]])[0].clipBy).toBeUndefined()
  })
})

describe('assemblyLighting', () => {
  it('normalizes missing lighting to defaults and clamps values', () => {
    const l = normalizeLighting({ elevation: 500, intensity: 9 })
    expect(l.elevation).toBe(89)
    expect(l.intensity).toBe(2)
    expect(l.sun).toBe(true)
  })

  it('warms the sun near the horizon in auto mode', () => {
    const low = resolveLightRig({ sun: true, elevation: 5, preset: 'auto' })
    const high = resolveLightRig({ sun: true, elevation: 80, preset: 'auto' })
    const red = (hex: string) => parseInt(hex.slice(1, 3), 16) - parseInt(hex.slice(5, 7), 16)
    expect(red(low.sunColor)).toBeGreaterThan(red(high.sunColor))
  })

  it('studio rig without sun casts no shadows; presets set angles', () => {
    expect(resolveLightRig({ sun: false, shadows: true }).shadows).toBe(false)
    const sunset = applySunPreset(normalizeLighting(null), 'sunset')
    expect(sunset.elevation).toBeLessThan(15)
    const [x, y, z] = sunDirection(90, 0)
    expect(x).toBeGreaterThan(0.99)
    expect(Math.abs(z)).toBeLessThan(1e-6)
    expect(y).toBeGreaterThan(0)
  })
})
