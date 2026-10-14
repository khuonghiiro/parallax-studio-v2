import {
  ALL_LAYER_TEMPLATES,
  LAYER_TEMPLATE_CATEGORY_TABS,
  findLayerTemplate,
  buildCompositeFromTemplate,
  type LayerTemplateCategory
} from '../../ui/layerAssembly/templates'
import {
  getActiveLayerAssemblySession,
  requestOpenLayerAssembly
} from '../../ui/layerAssembly/layerAssemblyBridge'
import { saveComposite } from '../../ui/layerAssembly/layerAssemblyStorage'
import { clearTextureCache } from '../../ui/assets/models3d/textureResolver'
import { clear3DLayerTextureCache } from '../../ui/layerAssembly/layerAssembly3DMesh'
import { ParamError, type Handler } from '../types'
import { str, bool, toPlain } from '../params'

export const layerAssemblyTemplateCommands: Record<string, Handler> = {
  list_layer_assembly_templates: async (p) => {
    const category = str(p, 'category') as LayerTemplateCategory | undefined
    const search = str(p, 'search')?.toLowerCase()

    let list = ALL_LAYER_TEMPLATES
    if (category && category !== 'all') {
      list = list.filter((t) => t.category === category)
    }
    if (search) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(search) ||
          t.description.toLowerCase().includes(search) ||
          t.nameEn.toLowerCase().includes(search) ||
          t.slots.some((s) => s.name.toLowerCase().includes(search))
      )
    }

    return {
      count: list.length,
      categories: LAYER_TEMPLATE_CATEGORY_TABS.map((c) => ({
        id: c.id,
        label: c.label,
        label_en: c.labelEn
      })),
      templates: list.map((t) => ({
        id: t.id,
        name: t.name,
        name_en: t.nameEn,
        category: t.category,
        age_group: t.ageGroup || null,
        description: t.description,
        description_en: t.descriptionEn,
        slot_count: t.slots.length,
        bone_count: t.bones.length,
        clip_count: t.clips.length,
        clips: t.clips.map((c) => c.name),
        slots: t.slots.map((s) => s.name),
        prompt_summary: t.promptGuide.cellLayout.slice(0, 5).join(', ') + '…'
      }))
    }
  },

  get_layer_assembly_template: async (p) => {
    const templateId = str(p, 'template_id') || str(p, 'id')
    if (!templateId) throw new ParamError('template_id is required')

    const tpl = findLayerTemplate(templateId)
    if (!tpl) {
      throw new ParamError(
        `Template "${templateId}" not found. Available: ${ALL_LAYER_TEMPLATES.map((t) => t.id).join(', ')}`
      )
    }

    return {
      id: tpl.id,
      name: tpl.name,
      name_en: tpl.nameEn,
      category: tpl.category,
      age_group: tpl.ageGroup || null,
      description: tpl.description,
      description_en: tpl.descriptionEn,
      width: tpl.width,
      height: tpl.height,
      slots: tpl.slots.map((s) => ({
        id: s.id,
        name: s.name,
        name_en: s.nameEn,
        role: s.role,
        atlas_cell: s.atlasCell ?? null,
        bone_id: s.boneId ?? null,
        suggested_asset: s.suggestedAsset ?? null,
        default_transform: s.defaultTransform,
        description: s.description
      })),
      bones: tpl.bones.map((b) => ({
        id: b.id,
        name: b.name,
        parent_id: b.parentId ?? null,
        length: b.length,
        angle: b.angle
      })),
      clips: tpl.clips.map((c) => ({
        id: c.id,
        name: c.name,
        duration: c.duration,
        loop: c.loop,
        preset_key: c.presetKey ?? null,
        description: c.description ?? null
      })),
      prompt_guide: {
        system_prompt: tpl.promptGuide.systemPrompt,
        cell_layout: tpl.promptGuide.cellLayout,
        user_guide: tpl.promptGuide.userGuide,
        aspect_ratio: tpl.promptGuide.aspectRatio || '1:1',
        recommended_resolution: tpl.promptGuide.recommendedResolution || '4096x4096'
      }
    }
  },

  apply_layer_assembly_template: async (p) => {
    const templateId = str(p, 'template_id') || str(p, 'id')
    if (!templateId) throw new ParamError('template_id is required')

    const tpl = findLayerTemplate(templateId)
    if (!tpl) {
      throw new ParamError(
        `Template "${templateId}" not found. Available: ${ALL_LAYER_TEMPLATES.map((t) => t.id).join(', ')}`
      )
    }

    const name = str(p, 'name') || tpl.name
    const imageMap = (p.images && typeof p.images === 'object' ? p.images : {}) as Record<string, string>
    const saveToLibrary = bool(p, 'save_to_library') ?? false
    const openWorkshop = bool(p, 'open_workshop') ?? true

    // Normalize image map: keys could be slot ID, role, or cell index
    const resolvedImages: Record<string, string> = {}
    for (const slot of tpl.slots) {
      const match =
        imageMap[slot.id] ||
        imageMap[slot.role] ||
        imageMap[slot.name] ||
        (slot.atlasCell ? imageMap[`cell_${slot.atlasCell}`] || imageMap[`cell${slot.atlasCell}`] : undefined)

      if (match) {
        resolvedImages[slot.id] = match
      }
    }

    clearTextureCache()
    clear3DLayerTextureCache()

    const composite = buildCompositeFromTemplate(tpl, resolvedImages, name)

    if (saveToLibrary) saveComposite(composite)

    const session = getActiveLayerAssemblySession()
    if (openWorkshop && session?.setComposite) {
      session.setComposite(composite)
    } else if (openWorkshop) {
      requestOpenLayerAssembly(composite)
    }

    return {
      ok: true,
      template_id: tpl.id,
      composite_id: composite.id,
      name: composite.name,
      layer_count: composite.layers.length,
      bone_count: composite.rig?.bones.length ?? 0,
      clip_count: composite.rig?.clips?.length ?? 0,
      bound_slots: Object.keys(resolvedImages),
      composite: toPlain(composite)
    }
  }
}
