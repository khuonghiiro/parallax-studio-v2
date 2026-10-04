import { describe, expect, it } from 'vitest'
import type { Project, Vec3 } from '@shared/types'
import { buildCameraPath, shotAtTime } from '../animation/cameraPath'
import { evaluate } from '../animation/keyframes'
import { referenceDistance } from '../animation/math'
import { evaluateCamera, evaluateScene, shotFramingPose } from '../engine/evaluateScene'
import { probeImageSize } from './assets'
import { createProject, createShot, createTextLayer, migrateProject, shotSpacing } from './factory'

function twoShots(): Project {
  const p = createProject({ duration: 10 })
  const sp = shotSpacing(p.comp)
  p.shots.push(createShot('A', [0, 0, 0], 0), createShot('B', [sp, 0, 0], 1))
  return p
}

const near = (a: Vec3, b: Vec3, eps = 1): boolean => a.every((v, i) => Math.abs(v - b[i]) <= eps)

describe('migrateProject', () => {
  it('upgrades a v1 project: no shots, global layers, camera fade', () => {
    const p = createProject() as unknown as Record<string, unknown>
    const layer = createTextLayer(createProject().comp, 'x') as unknown as Record<string, unknown>
    delete layer.shotId
    const cam = p.camera as Record<string, unknown>
    delete cam.fade
    delete p.shots
    const v1 = { ...p, version: 1, layers: [layer] }
    const m = migrateProject(JSON.parse(JSON.stringify(v1)))
    expect(m.version).toBe(2)
    expect(m.shots).toEqual([])
    expect(m.layers[0].shotId).toBeNull()
    expect(m.camera.fade.value).toBe(0)
  })

  it('rejects newer versions and garbage', () => {
    expect(() => migrateProject({ version: 3, layers: [] })).toThrow()
    expect(() => migrateProject({ foo: 1 })).toThrow()
  })
})

describe('shots × layers', () => {
  it('layer positions are local to their shot', () => {
    const p = twoShots()
    const l = createTextLayer(p.comp, 'hi')
    l.shotId = p.shots[1].id
    l.transform.position.value = [100, 50, 700]
    p.layers.push(l)
    const ev = evaluateScene(p, 0)
    const el = ev.layers.find((x) => x.layer.id === l.id)!
    expect(el.position).toEqual([100, 50, 700])
    expect(near(el.worldPosition, [shotSpacing(p.comp) + 100, 50, 700])).toBe(true)
  })

  it('a shot yawed 90° maps local x onto the depth axis', () => {
    const p = twoShots()
    p.shots[0].rotation.value = [0, 90, 0]
    const l = createTextLayer(p.comp, 'hi')
    l.shotId = p.shots[0].id
    l.transform.position.value = [100, 0, 0]
    p.layers.push(l)
    const w = evaluateScene(p, 0).layers.find((x) => x.layer.id === l.id)!.worldPosition
    expect(Math.abs(w[0])).toBeLessThan(1)
    expect(Math.abs(Math.abs(w[2]) - 100)).toBeLessThan(1)
  })

  it('framing pose looks at the shot origin from referenceDistance', () => {
    const p = twoShots()
    const pose = shotFramingPose(p, p.shots[1], 0)
    const sp = shotSpacing(p.comp)
    expect(near(pose.target, [sp, 0, 0])).toBe(true)
    expect(near(pose.position, [sp, 0, -referenceDistance(p.comp)])).toBe(true)
  })
})

describe('buildCameraPath', () => {
  it('fly: hold → transition → hold, ends at the right time', () => {
    const p = twoShots()
    const [a, b] = p.shots
    const end = buildCameraPath(p, [
      { shotId: a.id, hold: 2, type: 'fly', transition: 1 },
      { shotId: b.id, hold: 2, type: 'cut', transition: 0 }
    ])
    expect(end).toBeCloseTo(5)
    expect(near(evaluateCamera(p, 0.5).target, [0, 0, 0])).toBe(true)
    expect(near(evaluateCamera(p, 4).target, [shotSpacing(p.comp), 0, 0])).toBe(true)
    expect(shotAtTime(p, 1)).toBe(a.id)
    expect(shotAtTime(p, 4)).toBe(b.id)
  })

  it('cut: switches instantly with no travel time', () => {
    const p = twoShots()
    const [a, b] = p.shots
    const end = buildCameraPath(p, [
      { shotId: a.id, hold: 2, type: 'cut', transition: 5 },
      { shotId: b.id, hold: 2, type: 'cut', transition: 0 }
    ])
    expect(end).toBeCloseTo(4)
    expect(shotAtTime(p, 1.99)).toBe(a.id)
    expect(shotAtTime(p, 2.02)).toBe(b.id)
  })

  it('fade: goes to black halfway and lands on the next shot', () => {
    const p = twoShots()
    const [a, b] = p.shots
    const end = buildCameraPath(p, [
      { shotId: a.id, hold: 2, type: 'fade', transition: 1 },
      { shotId: b.id, hold: 2, type: 'cut', transition: 0 }
    ])
    expect(end).toBeCloseTo(5)
    expect(evaluate(p.camera.fade, 2.5)).toBeCloseTo(1, 2)
    expect(evaluate(p.camera.fade, 1)).toBe(0)
    expect(evaluate(p.camera.fade, 3.5)).toBe(0)
    expect(shotAtTime(p, 2.5)).toBeNull()
    expect(shotAtTime(p, 3.2)).toBe(b.id)
  })

  it('unknown shot ids throw', () => {
    const p = twoShots()
    expect(() => buildCameraPath(p, [{ shotId: 'nope', hold: 1, type: 'fly', transition: 1 }])).toThrow()
  })
})

describe('probeImageSize', () => {
  it('reads PNG dimensions from the header', () => {
    const b = new Uint8Array(32)
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const dv = new DataView(b.buffer)
    dv.setUint32(16, 3840)
    dv.setUint32(20, 2160)
    expect(probeImageSize(b)).toEqual([3840, 2160])
  })

  it('reads GIF dimensions and rejects unknown data', () => {
    const g = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x40, 0x01, 0xf0, 0x00])
    expect(probeImageSize(g)).toEqual([320, 240])
    expect(probeImageSize(new Uint8Array([1, 2, 3, 4]))).toBeNull()
  })
})
