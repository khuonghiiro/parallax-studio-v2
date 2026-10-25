import type { AnimationClip, BoneEasing, BoneKeyframe, LayerBone, LayerRig, MotionViewAngle } from '@shared/layerRig'
import { sampleBonePose } from '../../engine/layerRig'
import type { LayerComposite } from './types'
import {
  createHumanoidBones,
  createFullHumanoidBones,
  createHandDetailedBones,
  createFootDetailedBones,
  createSimpleChainBones,
  applyMotionPresetToRig,
  createClipFromPreset,
  type ProceduralMotionPreset
} from './workshopRigPresets'
import { applyAnimationAction, isAnimationAction, validateCurve, type AnimationAction, type AnimationBatch } from './workshopAnimation'
export type { BonePoseEntry } from './workshopAnimation'
import { retargetAnimationClip } from './workshopRetarget'
import { autoBindLayersToMixamoBones } from './workshopMixamoAutoRig'
import { applyAnimTool, type AnimToolOp } from './workshopAnimTools'
import {
  autoSortLayersZDepth25D,
  buildAnatomicalBonesFromLayers,
  smartAutoBindCompositeLayers,
  type SmartRigArchetype
} from './workshopSmartRig25D'
import {
  applyLayerParallax25DOffset,
  computeParallax25DPose,
  createParallax25DClip,
  generateParameterizedCycle25D,
  type Parallax25DClipPreset,
  type ParameterizedCycle25DConfig
} from './workshopParallax25D'

export type RigTemplateType = 'humanoid' | 'humanoid-full' | 'hand-detailed' | 'foot-detailed' | 'simple-chain'

export const emptyRig = (): LayerRig => ({
  bones: [],
  duration: 4,
  loop: true,
  tracks: {},
  clips: [
    {
      id: 'clip-default',
      name: 'Động tác 1',
      duration: 4,
      loop: true,
      tracks: {}
    }
  ],
  activeClipId: 'clip-default'
})

/** Đảm bảo rig luôn có danh sách clips hợp lệ và đồng bộ với activeClip */
export function ensureRigClips(rig: LayerRig): { rig: LayerRig; activeClip: AnimationClip } {
  const clips =
    Array.isArray(rig.clips) && rig.clips.length > 0
      ? [...rig.clips]
      : [
          {
            id: 'clip-default',
            name: 'Động tác 1',
            duration: rig.duration || 2.0,
            loop: rig.loop ?? true,
            tracks: structuredClone(rig.tracks || {})
          }
        ]

  const activeId =
    rig.activeClipId && clips.some((c) => c.id === rig.activeClipId)
      ? rig.activeClipId
      : clips[0].id

  const activeIndex = clips.findIndex((c) => c.id === activeId)
  const activeClip = clips[activeIndex >= 0 ? activeIndex : 0]

  const nextRig: LayerRig = {
    ...rig,
    clips,
    activeClipId: activeClip.id,
    duration: activeClip.duration,
    loop: activeClip.loop,
    tracks: activeClip.tracks
  }

  return { rig: nextRig, activeClip }
}

/** Lấy danh sách các xương độc lập khác trên cùng layer uốn mềm (không bị gắn vào layer khác). */
export function extraSoftBoneIdsForLayer(
  layers: LayerComposite['layers'],
  rig: LayerRig | undefined,
  layerId: string,
  primaryBoneId?: string
): string[] {
  if (!rig?.bones.length) return []
  const otherBound = new Set<string>()
  for (const other of layers) {
    if (other.id === layerId || !other.boneId) continue
    let cur: string | undefined = other.boneId
    while (cur && !otherBound.has(cur)) {
      otherBound.add(cur)
      cur = rig.bones.find((b) => b.id === cur)?.parentId
    }
  }
  return rig.bones
    .filter((b) => b.id !== primaryBoneId && !otherBound.has(b.id))
    .map((b) => b.id)
}

export type RigAction = AnimationAction | AnimationBatch
  | { action: 'add-bone'; bone: LayerBone }
  | { action: 'update-bone'; boneId: string; patch: Partial<Omit<LayerBone, 'id'>> }
  | { action: 'delete-bone'; boneId: string }
  | { action: 'bind'; boneId?: string; layerIds: string[]; mode?: 'rigid' | 'soft' }
  | { action: 'mirror-pose'; time: number }
  | { action: 'settings'; duration?: number; loop?: boolean }
  | { action: 'apply-template'; template: RigTemplateType }
  | { action: 'apply-preset-animation'; preset: ProceduralMotionPreset; asNewClip?: boolean; clipName?: string; viewAngle?: MotionViewAngle }
  | { action: 'clear-animation' }
  | { action: 'clear-bone-track'; boneId: string }
  | { action: 'anim-tool'; tool: AnimToolOp }
  | { action: 'add-clip'; clip: AnimationClip }
  | { action: 'switch-clip'; clipId: string }
  | { action: 'rename-clip'; clipId: string; name: string }
  | { action: 'delete-clip'; clipId: string }
  | { action: 'delete-all-clips' }
  | { action: 'duplicate-clip'; clipId: string }
  | { action: 'inherit-clip'; sourceClip: AnimationClip; sourceBones: LayerBone[]; clipName?: string }
  | { action: 'smart-auto-rig-25d'; archetype?: SmartRigArchetype; bindMode?: 'auto' | 'rigid' | 'soft'; includeStarterClips?: boolean; sortZDepth?: boolean }
  | { action: 'smart-auto-bind-25d'; bindMode?: 'auto' | 'rigid' | 'soft' }
  | { action: 'auto-sort-z-25d' }
  | { action: 'apply-parallax-25d-pose'; time: number; yawX: number; pitchY: number; intensity?: number; applyLayerTilt?: boolean }
  | { action: 'add-parallax-25d-clip'; preset: Parallax25DClipPreset; intensity?: number }
  | { action: 'add-parameterized-cycle-25d'; config: Partial<ParameterizedCycle25DConfig>; asNewClip?: boolean }
  | {
      action: 'apply-mixamo-rig-motion'
      bones: LayerBone[]
      clip?: AnimationClip
      clips?: AnimationClip[]
      replaceClips?: boolean
      autoBindSoft?: boolean
    }

export function validateRig(composite: LayerComposite): void {
  if (composite.layers.some((l) => l.bindingMode !== undefined && !['rigid', 'soft'].includes(l.bindingMode))) {
    throw new Error('Invalid binding mode')
  }
  const rig = composite.rig
  if (!rig) {
    if (composite.layers.some((l) => l.boneId)) throw new Error('Layer references a missing skeleton')
    return
  }
  if (!Array.isArray(rig.bones) || rig.bones.length > 128 || !rig.tracks || typeof rig.tracks !== 'object') {
    throw new Error('Invalid skeleton')
  }
  if (!Number.isFinite(rig.duration) || rig.duration < 0.1 || rig.duration > 120 || typeof rig.loop !== 'boolean') {
    throw new Error('Duration must be 0.1–120 seconds; loop must be boolean')
  }
  const ids = new Set(rig.bones.map((b) => b.id))
  if (ids.size !== rig.bones.length) throw new Error('Duplicate bone ID')
  for (const bone of rig.bones) {
    if (
      !bone.id ||
      typeof bone.id !== 'string' ||
      !bone.name ||
      typeof bone.name !== 'string' ||
      ![bone.x, bone.y, bone.length, bone.angle].every(Number.isFinite) ||
      bone.length < 1
    ) {
      throw new Error('Invalid bone')
    }
    const chain = new Set([bone.id])
    let parent = bone.parentId
    while (parent) {
      if (!ids.has(parent) || chain.has(parent)) throw new Error('Bone parent is missing or creates a cycle')
      chain.add(parent)
      parent = rig.bones.find((b) => b.id === parent)?.parentId
    }
  }
  for (const [id, keys] of Object.entries(rig.tracks)) {
    if (!ids.has(id) || !Array.isArray(keys) || keys.length > 2000) throw new Error('Invalid bone track')
    let previous = -1
    for (const key of keys) {
      if (
        ![key.time, key.x, key.y, key.rotation].every(Number.isFinite) ||
        key.time < 0 ||
        key.time > rig.duration ||
        key.time <= previous ||
        !['smooth', 'linear', 'hold', 'ease-in', 'ease-out', 'ease-in-out', 'bezier'].includes(key.easing)
      ) {
        throw new Error('Invalid or unsorted bone keyframes')
      }
      if (key.scaleX !== undefined && !Number.isFinite(key.scaleX)) throw new Error('Invalid scaleX')
      if (key.scaleY !== undefined && !Number.isFinite(key.scaleY)) throw new Error('Invalid scaleY')
      validateCurve(key.easing, key.bezier)
      previous = key.time
    }
  }
  if (composite.layers.some((l) => l.boneId && !ids.has(l.boneId))) throw new Error('Layer references a missing bone')
}

export function findMirrorBoneId(boneId: string, bones: LayerBone[]): string | null {
  const b = bones.find((item) => item.id === boneId)
  if (!b) return null
  const name = b.name.toLowerCase()
  const id = b.id.toLowerCase()

  const patterns: [RegExp, (m: string) => string][] = [
    [/\bleft\b/i, () => 'right'],
    [/\bright\b/i, () => 'left'],
    [/[-_]l\b/i, (m) => m[0] + 'r'],
    [/[-_]r\b/i, (m) => m[0] + 'l'],
    [/\.l\b/i, () => '.r'],
    [/\.r\b/i, () => '.l'],
    [/\btrái\b/i, () => 'phải'],
    [/\bphải\b/i, () => 'trái']
  ]

  for (const other of bones) {
    if (other.id === boneId) continue
    const oname = other.name.toLowerCase()
    const oid = other.id.toLowerCase()
    for (const [pat, rep] of patterns) {
      if (name.replace(pat, rep) === oname || id.replace(pat, rep) === oid) {
        return other.id
      }
    }
  }
  return null
}

/** Shared immutable operation: UI and MCP each commit this as one draft history entry. */
export function applyRigAction(composite: LayerComposite, action: RigAction): LayerComposite {
  const { rig: normalizedRig } = ensureRigClips(structuredClone(composite.rig ?? emptyRig()))
  const rig = normalizedRig
  let layers = composite.layers

  if ('boneId' in action && action.boneId && !rig.bones.some((b) => b.id === action.boneId)) {
    throw new Error('Unknown bone ID')
  }

  if (action.action === 'add-bone') rig.bones.push({ ...action.bone })
  if (action.action === 'update-bone') {
    rig.bones = rig.bones.map((b) => (b.id === action.boneId ? { ...b, ...action.patch, id: b.id } : b))
  }
  if (action.action === 'delete-bone') {
    const removed = new Set([action.boneId])
    for (let i = 0; i < rig.bones.length; i++) {
      rig.bones.forEach((b) => {
        if (b.parentId && removed.has(b.parentId)) removed.add(b.id)
      })
    }
    rig.bones = rig.bones.filter((b) => !removed.has(b.id))
    removed.forEach((id) => delete rig.tracks[id])
    if (rig.clips) {
      rig.clips.forEach((c) => {
        removed.forEach((id) => delete c.tracks[id])
      })
    }
    layers = layers.map((l) => (l.boneId && removed.has(l.boneId) ? { ...l, boneId: undefined } : l))
  }
  if (action.action === 'bind') {
    if (action.layerIds.some((id) => !layers.some((l) => l.id === id))) throw new Error('Unknown layer ID')
    layers = layers.map((l) =>
      action.layerIds.includes(l.id) && !l.locked
        ? { ...l, boneId: action.boneId, bindingMode: action.boneId ? (action.mode ?? 'rigid') : undefined }
        : l
    )
  }
  if (isAnimationAction(action)) applyAnimationAction(rig, action)
  if (action.action === 'batch') {
    if (!action.operations.length || action.operations.length > 200) throw new Error('Batch requires 1–200 operations')
    for (const operation of action.operations) applyAnimationAction(rig, operation)
  }
  if (action.action === 'mirror-pose') {
    const time = action.time
    const processed = new Set<string>()
    for (const bone of rig.bones) {
      if (processed.has(bone.id)) continue
      const mirrorId = findMirrorBoneId(bone.id, rig.bones)
      if (mirrorId && mirrorId !== bone.id) {
        const poseA = sampleBonePose({ ...rig, loop: false }, bone.id, time)
        const poseB = sampleBonePose({ ...rig, loop: false }, mirrorId, time)
        const keysA = rig.tracks[bone.id] ?? []
        const keysB = rig.tracks[mirrorId] ?? []
        const keyA: BoneKeyframe = {
          time,
          x: -poseB.x,
          y: poseB.y,
          rotation: -poseB.rotation,
          scaleX: poseB.scaleX ?? 1,
          scaleY: poseB.scaleY ?? 1,
          easing: 'smooth'
        }
        const keyB: BoneKeyframe = {
          time,
          x: -poseA.x,
          y: poseA.y,
          rotation: -poseA.rotation,
          scaleX: poseA.scaleX ?? 1,
          scaleY: poseA.scaleY ?? 1,
          easing: 'smooth'
        }
        rig.tracks[bone.id] = [...keysA.filter((k) => Math.abs(k.time - time) > 0.0001), keyA].sort((a, b) => a.time - b.time)
        rig.tracks[mirrorId] = [...keysB.filter((k) => Math.abs(k.time - time) > 0.0001), keyB].sort((a, b) => a.time - b.time)
        processed.add(bone.id)
        processed.add(mirrorId)
      } else {
        const pose = sampleBonePose({ ...rig, loop: false }, bone.id, time)
        const keys = rig.tracks[bone.id] ?? []
        const key: BoneKeyframe = {
          time,
          x: -pose.x,
          y: pose.y,
          rotation: -pose.rotation,
          scaleX: pose.scaleX ?? 1,
          scaleY: pose.scaleY ?? 1,
          easing: 'smooth'
        }
        rig.tracks[bone.id] = [...keys.filter((k) => Math.abs(k.time - time) > 0.0001), key].sort((a, b) => a.time - b.time)
        processed.add(bone.id)
      }
    }
  }
  if (action.action === 'settings') {
    if (action.duration !== undefined) rig.duration = action.duration
    if (action.loop !== undefined) rig.loop = action.loop
  }
  if (action.action === 'apply-template') {
    let templateBones: LayerBone[]
    let defaultPreset: ProceduralMotionPreset = 'walk'
    switch (action.template) {
      case 'humanoid-full':
        templateBones = createFullHumanoidBones()
        defaultPreset = 'walk'
        break
      case 'hand-detailed':
        templateBones = createHandDetailedBones()
        defaultPreset = 'hand-clench'
        break
      case 'foot-detailed':
        templateBones = createFootDetailedBones()
        defaultPreset = 'foot-roll'
        break
      case 'simple-chain':
        templateBones = createSimpleChainBones()
        defaultPreset = 'sway'
        break
      case 'humanoid':
      default:
        templateBones = createHumanoidBones()
        defaultPreset = 'walk'
        break
    }
    rig.bones = templateBones
    const initialClip = createClipFromPreset(defaultPreset, templateBones, undefined, 'front')
    rig.tracks = structuredClone(initialClip.tracks)
    rig.duration = initialClip.duration
    rig.loop = initialClip.loop
    rig.clips = [initialClip]
    rig.activeClipId = initialClip.id
    const validIds = new Set(templateBones.map((b) => b.id))
    layers = layers.map((l) => (l.boneId && !validIds.has(l.boneId) ? { ...l, boneId: undefined } : l))
  }
  if (action.action === 'apply-preset-animation') {
    if (action.asNewClip) {
      const clip = createClipFromPreset(action.preset, rig.bones, action.clipName, action.viewAngle)
      rig.clips = [...(rig.clips ?? []), clip]
      rig.activeClipId = clip.id
      rig.tracks = structuredClone(clip.tracks)
      rig.duration = clip.duration
      rig.loop = clip.loop
    } else {
      const res = applyMotionPresetToRig({ ...composite, layers, rig }, action.preset, action.viewAngle)
      validateRig(res)
      return res
    }
  }
  if (action.action === 'clear-animation') {
    rig.tracks = {}
    if (rig.activeClipId && rig.clips) {
      rig.clips = rig.clips.map((c) => (c.id === rig.activeClipId ? { ...c, tracks: {} } : c))
    }
  }
  if (action.action === 'clear-bone-track') {
    delete rig.tracks[action.boneId]
    if (rig.activeClipId && rig.clips) {
      rig.clips = rig.clips.map((c) => {
        if (c.id !== rig.activeClipId) return c
        const nextTracks = { ...c.tracks }
        delete nextTracks[action.boneId]
        return { ...c, tracks: nextTracks }
      })
    }
  }

  if (action.action === 'anim-tool') applyAnimTool(rig, action.tool)

  if (action.action === 'smart-auto-rig-25d') {
    const built = buildAnatomicalBonesFromLayers({ ...composite, layers }, action.archetype ?? 'auto')
    rig.bones = built.bones
    if (action.sortZDepth) {
      layers = autoSortLayersZDepth25D(layers)
    }
    layers = smartAutoBindCompositeLayers(layers, rig.bones, action.bindMode ?? 'auto')
    if (action.includeStarterClips !== false && built.clips.length > 0) {
      rig.clips = built.clips
      rig.activeClipId = built.clips[0].id
      rig.tracks = structuredClone(built.clips[0].tracks)
      rig.duration = built.clips[0].duration
      rig.loop = built.clips[0].loop
    }
  }
  if (action.action === 'smart-auto-bind-25d') {
    layers = smartAutoBindCompositeLayers(layers, rig.bones, action.bindMode ?? 'auto')
  }
  if (action.action === 'auto-sort-z-25d') {
    layers = autoSortLayersZDepth25D(layers)
  }
  if (action.action === 'apply-parallax-25d-pose') {
    const poses = computeParallax25DPose(rig.bones, action.yawX, action.pitchY, action.intensity ?? 1.0)
    applyAnimationAction(rig, { action: 'set-pose', time: action.time, poses })
    if (action.applyLayerTilt) {
      layers = applyLayerParallax25DOffset(layers, action.yawX, action.pitchY, action.intensity ?? 1.0)
    }
  }
  if (action.action === 'add-parallax-25d-clip') {
    const clip = createParallax25DClip(action.preset, rig.bones, action.intensity ?? 1.0)
    const existing = rig.clips ?? []
    const isOnlyEmpty = existing.length === 1 && Object.keys(existing[0].tracks || {}).length === 0
    rig.clips = isOnlyEmpty ? [clip] : [...existing, clip]
    rig.activeClipId = clip.id
    rig.tracks = structuredClone(clip.tracks)
    rig.duration = clip.duration
    rig.loop = clip.loop
  }
  if (action.action === 'add-parameterized-cycle-25d') {
    const clip = generateParameterizedCycle25D(rig.bones, action.config)
    const existing = rig.clips ?? []
    const isOnlyEmpty = existing.length === 1 && Object.keys(existing[0].tracks || {}).length === 0
    if (action.asNewClip === false && rig.activeClipId && existing.some((c) => c.id === rig.activeClipId)) {
      rig.clips = existing.map((c) => (c.id === rig.activeClipId ? { ...clip, id: c.id } : c))
      rig.tracks = structuredClone(clip.tracks)
      rig.duration = clip.duration
      rig.loop = clip.loop
    } else {
      rig.clips = isOnlyEmpty ? [clip] : [...existing, clip]
      rig.activeClipId = clip.id
      rig.tracks = structuredClone(clip.tracks)
      rig.duration = clip.duration
      rig.loop = clip.loop
    }
  }

  // --- Quản lý Clips Động Tác ---
  if (action.action === 'add-clip') {
    const existing = rig.clips ?? []
    const isOnlyEmptyDefault =
      existing.length === 1 &&
      existing[0].id === 'clip-default' &&
      Object.keys(existing[0].tracks || {}).length === 0

    rig.clips = isOnlyEmptyDefault ? [action.clip] : [...existing, action.clip]
    rig.activeClipId = action.clip.id
    rig.tracks = structuredClone(action.clip.tracks)
    rig.duration = action.clip.duration
    rig.loop = action.clip.loop
  }
  if (action.action === 'switch-clip') {
    const targetClip = rig.clips?.find((c) => c.id === action.clipId)
    if (targetClip) {
      // Lưu lại tracks/duration/loop hiện tại vào clip cũ
      if (rig.activeClipId && rig.clips) {
        rig.clips = rig.clips.map((c) =>
          c.id === rig.activeClipId
            ? { ...c, duration: rig.duration, loop: rig.loop, tracks: structuredClone(rig.tracks) }
            : c
        )
      }
      rig.activeClipId = targetClip.id
      rig.tracks = structuredClone(targetClip.tracks)
      rig.duration = targetClip.duration
      rig.loop = targetClip.loop
    }
  }
  if (action.action === 'rename-clip') {
    if (rig.clips) {
      rig.clips = rig.clips.map((c) => (c.id === action.clipId ? { ...c, name: action.name } : c))
    }
  }
  if (action.action === 'delete-clip') {
    const remaining = (rig.clips ?? []).filter((c) => c.id !== action.clipId)
    if (remaining.length > 0) {
      rig.clips = remaining
      if (rig.activeClipId === action.clipId) {
        const nextActive = remaining[0]
        rig.activeClipId = nextActive.id
        rig.tracks = structuredClone(nextActive.tracks)
        rig.duration = nextActive.duration
        rig.loop = nextActive.loop
      }
    } else {
      const emptyClip: AnimationClip = {
        id: 'clip-default',
        name: 'Tư thế tĩnh',
        duration: 2.0,
        loop: true,
        tracks: {}
      }
      rig.clips = [emptyClip]
      rig.activeClipId = emptyClip.id
      rig.tracks = {}
      rig.duration = emptyClip.duration
      rig.loop = emptyClip.loop
    }
  }
  if (action.action === 'delete-all-clips') {
    const emptyClip: AnimationClip = {
      id: 'clip-default',
      name: 'Tư thế tĩnh',
      duration: 2.0,
      loop: true,
      tracks: {}
    }
    rig.clips = [emptyClip]
    rig.activeClipId = emptyClip.id
    rig.tracks = {}
    rig.duration = emptyClip.duration
    rig.loop = emptyClip.loop
  }
  if (action.action === 'duplicate-clip') {
    const source = rig.clips?.find((c) => c.id === action.clipId)
    if (source) {
      const dup: AnimationClip = {
        ...structuredClone(source),
        id: `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: `${source.name} (Bản sao)`
      }
      rig.clips = [...(rig.clips ?? []), dup]
      rig.activeClipId = dup.id
      rig.tracks = structuredClone(dup.tracks)
      rig.duration = dup.duration
      rig.loop = dup.loop
    }
  }
  if (action.action === 'inherit-clip') {
    const retargeted = retargetAnimationClip(action.sourceClip, action.sourceBones, rig.bones, {
      clipName: action.clipName,
      scalePositionWithBoneLength: true
    })
    const existing = rig.clips ?? []
    const isOnlyEmptyDefault =
      existing.length === 1 &&
      existing[0].id === 'clip-default' &&
      Object.keys(existing[0].tracks || {}).length === 0

    if (isOnlyEmptyDefault) {
      rig.clips = [retargeted]
    } else {
      rig.clips = [...existing, retargeted]
    }
    rig.activeClipId = retargeted.id
    rig.tracks = structuredClone(retargeted.tracks)
    rig.duration = retargeted.duration
    rig.loop = retargeted.loop
  }
  if (action.action === 'apply-mixamo-rig-motion') {
    rig.bones = action.bones.map((b) => ({ ...b }))
    if (action.autoBindSoft !== false) {
      layers = autoBindLayersToMixamoBones(layers, rig.bones)
    } else {
      const validIds = new Set(rig.bones.map((b) => b.id))
      layers = layers.map((l) => (l.boneId && !validIds.has(l.boneId) ? { ...l, boneId: undefined } : l))
    }

    const existing = rig.clips ?? []
    const isOnlyEmptyDefault =
      existing.length === 1 &&
      Object.keys(existing[0].tracks || {}).length === 0

    if (action.clips && action.clips.length > 0) {
      const incoming = action.clips.map((c) => structuredClone(c))
      rig.clips = action.replaceClips || isOnlyEmptyDefault || existing.length === 0 ? incoming : [...existing, ...incoming]
      const first = incoming[0]
      rig.activeClipId = first.id
      rig.tracks = structuredClone(first.tracks)
      rig.duration = first.duration
      rig.loop = first.loop
    } else if (action.clip) {
      if (action.replaceClips || isOnlyEmptyDefault || existing.length === 0) {
        rig.clips = [action.clip]
      } else {
        rig.clips = [...existing, action.clip]
      }
      rig.activeClipId = action.clip.id
      rig.tracks = structuredClone(action.clip.tracks)
      rig.duration = action.clip.duration
      rig.loop = action.clip.loop
    }
  }

  // Đồng bộ tracks/duration/loop thay đổi vào activeClip trong clips
  if (rig.clips && rig.activeClipId) {
    rig.clips = rig.clips.map((c) =>
      c.id === rig.activeClipId
        ? {
            ...c,
            duration: rig.duration,
            loop: rig.loop,
            tracks: structuredClone(rig.tracks)
          }
        : c
    )
  }

  const next = { ...composite, layers, rig }
  validateRig(next)
  return next
}

