import type { TemplateFaceSpec } from '../assemblyTemplateKit'
import type { ImageMeshSlot, ImageMeshVariant } from '../imageMeshTypes'
import { IMAGE_MESH_SLOT_RULES } from '../imageMeshSlotRules'

export const standardVariants: ImageMeshVariant[] = [
  { id: 'standard', label: 'Tiêu chuẩn', en: 'Standard', scale: [1, 1, 1], bend: 1 },
  { id: 'slender', label: 'Nhỏ / cong nhẹ', en: 'Compact / gently curved', scale: [0.75, 0.75, 0.75], bend: 0.7 },
  { id: 'wide', label: 'Lớn / cong rõ', en: 'Large / strongly curved', scale: [1.3, 1.3, 1.3], bend: 1.2 }
]

export function slot(
  id: keyof typeof IMAGE_MESH_SLOT_RULES,
  label: string,
  en: string,
  aspect: [number, number],
  prompt: string,
  guidance: string
): ImageMeshSlot {
  return { id, label, en, aspect, prompt, guidance, ...IMAGE_MESH_SLOT_RULES[id] }
}

export function mesh(
  spec: TemplateFaceSpec,
  imageSlot: string,
  profile: 'none' | 'ridge' | 'sphere' = 'none',
  intensity = 0
): TemplateFaceSpec {
  return {
    ...spec,
    imageSlot,
    mesh: { meshMode: 'auto', gridRes: 48, depthProfile: profile, depthIntensity: intensity }
  }
}

/** Viền mesh phiến lá: thuôn bầu dục, nhọn đỉnh, thon cuống */
export const LEAF_POLYGON: Array<[number, number]> = [
  [0.46, 0.0],
  [0.54, 0.0],
  [0.76, 0.25],
  [0.92, 0.55],
  [0.82, 0.82],
  [0.50, 1.0],
  [0.18, 0.82],
  [0.08, 0.55],
  [0.24, 0.25]
]

/** Viền mesh thân cây / cành hoa thẳng */
export const STEM_POLYGON: Array<[number, number]> = [
  [0.40, 0.0],
  [0.60, 0.0],
  [0.60, 1.0],
  [0.40, 1.0]
]

/** Viền mesh đài hoa 6 cánh sao nhọn ôm nâng đỡ đáy đài hoa */
export const CALYX_POLYGON: Array<[number, number]> = Array.from({ length: 12 }, (_, i) => {
  const rad = (i * Math.PI) / 6
  const r = i % 2 === 0 ? 0.48 : 0.22
  return [
    Math.round((0.5 + r * Math.cos(rad)) * 1000) / 1000,
    Math.round((0.5 + r * Math.sin(rad)) * 1000) / 1000
  ]
})
