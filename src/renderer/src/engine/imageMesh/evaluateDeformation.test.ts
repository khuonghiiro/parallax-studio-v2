import { describe, it, expect } from 'vitest'
import { evaluateMeshGeometry } from './evaluateDeformation'
import { faceToMeshDefinition } from './legacyAdapter'
import type { ImageMeshDefinition } from '@shared/imageMeshDefinition'
import type { Face3D } from '../../ui/assets/models3d/types'

describe('evaluateMeshGeometry deformation pipeline', () => {
  const baseDef: ImageMeshDefinition = {
    version: 1,
    id: 'test-def',
    name: 'Test Def',
    surface: {
      width: 100,
      height: 200,
      subdivisions: [16, 24],
      restUVBounds: [0, 0, 1, 1]
    },
    anchorUV: [0.5, 0.0],
    tipUV: [0.5, 1.0],
    modifiers: [],
    materials: {}
  }

  it('builds a clean planar BufferGeometry with correct dimensions and normals', () => {
    const geo = evaluateMeshGeometry(baseDef)
    try {
      const pos = geo.getAttribute('position')
      const uv = geo.getAttribute('uv')
      const normal = geo.getAttribute('normal')
      const index = geo.getIndex()

      expect(pos.count).toBe((16 + 1) * (24 + 1))
      expect(uv.count).toBe(pos.count)
      expect(normal.count).toBe(pos.count)
      expect(index).not.toBeNull()
      expect(index!.count).toBe(16 * 24 * 6)

      expect(geo.boundingBox!.min.x).toBeCloseTo(-50)
      expect(geo.boundingBox!.max.x).toBeCloseTo(50)
      expect(geo.boundingBox!.min.y).toBeCloseTo(-100)
      expect(geo.boundingBox!.max.y).toBeCloseTo(100)
      expect(geo.boundingBox!.min.z).toBeCloseTo(0)
      expect(geo.boundingBox!.max.z).toBeCloseTo(0)
    } finally {
      geo.dispose()
    }
  })

  it('applies bend and arcAngle curvature to vertices in Z', () => {
    const bendDef: ImageMeshDefinition = {
      ...baseDef,
      modifiers: [
        {
          type: 'bend',
          id: 'bend-y',
          enabled: true,
          axis: 'y',
          intensity: 40,
          region: 'all'
        }
      ]
    }
    const geo = evaluateMeshGeometry(bendDef)
    try {
      expect(geo.boundingBox!.max.z).toBeGreaterThan(5)
    } finally {
      geo.dispose()
    }
  })

  it('applies twist modifier with rotation around spine', () => {
    const twistDef: ImageMeshDefinition = {
      ...baseDef,
      modifiers: [
        {
          type: 'twist',
          id: 'twist-1',
          enabled: true,
          angle: 45
        }
      ]
    }
    const geo = evaluateMeshGeometry(twistDef)
    try {
      // Due to twist, corners at tip should rotate out of the XY plane into Z
      expect(Math.abs(geo.boundingBox!.max.z - geo.boundingBox!.min.z)).toBeGreaterThan(5)
    } finally {
      geo.dispose()
    }
  })

  it('proves sculpt brush vertices outside radius are strictly unchanged', () => {
    const sculptDef: ImageMeshDefinition = {
      ...baseDef,
      modifiers: [
        {
          type: 'sculpt',
          id: 'sculpt-1',
          enabled: true,
          strokes: [
            {
              uv: [0.5, 0.8], // Tip area
              pressure: 1.0,
              radius: 0.15, // Small radius
              mode: 'inflate'
            }
          ]
        }
      ]
    }
    const baseGeo = evaluateMeshGeometry(baseDef)
    const sculptGeo = evaluateMeshGeometry(sculptDef)

    try {
      const basePos = baseGeo.getAttribute('position')
      const sculptPos = sculptGeo.getAttribute('position')
      const uv = baseGeo.getAttribute('uv')

      for (let i = 0; i < basePos.count; i++) {
        const u = uv.getX(i)
        const v = uv.getY(i)

        // Check a vertex far away at base (v = 0.1)
        if (v < 0.3) {
          expect(sculptPos.getX(i)).toBeCloseTo(basePos.getX(i), 5)
          expect(sculptPos.getY(i)).toBeCloseTo(basePos.getY(i), 5)
          expect(sculptPos.getZ(i)).toBeCloseTo(basePos.getZ(i), 5)
        }
      }
      // But vertex near target should be displaced in Z
      expect(sculptGeo.boundingBox!.max.z).toBeGreaterThan(baseGeo.boundingBox!.max.z + 5)
    } finally {
      baseGeo.dispose()
      sculptGeo.dispose()
    }
  })

  it('normalizes geometry into unit space [-0.5, 0.5] when requested', () => {
    const geo = evaluateMeshGeometry(baseDef, { unitSpace: true })
    try {
      expect(geo.boundingBox!.min.x).toBeCloseTo(-0.5)
      expect(geo.boundingBox!.max.x).toBeCloseTo(0.5)
      expect(geo.boundingBox!.min.y).toBeCloseTo(-0.5)
      expect(geo.boundingBox!.max.y).toBeCloseTo(0.5)
    } finally {
      geo.dispose()
    }
  })

  it('adapts legacy Face3D properties seamlessly into an ImageMeshDefinition', () => {
    const legacyFace: Face3D = {
      id: 'legacy-petal',
      name: 'Petal',
      width: 120,
      height: 240,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      bendX: 30,
      bendY: 45,
      bendLateral: -20,
      bendRegion: 'top',
      depthProfile: 'ridge',
      depthIntensity: 15,
      motionType: 'wind'
    }

    const def = faceToMeshDefinition(legacyFace)
    expect(def.modifiers).toHaveLength(3) // bend-x, bend-y, depth
    expect(def.motion?.type).toBe('wind')

    const geo = evaluateMeshGeometry(def)
    try {
      expect(geo.boundingBox!.max.z - geo.boundingBox!.min.z).toBeGreaterThan(10)
    } finally {
      geo.dispose()
    }
  })
})
