import type { Project, Vec3 } from '@shared/types'
import { useEditor } from '../../store/editor'
import { ParamError, type Handler } from '../types'
import { bool, num, str } from '../params'
import {
  MOTION_PRESETS_CATALOG,
  generatePresetSpatialTracks,
  type MotionPresetId
} from '../../animation/motionPresets'
import {
  choreographSequence,
  findMotionTargetGroup,
  applyMotionTracksToGroup,
  getCharacterActionCatalog,
  type ChoreographyStepSpec
} from '../../animation/motionEngine'

const ed = () => useEditor.getState()
const proj = () => ed().project

export const motionCommands: Record<string, Handler> = {
  get_motion_presets: () => {
    return {
      presets: MOTION_PRESETS_CATALOG.map((m) => ({
        id: m.id,
        name: m.name.vi,
        name_en: m.name.en,
        category: m.category,
        description: m.description.vi,
        description_en: m.description.en,
        default_duration: m.defaultDuration,
        recommended_clips: m.recommendedClips,
        params_guide: m.paramsGuide
      }))
    }
  },

  get_character_actions: (p) => {
    const targetId = str(p, 'target_id') || str(p, 'layer_id') || str(p, 'composite_instance_id') || str(p, 'model_instance_id')
    if (!targetId) throw new ParamError('Provide "target_id", "layer_id", "composite_instance_id" or "model_instance_id"')

    const catalog = getCharacterActionCatalog(proj(), targetId)
    return catalog
  },

  apply_motion_preset: (p) => {
    const targetId = str(p, 'target_id') || str(p, 'layer_id') || str(p, 'composite_instance_id') || str(p, 'model_instance_id')
    if (!targetId) throw new ParamError('Provide "target_id" or "layer_id"')

    const preset = (str(p, 'preset') || str(p, 'preset_id')) as MotionPresetId
    if (!preset) throw new ParamError('Provide "preset" (e.g. "walk_into_depth", "jump_arc", "trip_and_fall", "emerge_from_depth")')

    const meta = MOTION_PRESETS_CATALOG.find((m) => m.id === preset)
    if (!meta) {
      throw new ParamError(
        `Unknown preset "${preset}". Available: ${MOTION_PRESETS_CATALOG.map((m) => m.id).join(', ')}`
      )
    }

    const t = num(p, 'time') ?? ed().time
    const duration = num(p, 'duration') ?? meta.defaultDuration
    const depthZ = num(p, 'depth_z') ?? (num(p, 'depth') ?? undefined)
    const deltaX = num(p, 'delta_x')
    const deltaY = num(p, 'delta_y')
    const jumpHeight = num(p, 'jump_height')
    const endScale = num(p, 'end_scale')
    const fadeOpacity = bool(p, 'fade_opacity')

    let appliedCount = 0
    let targetName = ''

    ed().update((d) => {
      const group = findMotionTargetGroup(d as Project, targetId)
      if (!group || !group.layers.length) {
        throw new ParamError(`Target "${targetId}" not found in project layers`)
      }

      targetName = group.name
      appliedCount = group.layers.length

      const tracks = generatePresetSpatialTracks(
        preset,
        {
          position: group.centerPosition,
          rotation: group.layers[0].transform.rotation.value,
          scale: [1, 1, 1],
          opacity: group.layers[0].transform.opacity.value
        },
        {
          time: t,
          duration,
          depthZ,
          deltaX,
          deltaY,
          jumpHeight,
          endScaleMultiplier: endScale,
          fadeOpacity
        }
      )

      applyMotionTracksToGroup(group, tracks)
    }, `Gắn chuyển động "${meta.name.vi}" cho ${targetName || targetId}`)

    return {
      ok: true,
      preset,
      targetId,
      targetName,
      appliedLayers: appliedCount,
      time: t,
      duration
    }
  },

  choreograph_motion_sequence: async (p) => {
    const targetId = str(p, 'target_id') || str(p, 'layer_id') || str(p, 'composite_instance_id') || str(p, 'model_instance_id')
    if (!targetId) throw new ParamError('Provide "target_id", "layer_id", "composite_instance_id" or "model_instance_id"')

    const rawSteps = p.steps
    if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
      throw new ParamError('Provide non-empty "steps" array')
    }

    const startTime = num(p, 'start_time') ?? ed().time

    const steps: ChoreographyStepSpec[] = rawSteps.map((s: any, idx: number) => {
      return {
        name: s.name || `Bước ${idx + 1}`,
        time: typeof s.time === 'number' ? s.time : undefined,
        duration: typeof s.duration === 'number' ? s.duration : undefined,
        motionPreset: s.motion_preset || s.motionPreset || s.motion,
        actionClip: s.action_clip || s.actionClip || s.clip,
        toPosition: Array.isArray(s.to_position || s.toPosition) ? (s.to_position || s.toPosition) : undefined,
        toScale: s.to_scale || s.toScale,
        toOpacity: typeof (s.to_opacity ?? s.toOpacity) === 'number' ? (s.to_opacity ?? s.toOpacity) : undefined,
        toRotation: Array.isArray(s.to_rotation || s.toRotation) ? (s.to_rotation || s.toRotation) : undefined,
        depthZ: typeof (s.depth_z ?? s.depthZ) === 'number' ? (s.depth_z ?? s.depthZ) : undefined,
        deltaX: typeof (s.delta_x ?? s.deltaX) === 'number' ? (s.delta_x ?? s.deltaX) : undefined,
        deltaY: typeof (s.delta_y ?? s.deltaY) === 'number' ? (s.delta_y ?? s.deltaY) : undefined,
        jumpHeight: typeof (s.jump_height ?? s.jumpHeight) === 'number' ? (s.jump_height ?? s.jumpHeight) : undefined,
        fadeOpacity: typeof (s.fade_opacity ?? s.fadeOpacity) === 'boolean' ? (s.fade_opacity ?? s.fadeOpacity) : undefined,
        ease: s.ease
      }
    })

    let resultInfo: any = null

    ed().update((d) => {
      // choreographSequence đồng bộ trên draft project d
      const group = findMotionTargetGroup(d as Project, targetId)
      if (!group || !group.layers.length) {
        throw new ParamError(`Target "${targetId}" not found in project layers`)
      }

      let curTime = startTime
      let curPos: Vec3 = [...group.centerPosition]
      let curRot: Vec3 = [...group.layers[0].transform.rotation.value]
      let curScale: Vec3 = [1, 1, 1]
      let curOpacity = group.layers[0].transform.opacity.value

      for (const step of steps) {
        const meta = step.motionPreset ? MOTION_PRESETS_CATALOG.find((m) => m.id === step.motionPreset) : null
        const dur = step.duration ?? meta?.defaultDuration ?? 2.0
        const stepT = step.time !== undefined ? step.time : curTime

        const presetId: MotionPresetId = step.motionPreset || 'cross_screen'
        const toPos: Vec3 | undefined = step.toPosition
          ? [...step.toPosition]
          : step.depthZ !== undefined || step.deltaX !== undefined || step.deltaY !== undefined
            ? [
                curPos[0] + (step.deltaX ?? 0),
                curPos[1] + (step.deltaY ?? 0),
                curPos[2] + (step.depthZ ?? 0)
              ]
            : undefined

        const toSc: Vec3 | undefined = typeof step.toScale === 'number'
          ? [step.toScale, step.toScale, step.toScale]
          : step.toScale

        const tracks = generatePresetSpatialTracks(
          presetId,
          { position: curPos, rotation: curRot, scale: curScale, opacity: curOpacity },
          {
            time: stepT,
            duration: dur,
            fromPosition: curPos,
            toPosition: toPos,
            fromScale: curScale,
            toScale: toSc,
            jumpHeight: step.jumpHeight,
            fadeOpacity: step.fadeOpacity,
            toOpacity: step.toOpacity,
            ease: step.ease
          }
        )

        applyMotionTracksToGroup(group, tracks)

        if (tracks.position.length > 0) curPos = [...tracks.position[tracks.position.length - 1].value]
        if (tracks.scale.length > 0) curScale = [...tracks.scale[tracks.scale.length - 1].value]
        if (tracks.rotation.length > 0) curRot = [...tracks.rotation[tracks.rotation.length - 1].value]
        if (tracks.opacity.length > 0) curOpacity = tracks.opacity[tracks.opacity.length - 1].value
        curTime = stepT + dur
      }

      resultInfo = {
        ok: true,
        targetId,
        targetName: group.name,
        appliedLayers: group.layers.length,
        totalSteps: steps.length,
        totalDuration: curTime - startTime
      }
    }, `Gắn kịch bản chuyển động ${steps.length} bước cho ${targetId}`)

    return resultInfo
  }
}
