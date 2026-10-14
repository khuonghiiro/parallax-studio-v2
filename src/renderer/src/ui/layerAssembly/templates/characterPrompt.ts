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
  if (template.id.includes('quarter') || /45°|chéo|three-quarter/i.test(template.name)) {
    return 'THREE-QUARTER VIEW (45° angled perspective facing screen-right), vertically upright arm and leg segments, proximal joints centered at top and distal joints centered at bottom; far-side limbs shaded slightly deeper for 2.5D depth.'
  }
  if (template.id.includes('back') || /180°|sau lưng|back view/i.test(template.name)) {
    return 'BACK ORTHOGRAPHIC VIEW (180° seen directly from behind), vertically upright arm and leg segments, proximal joints centered at top and distal joints centered at bottom; show the back of the head, hair crown, back collar, back waist belt, dorsal hands, and boot heels.'
  }
  return 'FRONT ORTHOGRAPHIC VIEW (0° chính diện), vertically upright arm and leg segments, proximal joints centered at top and distal joints centered at bottom; no diagonal or bent limbs; no perspective or foreshortening.'
}

function partBoundary(
  slot: LayerTemplateSlot,
  ids: Set<string>,
  brief?: CharacterPromptCustomBrief
): string {
  const side = slot.id.endsWith('-l') ? 'l' : 'r'
  const hint = slotBriefHint(slot, brief)
  if (slot.id.startsWith('arm-') && ids.has(`forearm-${side}`))
    return `Shoulder to elbow ONLY, including its sleeve; NO forearm, hand, chest or opposite arm.${hint}`
  if (slot.id.startsWith('arm-'))
    return `Whole arm from shoulder to hand in one piece, including sleeve and fingers; NO torso or opposite arm.${hint}`
  if (slot.id.startsWith('forearm-') && ids.has(`hand-${side}`))
    return `Elbow to wrist ONLY; NO upper arm, hand, fingers or held prop.${hint}`
  if (slot.id.startsWith('forearm-'))
    return `Forearm and hand combined in one piece from elbow to fingertips; NO upper arm or shoulder.${hint}`
  if (slot.id.startsWith('hand-'))
    return `One complete human hand hanging naturally downward (wrist tab at top, five fingers at bottom); NO forearm, NO upside-down mittens or held prop.${hint}`
  if (slot.id.startsWith('thigh-') && ids.has(`shin-${side}`))
    return `Hip to knee ONLY, including its trouser/skirt leg; NO pelvis, lower leg, foot or opposite leg.${hint}`
  if (slot.id.startsWith('thigh-') && ids.has(`foot-${side}`))
    return `Whole leg from hip to ankle in one piece, including trousers; NO pelvis, foot or shoe.${hint}`
  if (slot.id.startsWith('thigh-'))
    return `Whole leg and shoe/boot combined in one piece from hip to sole; NO pelvis or opposite leg.${hint}`
  if (slot.id.startsWith('shin-') && ids.has(`foot-${side}`))
    return `Knee to ankle ONLY; NO thigh, foot, shoe or sole.${hint}`
  if (slot.id.startsWith('shin-'))
    return `Lower leg and shoe/boot combined in one piece from knee to sole; NO thigh or pelvis.${hint}`
  if (slot.id.startsWith('foot-'))
    return `One complete foot inside its shoe/boot, including heel and toe, with a short hidden ankle tab; NO shin.${hint}`
  if (slot.id === 'torso')
    return `Sleeveless chest and abdomen to waist, with collar; stop at armholes, NO sleeve stubs or shoulder caps; NO head, arms, hands, pelvis or legs. Sleeves belong to upper arms.${hint}`
  if (slot.id === 'pelvis')
    return `Waist/hip block with belt and lower tunic/jacket hem ONLY, shaped to seamlessly overlap the waist and upper thighs; NO torso, thighs, lower legs or feet.${hint}`
  if (slot.id === 'head') {
    const hasSeparateFaces =
      ids.has('face-normal') || ids.has('face-happy') || ids.has('face-angry') || ids.has('face-shock')
    if (hasSeparateFaces) {
      return `FACELESS HUMAN HEAD & NECK BASE ONLY — smooth skin-toned human head silhouette with ears, jawline and neck connector, 100% BLANK SMOOTH SKIN on the face (NO eyes, NO eyebrows, NO nose, NO mouth, NO hair) so separate facial expression layers can be placed on top.${hint}`
    }
    return `Back of human head, ears and neck base ONLY (180° back view, no facial features); NO torso.${hint}`
  }
  if (slot.id === 'face-normal')
    return `Isolated facial features overlay (Calm / Normal expression: eyebrows, eyes, nose, gentle confident smile) with no hair, no ears, and no outer head outline, sized to sit on the faceless head.${hint}`
  if (slot.id === 'face-happy')
    return `Isolated facial features overlay (Happy / Cheerful laughing expression: arched brows, joyful eyes, open smile) with no hair, no ears, and no outer head outline.${hint}`
  if (slot.id === 'face-angry')
    return `Isolated facial features overlay (Angry / Fierce combat expression: furrowed brows, intense glare, shouting/clenched mouth) with no hair, no ears, and no outer head outline.${hint}`
  if (slot.id === 'face-shock')
    return `Isolated facial features overlay (Shocked / Panic expression: raised brows, wide-open eyes, O-mouth, sweat drop) with no hair, no ears, and no outer head outline.${hint}`
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
- When the user specifies custom appearance (tướng mạo) or clothing/outfit (quần áo), apply that exact hairstyle, eye/brow style, garment design, fabric palette, and footwear consistently across EVERY assigned cell below so all parts assemble into ONE unified human character.`
  }
  const lines = [
    '\nUSER CHARACTER & COSTUME SPECIFICATION (HIGHEST PRIORITY — OVERRIDE DEFAULT LOOK/OUTFIT):'
  ]
  if (app) lines.push(`- APPEARANCE, HAIR & EXPRESSIONS (Tướng mạo / Kiểu tóc / Biểu cảm): ${app}`)
  if (cos) lines.push(`- COSTUME & OUTFIT (Quần áo / Trang phục / Giày dép): ${cos}`)
  if (prp) lines.push(`- ACCESSORIES & WEAPON PROPS (Áo choàng / Vũ khí / Đạo cụ): ${prp}`)
  lines.push(
    '- CRITICAL: Apply the user specification above to ALL body parts, sleeves, torso, waist/pelvis, legs, boots, hair, facial expression overlays, and props in the cell list below. Keep the base head (`head`) faceless (smooth blank skin without eyes/nose/mouth) and draw the facial features exclusively in the `face-*` cells!'
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
  return `Create ONE square (1:1 aspect ratio) CHARACTER CUTOUT SPRITE ATLAS: flat 2D animation human character layers, separated like a professional Live2D / Spine / Moho puppet rig. NOT a physical doll, toy or mannequin.
IDENTITY: ${identity}
If a reference is attached, preserve that character's human proportions, hairstyle, costume, palette and line-art style. Otherwise use the identity above.${userBriefBlock}
VIEW: ${viewSpec}
OUTPUT: PNG at the native resolution supported by the image model; preserve the 1:1 aspect ratio. Flat OPAQUE chroma-key background ${key}. No checkerboard, gradients, texture, ground or cast shadows.
GRID: Exactly 5 rows x 5 columns, numbered 1–25 left-to-right, top-to-bottom for instructions ONLY. Do not draw numbers, labels, IDs or grid lines.
Exactly ${template.slots.length} isolated parts, one assigned part per cell. NO assembled reference character anywhere in this atlas.
CELL ASSIGNMENTS:
${layout.join('\n')}
Leave all unassigned cells empty with only the background color.

FACELESS HEAD + SWAPPABLE FACIAL EXPRESSION OVERLAYS (CRITICAL):
- Whenever separate facial expression slots (face-normal, face-happy, face-angry, face-shock) are present, the base head cell (head) MUST be 100% FACELESS: draw smooth human skin, ears, jawline and neck ONLY — zero eyes, zero eyebrows, zero nose, zero mouth, and zero hair on the base head!
- Draw each facial expression slot (face-normal, face-happy, face-angry, face-shock) as an isolated set of facial features (eyebrows, eyes, nose, mouth) at the exact scale and perspective of the base head so the animator can swap expressions on top of the faceless head at any time.

SEAMLESS WHOLE-CHARACTER COHESION & PUPPET CONSTRUCTION:
- Mentally design ONE single complete, cohesive full-body human character illustration first, then place each anatomical segment into its assigned cell at the exact same pixel scale so that when reassembled, the character looks like ONE continuous hand-drawn illustration — NEVER like boxy tubes or mismatched pieces.
- Left/right ALWAYS mean assembled screen positions, not anatomical sides. Hands must hang naturally downward with wrist at top and fingers at bottom.
- Use ONE shared pixel scale. Choose it so the largest part, including hidden tabs, fits with at least 8% of cell width/height as clear padding on every side. Never enlarge small hands, faces or feet to fill a cell.
- Separate at the actual shoulder, elbow, wrist, hip, knee and ankle ONLY where the slot list provides separate segments.
- Reconstruct the COMPLETE silhouette, including surfaces hidden by hair, sleeves, lower tunic hem or overlapping parts. The waist belt / lower tunic skirt (pelvis) must flare naturally to cover the hip joints cleanly.
- At each separated joint extend a rounded hidden overlap by 10–15% of the shorter adjoining segment's length, centered on the rotation pivot. Extend the SAME material through each flat rounded overlap: trouser fabric at knees/ankles, jacket/tunic fabric at shoulders/waist. Paint matching skin/fabric through the overlap; no socket holes, exposed ball joints, metal pins or joint markers.
- Keep visible outer contours clean. Do not draw a dark transverse cut line across a concealed joint cap. Connectors overlap only AFTER assembly, never between atlas cells.

CLEAN EXTRACTION:
- Each cell contains one complete isolated silhouette, with no neighboring fragments, detached specks, guide marks or duplicate views.
- Crisp antialiased edges; no blur, glow, fringe, colored halo, matte border or contact shadow. The background must remain perfectly uniform, including holes between fingers and inside hair locks.
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
  'Atlas tỉ lệ 1:1 chuẩn Nhân Vật Đầu Người 3 Hướng (Chính diện 0°, Góc chéo 45°, Sau lưng 180°), lưới 5×5; phần Đầu gốc (head) được vẽ TRƠN KHÔNG NGŨ QUAN (không mắt mũi miệng) để ghép chồng các layer Biểu cảm khuôn mặt rời (Bình thường, Vui vẻ, Tức giận, Hoảng hốt) lên trên. Hỗ trợ nhập mô tả Tướng mạo & Quần áo tùy chỉnh để AI đồng bộ xuyên suốt mọi bộ phận.'
