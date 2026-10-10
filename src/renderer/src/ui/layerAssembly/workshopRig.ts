import type { AnimationClip, BoneKeyframe, LayerBone, LayerRig } from '@shared/layerRig'
import type { LayerComposite } from './types'
import {
  createHumanoidBones,
  createSimpleChainBones,
  applyMotionPresetToRig,
  createClipFromPreset,
  type ProceduralMotionPreset
} from './workshopRigPresets'
import { retargetAnimationClip } from './workshopRetarget'

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

export type RigAction =
  | { action: 'add-bone'; bone: LayerBone }
  | { action: 'update-bone'; boneId: string; patch: Partial<Omit<LayerBone, 'id'>> }
  | { action: 'delete-bone'; boneId: string }
  | { action: 'bind'; boneId?: string; layerIds: string[]; mode?: 'rigid' | 'soft' }
  | { action: 'set-key'; boneId: string; key: BoneKeyframe }
  | { action: 'delete-key'; boneId: string; time: number }
  | { action: 'settings'; duration?: number; loop?: boolean }
  | { action: 'apply-template'; template: 'humanoid' | 'simple-chain' }
  | { action: 'apply-preset-animation'; preset: ProceduralMotionPreset; asNewClip?: boolean; clipName?: string }
  | { action: 'clear-animation' }
  | { action: 'add-clip'; clip: AnimationClip }
  | { action: 'switch-clip'; clipId: string }
  | { action: 'rename-clip'; clipId: string; name: string }
  | { action: 'delete-clip'; clipId: string }
  | { action: 'duplicate-clip'; clipId: string }
  | { action: 'inherit-clip'; sourceClip: AnimationClip; sourceBones: LayerBone[]; clipName?: string }

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
        !['smooth', 'linear', 'hold'].includes(key.easing)
      ) {
        throw new Error('Invalid or unsorted bone keyframes')
      }
      previous = key.time
    }
  }
  if (composite.layers.some((l) => l.boneId && !ids.has(l.boneId))) throw new Error('Layer references a missing bone')
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
  if (action.action === 'set-key') {
    const keys = rig.tracks[action.boneId] ?? []
    rig.tracks[action.boneId] = [
      ...keys.filter((k) => Math.abs(k.time - action.key.time) > 0.0001),
      { ...action.key }
    ].sort((a, b) => a.time - b.time)
  }
  if (action.action === 'delete-key') {
    rig.tracks[action.boneId] = (rig.tracks[action.boneId] ?? []).filter(
      (k) => Math.abs(k.time - action.time) > 0.0001
    )
  }
  if (action.action === 'settings') {
    if (action.duration !== undefined) rig.duration = action.duration
    if (action.loop !== undefined) rig.loop = action.loop
  }
  if (action.action === 'apply-template') {
    const templateBones = action.template === 'humanoid' ? createHumanoidBones() : createSimpleChainBones()
    rig.bones = templateBones
    rig.tracks = {}
    rig.clips = [
      {
        id: 'clip-default',
        name: 'Động tác 1',
        duration: 2.0,
        loop: true,
        tracks: {}
      }
    ]
    rig.activeClipId = 'clip-default'
    const validIds = new Set(templateBones.map((b) => b.id))
    layers = layers.map((l) => (l.boneId && !validIds.has(l.boneId) ? { ...l, boneId: undefined } : l))
  }
  if (action.action === 'apply-preset-animation') {
    if (action.asNewClip) {
      const clip = createClipFromPreset(action.preset, rig.bones, action.clipName)
      rig.clips = [...(rig.clips ?? []), clip]
      rig.activeClipId = clip.id
      rig.tracks = structuredClone(clip.tracks)
      rig.duration = clip.duration
      rig.loop = clip.loop
    } else {
      const res = applyMotionPresetToRig({ ...composite, layers, rig }, action.preset)
      validateRig(res)
      return res
    }
  }
  if (action.action === 'clear-animation') {
    rig.tracks = {}
  }

  // --- Quản lý Clips Động Tác ---
  if (action.action === 'add-clip') {
    rig.clips = [...(rig.clips ?? []), action.clip]
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
    if (rig.clips && rig.clips.length > 1) {
      const remaining = rig.clips.filter((c) => c.id !== action.clipId)
      rig.clips = remaining
      if (rig.activeClipId === action.clipId) {
        const nextActive = remaining[0]
        rig.activeClipId = nextActive.id
        rig.tracks = structuredClone(nextActive.tracks)
        rig.duration = nextActive.duration
        rig.loop = nextActive.loop
      }
    }
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

