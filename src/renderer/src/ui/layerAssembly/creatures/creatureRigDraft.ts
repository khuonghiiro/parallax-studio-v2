import type { LayerBone } from '@shared/layerRig'
import { mirrorAngleLimits } from '../boneConstraints'
import { computeBoneTail, mirrorAngleAcrossYAxis } from '../mohoRigHelpers'
import type { CreatureBoneKind, CreatureBoneRole, CreatureRigBuild, CreatureSpecies } from './creatureRigTypes'

export interface Pt {
  x: number
  y: number
}

export type AngleLimit = readonly [number, number] | null

export interface ChainSpec {
  /** Tiền tố ID, VD 'bone-spider-leg1'. ID mỗi đốt = `${idPrefix}-s${n}${idSuffix}` (hoặc idPrefix nếu chỉ 1 đốt). */
  idPrefix: string
  /** Tên từng đốt, VD ['Đùi', 'Ống', 'Bàn']. */
  names: string[]
  /** Hậu tố tên hiển thị, VD ' · Chân 1 Trái'. */
  nameSuffix?: string
  /** Hậu tố ID, VD '-l' để bộ đối xứng Moho nhận diện cặp Trái ⇄ Phải. */
  idSuffix?: string
  parentId?: string
  start: Pt
  angles: number[]
  lengths: number[]
  kind: CreatureBoneKind
  side?: 'l' | 'r' | 'c'
  group: string
  phase?: number
  limb?: 'front' | 'hind'
  /** Giới hạn góc riêng từng đốt (ưu tiên) hoặc `limit` chung cho cả chuỗi. */
  limits?: AngleLimit[]
  limit?: AngleLimit
  strength?: number
}

const round2 = (n: number) => Number(n.toFixed(2))

/** Bản nháp khung xương: gom xương + vai trò, sinh chuỗi đốt nối khít ngọn → gốc (hàn khớp 100%). */
export class CreatureRigDraft {
  readonly bones: LayerBone[] = []
  readonly roles: Record<string, CreatureBoneRole> = {}

  constructor(readonly species: CreatureSpecies) {}

  add(bone: LayerBone, role: Partial<CreatureBoneRole> & Pick<CreatureBoneRole, 'kind'>, limit: AngleLimit = null): LayerBone {
    const next: LayerBone = {
      ...bone,
      x: round2(bone.x),
      y: round2(bone.y),
      length: round2(bone.length),
      angle: round2(bone.angle),
      ...(limit ? { minAngle: limit[0], maxAngle: limit[1] } : {})
    }
    this.bones.push(next)
    this.roles[next.id] = {
      side: 'c',
      group: role.group ?? next.id,
      segment: 0,
      count: 1,
      phase: 0,
      sign: 1,
      ...role
    }
    return next
  }

  /** Tạo chuỗi đốt xương nối tiếp; trả về danh sách ID theo thứ tự gốc → ngọn. */
  chain(spec: ChainSpec): string[] {
    const ids: string[] = []
    let cursor = { ...spec.start }
    let parentId = spec.parentId
    const count = spec.angles.length
    for (let i = 0; i < count; i++) {
      const id = count === 1 ? `${spec.idPrefix}${spec.idSuffix ?? ''}` : `${spec.idPrefix}-s${i + 1}${spec.idSuffix ?? ''}`
      const limit = spec.limits?.[i] ?? spec.limit ?? null
      const bone = this.add(
        {
          id,
          name: `${spec.names[i] ?? `Đốt ${i + 1}`}${spec.nameSuffix ?? ''}`,
          parentId,
          x: cursor.x,
          y: cursor.y,
          length: spec.lengths[i] ?? spec.lengths[spec.lengths.length - 1],
          angle: spec.angles[i],
          ...(spec.strength ? { strength: spec.strength } : {})
        },
        {
          kind: spec.kind,
          side: spec.side ?? 'c',
          group: spec.group,
          segment: i,
          count,
          phase: spec.phase ?? 0,
          ...(spec.limb ? { limb: spec.limb } : {})
        },
        limit
      )
      ids.push(id)
      parentId = id
      cursor = computeBoneTail(bone)
    }
    return ids
  }

  tailOf(id: string): Pt {
    const bone = this.bones.find((b) => b.id === id)
    if (!bone) throw new Error(`Unknown draft bone ${id}`)
    return computeBoneTail(bone)
  }

  /**
   * Phản chiếu toàn bộ xương có hậu tố ID `-l` sang bên phải (`-r`) qua trục X = 0:
   * x → −x, góc → 180° − góc, giới hạn khớp và chiều chuyển động đảo dấu.
   */
  mirrorLeftSide(phaseOf?: (role: CreatureBoneRole) => number): void {
    const left = this.bones.filter((b) => /-l$/.test(b.id))
    const leftIds = new Set(left.map((b) => b.id))
    for (const b of left) {
      const role = this.roles[b.id]
      const id = b.id.replace(/-l$/, '-r')
      if (this.roles[id]) continue
      const parentId = b.parentId && leftIds.has(b.parentId) ? b.parentId.replace(/-l$/, '-r') : b.parentId
      this.bones.push({
        ...b,
        id,
        name: b.name.replace(/Trái/g, 'Phải'),
        parentId,
        x: round2(-b.x) || 0,
        angle: mirrorAngleAcrossYAxis(b.angle),
        ...mirrorAngleLimits(b)
      })
      this.roles[id] = {
        ...role,
        side: 'r',
        group: role.group.replace(/-l$/, '-r'),
        phase: phaseOf ? phaseOf(role) : role.phase,
        sign: role.sign === 1 ? -1 : 1
      }
    }
  }

  build(): CreatureRigBuild {
    return { species: this.species, bones: this.bones, roles: this.roles }
  }
}

/** Lật toàn bộ khung xương theo chiều ngang (đổi hướng mặt sinh vật nhìn ngang). */
export function flipCreatureBuild(build: CreatureRigBuild): CreatureRigBuild {
  const bones = build.bones.map((b) => ({
    ...b,
    x: round2(-b.x) || 0,
    angle: mirrorAngleAcrossYAxis(b.angle),
    ...mirrorAngleLimits(b)
  }))
  const roles: Record<string, CreatureBoneRole> = {}
  for (const [id, role] of Object.entries(build.roles)) {
    roles[id] = { ...role, sign: role.sign === 1 ? -1 : 1 }
  }
  return { ...build, bones, roles }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Độ dài các đốt thuôn dần từ gốc tới ngọn. */
export function taperLengths(count: number, first: number, ratio = 0.85): number[] {
  return Array.from({ length: count }, (_, i) => round2(first * Math.pow(ratio, i)))
}

export const LEG_SEGMENT_NAMES: Record<number, string[]> = {
  2: ['Đùi', 'Ống chân'],
  3: ['Đùi', 'Ống chân', 'Bàn chân'],
  4: ['Hông chân', 'Đùi', 'Ống chân', 'Bàn chân']
}

export function legNames(count: number): string[] {
  return LEG_SEGMENT_NAMES[count] ?? LEG_SEGMENT_NAMES[3]
}
