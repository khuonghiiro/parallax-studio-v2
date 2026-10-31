import type { LayerBone, MotionViewAngle } from '@shared/layerRig'
import type { Handler, Params } from '../types'
import { ParamError } from '../types'
import { bool, num, str, toPlain } from '../params'
import { getActiveLayerAssemblySession } from '../../ui/layerAssembly/layerAssemblyBridge'
import { applyRigAction, ensureRigClips, type RigAction } from '../../ui/layerAssembly/workshopRig'
import {
  applyBoneZOrderPreset,
  applyBoneZOrderStep,
  applyBoneZOrderValue,
  getBoneDepthSummary,
  type BoneDepthSemanticPreset
} from '../../ui/layerAssembly/workshopBoneDepthOrder'
import type { LayerComposite } from '../../ui/layerAssembly/types'
import { parseWorkshopAnimation } from './layerWorkshopAnimationParams'
import { getStoredComposites } from '../../ui/layerAssembly/layerAssemblyStorage'
import { setPlantSpineEditorState, getPlantSpineEditorState } from '../../ui/layerAssembly/plantSpineEditorStore'
import { setAnimAssist, getAnimAssist } from '../../ui/layerAssembly/animAssistStore'
import { getRigToolState, resetTestPoses, setRigToolState } from '../../ui/layerAssembly/rigToolStore'
import {
  autoDetectLandmarksFromComposite,
  buildHumanoidBonesFromLandmarks,
  buildMixamoClipForBones,
  createScaledLandmarks
} from '../../ui/layerAssembly/workshopMixamoAutoRig'

export function activeWorkshop() {
  const session = getActiveLayerAssemblySession()
  if (!session) throw new ParamError('Open the layer assembly workshop first')
  return session
}

function bonePatch(p: Params): Partial<Omit<LayerBone, 'id'>> {
  const patch: Partial<Omit<LayerBone, 'id'>> = {}
  if (p.name !== undefined) patch.name = str(p, 'name', true)
  if (p.parent_id !== undefined) patch.parentId = str(p, 'parent_id') || undefined
  for (const field of ['x', 'y', 'length', 'angle', 'strength'] as const) {
    if (p[field] !== undefined) patch[field] = num(p, field, true)
  }
  if (p.pin !== undefined) patch.pin = bool(p, 'pin')
  return patch
}

function rigAction(p: Params, composite?: LayerComposite, currentTime = 0): RigAction {
  const animation = parseWorkshopAnimation(p)
  if (animation) return animation
  const action = str(p, 'action', true)
  if (action === 'add-bone') {
    return {
      action,
      bone: {
        id: str(p, 'bone_id') ?? `bone-${crypto.randomUUID()}`,
        name: 'Xương mới',
        x: 0,
        y: 0,
        length: 80,
        angle: -90,
        ...bonePatch(p)
      }
    }
  }
  if (action === 'snap-joints') return { action }
  if (action === 'hold-frames') {
    const time = num(p, 'time') ?? currentTime
    const fps = Math.max(4, Math.min(120, num(p, 'fps') ?? composite?.rig?.fps ?? 30))
    const holdFrames = num(p, 'hold_frames')
    const holdSeconds =
      num(p, 'hold_seconds') ?? (holdFrames !== undefined ? holdFrames / fps : 3 / fps)
    if (!Number.isFinite(holdSeconds) || holdSeconds <= 0) {
      throw new ParamError('hold_seconds or hold_frames must be positive')
    }
    return {
      action,
      time,
      holdSeconds,
      boneId: str(p, 'bone_id') || undefined
    }
  }
  if (action === 'settings') {
    return {
      action,
      duration: num(p, 'duration'),
      loop: bool(p, 'loop'),
      fps: num(p, 'fps'),
      scaleKeys: bool(p, 'scale_keys')
    }
  }
  if (action === 'apply-template') {
    const template = (str(p, 'template') ?? 'humanoid') as any
    const validTemplates = ['humanoid', 'humanoid-full', 'hand-detailed', 'foot-detailed', 'simple-chain']
    if (!validTemplates.includes(template)) throw new ParamError(`template must be one of: ${validTemplates.join(', ')}`)
    return { action, template }
  }
  if (action === 'apply-preset-animation') {
    const preset = (str(p, 'preset') ?? 'walk') as any
    const validPresets = ['walk', 'idle', 'wave', 'bow', 'run', 'jump', 'fall', 'land', 'action', 'sway', 'hand-clench', 'foot-roll']
    if (!validPresets.includes(preset)) throw new ParamError(`preset must be one of: ${validPresets.join(', ')}`)
    const viewAngleRaw = str(p, 'view_angle')
    if (viewAngleRaw !== undefined && !['front', 'diagonal', 'side', 'back'].includes(viewAngleRaw)) {
      throw new ParamError('view_angle must be one of: front, diagonal, side, back')
    }
    return {
      action,
      preset,
      asNewClip: bool(p, 'as_new_clip') ?? false,
      clipName: str(p, 'clip_name') || undefined,
      viewAngle: viewAngleRaw as MotionViewAngle | undefined
    }
  }
  if (action === 'clear-animation') return { action }
  if (action === 'delete-all-clips') return { action }
  if (action === 'apply-mixamo-rig-motion') {
    const preset = (str(p, 'preset') ?? 'walk') as any
    const viewAngle = (str(p, 'view_angle') ?? 'front') as any
    const scale = num(p, 'scale')
    const baseLm =
      scale !== undefined
        ? createScaledLandmarks(scale)
        : composite
          ? autoDetectLandmarksFromComposite(composite)
          : createScaledLandmarks(1)
    const landmarks = p.landmarks && typeof p.landmarks === 'object' ? { ...baseLm, ...(p.landmarks as any) } : baseLm
    const bones = Array.isArray(p.bones) ? (p.bones as LayerBone[]) : buildHumanoidBonesFromLandmarks(landmarks)
    const clip =
      p.clip && typeof p.clip === 'object'
        ? (p.clip as any)
        : buildMixamoClipForBones({
            preset,
            bones,
            name: str(p, 'clip_name') || str(p, 'name') || `Mixamo ${preset}`,
            viewAngle,
            duration: num(p, 'duration') ?? 1.6,
            loop: bool(p, 'loop') ?? true
          })
    return {
      action,
      bones,
      clip,
      replaceClips: bool(p, 'replace_clips'),
      autoBindSoft: bool(p, 'auto_bind_soft') ?? true
    }
  }
  if (action === 'add-clip') {
    const clip =
      p.clip && typeof p.clip === 'object'
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
    if (!Array.isArray(p.layer_ids) || p.layer_ids.some((id) => typeof id !== 'string')) {
      throw new ParamError('layer_ids must be a string array')
    }
    const mode = str(p, 'binding_mode') ?? 'rigid'
    if (mode !== 'rigid' && mode !== 'soft') throw new ParamError('binding_mode must be rigid or soft')
    return { action, boneId: str(p, 'bone_id') || undefined, layerIds: p.layer_ids, mode }
  }
  if (action === 'mirror-pose') {
    return { action, time: num(p, 'time', true) }
  }
  const boneId = str(p, 'bone_id', true)
  if (action === 'update-bone') return { action, boneId, patch: bonePatch(p) }
  if (action === 'delete-bone') return { action, boneId }
  if (action === 'mirror-bone') return { action, boneId }
  throw new ParamError('Unknown rig action')
}

export const layerWorkshopRigCommands: Record<string, Handler> = {
  layer_assembly_rig: (p) => {
    const session = activeWorkshop()
    const current = session.getComposite()
    if (str(p, 'action') === 'set-bone-z-order') {
      const targetBoneId = str(p, 'bone_id') ?? session.getSelectedBoneId?.() ?? current.rig?.bones[0]?.id
      if (!targetBoneId) throw new ParamError('Missing bone_id and no bone is selected')
      const time = num(p, 'time') ?? session.getTime()
      const presetRaw = str(p, 'z_preset')
      const explicitZ = num(p, 'z_order') ?? num(p, 'zOrder')
      const deltaZ = num(p, 'delta_z_order') ?? num(p, 'deltaZOrder')
      let next: LayerComposite
      if (presetRaw !== undefined) {
        const validZones: BoneDepthSemanticPreset[] = ['behind-back', 'default', 'front-torso', 'front-face']
        if (!validZones.includes(presetRaw as BoneDepthSemanticPreset)) {
          throw new ParamError(`z_preset must be one of: ${validZones.join(', ')}`)
        }
        next = applyBoneZOrderPreset(current, targetBoneId, time, presetRaw as BoneDepthSemanticPreset)
      } else if (explicitZ !== undefined) {
        next = applyBoneZOrderValue(current, targetBoneId, time, explicitZ)
      } else if (deltaZ !== undefined) {
        next = applyBoneZOrderStep(current, targetBoneId, time, deltaZ)
      } else {
        throw new ParamError('Provide z_order, delta_z_order, or z_preset for set-bone-z-order')
      }
      session.setIsPlaying(false)
      session.setComposite(next)
      const nextRig = next.rig ? ensureRigClips(next.rig).rig : undefined
      const summary = nextRig ? getBoneDepthSummary(next, nextRig, targetBoneId, time) : null
      return {
        ok: true,
        boneId: targetBoneId,
        depthSummary: summary
          ? {
              localZOrder: summary.localZOrder,
              inheritedZOrder: summary.inheritedZOrder,
              effectiveZOrder: summary.effectiveZOrder,
              zone: summary.zone,
              zoneLabel: summary.zoneLabel,
              parentBoneId: summary.parentBone?.id ?? null,
              descendantBoneIds: summary.descendants.map((d) => d.id)
            }
          : null,
        composite: toPlain(next)
      }
    }
    const action = rigAction(p, current, session.getTime())
    const next = applyRigAction(current, action)
    session.setComposite(next)
    return {
      ok: true,
      boneId: action.action === 'add-bone' ? action.bone.id : 'boneId' in action ? (action.boneId ?? null) : null,
      composite: toPlain(next)
    }
  },
  set_layer_assembly_playback: (p) => {
    const session = activeWorkshop()
    const time = num(p, 'time')
    const playing = bool(p, 'playing')
    if (time !== undefined && (time < 0 || time > (session.getComposite().rig?.duration ?? 4))) {
      throw new ParamError('Time outside clip duration')
    }
    if (time !== undefined) session.setTime(time)
    if (playing !== undefined) session.setIsPlaying(playing)
    if (session.getComposite().rig) session.setTab?.('animation')
    return { ok: true, time: time ?? session.getTime(), playing: playing ?? session.getIsPlaying() }
  },
  set_layer_assembly_panel: (p) => {
    const session = activeWorkshop()
    const tab = str(p, 'tab')
    if (tab && !['layers', 'bones', 'animation', 'plant'].includes(tab)) throw new ParamError('Invalid tab')
    const activeTab = (tab ?? session.getTab?.() ?? 'layers') as 'layers' | 'bones' | 'animation' | 'plant'

    const boneId = str(p, 'bone_id') || null
    if (boneId && !session.getComposite().rig?.bones.some((b) => b.id === boneId)) throw new ParamError('Unknown bone ID')
    if (tab) session.setTab?.(activeTab)
    if (boneId !== null || p.bone_id !== undefined) session.setSelectedBoneId?.(boneId)

    const spineId = str(p, 'spine_id')
    const plantPatch: Record<string, unknown> = {}
    if (spineId !== undefined) {
      if (spineId && !session.getComposite().plantSpines?.some((s) => s.id === spineId)) throw new ParamError('Unknown spine ID')
      plantPatch.selectedSpineId = spineId || null
    }
    const grabMode = str(p, 'plant_grab_mode')
    if (grabMode) {
      if (grabMode !== 'record' && grabMode !== 'learn') throw new ParamError('plant_grab_mode must be record or learn')
      plantPatch.grabMode = grabMode
    }
    const recordEnd = str(p, 'plant_record_end')
    if (recordEnd) {
      if (recordEnd !== 'loop' && recordEnd !== 'spring') throw new ParamError('plant_record_end must be loop or spring')
      plantPatch.recordEnd = recordEnd
    }
    const pathRecord = bool(p, 'plant_path_record')
    if (pathRecord !== undefined) plantPatch.pathRecord = pathRecord
    const plantLive = bool(p, 'plant_live')
    if (plantLive !== undefined) plantPatch.live = plantLive
    if (Object.keys(plantPatch).length > 0) setPlantSpineEditorState(plantPatch)

    const animPatch: Record<string, unknown> = {}
    const animIk = bool(p, 'anim_ik')
    if (animIk !== undefined) animPatch.ik = animIk
    const animIkChain = num(p, 'anim_ik_chain')
    if (animIkChain !== undefined) {
      if (animIkChain < 2 || animIkChain > 4) throw new ParamError('anim_ik_chain must be 2, 3 or 4')
      animPatch.ikChain = Math.round(animIkChain)
    }
    const animOnion = bool(p, 'anim_onion')
    if (animOnion !== undefined) animPatch.onion = animOnion
    const animOnionCount = num(p, 'anim_onion_count')
    if (animOnionCount !== undefined) animPatch.onionCount = Math.max(1, Math.min(5, Math.round(animOnionCount)))
    const animOnionStep = num(p, 'anim_onion_step')
    if (animOnionStep !== undefined) animPatch.onionStep = Math.max(0.03, Math.min(0.5, animOnionStep))
    const animPath = bool(p, 'anim_path')
    if (animPath !== undefined) animPatch.path = animPath
    const animAutoKey = bool(p, 'anim_auto_key')
    if (animAutoKey !== undefined) animPatch.autoKey = animAutoKey
    const animDopeFilter = str(p, 'anim_dope_filter')
    if (animDopeFilter) {
      if (!['all', 'keyed', 'selected'].includes(animDopeFilter)) {
        throw new ParamError('anim_dope_filter must be all, keyed or selected')
      }
      animPatch.dopeFilter = animDopeFilter
    }
    if (Object.keys(animPatch).length > 0) setAnimAssist(animPatch)

    const rigPatch: Record<string, unknown> = {}
    const rigTool = str(p, 'rig_tool')
    if (rigTool) {
      if (!['select', 'add', 'strength', 'manipulate'].includes(rigTool)) {
        throw new ParamError('rig_tool must be select, add, strength or manipulate')
      }
      if (rigTool !== 'manipulate') resetTestPoses()
      rigPatch.tool = rigTool
    }
    const rigInfluence = bool(p, 'rig_influence')
    if (rigInfluence !== undefined) rigPatch.showInfluence = rigInfluence
    const rigMirrorDraw = bool(p, 'rig_mirror_draw')
    if (rigMirrorDraw !== undefined) rigPatch.mirrorDraw = rigMirrorDraw
    if (Object.keys(rigPatch).length > 0) setRigToolState(rigPatch as any)

    if (tab) {
      session.setIsPlaying(false)
      session.setTime(0)
    }
    return {
      ok: true,
      tab: activeTab,
      boneId,
      spineId: getPlantSpineEditorState().selectedSpineId,
      animAssist: getAnimAssist(),
      rigTool: getRigToolState(),
      plantEditor: {
        grabMode: getPlantSpineEditorState().grabMode,
        pathRecord: getPlantSpineEditorState().pathRecord,
        recordEnd: getPlantSpineEditorState().recordEnd,
        live: getPlantSpineEditorState().live
      }
    }
  }
}
