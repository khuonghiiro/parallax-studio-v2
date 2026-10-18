import type { Handler, Params } from '../types'
import { ParamError } from '../types'
import { bool, num, str, toPlain } from '../params'
import type { LayerComposite, LayerPartKind } from '../../ui/layerAssembly/types'
import { activeWorkshop } from './layerWorkshopRigCommands'
import { validateWorkshop } from '../../ui/layerAssembly/workshopEdits'
import {
  activateVariant,
  assignToGroup,
  autoDetectParts,
  createPartGroup,
  deletePartGroup,
  moveLinked,
  replacePartAsset,
  setLayerSlot,
  updatePartGroup
} from '../../ui/layerAssembly/workshopParts'
import { useEditor } from '../../store/editor'
import { findCompositeTemplate, listSceneVariants, swapScenePart } from '../../ui/layerAssembly/scenePartSwap'

const KINDS: LayerPartKind[] = ['head', 'torso', 'arm', 'leg', 'accessory', 'custom']

function ids(p: Params, c: LayerComposite, key = 'layer_ids'): string[] {
  const list = p[key]
  if (!Array.isArray(list) || !list.length || list.some((id) => typeof id !== 'string' || !c.layers.some((l) => l.id === id))) {
    throw new ParamError(`${key} must be a non-empty array of existing layer IDs`)
  }
  return [...new Set(list as string[])]
}

function layerId(p: Params, c: LayerComposite): string {
  const id = str(p, 'layer_id', true)
  if (!c.layers.some((l) => l.id === id)) throw new ParamError(`Unknown layer ID: ${id}`)
  return id
}

/** Tóm tắt nhóm bộ phận + khe biến thể để AI đọc nhanh. */
export function summarizeParts(c: LayerComposite) {
  const slots = new Map<string, Array<{ layerId: string; name: string; variant?: string; active: boolean }>>()
  for (const l of c.layers) if (l.slot) slots.set(l.slot, [...(slots.get(l.slot) ?? []), { layerId: l.id, name: l.name, variant: l.variant, active: !l.hidden }])
  return {
    groups: (c.partGroups ?? []).map((g) => ({ ...g, members: c.layers.filter((l) => l.partGroupId === g.id).map((l) => ({ id: l.id, name: l.name })) })),
    slots: [...slots.entries()].map(([slot, variants]) => ({ slot, variants })),
    ungrouped: c.layers.filter((l) => !l.partGroupId).map((l) => ({ id: l.id, name: l.name }))
  }
}

function commit(next: LayerComposite, extra: Record<string, unknown> = {}) {
  validateWorkshop(next)
  activeWorkshop().setComposite(next)
  return { ok: true, ...extra, parts: toPlain(summarizeParts(next)) }
}

function groupId(p: Params, c: LayerComposite): string {
  const id = str(p, 'group_id', true)
  if (!c.partGroups?.some((g) => g.id === id)) throw new ParamError(`Unknown part group: ${id}`)
  return id
}

function runPartAction(action: string, p: Params, c: LayerComposite): unknown {
  switch (action) {
    case 'list':
      return { ok: true, parts: toPlain(summarizeParts(c)) }
    case 'auto_detect':
      return commit(autoDetectParts(c))
    case 'create_group': {
      const kind = (str(p, 'kind') ?? 'custom') as LayerPartKind
      if (!KINDS.includes(kind)) throw new ParamError(`kind must be one of ${KINDS.join(', ')}`)
      const next = createPartGroup(c, str(p, 'name') ?? 'Nhóm mới', ids(p, c), kind)
      return commit(next, { groupId: next.partGroups!.at(-1)!.id })
    }
    case 'assign':
      return commit(assignToGroup(c, ids(p, c), p.group_id === null ? null : groupId(p, c)))
    case 'lock_group':
      return commit(updatePartGroup(c, groupId(p, c), { locked: bool(p, 'locked') ?? true }))
    case 'rename_group':
      return commit(updatePartGroup(c, groupId(p, c), { name: str(p, 'name', true) }))
    case 'delete_group':
      return commit(deletePartGroup(c, groupId(p, c)))
    case 'set_slot':
      return commit(setLayerSlot(c, layerId(p, c), str(p, 'slot') ?? null, str(p, 'variant')))
    case 'activate_variant':
      return commit(activateVariant(c, layerId(p, c), bool(p, 'snap') ?? true))
    case 'move':
      return commit(moveLinked(c, layerId(p, c), num(p, 'x', true), num(p, 'y', true)))
    case 'replace_asset': {
      const mode = str(p, 'mode') ?? 'replace'
      if (mode !== 'replace' && mode !== 'variant') throw new ParamError('mode must be replace or variant')
      const path = str(p, 'asset_path', true)
      const res = replacePartAsset(c, layerId(p, c), { path, name: str(p, 'name') ?? path.split('/').pop() ?? path }, mode)
      return commit(res.composite, { layerId: res.layerId })
    }
    default:
      throw new ParamError('action must be list, auto_detect, create_group, assign, lock_group, rename_group, delete_group, set_slot, activate_variant, move or replace_asset')
  }
}

export const layerPartsCommands: Record<string, Handler> = {
  layer_assembly_parts: (p) => runPartAction(str(p, 'action', true), p, activeWorkshop().getComposite()),

  swap_composite_part: async (p) => {
    const id = str(p, 'layer_id', true)
    const layer = useEditor.getState().project.layers.find((l) => l.id === id)
    if (!layer || layer.type !== 'image') throw new ParamError(`Unknown image layer: ${id}`)
    const template = findCompositeTemplate(layer.composite?.compositeId)
    const variants = listSceneVariants(layer, template)
    const variantId = str(p, 'variant_layer_id')
    const assetPath = str(p, 'asset_path')
    if (!variantId && !assetPath) return { ok: true, layerId: id, variants: toPlain(variants) }
    const picked = variantId ? variants.find((v) => v.sourceLayerId === variantId) : undefined
    if (variantId && !picked) throw new ParamError(`variant_layer_id must be one of: ${variants.map((v) => v.sourceLayerId).join(', ') || '(none)'}`)
    const cand = picked ?? { key: assetPath!, path: assetPath!, name: str(p, 'name') ?? assetPath!.split('/').pop() ?? assetPath! }
    await swapScenePart(id, cand)
    const after = useEditor.getState().project.layers.find((l) => l.id === id)
    return { ok: true, layerId: id, name: after?.name, composite: toPlain(after?.composite) }
  }
}
