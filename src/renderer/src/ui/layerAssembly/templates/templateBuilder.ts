import type { LayerComposite } from '../types'
import type { LayerAssemblyTemplate } from './layerTemplateTypes'

/** Each draft owns its skeleton, clips and motion settings. */
export function createTemplateComposite(
  template: LayerAssemblyTemplate,
  images: Record<string, string> = {},
  name?: string
): LayerComposite {
  const active = template.clips.find((clip) => clip.id === template.activeClipId)
  return structuredClone({
    id: `comp-${crypto.randomUUID()}`,
    name: name || template.name,
    category: template.category === 'animal' ? 'character' : template.category,
    width: template.width,
    height: template.height,
    layers: template.slots.map((slot) => {
      const source = images[slot.id] || images[slot.role] || slot.suggestedAsset
      const direct = source?.startsWith('data:') || source?.startsWith('blob:') || /^https?:/.test(source || '')
      return {
        id: `layer-${slot.id}`, name: slot.name,
        boneId: slot.boneId, bindingMode: slot.bindingMode || 'rigid',
        assetPath: direct ? undefined : source,
        imageUrl: direct ? source : undefined,
        ...slot.defaultTransform,
        opacity: slot.defaultTransform.opacity ?? 1,
        motion: slot.defaultMotion || { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      }
    }),
    ...(template.bones.length ? {
      rig: {
        bones: template.bones, duration: active?.duration ?? 2,
        loop: active?.loop ?? true, tracks: active?.tracks ?? {},
        clips: template.clips, activeClipId: active?.id
      }
    } : {})
  } satisfies LayerComposite)
}

/** The atlas and the importer use the same slot IDs and cell numbers. */
export function standardizeTemplate(template: LayerAssemblyTemplate): LayerAssemblyTemplate {
  const intro = template.promptGuide.systemPrompt.split(/(?:5x5 EQUAL CELLS:|CELLS:)/)[0].trim()
  const layout = template.slots.map((slot) => `${slot.atlasCell}. ${slot.nameEn} [${slot.id}]`)
  return {
    ...template,
    promptGuide: {
      ...template.promptGuide,
      aspectRatio: '1:1', recommendedResolution: '4096x4096',
      cellLayout: template.slots.map((slot) => `${slot.atlasCell}. ${slot.name}`),
      systemPrompt: `${intro}\nGRID: Exactly 5 rows x 5 columns, numbered 1–25 left-to-right, top-to-bottom.
CELL ASSIGNMENTS (one isolated part per assigned cell):
${layout.join('\n')}
Leave all unassigned cells empty with only the background color. No text, labels, grid lines or cast shadows.
Use one consistent pixel scale and the same orthographic view for all parts. Do not resize each part to fill its cell.
Left/right follow the assembled screen positions, not anatomical left/right. Keep all parts fully inside their cells with padding.
Include rounded hidden joint overlaps of 10–15%. Parts described as combined must stay in ONE cutout; do not duplicate hands or feet.
Preserve the complete head including hair unless a separate hair slot is listed. Keep the specified clothing and accessories with their assigned part.`
    },
    buildComposite: (images, name) => createTemplateComposite(template, images, name)
  }
}
