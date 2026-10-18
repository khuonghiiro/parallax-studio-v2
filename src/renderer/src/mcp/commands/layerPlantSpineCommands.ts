import type { PlantSpine, PlantSpinePresetId } from '@shared/plantSpine'
import type { Handler, Params } from '../types'
import { ParamError } from '../types'
import { bool, num, str, toPlain } from '../params'
import { activeWorkshop } from './layerWorkshopRigCommands'
import {
  applyPlantSpineAction,
  createPlantSpine,
  resolveSpineLayerIds,
  type PlantSpineTarget
} from '../../ui/layerAssembly/workshopPlantSpines'
import { parsePlantMotionPatch, summarizePlantMotion } from './layerPlantMotionParams'

const PRESETS: PlantSpinePresetId[] = ['grass', 'sapling', 'branch', 'canopy', 'flower', 'seaweed']

function parsePoints(p: Params): PlantSpine['points'] | undefined {
  if (p.points === undefined) return undefined
  if (!Array.isArray(p.points)) throw new ParamError('points must be an array of [x, y]')
  return p.points.map((pt) => {
    if (Array.isArray(pt) && pt.length === 2 && pt.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      return { x: pt[0], y: pt[1] }
    }
    if (pt && typeof pt === 'object' && Number.isFinite((pt as any).x) && Number.isFinite((pt as any).y)) {
      return { x: (pt as any).x, y: (pt as any).y }
    }
    throw new ParamError('Each point must be [x, y] numbers')
  })
}

function parseLayerIds(p: Params): string[] | undefined {
  if (p.layer_ids === undefined) return undefined
  if (!Array.isArray(p.layer_ids) || p.layer_ids.some((id) => typeof id !== 'string')) {
    throw new ParamError('layer_ids must be a string array')
  }
  return p.layer_ids as string[]
}

function parsePreset(p: Params): PlantSpinePresetId | undefined {
  const preset = str(p, 'preset')
  if (preset === undefined) return undefined
  if (!PRESETS.includes(preset as PlantSpinePresetId)) throw new ParamError(`preset must be one of: ${PRESETS.join(', ')}`)
  return preset as PlantSpinePresetId
}

/** Thông số số học tuỳ chọn (MCP snake_case → field camelCase). */
function parsePatch(p: Params): Partial<PlantSpine> {
  const patch: Partial<PlantSpine> = {}
  const fields: Array<[string, keyof PlantSpine]> = [
    ['amplitude', 'amplitude'], ['speed', 'speed'], ['stiffness', 'stiffness'], ['flexibility', 'flexibility'],
    ['turbulence', 'turbulence'], ['lean', 'lean'], ['phase_offset', 'phaseOffset'], ['reach', 'reach'],
    ['vertical_bob', 'verticalBob']
  ]
  for (const [param, field] of fields) {
    const value = num(p, param)
    if (value !== undefined) (patch as Record<string, unknown>)[field] = value
  }
  const name = str(p, 'name')
  if (name !== undefined) patch.name = name
  const enabled = bool(p, 'enabled')
  if (enabled !== undefined) patch.enabled = enabled
  const points = parsePoints(p)
  if (points) patch.points = points
  const layerIds = parseLayerIds(p)
  if (layerIds) patch.layerIds = layerIds
  return patch
}

function summarize(spines: PlantSpine[] | undefined) {
  return (spines ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    enabled: s.enabled !== false,
    points: s.points.map((pt) => [pt.x, pt.y]),
    layer_ids: s.layerIds,
    amplitude: s.amplitude,
    speed: s.speed,
    stiffness: s.stiffness,
    flexibility: s.flexibility,
    turbulence: s.turbulence,
    lean: s.lean ?? 0,
    phase_offset: s.phaseOffset ?? 0,
    reach: s.reach ?? 0,
    motion: summarizePlantMotion(s.motion)
  }))
}

export const layerPlantSpineCommands: Record<string, Handler> = {
  layer_assembly_plant_spine: (p) => {
    const session = activeWorkshop()
    const action = str(p, 'action', true)
    const composite = session.getComposite()
    if (action === 'list') return { ok: true, spines: summarize(composite.plantSpines) }

    let next = composite
    let spineId: string | null = null
    if (action === 'add') {
      const points = parsePoints(p)
      if (!points) throw new ParamError('points is required for add')
      const target = (str(p, 'apply_to') ?? 'selected') as PlantSpineTarget
      if (target !== 'selected' && target !== 'all') throw new ParamError('apply_to must be selected or all')
      const selected = session.getSelectedLayerIds?.() ?? [session.getSelectedLayerId()].filter((id): id is string => !!id)
      const layerIds = parseLayerIds(p) ?? resolveSpineLayerIds(composite, target, selected)
      const base = createPlantSpine({ points, layerIds, preset: parsePreset(p), id: str(p, 'spine_id') })
      const { points: _ignoredPoints, layerIds: _ignoredLayers, ...overrides } = parsePatch(p)
      const spine = { ...base, ...overrides, ...parsePlantMotionPatch(p) }
      next = applyPlantSpineAction(composite, { action: 'add', spine })
      spineId = spine.id
    } else if (action === 'update') {
      spineId = str(p, 'spine_id', true)
      const preset = parsePreset(p)
      const presetParams = preset ? createPlantSpine({ points: [{ x: 0, y: 0 }, { x: 0, y: -10 }], layerIds: [], preset }) : null
      const patch = presetParams
        ? { amplitude: presetParams.amplitude, speed: presetParams.speed, stiffness: presetParams.stiffness, flexibility: presetParams.flexibility, turbulence: presetParams.turbulence, lean: presetParams.lean, reach: presetParams.reach, ...parsePatch(p) }
        : parsePatch(p)
      const current = composite.plantSpines?.find((s) => s.id === spineId)
      next = applyPlantSpineAction(composite, { action: 'update', id: spineId, patch: { ...patch, ...parsePlantMotionPatch(p, current?.motion) } })
    } else if (action === 'delete') {
      spineId = str(p, 'spine_id', true)
      next = applyPlantSpineAction(composite, { action: 'delete', id: spineId })
    } else if (action === 'clear') {
      next = applyPlantSpineAction(composite, { action: 'clear' })
    } else {
      throw new ParamError('action must be list, add, update, delete or clear')
    }
    session.setComposite(next)
    return { ok: true, spineId, spines: summarize(next.plantSpines), composite: toPlain(next) }
  }
}
