import { afterAll, describe, expect, it } from 'vitest'
import type { ImageLayer } from '@shared/types'
import { evaluate } from '../animation/keyframes'
import { deformSkin } from '../engine/layerSkinning'
import { deformPlantSpines } from '../engine/plantSpine'
import { assetStore } from './assets'
import { buildDonghuaDemoProject } from './demo'
import { isTimeNode } from './workflowTiming'
import { isComposableLogicNode, resolveFxAtomicRole } from './workflowV2Engine'

afterAll(() => {
  assetStore.clear()
})

function evalLayerVertices(layer: ImageLayer, localTime: number): Float32Array {
  const skin = layer.mesh?.skin
  if (!skin) throw new Error(`Missing skin on layer ${layer.id}`)
  const restPos = new Float32Array(skin.positions)
  let current: Float32Array = new Float32Array(restPos)
  if (skin.rig.bones.length > 0) {
    current = deformSkin(current, skin.binding, skin.rig, localTime, skin.indices)
  }
  if (skin.plantSpines && skin.plantSpines.length > 0) {
    current = deformPlantSpines(current, skin.binding, skin.plantSpines, localTime, skin.indices, restPos)
  }
  return current
}

function measureMaxDisplacement(
  layer: ImageLayer,
  sampleTimes: number[],
  predicate?: (restX: number, restY: number) => boolean
): number {
  const skin = layer.mesh?.skin
  if (!skin) throw new Error(`Missing skin on layer ${layer.id}`)
  const restPos = new Float32Array(skin.positions)
  const base = evalLayerVertices(layer, 0)
  let maxDelta = 0
  let matchedVertices = 0

  for (const t of sampleTimes) {
    const deformed = evalLayerVertices(layer, t)
    matchedVertices = 0
    for (let i = 0; i < restPos.length; i += 3) {
      const rx = restPos[i]
      const ry = restPos[i + 1]
      if (predicate && !predicate(rx, ry)) continue
      matchedVertices += 1
      const delta = Math.hypot(deformed[i] - base[i], deformed[i + 1] - base[i + 1])
      if (delta > maxDelta) maxDelta = delta
    }
  }
  expect(matchedVertices, `Predicate matched zero vertices on ${layer.id}`).toBeGreaterThan(0)
  return maxDelta
}

describe('donghuaDemoBuilder — Phim Mẫu 2 Quốc Phong 2.5D', () => {
  it('nạp thành công 20 ảnh thật từ đĩa và dựng đủ 3 cảnh 18s chuẩn Workflow V2 đơn nhiệm', async () => {
    const project = await buildDonghuaDemoProject()

    expect(project.comp.width).toBe(1920)
    expect(project.comp.height).toBe(1080)
    expect(project.comp.fps).toBe(30)
    expect(project.comp.duration).toBe(18)
    expect(project.shots).toHaveLength(3)

    // Toàn bộ 20 PNG mỹ thuật phải được assetStore nạp thật từ assets/scenes-donghua-v2/
    expect(project.assets).toHaveLength(20)
    for (const meta of project.assets) {
      expect(meta.path).toContain('scenes-donghua-v2/')
      const loaded = assetStore.get(meta.id)
      expect(loaded, `Missing loaded asset in assetStore: ${meta.id}`).toBeDefined()
      expect(loaded!.blob.size).toBeGreaterThan(1000)
    }

    const wf = project.workflow
    expect(wf).toBeDefined()
    const nodes = wf!.nodes

    // Có cụm composite 2.5D và cluster_lock mặc định thu gọn sub-layer
    const clusterLocks = nodes.filter((n) => n.params?.logicCategory === 'cluster_lock')
    expect(clusterLocks.length).toBeGreaterThanOrEqual(2)
    expect(clusterLocks.every((n) => n.params?.collapsedSubLayers === true)).toBe(true)

    // Cảnh 2 phải có biến thể đổi thần thái Kiếm Khách (Điềm tĩnh -> Khai phong kiếm ý)
    const fierceLayer = project.layers.find((l) => l.id === 'layer-dg-s2-fierce') as ImageLayer | undefined
    expect(fierceLayer).toBeDefined()
    expect(
      nodes.some((n) => n.params?.isPartChild && n.params?.swapTargetLayerId === 'layer-dg-s2-fierce')
    ).toBe(true)
    expect(fierceLayer!.transform.opacity.keyframes.length).toBeGreaterThanOrEqual(2)

    // Có nhóm Time chung cho cao trào Trúc Lâm
    const timeNodes = nodes.filter((n) => isTimeNode(n))
    expect(timeNodes.length).toBeGreaterThanOrEqual(1)

    // Phải có ít nhất 3 chuỗi logic đa bước đạt bước B3 (pipelineStepIndex >= 3)
    const step3Nodes = nodes.filter(
      (n) => isComposableLogicNode(n) && (n.params?.pipelineStepIndex ?? 0) >= 3
    )
    expect(step3Nodes.length).toBeGreaterThanOrEqual(3)

    // Mọi Node FX đều đơn nhiệm 100% (chỉ giữ 1 vai trò fade / pulse / glow)
    const fxNodes = nodes.filter((n) => n.params?.logicCategory === 'fx')
    expect(fxNodes.length).toBeGreaterThanOrEqual(6)
    for (const fx of fxNodes) {
      expect(['fade', 'pulse', 'glow']).toContain(resolveFxAtomicRole(fx))
    }
  })

  it('biến dạng đỉnh xương mềm, cánh hạc đập nhịp, gió cục bộ trên cây & kiếm khí xuất chiêu', async () => {
    const project = await buildDonghuaDemoProject()
    const getImg = (id: string): ImageLayer => {
      const layer = project.layers.find((l) => l.id === id)
      expect(layer, `Missing layer ${id}`).toBeDefined()
      return layer as ImageLayer
    }

    const times = [0.18, 0.36, 0.75, 1.15]

    // Nhân vật có xương mềm & cánh hạc vỗ cánh biến dạng rõ rệt theo thời gian
    for (const id of [
      'layer-dg-s1-calm',
      'layer-dg-s1-cloak',
      'layer-dg-s2-fierce',
      'layer-dg-s3-maiden',
      'layer-dg-s1-crane-wing-near'
    ]) {
      const layer = getImg(id)
      const delta = measureMaxDisplacement(layer, times)
      expect(delta, `Expected vertex motion > 5px on ${id}`).toBeGreaterThan(5)
    }

    // Chân trụ Kiếm Khách đứng vững trên vách đá, trong khi tay áo & tà áo vung chuyển động
    const heroCalm = getImg('layer-dg-s1-calm')
    const bootDelta = measureMaxDisplacement(heroCalm, times, (rx, ry) => Math.abs(rx) < 70 && ry < -550)
    expect(bootDelta).toBeLessThan(1.0)
    const sleeveHemDelta = measureMaxDisplacement(heroCalm, times, (rx, ry) => Math.abs(rx) > 150 || ry > -400)
    expect(sleeveHemDelta).toBeGreaterThan(5)

    // Đình cổ vách đá đứng yên tuyệt đối (< 0.05 px), chỉ tán thông phải vẫy gió
    const cliff = getImg('layer-dg-s1-cliff')
    expect(measureMaxDisplacement(cliff, times, (rx) => rx < -80)).toBeLessThan(0.05)
    expect(measureMaxDisplacement(cliff, times, (rx, ry) => rx > 260 && ry > 120)).toBeGreaterThan(1.5)

    // Đá Thái Hồ dưới thấp đứng yên tuyệt đối (< 0.05 px), chỉ ngọn trúc cao đung đưa
    const bamboo = getImg('layer-dg-s2-bamboo')
    expect(measureMaxDisplacement(bamboo, times, (_rx, ry) => ry < -160)).toBeLessThan(0.05)
    expect(measureMaxDisplacement(bamboo, times, (_rx, ry) => ry > 220)).toBeGreaterThan(4.0)

    // Linh kiếm cảnh 2 chém vòng cung rộng & Kiếm Khí bùng sáng ở 7.8..8.5s rồi tan dần
    const swordS2 = getImg('layer-dg-s2-sword')
    const xs = swordS2.transform.position.keyframes.map((k) => k.value[0])
    const rots = swordS2.transform.rotation.keyframes.map((k) => k.value[2])
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(180)
    expect(Math.max(...rots) - Math.min(...rots)).toBeGreaterThan(90)

    const swordQi = getImg('layer-dg-s2-sword-qi')
    expect(evaluate(swordQi.transform.opacity, 7.5)).toBeCloseTo(0, 3)
    expect(evaluate(swordQi.transform.opacity, 8.0)).toBeGreaterThan(0.85)
    expect(evaluate(swordQi.transform.opacity, 10.5)).toBeCloseTo(0, 3)
  })
})
