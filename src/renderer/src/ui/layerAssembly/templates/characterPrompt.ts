import type { LayerAssemblyTemplate, LayerTemplateSlot } from './layerTemplateTypes'

export interface CharacterPromptCustomBrief {
  /** Mô tả tướng mạo, khuôn mặt, kiểu tóc, màu mắt, biểu cảm */
  appearance?: string
  /** Mô tả quần áo, trang phục, áo giáp, màu sắc vải, giày dép */
  costume?: string
  /** Mô tả phụ kiện (áo choàng, mũ, kính) hoặc vũ khí/đạo cụ cầm tay */
  props?: string
}

function slotBriefHint(slot: LayerTemplateSlot, brief?: CharacterPromptCustomBrief): string {
  if (!brief) return ''
  const app = brief.appearance?.trim()
  const cos = brief.costume?.trim()
  const prp = brief.props?.trim()
  if ((slot.id === 'head' || slot.id.startsWith('hair-') || slot.id.startsWith('face')) && app) {
    return ` Match user's described appearance/hair/facial style: "${app}".`
  }
  if (
    (slot.id === 'torso' ||
      slot.id === 'pelvis' ||
      slot.id === 'cape' ||
      slot.id.startsWith('arm-') ||
      slot.id.startsWith('forearm-') ||
      slot.id.startsWith('thigh-') ||
      slot.id.startsWith('shin-') ||
      slot.id.startsWith('foot-')) &&
    cos
  ) {
    return ` Draw wearing user's described outfit/clothing: "${cos}".`
  }
  if (
    (slot.id === 'hat' ||
      slot.id === 'glasses' ||
      slot.id === 'beard' ||
      slot.id === 'mask' ||
      slot.id === 'cape' ||
      slot.id.startsWith('prop-')) &&
    prp
  ) {
    return ` Match user's described accessory/weapon/prop: "${prp}".`
  }
  return ''
}

function detectViewSpec(template: LayerAssemblyTemplate): string {
  if (template.id.includes('back') || /180°|sau lưng|back view/i.test(template.name)) {
    return 'BACK ORTHOGRAPHIC VIEW (180° seen directly from behind), vertically upright arm and leg segments, proximal joints centered at top and distal joints centered at bottom; show the back of the head, hair crown, back collar, back waist belt, dorsal hands, and boot heels.'
  }
  return 'FRONT ORTHOGRAPHIC VIEW (0° chính diện), vertically upright arm and leg segments hanging straight down, proximal joints rounded at top and distal joints at bottom; no bent or diagonal limbs; bold clean anime line-art with cel-shading.'
}

function partBoundary(
  slot: LayerTemplateSlot,
  ids: Set<string>,
  brief?: CharacterPromptCustomBrief
): string {
  const side = slot.id.endsWith('-l') ? 'l' : 'r'
  const hint = slotBriefHint(slot, brief)
  if (slot.id.startsWith('arm-') && ids.has(`forearm-${side}`))
    return `Upper arm sleeve from rounded shoulder top to elbow cuff ONLY; NO forearm, hand, chest or opposite arm.${hint}`
  if (slot.id.startsWith('arm-'))
    return `Whole arm from shoulder to hand in one piece, including sleeve and fingers; NO torso or opposite arm.${hint}`
  if (slot.id.startsWith('forearm-') && ids.has(`hand-${side}`))
    return `Elbow to wrist ONLY; NO upper arm, hand, fingers or held prop.${hint}`
  if (slot.id.startsWith('forearm-'))
    return `Forearm and hand combined in one vertical piece from rounded shaded elbow top down to wrist and fingers at the bottom; NO upper arm sleeve or shoulder.${hint}`
  if (slot.id.startsWith('hand-'))
    return `One complete human hand hanging naturally downward (wrist tab at top, five fingers at bottom); NO forearm, NO upside-down mittens or held prop.${hint}`
  if (slot.id.startsWith('thigh-') && ids.has(`shin-${side}`))
    return `Upper trouser leg (thigh) from hip to rounded knee cap ONLY; NO pelvis, lower leg, foot or opposite leg.${hint}`
  if (slot.id.startsWith('thigh-') && ids.has(`foot-${side}`))
    return `Whole leg from hip to ankle in one piece, including trousers; NO pelvis, foot or shoe.${hint}`
  if (slot.id.startsWith('thigh-'))
    return `Whole leg and shoe/boot combined in one piece from hip to sole; NO pelvis or opposite leg.${hint}`
  if (slot.id.startsWith('shin-') && ids.has(`foot-${side}`))
    return `Knee to ankle ONLY; NO thigh, foot, shoe or sole.${hint}`
  if (slot.id.startsWith('shin-'))
    return `Lower trouser leg and shoe/sneaker combined in one vertical piece from knee to sole; NO upper thigh or pelvis.${hint}`
  if (slot.id.startsWith('foot-'))
    return `One complete foot inside its shoe/boot, including heel and toe, with a short hidden ankle tab; NO shin.${hint}`
  if (slot.id === 'torso') {
    if (!ids.has('pelvis')) {
      return `Sleeveless shirt/vest/jacket torso from neck to lower hem in one piece — includes the shaded neck sticking up from the collar at the top, chest garment/tie/strap, and waist belt at the bottom; stop cleanly at sleeveless armholes with NO arms or legs attached.${hint}`
    }
    return `Sleeveless chest and abdomen to waist, with collar; stop at armholes, NO sleeve stubs or shoulder caps; NO head, arms, hands, pelvis or legs.${hint}`
  }
  if (slot.id === 'pelvis')
    return `Waist/hip block with belt and lower tunic/jacket hem ONLY, shaped to seamlessly overlap the waist and upper thighs; NO torso, thighs, lower legs or feet.${hint}`
  if (slot.id === 'head') {
    const hasSeparateFaces =
      ids.has('face-normal') || ids.has('face-happy') || ids.has('face-angry') || ids.has('face-shock')
    const hasSeparateHair = ids.has('hair-front') || ids.has('hair-back')
    if (hasSeparateFaces && !hasSeparateHair) {
      return `COMBINED FACELESS ANIME HEAD & HAIR BASE ONLY — complete anime head with full hairstyle (bangs, crown, side-locks) and ears attached to a 100% BLANK SMOOTH SKIN FACE (ZERO eyes, ZERO eyebrows, ZERO nose, ZERO mouth on the face) so separate facial expression overlays and glasses can be placed on top.${hint}`
    }
    if (hasSeparateFaces) {
      return `FACELESS HUMAN HEAD & NECK BASE ONLY — smooth skin-toned human head silhouette with ears, jawline and neck connector, 100% BLANK SMOOTH SKIN on the face (NO eyes, NO eyebrows, NO nose, NO mouth, NO hair) so separate facial expression layers can be placed on top.${hint}`
    }
    return `Back of human head, ears and neck base ONLY (180° back view, no facial features); NO torso.${hint}`
  }
  if (slot.id === 'glasses')
    return `Isolated horizontal eyeglasses frame ONLY (clean rectangular/round frame and bridge on solid background); NO eyes, NO nose, NO skin fill or head outline attached.${hint}`
  if (slot.id === 'face-normal')
    return `Isolated floating facial features overlay #1 (Calm / Normal expression: eyebrows, anime eyes, small nose, gentle confident smile ONLY) drawn directly on the chroma-key background with NO skin fill, NO jawline, NO ears, and NO hair.${hint}`
  if (slot.id === 'face-happy')
    return `Isolated floating facial features overlay #2 (Happy / Smirk expression: expressive brows, joyful anime eyes, small nose, cheerful grin/smirk ONLY) drawn directly on the chroma-key background with NO skin fill, NO jawline, NO ears, and NO hair.${hint}`
  if (slot.id === 'face-angry')
    return `Isolated floating facial features overlay #3 (Angry / Fierce expression: furrowed brows, intense glare, shouting/clenched mouth ONLY) with NO skin fill, NO ears, and NO head outline.${hint}`
  if (slot.id === 'face-shock')
    return `Isolated floating facial features overlay #4 (Shocked / Panic expression: raised brows, wide-open eyes, O-mouth, sweat drop ONLY) with NO skin fill, NO ears, and NO head outline.${hint}`
  if (slot.id === 'hair-back')
    return `Complete back hair silhouette behind head and neck ONLY; NO face, ears, neck or torso.${hint}`
  if (slot.id === 'hair-front')
    return `Front hair bangs/fringe and temple side-locks ONLY, leaving an open empty arch below for the face; NO eyes, nose, mouth, ears or jawline.${hint}`
  if (slot.id === 'cape')
    return `Complete back cape/cloak silhouette from shoulders to hem ONLY (sits behind the torso); NO torso, arms or legs.${hint}`
  if (slot.id.startsWith('prop-'))
    return `Complete isolated handheld weapon or prop ONLY, reconstructed through the grip area; NO hand or fingers attached.${hint}`
  return `Only the named part and explicitly combined elements; NO neighboring body parts. Accessories contain NO face, skin or holding hand.${hint}`
}

function formatUserBriefBlock(brief?: CharacterPromptCustomBrief): string {
  const app = brief?.appearance?.trim()
  const cos = brief?.costume?.trim()
  const prp = brief?.props?.trim()
  if (!app && !cos && !prp) {
    return `\nUSER CHARACTER & COSTUME CUSTOMIZATION:
- When the user specifies custom appearance (tướng mạo), clothing/outfit (quần áo), or accessories/glasses (phụ kiện), apply that exact hairstyle, eye/brow style, garment design, fabric palette, and footwear consistently across EVERY assigned cell below so all parts assemble into ONE unified 2D anime cutout character.`
  }
  const lines = [
    '\nUSER CHARACTER & COSTUME SPECIFICATION (HIGHEST PRIORITY — OVERRIDE DEFAULT LOOK/OUTFIT):'
  ]
  if (app) lines.push(`- APPEARANCE, HAIR & EXPRESSIONS (Tướng mạo / Kiểu tóc / Biểu cảm): ${app}`)
  if (cos) lines.push(`- COSTUME & OUTFIT (Quần áo / Trang phục / Giày dép): ${cos}`)
  if (prp) lines.push(`- ACCESSORIES & PROPS (Mắt kính / Phụ kiện / Đạo cụ): ${prp}`)
  lines.push(
    '- CRITICAL: Apply the user specification above to ALL body parts, sleeves, torso, legs, shoes, hair, glasses, and facial expression overlays in the cell list below. Keep the face area on `head` 100% BLANK SMOOTH SKIN (without eyes/nose/mouth) and draw the facial features exclusively in the `face-*` cells!'
  )
  return lines.join('\n')
}

/** One prompt contract for the UI and MCP, derived from the actual import slots. */
export function characterPrompt(
  template: LayerAssemblyTemplate,
  customBrief?: CharacterPromptCustomBrief
): string {
  const ids = new Set(template.slots.map((slot) => slot.id))
  const baseIdentity =
    template.promptGuide.systemPrompt.match(/^(?:IDENTITY|CHARACTER):\s*(.+)$/m)?.[1] ||
    template.descriptionEn
  const customParts = [
    customBrief?.appearance?.trim(),
    customBrief?.costume?.trim(),
    customBrief?.props?.trim()
  ].filter(Boolean)
  const identity = customParts.length
    ? `${baseIdentity} — Custom Character Brief: ${customParts.join(' | ')}`
    : baseIdentity
  const key = template.promptGuide.systemPrompt.includes('#FF00FF') ? '#FF00FF' : '#00FF00'
  const viewSpec = detectViewSpec(template)
  const userBriefBlock = formatUserBriefBlock(customBrief)
  const layout = [...template.slots]
    .sort((a, b) => (a.atlasCell || 0) - (b.atlasCell || 0))
    .map(
      (slot) =>
        `${slot.atlasCell}. ${slot.nameEn} [${slot.id}] — ${partBoundary(slot, ids, customBrief)}`
    )
  return `Create ONE square (1:1 aspect ratio) CHARACTER CUTOUT SPRITE ATLAS: flat 2D anime/Gacha/Live2D modular character layers with bold clean black outlines and cel-shading, separated for skeletal 2.5D rigging. NOT a physical doll, toy or mannequin.
IDENTITY: ${identity}
If a reference is attached, preserve that character's proportions, hairstyle, costume, palette and line-art style. Otherwise use the identity above.${userBriefBlock}
VIEW: ${viewSpec}
OUTPUT: PNG at the native resolution supported by the image model; preserve the 1:1 aspect ratio. Flat OPAQUE chroma-key background ${key}. No checkerboard, gradients, texture, ground or cast shadows.
GRID: Exactly 5 rows x 5 columns, numbered 1–25 left-to-right, top-to-bottom for instructions ONLY. Do not draw numbers, labels, IDs, watermarks or grid lines.
Exactly ${template.slots.length} isolated parts, one assigned part per cell. NO assembled reference character anywhere in this atlas.
CELL ASSIGNMENTS:
${layout.join('\n')}
Leave all unassigned cells empty with only the background color.

MODULAR 13-PART ANIME CUTOUT SHEET ARCHITECTURE (CRITICAL):
- FACELESS HEAD + HAIR BASE (head): Draw the character's complete hairstyle (bangs, crown, side-locks) and ears attached to the head silhouette, but leave the face skin 100% BLANK SMOOTH WHITE/SKIN-TONED — zero eyes, zero eyebrows, zero nose, and zero mouth on the head!
- FLOATING FACIAL EXPRESSIONS (face-normal, face-happy): Draw each facial expression as floating eyebrows + anime eyes + small nose + mouth directly on the ${key} background with NO head outline, NO jawline, and NO skin fill so it overlays cleanly onto the blank head.
- ISOLATED EYEGLASSES (glasses): Draw the eyeglasses frame horizontally as a separate piece with generous ${key} spacing from the head and faces.
- SLEEVELESS TORSO WITH NECK & BELT (torso): Draw the shirt/vest/jacket torso with the shaded neck sticking up from the collar at the top and the waist belt/hem at the bottom, with clean sleeveless armholes (no arms attached).
- 2-SEGMENT ARMS & LEGS: Draw upper arm sleeves (arm-l, arm-r) separate from forearms+hands (forearm-l, forearm-r), and draw upper trouser thighs (thigh-l, thigh-r) with rounded knee caps separate from lower shins+shoes (shin-l, shin-r).

SEAMLESS WHOLE-CHARACTER COHESION & JOINT OVERLAPS:
- Mentally design ONE single cohesive full-body 2D anime character illustration first, then place each anatomical segment into its assigned cell at the exact same pixel scale so that when reassembled coaxially, all parts lock together like ONE continuous hand-drawn illustration.
- Left/right ALWAYS mean assembled screen positions, not anatomical sides. Forearms+hands and shins+shoes must hang vertically straight downward.
- Use ONE shared pixel scale across all parts, with at least 8% clear green background padding around every piece so adjacent bounding boxes never touch or overlap.
- At each separated joint (shoulders, elbows, hips, knees) extend a rounded hidden overlap cap by 10–15% with matching shading so rotating limbs in 2.5D never expose gaps.

CLEAN EXTRACTION:
- Each cell contains one complete isolated silhouette, with no neighboring fragments, detached specks, text watermarks or duplicate views.
- Crisp antialiased edges; no blur, glow, fringe, colored halo, matte border or contact shadow. The background must remain perfectly uniform ${key}.
- Do not use the chroma-key color in skin, costume, outlines, highlights or reflections.`
}

/** Build a customized prompt for ANY template (character, animal, nature, architecture). */
export function buildTemplatePromptWithBrief(
  template: LayerAssemblyTemplate,
  customBrief?: CharacterPromptCustomBrief
): string {
  const hasCustom = Boolean(
    customBrief?.appearance?.trim() || customBrief?.costume?.trim() || customBrief?.props?.trim()
  )
  if (template.category === 'character') {
    return hasCustom ? characterPrompt(template, customBrief) : template.promptGuide.systemPrompt
  }
  if (!hasCustom) {
    return template.promptGuide.systemPrompt
  }
  const block = formatUserBriefBlock(customBrief)
  return `${template.promptGuide.systemPrompt}\n${block}`
}

export const CHARACTER_PROMPT_GUIDE =
  'Sprite Sheet nền xanh lá (#00FF00) chuẩn Nhân Vật Anime 2.5D 13 mảnh (theo đúng mẫu minh hoạ): Đầu kèm mái tóc để mặt trơn không ngũ quan (head), Gọng mắt kính rời (glasses), 2 Biểu cảm mặt rời (face-normal, face-happy), Thân áo kèm cổ & thắt lưng (torso), 2 Bắp tay áo (arm-l/r), 2 Cẳng tay kèm bàn tay (forearm-l/r), 2 Đùi quần (thigh-l/r) và 2 Ống quần kèm giày (shin-l/r).'
