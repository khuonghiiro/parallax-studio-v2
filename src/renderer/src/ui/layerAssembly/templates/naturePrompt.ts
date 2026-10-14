import type { LayerAssemblyTemplate, LayerTemplateSlot } from './layerTemplateTypes'
import type { CharacterPromptCustomBrief } from './characterPrompt'

function natureSlotBriefHint(slot: LayerTemplateSlot, brief?: CharacterPromptCustomBrief): string {
  if (!brief) return ''
  const app = brief.appearance?.trim()
  const cos = brief.costume?.trim()
  const prp = brief.props?.trim()
  if (
    (slot.id.includes('root') ||
      slot.id.includes('trunk') ||
      slot.id.includes('ground') ||
      slot.id.includes('main') ||
      slot.id.includes('pot')) &&
    app
  ) {
    return ` Match user's described trunk/rock/ground base style: "${app}".`
  }
  if ((slot.id.includes('foliage') || slot.id.includes('cap') || slot.id.includes('snow')) && cos) {
    return ` Match user's described canopy foliage / moss / seasonal style: "${cos}".`
  }
  if (
    (slot.id.includes('fruit') ||
      slot.id.includes('blossom') ||
      slot.id.includes('flower') ||
      slot.id.includes('crystal') ||
      slot.id.includes('pebble')) &&
    prp
  ) {
    return ` Match user's described fruits/blossoms/crystals/details: "${prp}".`
  }
  return ''
}

export function naturePartBoundary(
  slot: LayerTemplateSlot,
  brief?: CharacterPromptCustomBrief
): string {
  const hint = natureSlotBriefHint(slot, brief)

  if (slot.id === 'tree-roots') {
    return `COMPLETE 4-CORNER UNCLIPPED MOSSY ROOT HILLOCK & SEAMLESS TRUNK BASE CONTINUITY — Draw a wide, low, flat-bottomed mossy earthen mound with spreading gnarled oak surface roots, keeping at least 15% pure #00FF00 background margin on ALL 4 SIDES (Left, Right, Top, Bottom). The left end, right end, and bottom edge of the mound MUST be 100% complete and organically rounded/tapered with natural overhanging grass tufts, small mossy stones, and root tips (NEVER touch or get sliced by the left, right, or bottom cell border; ZERO vertical side cuts, ZERO flat horizontal cuts). At the top-center, the roots converge smoothly upward into a SOLID, CONTINUOUS VERTICAL-BARK LOWER TRUNK COLLAR matching the exact trunk width, bark ridge lines, and warm brown color (#5A3E28–#8B6240) of [tree-trunk] (NO hollow sawed-off stump hole, NO open pipe cross-section, and NO blurry white/foggy gradient fade at the top) so [tree-trunk] locks onto [tree-roots] as one seamless tree.${hint}`
  }
  if (slot.id === 'tree-trunk') {
    return `STURDY GNARLED OAK TRUNK & BRANCHES WITH INTERLOCKING ROOT-BUTTRESS BASE — Draw the complete wooden trunk with spreading upper branches and a flared bottom root-buttress collar (#5A3E28–#8B6240) whose vertical bark ridges extend 15% downward to overlap and blend coaxially into the top bark collar of [tree-roots] with zero visible seam or color jump; keep at least 12% clear #00FF00 margin around all branch tips and root flares (NO leaves attached).${hint}`
  }
  if (slot.id === 'tree-foliage-back') {
    return `Complete deep-emerald background foliage crown silhouette (#14451B–#256B2C) behind the upper branches, with 100% unclipped rounded outer leaf puffs and at least 12% clear #00FF00 margin on all 4 sides (NO trunk or branches attached).${hint}`
  }
  if (slot.id === 'tree-foliage-back-gold') {
    return `Complete deep-amber & burnt-orange autumn background foliage crown (#8C3B10–#C96A1B) matching the exact cloud-like silhouette and scale of [tree-foliage-back], 100% unclipped on all 4 sides with 12% clear #00FF00 margin.${hint}`
  }
  if (slot.id === 'tree-foliage-mid') {
    return `Complete lush mid-tone green oak foliage crown (#246929–#499E32) with billowy cloud-like multi-lobe leaf clusters covering the main branches, 100% unclipped silhouette on all 4 sides with 12% clear #00FF00 margin (NO trunk attached).${hint}`
  }
  if (slot.id === 'tree-foliage-mid-gold') {
    return `Complete golden-yellow & warm-ochre autumn midground foliage crown (#B85D14–#E89B25) matching the exact cloud-like multi-lobe contour and scale of [tree-foliage-mid], 100% unclipped on all 4 sides.${hint}`
  }
  if (slot.id === 'tree-foliage-mid-sakura') {
    return `Complete soft sakura cherry-blossom pink midground canopy crown (#D96B98–#FCE4EE) matching the exact cloud-like multi-lobe contour and scale of [tree-foliage-mid], 100% unclipped on all 4 sides.${hint}`
  }
  if (slot.id === 'tree-foliage-front') {
    return `Complete sunlit vibrant chartreuse-and-emerald foreground leaf clusters (#3A8C2E–#82D93E) arranged in airy cloud-like multi-lobe puffs that layer in front of [tree-foliage-mid] for 2.5D depth, 100% unclipped edges with 12% clear #00FF00 margin.${hint}`
  }
  if (slot.id === 'tree-foliage-front-gold') {
    return `Complete sunlit bright gold-and-amber foreground leaf clusters (#D97719–#FFD147) matching the exact multi-lobe contour and scale of [tree-foliage-front], 100% unclipped edges.${hint}`
  }
  if (slot.id === 'tree-blossoms') {
    return `CANOPY-CONFORMING BLOSSOM CLUSTERS OVERLAY (SEAMLESS FOLIAGE FIT, NO BUSH STEMS) — Draw 6–8 organic clusters of 5-petal white-and-blush-pink blossoms distributed across the EXACT same cloud-like multi-lobe tree-crown silhouette (upper, center, left, and right puffs) as [tree-foliage-mid] and [tree-foliage-front] (NOT a hollow horseshoe arch, and NOT a ground flower bush). Border each blossom cluster with small rounded canopy leaves painted in the EXACT same emerald-to-sunlit-green palette (#246929–#76C938) as the tree's foliage layers so the flowers nestle seamlessly into the canopy; ZERO exposed bottom brown bush stems or trunk branches, 15% clear #00FF00 margin on all 4 sides.${hint}`
  }
  if (slot.id === 'tree-fruits') {
    return `CANOPY-CONFORMING RIPE RED APPLES OVERLAY (SEAMLESS FOLIAGE & LEAF BLEND) — Draw 14–18 proportional glossy ripe red apples arranged in 5–7 natural small sub-clusters of 2–3 apples distributed across the upper, center, left, and right puffs of the EXACT same cloud-like multi-lobe tree-crown silhouette as [tree-foliage-mid] and [tree-foliage-front] (NEVER one single giant clumped bunch in the middle, and NEVER a hollow horseshoe arch). Tuck each apple group inside small rounded oak-leaf puffs painted in the EXACT same emerald-to-sunlit-green palette (#246929–#76C938) and brush style as [tree-foliage-front] (ZERO pale olive/grey-brown leaves, ZERO thick cut branches), with 15% clear #00FF00 margin on all 4 sides.${hint}`
  }
  if (slot.id === 'rock-ground') {
    return `COMPLETE 4-CORNER UNCLIPPED EARTHEN TURF & STONE BASE MOUND — Draw a wide, low, flat-bottomed soil-and-grass base mound (NOT a pointed V-shaped floating cone) from left corner to right corner and along the bottom rim with 100% COMPLETE, NATURALLY ROUNDED AND TAPERED CORNERS (finished with overhanging grass blades, small corner pebbles, and a crisp dark-earth lower contour; keep at least 15% pure #00FF00 background margin on ALL 4 SIDES — NEVER slice the left or right ends vertically flat, NEVER cut the bottom flat, and ZERO blurry white bottom fade). Top-center forms a recessed mossy soil cradle shaped to hug the bottom contour of [rock-main] seamlessly.${hint}`
  }
  if (slot.id === 'rock-main') {
    return `Complete heavy angular stylized stone boulder with chiseled rock planes and a solid rounded base that sits snugly inside the recessed cradle of [rock-ground]; 15% clear #00FF00 margin on all 4 sides with zero clipped corners.${hint}`
  }
  if (slot.id === 'rock-cap') {
    return `Complete thick lush green moss blanket with hanging tendrils contoured to drape snugly over the upper ridges and top surface of [rock-main], 100% unclipped edges with 15% clear #00FF00 margin.${hint}`
  }
  if (slot.id === 'rock-snow-cap') {
    return `Complete fluffy winter white snow cap with soft icicle drips contoured to drape over the exact same upper ridges of [rock-main] as [rock-cap], 100% unclipped edges with 15% clear #00FF00 margin.${hint}`
  }
  if (slot.id === 'rock-crystals') {
    return `Complete cluster of faceted glowing cyan-blue magic crystals emerging upward with full unclipped crystal points and base, 15% clear #00FF00 margin on all 4 sides.${hint}`
  }
  if (slot.id === 'rock-pebbles') {
    return `Complete low foreground cluster of 4–6 small mossy stones and pebbles with rounded natural bases and 15% clear #00FF00 margin on all 4 sides (no flat cropped edges).${hint}`
  }
  if (slot.id === 'rock-flowers') {
    return `Complete clump of forest fern fronds and glowing wildflowers with a natural mossy root tuft at the bottom and 15% clear #00FF00 margin on all 4 sides.${hint}`
  }
  return `${slot.description || slot.nameEn} — Complete 100% unclipped isolated silhouette with at least 15% clear #00FF00 margin on all 4 sides.${hint}`
}

function formatNatureBriefBlock(brief?: CharacterPromptCustomBrief): string {
  const app = brief?.appearance?.trim()
  const cos = brief?.costume?.trim()
  const prp = brief?.props?.trim()
  if (!app && !cos && !prp) {
    return ''
  }
  const lines = [
    '\nUSER NATURE & PROP CUSTOMIZATION (HIGHEST PRIORITY — APPLY ACROSS ALL CELLS):'
  ]
  if (app) lines.push(`- TRUNK / BOULDER & GROUND BASE (Thân cây / Khối đá & Gốc rễ đế đất): ${app}`)
  if (cos) lines.push(`- CANOPY FOLIAGE & SEASONAL VARIANT (Tán lá / Rêu phủ / Biến thể mùa): ${cos}`)
  if (prp) lines.push(`- FRUITS, BLOSSOMS & DETAILS (Quả chín / Hoa nở / Tinh thể phụ kiện): ${prp}`)
  lines.push(
    '- CRITICAL: Apply the user specification above consistently across all cells while keeping 15% clear #00FF00 margin on all 4 edges (zero clipped corners) and seamless trunk-to-root / canopy-to-fruit alignment!'
  )
  return lines.join('\n')
}

export function naturePrompt(
  template: LayerAssemblyTemplate,
  customBrief?: CharacterPromptCustomBrief
): string {
  const baseIdentity =
    template.promptGuide.systemPrompt.match(/^IDENTITY:\s*(.+)$/m)?.[1] ||
    template.descriptionEn
  const customParts = [
    customBrief?.appearance?.trim(),
    customBrief?.costume?.trim(),
    customBrief?.props?.trim()
  ].filter(Boolean)
  const identity = customParts.length
    ? `${baseIdentity} — Custom Nature Brief: ${customParts.join(' | ')}`
    : baseIdentity
  const briefBlock = formatNatureBriefBlock(customBrief)
  const layout = [...template.slots]
    .sort((a, b) => (a.atlasCell || 0) - (b.atlasCell || 0))
    .map(
      (slot) =>
        `${slot.atlasCell}. ${slot.nameEn} [${slot.id}] — ${naturePartBoundary(slot, customBrief)}`
    )

  return `Create ONE square (1:1 aspect ratio) 2.5D MODULAR NATURE CUTOUT SPRITE ATLAS: stylized 2D game-art botanical/environment layers separated for 2.5D parallax depth and wind-sway animation.
IDENTITY: ${identity}${briefBlock}
VIEW: FRONT ORTHOGRAPHIC VIEW (0° eye-level straight-on), consistent top-front sunlight angle across all layers so stacked canopies, trunk, roots, rocks, blossoms, and fruits form ONE unified hand-painted illustration.
OUTPUT: PNG at 4096x4096 (or highest native 1:1 resolution). Flat OPAQUE solid neon green chroma-key background #00FF00. No checkerboard, gradients, ground shadow, or vignette.
GRID: Exactly 5 rows x 5 columns, numbered 1–25 left-to-right, top-to-bottom for instructions ONLY. Do not draw numbers, labels, IDs, watermarks, or grid lines.
Exactly ${template.slots.length} isolated parts, one assigned part per cell:
CELL ASSIGNMENTS (one isolated part per assigned cell):
${layout.join('\n')}
Leave all unassigned cells empty with only the background color #00FF00. No text, labels, grid lines or cast shadows.
Use one consistent pixel scale and the same orthographic view for all parts. Do not resize each part to fill its cell.
Left/right follow the assembled screen positions, not anatomical left/right. Keep all parts fully inside their cells with at least 15% clear padding on all 4 sides.

CRITICAL 2.5D NATURE LAYER COHESION, FULL CORNERS & SEAMLESS FITTING RULES:
1. ZERO EDGE CLIPPING — FULL 4-CORNER SILHOUETTES (BẮT BUỘC ĐỦ GÓC CẠNH ẢNH, KHÔNG BỊ CẮT CỤT VIỀN):
   - Every single piece — especially ground/root mounds ([tree-roots], [rock-ground], [bonsai-pot]) and wide foliage crowns — MUST be drawn as a 100% complete, self-contained silhouette with at least 15% pure #00FF00 margin on ALL 4 SIDES (Left, Right, Top, Bottom).
   - NEVER crop, slice, or let any root tip, soil mound corner, grass tuft, stone edge, or foliage puff touch the cell border! Left, right, and bottom corners of [tree-roots] and [rock-ground] must be wide, low, flat-bottomed mounds that taper off organically at both left and right ends with rounded stones, overhanging grass blades, and natural root tips — ZERO vertical side cuts, ZERO flat horizontal bottom cuts, and ZERO blurry white/foggy gradient fades!
2. SEAMLESS INTERLOCKING TRUNK-TO-ROOT & BOULDER-TO-GROUND JOINTS (KHỚP NỐI GỐC RỄ & ĐẾ ĐẤT ĂN KHÍT 100%):
   - [tree-roots] and [tree-trunk] MUST be designed from ONE unified tree trunk base sharing the exact same central collar width, vertical bark ridges, and warm wood palette (#5A3E28–#8B6240).
   - In [tree-roots], the spreading surface roots converge upward at the top-center into a solid, crisp vertical-bark lower trunk collar (NO hollow sawed-off stump hole, NO open pipe cross-section, and NO white fog erase band!). In [tree-trunk], the bottom flares into interlocking buttress roots that overlap 15% downward over [tree-roots] so trunk and roots join with zero visible seam.
   - [rock-ground] must feature a recessed mossy earth cradle at its top center that hugs the lower contour of [rock-main] seamlessly.
3. CANOPY-CONFORMING FRUITS & BLOSSOMS OVERLAYS (HOA NỞ & QUẢ CHÍN ĂN KHÍT VỚI TÁN LÁ):
   - [tree-fruits] and [tree-blossoms] MUST follow the exact same cloud-like, multi-lobe rounded tree-crown silhouette (upper, center, left, and right puffs) as [tree-foliage-mid] and [tree-foliage-front] — NEVER clump all fruits into one single central ball, and NEVER draw a hollow horseshoe arch.
   - Any small backing leaf tufts attached to [tree-fruits] or [tree-blossoms] MUST match the exact rounded oak-leaf shape and emerald-to-sunlit-green palette (#246929–#76C938) of the tree's foliage layers, with ZERO exposed thick bottom bush stems and ZERO mismatched olive/grey-brown leaf patches.
4. CLEAN CHROMA-KEY EXTRACTION:
   - Reconstruct the complete occluded silhouette of each depth layer so 2.5D parallax camera movement and wind sway never expose raw cut gaps.
   - Crisp antialiased edges on a flat uniform chroma-key background; no blur, glow, fringe, cast shadows or ground plane.`
}

export const NATURE_PROMPT_GUIDE =
  'Sprite Sheet nền xanh lá (#00FF00) chuẩn Cây cối & Đá tảng 2.5D bóc tách: Mọi bộ phận (đặc biệt là Đế gốc rễ [tree-roots] và Đế đất cỏ chân đá [rock-ground]) bắt buộc vẽ trọn vẹn 100% chu vi 4 góc cạnh với lề an toàn >=15% (tuyệt đối không cắt phẳng mép trái/phải/đáy, không làm mờ sương trắng hay khoét lỗ rỗng ở cổ gốc). Cổ rễ [tree-roots] và gốc thân cây [tree-trunk] dùng chung khổ rộng & vân vỏ gỗ ăn khít liền khối. Lớp Quả táo đỏ [tree-fruits] và Hoa nở [tree-blossoms] phân bố trải đều theo đúng vòm đám mây của tán lá kèm cụm lá đệm đồng bộ 100% tông xanh với tán cây.'
