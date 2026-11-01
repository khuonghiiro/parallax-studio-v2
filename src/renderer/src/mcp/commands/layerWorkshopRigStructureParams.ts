import type { Params } from '../types'
import { ParamError } from '../types'
import { bool, num, str } from '../params'
import type { LayerComposite } from '../../ui/layerAssembly/types'
import type { RigStructureAction } from '../../ui/layerAssembly/workshopRigStructure'
import { measureWorkshopLayerSizes } from '../../ui/layerAssembly/workshopLayerMeasure'
import { detectCreatureSpecies } from '../../ui/layerAssembly/creatures/creatureRigFit'
import { CREATURE_SPECIES_IDS, type CreatureBindMode, type CreatureSpecies } from '../../ui/layerAssembly/creatures/creatureRigTypes'

const BIND_MODES: CreatureBindMode[] = ['auto', 'rigid', 'soft']

function parseApplyCreature(p: Params, composite?: LayerComposite): RigStructureAction {
  const species = (str(p, 'species') ?? (composite ? detectCreatureSpecies(composite) : null) ?? undefined) as CreatureSpecies | undefined
  if (!species || !CREATURE_SPECIES_IDS.includes(species)) {
    throw new ParamError(`species must be one of: ${CREATURE_SPECIES_IDS.join(', ')}`)
  }
  const facing = str(p, 'facing') ?? 'auto'
  if (!['auto', 'left', 'right'].includes(facing)) throw new ParamError('facing must be auto, left or right')
  const bindMode = (str(p, 'binding_mode') ?? 'auto') as CreatureBindMode
  if (!BIND_MODES.includes(bindMode)) throw new ParamError('binding_mode must be auto, rigid or soft for apply-creature-rig')
  return {
    action: 'apply-creature-rig',
    species,
    options: {
      legPairs: num(p, 'leg_pairs'),
      legSegments: num(p, 'leg_segments'),
      chainSegments: num(p, 'chain_segments'),
      wings: bool(p, 'wings'),
      facing: facing === 'auto' ? undefined : (facing as 'left' | 'right')
    },
    fitToLayers: bool(p, 'fit_to_layers') ?? true,
    autoBind: bool(p, 'auto_bind') ?? true,
    bindMode,
    includeClips: bool(p, 'include_clips') ?? true,
    layerSizes: composite ? measureWorkshopLayerSizes(composite.layers) : {}
  }
}

/**
 * Phân tích tham số MCP cho các thao tác dựng kết cấu xương (thư viện sinh vật, chuỗi đốt, chia đốt, nhân chi vòng tròn).
 * Trả về null nếu `action` không thuộc nhóm này.
 */
export function parseRigStructureAction(p: Params, composite?: LayerComposite): RigStructureAction | null {
  const action = str(p, 'action')
  if (action === 'apply-creature-rig') return parseApplyCreature(p, composite)
  if (action === 'add-bone-chain') {
    const x = num(p, 'x')
    const y = num(p, 'y')
    return {
      action,
      parentId: str(p, 'parent_id') || str(p, 'bone_id') || undefined,
      start: x !== undefined && y !== undefined ? { x, y } : undefined,
      angle: num(p, 'angle'),
      length: num(p, 'length') ?? 160,
      segments: num(p, 'segments') ?? 4,
      namePrefix: str(p, 'name') || undefined,
      idPrefix: str(p, 'id_prefix') || undefined
    }
  }
  if (action === 'subdivide-bone') {
    return { action, boneId: str(p, 'bone_id', true), segments: num(p, 'segments') ?? 3 }
  }
  if (action === 'radial-array-bone') {
    return {
      action,
      boneId: str(p, 'bone_id', true),
      count: num(p, 'count') ?? 4,
      stepAngle: num(p, 'step_angle') ?? 30,
      mirror: bool(p, 'mirror') ?? false
    }
  }
  return null
}
