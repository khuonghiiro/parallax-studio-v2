import type { CharacterPromptCustomBrief } from './characterPrompt'
import type { CharacterPartGroup, CharacterReferenceMode } from './characterPromptReference'

/**
 * Prompt "bóc tách chi tiết" kiểu Live2D / Spine (~45 mảnh): tóc nhiều lớp, đầu trơn, biểu cảm rời,
 * thân trần + quần áo từng lớp, tay/chân trái phải vẽ riêng. Dùng khi muốn rig nhân vật 2.5D mềm mại hơn
 * mẫu 13 mảnh (mẫu 13 mảnh vẫn dùng để nhập thẳng vào khung template).
 */

interface GranularSection {
  title: string
  group: Exclude<CharacterPartGroup, 'all'>
  items: string[]
}

const GRANULAR_SECTIONS: GranularSection[] = [
  {
    title: 'HAIR (at least 6-8 pieces)',
    group: 'head',
    items: [
      'back hair mass (complete, no face hole, drawn full)',
      'front bangs',
      'left side lock',
      'right side lock',
      'tail / ponytail / twin-tails as separate pieces (if the hairstyle has them)',
      'small stray strands / ahoge',
      'hair accessories (clips, ribbons, bows) as separate pieces'
    ]
  },
  {
    title: 'HEAD',
    group: 'head',
    items: [
      'blank head base: full oval, skin-colored, NO eyes, NO nose, NO mouth, NO eyebrows, NO hair',
      'left ear',
      'right ear',
      'neck (with overlap area at top and bottom)'
    ]
  },
  {
    title: 'FACE (floating, separate)',
    group: 'head',
    items: [
      'left eye + right eye: open, half-closed, closed, angry variants',
      'left eyebrow',
      'right eyebrow',
      'mouth: neutral, smile, open',
      'blush marks'
    ]
  },
  {
    title: 'TORSO / CLOTHING (split in layers)',
    group: 'upper',
    items: [
      'bare torso base (skin body under clothes, complete)',
      'top / blouse / shirt (front panel only)',
      'collar / neckwear (scarf, ribbon, tie) as a separate piece',
      'outer layer separate: jacket, cape, apron, sash, hanging cloth',
      'decorative items: brooches, pouches, bags, straps as individual pieces'
    ]
  },
  {
    title: 'WAIST / SKIRT / PANTS',
    group: 'lower',
    items: [
      'belt / waistband',
      'skirt or pants: FRONT panel and BACK panel as two separate pieces; the back panel looks different (no front decorations) and is drawn complete'
    ]
  },
  {
    title: 'ARMS (BOTH left and right, each drawn individually, not mirrored)',
    group: 'upper',
    items: [
      '2 upper arms (skin)',
      '2 forearms (skin)',
      '2 hands (open palm)',
      '2 sleeves over the upper arm',
      '2 sleeve cuffs / forearm sleeves (separate from the arm underneath)'
    ]
  },
  {
    title: 'LEGS (BOTH left and right, each drawn individually)',
    group: 'lower',
    items: [
      '2 thighs (full skin capsule, including the part hidden under the skirt/shorts)',
      '2 thigh accessories (garter, band, stocking top) — only if the outfit has them',
      '2 lower legs / calves',
      '2 socks / leg warmers / boot shafts',
      '2 shoes (complete)'
    ]
  }
]

const GROUP_LABEL: Record<Exclude<CharacterPartGroup, 'all'>, string> = {
  head: 'hair + head + face',
  upper: 'torso + clothing + arms',
  lower: 'waist/skirt/pants + legs'
}

function characterBlock(brief?: CharacterPromptCustomBrief): string {
  const app = brief?.appearance?.trim()
  const cos = brief?.costume?.trim()
  const prp = brief?.props?.trim()
  const appearance = app
    ? `Appearance (gender, hair, eyes, skin tone, vibe): ${app}`
    : 'Gender: ...\nHair: ... (style, length, color)\nEyes: ... (shape, color)\nSkin tone: ...'
  return `[CHARACTER]
${appearance}
Outfit: ${cos || '... (top, bottom, outer layer, socks, shoes, colors, materials)'}
Accessories: ${prp || '... (2-3 items)'}`
}

function openingLine(mode: CharacterReferenceMode): string {
  if (mode === 'disassemble') {
    return 'Disassemble the EXACT character in the attached image (keep its face, hairstyle, outfit, colors and line-art 100% identical) into a highly granular 2D cutout sprite sheet for Live2D / Spine style rigging.'
  }
  const ref =
    mode === 'layout'
      ? ' Any attached image is a LAYOUT REFERENCE ONLY: copy only the idea of separated parts on a green background — never its character, face, hair, outfit, colors or accessories.'
      : ''
  return `Create a COMPLETELY NEW original anime chibi character as a highly granular disassembled 2D cutout sprite sheet for Live2D / Spine style rigging.${ref}`
}

function partsList(group: CharacterPartGroup): string {
  const sections = group === 'all' ? GRANULAR_SECTIONS : GRANULAR_SECTIONS.filter((s) => s.group === group)
  let n = 0
  const body = sections
    .map((s) => `${s.title}:\n${s.items.map((item) => `${++n}. ${item}`).join('\n')}`)
    .join('\n\n')
  const scope =
    group === 'all'
      ? ''
      : `\nTHIS SHEET = ONLY the "${GROUP_LABEL[group]}" group of a multi-pass set. Keep the identical character design, scale, line weight and palette as the other sheets.\n`
  return `PARTS LIST (each is its own separate piece):${scope}\n${body}`
}

const SHEET_RULES = `SHEET RULES:
- ONE sheet, FRONT VIEW ONLY. No assembled character, no preview, no back view, no side view.
- Flat solid pure green (#00FF00) background, no shadow, no gradient, no ground.
- NO text, NO labels, NO headings, NO group names anywhere.
- Every piece is isolated and floating, with at least 50px spacing. No piece touches or overlaps another.
- Arrange in a clean grid by group: hair + head + face (top), torso + clothing (middle), arms (side), legs (bottom).
- All pieces drawn at a consistent scale, as they would be on one single character.
- Absolutely NO assembled outfit anywhere. Every garment exists ONLY as separate pieces.`

const COMPLETENESS_RULES = `CRITICAL COMPLETENESS RULES:
Every piece is drawn COMPLETE as if nothing is in front of it or behind it:
- head base is a full oval even where hair would cover it
- back hair, back skirt/pants panel and torso base are fully drawn in hidden areas
- shoulder, upper arm and thigh are fully drawn inside sleeves and skirt/pants
- each limb piece ends in a rounded, slightly extended joint end so pieces overlap cleanly when assembled
- sleeve is NEVER fused with the arm; skirt/pants are NEVER fused with the top`

const STYLE_RULES = `STYLE: neutral A-pose proportions, flat orthographic, no perspective, clean black outlines, cel shading, consistent line weight and lighting across all pieces, high resolution, sharp edges for easy cutting. Green (#00FF00) must not appear on the character itself.`

const STRICT_FIXES = `FIXES (strict):
- BACK HAIR: one wide flat hair mass shaped like a hair curtain seen from the front, hanging behind the shoulders, with NO face hole, NOT a ball or bun. Twin-tails / ponytails are separate pieces and are NOT attached to it.
- BANGS: a single separate piece, NOT attached to the twin-tails or side locks.
- TORSO BASE: torso only, from neck to hips, with short rounded shoulder stubs and NO arms attached. Arms are separate pieces.
- ARMS: exactly 2 complete arms. For EACH side draw separately: upper arm, forearm, hand (3 pieces) plus sleeve piece. Total 6 skin pieces + 2 sleeves. Do not duplicate beyond this.
- LEGS: exactly 2 thighs, 2 calves, 2 socks, 2 shoes. No duplicated sets, no extra legs.
- Draw each count exactly once. Do not repeat any piece.
- Keep the same character design on every sheet.`

export function granularNegativePrompt(mode: CharacterReferenceMode = 'layout'): string {
  const items = [
    'assembled character', 'assembled outfit', 'finished character', 'full body preview',
    'back view', 'side view', '3/4 view', 'overlapping parts', 'touching parts', 'merged parts',
    'merged hair', 'sleeve fused with arm', 'skirt fused with torso', 'one-sided limbs',
    'cropped parts', 'hidden areas cut off',
    mode === 'disassemble' ? 'redesigned character' : 'copy of reference character',
    'shadows', 'background details', 'text', 'labels', 'headings', 'watermark', 'gradient background',
    'duplicated parts', 'repeated legs', 'torso fused with arms', 'hair ball', 'bun',
    'cut-off shoulders', 'extra limbs'
  ]
  return items.join(', ')
}

/** Prompt bóc tách chi tiết Live2D / Spine — dùng chung cho UI và MCP. */
export function granularCharacterPrompt(brief?: CharacterPromptCustomBrief): string {
  const mode = brief?.referenceMode ?? 'layout'
  const group = brief?.partGroup ?? 'all'
  return [
    openingLine(mode),
    characterBlock(brief),
    SHEET_RULES,
    partsList(group),
    COMPLETENESS_RULES,
    STYLE_RULES,
    STRICT_FIXES,
    `NEGATIVE PROMPT: ${granularNegativePrompt(mode)}`
  ].join('\n\n')
}
