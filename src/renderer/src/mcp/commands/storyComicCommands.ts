import type {
  Project,
  SubtitlePositionPreset,
  SubtitleStylePresetId
} from '@shared/types'
import {
  choreographCinematicCameraRoute,
  type ShotTransitionStyle
} from '../../animation/cinematicCameraRoute'
import {
  stageStoryComicBeat,
  type StoryCameraGrammar,
  type StoryComicBeatSpec,
  type StoryEmoteBadge,
  type StoryMoodBackdrop
} from '../../animation/storyComicDirector'
import {
  applySubtitleDefaultsToAllNodes,
  validateAndRepairDialogueContinuity
} from '../../project/subtitleAndDialogueSync'
import { syncWorkflowV2Graph } from '../../project/workflowV2Sync'
import { bool, num, str, vec3 } from '../params'
import { ParamError, ed, type Handler } from '../types'

export const storyComicCommands: Record<string, Handler> = {
  stage_story_beat: (p) => {
    const shotId = str(p, 'shot_id')
    if (!shotId) throw new ParamError('Provide "shot_id"')

    const start = num(p, 'start_time') ?? num(p, 'start') ?? 0
    const duration = num(p, 'duration') ?? 2.8
    const end = num(p, 'end_time') ?? num(p, 'end') ?? Number((start + duration).toFixed(3))
    if (end <= start) throw new ParamError('"end_time" must be greater than "start_time"')

    const narration = str(p, 'narration') ?? str(p, 'subtitle')
    const speakerName = str(p, 'speaker_name')
    const subtitleStylePreset = str(p, 'subtitle_style_preset') as SubtitleStylePresetId | undefined
    const subtitlePositionPreset = str(p, 'subtitle_position_preset') as SubtitlePositionPreset | undefined
    const preserveSubtitleSettings = bool(p, 'preserve_subtitle_settings')
    const applyDefaultsAll = bool(p, 'apply_subtitle_defaults_to_all') ?? false
    const syncContinuity = bool(p, 'sync_dialogue_continuity') ?? true
    const mood = (str(p, 'mood') ?? 'world') as StoryMoodBackdrop
    const cameraGrammar = (str(p, 'camera_grammar') ?? 'confused_push') as StoryCameraGrammar
    const subjectId = str(p, 'subject_id')
    const secondarySubjectId = str(p, 'secondary_subject_id')
    const emoteBadge = (str(p, 'emote_badge') ?? 'none') as StoryEmoteBadge
    const emotePosition = vec3(p, 'emote_position')
    const transitionAtEnd = (str(p, 'transition_at_end') ?? 'cut') as ShotTransitionStyle
    const questTitle = str(p, 'system_quest_title')
    const questBody = str(p, 'system_quest_body')
    const applyCamera = bool(p, 'apply_camera') ?? true
    const clearCamera = bool(p, 'clear_existing_camera') ?? false

    const spec: StoryComicBeatSpec = {
      shotId,
      start,
      end,
      narration,
      speakerName,
      subtitleStylePreset,
      subtitlePositionPreset,
      preserveSubtitleSettings,
      mood,
      cameraGrammar,
      subjectId,
      secondarySubjectId,
      emoteBadge,
      emotePosition,
      transitionAtEnd,
      systemQuest: questTitle ? { title: questTitle, body: questBody ?? '' } : undefined
    }

    let createdLayerIds: string[] = []
    let keyframeCount = 0
    let applyAllStats: { updatedCount: number; skippedProtectedCount: number } | undefined
    let continuityStats: { repairedCount: number; issuesCount: number } | undefined

    ed().update((d) => {
      const project = d as Project
      const shot = project.shots.find((s) => s.id === shotId)
      if (!shot) throw new ParamError(`Shot "${shotId}" not found`)

      if (project.comp.duration < end) {
        project.comp.duration = Number(end.toFixed(2))
      }

      const staged = stageStoryComicBeat(project, spec)
      createdLayerIds = staged.createdLayerIds

      if (applyDefaultsAll && subtitleStylePreset) {
        const res = applySubtitleDefaultsToAllNodes(project, {
          presetId: subtitleStylePreset,
          ...(subtitlePositionPreset ? { positionPreset: subtitlePositionPreset } : {})
        })
        applyAllStats = {
          updatedCount: res.updatedCount,
          skippedProtectedCount: res.skippedProtectedCount
        }
      }

      if (syncContinuity) {
        const cRes = validateAndRepairDialogueContinuity(project, true)
        continuityStats = {
          repairedCount: cRes.repairedCount,
          issuesCount: cRes.issues.length
        }
      }

      if (applyCamera) {
        const camRes = choreographCinematicCameraRoute(project, [staged.cameraBeat], {
          clearExisting: clearCamera
        })
        keyframeCount = camRes.keyframeCount
      }

      project.workflow = syncWorkflowV2Graph(project, project.workflow)
    }, `Dàn dựng nhịp cốt truyện (${cameraGrammar}) cho cảnh ${shotId}`)

    return {
      ok: true,
      shot_id: shotId,
      start_time: start,
      end_time: end,
      mood,
      camera_grammar: cameraGrammar,
      created_layers: createdLayerIds,
      camera_keyframes: keyframeCount,
      ...(applyAllStats ? { subtitle_apply_all: applyAllStats } : {}),
      ...(continuityStats ? { dialogue_continuity: continuityStats } : {})
    }
  }
}
