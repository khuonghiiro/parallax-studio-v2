import { describe, expect, it } from 'vitest'
import type { LayerComposite } from '../types'
import { applyRigAction, validateRig } from '../workshopRig'
import { computeBoneTail, summarizeWeldableJoints } from '../mohoRigHelpers'
import { buildCreatureRig } from './creatureRigBuilders'
import { buildCreatureClips } from './creatureRigMotion'
import { autoBindCreatureLayers, detectCreatureFacing, detectCreatureSpecies, fitBonesToRect, skeletonRect } from './creatureRigFit'
import { CREATURE_SPECIES, normalizeCreatureOptions } from './creatureRigCatalog'
import { CREATURE_SPECIES_IDS } from './creatureRigTypes'

const layer = (id: string, name: string, x = 0, y = 0) => ({
  id,
  name,
  x,
  y,
  z: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
  motion: { type: 'none' as const, speed: 1, amplitude: 0, anchor: 'center' as const }
})

const composite = (layers = [layer('l-1', 'Ảnh sinh vật')]): LayerComposite => ({
  id: 'creature-comp',
  name: 'Creature',
  category: 'character',
  width: 800,
  height: 600,
  layers
})

describe('Thư viện khung xương sinh vật (Creature Skeleton Library)', () => {
  it('catalog khai báo đủ 12 loài, mỗi loài có icon riêng biệt', () => {
    expect(CREATURE_SPECIES.map((m) => m.id)).toEqual(CREATURE_SPECIES_IDS)
    expect(new Set(CREATURE_SPECIES.map((m) => m.icon)).size).toBe(CREATURE_SPECIES.length)
  })

  it.each(CREATURE_SPECIES_IDS)('dựng khung xương %s hợp lệ, ID duy nhất, chuỗi đốt hàn khít', (species) => {
    const build = buildCreatureRig(species)
    const ids = new Set(build.bones.map((b) => b.id))
    expect(ids.size).toBe(build.bones.length)
    expect(build.bones.filter((b) => !b.parentId)).toHaveLength(1)
    for (const bone of build.bones) {
      expect(build.roles[bone.id]).toBeDefined()
      const role = build.roles[bone.id]
      if (role.segment > 0 && bone.parentId) {
        const parent = build.bones.find((b) => b.id === bone.parentId)!
        const tail = computeBoneTail(parent)
        expect(Math.hypot(tail.x - bone.x, tail.y - bone.y)).toBeLessThan(0.05)
      }
    }
    expect(summarizeWeldableJoints(build.bones, 0.45).looseCount).toBe(0)
    expect(() => validateRig({ ...composite(), rig: { bones: build.bones, duration: 1, loop: true, tracks: {} } })).not.toThrow()
  })

  it('nhện có 4 cặp chân × 3 đốt đối xứng Trái ⇄ Phải, tuỳ chỉnh được số cặp & số đốt', () => {
    const spider = buildCreatureRig('spider')
    const legs = Object.values(spider.roles).filter((r) => r.kind === 'leg')
    expect(legs).toHaveLength(24)
    expect(legs.filter((r) => r.side === 'l')).toHaveLength(12)
    const left = spider.bones.find((b) => b.id === 'bone-spider-leg1-s1-l')!
    const right = spider.bones.find((b) => b.id === 'bone-spider-leg1-s1-r')!
    expect(right.x).toBeCloseTo(-left.x)
    expect(right.minAngle).toBe(-(left.maxAngle as number))
    const custom = buildCreatureRig('spider', { legPairs: 2, legSegments: 4 })
    expect(Object.values(custom.roles).filter((r) => r.kind === 'leg')).toHaveLength(16)
    expect(normalizeCreatureOptions('spider', { legPairs: 99 }).legPairs).toBe(6)
  })

  it('dáng bò so le: chân 1 trái ngược pha chân 1 phải và chân 2 trái', () => {
    const roles = buildCreatureRig('spider').roles
    expect(roles['bone-spider-leg1-s1-l'].phase).toBe(0)
    expect(roles['bone-spider-leg1-s1-r'].phase).toBe(0.5)
    expect(roles['bone-spider-leg2-s1-l'].phase).toBe(0.5)
  })

  it('sinh vật nhìn ngang lật hướng mặt sang phải', () => {
    const left = buildCreatureRig('fish')
    const right = buildCreatureRig('fish', { facing: 'right' })
    const headL = left.bones.find((b) => b.id === 'bone-fish-head')!
    const headR = right.bones.find((b) => b.id === 'bone-fish-head')!
    expect(headL.x).toBeLessThan(0)
    expect(headR.x).toBeGreaterThan(0)
    expect(right.roles['bone-fish-head'].sign).toBe(-1)
  })

  it('động tác mẫu lặp liền mạch và tôn trọng giới hạn góc khớp', () => {
    for (const species of CREATURE_SPECIES_IDS) {
      const build = buildCreatureRig(species, { wings: true })
      const clips = buildCreatureClips(build, false)
      expect(clips.length).toBeGreaterThan(0)
      for (const clip of clips) {
        expect(Object.keys(clip.tracks).length).toBeGreaterThan(0)
        for (const [boneId, keys] of Object.entries(clip.tracks)) {
          const bone = build.bones.find((b) => b.id === boneId)!
          expect(keys[0].rotation).toBeCloseTo(keys[keys.length - 1].rotation, 1)
          expect(keys[keys.length - 1].time).toBeCloseTo(clip.duration, 3)
          if (bone.minAngle !== undefined) {
            for (const k of keys) {
              expect(k.rotation).toBeGreaterThanOrEqual(bone.minAngle - 1e-6)
              expect(k.rotation).toBeLessThanOrEqual((bone.maxAngle as number) + 1e-6)
            }
          }
        }
      }
    }
  })

  it('khớp khung xương vừa khung ảnh layer theo kích thước thật', () => {
    const fitted = fitBonesToRect(buildCreatureRig('horse').bones, { minX: 100, minY: -50, maxX: 500, maxY: 250 })
    const r = skeletonRect(fitted)
    expect(r.minX).toBeGreaterThanOrEqual(99)
    expect(r.maxX).toBeLessThanOrEqual(501)
    expect(r.minY).toBeGreaterThanOrEqual(-51)
    expect(r.maxY).toBeLessThanOrEqual(251)
  })

  it('nhận diện loài và hướng mặt từ tên layer', () => {
    expect(detectCreatureSpecies(composite([layer('a', 'Con nhện đen')]))).toBe('spider')
    expect(detectCreatureSpecies(composite([layer('a', 'body'), layer('b', 'tail fin'), layer('c', 'vây lưng')]))).toBe('fish')
    expect(detectCreatureSpecies(composite([layer('a', 'abc')]))).toBeNull()
    expect(detectCreatureFacing(composite([layer('h', 'head', 120), layer('t', 'tail', -100)]))).toBe('right')
  })

  it('tự gắn layer: ảnh đơn uốn mềm theo xương gốc, nhiều mảnh gắn theo bộ phận', () => {
    const build = buildCreatureRig('fish')
    const single = autoBindCreatureLayers(composite().layers, build)
    expect(single[0].boneId).toBe('bone-fish-root')
    expect(single[0].bindingMode).toBe('soft')
    const parts = autoBindCreatureLayers(
      [layer('h', 'head', -70, 0), layer('t', 'tail fin', 140, 0), layer('b', 'body', 0, 0)],
      build
    )
    expect(parts[0].boneId).toBe('bone-fish-head')
    expect(parts[0].bindingMode).toBe('rigid')
    expect(parts[1].boneId).toBe('bone-fish-tailfin')
    expect(parts[1].bindingMode).toBe('soft')
  })

  it('apply-creature-rig thay khung xương, nạp động tác & gắn layer qua applyRigAction (dùng chung UI/MCP)', () => {
    const next = applyRigAction(composite(), {
      action: 'apply-creature-rig',
      species: 'spider',
      layerSizes: { 'l-1': { w: 400, h: 400 } }
    })
    expect(next.rig?.bones.length).toBe(buildCreatureRig('spider').bones.length)
    expect(next.rig?.clips?.map((c) => c.id)).toEqual(['clip-spider-walk', 'clip-spider-idle'])
    expect(next.layers[0].boneId).toBe('bone-spider-thorax')
    const r = skeletonRect(next.rig!.bones)
    expect(r.maxX - r.minX).toBeLessThanOrEqual(400)
    const bare = applyRigAction(composite(), { action: 'apply-creature-rig', species: 'snake', includeClips: false, autoBind: false })
    expect(Object.keys(bare.rig!.tracks)).toHaveLength(0)
    expect(bare.layers[0].boneId).toBeUndefined()
  })
})
