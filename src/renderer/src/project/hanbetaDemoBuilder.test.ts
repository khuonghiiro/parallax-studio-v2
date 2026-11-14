import { afterAll, describe, expect, it } from 'vitest'
import type { ImageLayer } from '@shared/types'
import { evaluate } from '../animation/keyframes'
import { assetStore } from './assets'
import { buildHanbetaDemoProject } from './demo'
import { isTimeNode } from './workflowTiming'
import { isComposableLogicNode, resolveFxAtomicRole } from './workflowV2Engine'

afterAll(() => {
  assetStore.clear()
})

function findClusterPart(project: Awaited<ReturnType<typeof buildHanbetaDemoProject>>, instId: string, sourceLayerId: string): ImageLayer {
  const layer = project.layers.find(
    (l): l is ImageLayer =>
      l.type === 'image' &&
      l.composite?.instanceId === instId &&
      l.composite?.sourceLayerId === sourceLayerId
  )
  if (!layer) throw new Error(`Missing cluster part ${instId}/${sourceLayerId}`)
  return layer
}

describe('hanbetaDemoBuilder — Phim Mẫu 3 Đại Chiến Linh Thú 2.5D', () => {
  it('nạp đủ 51 ảnh sprite atlas và dựng 3 cảnh 16.5s chuẩn Workflow V2 nguyên tử', async () => {
    const project = await buildHanbetaDemoProject()

    expect(project.comp.name).toBe('Hàn Bối Tháp — Đại Chiến Linh Thú 2.5D')
    expect(project.comp.width).toBe(1920)
    expect(project.comp.height).toBe(1080)
    expect(project.comp.fps).toBe(30)
    expect(project.comp.duration).toBe(16.5)
    expect(project.shots).toHaveLength(3)
    expect(project.assets).toHaveLength(51)

    for (const asset of project.assets) {
      expect(asset.assetPath).toMatch(/^scenes-action-25d\//)
      expect(assetStore.get(asset.id)).toBeDefined()
    }

    const wfNodes = project.workflow?.nodes ?? []
    expect(wfNodes.length).toBeGreaterThanOrEqual(50)
    expect(wfNodes.filter((n) => isTimeNode(n)).length).toBeGreaterThanOrEqual(3)

    const fxNodes = wfNodes.filter((n) => n.params?.logicCategory === 'fx')
    expect(fxNodes.length).toBeGreaterThanOrEqual(6)
    for (const n of fxNodes) {
      expect(['fade', 'pulse', 'glow']).toContain(resolveFxAtomicRole(n))
    }

    const collisionNodes = wfNodes.filter((n) => n.params?.logicCategory === 'collision')
    expect(collisionNodes.length).toBeGreaterThanOrEqual(1)

    const rigPresets = new Set(
      wfNodes
        .filter((n) => n.params?.logicCategory === 'anim_fx')
        .map((n) => n.params?.rigActionPreset)
        .filter((v): v is string => typeof v === 'string')
    )
    for (const expectedPreset of [
      'walk',
      'run',
      'combat',
      'dodge_counter',
      'martial_kick',
      'quadruped_walk',
      'quadruped_gallop',
      'wing_flap',
      'monster_prowl',
      'monster_roar',
      'monster_pounce',
      'hit_recoil'
    ]) {
      expect(rigPresets.has(expectedPreset), `Missing rigActionPreset ${expectedPreset}`).toBe(true)
    }

    expect(wfNodes.filter((n) => isComposableLogicNode(n)).length).toBeGreaterThanOrEqual(20)
  })

  it('giữ khớp nối liền mạch khi vừa chạy BBox vừa diễn hoạt FK, đổi biểu cảm & va chạm kiếm khí', async () => {
    const project = await buildHanbetaDemoProject()

    // 1. Kiểm tra chuyển đổi biểu cảm Điềm tĩnh -> Hét xung phong tại 3.6s trên Cảnh 1
    const h1Calm = findClusterPart(project, 'act-hero-1', 'hero-head-calm')
    const h1Shout = findClusterPart(project, 'act-hero-1', 'hero-head-shout')
    expect(evaluate(h1Calm.transform.opacity, 1.0)).toBeGreaterThan(0.9)
    expect(evaluate(h1Shout.transform.opacity, 1.0)).toBeLessThan(0.1)
    expect(evaluate(h1Shout.transform.opacity, 4.2)).toBeGreaterThan(0.9)
    expect(evaluate(h1Calm.transform.opacity, 4.2)).toBeLessThan(0.1)

    // 2. Kiểm tra đa mốc thời gian: Kiếm Khách vừa tịnh tiến X > 200px vừa không rớt tay cầm kiếm
    const h1Torso = findClusterPart(project, 'act-hero-1', 'hero-torso')
    const h1Forearm = findClusterPart(project, 'act-hero-1', 'hero-forearm-l')
    const h1TorsoStart = evaluate(h1Torso.transform.position, 0.2)
    const h1TorsoEnd = evaluate(h1Torso.transform.position, 5.0)
    expect(h1TorsoEnd[0] - h1TorsoStart[0]).toBeGreaterThan(200)

    const armRots: number[] = []
    for (const t of [1.0, 2.5, 4.0]) {
      const torsoP = evaluate(h1Torso.transform.position, t)
      const forearmP = evaluate(h1Forearm.transform.position, t)
      const dist = Math.hypot(forearmP[0] - torsoP[0], forearmP[1] - torsoP[1])
      expect(dist).toBeLessThan(260)
    }
    for (let t = 0.2; t <= 4.8; t += 0.25) {
      armRots.push(evaluate(h1Forearm.transform.rotation, t)[2])
    }
    expect(Math.max(...armRots) - Math.min(...armRots)).toBeGreaterThan(8)

    // 3. Kiểm tra Linh Lang 4 chân đi cùng quỹ đạo BBox không rớt chân
    const w1Torso = findClusterPart(project, 'act-wolf-1', 'wolf-torso')
    const w1Shin = findClusterPart(project, 'act-wolf-1', 'wolf-leg-fl-shin')
    expect(evaluate(w1Torso.transform.position, 5.0)[0] - evaluate(w1Torso.transform.position, 0.2)[0]).toBeGreaterThan(200)
    const wolfLegRots: number[] = []
    for (const t of [1.0, 2.5, 4.0]) {
      const tP = evaluate(w1Torso.transform.position, t)
      const sP = evaluate(w1Shin.transform.position, t)
      expect(Math.hypot(sP[0] - tP[0], sP[1] - tP[1])).toBeLessThan(260)
    }
    for (let t = 0.2; t <= 4.8; t += 0.2) {
      wolfLegRots.push(evaluate(w1Shin.transform.rotation, t)[2])
    }
    expect(Math.max(...wolfLegRots) - Math.min(...wolfLegRots)).toBeGreaterThan(8)

    // 4. Kiểm tra Ma Thú Cảnh 3 lao vào rồi trúng kiếm khí bật lùi kèm xung va chạm
    const m3Pelvis = findClusterPart(project, 'act-monster-3', 'monster-pelvis')
    expect(evaluate(m3Pelvis.transform.position, 13.1)[0]).toBeLessThan(220)
    expect(evaluate(m3Pelvis.transform.position, 15.5)[0]).toBeGreaterThan(280)
    expect(m3Pelvis.physics?.impacts?.length ?? 0).toBeGreaterThanOrEqual(1)
  })
})
