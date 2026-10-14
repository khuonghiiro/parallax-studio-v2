import type { LayerAssemblyTemplate, LayerTemplateSlot } from './layerTemplateTypes'

function partBoundary(slot: LayerTemplateSlot, ids: Set<string>): string {
  const side = slot.id.endsWith('-l') ? 'l' : 'r'
  if (slot.id.startsWith('arm-') && ids.has(`forearm-${side}`))
    return 'Shoulder to elbow ONLY, including its sleeve; NO forearm, hand, chest or opposite arm.'
  if (slot.id.startsWith('arm-'))
    return 'Whole arm from shoulder to hand in one piece, including sleeve and fingers; NO torso or opposite arm.'
  if (slot.id.startsWith('forearm-') && ids.has(`hand-${side}`))
    return 'Elbow to wrist ONLY; NO upper arm, hand, fingers or held prop.'
  if (slot.id.startsWith('forearm-'))
    return 'Forearm and hand combined in one piece from elbow to fingertips (plus assigned held bag/prop if named); NO upper arm or shoulder.'
  if (slot.id.startsWith('hand-'))
    return 'One complete hand/glove with five fingers and a short hidden wrist tab; NO forearm or held prop.'
  if (slot.id.startsWith('thigh-') && ids.has(`shin-${side}`))
    return 'Hip to knee ONLY, including its clothing; NO pelvis, lower leg, foot or opposite leg.'
  if (slot.id.startsWith('thigh-') && ids.has(`foot-${side}`))
    return 'Whole leg from hip to ankle in one piece, including trousers; NO pelvis, foot or shoe.'
  if (slot.id.startsWith('thigh-'))
    return 'Whole leg and shoe/sneaker combined in one piece from hip to sole; NO pelvis or opposite leg.'
  if (slot.id.startsWith('shin-') && ids.has(`foot-${side}`))
    return 'Knee to ankle ONLY; NO thigh, foot, shoe or sole.'
  if (slot.id.startsWith('shin-'))
    return 'Lower leg and shoe/loafer combined in one piece from knee to sole; NO thigh or pelvis.'
  if (slot.id.startsWith('foot-'))
    return 'One complete foot inside its shoe/boot, including heel and toe, with a short hidden ankle tab; NO shin.'
  if (slot.id === 'torso')
    return 'Sleeveless chest and abdomen to waist, with a short neck connector; stop at armholes, NO sleeve stubs or shoulder caps; NO head, arms, hands, pelvis or legs. Sleeves belong to upper arms.'
  if (slot.id === 'pelvis')
    return 'Waist/hip block and assigned belt/skirt ONLY; NO torso, thighs, lower legs or feet. Reconstruct hips hidden by clothing.'
  if (slot.id === 'head') {
    const detached = ['hair-front', 'hair-back', 'hat', 'beard', 'glasses', 'mask'].filter((id) => ids.has(id))
    return `Complete head, ears and face; NO torso.${detached.length ? ` Do NOT bake these separate layers into the head: ${detached.join(', ')}.` : ' Keep hair and assigned headwear with the head.'}`
  }
  if (slot.id === 'hair-back')
    return 'Complete back hair silhouette behind head and shoulders ONLY; NO face, ears, neck or torso.'
  if (slot.id === 'hair-front')
    return 'Front bangs/fringe and side hair locks ONLY, leaving open space for the face; NO eyes, nose, mouth or head base.'
  if (slot.id === 'hat')
    return 'Isolated headwear/helmet ONLY, sized to fit the head crown; NO hair, face or head.'
  if (slot.id === 'beard')
    return 'Isolated detachable beard/mustache prop ONLY, sized to fit chin and upper lip; NO skin, mouth, nose or jaw.'
  if (slot.id === 'glasses')
    return 'Isolated eyewear/spectacles frame and lenses ONLY; NO eyes, eyebrows, nose or face.'
  if (slot.id === 'mask')
    return 'Isolated face mask/scarf/visor prop ONLY; NO face, skin, nose or neck.'
  if (slot.id === 'cape')
    return 'Complete back cape/cloak silhouette from shoulders to hem ONLY; NO torso, armor, arms or legs.'
  if (slot.id.startsWith('prop-'))
    return 'Complete isolated handheld prop/weapon ONLY, reconstructed through the grip area; NO hand or fingers attached.'
  return 'Only the named part and explicitly combined elements; NO neighboring body parts. Accessories contain NO face, skin or holding hand.'
}

/** One prompt contract for the UI and MCP, derived from the actual import slots. */
export function characterPrompt(template: LayerAssemblyTemplate): string {
  const ids = new Set(template.slots.map((slot) => slot.id))
  const identity = template.promptGuide.systemPrompt.match(/^(?:IDENTITY|CHARACTER):\s*(.+)$/m)?.[1]
    || template.descriptionEn
  const key = template.promptGuide.systemPrompt.includes('#FF00FF') ? '#FF00FF' : '#00FF00'
  const layout = [...template.slots].sort((a, b) => a.atlasCell! - b.atlasCell!)
    .map((slot) => `${slot.atlasCell}. ${slot.nameEn} [${slot.id}] — ${partBoundary(slot, ids)}`)
  return `Create ONE square (1:1 aspect ratio) CHARACTER CUTOUT SPRITE ATLAS: flat 2D animation character layers, separated like a paper puppet. NOT a physical doll, toy or mannequin.
IDENTITY: ${identity}
If a reference is attached, preserve that character's identity, costume, palette and proportions. Otherwise use the identity above.
VIEW: FRONT ORTHOGRAPHIC, vertically upright arm and leg segments, proximal joints centered at top and distal joints centered at bottom; no diagonal or bent limbs; no perspective or foreshortening.
OUTPUT: PNG at the native resolution supported by the image model; preserve the 1:1 aspect ratio. Flat OPAQUE chroma-key background ${key}. No checkerboard, gradients, texture, ground or cast shadows.
GRID: Exactly 5 rows x 5 columns, numbered 1–25 left-to-right, top-to-bottom for instructions ONLY. Do not draw numbers, labels, IDs or grid lines.
Exactly ${template.slots.length} isolated parts, one assigned part per cell. NO assembled reference character anywhere in this atlas.
CELL ASSIGNMENTS:
${layout.join('\n')}
Leave all unassigned cells empty with only the background color.

PUPPET CONSTRUCTION:
- Left/right ALWAYS mean assembled screen positions, not anatomical sides. Keep the same front-facing orientation in every cell.
- Use ONE shared pixel scale. Choose it so the largest part, including hidden tabs, fits with at least 8% of cell width/height as clear padding on every side. Never enlarge small hands or feet to fill a cell.
- Separate at the actual shoulder, elbow, wrist, hip, knee and ankle ONLY where the slot list provides separate segments. A combined legacy slot stays one piece; never invent extra parts.
- Reconstruct the COMPLETE silhouette, including surfaces hidden by hair, sleeves, skirt or overlapping parts. Never copy an occluded fragment from the reference.
- At each separated joint extend a rounded hidden overlap by 10–15% of the shorter adjoining segment's length, centered on the rotation pivot. Extend the SAME material through each flat rounded overlap: dark trouser fabric at knees/ankles, shirt fabric at shoulders/waist. NO skin-colored cylindrical pegs on clothed parts; skin only where anatomically exposed. Paint matching skin/fabric through the overlap; no socket holes, exposed ball joints, metal pins or joint markers.
- Keep visible outer contours clean. Do not draw a dark transverse cut line across a concealed joint cap. Connectors overlap only AFTER assembly, never between atlas cells.
- Clothing follows its own body segment. No duplicated cuffs, hands, shoes or accessories. Hands do not include props; a separate prop must be complete behind the grip.

CLEAN EXTRACTION:
- Each cell contains one complete isolated silhouette (natural holes allowed), with no neighboring fragments, detached specks, guide marks or duplicate views.
- Crisp antialiased edges; no blur, glow, fringe, colored halo, matte border or contact shadow. The background must remain perfectly uniform, including holes between fingers and inside accessories.
- Do not use the chroma-key color in skin, costume, outlines, highlights or reflections. Preserve fine fingers and hair without fuzzy stray pixels.
- Before output, verify every assigned cell against this list: correct part, complete hidden ends, consistent scale, clean separation and clear padding. Redraw merged or contaminated parts.`
}

export const CHARACTER_PROMPT_GUIDE = 'Atlas tỉ lệ 1:1, độ phân giải theo model AI, lưới 5×5; mỗi ô đúng bộ phận ghi trong danh sách, không kèm hình nhân vật hoàn chỉnh. Tay/chân chỉ tách tại các khớp có slot riêng; muốn gập đủ khuỷu tay, cổ tay, gối và cổ chân hãy chọn mẫu Búp bê 15 lớp. Vẽ bù phần bị che, chừa đệm khớp 10–15% và lề sạch ít nhất 8% mỗi ô. Sau khi tách nền, kiểm tra viền trên nền sáng/tối và xoay thử khớp; prompt không bảo đảm ảnh AI luôn tách sạch. Tài liệu: docs/design/character-cutout-prompt.md.'
