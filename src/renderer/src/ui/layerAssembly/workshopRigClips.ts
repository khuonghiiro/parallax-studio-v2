import type { AnimationClip, BoneKeyframe, LayerBone, LayerRig } from '@shared/layerRig'
import { sampleBonePose } from '../../engine/layerRig'
import { retargetAnimationClip } from './workshopRetarget'

export type RigClipAction =
  | { action: 'add-clip'; clip: AnimationClip }
  | { action: 'switch-clip'; clipId: string }
  | { action: 'rename-clip'; clipId: string; name: string }
  | { action: 'delete-clip'; clipId: string }
  | { action: 'delete-all-clips' }
  | { action: 'duplicate-clip'; clipId: string }
  | { action: 'inherit-clip'; sourceClip: AnimationClip; sourceBones: LayerBone[]; clipName?: string }

export function isRigClipAction(action: { action: string }): action is RigClipAction {
  return (
    action.action === 'add-clip' ||
    action.action === 'switch-clip' ||
    action.action === 'rename-clip' ||
    action.action === 'delete-clip' ||
    action.action === 'delete-all-clips' ||
    action.action === 'duplicate-clip' ||
    action.action === 'inherit-clip'
  )
}

export function applyRigClipAction(rig: LayerRig, action: RigClipAction): void {
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
    if (action.clip.fps) rig.fps = action.clip.fps
    return
  }

  if (action.action === 'switch-clip') {
    const targetClip = rig.clips?.find((c) => c.id === action.clipId)
    if (!targetClip) return
    if (rig.activeClipId && rig.clips) {
      rig.clips = rig.clips.map((c) =>
        c.id === rig.activeClipId
          ? { ...c, duration: rig.duration, loop: rig.loop, fps: rig.fps ?? c.fps, tracks: structuredClone(rig.tracks) }
          : c
      )
    }
    rig.activeClipId = targetClip.id
    rig.tracks = structuredClone(targetClip.tracks)
    rig.duration = targetClip.duration
    rig.loop = targetClip.loop
    if (targetClip.fps) rig.fps = targetClip.fps
    return
  }

  if (action.action === 'rename-clip') {
    if (rig.clips) {
      rig.clips = rig.clips.map((c) => (c.id === action.clipId ? { ...c, name: action.name } : c))
    }
    return
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
        if (nextActive.fps) rig.fps = nextActive.fps
      }
    } else {
      const emptyClip: AnimationClip = {
        id: 'clip-default',
        name: 'Tư thế tĩnh',
        duration: 2.0,
        loop: true,
        fps: rig.fps,
        tracks: {}
      }
      rig.clips = [emptyClip]
      rig.activeClipId = emptyClip.id
      rig.tracks = {}
      rig.duration = emptyClip.duration
      rig.loop = emptyClip.loop
    }
    return
  }

  if (action.action === 'delete-all-clips') {
    const emptyClip: AnimationClip = {
      id: 'clip-default',
      name: 'Tư thế tĩnh',
      duration: 2.0,
      loop: true,
      fps: rig.fps,
      tracks: {}
    }
    rig.clips = [emptyClip]
    rig.activeClipId = emptyClip.id
    rig.tracks = {}
    rig.duration = emptyClip.duration
    rig.loop = emptyClip.loop
    return
  }

  if (action.action === 'duplicate-clip') {
    const source = rig.clips?.find((c) => c.id === action.clipId)
    if (!source) return
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
    if (dup.fps) rig.fps = dup.fps
    return
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

    rig.clips = isOnlyEmptyDefault ? [retargeted] : [...existing, retargeted]
    rig.activeClipId = retargeted.id
    rig.tracks = structuredClone(retargeted.tracks)
    rig.duration = retargeted.duration
    rig.loop = retargeted.loop
  }
}

/**
 * Adobe Animate `F5` (Insert Frame / Giữ dáng):
 * Chèn khoảng giữ tư thế hiện tại thêm `holdSeconds` giây tại thời điểm `time`,
 * đẩy toàn bộ keyframe phía sau `time` lùi về sau `+holdSeconds` và tự nối dài `rig.duration` khi cần.
 */
export function applyHoldFramesAction(
  rig: LayerRig,
  time: number,
  holdSeconds: number,
  boneId?: string
): void {
  const safeHold = Math.max(0.01, Math.min(30, Number(holdSeconds.toFixed(4))))
  const clampedTime = Math.max(0, Math.min(rig.duration, Number(time.toFixed(4))))
  const targetBones = boneId ? rig.bones.filter((b) => b.id === boneId) : rig.bones
  if (!targetBones.length) return

  const nextDuration = Math.min(120, Number((rig.duration + safeHold).toFixed(4)))
  if (!boneId || clampedTime + safeHold > rig.duration) {
    rig.duration = nextDuration
  }

  for (const b of targetBones) {
    const existing = rig.tracks[b.id] ?? []
    if (boneId || existing.length > 0) {
      const pose = sampleBonePose({ ...rig, loop: false }, b.id, clampedTime)
      const shifted: BoneKeyframe[] = []
      let hasStartAnchor = false
      for (const k of existing) {
        if (Math.abs(k.time - clampedTime) <= 1e-4) {
          hasStartAnchor = true
          shifted.push({ ...k })
        } else if (k.time > clampedTime + 1e-4) {
          shifted.push({
            ...k,
            time: Math.min(120, Number((k.time + safeHold).toFixed(4)))
          })
        } else {
          shifted.push({ ...k })
        }
      }
      if (!hasStartAnchor) {
        shifted.push({
          time: clampedTime,
          x: pose.x,
          y: pose.y,
          rotation: pose.rotation,
          scaleX: pose.scaleX ?? 1,
          scaleY: pose.scaleY ?? 1,
          easing: 'hold'
        })
      }
      const holdEndTime = Math.min(rig.duration, Number((clampedTime + safeHold).toFixed(4)))
      if (holdEndTime > clampedTime + 1e-4 && !shifted.some((k) => Math.abs(k.time - holdEndTime) <= 1e-4)) {
        shifted.push({
          time: holdEndTime,
          x: pose.x,
          y: pose.y,
          rotation: pose.rotation,
          scaleX: pose.scaleX ?? 1,
          scaleY: pose.scaleY ?? 1,
          easing: 'smooth'
        })
      }
      shifted.sort((a, c) => a.time - c.time)
      rig.tracks[b.id] = shifted
    }
  }
}
