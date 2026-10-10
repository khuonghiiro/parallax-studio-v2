import type { BoneKeyframe, LayerBone } from '@shared/layerRig'
import type { Handler, Params } from '../types'
import { ParamError } from '../types'
import { bool, num, str, toPlain } from '../params'
import { getActiveLayerAssemblySession } from '../../ui/layerAssembly/layerAssemblyBridge'
import { applyRigAction, type RigAction } from '../../ui/layerAssembly/workshopRig'
import { getStoredComposites } from '../../ui/layerAssembly/layerAssemblyStorage'

export function activeWorkshop() {
  const session = getActiveLayerAssemblySession()
  if (!session) throw new ParamError('Open the layer assembly workshop first')
  return session
}

function bonePatch(p: Params): Partial<Omit<LayerBone, 'id'>> {
  const patch: Partial<Omit<LayerBone, 'id'>> = {}
  if (p.name !== undefined) patch.name = str(p, 'name', true)
  if (p.parent_id !== undefined) patch.parentId = str(p, 'parent_id') || undefined
  for (const field of ['x', 'y', 'length', 'angle'] as const) if (p[field] !== undefined) patch[field] = num(p, field, true)
  return patch
}

function rigAction(p: Params): RigAction {
  const action = str(p, 'action', true)
  if (action === 'add-bone') return { action, bone: { id: str(p, 'bone_id') ?? `bone-${crypto.randomUUID()}`,
    name: 'Xương mới', x: 0, y: 0, length: 80, angle: -90, ...bonePatch(p) } }
  if (action === 'settings') return { action, duration: num(p, 'duration'), loop: bool(p, 'loop') }
  if (action === 'apply-template') {
    const template = (str(p, 'template') ?? 'humanoid') as 'humanoid' | 'simple-chain'
    if (!['humanoid', 'simple-chain'].includes(template)) throw new ParamError('template must be humanoid or simple-chain')
    return { action, template }
  }
  if (action === 'apply-preset-animation') {
    const preset = (str(p, 'preset') ?? 'walk') as any
    const validPresets = ['walk', 'idle', 'wave', 'bow', 'run', 'jump', 'action', 'sway']
    if (!validPresets.includes(preset)) throw new ParamError(`preset must be one of: ${validPresets.join(', ')}`)
    return {
      action,
      preset,
      asNewClip: bool(p, 'as_new_clip') ?? false,
      clipName: str(p, 'clip_name') || undefined
    }
  }
  if (action === 'clear-animation') return { action }
  if (action === 'add-clip') {
    const clip = p.clip && typeof p.clip === 'object'
      ? (p.clip as any)
      : {
          id: str(p, 'clip_id') ?? `clip-${Date.now().toString(36)}`,
          name: str(p, 'name') ?? 'Động tác mới',
          duration: num(p, 'duration') ?? 2.0,
          loop: bool(p, 'loop') ?? true,
          tracks: (p.tracks as any) || {}
        }
    return { action, clip }
  }
  if (action === 'switch-clip') {
    return { action, clipId: str(p, 'clip_id', true) }
  }
  if (action === 'rename-clip') {
    return { action, clipId: str(p, 'clip_id', true), name: str(p, 'name', true) }
  }
  if (action === 'delete-clip') {
    return { action, clipId: str(p, 'clip_id', true) }
  }
  if (action === 'duplicate-clip') {
    return { action, clipId: str(p, 'clip_id', true) }
  }
  if (action === 'inherit-clip') {
    let sourceClip = p.source_clip as any
    let sourceBones = p.source_bones as any
    const sourceCompId = str(p, 'source_composite_id')
    if (sourceCompId) {
      const comps = getStoredComposites()
      const foundComp = comps.find((c: any) => c.id === sourceCompId)
      if (!foundComp || !foundComp.rig) {
        throw new ParamError(`Mẫu nguồn "${sourceCompId}" không tồn tại hoặc chưa gắn xương`)
      }
      sourceBones = foundComp.rig.bones
      const sourceClipId = str(p, 'source_clip_id')
      if (sourceClipId && Array.isArray(foundComp.rig.clips)) {
        sourceClip = foundComp.rig.clips.find((c: any) => c.id === sourceClipId)
      }
      if (!sourceClip) {
        sourceClip = foundComp.rig.clips?.[0] || {
          id: 'clip-default',
          name: foundComp.name,
          duration: foundComp.rig.duration,
          loop: foundComp.rig.loop,
          tracks: foundComp.rig.tracks
        }
      }
    }
    if (!sourceClip || !sourceBones) {
      throw new ParamError('Cần cung cấp "source_composite_id" hoặc ("source_clip" và "source_bones")')
    }
    return {
      action,
      sourceClip,
      sourceBones,
      clipName: str(p, 'clip_name') || str(p, 'name') || undefined
    }
  }
  if (action === 'bind') {
    if (!Array.isArray(p.layer_ids) || p.layer_ids.some((id) => typeof id !== 'string')) throw new ParamError('layer_ids must be a string array')
    const mode = str(p, 'binding_mode') ?? 'rigid'
    if (mode !== 'rigid' && mode !== 'soft') throw new ParamError('binding_mode must be rigid or soft')
    return { action, boneId: str(p, 'bone_id') || undefined, layerIds: p.layer_ids, mode }
  }
  const boneId = str(p, 'bone_id', true)
  if (action === 'update-bone') return { action, boneId, patch: bonePatch(p) }
  if (action === 'delete-bone') return { action, boneId }
  if (action === 'delete-key') return { action, boneId, time: num(p, 'time', true) }
  if (action === 'set-key') return { action, boneId, key: { time: num(p, 'time', true), x: num(p, 'x') ?? 0,
    y: num(p, 'y') ?? 0, rotation: num(p, 'rotation') ?? 0, easing: (str(p, 'easing') ?? 'smooth') as BoneKeyframe['easing'] } }
  throw new ParamError('Unknown rig action')
}

export const layerWorkshopRigCommands: Record<string, Handler> = {
  layer_assembly_rig: (p) => {
    const session = activeWorkshop()
    const action = rigAction(p)
    const next = applyRigAction(session.getComposite(), action)
    session.setComposite(next)
    return { ok: true, boneId: action.action === 'add-bone' ? action.bone.id : 'boneId' in action ? action.boneId : null, composite: toPlain(next) }
  },
  set_layer_assembly_playback: (p) => {
    const session = activeWorkshop()
    const time = num(p, 'time'), playing = bool(p, 'playing')
    if (time !== undefined && (time < 0 || time > (session.getComposite().rig?.duration ?? 4))) throw new ParamError('Time outside clip duration')
    if (time !== undefined) session.setTime(time)
    if (playing !== undefined) session.setIsPlaying(playing)
    if (session.getComposite().rig) session.setTab?.('animation')
    return { ok: true, time: time ?? session.getTime(), playing: playing ?? session.getIsPlaying() }
  },
  set_layer_assembly_panel: (p) => {
    const session = activeWorkshop()
    const tab = str(p, 'tab', true)
    if (!['layers', 'bones', 'animation'].includes(tab)) throw new ParamError('Invalid tab')
    const boneId = str(p, 'bone_id') || null
    if (boneId && !session.getComposite().rig?.bones.some((b) => b.id === boneId)) throw new ParamError('Unknown bone ID')
    session.setTab?.(tab as 'layers' | 'bones' | 'animation')
    session.setSelectedBoneId?.(boneId)
    session.setIsPlaying(false)
    session.setTime(0)
    return { ok: true, tab, boneId }
  }
}
