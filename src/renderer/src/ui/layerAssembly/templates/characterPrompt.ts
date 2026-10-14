import type { LayerAssemblyTemplate, LayerTemplateSlot } from './layerTemplateTypes'

export interface CharacterPromptCustomBrief {
  /** Mô tả tướng mạo, khuôn mặt, kiểu tóc, biểu cảm hoặc chủng loài */
  appearance?: string
  /** Mô tả quần áo, trang phục, áo giáp, màu sắc vải, giày dép */
  costume?: string
  /** Mô tả phụ kiện hoá trang (mũ, kính, râu, mặt nạ) hoặc vũ khí/đạo cụ cầm tay */
  props?: string
}

function slotBriefHint(slot: LayerTemplateSlot, brief?: CharacterPromptCustomBrief): string {
  if (!brief) return ''
  const app = brief.appearance?.trim()
  const cos = brief.costume?.trim()
  const prp = brief.props?.trim()
  if ((slot.id === 'head' || slot.id.startsWith('hair-') || slot.id === 'face-meme') && app) {
    return ` Match user appearance/face/hair: "${app}".`
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
      slot.id.startsWith('prop-')) &&
    prp
  ) {
    return ` Match user's described accessory/prop: "${prp}".`
  }
  return ''
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
    return `Forearm and hand combined in one piece from elbow to fingertips (plus assigned held bag/prop if named); NO upper arm or shoulder.${hint}`
  if (slot.id.startsWith('hand-'))
    return `One complete hand/glove hanging naturally downward (wrist tab at top, five fingers at bottom); NO forearm, NO upside-down mittens or held prop.${hint}`
  if (slot.id.startsWith('thigh-') && ids.has(`shin-${side}`))
    return `Hip to knee ONLY, including its clothing; NO pelvis, lower leg, foot or opposite leg.${hint}`
  if (slot.id.startsWith('thigh-') && ids.has(`foot-${side}`))
    return `Whole leg from hip to ankle in one piece, including trousers; NO pelvis, foot or shoe.${hint}`
  if (slot.id.startsWith('thigh-'))
    return `Whole leg and shoe/sneaker combined in one piece from hip to sole; NO pelvis or opposite leg.${hint}`
  if (slot.id.startsWith('shin-') && ids.has(`foot-${side}`))
    return `Knee to ankle ONLY; NO thigh, foot, shoe or sole.${hint}`
  if (slot.id.startsWith('shin-'))
    return `Lower leg and shoe/loafer combined in one piece from knee to sole; NO thigh or pelvis.${hint}`
  if (slot.id.startsWith('foot-'))
    return `One complete foot inside its shoe/boot, including heel and toe, with a short hidden ankle tab; NO shin.${hint}`
  if (slot.id === 'torso')
    return `Sleeveless chest and abdomen to waist, with a short neck connector; stop at armholes, NO sleeve stubs or shoulder caps; NO head, arms, hands, pelvis or legs. Sleeves belong to upper arms.${hint}`
  if (slot.id === 'pelvis')
    return `Waist/hip block and assigned belt/skirt/lower-robe hem ONLY, shaped to seamlessly overlap the waist and upper thighs; NO torso, thighs, lower legs or feet.${hint}`
  if (slot.id === 'head') {
    const detached = ['hair-front', 'hair-back', 'hat', 'beard', 'glasses', 'mask'].filter((id) => ids.has(id))
    return `Complete head, ears and face; NO torso.${detached.length ? ` Do NOT bake these separate layers into the head: ${detached.join(', ')}.` : ' Keep hair and assigned headwear with the head.'}${hint}`
  }
  if (slot.id === 'hair-back')
    return `Complete back hair silhouette behind head and shoulders ONLY; NO face, ears, neck or torso.${hint}`
  if (slot.id === 'hair-front')
    return `Front bangs/fringe and side hair locks ONLY, leaving open space for the face; NO eyes, nose, mouth or head base.${hint}`
  if (slot.id === 'hat')
    return `Isolated headwear/helmet/crown ONLY, sized to fit the head crown with NO dummy head placeholder underneath; NO hair, face or head.${hint}`
  if (slot.id === 'beard')
    return `Isolated detachable beard/mustache prop ONLY, sized to fit chin and upper lip; NO skin, mouth, nose or jaw.${hint}`
  if (slot.id === 'glasses')
    return `Isolated eyewear/spectacles frame and lenses ONLY; NO eyes, eyebrows, nose or face.${hint}`
  if (slot.id === 'mask')
    return `Isolated face mask/scarf/visor or alternate meme expression overlay prop ONLY; NO torso, neck or hair.${hint}`
  if (slot.id === 'face-meme')
    return `Isolated alternate meme facial expression / emotion head swap ONLY; NO torso, neck, hat or glasses.${hint}`
  if (slot.id === 'cape')
    return `Complete back cape/cloak silhouette from shoulders to hem ONLY (sits behind the torso, NOT a neck bib); NO torso, armor, arms or legs.${hint}`
  if (slot.id.startsWith('prop-'))
    return `Complete isolated handheld slapstick/movie prop or weapon ONLY, reconstructed through the grip area; NO hand or fingers attached.${hint}`
  return `Only the named part and explicitly combined elements; NO neighboring body parts. Accessories contain NO face, skin or holding hand.${hint}`
}

function formatUserBriefBlock(brief?: CharacterPromptCustomBrief): string {
  const app = brief?.appearance?.trim()
  const cos = brief?.costume?.trim()
  const prp = brief?.props?.trim()
  if (!app && !cos && !prp) {
    return `\nUSER CHARACTER & COSTUME CUSTOMIZATION:
- When the user specifies custom appearance (tướng mạo) or clothing/outfit (quần áo), apply that exact facial look, hairstyle, garment style, fabric palette, and footwear consistently across EVERY assigned cell below so all parts assemble into ONE unified character.`
  }
  const lines = ['\nUSER CHARACTER & COSTUME SPECIFICATION (HIGHEST PRIORITY — OVERRIDE DEFAULT LOOK/OUTFIT):']
  if (app) lines.push(`- APPEARANCE & FACE (Tướng mạo / Khuôn mặt / Kiểu tóc): ${app}`)
  if (cos) lines.push(`- COSTUME & OUTFIT (Quần áo / Trang phục / Giày dép): ${cos}`)
  if (prp) lines.push(`- ACCESSORIES & PROPS (Phụ kiện / Hoá trang / Vũ khí): ${prp}`)
  lines.push(
    '- CRITICAL: Apply the user specification above to ALL body parts, sleeves, torso, waist/pelvis, legs, shoes, head, and props in the cell list below. Override any default garment names or colors in the cell titles so every piece belongs to this exact character!'
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
  const isShadiao =
    template.id.includes('shadiao') ||
    /shadiao|panda|mushroom|điêu khắc cát|cát gấu|bựa/i.test(`${template.name} ${identity}`)
  const styleBlock = isShadiao
    ? `\nSHADIAO MEME CUTOUT STYLE (沙雕动画 / 熊猫人 / 蘑菇头):
- Authentic Chinese 2D Flash vector "Sand Sculpture Animation" (Hoạt hình Điêu Khắc Cát / Cát Gấu) & Baozou Manhua meme aesthetic: bold crisp black comic ink outlines, flat high-contrast cel-shaded fills, humorous 2.5-to-3-head proportions.
- Draw an authentic Baozou Manhua comic human expression inside the pure-white (#FFFFFF) meme head (NO animal snout/nose triangle), with detachable meme expression swaps, Thug-Life sunglasses, hats, and slapstick props strictly isolated in their assigned cells.`
    : ''
  const userBriefBlock = formatUserBriefBlock(customBrief)
  const layout = [...template.slots]
    .sort((a, b) => a.atlasCell! - b.atlasCell!)
    .map((slot) => `${slot.atlasCell}. ${slot.nameEn} [${slot.id}] — ${partBoundary(slot, ids, customBrief)}`)
  return `Create ONE square (1:1 aspect ratio) CHARACTER CUTOUT SPRITE ATLAS: flat 2D animation character layers, separated like a paper puppet. NOT a physical doll, toy or mannequin.
IDENTITY: ${identity}
If a reference is attached, preserve that character's identity, costume, palette and proportions. Otherwise use the identity above.${styleBlock}${userBriefBlock}
VIEW: FRONT ORTHOGRAPHIC, vertically upright arm and leg segments, proximal joints centered at top and distal joints centered at bottom; no diagonal or bent limbs; no perspective or foreshortening.
OUTPUT: PNG at the native resolution supported by the image model; preserve the 1:1 aspect ratio. Flat OPAQUE chroma-key background ${key}. No checkerboard, gradients, texture, ground or cast shadows.
GRID: Exactly 5 rows x 5 columns, numbered 1–25 left-to-right, top-to-bottom for instructions ONLY. Do not draw numbers, labels, IDs or grid lines.
Exactly ${template.slots.length} isolated parts, one assigned part per cell. NO assembled reference character anywhere in this atlas.
CELL ASSIGNMENTS:
${layout.join('\n')}
Leave all unassigned cells empty with only the background color.

SEAMLESS WHOLE-CHARACTER COHESION & PUPPET CONSTRUCTION:
- Mentally design ONE single complete, cohesive full-body character illustration first, then place each anatomical segment into its assigned cell at the exact same pixel scale so that when reassembled, the character looks like ONE continuous hand-drawn illustration — NEVER like boxy tubes or mismatched pieces.
- Left/right ALWAYS mean assembled screen positions, not anatomical sides. Keep the same front-facing orientation in every cell; hands must hang naturally downward with wrist at top and fingers at bottom.
- Use ONE shared pixel scale. Choose it so the largest part, including hidden tabs, fits with at least 8% of cell width/height as clear padding on every side. Never enlarge small hands or feet to fill a cell.
- Separate at the actual shoulder, elbow, wrist, hip, knee and ankle ONLY where the slot list provides separate segments. A combined legacy slot stays one piece; never invent extra parts.
- Reconstruct the COMPLETE silhouette, including surfaces hidden by hair, sleeves, skirt or overlapping parts. The waist sash / lower robe skirt (pelvis) must flare naturally to cover the hip joints cleanly.
- At each separated joint extend a rounded hidden overlap by 10–15% of the shorter adjoining segment's length, centered on the rotation pivot. Extend the SAME material through each flat rounded overlap: dark trouser fabric at knees/ankles, shirt/robe fabric at shoulders/waist. NO skin-colored cylindrical pegs on clothed parts; skin only where anatomically exposed. Paint matching skin/fabric through the overlap; no socket holes, exposed ball joints, metal pins or joint markers.
- Keep visible outer contours clean. Do not draw a dark transverse cut line across a concealed joint cap. Connectors overlap only AFTER assembly, never between atlas cells.
- Clothing follows its own body segment. No duplicated cuffs, hands, shoes or accessories. Shins must NOT have shoes attached when separate foot/boot slots exist.

CLEAN EXTRACTION:
- Each cell contains one complete isolated silhouette (natural holes allowed), with no neighboring fragments, detached specks, guide marks or duplicate views.
- Crisp antialiased edges; no blur, glow, fringe, colored halo, matte border or contact shadow. The background must remain perfectly uniform, including holes between fingers and inside accessories.
- Do not use the chroma-key color in skin, costume, outlines, highlights or reflections. Preserve fine fingers and hair without fuzzy stray pixels.
- Before output, verify every assigned cell against this list: correct part, complete hidden ends, consistent scale, clean separation and clear padding. Redraw merged or contaminated parts.`
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
  'Atlas tỉ lệ 1:1, độ phân giải theo model AI, lưới 5×5; mỗi ô đúng bộ phận ghi trong danh sách, không kèm hình nhân vật hoàn chỉnh. Hỗ trợ nhập trực tiếp mô tả Tướng mạo & Quần áo tùy chỉnh để gắn tự động vào từng ô bộ phận (chuẩn Hoạt hình Điêu Khắc Cát / Cát Gấu 沙雕动画 lẫn hoạt hình 2D/Chibi). Tay/chân chỉ tách tại các khớp có slot riêng; vẽ bù đầu khớp bán nguyệt 10–15% và chừa lề sạch ít nhất 8% mỗi ô để xoay khớp 360° liền mạch như một bức vẽ hoàn chỉnh. Tài liệu: docs/design/character-cutout-prompt.md.'
