import type { AssemblyTemplate, TemplateFaceSpec } from './assemblyTemplateKit'
import type { ImageMeshRecipe, ImageMeshSlot, ImageMeshVariant } from './imageMeshTypes'
import { exactAspect, fitRecipeToGeometry, SURFACE_SYMMETRY } from './templateRecipeGeometry'

export const STANDARD_VARIANTS: ImageMeshVariant[] = [
  { id: 'standard', label: 'Tiêu chuẩn', en: 'Standard', scale: [1, 1, 1], bend: 1 },
  { id: 'slender', label: 'Nhỏ / cong nhẹ', en: 'Compact / gently curved', scale: [0.75, 0.75, 0.75], bend: 0.7 },
  { id: 'wide', label: 'Lớn / cong rõ', en: 'Large / strongly curved', scale: [1.3, 1.3, 1.3], bend: 1.2 }
]

export function s(id: string, label: string, en: string, aspect: [number, number], prompt: string, guidance: string, alphaMode: ImageMeshSlot['alphaMode'] = 'opaque'): ImageMeshSlot {
  return { id, label, en, aspect, prompt, guidance, alphaMode, symmetry: SURFACE_SYMMETRY }
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
  return exactAspect(w, h)
}

interface TemplateRecipeDefinition {
  slots: ImageMeshSlot[]
  variants?: ImageMeshVariant[]
  assignFaceSlot?: (faceName: string, index: number, face: TemplateFaceSpec) => string
}

function includesName(name: string, text: string): boolean {
  return name.toLocaleLowerCase('vi').includes(text.toLocaleLowerCase('vi'))
}

const RECIPES: Record<string, TemplateRecipeDefinition> = {
  // Architecture shells
  'gable-house': {
    slots: [
      s('facade', 'Mặt tiền / đầu hồi', 'Gable facade', [3, 2], 'Orthographic Tudor gable facade, plaster with dark timber framing, roofline rising to apex. No perspective.', 'Mặt tiền nhà đầu hồi chữ A, tường trát vôi trắng và khung gỗ cổ điển, đỉnh mái dốc ở trên.'),
      s('side', 'Vách hông', 'Side wall', [4, 3], 'Orthographic side wall elevation, matching plaster and timber framing, rectangular edge to edge.', 'Vách tường hông nhìn thẳng, cùng cao độ và hoa văn nẹp gỗ với mặt tiền.'),
      s('roof', 'Mái dốc', 'Roof slope', [3, 2], 'Top-down orthographic terracotta roof tiles, clean repeating shingle pattern, edge to edge.', 'Mái ngói đất nung nhìn trực diện, phủ kín khung, không bóng đổ.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Mái') || includesName(name, 'Dốc') ? 'roof' : (includesName(name, 'Trái') || includesName(name, 'Phải') ? 'side' : 'facade')
  },
  'flat-house': {
    slots: [
      s('front', 'Mặt trước', 'Front facade', [4, 3], 'Orthographic building front facade, flat roofline at top, entrance door and windows.', 'Mặt trước nhà mái bằng nhìn chính diện.'),
      s('side', 'Vách hông', 'Side wall', [4, 3], 'Orthographic side wall, matching materials with front.', 'Vách tường hông nhìn chính diện.'),
      s('roof', 'Mái bằng', 'Flat roof', [4, 3], 'Top-down flat concrete or gravel rooftop plan view.', 'Mặt mái bằng phẳng nhìn thẳng từ trên xuống.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Trên') ? 'roof' : (includesName(name, 'Trái') || includesName(name, 'Phải') ? 'side' : 'front')
  },
  'shop-awning': {
    slots: [
      s('facade', 'Mặt tiền cửa hiệu', 'Shopfront facade', [3, 2], 'Traditional shopfront facade with display window and entrance door.', 'Mặt tiền cửa hiệu có cửa sổ trưng bày và cửa ra vào.'),
      s('side', 'Vách hông', 'Side wall', [4, 3], 'Plain shop side wall elevation.', 'Vách tường hông cửa hiệu.'),
      s('awning', 'Mái hiên bạt', 'Fabric awning', [3, 1], 'Flat rectangular striped fabric texture viewed perpendicular to the cloth, stripes running from image top (wall attachment) to bottom (outer edge). The mesh supplies the slope; do not paint a tilted awning or side flaps.', 'Vải bạt chữ nhật nhìn vuông góc, sọc từ mép trên gắn tường tới mép dưới; mesh tự tạo độ nghiêng, không vẽ cả mái hiên.'),
      s('roof', 'Mái trên', 'Flat roof', [4, 3], 'Flat upper rooftop plan view.', 'Mái bằng phía trên.')
    ],
    assignFaceSlot: (name) => includesName(name, 'hiên') ? 'awning' : (includesName(name, 'Trên') ? 'roof' : (includesName(name, 'Trái') || includesName(name, 'Phải') ? 'side' : 'facade'))
  },
  'tent': {
    slots: [
      s('gable', 'Cửa lều tam giác', 'Tent front opening', [1, 1], 'Flat triangular tent entrance, apex at (50%,0%), base from (0%,100%) to (100%,100%); transparent outside the triangle and through the entrance opening, canvas flaps tied back.', 'Cửa lều tam giác: đỉnh giữa mép trên, đáy kín chiều rộng mép dưới; alpha ngoài tam giác và trong lối vào.', 'cutout'),
      s('back', 'Vách sau lều', 'Tent rear wall', [1, 1], 'Flat closed triangular canvas tent rear wall, apex at (50%,0%), base from (0%,100%) to (100%,100%); opaque cloth inside, transparent outside the triangle.', 'Vách sau lều tam giác kín: đỉnh giữa mép trên, đáy kín mép dưới, chỉ alpha ngoài tam giác.', 'cutout'),
      s('canvas', 'Bạt lều dốc', 'Sloped tent canvas', [3, 2], 'Flat rectangular canvas fabric texture, edge to edge. The mesh supplies the roof slope; do not paint a complete tent.', 'Tấm vải bạt chữ nhật phẳng kín mép, mesh tự tạo độ nghiêng, không vẽ cả lều.')
    ],
    assignFaceSlot: (name) => includesName(name, 'sau') ? 'back' : (includesName(name, 'Dốc') ? 'canvas' : 'gable')
  },
  'shell-walls': {
    slots: [
      s('front', 'Mặt trước / sau', 'Front / back wall', [7, 4], 'Long masonry wall elevation, limestone or brick finish, no roof.', 'Vách tường dài trước và sau, khối đá hoặc gạch trần.'),
      s('side', 'Vách hông', 'Side wall', [5, 4], 'Short masonry side wall elevation, matching finish.', 'Vách tường hông ngắn bên trái và phải.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Trái') || includesName(name, 'Phải') ? 'side' : 'front'
  },
  'shell-two-storey': {
    slots: [
      s('facade', 'Mặt tiền 2 tầng', 'Two-storey gable facade', [3, 4], 'Two-storey orthographic gable facade, upper floor overhang, timber and plaster.', 'Mặt tiền 2 tầng đầu hồi chữ A cao ráo, nẹp gỗ cổ điển.'),
      s('side', 'Vách hông 2 tầng', 'Two-storey side wall', [4, 5], 'Two-storey side wall elevation, matching floor heights and materials.', 'Vách tường hông 2 tầng, ăn khớp cao độ với mặt tiền.'),
      s('roof', 'Mái dốc', 'Roof slope', [3, 2], 'Terracotta tile roof slope, clean shingle rows.', 'Mái ngói dốc nhìn thẳng.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Mái') || includesName(name, 'Dốc') ? 'roof' : (includesName(name, 'Trái') || includesName(name, 'Phải') ? 'side' : 'facade')
  },
  'shell-hip-roof': {
    slots: [
      s('front', 'Vách trước / sau', 'Front/back wall', [7, 4], 'Orthographic house wall elevation.', 'Mặt tường trước và sau.'),
      s('side', 'Vách hông', 'Side wall', [5, 4], 'Orthographic side wall elevation.', 'Vách tường hông bên trái và phải.'),
      s('roof', 'Mái dốc 4 phía', 'Hip roof slope', [5, 3], 'Sloped roof tiles texture, trapezoidal/triangular framing.', 'Mái ngói nghiêng 4 phía quanh nhà.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Mái') ? 'roof' : (includesName(name, 'Trái') || includesName(name, 'Phải') ? 'side' : 'front')
  },
  'shell-shed-roof': {
    slots: [
      s('front', 'Vách trước cao', 'High front wall', [5, 3], 'High front elevation of modern shed-roof house.', 'Vách tường trước cao của nhà mái dốc một phía.'),
      s('back', 'Vách sau thấp', 'Low back wall', [5, 2], 'Low rear wall elevation.', 'Vách tường sau thấp.'),
      s('side', 'Vách hông xiên', 'Sloped side wall', [4, 3], 'Side wall with sloped top matching roof pitch.', 'Vách tường hông có mép trên vát chéo.'),
      s('roof', 'Mái dốc', 'Mono-pitch roof', [5, 3], 'Single sloped metal or shingle roof.', 'Mái ngói hoặc tôn dốc một phía.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Mái') ? 'roof' : (includesName(name, 'Sau') ? 'back' : (includesName(name, 'Trái') || includesName(name, 'Phải') ? 'side' : 'front'))
  },
  'shell-l-shaped': {
    slots: [
      s('facade_main', 'Đầu hồi chính', 'Main gable facade', [3, 2], 'Main wing gable facade elevation.', 'Mặt đầu hồi khối nhà chính.'),
      s('facade_wing', 'Đầu hồi cánh phụ', 'Wing gable facade', [3, 2], 'Wing gable facade elevation.', 'Mặt đầu hồi khối nhà nhánh chữ L.'),
      s('wall', 'Vách tường hông', 'Side wall', [4, 3], 'Plain exterior masonry wall.', 'Vách tường phẳng xung quanh.'),
      s('roof', 'Mái ngói', 'Roof slope', [3, 2], 'Terracotta roof tiles for L-shape intersection.', 'Mái ngói dốc giao nhau.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Mái') || includesName(name, 'Dốc') ? 'roof' : (includesName(name, 'Cánh') ? 'facade_wing' : (includesName(name, 'Trước') ? 'facade_main' : 'wall'))
  },
  'shell-barn': {
    slots: [
      s('facade', 'Mặt tiền chuồng trại', 'Barn gable facade', [4, 3], 'Red gambrel barn gable facade with sliding double doors.', 'Mặt tiền chuồng trại mái vòm gãy gập, cửa gỗ lớn.'),
      s('side', 'Vách hông chuồng trại', 'Barn side wall', [5, 3], 'Vertical red barn wood plank siding.', 'Vách tường hông ván gỗ đỏ thẳng đứng.'),
      s('roof_lower', 'Mái dốc dưới', 'Lower steep roof', [3, 1], 'Steep lower gambrel roof slope.', 'Mái dốc dưới có độ nghiêng lớn.'),
      s('roof_upper', 'Mái dốc trên', 'Upper shallow roof', [3, 1], 'Shallow upper gambrel roof slope.', 'Mái dốc trên thoải đỉnh mái.')
    ],
    assignFaceSlot: (name) => includesName(name, 'trên') ? 'roof_upper' : (includesName(name, 'dưới') ? 'roof_lower' : (includesName(name, 'Trái') || includesName(name, 'Phải') ? 'side' : 'facade'))
  },
  'shell-tower-hex': {
    slots: [
      s('wall', 'Vách tháp 6 mặt', 'Tower wall facet', [1, 3], 'Single vertical stone tower facet, aged masonry blocks.', 'Một vách đá thẳng đứng trong 6 cạnh tháp lục giác.'),
      s('spire', 'Mái chóp nhọn', 'Tower spire facet', [1, 2], 'Pointed slate roof spire triangle facet.', 'Một mặt mái ngói đá chóp nhọn đỉnh tháp.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Chóp') || includesName(name, 'Mái') ? 'spire' : 'wall'
  },

  // Decor parts
  'window-shuttered': {
    slots: [
      s('window', 'Mặt kính', 'Window glass', [2, 3], 'Window frame with glass panes, transparent alpha outside.', 'Mặt kính cửa sổ và khung viền, nền trong suốt.', 'cutout'),
      s('frame', 'Khung trên / bậu', 'Lintel / sill', [6, 1], 'Carved stone or timber lintel beam.', 'Khung dầm trên hoặc gờ đá bậu cửa.'),
      s('shutter', 'Cánh cửa sổ mở', 'Window shutter', [1, 3], 'Single wooden window shutter with louvers, transparent outside.', 'Cánh cửa sổ chớp gỗ mở nghiêng hai bên.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'Cánh') ? 'shutter' : (includesName(name, 'Khung') || includesName(name, 'Bậu') ? 'frame' : 'window')
  },
  'window-bay': {
    slots: [
      s('glass', 'Tấm kính lồi', 'Bay window glass', [1, 2], 'Single vertical bay window pane with wooden frame.', 'Mặt kính cửa sổ lồi vát góc.'),
      s('roof', 'Mái che lồi', 'Bay window roof', [2, 1], 'Flat copper or shingle roof surface viewed from above; no complete window or raised roof.', 'Bề mặt mái ngói hoặc kim loại nhìn từ trên; không vẽ cả cửa sổ.'),
      s('bottom', 'Mặt đáy cửa sổ', 'Bay window underside', [2, 1], 'Flat opaque painted wood or plaster underside panel, edge to edge.', 'Tấm đáy gỗ sơn hoặc vữa đục, phủ kín mép.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Đáy') ? 'bottom' : (includesName(name, 'Mái') ? 'roof' : 'glass')
  },
  'door-arched': {
    slots: [
      s('door', 'Cánh cửa vòm', 'Arched door leaf', [1, 2], 'Arched solid wooden door with iron hinges, transparent outside.', 'Cánh cửa vòm gỗ sồi cổ điển, bản lề sắt, nền trong suốt.', 'cutout'),
      s('arch', 'Vòm đá cuốn', 'Stone arch surround', [3, 2], 'Carved stone arch entryway surround with alpha opening.', 'Khung vòm cuốn đá bao quanh cửa.', 'cutout'),
      s('step', 'Bậc thềm đá', 'Stone entrance step', [5, 1], 'Aged stone threshold step, top and front.', 'Bậc thềm đá bước vào cửa.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Vòm') ? 'arch' : (includesName(name, 'Bậc') ? 'step' : 'door')
  },
  'door-cottage': {
    slots: [
      s('door', 'Cánh cửa gỗ mộc', 'Plank cottage door', [1, 2], 'Rustic timber door with diagonal brace and iron latch.', 'Cánh cửa gỗ mộc có nẹp chéo và chốt sắt.'),
      s('frame', 'Khung bao', 'Door frame surround', [1, 2], 'Timber door frame surround.', 'Khung bao nẹp gỗ quanh cửa.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Khung') || includesName(name, 'Nẹp') ? 'frame' : 'door'
  },
  'chimney': {
    slots: [
      s('brick', 'Thân ống khói', 'Chimney shaft', [1, 3], 'Red brick chimney masonry texture, vertical seamless.', 'Thân ống khói gạch đỏ liền mạch.'),
      s('cap', 'Mặt nắp đá', 'Stone chimney cap top', [1, 1], 'Flat square stone chimney cap surface viewed from above, edge to edge, no chimney shaft or pot.', 'Mặt nắp đá vuông nhìn từ trên, kín mép, không vẽ cả ống khói.'),
      s('rim', 'Viền nắp đá', 'Stone chimney cap rim', [3, 1], 'Flat narrow horizontal stone cap rim elevation, edge to edge.', 'Mặt đứng dải viền nắp đá hẹp, phủ kín mép.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Viền nắp') ? 'rim' : (includesName(name, 'Nắp trên') ? 'cap' : 'brick')
  },
  'chimney-tall': {
    slots: [
      s('brick', 'Thân ống khói cao', 'Tall chimney shaft', [1, 5], 'Tall slender red brick chimney shaft.', 'Thân ống khói gạch đỏ cao vút.'),
      s('cap', 'Mũ đá & ống gốm', 'Cap & pot', [1, 2], 'Stone chimney crown with terracotta pots.', 'Mũ đá và ống gốm thoát khói.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Thân') ? 'brick' : 'cap'
  },
  'flower-box': {
    slots: [
      s('box', 'Vách bồn gỗ', 'Wooden planter box', [4, 1], 'Weathered wooden planter box panel.', 'Vách hộp bồn hoa gỗ sồi treo tường.'),
      s('soil', 'Mặt đất trong bồn', 'Planter soil', [4, 1], 'Top-down flat dark potting soil texture, opaque edge to edge, no planter rim or plants.', 'Đất trồng nhìn từ trên, kín mép, không vẽ viền bồn hay cây.'),
      s('flowers', 'Hoa lá rực rỡ', 'Flowers & trailing ivy', [4, 2], 'Blooms and trailing green ivy with transparent alpha.', 'Khóm hoa ban công rực rỡ và lá rủ nền trong suốt.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'đất') ? 'soil' : (includesName(name, 'Hoa') || includesName(name, 'Lá') ? 'flowers' : 'box')
  },
  'balcony-wood': {
    slots: [
      s('floor', 'Sàn gỗ ban công', 'Balcony deck', [3, 1], 'Wooden plank balcony floor deck.', 'Mặt sàn gỗ ban công nhìn từ trên.'),
      s('railing', 'Lan can gỗ', 'Baluster railing', [3, 1], 'Carved wooden balcony railing with transparent gaps.', 'Lan can con tiện gỗ có khoảng hở alpha.', 'cutout'),
      s('bracket', 'Con sơn đỡ', 'Support bracket', [1, 1], 'Carved decorative wooden corbel bracket.', 'Con sơn gỗ đỡ đáy ban công.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Lan can') ? 'railing' : (includesName(name, 'Sơn') || includesName(name, 'Đỡ') ? 'bracket' : 'floor')
  },
  'column-stone': {
    slots: [
      s('shaft', 'Thân cột đá', 'Column shaft', [1, 6], 'Classical stone column shaft with subtle fluting.', 'Thân cột đá hình trụ tròn có rãnh khía thanh mảnh.'),
      s('capital', 'Đầu / đế cột', 'Column capital & base', [1, 1], 'Carved Corinthian or Tuscan stone column capital.', 'Đầu cột và chân đế hoa văn đá.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Thân') ? 'shaft' : 'capital'
  },
  'sign-hanging': {
    slots: [
      s('board', 'Biển hiệu 2 mặt', 'Double-sided sign board', [3, 2], 'Painted wooden hanging tavern/shop sign board, ornate edges.', 'Bảng hiệu gỗ treo hai mặt phong cách châu Âu.'),
      s('bracket', 'Giá sắt rèn', 'Wrought iron bracket', [1, 1], 'Decorative scrollwork wrought iron hanging bracket with alpha.', 'Giá sắt rèn hoa văn uốn lượn nền trong suốt.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'Khung') || includesName(name, 'Giá') ? 'bracket' : 'board'
  },
  'awning-striped': {
    slots: [
      s('canopy', 'Bạt che sọc màu', 'Striped awning fabric', [2, 1], 'Sloped fabric awning with alternating colored stripes.', 'Bạt che mái hiên sọc màu xen kẽ.'),
      s('valance', 'Yếm rủ lượn sóng', 'Scalloped valance', [4, 1], 'Scalloped fabric valance rim with fringe.', 'Yếm bạt rủ viền gợn sóng phía trước.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Yếm') ? 'valance' : 'canopy'
  },
  'fence-picket': {
    slots: [
      s('picket', 'Hàng rào cọc gỗ', 'Picket fence panel', [3, 1], 'White wooden pointed picket fence section with real transparent alpha between slats.', 'Hàng rào cọc gỗ nhọn màu trắng có khoảng trống alpha giữa các nan.', 'cutout')
    ],
    assignFaceSlot: () => 'picket'
  },

  // Props & cylinders
  'cylinder-4': {
    slots: [
      s('panel', 'Mảnh vách cong 90°', 'Curved quadrant panel', [1, 2], 'Flat unwrapped brick, metal or bark texture, opaque edge to edge, matching left/right edges for repetition. Do not depict a cylinder or curvature; the mesh bends this panel by 90 degrees.', 'Vật liệu phẳng trải UV kín mép, hai mép trái/phải khớp lặp; mesh tự uốn 90 độ, không vẽ khối trụ.')
    ],
    assignFaceSlot: () => 'panel'
  },
  'cylinder-6': {
    slots: [
      s('panel', 'Mảnh vách cong 60°', 'Curved sextant panel', [1, 2], 'Flat unwrapped cylinder material texture, opaque edge to edge, matching left/right edges. No cylindrical silhouette or baked curvature; the mesh supplies the 60-degree bend.', 'Vật liệu phẳng trải UV kín mép, khớp hai mép trái/phải; mesh tự uốn 60 độ, không vẽ bóng khối trụ.')
    ],
    assignFaceSlot: () => 'panel'
  },
  'cylinder-8': {
    slots: [
      s('panel', 'Mảnh vách cong 45°', 'Curved octant panel', [1, 2], 'Flat unwrapped tower material texture, opaque edge to edge, matching left/right edges. No tower silhouette or baked curvature; the mesh supplies the 45-degree bend.', 'Vật liệu tháp trải phẳng kín mép, khớp hai mép trái/phải; mesh tự uốn 45 độ, không vẽ cả tháp.')
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
    assignFaceSlot: (name) => includesName(name, 'Trên') ? 'top' : 'side'
  },
  'cube-3': {
    slots: [
      s('face', 'Mặt khối lập phương', 'Cube face', [1, 1], 'Square cubic facet texture.', 'Mặt vuông của khối lập phương.')
    ],
    assignFaceSlot: () => 'face'
  },
  'bench': {
    slots: [
      s('seat', 'Mặt ngồi ghế', 'Bench seat slats', [4, 1], 'Orthographic top-down wooden bench seat slats surface, no legs or backrest.', 'Mặt ngồi nan gỗ ghế băng nhìn từ trên, không chân hay tựa lưng.'),
      s('back', 'Tựa lưng ghế', 'Bench backrest', [4, 1], 'Wooden bench backrest panel.', 'Tựa lưng ghế băng gỗ.'),
      s('apron', 'Yếm trước ghế', 'Bench front apron', [4, 1], 'Flat narrow horizontal wooden bench apron plank, front elevation, opaque edge to edge.', 'Dải ván yếm trước ghế nhìn chính diện, phủ kín mép.'),
      s('leg', 'Chân ghế đá / sắt', 'Bench support leg', [1, 1], 'Ornate iron or stone bench leg with transparent alpha.', 'Chân ghế băng đúc sắt hoặc đá có alpha.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'ngồi') ? 'seat' : (includesName(name, 'tựa') ? 'back' : (includesName(name, 'Yếm') ? 'apron' : 'leg'))
  },
  'street-lamp': {
    slots: [
      s('pole', 'Thân cột sắt', 'Lamp pole', [1, 8], 'Dark cast iron lamppost column, vertical straight.', 'Thân cột đèn đường sắt rèn thẳng đứng.'),
      s('lantern', 'Một vách lồng đèn', 'Single lantern wall panel', [1, 1], 'One flat rectangular Victorian lantern glass pane with thin iron frame at the edges, warm glass rendered opaque, no entire lantern or perspective.', 'Một mặt kính chữ nhật có khung sắt mỏng quanh mép, kính màu ấm đục, không vẽ cả đèn hay phối cảnh.'),
      s('cap', 'Nắp lồng đèn', 'Lantern top cap', [1, 1], 'Flat square dark iron lantern lid texture viewed from above, opaque edge to edge, no glass pane.', 'Nắp sắt vuông nhìn từ trên, đục kín mép, không kính.')
    ],
    assignFaceSlot: (name) => includesName(name, 'trên') ? 'cap' : (includesName(name, 'lồng') || includesName(name, 'đèn') ? 'lantern' : 'pole')
  },
  'signpost': {
    slots: [
      s('board', 'Biển chỉ hướng', 'Signboard', [3, 1], 'Pointed wooden direction sign board with text or arrow.', 'Bảng chỉ dẫn bằng gỗ có mũi tên chỉ đường.'),
      s('post', 'Cột gỗ đứng', 'Wooden post', [1, 8], 'Square or round vertical wooden post.', 'Cột gỗ đứng cắm biển báo.')
    ],
    assignFaceSlot: (name) => includesName(name, 'bảng') || includesName(name, 'Biển') ? 'board' : 'post'
  },
  'market-stall': {
    slots: [
      s('counter', 'Quầy hàng gỗ', 'Market counter', [3, 2], 'Wooden market stall counter with rustic planks.', 'Quầy hàng chợ bằng ván gỗ mộc.'),
      s('roof', 'Mái bạt sạp chợ', 'Stall canopy roof', [3, 2], 'Flat rectangular striped canvas surface viewed perpendicular to the fabric, stripes running image top to bottom. Geometry supplies the slope; no complete canopy or stall.', 'Vải bạt sọc chữ nhật nhìn vuông góc, sọc dọc ảnh; mesh tạo độ nghiêng, không vẽ cả mái hay sạp.'),
      s('pole', 'Cột chống', 'Support poles', [1, 8], 'Wooden support poles.', 'Cột chống đỡ mái sạp.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Mái') ? 'roof' : (includesName(name, 'Quầy') ? 'counter' : 'pole')
  },

  // Nature
  'tree-cross': {
    slots: [
      s('trunk', 'Thân cây gỗ', 'Tree trunk', [1, 5], 'Single straight tree trunk front elevation, centered vertical bark silhouette reaching top and bottom edges; transparent beside the trunk, no foliage or ground.', 'Một thân cây nhìn thẳng ở giữa ảnh, chạm mép trên/dưới, alpha hai bên; không có tán hay đất.', 'cutout'),
      s('canopy', 'Tán lá mặt đứng', 'Vertical canopy foliage', [1, 1], 'Front orthographic dense tree canopy foliage clump, rich greens, transparent alpha around leaf edges, no trunk, ground or sky.', 'Tán lá nhìn chính diện, viền lá alpha, không có thân, đất hay bầu trời.', 'cutout'),
      s('canopy_top', 'Tán lá nhìn từ trên', 'Top-view canopy foliage', [1, 1], 'Orthographic overhead view of a dense leafy tree crown, approximately circular centered silhouette, transparent alpha around leaf edges, no visible trunk, ground or sky.', 'Tán cây nhìn thẳng từ trên, đường viền gần tròn giữa ảnh, alpha ngoài lá, không thân, đất hay bầu trời.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'Thân') || includesName(name, 'Trụ') ? 'trunk' : (includesName(name, 'vòm') ? 'canopy_top' : 'canopy')
  },
  'bush-3': {
    slots: [
      s('foliage', 'Cụm lá bụi cây', 'Bush foliage clump', [1, 1], 'Front orthographic dense bush foliage clump with leaf details, transparent alpha outside, no ground.', 'Cụm lá bụi nhìn chính diện, viền lá alpha, không có đất.', 'cutout'),
      s('foliage_top', 'Mặt nóc bụi cây', 'Bush top foliage', [1, 1], 'Orthographic overhead dense bush foliage, organic oval silhouette, transparent alpha outside leaf edges, no ground.', 'Bụi cây nhìn từ trên, viền bầu dục tự nhiên, alpha ngoài lá, không đất.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'nóc') ? 'foliage_top' : 'foliage'
  },
  'foliage-layers': {
    slots: [
      s('layer', 'Tấm tán lá phân lớp', 'Foliage branch layer', [3, 2], 'Natural leafy branch spreading horizontally, transparent alpha for layered parallax depth.', 'Cành lá cây trải ngang tự nhiên nền trong suốt để tạo lớp parallax.', 'cutout')
    ],
    assignFaceSlot: () => 'layer'
  },
  'ground-patch': {
    slots: [
      s('ground', 'Mặt đất / sỏi', 'Ground earth surface', [1, 1], 'Top-down natural grass and soil texture patch.', 'Mặt đất vườn hoặc sỏi đá nhìn từ trên.'),
      s('edge', 'Viền cây cỏ mép', 'Grass edge rim', [3, 1], 'Front horizontal grass rim cutout with alpha.', 'Viền ngọn cỏ mép trước tách nền alpha.', 'cutout'),
      s('bush', 'Bụi cây phía sau', 'Rear bushes', [3, 1], 'Front orthographic row of low leafy bushes, base anchored at image bottom, transparent alpha above and between leaves, no ground.', 'Hàng bụi cây thấp nhìn thẳng, gốc chạm mép dưới, alpha phía trên và khe lá, không đất.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'Đất') ? 'ground' : (includesName(name, 'Bụi') ? 'bush' : 'edge')
  },
  'flower-patch': {
    slots: [
      s('ground', 'Đất nền sân vườn', 'Garden soil ground', [1, 1], 'Top-down soil patch.', 'Mặt đất sân vườn nhìn từ trên.'),
      s('flower', 'Khóm hoa nở xòe', 'Blooming flower clump', [1, 1], 'Multi-directional blooming garden flower cluster with leaves, transparent alpha.', 'Khóm hoa nở rực rỡ nhiều hướng tách nền trong suốt.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'Đất') ? 'ground' : 'flower'
  },
  'hedge': {
    slots: [
      s('front', 'Vách bờ rào xén tỉa', 'Boxwood hedge side', [3, 1], 'Dense clipped green boxwood hedge surface.', 'Vách bờ rào cây xanh cắt tỉa vuông vắn.'),
      s('top', 'Mặt trên bờ rào', 'Hedge curved top', [3, 1], 'Curved wavy top surface of clipped garden hedge.', 'Mặt trên bờ rào uốn cong mềm mại.')
    ],
    assignFaceSlot: (name) => includesName(name, 'nóc') ? 'top' : 'front'
  },

  // Stage
  'room-open': {
    slots: [
      s('floor', 'Sàn phòng', 'Room floor', [4, 3], 'Top-down interior parquet wood or tile floor plan.', 'Mặt sàn gỗ nội thất nhìn từ trên.'),
      s('wall_back', 'Tường chính diện', 'Back wall', [4, 3], 'Interior back room wall with wallpaper or paint finish.', 'Mặt tường phòng chính diện phía sau.'),
      s('wall_side', 'Tường hông', 'Side wall', [3, 3], 'Interior side wall elevation.', 'Mặt tường hông bên trái và phải.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Sàn') ? 'floor' : (includesName(name, 'trái') || includesName(name, 'phải') ? 'wall_side' : 'wall_back')
  },
  'street-corner': {
    slots: [
      s('facade_a', 'Mặt tiền phố A', 'Street facade A', [3, 4], 'Historic street corner shop facade A.', 'Mặt tiền dãy phố thứ nhất.'),
      s('facade_b', 'Mặt tiền phố B', 'Street facade B', [3, 4], 'Historic street corner facade B.', 'Mặt tiền dãy phố thứ hai vuông góc.'),
      s('pavement', 'Vỉa hè góc phố', 'Cobblestone pavement', [3, 3], 'Sidewalk cobblestone street pavement from above.', 'Mặt vỉa hè lát đá góc phố nhìn từ trên.')
    ],
    assignFaceSlot: (name) => includesName(name, 'hè') ? 'pavement' : (includesName(name, 'trước') ? 'facade_a' : 'facade_b')
  },
  'cyclorama': {
    slots: [
      s('floor', 'Sàn studio', 'Studio floor', [3, 2], 'Seamless photography studio floor.', 'Sàn studio chụp ảnh vô cực.'),
      s('cove', 'Góc bo cong 45°', 'Cove sweep', [3, 1], 'Curved cove sweep transition.', 'Mép chuyển tiếp bo cong 45 độ.'),
      s('backdrop', 'Phông nền đứng', 'Upright backdrop', [3, 2], 'Upright seamless infinite backdrop wall.', 'Phông đứng vô cực studio.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Sàn') ? 'floor' : (includesName(name, 'Góc') ? 'cove' : 'backdrop')
  },
  'diorama': {
    slots: [
      s('wall', 'Tường hậu cảnh', 'Back diorama wall', [4, 3], 'Sky or distant panorama backdrop.', 'Phông nền bầu trời hoặc cảnh xa phía sau.'),
      s('floor', 'Sàn diorama', 'Diorama ground', [4, 3], 'Diorama ground terrain base.', 'Mặt sàn địa hình bên dưới.'),
      s('layer', 'Tấm cảnh phân tầng', 'Layered cutout', [3, 2], 'Layered scenic elements cutout with transparent alpha for parallax depth.', 'Tấm cảnh phân lớp xa/giữa/gần có alpha tạo chiều sâu.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'Tường') ? 'wall' : (includesName(name, 'Sàn') ? 'floor' : 'layer')
  }
}

/** Fallback automatic recipe builder for any arbitrary template. */
export function buildAutoRecipe(template: AssemblyTemplate): TemplateRecipeDefinition {
  const specs = template.faces()
  const slotMap = new Map<string, ImageMeshSlot>()
  const faceSlots: string[] = []

  specs.forEach((f, idx) => {
    const aspect = simplifyAspect(f.w, f.h)
    const key = `part_${idx + 1}`
    if (!slotMap.has(key)) {
      const cleanName = f.name.replace(/\s*\d+$/, '').trim() || `Bộ phận ${idx + 1}`
      slotMap.set(key, s(
        key,
        cleanName,
        `Part ${idx + 1} (${f.w}x${f.h})`,
        aspect,
        `One flat surface for ${template.en.label}, part ${idx + 1} named "${f.name}". Canvas ratio ${aspect.join(':')}. Surface normal ${JSON.stringify(f.n)}, image-up ${JSON.stringify(f.up ?? [0, 1, 0])} in assembly coordinates. Depict only this surface, not the entire object. Fill its rectangular canvas with material; review the template geometry before using a non-rectangular cutout.`,
        `Ảnh riêng cho "${f.name}" của ${template.label}, tỷ lệ ${aspect.join(':')}. Chỉ vẽ bề mặt này phủ kín canvas; kiểm tra hình học trước khi dùng đường viền khác chữ nhật.`
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
  const boundFaces = template.faces().map((f, idx) => ({ ...f,
    imageSlot: f.imageSlot ?? def.assignFaceSlot?.(f.name, idx, f) ?? def.slots[0]?.id
  }))
  const fitted = fitRecipeToGeometry(template, def.slots, boundFaces)
  const recipe: ImageMeshRecipe = { slots: fitted.slots, variants }

  return {
    ...template,
    imageRecipe: recipe,
    faces: () => template.faces().map((f, idx) => ({ ...f, imageSlot: fitted.faces[idx].imageSlot }))
  }
}

/** Enriches all templates in the catalogue to guarantee 100% MCP & UI recipe coverage. */
export function enrichAllTemplatesWithRecipes(templates: AssemblyTemplate[]): AssemblyTemplate[] {
  return templates.map((t) => enrichTemplateWithRecipe(t))
}
