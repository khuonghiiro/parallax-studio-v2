import { spawnTimedFollowupNodeV2 } from './workflowTimedSteps'
import type { Project, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { effectiveTimeParams, timeSource } from './workflowTiming'
import { clearPartPoseKeysFromLayers } from './workflowV2PartAndPathBake'
import { getClusterMemberLayers } from './workflowV2ClusterRigAndSwap'

export function partEditContext(project: Project, nodeId: string) {
  const node = project.workflow?.nodes.find(n => n.id === nodeId && n.params?.logicCategory === 'part_swap')
  if (!node) throw new Error('Không tìm thấy node Bộ phận. Dùng get_workflow để lấy node_id.')
  const p = node.params ?? {}, first = project.layers.find(l => p.targetLayerIds?.includes(l.id))
  const members = getClusterMemberLayers(project, p.instanceId, first)
  const ids = new Set(members.map(l => l.id))
  const nodes = (project.workflow?.nodes ?? []).filter(n => n.params?.logicCategory === 'part_swap' &&
    (n.id === node.id || n.params?.targetLayerIds?.some(id => ids.has(id))))
  const children = nodes.filter(n => !n.params?.isPartHub)
  const motions = (project.workflow?.nodes ?? []).filter(n => n.params?.logicCategory === 'action' && n.params.targetLayerIds?.some(id => ids.has(id)))
  return { node, members, children, motions, nodes }
}

/** Migrate one cluster atomically. Keep base assets; remove only generated part keys, never Motion/rig keys. */
function preparePartTimeline(project: Project, nodes: WorkflowNode[]): void {
  for (const node of nodes) {
    if (node.params?.partTimeline) continue
    const targets = project.layers.filter(l => node.params?.targetLayerIds?.includes(l.id))
    const swapped = targets.filter(l => l.transform.opacity.keyframes.some(k => k.id.includes(`-partswap-${node.id}-`)))
    const pool = swapped.length ? swapped : node.params?.swapVariant && !node.params.isPartHub ? targets : []
    clearPartPoseKeysFromLayers(project.layers, node.id)
    pool.forEach((l, index) => { l.visible = index === 0; l.transform.opacity.value = 1 })
    node.params = { ...node.params, partTimeline: true }
  }
}

const EDIT_KEYS = new Set(['timeStart', 'timeEnd', 'swapMode', 'swapVariant', 'swapTargetLayerId', 'swapAssetId',
  'partVisible', 'partSwapHoldAfterEnd', 'partRotDeg', 'partOffsetX', 'partOffsetY', 'partScalePct', 'partPoseWave', 'partActionMode'])
export function patchPartCue(project: Project, nodeId: string, patch: Partial<WorkflowNodeParams>): void {
  const context = partEditContext(project, nodeId), node = context.node
  if (node.params?.isPartHub) throw new Error('Chọn node Bộ phận con để chỉnh mốc; Hub chỉ điều phối.')
  if (Object.keys(patch).some(k => !EDIT_KEYS.has(k))) throw new Error('Thông số không thuộc mốc Bộ phận.')
  const p = { ...node.params, ...patch }
  const targets = context.members.filter(l => p.targetLayerIds?.includes(l.id))
  if (patch.swapVariant && !targets.some(l => l.id === patch.swapVariant)) throw new Error('Biến thể phải thuộc bộ phận đang chọn.')
  if (patch.swapTargetLayerId && !targets.some(l => l.id === patch.swapTargetLayerId)) throw new Error('Mảnh đích không thuộc bộ phận.')
  if (patch.swapAssetId && !project.assets.some(a => a.id === patch.swapAssetId && a.kind === 'image')) throw new Error('Ảnh thay thế không tồn tại.')
  const timingEdit = patch.timeStart !== undefined || patch.timeEnd !== undefined
  if (timingEdit && timeSource(project.workflow, node.id)) throw new Error('Node đang dùng Time chung; chỉnh node Time hoặc ngắt dây trước.')
  const start = p.timeStart ?? 0, end = p.timeEnd ?? project.comp.duration
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > project.comp.duration) throw new Error('Mốc phải nằm trong thời lượng dự án, Từ < Đến.')
  for (const key of ['partRotDeg', 'partOffsetX', 'partOffsetY', 'partScalePct'] as const) {
    if (p[key] !== undefined && !Number.isFinite(p[key])) throw new Error('Tư thế phải là số hữu hạn.')
  }
  if (p.partScalePct !== undefined && (p.partScalePct < 20 || p.partScalePct > 300)) throw new Error('Tỉ lệ phải trong 20–300%.')
  preparePartTimeline(project, context.nodes)
  node.params = { ...node.params, ...patch, ...(timingEdit && node.params?.localTimeRange ? { localTimeRange: { start, end } } : {}) }
}

export function describePartContext(project: Project, nodeId: string) {
  const context = partEditContext(project, nodeId)
  const describe = (n: WorkflowNode) => ({ id: n.id, title: n.title, enabled: n.enabled, params: effectiveTimeParams(project, n, n.params ?? {}) })
  return { node: describe(context.node), parts: context.children.map(describe), motions: context.motions.map(describe),
    layers: context.members.map(l => ({ id: l.id, name: l.name, visible: l.visible, asset_id: l.type === 'image' ? l.props.assetId : undefined })),
    regions: ['workflow_part_preview', 'workflow_part_stage', 'workflow_part_cues'],
    rule: 'Edit child node only. Seconds are project time. Preview follows playhead. Latest start wins on overlap; intervals are [start,end). Pose adds to Motion; assets/variants restore unless hold_after_end.' }
}

/** Create an independent cue at the playhead, retaining the original interval. */
export function addPartCue(project: Project, nodeId: string, time: number, duration = 1): string {
  const { node, nodes } = partEditContext(project, nodeId)
  if (!node.params?.isPartChild || !project.workflow) throw new Error('Chọn bộ phận con trước khi thêm mốc.')
  if (!Number.isFinite(time) || !Number.isFinite(duration) || time < 0 || duration < .5 || time + duration > project.comp.duration) throw new Error('Mốc mới phải dài ít nhất 0.5s và nằm trong dự án.')
  preparePartTimeline(project, nodes)
  const result = spawnTimedFollowupNodeV2(project.workflow, nodeId, duration, time)
  if (!result) throw new Error('Không tạo được mốc bộ phận.')
  project.workflow = result.workflow
  return result.createdNodeId
}
