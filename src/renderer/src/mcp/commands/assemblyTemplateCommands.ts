import type { Model3D } from '../../ui/assets/models3d/types'
import { getActiveAssemblySession } from '../../ui/assets/models3d/assemblyBridge'
import { ASSEMBLY_TEMPLATES, TEMPLATE_CATEGORIES, appendTemplate, findTemplate, replaceWithTemplate } from '../../ui/assets/models3d/assemblyTemplates'
import { bindTemplateImages, imageTemplateGuide, resolveImageTemplate } from '../../ui/assets/models3d/imageMeshRecipe'
import { ParamError, type Handler, type Params } from '../types'
import { str } from '../params'

type ResolveModel = (p: Params) => Promise<{ model: Model3D; isSession: boolean }>
type PersistModel = (model: Model3D, isSession: boolean) => Promise<void>

export function assemblyTemplateCommands(resolveTargetModel: ResolveModel, persistModel: PersistModel): Record<string, Handler> {
  return {
    apply_assembly_template: async (p) => {
      const templateId = str(p, 'template_id', true)
      const mode = (str(p, 'mode') ?? 'replace') as 'replace' | 'append'
      const tpl = findTemplate(templateId)
      if (!tpl) throw new ParamError(`Template "${templateId}" not found`)
      if (mode !== 'replace' && mode !== 'append') throw new ParamError('mode must be replace or append')
      const resolved = resolveImageTemplate(tpl, str(p, 'variant_id'))
      bindTemplateImages(resolved, [], p.images)

      const { model, isSession } = await resolveTargetModel(p)
      const folded = mode === 'append' ? appendTemplate(resolved, model.faces) : replaceWithTemplate(resolved, model.faces)
      const start = mode === 'append' ? model.faces.length : 0
      const end = start + resolved.faces().length
      const faces = [...folded.slice(0, start), ...bindTemplateImages(resolved, folded.slice(start, end), p.images), ...folded.slice(end)]
      const updated = { ...model, faces }
      await persistModel(updated, isSession)
      if (isSession) {
        getActiveAssemblySession()?.setSelectedFaceId(faces[0]?.id || null)
      }
      return { ok: true, templateId, mode, modelId: model.id, faceCount: faces.length,
        faces: faces.slice(start, end).map((f) => ({ id: f.id, imageSlot: f.imageSlot, name: f.name })) }
    },

    get_assembly_template: (p) => {
      const tpl = findTemplate(str(p, 'template_id', true))
      if (!tpl) throw new ParamError('Unknown template_id')
      return imageTemplateGuide(tpl, str(p, 'variant_id'))
    },

    list_assembly_templates: (p) => {
      const category = str(p, 'category')
      if (category && !TEMPLATE_CATEGORIES.some((c) => c.id === category)) {
        throw new ParamError(`Unknown category "${category}" (${TEMPLATE_CATEGORIES.map((c) => c.id).join(', ')})`)
      }
      const list = ASSEMBLY_TEMPLATES.filter((t) => !category || t.category === category)
      return {
        count: list.length,
        categories: TEMPLATE_CATEGORIES.map((c) => ({ id: c.id, label: c.label, label_en: c.en })),
        templates: list.map((t) => ({
          id: t.id,
          category: t.category,
          label: t.label,
          label_en: t.en.label,
          hint: t.hint,
          hint_en: t.en.hint,
          anchor: t.anchor ?? null,
          imageMesh: !!t.imageRecipe,
          imageSlots: t.imageRecipe?.slots.map((s) => s.id) ?? [],
          faceCount: t.faces().length
        }))
      }
    },

  }
}
