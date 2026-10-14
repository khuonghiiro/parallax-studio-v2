import type { LayerAssemblyTemplate, LayerTemplateCategory } from './layerTemplateTypes'
import { standardizeTemplate } from './templateBuilder'
import { HUMANOID_TEMPLATES } from './humanoidTemplates'
import { ANIMAL_TEMPLATES } from './animalTemplates'
import { NATURE_PROP_TEMPLATES } from './naturePropTemplates'
import type { LayerComposite } from '../types'

export * from './layerTemplateTypes'
export * from './characterPrompt'
export * from './creatureRigPresets'
export * from './humanoidTemplates'
export * from './animalTemplates'
export * from './naturePropTemplates'
export * from './templateIcons'

export const ALL_LAYER_TEMPLATES: LayerAssemblyTemplate[] = [
  ...HUMANOID_TEMPLATES,
  ...ANIMAL_TEMPLATES,
  ...NATURE_PROP_TEMPLATES
].map(standardizeTemplate)

export interface LayerTemplateCategoryTab {
  id: LayerTemplateCategory
  label: string
  labelEn: string
  icon: string
  order: number
}

export const LAYER_TEMPLATE_CATEGORY_TABS: LayerTemplateCategoryTab[] = [
  { id: 'all', label: 'Tất cả mẫu', labelEn: 'All Templates', icon: 'layers', order: 0 },
  { id: 'character', label: 'Nhân vật 3 Hướng (Đầu người)', labelEn: 'Human Characters (3 Views)', icon: 'user', order: 1 },
  { id: 'animal', label: 'Động vật & Sinh vật', labelEn: 'Animals & Creatures', icon: 'paw', order: 2 },
  { id: 'nature', label: 'Cây cối & Thiên nhiên', labelEn: 'Nature & Foliage', icon: 'tree', order: 3 },
  { id: 'architecture', label: 'Kiến trúc & Đạo cụ', labelEn: 'Architecture & Props', icon: 'home', order: 4 }
]

const LEGACY_TEMPLATE_ID_ALIASES: Record<string, string> = {
  'tmpl-character-male-hero': 'tmpl-character-front'
}

export function findLayerTemplate(id: string): LayerAssemblyTemplate | undefined {
  if (!id) return undefined
  const rawId = id.trim().toLowerCase()
  const cleanId = LEGACY_TEMPLATE_ID_ALIASES[rawId] ?? rawId
  return ALL_LAYER_TEMPLATES.find((t) => t.id.toLowerCase() === cleanId)
}

export function buildCompositeFromTemplate(
  template: LayerAssemblyTemplate,
  images?: Record<string, string>,
  nameOverride?: string
): LayerComposite {
  return template.buildComposite(images, nameOverride)
}
