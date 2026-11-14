import { afterAll, describe, expect, it } from 'vitest'
import type { ImageLayer } from '@shared/types'
import { evaluate } from '../animation/keyframes'
import { deformSkin } from '../engine/layerSkinning'
import { deformPlantSpines } from '../engine/plantSpine'
import { assetStore } from './assets'
import { buildHanbetaDemoProject } from './demo'
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

describe('hanbetaDemoBuilder — Phim Mẫu 3 Hàn Bối Tháp Quái Đàm 2.5D', () => {
  it('nạp đủ 15 ảnh thật và dựng 3 cảnh 15s chuẩn Workflow V2 nguyên tử', async () => {
    const project = await buildHanbetaDemoProject()

    expect(project.comp.width).toBe(1920)
    expect(project.comp.height).toBe(1080)
    expect(project.comp.fps).toBe(30)
    expect(project.comp.duration).toBe(15)
    expect(project.shots).toHaveLength(3)
    expect(project.assets).toHaveLength(15)

    for (const asset of project.assets) {
      expect(asset.assetPath).toMatch(/^scenes-hanbeta-v2\//)
      expect(assetStore.get(asset.id)).toBeDefined()
    }

    const wfNodes = project.workflow?.nodes ?? []
    expect(wfNodes.length).toBeGreaterThanOrEqual(50)
    const timeGroups = wfNodes.filter((n) => isTimeNode(n))
    expect(timeGroups.length).toBeGreaterThanOrEqual(3)

    const fxNodes = wfNodes.filter((n) => n.params?.logicCategory === 'fx')
    expect(fxNodes.length).toBeGreaterThanOrEqual(4)
    for (const n of fxNodes) {
      expect(['fade', 'pulse', 'glow']).toContain(resolveFxAtomicRole(n))
    }

    const logicNodes = wfNodes.filter((n) => isComposableLogicNode(n))
    expect(logicNodes.length).toBeGreaterThanOrEqual(10)
  })

  it('chuyển biểu cảm dứt khoát bằng part_swap, giữ khớp nối soft-skin và sóng gió S-wave cho vạt áo', async () => {
    const project = await buildHanbetaDemoProject()
    const findHeroPart = (instId: string, sourceLayerId: string): ImageLayer => {
      const layer = project.layers.find(
        (l): l is ImageLayer =>
          l.type === 'image' &&
          l.composite?.instanceId === instId &&
          l.composite?.sourceLayerId === sourceLayerId
      )
      if (!layer) throw new Error(`Missing ${instId}/${sourceLayerId}`)
      return layer
    }

    // Cảnh 1: điềm tĩnh -> cười nửa miệng tại 2.4s
    const h1Calm = findHeroPart('hb-hero-1', 'head-calm')
    const h1Smirk = findHeroPart('hb-hero-1', 'head-smirk')
    expect(evaluate(h1Calm.transform.opacity, 1.0)).toBeGreaterThan(0.9)
    expect(evaluate(h1Smirk.transform.opacity, 1.0)).toBeLessThan(0.1)
    expect(evaluate(h1Smirk.transform.opacity, 3.2)).toBeGreaterThan(0.9)
    expect(evaluate(h1Calm.transform.opacity, 3.2)).toBeLessThan(0.1)

    // Cảnh 2: giật mình kinh ngạc tại 5.35s
    const h2Shock = findHeroPart('hb-hero-2', 'head-shock')
    expect(evaluate(h2Shock.transform.opacity, 6.2)).toBeGreaterThan(0.9)

    // Cảnh 3: tự tin cười nửa miệng khi khai ấn tại 10.35s
    const h3Smirk = findHeroPart('hb-hero-3', 'head-smirk')
    expect(evaluate(h3Smirk.transform.opacity, 11.5)).toBeGreaterThan(0.9)

    // Kiểm tra sóng lụa S-wave trên vạt áo Cảnh 1: gốc trên vai ổn định, gấu áo bay mượt & verticalBob = 0
    const coat1 = findHeroPart('hb-hero-1', 'coat-back')
    const spines = coat1.mesh?.skin?.plantSpines ?? []
    expect(spines.length).toBeGreaterThanOrEqual(2)
    for (const sp of spines) {
      expect(sp.waveLag ?? 0).toBeGreaterThan(0.5)
      expect(sp.verticalBob ?? 0).toBe(0)
    }
    const shoulderDrift = measureMaxDisplacement(coat1, [0.4, 1.2, 2.0, 2.8], (_x, ry) => ry > 220)
    const hemSway = measureMaxDisplacement(coat1, [0.4, 1.2, 2.0, 2.8], (_x, ry) => ry < -180)
    expect(shoulderDrift).toBeLessThan(8)
    expect(hemSway).toBeGreaterThan(10)

    // Kiểm tra soft-skin rig giữ vị trí neo transform.position trùng centerPosition + rootOffset (không văng khớp quỹ đạo)
    const h1ArmR = findHeroPart('hb-hero-1', 'arm-r')
    const h2ArmR = findHeroPart('hb-hero-2', 'arm-r')
    const h3ArmR = findHeroPart('hb-hero-3', 'arm-r')
    expect(h1ArmR.mesh?.skin?.rig.activeClipId).toMatch(/scheming/)
    expect(h2ArmR.mesh?.skin?.rig.activeClipId).toMatch(/shock/)
    expect(h3ArmR.mesh?.skin?.rig.activeClipId).toMatch(/point/)

    for (const arm of [h1ArmR, h2ArmR, h3ArmR]) {
      const expected = arm.composite!.centerPosition!.map((v, i) => v + arm.composite!.rootOffset![i])
      expect(arm.transform.position.keyframes).toHaveLength(0)
      expect(arm.transform.position.value[0]).toBeCloseTo(expected[0], 1)
      expect(arm.transform.position.value[1]).toBeCloseTo(expected[1], 1)
    }

    const forearmMove = measureMaxDisplacement(h1ArmR, [0.3, 0.7, 1.2, 1.8], (rx, ry) => rx > 100 && ry > 0)
    expect(forearmMove).toBeGreaterThan(15)
  })
})
