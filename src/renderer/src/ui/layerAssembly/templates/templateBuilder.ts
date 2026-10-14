import type { LayerComposite } from '../types'
import type { LayerAssemblyTemplate } from './layerTemplateTypes'
import { characterPrompt, CHARACTER_PROMPT_GUIDE } from './characterPrompt'

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
  const layout = template.slots.map((slot) => `${slot.atlasCell}. ${slot.nameEn} [${slot.id}] — ${slot.description || slot.nameEn}`)
  const categoryRules =
    template.category === 'animal'
      ? `Include rounded hidden joint overlaps of 10–15% at neck, shoulder, hip, knee/hock, wing, fin and tail base so rotating parts never expose gaps.
Near-side and far-side limbs must be drawn as separate isolated cutouts at the same pixel scale; shade far-side limbs slightly darker for 2.5D depth.
Crisp antialiased edges on a flat uniform chroma-key background; no blur, glow, fringe, cast shadows or ground plane.`
      : `Reconstruct the complete occluded silhouette of each depth layer (e.g., full foliage crown behind trunk, full window frame behind planter, full stone archway behind hanging vines) so 2.5D parallax camera movement and wind sway never expose raw cut gaps.
Crisp antialiased edges on a flat uniform chroma-key background; no blur, glow, fringe, cast shadows or ground plane.`
  return {
    ...template,
    promptGuide: {
      ...template.promptGuide,
      aspectRatio: '1:1', recommendedResolution: template.category === 'character' ? 'model-native' : '4096x4096',
      userGuide: template.category === 'character' ? CHARACTER_PROMPT_GUIDE : template.promptGuide.userGuide,
      cellLayout: template.slots.map((slot) => `${slot.atlasCell}. ${slot.name}`),
      systemPrompt: template.category === 'character' ? characterPrompt(template) : `${intro}
GRID: Exactly 5 rows x 5 columns, numbered 1–25 left-to-right, top-to-bottom.
Exactly ${template.slots.length} isolated parts, one assigned part per cell:
CELL ASSIGNMENTS (one isolated part per assigned cell):
${layout.join('\n')}
Leave all unassigned cells empty with only the background color. No text, labels, grid lines or cast shadows.
Use one consistent pixel scale and the same orthographic view for all parts. Do not resize each part to fill its cell.
Left/right follow the assembled screen positions, not anatomical left/right. Keep all parts fully inside their cells with at least 8% clear padding.
${categoryRules}`
    },
    buildComposite: (images, name) => createTemplateComposite(template, images, name)
  }
}
