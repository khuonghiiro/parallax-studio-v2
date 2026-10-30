import type { Layer, Project, Vec3, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { effectiveTimeParams } from '../project/workflowTiming'

type Cue = { node: WorkflowNode; params: WorkflowNodeParams; start: number; end: number; enabled: boolean }
export function partTimelineCues(project: Project): Cue[] {
  const nodes = project.workflow?.nodes ?? []
  return nodes.filter(n => n.params?.logicCategory === 'part_swap' && n.params.partTimeline && !n.params.isPartHub).map(node => {
    const params = effectiveTimeParams(project, node, node.params ?? {})
    const parent = nodes.find(n => n.id === params.hierarchyParentNodeId)
    return { node, params, start: params.timeStart ?? 0, end: params.timeEnd ?? project.comp.duration,
      enabled: node.enabled && parent?.enabled !== false }
  }).sort((a, b) => a.start - b.start || a.node.id.localeCompare(b.node.id))
}

function poseWeight(cue: Cue, t: number): number {
  if (t < cue.start || t >= cue.end) return 0
  if (cue.params.partPoseWave === 'hold') return 1
  const u = (t - cue.start) / Math.max(0.001, cue.end - cue.start)
  const points = cue.params.partPoseWave === 'oscillate'
    ? [[0, 0], [.2, 1], [.4, -.75], [.6, 1], [.8, -.6], [1, 0]]
    : [[0, 0], [.25, 1], [.78, 1], [1, 0]]
  const index = Math.max(1, points.findIndex(p => p[0] >= u))
  const a = points[index - 1], b = points[index]
  const x = (u - a[0]) / (b[0] - a[0]), eased = x * x * (3 - 2 * x)
  return a[1] + (b[1] - a[1]) * eased
}

/** Runtime-only edits: never replace the source layer or its Motion keyframes. Latest start wins per property. */
export function evaluatePartTimeline(layer: Layer, cues: Cue[], t: number) {
  const relevant = cues.filter(c => c.params.targetLayerIds?.includes(layer.id))
  let visible = layer.visible, assetId = layer.type === 'image' ? layer.props.assetId : undefined
  let pose: Cue | undefined
  for (const cue of relevant) {
    const p = cue.params
    if (!cue.enabled || t < cue.start || (t >= cue.end && !p.partSwapHoldAfterEnd)) continue
    if (p.swapMode !== 'toggle_part') {
      if (p.swapVariant) visible = layer.id === p.swapVariant || layer.composite?.variant === p.swapVariant
    }
    if (p.swapMode === 'toggle_part' && p.swapTargetLayerId === layer.id) visible = p.partVisible !== false
    if (p.swapMode === 'replace_asset' && p.swapTargetLayerId === layer.id && p.swapAssetId) assetId = p.swapAssetId
    if (t < cue.end && (p.partRotDeg || p.partOffsetX || p.partOffsetY || (p.partScalePct ?? 100) !== 100)) pose = cue
  }
  const weight = pose ? poseWeight(pose, t) : 0, p = pose?.params
  const displayed = assetId && layer.type === 'image'
    ? { ...layer, visible, props: { ...layer.props, assetId } } : { ...layer, visible }
  return { layer: relevant.length ? displayed : layer, offset: [(p?.partOffsetX ?? 0) * weight, (p?.partOffsetY ?? 0) * weight, 0] as Vec3,
    rotation: (p?.partRotDeg ?? 0) * weight, scale: 1 + ((p?.partScalePct ?? 100) / 100 - 1) * Math.abs(weight) }
}
