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
  'shell-l-house': {
    slots: [
      s('facade', 'Mặt trước cánh nhà', 'Front wing wall', [1, 1], 'Orthographic house wing front wall elevation, plaster and timber or masonry, edge to edge.', 'Vách tường mặt trước cánh chính hoặc cánh nhô nhìn thẳng.'),
      s('side', 'Vách hông & sau', 'Side / rear wall', [3, 2], 'Orthographic exterior house wall elevation, matching plaster or brick finish, edge to edge.', 'Vách tường hông và mặt sau đồng bộ chất liệu.'),
      s('roof', 'Mái bằng', 'Flat roof slab', [3, 2], 'Top-down flat roof terrace or gravel surface, opaque edge to edge.', 'Mặt mái bằng nhìn thẳng từ trên xuống.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Mái') ? 'roof' : (includesName(name, 'Trước') ? 'facade' : 'side')
  },
  'shell-townhouse': {
    slots: [
      s('facade', 'Mặt tiền / sau 3 tầng', '3-storey townhouse facade', [16, 45], 'Tall 3-storey narrow urban townhouse facade elevation, aligned floor bands, opaque edge to edge.', 'Mặt đứng nhà phố 3 tầng cao hẹp nhìn trực diện, chia tầng rõ ràng.'),
      s('side', 'Tường hông nhà ống', 'Townhouse side wall', [2, 3], 'Plain tall side party-wall elevation, stucco or brick finish, opaque edge to edge.', 'Vách tường hông nhà ống phẳng kín mép.'),
      s('roof', 'Mái thượng', 'Townhouse flat roof', [8, 15], 'Top-down flat concrete rooftop terrace surface, opaque edge to edge.', 'Mặt mái bằng sân thượng nhìn từ trên xuống.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Trên') ? 'roof' : (includesName(name, 'Trái') || includesName(name, 'Phải') ? 'side' : 'facade')
  },
  'shell-spire-tower': {
    slots: [
      s('wall', 'Vách thân tháp vuông', 'Square tower wall', [3, 7], 'Vertical stone or brick tower wall elevation, seamless masonry courses, opaque edge to edge.', 'Vách thân tháp vuông bằng đá hoặc gạch cổ nhìn thẳng.'),
      s('spire', 'Mái chóp nhọn tam giác', 'Triangular spire facet', [1, 1], 'Single triangular slate or shingle spire roof facet, apex at top center, base spanning bottom edge, transparent outside.', 'Một mặt mái chóp tam giác ngói đá, đỉnh ở giữa mép trên, đáy kín mép dưới.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'Mái') ? 'spire' : 'wall'
  },
  'tower-8': {
    slots: [
      s('wall', 'Mảnh vách tháp bát giác', 'Octagonal tower facet', [1, 3], 'Single flat vertical stone masonry facet for an 8-sided tower, horizontally tileable left-to-right, opaque edge to edge.', 'Một vách đá thẳng đứng của tháp bát giác, hai mép trái/phải khớp nối lặp lại.')
    ],
    assignFaceSlot: () => 'wall'
  },
  'gate': {
    slots: [
      s('pillar', 'Trụ cổng đứng', 'Gate pillar', [11, 52], 'Vertical carved stone or wooden gate pillar front elevation, opaque edge to edge.', 'Trụ cổng thẳng đứng nhìn chính diện.'),
      s('sign', 'Bảng tên cổng chào', 'Gate signboard', [76, 15], 'Horizontal ornate welcome gate plaque or banner with decorative border, opaque edge to edge.', 'Bảng tên ngang gắn trên cổng chào.'),
      s('roof', 'Mái cổng nghiêng', 'Gate canopy roof', [84, 17], 'Top-down traditional tile or metal gate canopy roof surface, opaque edge to edge.', 'Bề mặt mái che cổng nhìn vuông góc.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Mái') ? 'roof' : (includesName(name, 'Bảng') ? 'sign' : 'pillar')
  },
  'stairs': {
    slots: [
      s('riser', 'Cổ bậc đứng', 'Step riser', [50, 9], 'Horizontal stone or wood stair riser front strip, opaque edge to edge.', 'Mặt đứng cổ bậc cầu thang phủ kín mép.'),
      s('tread', 'Mặt bậc ngang', 'Step tread', [50, 11], 'Top-down stone or wood stair tread slab surface, opaque edge to edge.', 'Mặt bậc cầu thang nhìn từ trên xuống.')
    ],
    assignFaceSlot: (name) => includesName(name, 'mặt') ? 'tread' : 'riser'
  },
  'pyramid': {
    slots: [
      s('face', 'Mặt tam giác kim tự tháp', 'Pyramid triangular face', [1, 1], 'Flat triangular sandstone block pyramid face, apex at (50%,0%), base from (0%,100%) to (100%,100%), transparent outside the triangle.', 'Mặt tam giác đá sa thạch kim tự tháp: đỉnh giữa mép trên, đáy kín mép dưới, ngoài tam giác trong suốt.', 'cutout')
    ],
    assignFaceSlot: () => 'face'
  },

  // Decor parts
  'window-shuttered': {
    slots: [
      s('window', 'Mặt kính', 'Window glass', [2, 3], 'Window frame with glass panes, transparent alpha outside.', 'Mặt kính cửa sổ và khung viền, nền trong suốt.', 'cutout'),
      s('frame', 'Khung trên / bậu', 'Lintel / sill', [6, 1], 'Carved stone or timber lintel beam, opaque edge to edge.', 'Khung dầm trên hoặc gờ đá bậu cửa.'),
      s('shutter', 'Cánh cửa sổ mở', 'Window shutter', [1, 3], 'Single wooden window shutter with louvers, transparent outside.', 'Cánh cửa sổ chớp gỗ mở nghiêng hai bên.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'Cánh') ? 'shutter' : (includesName(name, 'Khung') || includesName(name, 'Bậu') ? 'frame' : 'window')
  },
  'window-bay': {
    slots: [
      s('glass', 'Tấm kính lồi', 'Bay window glass', [1, 2], 'Single vertical bay window pane with wooden mullion frame.', 'Mặt kính cửa sổ lồi có khung gỗ.'),
      s('roof', 'Mái che lồi', 'Bay window roof', [4, 1], 'Flat copper or shingle roof surface viewed from above; no complete window or raised roof.', 'Bề mặt mái ngói hoặc đồng nhìn từ trên; không vẽ cả cửa sổ.'),
      s('bottom', 'Mặt đáy cửa sổ', 'Bay window underside', [4, 1], 'Flat opaque painted wood or plaster underside panel, edge to edge.', 'Tấm đáy gỗ sơn hoặc vữa đục, phủ kín mép.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Đáy') ? 'bottom' : (includesName(name, 'Mái') ? 'roof' : 'glass')
  },
  'door-canopy': {
    slots: [
      s('door', 'Cánh cửa chính', 'Front door leaf', [11, 20], 'Orthographic wooden front entrance door with panelling and handle, opaque edge to edge.', 'Cánh cửa gỗ ra vào nhìn chính diện.'),
      s('frame', 'Khung bao cửa', 'Door frame trim', [1, 14], 'Flat painted timber or stone door casing trim bar, opaque edge to edge.', 'Thanh nẹp khung bao quanh cửa.'),
      s('step', 'Bậc thềm cửa', 'Doorstep slab', [4, 1], 'Flat stone doorstep slab surface, opaque edge to edge.', 'Bậc thềm đá trước cửa.'),
      s('canopy', 'Mái che cửa', 'Door canopy slope', [8, 3], 'Flat sloped canopy roof tile or metal surface viewed perpendicular to slope, opaque edge to edge.', 'Mặt mái che trên cửa nhìn vuông góc.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Mái') ? 'canopy' : (includesName(name, 'Bậc') ? 'step' : (includesName(name, 'Khung') ? 'frame' : 'door'))
  },
  'porch-steps': {
    slots: [
      s('tread', 'Mặt bậc tam cấp', 'Porch step tread', [6, 1], 'Top-down stone or brick porch step tread surface, opaque edge to edge.', 'Mặt bậc tam cấp nhìn từ trên xuống.'),
      s('riser', 'Cổ bậc tam cấp', 'Porch step riser', [9, 1], 'Front elevation of stone or brick porch step riser, opaque edge to edge.', 'Cổ bậc tam cấp nhìn chính diện.')
    ],
    assignFaceSlot: (name) => includesName(name, 'mặt') ? 'tread' : 'riser'
  },
  'chimney': {
    slots: [
      s('brick', 'Thân ống khói', 'Chimney shaft', [1, 3], 'Red brick chimney masonry texture, vertical seamless, opaque edge to edge.', 'Thân ống khói gạch đỏ liền mạch.'),
      s('cap', 'Mặt nắp đá', 'Stone chimney cap top', [1, 1], 'Flat square stone chimney cap surface viewed from above, edge to edge, no chimney shaft or pot.', 'Mặt nắp đá vuông nhìn từ trên, kín mép, không vẽ cả ống khói.'),
      s('rim', 'Viền nắp đá', 'Stone chimney cap rim', [3, 1], 'Flat narrow horizontal stone cap rim elevation, edge to edge.', 'Mặt đứng dải viền nắp đá hẹp, phủ kín mép.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Viền nắp') ? 'rim' : (includesName(name, 'Nắp trên') ? 'cap' : 'brick')
  },
  'dormer': {
    slots: [
      s('front', 'Mặt trước cửa mái', 'Dormer gable front', [8, 11], 'Orthographic gabled dormer front with small window and timber frame.', 'Mặt trước cửa sổ mái đầu hồi chữ A.'),
      s('cheek', 'Vách hông cửa mái', 'Dormer side cheek', [8, 7], 'Flat clapboard or slate dormer side cheek wall, opaque edge to edge.', 'Vách hông hai bên cửa mái.'),
      s('roof', 'Mái dốc cửa mái', 'Dormer roof slope', [1, 1], 'Flat shingle or tile roof slope for dormer, opaque edge to edge.', 'Mái ngói nhỏ dốc hai bên cửa mái.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Dốc') || includesName(name, 'Mái') ? 'roof' : (includesName(name, 'Vách') ? 'cheek' : 'front')
  },
  'column-classic': {
    slots: [
      s('shaft', 'Thân cột rãnh khía', 'Fluted column shaft', [1, 12], 'Vertical classical stone column shaft strip with subtle fluting, opaque edge to edge.', 'Một mặt thân cột đá cổ điển có rãnh dọc.'),
      s('base', 'Đế & đầu cột đá', 'Column base & capital', [3, 1], 'Carved stone molding strip for classical column base or capital, opaque edge to edge.', 'Dải đá chạm khắc phần đế và đầu cột.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Thân') ? 'shaft' : 'base'
  },
  'balcony': {
    slots: [
      s('floor', 'Sàn & mép ban công', 'Balcony slab & edge', [5, 2], 'Stone or timber balcony floor slab surface, opaque edge to edge.', 'Mặt sàn và gờ mép sàn ban công.'),
      s('railing', 'Lan can ban công', 'Balcony railing', [10, 3], 'Wrought iron or carved wood balustrade railing with transparent alpha between bars.', 'Lan can sắt mỹ thuật hoặc con tiện gỗ có khe hở alpha.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'Lan can') ? 'railing' : 'floor'
  },
  'flower-box': {
    slots: [
      s('box', 'Vách bồn gỗ', 'Wooden planter box', [4, 1], 'Weathered wooden planter box panel, opaque edge to edge.', 'Vách hộp bồn hoa gỗ sồi treo tường.'),
      s('soil', 'Mặt đất trong bồn', 'Planter soil', [5, 1], 'Top-down flat dark potting soil texture, opaque edge to edge, no planter rim or plants.', 'Đất trồng nhìn từ trên, kín mép, không vẽ viền bồn hay cây.'),
      s('flowers', 'Hoa lá rực rỡ', 'Flowers & trailing ivy', [2, 1], 'Blooms and trailing green ivy with transparent alpha.', 'Khóm hoa ban công rực rỡ và lá rủ nền trong suốt.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'đất') ? 'soil' : (includesName(name, 'Hoa') || includesName(name, 'Lá') ? 'flowers' : 'box')
  },
  'flower-pot': {
    slots: [
      s('pot', 'Thành chậu gốm', 'Terracotta pot wall', [8, 7], 'Flat terracotta or ceramic planter pot side wall texture, opaque edge to edge.', 'Vách chậu gốm đất nung hoặc sứ nhìn thẳng.'),
      s('soil', 'Mặt đất chậu', 'Potting soil top', [1, 1], 'Top-down dark potting soil surface, opaque edge to edge.', 'Mặt đất trồng trong chậu nhìn từ trên.'),
      s('foliage', 'Tán cây chậu cảnh', 'Potted plant foliage', [11, 13], 'Front orthographic leafy ornamental shrub or fern cutout, stem anchored at bottom center, transparent alpha outside.', 'Tán cây cảnh lá xanh nhìn thẳng, gốc chạm giữa mép dưới, nền alpha trong suốt.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'Tán') ? 'foliage' : (includesName(name, 'đất') ? 'soil' : 'pot')
  },
  'wall-lamp': {
    slots: [
      s('bracket', 'Đế & tay sắt treo đèn', 'Iron wall bracket', [2, 3], 'Dark wrought iron wall mount plate or arm texture, opaque edge to edge.', 'Đế ốp tường và tay đỡ sắt đen.'),
      s('lantern', 'Mặt kính lồng đèn', 'Lantern glass pane', [7, 10], 'Single flat warm glowing glass lantern pane with thin iron frame along edges, opaque.', 'Một mặt kính lồng đèn phát sáng ấm có viền khung sắt mảnh.'),
      s('cap', 'Nắp & đáy lồng đèn', 'Lantern cap & base', [1, 1], 'Flat square dark iron lantern lid/base viewed from above, opaque edge to edge.', 'Mặt nắp hoặc đáy sắt vuông của lồng đèn.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Trên') || includesName(name, 'Dưới') ? 'cap' : (includesName(name, 'Lồng') ? 'lantern' : 'bracket')
  },
  'hanging-sign': {
    slots: [
      s('board', 'Biển hiệu 2 mặt', 'Double-sided sign board', [3, 2], 'Painted wooden hanging tavern/shop sign board, ornate frame, opaque edge to edge.', 'Bảng hiệu gỗ treo hai mặt phong cách cổ điển.'),
      s('bracket', 'Đế & thanh treo sắt', 'Iron hanging bracket', [5, 7], 'Dark wrought iron wall mount plate and hanging bar.', 'Đế gắn tường và thanh sắt treo bảng hiệu.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Biển') ? 'board' : 'bracket'
  },
  'fabric-awning': {
    slots: [
      s('canopy', 'Bạt che sọc màu', 'Striped awning fabric', [20, 9], 'Flat rectangular striped canvas awning fabric viewed perpendicular to surface, stripes running top to bottom, opaque edge to edge.', 'Bạt che mái hiên sọc màu nhìn vuông góc, phủ kín mép.'),
      s('valance', 'Diềm bạt rủ trước', 'Front valance strip', [10, 1], 'Horizontal scalloped or fringed awning valance strip, transparent below scallops.', 'Dải diềm bạt rủ lượn sóng phía trước.', 'cutout'),
      s('flap', 'Vạt bạt che hông', 'Triangular side flap', [26, 15], 'Triangular side awning canvas flap matching canopy stripes.', 'Vạt vải che hai bên hông mái hiên.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'Diềm') ? 'valance' : (includesName(name, 'Hông') ? 'flap' : 'canopy')
  },
  'fence-3': {
    slots: [
      s('panel', 'Tấm hàng rào nan', 'Fence picket bay', [20, 13], 'Horizontal wooden picket or wrought iron fence bay with transparent alpha between slats.', 'Một nhịp hàng rào có khe hở alpha giữa các nan.', 'cutout'),
      s('post', 'Cột trụ hàng rào', 'Fence post', [3, 17], 'Vertical wooden or stone fence post front elevation, opaque edge to edge.', 'Trụ cột hàng rào thẳng đứng.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Cột') ? 'post' : 'panel'
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
  'curved-pillar': {
    slots: [
      s('half', 'Mảnh nửa thân trụ 180°', 'Semi-cylinder panel', [2, 3], 'Flat unwrapped marble, stone or bark texture, opaque edge to edge, seamless left/right edges. The mesh bends each panel 180 degrees into a full cylinder.', 'Vật liệu cột tròn trải phẳng kín mép, hai cạnh trái/phải liền mạch; mesh tự uốn cong 180 độ.')
    ],
    assignFaceSlot: () => 'half'
  },
  'cone-tapered': {
    slots: [
      s('panel', 'Mảnh thân nón thuôn', 'Tapered cone panel', [1, 3], 'One flat unwrapped bark, stone or shingle texture, opaque edge to edge. The mesh tapers and bends this panel into a 3D cone.', 'Mảnh vật liệu thân côn/thân cây phẳng kín mép; mesh tự thuôn nhỏ về đỉnh và uốn cong 3D.')
    ],
    assignFaceSlot: () => 'panel'
  },
  'pillar-square': {
    slots: [
      s('wall', 'Vách trụ vuông', 'Square pillar facet', [1, 3], 'Flat vertical stone or plaster pillar elevation, opaque edge to edge.', 'Mặt vách đứng của cột vuông hoặc trụ bệ đá.')
    ],
    assignFaceSlot: () => 'wall'
  },
  'box': {
    slots: [
      s('side', 'Mặt hông hộp', 'Box side face', [1, 1], 'Square crate or box wooden plank surface, opaque edge to edge.', 'Mặt gỗ bên hông khối hộp hoặc thùng hàng.'),
      s('top', 'Mặt nắp / đáy hộp', 'Box top / bottom lid', [1, 1], 'Square top lid surface of wooden crate, opaque edge to edge.', 'Mặt nắp trên hoặc đáy của thùng hàng.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Trên') || includesName(name, 'Dưới') ? 'top' : 'side'
  },
  'cube-3': {
    slots: [
      s('face', 'Mặt khối lập phương', 'Cube face', [1, 1], 'Square cubic facet texture, opaque edge to edge.', 'Mặt vuông của khối lập phương.')
    ],
    assignFaceSlot: () => 'face'
  },
  'chest-open': {
    slots: [
      s('front', 'Vách dài rương (trước/sau)', 'Chest front/back wall', [25, 16], 'Ornate wooden treasure chest front/back panel with iron bands and lockplate, opaque edge to edge.', 'Vách dài trước/sau của rương gỗ viền sắt.'),
      s('side', 'Vách hông rương', 'Chest side panel', [17, 16], 'Wooden chest side panel with iron corner brackets and carrying handle, opaque edge to edge.', 'Vách hông trái/phải của rương gỗ.'),
      s('lid', 'Nắp rương mở', 'Open chest lid', [25, 17], 'Wooden chest lid panel with iron straps, opaque edge to edge.', 'Mặt nắp rương mở nghiêng phía trên.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Nắp') || includesName(name, 'Dưới') ? 'lid' : (includesName(name, 'Trái') || includesName(name, 'Phải') ? 'side' : 'front')
  },
  'popup-card': {
    slots: [
      s('base', 'Mặt nền thiệp ngang', 'Card horizontal base', [3, 2], 'Top-down illustrated paper pop-up card base page with decorative border, opaque edge to edge.', 'Trang giấy nền nằm ngang của thiệp pop-up.'),
      s('backdrop', 'Vách lưng thiệp đứng', 'Card upright backdrop', [3, 2], 'Upright illustrated pop-up card background scene page, opaque edge to edge.', 'Trang giấy đứng làm phông nền phía sau thiệp.'),
      s('mid_pop', 'Lớp cắt giấy giữa', 'Middle pop-up cutout', [18, 13], 'Paper-craft die-cut middle scenic element, flat bottom tab touching bottom edge, transparent alpha around cutout.', 'Lớp tranh cắt giấy dựng ở tầng giữa, nền trong suốt.', 'cutout'),
      s('front_pop', 'Lớp cắt giấy tiền cảnh', 'Foreground pop-up cutout', [24, 7], 'Low wide paper-craft die-cut foreground strip, flat base at bottom edge, transparent alpha above.', 'Dải tranh cắt giấy tiền cảnh phía trước, nền trong suốt.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'Nền') ? 'base' : (includesName(name, 'Lưng') ? 'backdrop' : (includesName(name, 'giữa') ? 'mid_pop' : 'front_pop'))
  },
  'folding-screen': {
    slots: [
      s('left', 'Tấm bình phong trái', 'Left screen panel', [13, 24], 'Left panel of a 3-panel East Asian painted silk/lacquer folding screen with wooden frame border, opaque edge to edge.', 'Tấm bên trái của bức bình phong 3 cánh.'),
      s('center', 'Tấm bình phong giữa', 'Center screen panel', [13, 24], 'Center main panel of a 3-panel painted folding screen continuing the panoramic artwork, opaque edge to edge.', 'Tấm chính giữa của bức bình phong 3 cánh.'),
      s('right', 'Tấm bình phong phải', 'Right screen panel', [13, 24], 'Right panel of a 3-panel painted folding screen completing the panoramic composition, opaque edge to edge.', 'Tấm bên phải của bức bình phong 3 cánh.')
    ],
    assignFaceSlot: (name) => includesName(name, 'trái') ? 'left' : (includesName(name, 'phải') ? 'right' : 'center')
  },
  'standee': {
    slots: [
      s('figure', 'Bảng hình standee', 'Standee figure cutout', [2, 3], 'Full-body character or display illustration with die-cut white border, bottom feet anchored at bottom edge, transparent alpha outside.', 'Hình nhân vật hoặc poster standee tách nền alpha, chân chạm mép đáy.', 'cutout'),
      s('base', 'Đế & chân chống sau', 'Standee base & strut', [7, 3], 'Flat cardboard or acrylic standee base and rear support fin, opaque edge to edge.', 'Mặt đế nằm ngang và thanh chống lưng phía sau.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Bảng') ? 'figure' : 'base'
  },
  'lantern-6': {
    slots: [
      s('panel', 'Mặt lồng đèn lục giác', 'Hexagonal lantern panel', [1, 2], 'Single vertical silk or paper lantern facet with warm inner glow and wooden frame along edges, opaque edge to edge.', 'Một mặt vách lụa/giấy của đèn lồng lục giác khung gỗ.')
    ],
    assignFaceSlot: () => 'panel'
  },
  'bench': {
    slots: [
      s('seat', 'Mặt ngồi ghế', 'Bench seat slats', [4, 1], 'Orthographic top-down wooden bench seat slats surface, no legs or backrest.', 'Mặt ngồi nan gỗ ghế băng nhìn từ trên, không chân hay tựa lưng.'),
      s('back', 'Tựa lưng ghế', 'Bench backrest', [3, 1], 'Wooden bench backrest panel, opaque edge to edge.', 'Tựa lưng ghế băng gỗ.'),
      s('apron', 'Yếm trước ghế', 'Bench front apron', [12, 1], 'Flat narrow horizontal wooden bench apron plank, front elevation, opaque edge to edge.', 'Dải ván yếm trước ghế nhìn chính diện, phủ kín mép.'),
      s('leg', 'Chân ghế đá / sắt', 'Bench support leg', [11, 12], 'Ornate iron or stone bench leg side profile with transparent alpha.', 'Chân ghế băng đúc sắt hoặc đá nhìn ngang có alpha.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'ngồi') ? 'seat' : (includesName(name, 'Tựa') ? 'back' : (includesName(name, 'Yếm') ? 'apron' : 'leg'))
  },
  'street-lamp': {
    slots: [
      s('pole', 'Thân cột sắt', 'Lamp pole', [2, 35], 'Dark cast iron lamppost column centered vertically, transparent beside the pole.', 'Thân cột đèn đường sắt rèn thẳng đứng giữa ảnh, nền alpha hai bên.', 'cutout'),
      s('lantern', 'Một vách lồng đèn', 'Single lantern wall panel', [3, 4], 'One flat rectangular Victorian lantern glass pane with thin iron frame at the edges, warm glass rendered opaque, no entire lantern or perspective.', 'Một mặt kính chữ nhật có khung sắt mỏng quanh mép, kính màu ấm đục, không vẽ cả đèn hay phối cảnh.'),
      s('cap', 'Nắp & đáy lồng đèn', 'Lantern top/bottom cap', [1, 1], 'Flat square dark iron lantern lid texture viewed from above, opaque edge to edge, no glass pane.', 'Nắp sắt vuông nhìn từ trên, đục kín mép, không kính.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Trên') || includesName(name, 'Dưới') ? 'cap' : (includesName(name, 'Lồng') ? 'lantern' : 'pole')
  },
  'signpost': {
    slots: [
      s('board', 'Biển chỉ hướng', 'Signboard', [2, 1], 'Pointed wooden direction sign board with text or arrow, transparent outside board outline.', 'Bảng chỉ dẫn bằng gỗ có mũi tên chỉ đường.', 'cutout'),
      s('post', 'Cột gỗ đứng', 'Wooden post', [3, 25], 'Square or round vertical wooden post, opaque edge to edge.', 'Cột gỗ đứng cắm biển báo.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Bảng') || includesName(name, 'Biển') ? 'board' : 'post'
  },
  'market-stall': {
    slots: [
      s('counter', 'Quầy hàng gỗ', 'Market counter', [50, 11], 'Wooden market stall counter with rustic planks, opaque edge to edge.', 'Quầy hàng chợ bằng ván gỗ mộc.'),
      s('roof', 'Mái bạt sạp chợ', 'Stall canopy roof', [28, 11], 'Flat rectangular striped canvas surface viewed perpendicular to the fabric, stripes running image top to bottom. Geometry supplies the slope; no complete canopy or stall.', 'Vải bạt sọc chữ nhật nhìn vuông góc, sọc dọc ảnh; mesh tạo độ nghiêng, không vẽ cả mái hay sạp.'),
      s('pole', 'Cột chống', 'Support poles', [1, 20], 'Vertical wooden support pole, opaque edge to edge.', 'Cột gỗ chống đỡ mái sạp.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Mái') ? 'roof' : (includesName(name, 'Quầy') ? 'counter' : 'pole')
  },

  // Nature
  'tree-cross': {
    slots: [
      s('trunk', 'Thân cây gỗ', 'Tree trunk', [1, 3], 'Single straight tree trunk front elevation, centered vertical bark silhouette reaching top and bottom edges; transparent beside the trunk, no foliage or ground.', 'Một thân cây nhìn thẳng ở giữa ảnh, chạm mép trên/dưới, alpha hai bên; không có tán hay đất.', 'cutout'),
      s('canopy', 'Tán lá mặt đứng', 'Vertical canopy foliage', [1, 1], 'Front orthographic dense tree canopy foliage clump, rich greens, transparent alpha around leaf edges, no trunk, ground or sky.', 'Tán lá nhìn chính diện, viền lá alpha, không có thân, đất hay bầu trời.', 'cutout'),
      s('canopy_top', 'Tán lá nhìn từ trên', 'Top-view canopy foliage', [1, 1], 'Orthographic overhead view of a dense leafy tree crown, approximately circular centered silhouette, transparent alpha around leaf edges, no visible trunk, ground or sky.', 'Tán cây nhìn thẳng từ trên, đường viền gần tròn giữa ảnh, alpha ngoài lá, không thân, đất hay bầu trời.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'Thân') || includesName(name, 'Trụ') ? 'trunk' : (includesName(name, 'vòm') ? 'canopy_top' : 'canopy')
  },
  'bush-3': {
    slots: [
      s('foliage', 'Cụm lá bụi cây', 'Bush foliage clump', [4, 3], 'Front orthographic dense bush foliage clump with leaf details, transparent alpha outside, no ground.', 'Cụm lá bụi nhìn chính diện, viền lá alpha, không có đất.', 'cutout'),
      s('foliage_top', 'Mặt nóc bụi cây', 'Bush top foliage', [4, 3], 'Orthographic overhead dense bush foliage, organic oval silhouette, transparent alpha outside leaf edges, no ground.', 'Bụi cây nhìn từ trên, viền bầu dục tự nhiên, alpha ngoài lá, không đất.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'Nóc') ? 'foliage_top' : 'foliage'
  },
  'foliage-layers': {
    slots: [
      s('layer', 'Tấm tán lá phân lớp', 'Foliage branch layer', [3, 2], 'Natural leafy branch spreading horizontally, transparent alpha for layered parallax depth.', 'Cành lá cây trải ngang tự nhiên nền trong suốt để tạo lớp parallax.', 'cutout')
    ],
    assignFaceSlot: () => 'layer'
  },
  'ground-patch': {
    slots: [
      s('ground', 'Mặt đất / sỏi', 'Ground earth surface', [4, 3], 'Top-down natural grass and soil texture patch, opaque edge to edge.', 'Mặt đất vườn hoặc sỏi đá nhìn từ trên.'),
      s('edge', 'Viền cây cỏ mép', 'Grass edge rim', [5, 1], 'Front horizontal grass rim cutout with alpha, blades rooted at bottom edge.', 'Viền ngọn cỏ mép trước tách nền alpha, gốc chạm đáy.', 'cutout'),
      s('bush', 'Bụi cây phía sau', 'Rear bushes', [10, 3], 'Front orthographic row of low leafy bushes, base anchored at image bottom, transparent alpha above and between leaves, no ground.', 'Hàng bụi cây thấp nhìn thẳng, gốc chạm mép dưới, alpha phía trên và khe lá, không đất.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'đất') ? 'ground' : (includesName(name, 'Bụi') ? 'bush' : 'edge')
  },
  'flower-patch': {
    slots: [
      s('ground', 'Đất nền sân vườn', 'Garden soil ground', [7, 5], 'Top-down soil and moss garden ground patch, opaque edge to edge.', 'Mặt đất sân vườn nhìn từ trên.'),
      s('flower', 'Khóm hoa nở xòe', 'Blooming flower clump', [2, 1], 'Multi-directional blooming garden flower cluster with leaves, stems rooted at bottom edge, transparent alpha.', 'Khóm hoa nở rực rỡ nhiều hướng tách nền trong suốt.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'đất') ? 'ground' : 'flower'
  },
  'hedge': {
    slots: [
      s('front', 'Vách bờ rào xén tỉa', 'Boxwood hedge side', [3, 1], 'Dense clipped green boxwood hedge surface, opaque edge to edge.', 'Vách bờ rào cây xanh cắt tỉa vuông vắn.'),
      s('top', 'Mặt trên bờ rào', 'Hedge curved top', [3, 1], 'Curved wavy top surface of clipped garden hedge, opaque edge to edge.', 'Mặt trên bờ rào uốn cong mềm mại.')
    ],
    assignFaceSlot: (name) => includesName(name, 'nóc') ? 'top' : 'front'
  },

  // Stage
  'room-open': {
    slots: [
      s('floor', 'Sàn phòng', 'Room floor', [7, 6], 'Top-down interior parquet wood or tile floor plan, opaque edge to edge.', 'Mặt sàn gỗ nội thất nhìn từ trên.'),
      s('wall_back', 'Tường chính diện', 'Back wall', [7, 5], 'Interior back room wall with wallpaper, wainscoting or paint finish, opaque edge to edge.', 'Mặt tường phòng chính diện phía sau.'),
      s('wall_side', 'Tường hông', 'Side wall', [6, 5], 'Interior side wall elevation matching back wall molding and finish, opaque edge to edge.', 'Mặt tường hông bên trái và phải.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Sàn') ? 'floor' : (includesName(name, 'trái') || includesName(name, 'phải') ? 'wall_side' : 'wall_back')
  },
  'street-corner': {
    slots: [
      s('facade_a', 'Mặt tiền phố A', 'Street facade A', [1, 1], 'Historic street corner shop facade A, orthographic front elevation, opaque edge to edge.', 'Mặt tiền dãy phố thứ nhất nhìn thẳng.'),
      s('facade_b', 'Mặt tiền phố B', 'Street facade B', [1, 1], 'Historic street corner facade B meeting facade A at the corner, opaque edge to edge.', 'Mặt tiền dãy phố thứ hai vuông góc.'),
      s('pavement', 'Vỉa hè góc phố', 'Cobblestone pavement', [1, 1], 'Sidewalk cobblestone street pavement viewed from above, opaque edge to edge.', 'Mặt vỉa hè lát đá góc phố nhìn từ trên.')
    ],
    assignFaceSlot: (name) => includesName(name, 'hè') ? 'pavement' : (includesName(name, 'trước') ? 'facade_a' : 'facade_b')
  },
  'cyclorama': {
    slots: [
      s('floor', 'Sàn studio', 'Studio floor', [9, 5], 'Seamless photography studio floor, uniform gradient or matte finish, opaque edge to edge.', 'Sàn studio chụp ảnh vô cực.'),
      s('cove', 'Góc bo cong 45°', 'Cove sweep', [9, 2], 'Curved cove sweep transition matching studio floor and backdrop color, opaque edge to edge.', 'Mép chuyển tiếp bo cong 45 độ.'),
      s('backdrop', 'Phông nền đứng', 'Upright backdrop', [9, 5], 'Upright seamless infinite backdrop wall, opaque edge to edge.', 'Phông đứng vô cực studio.')
    ],
    assignFaceSlot: (name) => includesName(name, 'Sàn') ? 'floor' : (includesName(name, 'Góc') ? 'cove' : 'backdrop')
  },
  'diorama': {
    slots: [
      s('wall', 'Tường hậu cảnh', 'Back diorama wall', [9, 5], 'Sky or distant panorama backdrop painting, opaque edge to edge.', 'Phông nền bầu trời hoặc cảnh xa phía sau.'),
      s('floor', 'Sàn diorama', 'Diorama ground', [3, 2], 'Diorama ground terrain base viewed from above, opaque edge to edge.', 'Mặt sàn địa hình bên dưới.'),
      s('layer', 'Tấm cảnh phân tầng', 'Layered cutout', [2, 1], 'Layered scenic elements cutout with transparent alpha for parallax depth.', 'Tấm cảnh phân lớp xa/giữa/gần có alpha tạo chiều sâu.', 'cutout')
    ],
    assignFaceSlot: (name) => includesName(name, 'Lưng') || includesName(name, 'Tường') ? 'wall' : (includesName(name, 'Nền') || includesName(name, 'Sàn') ? 'floor' : 'layer')
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
    faces: () =>
      fitted.faces.map((f) => ({
        ...f,
        c: [...f.c] as [number, number, number],
        n: [...f.n] as [number, number, number],
        up: f.up ? ([...f.up] as [number, number, number]) : undefined,
        silhouettePolygon: f.silhouettePolygon ? f.silhouettePolygon.map((pt) => [...pt]) : undefined,
        mesh: f.mesh
          ? {
              ...f.mesh,
              hiddenCells: f.mesh.hiddenCells ? [...f.mesh.hiddenCells] : undefined,
              silhouettePolygon: f.mesh.silhouettePolygon ? f.mesh.silhouettePolygon.map((pt) => [...pt]) : undefined
            }
          : undefined
      }))
  }
}

/** Enriches all templates in the catalogue to guarantee 100% MCP & UI recipe coverage. */
export function enrichAllTemplatesWithRecipes(templates: AssemblyTemplate[]): AssemblyTemplate[] {
  return templates.map((t) => enrichTemplateWithRecipe(t))
}

