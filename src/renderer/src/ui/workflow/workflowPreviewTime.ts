import type { Project, WorkflowNode } from '@shared/types'
import { shotAtTime } from '../../animation/cameraPath'

export function getNodePreviewTime(project: Project, node: WorkflowNode, currentTime: number): number {
  const duration = Math.max(0, project.comp.duration)
  const current = Math.max(0, Math.min(duration, Number.isFinite(currentTime) ? currentTime : 0))
  const shotId = node.params?.shotId !== 'all' && node.params?.shotId
    || project.layers.find((layer) => node.params?.targetLayerIds?.includes(layer.id))?.shotId
    || project.workflow?.targetShotId
  if (!shotId || shotId === 'all' || shotAtTime(project, current) === shotId) return current
  // Search the real camera path rather than assuming equal shot lengths.
  const step = Math.max(0.1, duration / 240)
  for (let time = 0; time <= duration; time += step) {
    if (shotAtTime(project, time) === shotId) return time
  }
  return current
}
