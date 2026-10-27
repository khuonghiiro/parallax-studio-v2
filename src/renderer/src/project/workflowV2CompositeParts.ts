import type { Layer, Project } from '@shared/types'
import { findCompositeTemplate } from '../ui/layerAssembly/scenePartSwap'
import type { AssembledLayerItem, LayerComposite } from '../ui/layerAssembly/types'
import { autoDetectParts, layerAssetPath } from '../ui/layerAssembly/workshopParts'
import { slotNames, slotVariantGroups } from '../ui/layerAssembly/workshopPartSets'
import { getClusterMemberLayers, getClusterPartShortName, getClusterRootLayer } from './workflowV2ClusterRigAndSwap'

export interface DynamicCompositePartVariant {
  id: string
  name: string
  label: string
  layerId?: string
  sourceLayerId?: string
  assetPath?: string
  sceneLayerIds: string[]
  visible: boolean
}

export interface DynamicCompositePartEntry {
  /** Mã định danh bộ phận (lấy từ `partGroup.id`, `slot:<tên_khe>` hoặc `face:<id>`) */
  id: string
  /** Tiêu đề chính xác đặt trong Tab `Bộ phận` của Xưởng lắp ráp 2.5D (hoặc tên Mặt 3D) */
  title: string
  /** Biểu tượng đại diện cho bộ phận */
  icon: string
  /** Loại nguồn bộ phận */
  kind: 'part_group' | 'slot_variant' | 'scene_part' | 'model3d_face'
  sourceKind: 'part_group' | 'slot_variant' | 'scene_part' | 'model3d_face'
  /** Danh sách ID các Layer thực tế trên cảnh thuộc bộ phận này */
  layerIds: string[]
  /** Danh sách các Layer thực tế trên cảnh thuộc bộ phận này */
  memberLayers: Layer[]
  /** Danh sách các biến thể thay thế nhau trong cùng bộ phận (nếu có) */
  variants: DynamicCompositePartVariant[]
  /** Trạng thái đang hiển thị của bộ phận trên cảnh */
  visible: boolean
}

function resolvePartIcon(title: string, kind: DynamicCompositePartEntry['kind']): string {
  if (kind === 'model3d_face') return '🧊'
  const k = title.toLowerCase()
  if (k.includes('mặt') || k.includes('biểu cảm') || k.includes('face') || k.includes('mắt') || k.includes('miệng')) return '😊'
  if (k.includes('tóc') || k.includes('hair') || k.includes('đầu') || k.includes('head')) return '💇'
  if (k.includes('tay') || k.includes('arm') || k.includes('hand')) return '💪'
  if (k.includes('chân') || k.includes('leg') || k.includes('thigh') || k.includes('foot')) return '🦵'
  if (k.includes('thân') || k.includes('áo') || k.includes('body') || k.includes('torso')) return '👕'
  if (k.includes('kính') || k.includes('mũ') || k.includes('phụ kiện') || k.includes('cặp')) return '👓'
  return '🧩'
}

function buildVirtualCompositeFromScene(members: Layer[]): LayerComposite {
  const root = getClusterRootLayer(members) ?? members[0]
  const layers: AssembledLayerItem[] = members.map((m, idx) => ({
    id: m.composite?.sourceLayerId || m.id,
    name: getClusterPartShortName(m),
    assetId: m.type === 'image' ? m.props.assetId : '',
    imageDataUrl: '',
    x: m.composite?.rootOffset?.[0] ?? 0,
    y: m.composite?.rootOffset?.[1] ?? 0,
    z: m.composite?.rootOffset?.[2] ?? idx,
    scale: 1,
    rotation: 0,
    opacity: 1,
    visible: m.visible !== false,
    slot: m.composite?.slot,
    variant: m.composite?.variant,
    motion: { enabled: false, type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
  }))
  return autoDetectParts({
    id: root?.composite?.compositeId || root?.composite?.instanceId || 'scene-comp',
    name: root?.composite?.compositeName || root?.name || 'Cụm 2.5D',
    category: 'character',
    width: 600,
    height: 800,
    layers,
    createdAt: 0,
    updatedAt: 0
  })
}

function matchSceneLayersForTemplateItems(
  members: Layer[],
  items: AssembledLayerItem[]
): Layer[] {
  const ids = new Set(items.map((it) => it.id.toLowerCase()))
  const names = new Set(items.map((it) => it.name.trim().toLowerCase()))
  return members.filter((m) => {
    const srcId = (m.composite?.sourceLayerId || '').toLowerCase()
    const shortName = getClusterPartShortName(m).toLowerCase()
    const rawName = (m.name || '').replace(/^\[[^\]]+\]\s*/, '').trim().toLowerCase()
    return (srcId && ids.has(srcId)) || names.has(shortName) || (rawName && names.has(rawName))
  })
}

/**
 * Đọc động danh sách Bộ phận của Cụm 2.5D theo đúng cấu trúc & tiêu đề (title) đã lắp ráp
 * bên trong Xưởng lắp ráp 2.5D -> Tab `Bộ phận` (`partGroups` & `slotVariantGroups`),
 * hoặc danh sách Mặt 3D nếu là Khối 3D (`model3d`).
 * Tuyệt đối không đặt cố định bộ phận thừa nếu cụm không có bộ phận đó.
 */
export function extractCompositeDynamicParts(
  project: Project,
  instanceId?: string | null,
  fallbackLayer?: Layer | null
): DynamicCompositePartEntry[] {
  const members = getClusterMemberLayers(project, instanceId, fallbackLayer)
  if (members.length === 0) return []

  const root = getClusterRootLayer(members) ?? members[0]

  // 1. Trường hợp Khối 3D (`model3d`): lấy theo các Mặt 3D thực tế của khối
  if (root?.model3d || members.some((m) => Boolean(m.model3d))) {
    if (members.length <= 1 && !root?.model3d?.faceId) return []
    return members.map((m) => {
      const title = getClusterPartShortName(m)
      return {
        id: `face:${m.model3d?.faceId || m.id}`,
        title,
        icon: '🧊',
        kind: 'model3d_face' as const,
        sourceKind: 'model3d_face' as const,
        layerIds: [m.id],
        memberLayers: [m],
        variants: [],
        visible: m.visible !== false
      }
    })
  }

  // 2. Trường hợp Layer đơn lẻ (không phải Cụm 2.5D nhiều mảnh)
  if (!root?.composite && members.length <= 1) {
    return []
  }

  const rawTemplate = findCompositeTemplate(root?.composite?.compositeId)
  const comp: LayerComposite = rawTemplate
    ? (rawTemplate.partGroups?.length ?? 0) > 0 || rawTemplate.layers.some((l) => Boolean(l.slot))
      ? rawTemplate
      : autoDetectParts(rawTemplate)
    : buildVirtualCompositeFromScene(members)

  const out: DynamicCompositePartEntry[] = []
  const coveredLayerIds = new Set<string>()

  // 2a. Lấy các Bộ biến thể (`slotNames`) từ Tab `Bộ phận`
  for (const slot of slotNames(comp)) {
    const vGroups = slotVariantGroups(comp, slot)
    if (vGroups.length === 0) continue
    const slotLayers = matchSceneLayersForTemplateItems(
      members,
      vGroups.flatMap((vg) => vg.layers)
    )
    if (slotLayers.length === 0) continue
    slotLayers.forEach((l) => coveredLayerIds.add(l.id))

    const variants: DynamicCompositePartVariant[] = vGroups.map((vg) => {
      const matched = matchSceneLayersForTemplateItems(members, vg.layers)
      const tplItem = vg.layers[0]
      const rawVar = vg.variant || tplItem?.name || 'Biến thể'
      const vLabel =
        rawVar === 'normal'
          ? 'Mặt thường (normal)'
          : rawVar === 'happy'
            ? 'Mặt cười (happy)'
            : rawVar
      const isCurrentTemplateVar = Boolean(
        tplItem?.id && slotLayers.some((sl) => sl.composite?.sourceLayerId === tplItem.id && sl.visible !== false)
      )
      return {
        id: matched[0]?.id || tplItem?.id || vLabel,
        name: vLabel,
        label: vLabel,
        layerId: matched[0]?.id || slotLayers[0]?.id,
        sourceLayerId: tplItem?.id,
        assetPath: tplItem ? layerAssetPath(comp, tplItem) || tplItem.imageUrl || '' : '',
        sceneLayerIds: matched.length > 0 ? matched.map((m) => m.id) : slotLayers.map((sl) => sl.id),
        visible: matched.length > 0 ? matched.some((m) => m.visible !== false) : isCurrentTemplateVar
      }
    })

    const matchingGroup = (comp.partGroups ?? []).find(
      (pg) => pg.name.toLowerCase() === slot.toLowerCase()
    )
    const slotLabelMap: Record<string, string> = {
      face: 'Khuôn mặt / Biểu cảm',
      arm_r: 'Tay phải',
      arm_l: 'Tay trái',
      leg_r: 'Chân phải',
      leg_l: 'Chân trái',
      head: 'Đầu & Tóc',
      torso: 'Thân áo'
    }
    const slotTitle = matchingGroup?.name || slotLabelMap[slot] || slot

    out.push({
      id: `slot:${slot}`,
      title: slotTitle,
      icon: resolvePartIcon(slotTitle, 'slot_variant'),
      kind: 'slot_variant',
      sourceKind: 'slot_variant',
      layerIds: slotLayers.map((l) => l.id),
      memberLayers: slotLayers,
      variants,
      visible: slotLayers.some((l) => l.visible !== false)
    })
  }

  // 2b. Lấy các Nhóm liên kết (`partGroups`) đúng theo title đặt trong Tab `Bộ phận`
  for (const pg of comp.partGroups ?? []) {
    const groupTemplateLayers = comp.layers.filter((l) => l.partGroupId === pg.id)
    const matched = matchSceneLayersForTemplateItems(members, groupTemplateLayers)
    if (matched.length === 0) continue
    if (matched.every((m) => coveredLayerIds.has(m.id))) {
      continue
    }
    matched.forEach((l) => coveredLayerIds.add(l.id))

    out.push({
      id: pg.id,
      title: pg.name,
      icon: resolvePartIcon(pg.name, 'part_group'),
      kind: 'part_group',
      sourceKind: 'part_group',
      layerIds: matched.map((m) => m.id),
      memberLayers: matched,
      variants: [],
      visible: matched.some((m) => m.visible !== false)
    })
  }

  // 2c. Các mảnh con còn lại trong cụm chưa gán nhóm (ví dụ phụ kiện rời hoặc mảnh lẻ trong Xưởng 2.5D)
  for (const m of members) {
    if (coveredLayerIds.has(m.id)) continue
    const shortName = getClusterPartShortName(m)
    out.push({
      id: `part:${m.id}`,
      title: shortName,
      icon: resolvePartIcon(shortName, 'scene_part'),
      kind: 'scene_part',
      sourceKind: 'scene_part',
      layerIds: [m.id],
      memberLayers: [m],
      variants: [],
      visible: m.visible !== false
    })
  }

  return out
}
