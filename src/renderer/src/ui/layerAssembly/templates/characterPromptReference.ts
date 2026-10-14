import type { LayerTemplateSlot } from './layerTemplateTypes'

/**
 * Vai trò của ảnh đính kèm khi gửi prompt cho AI tạo ảnh:
 * - `layout`: ảnh mẫu CHỈ để tham khảo bố cục tách bộ phận → AI phải tạo nhân vật MỚI (mặc định).
 * - `disassemble`: ảnh đính kèm CHÍNH LÀ nhân vật cần tách bộ phận (quy trình 2 bước).
 * - `none`: không đính kèm ảnh, chỉ dùng prompt chữ.
 */
export type CharacterReferenceMode = 'layout' | 'disassemble' | 'none'

/** Tạo theo nhóm bộ phận giúp AI vẽ đầy đủ phần bị che khuất hơn. */
export type CharacterPartGroup = 'all' | 'head' | 'upper' | 'lower'

export const REFERENCE_MODE_OPTIONS: Array<{ id: CharacterReferenceMode; label: string; hint: string }> = [
  {
    id: 'layout',
    label: '🧩 Ảnh mẫu chỉ để tham khảo bố cục → Tạo nhân vật MỚI',
    hint: 'AI chỉ học cách xếp bộ phận rời trên nền xanh, tuyệt đối không chép mặt, tóc, quần áo, màu của nhân vật trong ảnh mẫu.'
  },
  {
    id: 'disassemble',
    label: '✂️ Tách bộ phận đúng nhân vật trong ảnh (Bước 2)',
    hint: 'Bước 1: tạo ảnh nhân vật đầy đủ (không đính kèm mẫu). Bước 2: đính kèm ảnh đó, AI giữ nguyên nhân vật và chỉ tách thành từng mảnh.'
  },
  {
    id: 'none',
    label: '📝 Không đính kèm ảnh (chỉ prompt chữ)',
    hint: 'Dùng khi AI vẫn bám theo ảnh mẫu: bố cục đã được mô tả đủ chi tiết trong prompt.'
  }
]

export const PART_GROUP_OPTIONS: Array<{ id: CharacterPartGroup; label: string }> = [
  { id: 'all', label: 'Tất cả bộ phận' },
  { id: 'head', label: 'Nhóm đầu (đầu, tóc, biểu cảm, kính)' },
  { id: 'upper', label: 'Nhóm thân trên (thân áo, tay)' },
  { id: 'lower', label: 'Nhóm thân dưới (đùi, ống quần, giày)' }
]

const HEAD_PREFIXES = ['head', 'face', 'glasses', 'hair-', 'hat', 'beard', 'mask', 'ear']
const LOWER_PREFIXES = ['thigh-', 'shin-', 'foot-', 'pelvis']

export function slotPartGroup(slot: LayerTemplateSlot): Exclude<CharacterPartGroup, 'all'> {
  if (HEAD_PREFIXES.some((p) => slot.id.startsWith(p))) return 'head'
  if (LOWER_PREFIXES.some((p) => slot.id.startsWith(p))) return 'lower'
  return 'upper'
}

export function filterSlotsByGroup(
  slots: LayerTemplateSlot[],
  group: CharacterPartGroup = 'all'
): LayerTemplateSlot[] {
  if (group === 'all') return slots
  const filtered = slots.filter((slot) => slotPartGroup(slot) === group)
  return filtered.length ? filtered : slots
}

/** Khối chỉ dẫn vai trò ảnh đính kèm — chống việc AI "sửa ảnh mẫu" thay vì tạo nhân vật mới. */
export function referenceRoleBlock(mode: CharacterReferenceMode = 'layout'): string {
  if (mode === 'disassemble') {
    return `REFERENCE IMAGE ROLE (DISASSEMBLE MODE): The attached image IS the exact character to disassemble. Keep its face shape, hairstyle, outfit, colors, accessories, proportions and line-art style 100% identical. Do not redesign or restyle anything — only separate this same character into the isolated parts listed below.`
  }
  if (mode === 'none') {
    return `REFERENCE IMAGE ROLE: No reference image is used. Follow ONLY the text description and the layout rules below.`
  }
  return `REFERENCE IMAGE ROLE (LAYOUT REFERENCE ONLY): Create a COMPLETELY NEW original character. The attached image(s), if any, are a LAYOUT REFERENCE ONLY — copy only the idea of separated body parts on a flat green background and the clean cutout style. Do NOT copy its character, face, hairstyle, outfit, colors, accessories or pose. This is NOT an edit / img2img task: never redraw, retouch or reuse the reference character.`
}

export const COMPLETE_PARTS_RULE = `CRITICAL — DRAW EVERY PART COMPLETE AS IF NOTHING COVERS IT:
- Full oval head shape under the hair, full back hair, full neck under the collar, full shoulder inside the sleeve, full thigh inside the trousers/skirt, full ankle inside the shoe.
- Rounded overlapping joint ends on every limb segment (shoulder, elbow, hip, knee) so rotated parts never expose gaps.
- Front view, neutral A-pose proportions, orthographic, clean black outlines, cel shading, consistent line weight, high resolution.
- Flat solid pure green (#00FF00) background with no shadow and no gradient; every part is isolated with at least 40px spacing, none touching or overlapping.`

export function partGroupBlock(group: CharacterPartGroup = 'all'): string {
  if (group === 'all') return ''
  const label = PART_GROUP_OPTIONS.find((g) => g.id === group)?.label ?? group
  return `\nMULTI-PASS PART GROUP: This sheet contains ONLY the "${label}" group of a multi-pass set for the SAME character. Keep the identical character scale, line weight, palette and lighting as the other groups so every pass assembles together seamlessly.`
}

export function characterNegativePrompt(mode: CharacterReferenceMode = 'layout'): string {
  const items = [
    'assembled character',
    'full body pose',
    'overlapping parts',
    'cropped parts',
    mode === 'disassemble' ? 'redesigned character' : 'copy of reference character',
    'shadows',
    'background details',
    'text',
    'watermark',
    '3/4 view'
  ]
  return items.join(', ')
}

/** Ví dụ mô tả nhân vật mới điền sẵn (Tướng mạo / Trang phục / Phụ kiện). */
export const NEW_CHARACTER_EXAMPLES = [
  {
    label: '👧 Nữ sinh tóc bạc buộc hai bên',
    brief: {
      appearance: 'Gender: female. Hair: long silver twin-tails with blue ribbons. Eyes: big round violet eyes. Skin: fair. Vibe: cheerful.',
      costume: 'Navy sailor-style school uniform with a white collar, red bow, pleated short skirt, white knee socks, brown loafers.',
      props: 'Star hairpin, small shoulder bag.'
    }
  },
  {
    label: '🧑 Nam tóc gừng áo khoác xanh',
    brief: {
      appearance: 'Gender: male. Hair: messy short ginger hair. Eyes: sharp amber eyes. Skin: tan. Vibe: laid-back.',
      costume: 'Dark green hooded jacket over a white t-shirt, black cargo pants, white sneakers.',
      props: 'Silver chain necklace, fingerless glove on the left hand.'
    }
  }
]
