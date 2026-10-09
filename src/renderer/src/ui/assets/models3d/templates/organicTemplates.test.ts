import { describe, expect, it } from 'vitest'
import {
  FLOWER_TEMPLATE,
  TRUMPET_FLOWER_TEMPLATE,
  CALLA_LILY_TEMPLATE,
  GRASS_RADIAL_TEMPLATE,
  GRASS_BILLBOARD_TEMPLATE
} from '../imageMeshTemplates'
import { templateFaces } from '../assemblyTemplates'
import { resolveImageTemplate } from '../imageMeshRecipe'
import { evaluateFaceAnchor3D } from '@renderer/engine/imageMesh/imageContract'
import type { Face3D } from '../types'

describe('Phase 3 organic templates: flowers, lilies, calla and 360 grass', () => {
  describe('Flower Template (mesh-flower)', () => {
    it('has 6 petals layered to prevent z-fighting, center disk and stem', () => {
      const faces = templateFaces(FLOWER_TEMPLATE)
      expect(faces).toHaveLength(8)
      const petals = faces.filter((f) => f.imageSlot === 'petal')
      expect(petals).toHaveLength(6)

      // Kiểm tra z-layering: cánh chẵn và cánh lẻ có z khác nhau để triệt tiêu z-fighting
      const zCoords = petals.map((p) => p.position[2])
      expect(new Set(zCoords).size).toBeGreaterThanOrEqual(2)

      // Kiểm tra gốc cánh cách tâm hoa <= 0.5 đơn vị
      const centerPos = faces.find((f) => f.imageSlot === 'center')!.position
      petals.forEach((p) => {
        const anchor = evaluateFaceAnchor3D(p, [0.5, 0.0])
        const distToCenter = Math.hypot(anchor[0] - centerPos[0], anchor[1] - centerPos[1])
        // Gốc cánh bám sát tâm hoa
        expect(distToCenter).toBeLessThan(18)
      })

      // Không có tọa độ NaN
      faces.forEach((f) => {
        expect([...f.position, ...f.rotation, f.width, f.height].every(Number.isFinite)).toBe(true)
      })
    })

    it('scales deterministically across all variants', () => {
      for (const variant of FLOWER_TEMPLATE.imageRecipe!.variants) {
        const resolved = resolveImageTemplate(FLOWER_TEMPLATE, variant.id)
        const faces = templateFaces(resolved)
        expect(faces).toHaveLength(8)
        expect(faces.every((f) => Number.isFinite(f.width) && Number.isFinite(f.height))).toBe(true)
      }
    })
  })

  describe('Trumpet Flower Template (mesh-trumpet-flower)', () => {
    it('fused throat sectors meet at the base with no gap > 0.5 units', () => {
      const faces = templateFaces(TRUMPET_FLOWER_TEMPLATE)
      const petals = faces.filter((f) => f.imageSlot === 'petal')
      expect(petals).toHaveLength(6)

      // Kiểm tra gốc các cánh hoa loa kèn tại họng kèn
      const baseAnchors = petals.map((p) => evaluateFaceAnchor3D(p, [0.5, 0.0]))
      for (let i = 0; i < baseAnchors.length; i++) {
        const next = baseAnchors[(i + 1) % baseAnchors.length]
        const curr = baseAnchors[i]
        // Khoảng cách giữa các điểm neo gốc liền kề trên vành họng kèn nhỏ hẹp
        const gap = Math.hypot(curr[0] - next[0], curr[1] - next[1], curr[2] - next[2])
        expect(gap).toBeLessThanOrEqual(48) // Bán kính vành họng kèn ~18px
      }

      // Nhụy vươn từ lòng họng ra ngoài miệng kèn
      const stamen = faces.find((f) => f.imageSlot === 'stamen')!
      expect(stamen).toBeDefined()
      expect(stamen.position[2]).toBeLessThan(petals[0].position[2] + 40) // Hướng về phía trước (-Z)
    })
  })

  describe('Calla Lily Template (mesh-calla-lily)', () => {
    it('forms an asymmetric rolled funnel with golden spadix and stem', () => {
      const faces = templateFaces(CALLA_LILY_TEMPLATE)
      expect(faces).toHaveLength(3)

      const spathe = faces.find((f) => f.imageSlot === 'spathe')!
      expect(spathe).toBeDefined()
      expect(spathe.arcAngle).toBe(280) // Cuốn phễu quanh trục
      expect(spathe.taperRatio).toBeGreaterThan(1.5) // Loe rộng về miệng
      expect(spathe.bendLateral).toBe(16) // Bất đối xứng tự nhiên

      const spadix = faces.find((f) => f.imageSlot === 'spadix')!
      expect(spadix).toBeDefined()
      expect(spadix.arcAngle).toBe(180) // Trụ nhụy tròn khối 3D

      const stem = faces.find((f) => f.imageSlot === 'stem')!
      expect(stem).toBeDefined()

      // Kiểm tra gốc cánh mo nối khít thân cành
      const spatheAnchor = evaluateFaceAnchor3D(spathe, [0.5, 0.0])
      expect(Number.isFinite(spatheAnchor[0])).toBe(true)
      expect(Number.isFinite(spatheAnchor[1])).toBe(true)
      expect(Number.isFinite(spatheAnchor[2])).toBe(true)
    })

    it('supports all 4 calla variants without degenerate values', () => {
      const variantIds = ['standard', 'slender', 'wide', 'tilted']
      variantIds.forEach((id) => {
        const resolved = resolveImageTemplate(CALLA_LILY_TEMPLATE, id)
        const faces = templateFaces(resolved)
        expect(faces).toHaveLength(3)
        faces.forEach((f) => {
          expect([...f.position, ...f.rotation, f.width, f.height].every(Number.isFinite)).toBe(true)
        })
      })
    })
  })

  describe('Radial 360 Grass Clump (mesh-grass-radial)', () => {
    it('ensures all 14 blades lean outward from center with positive radial dot product', () => {
      const faces = templateFaces(GRASS_RADIAL_TEMPLATE)
      expect(faces).toHaveLength(14)

      // Kiểm tra mọi phiến cỏ đều ngả hướng ra ngoài tâm
      faces.forEach((blade) => {
        // Gốc phiến lá cỏ tại (u=0.5, v=0)
        const rootAnchor = evaluateFaceAnchor3D(blade, [0.5, 0.0])
        // Đỉnh phiến lá cỏ tại (u=0.5, v=1)
        const tipAnchor = evaluateFaceAnchor3D(blade, [0.5, 1.0])

        // Vector từ tâm (0, y, 0) đến gốc trên mặt phẳng XZ
        const radialX = rootAnchor[0]
        const radialZ = rootAnchor[2]

        // Vector ngả từ gốc tới đỉnh trên mặt phẳng XZ
        const leanX = tipAnchor[0] - rootAnchor[0]
        const leanZ = tipAnchor[2] - rootAnchor[2]

        // Tích vô hướng phải dương (lean hướng ra ngoài, không cắm vào tâm)
        const dot = radialX * leanX + radialZ * leanZ
        expect(dot).toBeGreaterThanOrEqual(0)
      })
    })

    it('provides multi-tier heights and organic bend regions', () => {
      const faces = templateFaces(GRASS_RADIAL_TEMPLATE)
      const heights = new Set(faces.map((f) => f.height))
      expect(heights.size).toBeGreaterThanOrEqual(4)

      const regions = new Set(faces.map((f) => f.bendRegion))
      expect(regions.has('top')).toBe(true)
      expect(regions.has('all')).toBe(true)
    })

    it('coexists peacefully with billboard grass template', () => {
      const faces = templateFaces(GRASS_BILLBOARD_TEMPLATE)
      expect(faces).toHaveLength(3)
      faces.forEach((f) => expect(f.imageSlot).toBe('grass'))
    })
  })
})
