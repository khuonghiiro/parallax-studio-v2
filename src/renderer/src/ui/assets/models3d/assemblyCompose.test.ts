import { describe, expect, it } from 'vitest'
import type { Face3D, Model3D } from './types'
import { appendModel, appendModelOnFace } from './assemblyCompose'
import { modelBounds } from './assemblyGeometry'

const face = (id: string, extra: Partial<Face3D> = {}): Face3D => ({
  id,
  name: id,
  width: 100,
  height: 100,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  ...extra
})

const model = (faces: Face3D[], extra: Partial<Model3D> = {}): Model3D => ({
  id: 'm',
  name: 'Cửa sổ',
  category: 'decor',
  scale: 1,
  faces,
  ...extra
})

/** A wall part: back plane on z = 0, frame sticking out 10 toward the viewer, clipped by the back. */
const windowPart = (): Model3D =>
  model([
    face('back', { width: 60, height: 80 }),
    face('frame', { width: 70, height: 90, position: [0, 0, -10], clipBy: ['back'] })
  ])

describe('appendModel', () => {
  it('places the part to the right of the target, bottoms aligned', () => {
    const target = { scale: 1, faces: [face('wall', { width: 200, height: 160 })] }
    const { faces, addedIds } = appendModel(windowPart(), target, { gap: 20 })
    expect(faces).toHaveLength(3)
    expect(addedIds).toHaveLength(2)
    const added = modelBounds(faces.filter((f) => addedIds.includes(f.id)))!
    expect(added.min[0]).toBeCloseTo(100 + 20)
    expect(added.min[1]).toBeCloseTo(-80)
  })

  it('regenerates ids, remaps clipBy and prefixes names', () => {
    const part = windowPart()
    const { faces, addedIds } = appendModel(part, { scale: 1, faces: [] }, { at: [0, 0, 0] })
    const [back, frame] = faces
    expect(addedIds).toEqual([back.id, frame.id])
    expect(back.id).not.toBe('back')
    expect(frame.clipBy).toEqual([back.id])
    expect(back.name).toBe('Cửa sổ · back')
    const again = appendModel(part, { scale: 1, faces }, { at: [0, 0, 0], prefixNames: false })
    expect(new Set(again.faces.map((f) => f.id)).size).toBe(4)
    expect(again.faces[2].name).toBe('back')
  })

  it('moves the part origin to `at` and matches model scales', () => {
    const part = model([face('a', { position: [10, 0, -10] })], { scale: 2 })
    const { faces } = appendModel(part, { scale: 1, faces: [] }, { at: [50, 20, 0], scale: 0.5 })
    // k = (2 / 1) * 0.5 = 1 → sizes unchanged, origin moved to `at`.
    expect(faces[0].width).toBe(100)
    expect(faces[0].position).toEqual([60, 20, -10])
    const doubled = appendModel(part, { scale: 1, faces: [] }, { at: [0, 0, 0] })
    expect(doubled.faces[0].width).toBe(200)
    expect(doubled.faces[0].position).toEqual([20, 0, -20])
  })

  it('returns the target untouched for an empty part', () => {
    const target = { scale: 1, faces: [face('wall')] }
    expect(appendModel(model([]), target).addedIds).toEqual([])
  })
})

describe('appendModelOnFace', () => {
  it('mounts on a front wall at the requested uv, protruding toward the viewer', () => {
    const host = face('wall', { width: 200, height: 100, position: [0, 0, 50] })
    const { faces, addedIds } = appendModelOnFace(windowPart(), { scale: 1, faces: [host] }, host, { uv: [0.75, 0.5] })
    const [back, frame] = faces.filter((f) => addedIds.includes(f.id))
    expect(back.position[0]).toBeCloseTo(50)
    expect(back.position[2]).toBeCloseTo(50)
    expect(frame.position[2]).toBeCloseTo(40)
    expect(frame.rotation.map((r) => Math.abs(r) < 1e-6 ? 0 : r)).toEqual([0, 0, 0])
  })

  it('follows a rotated host face (left wall facing -x)', () => {
    const host = face('left', { width: 120, height: 100, position: [-100, 0, 0], rotation: [0, 90, 0] })
    const { faces, addedIds } = appendModelOnFace(windowPart(), { scale: 1, faces: [host] }, host)
    const frame = faces.find((f) => f.id === addedIds[1])!
    expect(frame.position[0]).toBeCloseTo(-110)
    expect(frame.position[2]).toBeCloseTo(0)
    expect(frame.rotation[1]).toBeCloseTo(90)
  })

  it('clamps uv to the face and scales the part to the target', () => {
    const host = face('wall', { width: 200, height: 100 })
    const part = model([face('a')], { scale: 1 })
    const { faces } = appendModelOnFace(part, { scale: 2, faces: [host] }, host, { uv: [2, -1] })
    const added = faces[1]
    expect(added.width).toBe(50)
    expect(added.position[0]).toBeCloseTo(100)
    expect(added.position[1]).toBeCloseTo(-50)
  })
})
