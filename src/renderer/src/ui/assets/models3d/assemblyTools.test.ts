import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { Face3D } from './types'
import { faceQuaternion, foldFromEdge, modelBounds, poseFromFrame } from './assemblyGeometry'
import { ASSEMBLY_TEMPLATES, appendTemplate, findTemplate, replaceWithTemplate, templateFaces, templatePreview } from './assemblyTemplates'
import { addFoldedFace, centerFaces, deleteFace, duplicateFace, nudgeFace, reorderFace, toggleFaceFlag, aspectHeight } from './assemblyFaceOps'
import { faceGeometrySignature } from './assemblyMeshFactory'

const face = (id: string, extra: Partial<Face3D> = {}): Face3D => ({
  id,
  name: id,
  width: 200,
  height: 100,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  ...extra
})

const normalOf = (rotation: [number, number, number]): THREE.Vector3 =>
  new THREE.Vector3(0, 0, 1).applyQuaternion(faceQuaternion(rotation))

describe('assemblyGeometry', () => {
  it('poseFromFrame maps standard normals to the expected rotations', () => {
    expect(poseFromFrame([0, 0, 0], [0, 0, -1]).rotation).toEqual([0, 0, 0])
    expect(poseFromFrame([0, 0, 0], [-1, 0, 0]).rotation).toEqual([0, 90, 0])
    const floor = poseFromFrame([0, -50, 0], [0, 1, 0])
    const n = normalOf(floor.rotation)
    expect(n.y).toBeCloseTo(1, 5)
  })

  it('foldFromEdge hinges a new plane on the top edge, folded behind the face', () => {
    const pose = foldFromEdge(face('front'), 'top')
    expect(pose.width).toBe(200)
    expect(pose.height).toBe(100)
    expect(pose.position).toEqual([0, 50, 50])
    expect(normalOf(pose.rotation).y).toBeCloseTo(1, 5)
  })

  it('modelBounds covers every corner of every face', () => {
    const b = modelBounds([face('a'), face('b', { position: [300, 0, 0] })])!
    expect(b.min[0]).toBeCloseTo(-100)
    expect(b.max[0]).toBeCloseTo(400)
    expect(b.size[1]).toBeCloseTo(100)
  })
})

describe('assemblyTemplates', () => {
  it('ships many geometry-only templates with unique ids and no textures', () => {
    expect(ASSEMBLY_TEMPLATES.length).toBeGreaterThanOrEqual(20)
    expect(new Set(ASSEMBLY_TEMPLATES.map((t) => t.id)).size).toBe(ASSEMBLY_TEMPLATES.length)
    for (const t of ASSEMBLY_TEMPLATES) {
      const faces = templateFaces(t)
      expect(faces.length).toBeGreaterThan(0)
      expect(faces.every((f) => !f.assetPath && !f.assetId)).toBe(true)
      expect(faces.every((f) => f.width > 0 && f.height > 0)).toBe(true)
      expect(templatePreview(t).length).toBe(faces.length)
      // Positional names only — nothing that assumes what the user's images depict.
      expect(faces.every((f) => !/khói|ngôi nhà|cửa sổ|chimney/i.test(f.name))).toBe(true)
    }
  })

  it('renders realistic round curved boundaries in preview for cylinder templates', () => {
    const cyl4 = findTemplate('cylinder-4')!
    const polys4 = templatePreview(cyl4)
    expect(polys4.length).toBe(4)
    // Curved faces have sampled arc perimeters (more than 4 vertices)
    for (const poly of polys4) {
      const vertexCount = poly.points.trim().split(/\s+/).length
      expect(vertexCount).toBeGreaterThan(4)
    }

    const flatPillar = findTemplate('pillar-square')!
    const flatPolys = templatePreview(flatPillar)
    expect(flatPolys.length).toBe(4)
    // Flat faces retain exact 4 quad corners
    for (const poly of flatPolys) {
      const vertexCount = poly.points.trim().split(/\s+/).length
      expect(vertexCount).toBe(4)
    }
  })

  it('replace keeps the user images, ids and extra faces', () => {
    const tpl = findTemplate('box')!
    const slots = templateFaces(tpl).length
    const current = Array.from({ length: slots + 2 }, (_, i) =>
      face(`f${i}`, { assetPath: `img-${i}.png`, bendX: 30, gridCols: 12 })
    )
    const next = replaceWithTemplate(tpl, current)
    expect(next).toHaveLength(current.length)
    next.forEach((f, i) => {
      expect(f.id).toBe(`f${i}`)
      expect(f.assetPath).toBe(`img-${i}.png`)
      expect(f.gridCols).toBe(12)
    })
    // Template-controlled bend is reset on folded slots, untouched on extra faces.
    expect(next[0].bendX).toBeUndefined()
    expect(next[slots].bendX).toBe(30)
  })

  it('append places the template to the right of the current model', () => {
    const current = [face('a')]
    const next = appendTemplate(findTemplate('standee')!, current)
    expect(next.length).toBeGreaterThan(1)
    const added = modelBounds(next.slice(1))!
    expect(added.min[0]).toBeGreaterThan(100)
  })
})

describe('assemblyFaceOps', () => {
  const faces = [face('a'), face('b', { position: [10, 0, 0] }), face('c')]

  it('duplicates right after the source with a fresh id', () => {
    const { faces: next, newId } = duplicateFace(faces, 'b')
    expect(next).toHaveLength(4)
    expect(next[2].id).toBe(newId)
    expect(next[2].position).toEqual([50, -40, 0])
  })

  it('deletes and selects a neighbour, never removing the last face', () => {
    const { faces: next, nextSelected } = deleteFace(faces, 'c')
    expect(next.map((f) => f.id)).toEqual(['a', 'b'])
    expect(nextSelected).toBe('b')
    expect(deleteFace([face('x')], 'x').faces).toHaveLength(1)
  })

  it('nudges unlocked faces only', () => {
    const locked = toggleFaceFlag(faces, 'a', 'locked')
    expect(nudgeFace(locked, 'a', [5, 0, 0])[0].position).toEqual([0, 0, 0])
    expect(nudgeFace(faces, 'a', [5, 1, 2])[0].position).toEqual([5, 1, 2])
  })

  it('reorders within bounds', () => {
    expect(reorderFace(faces, 'a', 1).map((f) => f.id)).toEqual(['b', 'a', 'c'])
    expect(reorderFace(faces, 'a', -1)).toBe(faces)
  })

  it('folds a new face from an edge and centres the model', () => {
    const { faces: next, newId } = addFoldedFace([face('a')], 'a', 'right')
    const added = next.find((f) => f.id === newId)!
    expect(added.height).toBe(100)
    expect(normalOf(added.rotation).x).toBeCloseTo(1, 5)
    const centred = centerFaces([face('a', { position: [100, 40, 20] })])
    expect(centred[0].position).toEqual([0, 0, 0])
  })

  it('matches the image aspect ratio', () => {
    expect(aspectHeight(face('a'), 1000, 1500)).toBe(300)
    expect(aspectHeight(face('a'), 0, 0)).toBe(100)
  })

  it('geometry signature ignores transform-only and visibility edits', () => {
    const a = face('a', { assetPath: 'a.png' })
    const moved = { ...a, position: [99, 5, -3] as [number, number, number], rotation: [10, 20, 30] as [number, number, number] }
    expect(faceGeometrySignature(moved)).toBe(faceGeometrySignature(a))
    expect(faceGeometrySignature({ ...a, locked: true, hidden: true })).toBe(faceGeometrySignature(a))
    expect(faceGeometrySignature({ ...a, width: 301 })).not.toBe(faceGeometrySignature(a))
  })
})
