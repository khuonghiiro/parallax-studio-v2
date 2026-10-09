import type { AssemblyTemplate } from './assemblyTemplateKit'
import type { Face3D } from './types'
import { IMAGE_RENDER_RULES } from './imageMeshTypes'
import { IMAGE_ALPHA_RULES } from './imageMeshSlotRules'
import {
  IMAGE_CONTRACT_SCHEMA_VERSION,
  buildSlotPrompts,
  generateSlotGuideDataUrl
} from '@shared/imageMeshContract'
import { evaluateFaceAnchor3D } from '@renderer/engine/imageMesh/imageContract'

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
    schemaVersion: IMAGE_CONTRACT_SCHEMA_VERSION,
    templateId: template.id, label: template.label, label_en: template.en.label,
    variantId: variantId ?? 'standard', rules: IMAGE_RENDER_RULES,
    sourceImageCount: template.imageRecipe?.slots.length ?? 0,
    meshFaceCount: specs.length,
    variants: template.imageRecipe?.variants ?? [],
    slots: template.imageRecipe?.slots.map((s) => {
      const prompts = buildSlotPrompts(s)
      const anchorUV: [number, number] = s.anchorUV ?? (s.alphaMode === 'opaque' ? [0.5, 0.5] : [0.5, 0.0])
      const tipUV: [number, number] | undefined = s.tipUV ?? (s.alphaMode === 'cutout' ? [0.5, 1.0] : undefined)
      const guideSvgDataUrl = generateSlotGuideDataUrl({
        id: s.id,
        label: s.label,
        aspect: s.aspect,
        anchorUV,
        tipUV,
        attachmentBand: s.attachmentBand,
        silhouettePolygon: s.silhouettePolygon,
        alphaMode: s.alphaMode
      }, 240)

      return {
        ...s,
        anchorUV,
        tipUV,
        recommendedPixels: s.aspect.map((v) => v * Math.max(1, Math.floor(2048 / Math.max(...s.aspect)))),
        alpha: IMAGE_ALPHA_RULES[s.alphaMode],
        imageCount: 1,
        reuseCount: specs.filter((f) => f.imageSlot === s.id).length,
        mirrorImage: false,
        faceIndices: specs.flatMap((f, i) => f.imageSlot === s.id ? [i] : []),
        renderPrompt: `${IMAGE_RENDER_RULES.en} Canvas ratio ${s.aspect.join(':')}. ${s.prompt} ${s.symmetry.en} ${IMAGE_ALPHA_RULES[s.alphaMode].en}`,
        renderPromptEn: prompts.renderPromptEn,
        renderPromptVi: prompts.renderPromptVi,
        guideSvgDataUrl
      }
    }) ?? [],
    faces: specs.map((f, index) => {
      const faceObj: Face3D = {
        id: `f-${index}`,
        name: f.name,
        width: f.w,
        height: f.h,
        position: f.c,
        rotation: [0, 0, 0],
        bendX: f.bendX,
        bendY: f.bendY,
        bendLateral: f.bendLateral,
        bendRegion: f.bendRegion,
        arcAngle: f.arcAngle,
        taperRatio: f.taperRatio
      }
      const slot = template.imageRecipe?.slots.find((s) => s.id === f.imageSlot)
      const anchorUV = slot?.anchorUV ?? [0.5, 0.0]
      const anchor3D = evaluateFaceAnchor3D(faceObj, anchorUV)

      return {
        index,
        name: f.name,
        imageSlot: f.imageSlot,
        width: f.w,
        height: f.h,
        center: f.c,
        normal: f.n,
        up: f.up ?? [0, 1, 0],
        bendX: f.bendX ?? 0,
        bendY: f.bendY ?? 0,
        bendLateral: f.bendLateral ?? 0,
        bendRegion: f.bendRegion ?? 'all',
        arcAngle: f.arcAngle ?? 0,
        taperRatio: f.taperRatio ?? 1,
        anchor3D,
        mesh: f.mesh
      }
    }),
    workflow: [
      'get_assembly_template(template_id, variant_id) → inspect slot prompts, anchorUV and guideSvgDataUrl',
      'generate one PNG per slot using renderPromptEn or renderPromptVi',
      'open_assembly_workshop(template_id)',
      'apply_assembly_template(template_id, variant_id, images)',
      'get_assembly_state → inspect face IDs and alignment',
      'update_assembly_face → refine mesh, bend or anchor for existing images',
      'get_assembly_screenshot → visual inspection',
      'save_assembly_model / close_assembly_workshop(save=true)'
    ]
  }
}
