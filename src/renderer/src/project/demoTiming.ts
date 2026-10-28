import type { Project } from '@shared/types'
import { syncWorkflowV2Graph } from './workflowV2Sync'

/** Three scenes: hold the composition, then travel during [4,5] and [9,10]. */
export function repairThreeSceneTiming(project: Project): Project {
  project.comp.duration = 15
  for (const track of [project.camera.position, project.camera.target]) {
    for (const [from, until] of [[2.2, 4], [7.2, 9]]) {
      const pose = track.keyframes.find(k => Math.abs(k.t - from) < 0.001)
      if (!pose) continue
      pose.ease = 'hold'
      if (!track.keyframes.some(k => Math.abs(k.t - until) < 0.001)) {
        track.keyframes.push({ ...pose, id: `demo-hold-${pose.id}`, t: until, value: [...pose.value], ease: 'easeInOut' })
      }
    }
    for (const key of track.keyframes) if (Math.abs(key.t - 14.8) < 0.001) key.t = 15
    track.keyframes.sort((a, b) => a.t - b.t)
  }
  project.shots.forEach((shot, index) => {
    for (const layer of project.layers.filter(l => l.shotId === shot.id)) {
      // Both scenes must be visible during the camera's flight between them.
      if (Math.abs(layer.inPoint - index * 5) < 0.001) layer.inPoint = Math.max(0, index * 5 - 1)
      if (index === 2 && layer.outPoint >= 14.8) layer.outPoint = 15
    }
  })
  project.workflow = syncWorkflowV2Graph(project, project.workflow)
  return project
}
