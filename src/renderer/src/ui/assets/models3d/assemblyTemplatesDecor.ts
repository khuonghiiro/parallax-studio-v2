import {
  AWAY,
  BACK,
  DOWN,
  FRONT,
  LEFT,
  RIGHT,
  UP,
  WALL_ANCHOR,
  aroundY,
  awning,
  boxFaces,
  face,
  offset,
  prefixed,
  prismFaces,
  ridgeSlopes,
  swungPanel,
  tilted,
  type AssemblyTemplate,
  type TemplateFaceSpec
} from './assemblyTemplateKit'

/**
 * DECOR PARTS: small sub-assemblies that are built as their own 3D asset and then merged
 * onto a building shell. Wall-mounted parts share one convention (WALL_ANCHOR): the local
 * origin is the wall contact point, the back sits on z = 0 and the part sticks out toward
 * the viewer (z < 0), so merging at a point on a wall needs no extra depth math.
 * Face names stay positional (no assumptions about what the user's images show).
 */

function steps(count: number, w: number, rise: number, tread: number): TemplateFaceSpec[] {
  return Array.from({ length: count }, (_, k) => [
    face(`Bậc ${k + 1} mặt`, w, tread, [0, -rise * k, -(k + 0.5) * tread], UP, AWAY),
    face(`Bậc ${k + 1} đứng`, w, rise, [0, -rise * k - rise / 2, -(k + 1) * tread], FRONT)
  ]).flat()
}

export const DECOR_PARTS: AssemblyTemplate[] = [
  {
    id: 'window-shuttered', label: 'Cửa sổ có bậu & 2 cánh mở', category: 'decor', anchor: WALL_ANCHOR,
    hint: 'Kính + khung trên + bậu cửa + 2 cánh mở 35° – gắn lên vách',
    en: { label: 'Shuttered window with sill', hint: 'Glass + lintel + sill + 2 shutters opened 35° – mount on a wall' },
    faces: () => [
      face('Mặt kính', 200, 260, [0, 0, -2], FRONT),
      face('Khung trên', 250, 30, [0, 145, -12], FRONT),
      face('Bậu mặt', 250, 40, [0, -130, -20], UP, AWAY),
      face('Bậu đứng', 250, 16, [0, -138, -40], FRONT),
      swungPanel('Cánh trái', 105, 260, -100, -1, 35),
      swungPanel('Cánh phải', 105, 260, 100, 1, 35)
    ]
  },
  {
    id: 'window-bay', label: 'Cửa sổ lồi (bay window)', category: 'decor', anchor: WALL_ANCHOR,
    hint: '3 tấm kính lồi ra ngoài + mái trên + đáy',
    en: { label: 'Bay window', hint: '3 glass panels bulging outward + top cap + bottom' },
    faces: () => [
      face('Kính giữa', 200, 240, [0, 0, -90], FRONT),
      aroundY('Kính trái', 127, 240, -45, [-145, 0, -45]),
      aroundY('Kính phải', 127, 240, 45, [145, 0, -45]),
      face('Mái trên', 380, 90, [0, 120, -45], UP, AWAY),
      face('Đáy', 380, 90, [0, -120, -45], DOWN, [0, 0, -1])
    ]
  },
  {
    id: 'door-canopy', label: 'Cửa ra vào có khung, bậc & mái che', category: 'decor', anchor: WALL_ANCHOR,
    hint: 'Cánh cửa + 3 thanh khung + bậc thềm + mái che nghiêng',
    en: { label: 'Front door with frame, step & canopy', hint: 'Door leaf + 3 frame bars + doorstep + sloped canopy' },
    faces: () => [
      face('Cánh cửa', 220, 400, [0, 0, -2], FRONT),
      face('Khung trái', 30, 420, [-125, 10, -8], FRONT),
      face('Khung phải', 30, 420, [125, 10, -8], FRONT),
      face('Khung trên', 280, 30, [0, 215, -8], FRONT),
      face('Bậc mặt', 320, 80, [0, -200, -40], UP, AWAY),
      face('Bậc đứng', 320, 30, [0, -215, -80], FRONT),
      awning('Mái che', 320, 120, 260, 0, 25)
    ]
  },
  {
    id: 'porch-steps', label: 'Bậc tam cấp trước cửa', category: 'decor',
    anchor: 'Origin = top of the upper step at the wall (z = 0); steps descend toward the viewer.',
    hint: '3 bậc đi xuống về phía người xem, đặt dưới chân cửa',
    en: { label: 'Porch steps', hint: '3 steps descending toward the viewer, placed under a door' },
    faces: () => steps(3, 360, 40, 60)
  },
  {
    id: 'chimney', label: 'Ống khói gắn mái', category: 'decor',
    anchor: 'Origin = centre of the stack; front wall at z = 0. Sink the bottom into a roof slope, then run auto clip.',
    hint: '4 vách thân + nắp trên + viền nắp – cắm xuyên mái rồi "Tự cắt giao nhau"',
    en: { label: 'Roof chimney', hint: '4 stack walls + cap + cap rim – sink into the roof, then auto clip' },
    faces: () => [
      ...boxFaces(110, 260, 110, { top: false }),
      face('Nắp trên', 140, 140, [0, 138, 55], UP, AWAY),
      face('Viền nắp', 140, 16, [0, 130, -15], FRONT)
    ]
  },
  {
    id: 'dormer', label: 'Cửa mái (dormer)', category: 'decor',
    anchor: 'Origin = centre of the dormer front wall (below the gable); push into a roof slope, then auto clip.',
    hint: 'Mặt trước đầu hồi + 2 vách + 2 mái nhỏ – cắm vào mái dốc',
    en: { label: 'Roof dormer', hint: 'Gabled front + 2 cheeks + 2 small slopes – push into a roof slope' },
    faces: () => [
      face('Mặt trước', 160, 220, [0, 40, 0], FRONT),
      face('Vách trái', 160, 140, [-80, 0, 80], LEFT),
      face('Vách phải', 160, 140, [80, 0, 80], RIGHT),
      ...ridgeSlopes(160, 80, 160, 70, 12)
    ]
  },
  {
    id: 'column-classic', label: 'Cột trụ có đế & đầu cột', category: 'decor',
    anchor: 'Origin = centre of the shaft at mid-height; the shaft front touches z = 0.',
    hint: 'Thân lục giác + đế vuông + đầu cột vuông – dựng hiên/cổng',
    en: { label: 'Classic column with base & capital', hint: 'Hexagonal shaft + square base + square capital – for porches/gates' },
    faces: () => [
      ...prismFaces(6, 40, 480, 'Thân'),
      ...offset(prefixed('Đế', boxFaces(120, 40, 120)), [0, -260, -20]),
      ...offset(prefixed('Đầu', boxFaces(130, 36, 130)), [0, 258, -25])
    ]
  },
  {
    id: 'balcony', label: 'Ban công lan can', category: 'decor', anchor: WALL_ANCHOR,
    hint: 'Sàn + mép sàn + lan can trước + 2 lan can bên',
    en: { label: 'Balcony with railing', hint: 'Slab + slab edge + front railing + 2 side railings' },
    faces: () => [
      face('Sàn', 400, 160, [0, 0, -80], UP, AWAY),
      face('Mép sàn', 400, 24, [0, -12, -160], FRONT),
      face('Lan can trước', 400, 120, [0, 60, -160], FRONT),
      face('Lan can trái', 160, 120, [-200, 60, -80], LEFT),
      face('Lan can phải', 160, 120, [200, 60, -80], RIGHT)
    ]
  },
  {
    id: 'flower-box', label: 'Bồn hoa treo dưới cửa', category: 'decor', anchor: WALL_ANCHOR,
    hint: 'Bồn 3 vách + đáy + mặt đất + 2 lớp hoa so le',
    en: { label: 'Window flower box', hint: '3-wall planter + bottom + soil + 2 staggered flower layers' },
    faces: () => [
      ...offset(prefixed('Bồn', boxFaces(260, 70, 60, { top: false, back: false })), [0, 0, -60]),
      face('Bồn · Dưới', 260, 60, [0, -35, -30], DOWN, [0, 0, -1]),
      face('Mặt đất', 250, 55, [0, 25, -30], UP, AWAY),
      face('Hoa lớp trước', 280, 110, [0, 80, -45], FRONT),
      face('Hoa lớp sau', 280, 140, [0, 95, -15], FRONT)
    ]
  },
  {
    id: 'flower-pot', label: 'Chậu cây có tán chữ X', category: 'decor',
    anchor: 'Origin = centre of the pot; pot bottom at y = -70 (stand it on a floor or ledge).',
    hint: 'Chậu vuông 4 vách + mặt đất + 2 tán cắt chéo',
    en: { label: 'Potted plant (X-cross foliage)', hint: 'Square 4-wall pot + soil + 2 crossed foliage planes' },
    faces: () => [
      ...prefixed('Chậu', boxFaces(160, 140, 160, { top: false })),
      face('Mặt đất', 150, 150, [0, 55, 80], UP, AWAY),
      aroundY('Tán A', 220, 260, 45, [0, 185, 80]),
      aroundY('Tán B', 220, 260, -45, [0, 185, 80])
    ]
  },
  {
    id: 'wall-lamp', label: 'Đèn treo tường', category: 'decor', anchor: WALL_ANCHOR,
    hint: 'Đế gắn + tay đỡ + lồng đèn 5 mặt',
    en: { label: 'Wall lamp', hint: 'Wall plate + bracket arm + 5-sided lantern' },
    faces: () => [
      face('Đế gắn', 60, 90, [0, 0, -2], FRONT),
      face('Tay đỡ', 80, 16, [0, 30, -40], RIGHT),
      ...offset(prefixed('Lồng', boxFaces(70, 100, 70)), [0, -25, -115])
    ]
  },
  {
    id: 'hanging-sign', label: 'Biển treo tay vươn', category: 'decor', anchor: WALL_ANCHOR,
    hint: 'Đế gắn + tay vươn + biển 2 mặt treo phía trước',
    en: { label: 'Hanging sign on bracket', hint: 'Wall plate + bracket + double-sided board hanging in front' },
    faces: () => [
      face('Đế gắn', 50, 70, [0, 0, -2], FRONT),
      face('Tay vươn', 20, 170, [0, 10, -85], UP, AWAY),
      face('Biển trước', 180, 120, [0, -65, -150], FRONT),
      face('Biển sau', 180, 120, [0, -65, -150], BACK)
    ]
  },
  {
    id: 'fabric-awning', label: 'Mái hiên vải có diềm', category: 'decor', anchor: WALL_ANCHOR,
    hint: 'Mái vải nghiêng 30° + diềm trước + 2 hông',
    en: { label: 'Fabric awning with valance', hint: 'Fabric slope at 30° + front valance + 2 side flaps' },
    faces: () => [
      awning('Mái vải', 400, 180, 0, 0, 30),
      face('Diềm trước', 400, 40, [0, -110, -156], FRONT),
      face('Hông trái', 156, 90, [-200, -45, -78], LEFT),
      face('Hông phải', 156, 90, [200, -45, -78], RIGHT)
    ]
  },
  {
    id: 'fence-3', label: 'Hàng rào 3 nhịp', category: 'decor',
    anchor: 'Origin = centre of the middle panel; panel bottoms at y = -65.',
    hint: '3 tấm rào + 4 cột trụ',
    en: { label: '3-bay fence', hint: '3 fence panels + 4 posts' },
    faces: () => [
      ...[-210, 0, 210].map((x, i) => face(`Tấm ${i + 1}`, 200, 130, [x, 0, 0], FRONT)),
      ...[-315, -105, 105, 315].map((x, i) => face(`Cột ${i + 1}`, 30, 170, [x, 10, -4], FRONT))
    ]
  }
]

/** Extra free-standing props (category `props`). */
export const EXTRA_PROPS: AssemblyTemplate[] = [
  {
    id: 'bench', label: 'Ghế băng', category: 'props',
    hint: 'Mặt ngồi + tựa lưng nghiêng + 2 chân + yếm trước',
    en: { label: 'Bench', hint: 'Seat + reclined backrest + 2 side legs + front apron' },
    faces: () => [
      face('Mặt ngồi', 360, 110, [0, 0, 55], UP, AWAY),
      tilted('Tựa lưng', 360, 120, [0, 59, 122], 12),
      face('Chân trái', 110, 120, [-180, -60, 55], LEFT),
      face('Chân phải', 110, 120, [180, -60, 55], RIGHT),
      face('Yếm trước', 360, 30, [0, -15, 0], FRONT)
    ]
  },
  {
    id: 'street-lamp', label: 'Cột đèn đường', category: 'props',
    hint: 'Thân cột chữ thập + lồng đèn 5 mặt trên đỉnh',
    en: { label: 'Street lamp', hint: 'Cross-shaped pole + 5-sided lantern on top' },
    faces: () => [
      face('Thân', 40, 700, [0, 0, 0], FRONT),
      face('Thân ngang', 40, 700, [0, 0, 0], RIGHT),
      ...offset(prefixed('Lồng', boxFaces(90, 120, 90)), [0, 410, -45])
    ]
  },
  {
    id: 'market-stall', label: 'Sạp hàng chợ', category: 'props',
    hint: 'Quầy 4 mặt + 2 cột sau + mái sạp nghiêng',
    en: { label: 'Market stall', hint: '4-sided counter + 2 back poles + sloped stall roof' },
    faces: () => [
      ...offset(prefixed('Quầy', boxFaces(500, 110, 160, { back: false })), [0, -145, 0]),
      face('Cột trái', 20, 400, [-240, 0, 160], FRONT),
      face('Cột phải', 20, 400, [240, 0, 160], FRONT),
      awning('Mái sạp', 560, 220, 200, 160, 20)
    ]
  }
]
