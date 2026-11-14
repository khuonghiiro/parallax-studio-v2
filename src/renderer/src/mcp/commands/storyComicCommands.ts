import type { Project } from '@shared/types'
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

    ed().update((d) => {
      const project = d as Project
      const shot = project.shots.find((s) => s.id === shotId)
      if (!shot) throw new ParamError(`Shot "${shotId}" not found`)

      if (project.comp.duration < end) {
        project.comp.duration = Number(end.toFixed(2))
      }

      const staged = stageStoryComicBeat(project, spec)
      createdLayerIds = staged.createdLayerIds

      if (applyCamera) {
        const camRes = choreographCinematicCameraRoute(project, [staged.cameraBeat], {
          clearExisting: clearCamera
        })
        keyframeCount = camRes.keyframeCount
      }

      syncWorkflowV2Graph(project)
    }, `Dàn dựng nhịp cốt truyện (${cameraGrammar}) cho cảnh ${shotId}`)

    return {
      ok: true,
      shot_id: shotId,
      start_time: start,
      end_time: end,
      mood,
      camera_grammar: cameraGrammar,
      created_layers: createdLayerIds,
      camera_keyframes: keyframeCount
    }
  }
}
