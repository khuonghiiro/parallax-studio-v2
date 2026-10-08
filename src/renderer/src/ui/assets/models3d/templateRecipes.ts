import type { AssemblyTemplate, TemplateFaceSpec } from './assemblyTemplateKit'
import type { ImageMeshRecipe, ImageMeshSlot, ImageMeshVariant } from './imageMeshTypes'

export const STANDARD_VARIANTS: ImageMeshVariant[] = [
  { id: 'standard', label: 'Tiêu chuẩn', en: 'Standard', scale: [1, 1, 1], bend: 1 },
  { id: 'slender', label: 'Nhỏ / cong nhẹ', en: 'Compact / gently curved', scale: [0.75, 0.75, 0.75], bend: 0.7 },
  { id: 'wide', label: 'Lớn / cong rõ', en: 'Large / strongly curved', scale: [1.3, 1.3, 1.3], bend: 1.2 }
]

export function s(id: string, label: string, en: string, aspect: [number, number], prompt: string, guidance: string): ImageMeshSlot {
  return { id, label, en, aspect, prompt, guidance }
}

function gcd(a: number, b: number): number {
  let x = Math.round(Math.abs(a))
  let y = Math.round(Math.abs(b))
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}

export function simplifyAspect(w: number, h: number): [number, number] {
  const g = gcd(w, h)
  const sw = Math.round(w / g)
  const sh = Math.round(h / g)
  if (sw > 16 || sh > 16) {
    const r = w / h
    let best: [number, number] = [sw, sh]
    let bestErr = 999
    for (let d = 1; d <= 16; d++) {
      const n = Math.round(r * d)
      const err = Math.abs(n / d - r)
      if (err < bestErr && n > 0) {
        bestErr = err
        best = [n, d]
      }
    }
    const g2 = gcd(best[0], best[1])
    return [Math.round(best[0] / g2), Math.round(best[1] / g2)]
  }
  return [sw, sh]
}

interface TemplateRecipeDefinition {
  slots: ImageMeshSlot[]
  variants?: ImageMeshVariant[]
  assignFaceSlot?: (faceName: string, index: number, face: TemplateFaceSpec) => string
}

const RECIPES: Record<string, TemplateRecipeDefinition> = {
  // Architecture shells
  'gable-house': {
    slots: [
      s('facade', 'Mặt tiền / đầu hồi', 'Gable facade', [3, 2], 'Orthographic Tudor gable facade, plaster with dark timber framing, roofline rising to apex. No perspective.', 'Mặt tiền nhà đầu hồi chữ A, tường trát vôi trắng và khung gỗ cổ điển, đỉnh mái dốc ở trên.'),
      s('side', 'Vách hông', 'Side wall', [4, 3], 'Orthographic side wall elevation, matching plaster and timber framing, rectangular edge to edge.', 'Vách tường hông nhìn thẳng, cùng cao độ và hoa văn nẹp gỗ với mặt tiền.'),
      s('roof', 'Mái dốc', 'Roof slope', [3, 2], 'Top-down orthographic terracotta roof tiles, clean repeating shingle pattern, edge to edge.', 'Mái ngói đất nung nhìn trực diện, phủ kín khung, không bóng đổ.')
    ],
    assignFaceSlot: (name) => name.includes('Mái') || name.includes('Dốc') ? 'roof' : (name.includes('Trái') || name.includes('Phải') ? 'side' : 'facade')
  },
  'flat-house': {
    slots: [
      s('front', 'Mặt trước', 'Front facade', [4, 3], 'Orthographic building front facade, flat roofline at top, entrance door and windows.', 'Mặt trước nhà mái bằng nhìn chính diện.'),
      s('side', 'Vách hông', 'Side wall', [4, 3], 'Orthographic side wall, matching materials with front.', 'Vách tường hông nhìn chính diện.'),
      s('roof', 'Mái bằng', 'Flat roof', [4, 3], 'Top-down flat concrete or gravel rooftop plan view.', 'Mặt mái bằng phẳng nhìn thẳng từ trên xuống.')
    ],
    assignFaceSlot: (name) => name.includes('Trên') ? 'roof' : (name.includes('Trái') || name.includes('Phải') ? 'side' : 'front')
  },
  'shop-awning': {
    slots: [
      s('facade', 'Mặt tiền cửa hiệu', 'Shopfront facade', [3, 2], 'Traditional shopfront facade with display window and entrance door.', 'Mặt tiền cửa hiệu có cửa sổ trưng bày và cửa ra vào.'),
      s('side', 'Vách hông', 'Side wall', [4, 3], 'Plain shop side wall elevation.', 'Vách tường hông cửa hiệu.'),
      s('awning', 'Mái hiên bạt', 'Fabric awning', [3, 1], 'Front orthographic striped fabric shop awning, sloped downward.', 'Mái hiên bạt sọc màu nhìn thẳng.'),
      s('roof', 'Mái trên', 'Flat roof', [4, 3], 'Flat upper rooftop plan view.', 'Mái bằng phía trên.')
    ],
    assignFaceSlot: (name) => name.includes('hiên') ? 'awning' : (name.includes('Trên') ? 'roof' : (name.includes('Trái') || name.includes('Phải') ? 'side' : 'facade'))
  },
  'tent': {
    slots: [
      s('gable', 'Cửa lều tam giác', 'Tent front opening', [1, 1], 'Triangular front tent opening with canvas flap tied back.', 'Mặt mở tam giác phía trước của lều cắm trại.'),
      s('canvas', 'Bạt lều dốc', 'Sloped tent canvas', [3, 2], 'Clean sloped canvas tent fabric texture, edge to edge.', 'Vải bạt lều nghiêng hai bên.'),
      s('floor', 'Đáy lều', 'Tent ground floor', [3, 2], 'Waterproof tent floor ground tarp.', 'Đáy lều cắm trại nhìn từ trên.')
    ],
    assignFaceSlot: (name) => name.includes('Đáy') ? 'floor' : (name.includes('Dốc') ? 'canvas' : 'gable')
  },
  'shell-walls': {
    slots: [
      s('front', 'Mặt trước / sau', 'Front / back wall', [7, 4], 'Long masonry wall elevation, limestone or brick finish, no roof.', 'Vách tường dài trước và sau, khối đá hoặc gạch trần.'),
      s('side', 'Vách hông', 'Side wall', [5, 4], 'Short masonry side wall elevation, matching finish.', 'Vách tường hông ngắn bên trái và phải.')
    ],
    assignFaceSlot: (name) => name.includes('Trái') || name.includes('Phải') ? 'side' : 'front'
  },
  'shell-two-storey': {
    slots: [
      s('facade', 'Mặt tiền 2 tầng', 'Two-storey gable facade', [3, 4], 'Two-storey orthographic gable facade, upper floor overhang, timber and plaster.', 'Mặt tiền 2 tầng đầu hồi chữ A cao ráo, nẹp gỗ cổ điển.'),
      s('side', 'Vách hông 2 tầng', 'Two-storey side wall', [4, 5], 'Two-storey side wall elevation, matching floor heights and materials.', 'Vách tường hông 2 tầng, ăn khớp cao độ với mặt tiền.'),
      s('roof', 'Mái dốc', 'Roof slope', [3, 2], 'Terracotta tile roof slope, clean shingle rows.', 'Mái ngói dốc nhìn thẳng.')
    ],
    assignFaceSlot: (name) => name.includes('Mái') || name.includes('Dốc') ? 'roof' : (name.includes('Trái') || name.includes('Phải') ? 'side' : 'facade')
  },
  'shell-hip-roof': {
    slots: [
      s('front', 'Vách trước / sau', 'Front/back wall', [7, 4], 'Orthographic house wall elevation.', 'Mặt tường trước và sau.'),
      s('side', 'Vách hông', 'Side wall', [5, 4], 'Orthographic side wall elevation.', 'Vách tường hông bên trái và phải.'),
      s('roof', 'Mái dốc 4 phía', 'Hip roof slope', [5, 3], 'Sloped roof tiles texture, trapezoidal/triangular framing.', 'Mái ngói nghiêng 4 phía quanh nhà.')
    ],
    assignFaceSlot: (name) => name.includes('Mái') ? 'roof' : (name.includes('Trái') || name.includes('Phải') ? 'side' : 'front')
  },
  'shell-shed-roof': {
    slots: [
      s('front', 'Vách trước cao', 'High front wall', [5, 3], 'High front elevation of modern shed-roof house.', 'Vách tường trước cao của nhà mái dốc một phía.'),
      s('back', 'Vách sau thấp', 'Low back wall', [5, 2], 'Low rear wall elevation.', 'Vách tường sau thấp.'),
      s('side', 'Vách hông xiên', 'Sloped side wall', [4, 3], 'Side wall with sloped top matching roof pitch.', 'Vách tường hông có mép trên vát chéo.'),
      s('roof', 'Mái dốc', 'Mono-pitch roof', [5, 3], 'Single sloped metal or shingle roof.', 'Mái ngói hoặc tôn dốc một phía.')
    ],
    assignFaceSlot: (name) => name.includes('Mái') ? 'roof' : (name.includes('Sau') ? 'back' : (name.includes('Trái') || name.includes('Phải') ? 'side' : 'front'))
  },
  'shell-l-shaped': {
    slots: [
      s('facade_main', 'Đầu hồi chính', 'Main gable facade', [3, 2], 'Main wing gable facade elevation.', 'Mặt đầu hồi khối nhà chính.'),
      s('facade_wing', 'Đầu hồi cánh phụ', 'Wing gable facade', [3, 2], 'Wing gable facade elevation.', 'Mặt đầu hồi khối nhà nhánh chữ L.'),
      s('wall', 'Vách tường hông', 'Side wall', [4, 3], 'Plain exterior masonry wall.', 'Vách tường phẳng xung quanh.'),
      s('roof', 'Mái ngói', 'Roof slope', [3, 2], 'Terracotta roof tiles for L-shape intersection.', 'Mái ngói dốc giao nhau.')
    ],
    assignFaceSlot: (name) => name.includes('Mái') || name.includes('Dốc') ? 'roof' : (name.includes('Cánh') ? 'facade_wing' : (name.includes('Trước') ? 'facade_main' : 'wall'))
  },
  'shell-barn': {
    slots: [
      s('facade', 'Mặt tiền chuồng trại', 'Barn gable facade', [4, 3], 'Red gambrel barn gable facade with sliding double doors.', 'Mặt tiền chuồng trại mái vòm gãy gập, cửa gỗ lớn.'),
      s('side', 'Vách hông chuồng trại', 'Barn side wall', [5, 3], 'Vertical red barn wood plank siding.', 'Vách tường hông ván gỗ đỏ thẳng đứng.'),
      s('roof_lower', 'Mái dốc dưới', 'Lower steep roof', [3, 1], 'Steep lower gambrel roof slope.', 'Mái dốc dưới có độ nghiêng lớn.'),
      s('roof_upper', 'Mái dốc trên', 'Upper shallow roof', [3, 1], 'Shallow upper gambrel roof slope.', 'Mái dốc trên thoải đỉnh mái.')
    ],
    assignFaceSlot: (name) => name.includes('trên') ? 'roof_upper' : (name.includes('dưới') ? 'roof_lower' : (name.includes('Trái') || name.includes('Phải') ? 'side' : 'facade'))
  },
  'shell-tower-hex': {
    slots: [
      s('wall', 'Vách tháp 6 mặt', 'Tower wall facet', [1, 3], 'Single vertical stone tower facet, aged masonry blocks.', 'Một vách đá thẳng đứng trong 6 cạnh tháp lục giác.'),
      s('spire', 'Mái chóp nhọn', 'Tower spire facet', [1, 2], 'Pointed slate roof spire triangle facet.', 'Một mặt mái ngói đá chóp nhọn đỉnh tháp.')
    ],
    assignFaceSlot: (name) => name.includes('Chóp') || name.includes('Mái') ? 'spire' : 'wall'
  },

  // Decor parts
  'window-shuttered': {
    slots: [
      s('window', 'Mặt kính', 'Window glass', [2, 3], 'Window frame with glass panes, transparent alpha outside.', 'Mặt kính cửa sổ và khung viền, nền trong suốt.'),
      s('frame', 'Khung trên / bậu', 'Lintel / sill', [6, 1], 'Carved stone or timber lintel beam.', 'Khung dầm trên hoặc gờ đá bậu cửa.'),
      s('shutter', 'Cánh cửa sổ mở', 'Window shutter', [1, 3], 'Single wooden window shutter with louvers, transparent outside.', 'Cánh cửa sổ chớp gỗ mở nghiêng hai bên.')
    ],
    assignFaceSlot: (name) => name.includes('Cánh') ? 'shutter' : (name.includes('Khung') || name.includes('Bậu') ? 'frame' : 'window')
  },
  'window-bay': {
    slots: [
      s('glass', 'Tấm kính lồi', 'Bay window glass', [1, 2], 'Single vertical bay window pane with wooden frame.', 'Mặt kính cửa sổ lồi vát góc.'),
      s('roof', 'Mái che lồi', 'Bay window roof', [2, 1], 'Copper or shingle small bay window roof top.', 'Mái che ngói hoặc kim loại phía trên cửa sổ lồi.')
    ],
    assignFaceSlot: (name) => name.includes('Mái') || name.includes('Đáy') ? 'roof' : 'glass'
  },
  'door-arched': {
    slots: [
      s('door', 'Cánh cửa vòm', 'Arched door leaf', [1, 2], 'Arched solid wooden door with iron hinges, transparent outside.', 'Cánh cửa vòm gỗ sồi cổ điển, bản lề sắt, nền trong suốt.'),
      s('arch', 'Vòm đá cuốn', 'Stone arch surround', [3, 2], 'Carved stone arch entryway surround with alpha opening.', 'Khung vòm cuốn đá bao quanh cửa.'),
      s('step', 'Bậc thềm đá', 'Stone entrance step', [5, 1], 'Aged stone threshold step, top and front.', 'Bậc thềm đá bước vào cửa.')
    ],
    assignFaceSlot: (name) => name.includes('Vòm') ? 'arch' : (name.includes('Bậc') ? 'step' : 'door')
  },
  'door-cottage': {
    slots: [
      s('door', 'Cánh cửa gỗ mộc', 'Plank cottage door', [1, 2], 'Rustic timber door with diagonal brace and iron latch.', 'Cánh cửa gỗ mộc có nẹp chéo và chốt sắt.'),
      s('frame', 'Khung bao', 'Door frame surround', [1, 2], 'Timber door frame surround.', 'Khung bao nẹp gỗ quanh cửa.')
    ],
    assignFaceSlot: (name) => name.includes('Khung') || name.includes('Nẹp') ? 'frame' : 'door'
  },
  'chimney': {
    slots: [
      s('brick', 'Thân ống khói', 'Chimney shaft', [1, 3], 'Red brick chimney masonry texture, vertical seamless.', 'Thân ống khói gạch đỏ liền mạch.'),
      s('cap', 'Mũ gờ đá', 'Stone chimney cap', [3, 1], 'Stone chimney drip cap rim.', 'Mũ gờ đá che đỉnh ống khói.'),
      s('pot', 'Ống gốm đỉnh', 'Terracotta pot', [1, 2], 'Round terracotta chimney pot cylinder with rim.', 'Ống gốm tròn nhô lên trên nóc ống khói.')
    ],
    assignFaceSlot: (name) => name.includes('gốm') || name.includes('Ống') ? 'pot' : (name.includes('mũ') || name.includes('Gờ') ? 'cap' : 'brick')
  },
  'chimney-tall': {
    slots: [
      s('brick', 'Thân ống khói cao', 'Tall chimney shaft', [1, 5], 'Tall slender red brick chimney shaft.', 'Thân ống khói gạch đỏ cao vút.'),
      s('cap', 'Mũ đá & ống gốm', 'Cap & pot', [1, 2], 'Stone chimney crown with terracotta pots.', 'Mũ đá và ống gốm thoát khói.')
    ],
    assignFaceSlot: (name) => name.includes('Thân') ? 'brick' : 'cap'
  },
  'flower-box': {
    slots: [
      s('box', 'Vách bồn gỗ', 'Wooden planter box', [4, 1], 'Weathered wooden planter box panel.', 'Vách hộp bồn hoa gỗ sồi treo tường.'),
      s('flowers', 'Hoa lá rực rỡ', 'Flowers & trailing ivy', [4, 2], 'Blooms and trailing green ivy with transparent alpha.', 'Khóm hoa ban công rực rỡ và lá rủ nền trong suốt.')
    ],
    assignFaceSlot: (name) => name.includes('Hoa') || name.includes('Lá') ? 'flowers' : 'box'
  },
  'balcony-wood': {
    slots: [
      s('floor', 'Sàn gỗ ban công', 'Balcony deck', [3, 1], 'Wooden plank balcony floor deck.', 'Mặt sàn gỗ ban công nhìn từ trên.'),
      s('railing', 'Lan can gỗ', 'Baluster railing', [3, 1], 'Carved wooden balcony railing with transparent gaps.', 'Lan can con tiện gỗ có khoảng hở alpha.'),
      s('bracket', 'Con sơn đỡ', 'Support bracket', [1, 1], 'Carved decorative wooden corbel bracket.', 'Con sơn gỗ đỡ đáy ban công.')
    ],
    assignFaceSlot: (name) => name.includes('Lan can') ? 'railing' : (name.includes('Sơn') || name.includes('Đỡ') ? 'bracket' : 'floor')
  },
  'column-stone': {
    slots: [
      s('shaft', 'Thân cột đá', 'Column shaft', [1, 6], 'Classical stone column shaft with subtle fluting.', 'Thân cột đá hình trụ tròn có rãnh khía thanh mảnh.'),
      s('capital', 'Đầu / đế cột', 'Column capital & base', [1, 1], 'Carved Corinthian or Tuscan stone column capital.', 'Đầu cột và chân đế hoa văn đá.')
    ],
    assignFaceSlot: (name) => name.includes('Thân') ? 'shaft' : 'capital'
  },
  'sign-hanging': {
    slots: [
      s('board', 'Biển hiệu 2 mặt', 'Double-sided sign board', [3, 2], 'Painted wooden hanging tavern/shop sign board, ornate edges.', 'Bảng hiệu gỗ treo hai mặt phong cách châu Âu.'),
      s('bracket', 'Giá sắt rèn', 'Wrought iron bracket', [1, 1], 'Decorative scrollwork wrought iron hanging bracket with alpha.', 'Giá sắt rèn hoa văn uốn lượn nền trong suốt.')
    ],
    assignFaceSlot: (name) => name.includes('Khung') || name.includes('Giá') ? 'bracket' : 'board'
  },
  'awning-striped': {
    slots: [
      s('canopy', 'Bạt che sọc màu', 'Striped awning fabric', [2, 1], 'Sloped fabric awning with alternating colored stripes.', 'Bạt che mái hiên sọc màu xen kẽ.'),
      s('valance', 'Yếm rủ lượn sóng', 'Scalloped valance', [4, 1], 'Scalloped fabric valance rim with fringe.', 'Yếm bạt rủ viền gợn sóng phía trước.')
    ],
    assignFaceSlot: (name) => name.includes('Yếm') ? 'valance' : 'canopy'
  },
  'fence-picket': {
    slots: [
      s('picket', 'Hàng rào cọc gỗ', 'Picket fence panel', [3, 1], 'White wooden pointed picket fence section with real transparent alpha between slats.', 'Hàng rào cọc gỗ nhọn màu trắng có khoảng trống alpha giữa các nan.')
    ],
    assignFaceSlot: () => 'picket'
  },

  // Props & cylinders
  'cylinder-4': {
    slots: [
      s('panel', 'Mảnh vách cong 90°', 'Curved quadrant panel', [1, 2], 'One quadrant curved cylinder surface (brick, metal or bark), edge to edge.', 'Mảnh vách trụ uốn cong 90 độ, mép bên khớp liền mạch.')
    ],
    assignFaceSlot: () => 'panel'
  },
  'cylinder-6': {
    slots: [
      s('panel', 'Mảnh vách cong 60°', 'Curved sextant panel', [1, 2], 'One sextant curved cylinder surface, edge to edge.', 'Mảnh vách cong 60 độ của trụ tròn lớn.')
    ],
    assignFaceSlot: () => 'panel'
  },
  'cylinder-8': {
    slots: [
      s('panel', 'Mảnh vách cong 45°', 'Curved octant panel', [1, 2], 'One octant gently curved cylinder surface for smooth towers.', 'Mảnh vách uốn cong nhẹ 45 độ của tháp tròn đại.')
    ],
    assignFaceSlot: () => 'panel'
  },
  'cone-tapered': {
    slots: [
      s('panel', 'Mảnh thân nón thuôn', 'Tapered cone panel', [1, 3], 'One tapered curved cone panel, wider at base and narrower at top.', 'Mảnh thân côn nhọn uốn cong, đáy rộng và thuôn nhỏ dần về đỉnh.')
    ],
    assignFaceSlot: () => 'panel'
  },
  'pillar-square': {
    slots: [
      s('wall', 'Vách trụ vuông', 'Square pillar facet', [1, 3], 'Flat vertical stone or plaster pillar elevation.', 'Mặt vách đứng của cột vuông hoặc trụ bệ đá.')
    ],
    assignFaceSlot: () => 'wall'
  },
  'box': {
    slots: [
      s('side', 'Mặt hông hộp', 'Box side face', [1, 1], 'Square crate or box wooden plank surface.', 'Mặt gỗ bên hông khối hộp hoặc thùng hàng.'),
      s('top', 'Mặt nắp hộp', 'Box top lid', [1, 1], 'Square top surface of crate.', 'Mặt nắp trên của thùng hàng.')
    ],
    assignFaceSlot: (name) => name.includes('Trên') ? 'top' : 'side'
  },
  'cube-3': {
    slots: [
      s('face', 'Mặt khối lập phương', 'Cube face', [1, 1], 'Square cubic facet texture.', 'Mặt vuông của khối lập phương.')
    ],
    assignFaceSlot: () => 'face'
  },
  'bench': {
    slots: [
      s('seat', 'Mặt ngồi ghế', 'Bench seat slats', [4, 1], 'Wooden bench seat slats elevation.', 'Mặt ngồi nan gỗ ghế băng nhìn từ trên.'),
      s('back', 'Tựa lưng ghế', 'Bench backrest', [4, 1], 'Wooden bench backrest panel.', 'Tựa lưng ghế băng gỗ.'),
      s('leg', 'Chân ghế đá / sắt', 'Bench support leg', [1, 1], 'Ornate iron or stone bench leg with transparent alpha.', 'Chân ghế băng đúc sắt hoặc đá có alpha.')
    ],
    assignFaceSlot: (name) => name.includes('ngồi') ? 'seat' : (name.includes('tựa') ? 'back' : 'leg')
  },
  'street-lamp': {
    slots: [
      s('pole', 'Thân cột sắt', 'Lamp pole', [1, 8], 'Dark cast iron lamppost column, vertical straight.', 'Thân cột đèn đường sắt rèn thẳng đứng.'),
      s('lantern', 'Lồng đèn kính sáng', 'Glass lantern head', [1, 1], 'Victorian street lantern with glowing warm glass panels, transparent alpha outside.', 'Lồng đèn đường cổ điển kính sáng có alpha.')
    ],
    assignFaceSlot: (name) => name.includes('lồng') || name.includes('đèn') ? 'lantern' : 'pole'
  },
  'signpost': {
    slots: [
      s('board', 'Biển chỉ hướng', 'Signboard', [3, 1], 'Pointed wooden direction sign board with text or arrow.', 'Bảng chỉ dẫn bằng gỗ có mũi tên chỉ đường.'),
      s('post', 'Cột gỗ đứng', 'Wooden post', [1, 8], 'Square or round vertical wooden post.', 'Cột gỗ đứng cắm biển báo.')
    ],
    assignFaceSlot: (name) => name.includes('bảng') || name.includes('Biển') ? 'board' : 'post'
  },
  'market-stall': {
    slots: [
      s('counter', 'Quầy hàng gỗ', 'Market counter', [3, 2], 'Wooden market stall counter with rustic planks.', 'Quầy hàng chợ bằng ván gỗ mộc.'),
      s('roof', 'Mái bạt sạp chợ', 'Stall canopy roof', [3, 2], 'Sloped striped canvas stall roof canopy.', 'Mái bạt vải che sạp hàng chợ.'),
      s('pole', 'Cột chống', 'Support poles', [1, 8], 'Wooden support poles.', 'Cột chống đỡ mái sạp.')
    ],
    assignFaceSlot: (name) => name.includes('Mái') ? 'roof' : (name.includes('Quầy') ? 'counter' : 'pole')
  },

  // Nature
  'tree-cross': {
    slots: [
      s('trunk', 'Thân cây gỗ', 'Tree trunk', [1, 5], 'Straight tree bark trunk cylinder texture, seamless vertical.', 'Vỏ thân cây gỗ xù xì dạng trụ đứng.'),
      s('canopy', 'Tán lá vòm tròn', 'Dome canopy foliage', [1, 1], 'Volumetric dense tree canopy foliage clump, rich greens, transparent alpha around edges, no trunk.', 'Tán lá cây rậm rạp hình tròn vòm đa hướng, nền trong suốt.')
    ],
    assignFaceSlot: (name) => name.includes('Thân') || name.includes('Trụ') ? 'trunk' : 'canopy'
  },
  'bush-3': {
    slots: [
      s('foliage', 'Cụm lá bụi cây', 'Bush foliage clump', [1, 1], 'Organic dense bush foliage clump with leaf details, transparent alpha outside.', 'Cụm lá cây bụi rậm rạp tự nhiên, viền lá tỉ mỉ tách nền alpha.')
    ],
    assignFaceSlot: () => 'foliage'
  },
  'foliage-layers': {
    slots: [
      s('layer', 'Tấm tán lá phân lớp', 'Foliage branch layer', [3, 2], 'Natural leafy branch spreading horizontally, transparent alpha for layered parallax depth.', 'Cành lá cây trải ngang tự nhiên nền trong suốt để tạo lớp parallax.')
    ],
    assignFaceSlot: () => 'layer'
  },
  'ground-patch': {
    slots: [
      s('ground', 'Mặt đất / sỏi', 'Ground earth surface', [1, 1], 'Top-down natural grass and soil texture patch.', 'Mặt đất vườn hoặc sỏi đá nhìn từ trên.'),
      s('edge', 'Viền cây cỏ mép', 'Grass edge rim', [3, 1], 'Front horizontal grass rim cutout with alpha.', 'Viền ngọn cỏ mép trước tách nền alpha.')
    ],
    assignFaceSlot: (name) => name.includes('Đất') ? 'ground' : 'edge'
  },
  'flower-patch': {
    slots: [
      s('ground', 'Đất nền sân vườn', 'Garden soil ground', [1, 1], 'Top-down soil patch.', 'Mặt đất sân vườn nhìn từ trên.'),
      s('flower', 'Khóm hoa nở xòe', 'Blooming flower clump', [1, 1], 'Multi-directional blooming garden flower cluster with leaves, transparent alpha.', 'Khóm hoa nở rực rỡ nhiều hướng tách nền trong suốt.')
    ],
    assignFaceSlot: (name) => name.includes('Đất') ? 'ground' : 'flower'
  },
  'hedge': {
    slots: [
      s('front', 'Vách bờ rào xén tỉa', 'Boxwood hedge side', [3, 1], 'Dense clipped green boxwood hedge surface.', 'Vách bờ rào cây xanh cắt tỉa vuông vắn.'),
      s('top', 'Mặt trên bờ rào', 'Hedge curved top', [3, 1], 'Curved wavy top surface of clipped garden hedge.', 'Mặt trên bờ rào uốn cong mềm mại.')
    ],
    assignFaceSlot: (name) => name.includes('trên') ? 'top' : 'front'
  },

  // Stage
  'room-open': {
    slots: [
      s('floor', 'Sàn phòng', 'Room floor', [4, 3], 'Top-down interior parquet wood or tile floor plan.', 'Mặt sàn gỗ nội thất nhìn từ trên.'),
      s('wall_back', 'Tường chính diện', 'Back wall', [4, 3], 'Interior back room wall with wallpaper or paint finish.', 'Mặt tường phòng chính diện phía sau.'),
      s('wall_side', 'Tường hông', 'Side wall', [3, 3], 'Interior side wall elevation.', 'Mặt tường hông bên trái và phải.')
    ],
    assignFaceSlot: (name) => name.includes('Sàn') ? 'floor' : (name.includes('bên') ? 'wall_side' : 'wall_back')
  },
  'street-corner': {
    slots: [
      s('facade_a', 'Mặt tiền phố A', 'Street facade A', [3, 4], 'Historic street corner shop facade A.', 'Mặt tiền dãy phố thứ nhất.'),
      s('facade_b', 'Mặt tiền phố B', 'Street facade B', [3, 4], 'Historic street corner facade B.', 'Mặt tiền dãy phố thứ hai vuông góc.'),
      s('pavement', 'Vỉa hè góc phố', 'Cobblestone pavement', [3, 3], 'Sidewalk cobblestone street pavement from above.', 'Mặt vỉa hè lát đá góc phố nhìn từ trên.')
    ],
    assignFaceSlot: (name) => name.includes('hè') ? 'pavement' : (name.includes('1') ? 'facade_a' : 'facade_b')
  },
  'cyclorama': {
    slots: [
      s('floor', 'Sàn studio', 'Studio floor', [3, 2], 'Seamless photography studio floor.', 'Sàn studio chụp ảnh vô cực.'),
      s('cove', 'Góc bo cong 45°', 'Cove sweep', [3, 1], 'Curved cove sweep transition.', 'Mép chuyển tiếp bo cong 45 độ.'),
      s('backdrop', 'Phông nền đứng', 'Upright backdrop', [3, 2], 'Upright seamless infinite backdrop wall.', 'Phông đứng vô cực studio.')
    ],
    assignFaceSlot: (name) => name.includes('Sàn') ? 'floor' : (name.includes('Góc') ? 'cove' : 'backdrop')
  },
  'diorama': {
    slots: [
      s('wall', 'Tường hậu cảnh', 'Back diorama wall', [4, 3], 'Sky or distant panorama backdrop.', 'Phông nền bầu trời hoặc cảnh xa phía sau.'),
      s('floor', 'Sàn diorama', 'Diorama ground', [4, 3], 'Diorama ground terrain base.', 'Mặt sàn địa hình bên dưới.'),
      s('layer', 'Tấm cảnh phân tầng', 'Layered cutout', [3, 2], 'Layered scenic elements cutout with transparent alpha for parallax depth.', 'Tấm cảnh phân lớp xa/giữa/gần có alpha tạo chiều sâu.')
    ],
    assignFaceSlot: (name) => name.includes('Tường') ? 'wall' : (name.includes('Sàn') ? 'floor' : 'layer')
  }
}

/** Fallback automatic recipe builder for any arbitrary template. */
export function buildAutoRecipe(template: AssemblyTemplate): TemplateRecipeDefinition {
  const specs = template.faces()
  const slotMap = new Map<string, ImageMeshSlot>()
  const faceSlots: string[] = []

  specs.forEach((f, idx) => {
    const aspect = simplifyAspect(f.w, f.h)
    const key = `part_${aspect.join('x')}`
    if (!slotMap.has(key)) {
      const cleanName = f.name.replace(/\s*\d+$/, '').trim() || `Bộ phận ${idx + 1}`
      slotMap.set(key, s(
        key,
        cleanName,
        `Part ${idx + 1} (${f.w}x${f.h})`,
        aspect,
        `Orthographic texture surface for ${cleanName}, canvas ratio ${aspect.join(':')}, flat even diffuse lighting, no perspective, transparent outside surface bounds.`,
        `Ảnh bộ phận "${cleanName}" nhìn chính diện, tỉ lệ ${aspect.join(':')}, ánh sáng tán xạ đều không phối cảnh; nền trong suốt ngoài biên.`
      ))
    }
    faceSlots.push(key)
  })

  return {
    slots: Array.from(slotMap.values()),
    variants: STANDARD_VARIANTS,
    assignFaceSlot: (_name, idx) => faceSlots[idx] || slotMap.keys().next().value || 'main'
  }
}

/** Enriches a single template so it always has imageRecipe and face imageSlot bindings. */
export function enrichTemplateWithRecipe(template: AssemblyTemplate): AssemblyTemplate {
  if (template.imageRecipe && template.imageRecipe.slots.length > 0) {
    return template
  }

  const def = RECIPES[template.id] || buildAutoRecipe(template)
  const variants = def.variants || STANDARD_VARIANTS
  const recipe: ImageMeshRecipe = { slots: def.slots, variants }

  return {
    ...template,
    imageRecipe: recipe,
    faces: () => template.faces().map((faceSpec, idx) => {
      if (faceSpec.imageSlot) return faceSpec
      const slotId = def.assignFaceSlot ? def.assignFaceSlot(faceSpec.name, idx, faceSpec) : def.slots[0]?.id
      return { ...faceSpec, imageSlot: slotId }
    })
  }
}

/** Enriches all templates in the catalogue to guarantee 100% MCP & UI recipe coverage. */
export function enrichAllTemplatesWithRecipes(templates: AssemblyTemplate[]): AssemblyTemplate[] {
  return templates.map((t) => enrichTemplateWithRecipe(t))
}
