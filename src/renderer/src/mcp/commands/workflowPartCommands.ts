import type { WorkflowNodeParams } from '@shared/types'
import { evaluateScene } from '../../engine/evaluateScene'
import { addPartCue, describePartContext, patchPartCue } from '../../project/workflowPartEditing'
import { bool, num, str } from '../params'
import { ed, ParamError, proj, type Handler } from '../types'

const numbers = {
  start: 'timeStart',
  end: 'timeEnd',
  x: 'partOffsetX',
  y: 'partOffsetY',
  rotation: 'partRotDeg',
  scale: 'partScalePct',
  motion_pct: 'motionTriggerPct',
  hold_duration: 'motionTriggerHoldSec'
} as const
const strings = {
  mode: 'swapMode',
  variant_id: 'swapVariant',
  layer_id: 'swapTargetLayerId',
  asset_id: 'swapAssetId',
  wave: 'partPoseWave',
  trigger_mode: 'partTriggerMode',
  motion_node_id: 'linkedMotionNodeId'
} as const

function readPatch(p: Parameters<Handler>[0]): Partial<WorkflowNodeParams> {
  const patch: Record<string, unknown> = {}
  for (const [input, output] of Object.entries(numbers)) {
    const v = num(p, input)
    if (v !== undefined) patch[output] = v
  }
  for (const [input, output] of Object.entries(strings)) {
    const v = str(p, input)
    if (v !== undefined) patch[output] = v
  }
  const hold = bool(p, 'hold_after_end')
  const visible = bool(p, 'visible')
  if (hold !== undefined) patch.partSwapHoldAfterEnd = hold
  if (visible !== undefined) patch.partVisible = visible
  if (patch.swapMode && !['expression', 'part_variant', 'replace_asset', 'toggle_part'].includes(String(patch.swapMode))) {
    throw new ParamError('Invalid part mode')
  }
  if (patch.partPoseWave && !['smooth', 'hold', 'oscillate'].includes(String(patch.partPoseWave))) {
    throw new ParamError('Invalid pose wave')
  }
  if (patch.partTriggerMode && !['time', 'motion_bbox'].includes(String(patch.partTriggerMode))) {
    throw new ParamError('Invalid trigger_mode; expected time or motion_bbox')
  }
  return patch
}

export const workflowPartCommands: Record<string, Handler> = {
  get_part_cues: (p) => {
    const context = describePartContext(proj(), str(p, 'node_id', true))
    const t = num(p, 'time') ?? ed().time
    if (t < 0 || t > proj().comp.duration) throw new ParamError('time outside project')
    const ids = new Set(context.layers.map((l) => l.id))
    const preview = evaluateScene(proj(), t)
      .layers.filter((l) => ids.has(l.layer.id))
      .map((l) => ({
        id: l.layer.id,
        visible: l.active && l.opacity > 0.01,
        position: l.position,
        rotation: l.rotation,
        scale: l.scale,
        asset_id: l.layer.type === 'image' ? l.layer.props.assetId : undefined
      }))
    return { ...context, time: t, preview }
  },
  set_part_cue: (p) => {
    let id = str(p, 'node_id', true)
    const patch = readPatch(p)
    const action = str(p, 'action') ?? 'update'
    if (!['update', 'add'].includes(action)) throw new ParamError('action must be update or add')
    ed().update((draft) => {
      if (action === 'add') id = addPartCue(draft, id, num(p, 'at', true), num(p, 'duration') ?? 1)
      patchPartCue(draft, id, patch)
    })
    return { node_id: id, ...describePartContext(proj(), id) }
  }
}
