import type { AssemblyTemplate } from './assemblyTemplateKit'
import type { Face3D } from './types'
import { IMAGE_RENDER_RULES } from './imageMeshTypes'

export function resolveImageTemplate(template: AssemblyTemplate, variantId?: string): AssemblyTemplate {
  if (!variantId) return template
  const variant = template.imageRecipe?.variants.find((v) => v.id === variantId)
  if (!variant) throw new Error(`Unknown image-mesh variant "${variantId}" for ${template.id}`)
  return { ...template, faces: () => template.faces().map((f) => ({
    ...f, w: f.w * variant.scale[0], h: f.h * variant.scale[1],
    c: f.c.map((v, i) => v * variant.scale[i]) as [number, number, number],
    bendX: (f.bendX ?? 0) * variant.bend, bendY: (f.bendY ?? 0) * variant.bend
  })) }
}

export function bindTemplateImages(template: AssemblyTemplate, faces: Face3D[], images?: unknown): Face3D[] {
  if (images === undefined) return faces
  if (!images || typeof images !== 'object' || Array.isArray(images)) throw new Error('images must be an object keyed by image slot ID')
  const slots = new Set(template.imageRecipe?.slots.map((s) => s.id) ?? [])
  for (const [key, value] of Object.entries(images)) {
    if (!slots.has(key)) throw new Error(`Unknown image slot "${key}" for ${template.id}`)
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Image "${key}" must be a non-empty asset path or data URL`)
  }
  const bindings = images as Record<string, string>
  return faces.map((f) => f.imageSlot && Object.hasOwn(bindings, f.imageSlot)
    ? { ...f, assetPath: bindings[f.imageSlot], assetId: undefined } : f)
}

/** Shared UI/MCP contract: stable slot IDs, image prompts, mesh settings and geometry. */
export function imageTemplateGuide(template: AssemblyTemplate, variantId?: string) {
  const resolved = resolveImageTemplate(template, variantId)
  const specs = resolved.faces()
  return {
    templateId: template.id, label: template.label, label_en: template.en.label,
    variantId: variantId ?? 'standard', rules: IMAGE_RENDER_RULES,
    variants: template.imageRecipe?.variants ?? [],
    slots: template.imageRecipe?.slots.map((s) => ({ ...s,
      recommendedPixels: s.aspect.map((v) => Math.round(v / Math.max(...s.aspect) * 2048)),
      faceIndices: specs.flatMap((f, i) => f.imageSlot === s.id ? [i] : []),
      renderPrompt: `${IMAGE_RENDER_RULES.en} Canvas ratio ${s.aspect.join(':')}. ${s.prompt}`
    })) ?? [],
    faces: specs.map((f, index) => ({ index, name: f.name, imageSlot: f.imageSlot,
      width: f.w, height: f.h, center: f.c, normal: f.n, up: f.up ?? [0, 1, 0],
      bendX: f.bendX ?? 0, bendY: f.bendY ?? 0, mesh: f.mesh })),
    workflow: ['open_assembly_workshop(template_id)', 'apply_assembly_template(template_id, variant_id, images)',
      'get_assembly_state → inspect face IDs', 'update_assembly_face → refine mesh for existing images',
      'get_assembly_screenshot → review', 'save_assembly_model / close_assembly_workshop(save=true)']
  }
}
