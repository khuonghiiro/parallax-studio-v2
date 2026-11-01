import type { AnimationClip, LayerBone, LayerRig } from '@shared/layerRig'
import type { AssembledLayerItem, LayerComposite } from './types'
import { buildMirroredBoneChain, computeBoneTail } from './mohoRigHelpers'
import { rotatePoint } from '../../engine/layerRig'
import { buildCreatureRig, isSideViewCreature } from './creatures/creatureRigBuilders'
import { buildCreatureClips } from './creatures/creatureRigMotion'
import { autoBindCreatureLayers, computeLayersRect, detectCreatureFacing, fitBonesToRect } from './creatures/creatureRigFit'
import { CREATURE_SPECIES_IDS } from './creatures/creatureRigTypes'
import type {
  CreatureBindMode,
  CreatureRigOptions,
  CreatureSpecies,
  LayerPixelSize
} from './creatures/creatureRigTypes'

/**
 * Thao tác dựng KẾT CẤU khung xương (structure) chuẩn Moho / Adobe Animate:
 * - `apply-creature-rig`: dựng khung xương sinh vật từ thư viện (nhện, cá, ngựa, chim…), khớp vào ảnh và tự gắn layer.
 * - `add-bone-chain`: vẽ chuỗi N đốt nối tiếp (Animate Bone Tool click nối liên tục).
 * - `subdivide-bone`: chia một xương thành N đốt đều nhau (đuôi, xúc tu, thân rắn).
 * - `radial-array-bone`: nhân bản cả nhánh xương xoay quanh khớp gốc (chân nhện, xúc tu, cánh hoa) và tuỳ chọn đối xứng L⇄R.
 */
export type RigStructureAction =
  | {
      action: 'apply-creature-rig'
      species: CreatureSpecies
      options?: CreatureRigOptions
      fitToLayers?: boolean
      autoBind?: boolean
      bindMode?: CreatureBindMode
      includeClips?: boolean
      layerSizes?: Record<string, LayerPixelSize>
    }
  | {
      action: 'add-bone-chain'
      parentId?: string
      start?: { x: number; y: number }
      angle?: number
      length: number
      segments: number
      namePrefix?: string
      idPrefix?: string
    }
  | { action: 'subdivide-bone'; boneId: string; segments: number }
  | { action: 'radial-array-bone'; boneId: string; count: number; stepAngle: number; mirror?: boolean }

const STRUCTURE_ACTIONS = new Set(['apply-creature-rig', 'add-bone-chain', 'subdivide-bone', 'radial-array-bone'])
export const MAX_RIG_BONES = 128

export function isRigStructureAction(action: { action: string }): action is RigStructureAction {
  return STRUCTURE_ACTIONS.has(action.action)
}

const clampInt = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number.isFinite(v) ? v : min)))
const r2 = (n: number) => Number(n.toFixed(2)) || 0

function uniqueId(base: string, taken: Set<string>): string {
  let id = base
  let n = 2
  while (taken.has(id)) id = `${base}-${n++}`
  taken.add(id)
  return id
}

function ensureCapacity(rig: LayerRig, extra: number): void {
  if (rig.bones.length + extra > MAX_RIG_BONES) {
    throw new Error(`Skeleton is limited to ${MAX_RIG_BONES} bones (current ${rig.bones.length}, adding ${extra})`)
  }
}

/** Danh sách xương của nhánh (xương gốc + mọi hậu duệ), giữ thứ tự gốc → ngọn. */
export function collectBranch(bones: LayerBone[], rootId: string): LayerBone[] {
  const ids = new Set([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const b of bones) {
      if (b.parentId && ids.has(b.parentId) && !ids.has(b.id)) {
        ids.add(b.id)
        grew = true
      }
    }
  }
  return bones.filter((b) => ids.has(b.id))
}

function emptyClipSet(rig: LayerRig): void {
  const clip: AnimationClip = { id: 'clip-default', name: 'Động tác 1', duration: rig.duration || 2, loop: true, tracks: {} }
  rig.tracks = {}
  rig.clips = [clip]
  rig.activeClipId = clip.id
}

function applyCreatureRig(
  rig: LayerRig,
  composite: LayerComposite,
  layers: AssembledLayerItem[],
  action: Extract<RigStructureAction, { action: 'apply-creature-rig' }>
): AssembledLayerItem[] {
  if (!CREATURE_SPECIES_IDS.includes(action.species)) throw new Error(`Unknown creature species: ${action.species}`)
  const sideView = isSideViewCreature(action.species)
  const options: CreatureRigOptions = { ...action.options }
  if (sideView && !options.facing) options.facing = detectCreatureFacing({ ...composite, layers }) ?? 'left'
  const build = buildCreatureRig(action.species, options)
  const sizes = action.layerSizes ?? {}
  let bones = build.bones
  const rect = action.fitToLayers === false ? null : computeLayersRect({ ...composite, layers }, sizes)
  if (rect) bones = fitBonesToRect(bones, rect)
  const fitted = { ...build, bones }
  rig.bones = bones
  if (action.includeClips === false) {
    emptyClipSet(rig)
  } else {
    const offsetScale = build.bones[0] ? bones[0].length / Math.max(1, build.bones[0].length) : 1
    const clips = buildCreatureClips(fitted, sideView, offsetScale)
    if (rig.fps) clips.forEach((c) => (c.fps = rig.fps))
    rig.clips = clips
    rig.activeClipId = clips[0].id
    rig.tracks = structuredClone(clips[0].tracks)
    rig.duration = clips[0].duration
    rig.loop = clips[0].loop
  }
  if (action.autoBind === false) {
    const valid = new Set(bones.map((b) => b.id))
    return layers.map((l) => (l.boneId && !valid.has(l.boneId) ? { ...l, boneId: undefined } : l))
  }
  return autoBindCreatureLayers(layers, fitted, action.bindMode ?? 'auto', sizes)
}

function addBoneChain(rig: LayerRig, action: Extract<RigStructureAction, { action: 'add-bone-chain' }>): void {
  const n = clampInt(action.segments, 1, 16)
  ensureCapacity(rig, n)
  const parent = action.parentId ? rig.bones.find((b) => b.id === action.parentId) : undefined
  if (action.parentId && !parent) throw new Error('Unknown bone ID')
  const start = action.start ?? (parent ? computeBoneTail(parent) : { x: 0, y: 0 })
  const angle = Number.isFinite(action.angle) ? (action.angle as number) : (parent?.angle ?? -90)
  const total = Math.max(n * 4, Number.isFinite(action.length) ? action.length : n * 40)
  const segLen = total / n
  const taken = new Set(rig.bones.map((b) => b.id))
  const prefix = action.idPrefix?.trim() || `bone-chain-${Date.now().toString(36)}`
  const rad = (angle * Math.PI) / 180
  let parentId = parent?.id
  for (let i = 0; i < n; i++) {
    const id = uniqueId(`${prefix}-${i + 1}`, taken)
    rig.bones.push({
      id,
      name: `${action.namePrefix?.trim() || 'Chuỗi'} ${i + 1}`,
      ...(parentId ? { parentId } : {}),
      x: r2(start.x + Math.cos(rad) * segLen * i),
      y: r2(start.y + Math.sin(rad) * segLen * i),
      length: r2(segLen),
      angle: r2(angle),
      strength: 1
    })
    parentId = id
  }
}

function subdivideBone(rig: LayerRig, action: Extract<RigStructureAction, { action: 'subdivide-bone' }>): void {
  const n = clampInt(action.segments, 2, 16)
  ensureCapacity(rig, n - 1)
  const index = rig.bones.findIndex((b) => b.id === action.boneId)
  const bone = rig.bones[index]
  if (bone.pin) throw new Error('Pin bones cannot be subdivided')
  const tail = computeBoneTail(bone)
  const segLen = bone.length / n
  const rad = (bone.angle * Math.PI) / 180
  const taken = new Set(rig.bones.map((b) => b.id))
  const baseName = bone.name.replace(/\s+\d+$/, '')
  const created: LayerBone[] = []
  let parentId = bone.id
  for (let k = 2; k <= n; k++) {
    const id = uniqueId(`${bone.id}-d${k}`, taken)
    created.push({
      ...bone,
      id,
      name: `${baseName} ${k}`,
      parentId,
      x: r2(bone.x + Math.cos(rad) * segLen * (k - 1)),
      y: r2(bone.y + Math.sin(rad) * segLen * (k - 1)),
      length: r2(segLen)
    })
    parentId = id
  }
  const lastId = created[created.length - 1].id
  const snap = Math.max(8, bone.length * 0.1)
  rig.bones = rig.bones.map((b) => {
    if (b.id === bone.id) return { ...b, name: `${baseName} 1`, length: r2(segLen) }
    if (b.parentId === bone.id && Math.hypot(b.x - tail.x, b.y - tail.y) <= snap) return { ...b, parentId: lastId }
    return b
  })
  rig.bones.splice(index + 1, 0, ...created)
}

function radialArrayBone(
  rig: LayerRig,
  action: Extract<RigStructureAction, { action: 'radial-array-bone' }>
): void {
  const count = clampInt(action.count, 2, 12)
  const step = Math.max(-180, Math.min(180, Number.isFinite(action.stepAngle) ? action.stepAngle : 30))
  const branch = collectBranch(rig.bones, action.boneId)
  ensureCapacity(rig, branch.length * (count - 1) * (action.mirror ? 2 : 1))
  const pivot = { x: branch[0].x, y: branch[0].y }
  const taken = new Set(rig.bones.map((b) => b.id))
  const roots = [branch[0].id]
  for (let k = 1; k < count; k++) {
    const theta = step * k
    const idMap = new Map<string, string>()
    for (const b of branch) {
      const id = uniqueId(b.id.replace(/(-[lr])?$/, `-a${k + 1}$1`), taken)
      idMap.set(b.id, id)
      const p = rotatePoint(b.x - pivot.x, b.y - pivot.y, theta)
      rig.bones.push({
        ...b,
        id,
        name: `${b.name} #${k + 1}`,
        parentId: b.parentId ? (idMap.get(b.parentId) ?? b.parentId) : undefined,
        x: r2(pivot.x + p.x),
        y: r2(pivot.y + p.y),
        angle: r2(b.angle + theta)
      })
    }
    roots.push(idMap.get(branch[0].id)!)
  }
  // Mọi bản sao dùng chung khớp gốc nên chỉ nhận diện cặp đối xứng theo hậu tố ID (-l/-r), không theo vị trí.
  if (!action.mirror || Math.abs(pivot.x) < 4) return
  for (const rootId of roots) {
    if (idSuffixTwin(rootId, rig.bones)) continue
    rig.bones.push(...buildMirroredBoneChain(rig.bones, rootId, idSuffixTwin))
  }
}

/** Tìm xương đối xứng chỉ dựa vào hậu tố ID `-l` ⇄ `-r` (hoặc `_l`, `.l`). */
export function idSuffixTwin(id: string, bones: LayerBone[]): string | null {
  const m = id.match(/^(.*[-_.])([lr])$/i)
  if (!m) return null
  const twin = `${m[1]}${m[2].toLowerCase() === 'l' ? 'r' : 'l'}`
  return bones.some((b) => b.id === twin) ? twin : null
}

/** Áp thao tác kết cấu lên rig (đã clone) và trả về danh sách layer mới (có thể đổi liên kết xương). */
export function applyRigStructureAction(
  rig: LayerRig,
  composite: LayerComposite,
  layers: AssembledLayerItem[],
  action: RigStructureAction
): AssembledLayerItem[] {
  switch (action.action) {
    case 'apply-creature-rig':
      return applyCreatureRig(rig, composite, layers, action)
    case 'add-bone-chain':
      addBoneChain(rig, action)
      return layers
    case 'subdivide-bone':
      subdivideBone(rig, action)
      return layers
    case 'radial-array-bone':
      radialArrayBone(rig, action)
      return layers
  }
}
