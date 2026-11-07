import type { PlantSpine, PlantSpinePoint } from '@shared/plantSpine'
import type { LayerComposite, MotionAnchor, MotionType } from './types'
import {
  buildAutoPlantSpinePoints,
  WIND_WEATHER_PRESETS,
  type PlantSpineDirection,
  type WindWeatherPresetId
} from './workshopPlantSpines'

export interface MotionLayerWindItem {
  layerId: string
  layerName?: string
  type: MotionType
  speed: number
  amplitude: number
  anchor: MotionAnchor
  phaseOffset?: number
}

export interface ParsedWindData {
  enabled: boolean
  weatherPreset?: WindWeatherPresetId | 'custom'
  lean?: number
  plantSpines: PlantSpine[]
  layerMotions: MotionLayerWindItem[]
}

const VALID_MOTION_TYPES = new Set<MotionType>(['none', 'sway', 'breathe', 'float', 'wave', 'rocking'])
const VALID_ANCHORS = new Set<MotionAnchor>(['bottom', 'center', 'top', 'left', 'right'])

export interface WindParameterRuleItem {
  param: string
  range: string
  role: string
  tuningGuide: string
}

export interface MotionWindConfigurationGuide {
  hasExistingWindSpines: boolean
  existingSpinesCount: number
  whenToUseWindRule: string
  skipWindIfBoneAnimatedRule: string
  existingSpinesRule: string
  boneDrivenLayersSkipWind: string[]
  eligibleSoftWindLayers: string[]
  weatherPresets: Record<
    WindWeatherPresetId,
    {
      label: string
      amplitude: number
      speed: number
      stiffness: number
      flexibility: number
      turbulence: number
      verticalBob: number
      useCase: string
    }
  >
  parameterGuide: WindParameterRuleItem[]
}

const SOFT_WIND_ACCESSORY_RE =
  /(hair[-_ ]?back|ponytail|bang|cape|cloak|scarf|ribbon|skirt|hem|tail|wing|tree|foliage|leaf|leaves|branch|flower|blossom|grass|fern|vine|bush|bonsai|tóc sau|đuôi tóc|tóc mái|áo choàng|khăn|dải lụa|tà áo|váy|đuôi|cánh|cây|tán lá|cành|hoa|cỏ|dương xỉ|dây leo)/i

const CORE_RIGID_OR_SKELETAL_BODY_RE =
  /(^|[-_\s])(head|face|glass|glasses|visor|eye|mouth|brow|torso|chest|body|pelvis|hip|arm|forearm|hand|thigh|shin|calf|foot|shoe|leg)($|[-_\s])/i

/** Kiểm tra xem một mảnh Layer có phải là phụ kiện mềm / cây cối phù hợp gắn Gió độc lập hay không */
export function isDedicatedWindAccessoryOrNatureLayer(
  layer: { id: string; name: string; slot?: string; boneId?: string; isCloth?: boolean },
  compositeCategory?: string
): boolean {
  if (compositeCategory === 'nature') return true
  if (layer.isCloth) return true
  const tag = `${layer.id} ${layer.name} ${layer.slot ?? ''}`
  if (SOFT_WIND_ACCESSORY_RE.test(tag)) {
    // Nếu là mảnh "head" nguyên khối (chứa cả đầu & mặt) thì không coi là phụ kiện gió rời nếu có mảnh kính/mặt đi kèm
    if (/(^|[-_\s])head($|[-_\s])/i.test(layer.id) || /^head$/i.test(layer.name.trim())) {
      return false
    }
    return true
  }
  return false
}

/** Xây dựng hướng dẫn cấu hình Gió (Wind / PlantSpines) chi tiết cho JSON xuất ra và AI Prompt */
export function buildWindConfigurationGuide(
  composite?: LayerComposite,
  existingSpinesOverride?: ReadonlyArray<PlantSpine>
): MotionWindConfigurationGuide {
  const layers = composite?.layers ?? []
  const spines = existingSpinesOverride ?? composite?.plantSpines ?? []
  const hasExistingWindSpines = spines.length > 0

  const spineLayerIdSet = new Set<string>()
  for (const s of spines) {
    for (const lid of s.layerIds) spineLayerIdSet.add(lid)
  }

  const boneDrivenLayersSkipWind: string[] = []
  const eligibleSoftWindLayers: string[] = []

  for (const l of layers) {
    if (l.hidden) continue
    const label = `${l.name} (${l.id})`
    if (spineLayerIdSet.has(l.id) || isDedicatedWindAccessoryOrNatureLayer(l, composite?.category)) {
      eligibleSoftWindLayers.push(label)
    } else if (l.boneId) {
      boneDrivenLayersSkipWind.push(`${label} -> đã có xương "${l.boneId}"`)
    }
  }

  const weatherPresets = Object.fromEntries(
    WIND_WEATHER_PRESETS.map((w) => [
      w.id,
      {
        label: w.label,
        amplitude: w.params.amplitude,
        speed: w.params.speed,
        stiffness: w.params.stiffness,
        flexibility: w.params.flexibility,
        turbulence: w.params.turbulence,
        verticalBob: w.params.verticalBob ?? 0.05,
        useCase: w.hint
      }
    ])
  ) as MotionWindConfigurationGuide['weatherPresets']

  return {
    hasExistingWindSpines,
    existingSpinesCount: spines.length,
    whenToUseWindRule: hasExistingWindSpines
      ? `Mẫu này ĐÃ CÓ SẴN ${spines.length} trục gió (plantSpines). Hãy GIỮ NGUYÊN id, layerIds và points của các trục gió hiện có; chỉ điều chỉnh thông số nhịp gió (amplitude, speed, stiffness, flexibility, turbulence, lean, phaseOffset, verticalBob) cho khớp với động tác. KHÔNG tự tạo thêm trục gió trùng lặp.`
      : eligibleSoftWindLayers.length > 0
        ? `Mẫu có mảnh phụ kiện mềm / thiên nhiên (${eligibleSoftWindLayers.join(', ')}): có thể cấu hình "wind.plantSpines" cho các mảnh này. Các mảnh cơ thể đã gắn xương (${boneDrivenLayersSkipWind.length} mảnh) KHÔNG gắn thêm gió.`
        : 'Tất cả các mảnh của nhân vật này ĐÃ CÓ LOGIC XƯƠNG điều khiển (boneId trong tracks). KHÔNG CẦN bổ sung "plantSpines" (đặt "wind": { "enabled": false, "plantSpines": [] }), trừ khi người dùng yêu cầu rõ hiệu ứng gió trong mục tiêu chuyển động.',
    skipWindIfBoneAnimatedRule:
      'QUY TẮC BẤT BIẾN: Nếu một mảnh cơ thể (đặc biệt là head/đầu nguyên khối có kèm glasses/kính hoặc face/biểu cảm rời, torso/thân áo, arm/tay, thigh/đùi, shin/cẳng chân) ĐÃ CÓ LOGIC CHUYỂN ĐỘNG XƯƠNG trong "tracks", TUYỆT ĐỐI KHÔNG tự ý gắn thêm trục gió "plantSpines" vào mảnh đó! Gắn chồng trục gió lên mảnh đầu/thân đang chạy keyframe xương sẽ làm biến dạng chồng chéo và làm mắt kính/khuôn mặt bị trôi lệch khỏi đầu.',
    existingSpinesRule:
      'Khi điều chỉnh trục gió có sẵn: giữ nguyên mảng "points" (vì điểm gốc points[0] và hướng đường trục đã được căn khớp theo hình ảnh layer), chỉ tinh chỉnh biên độ "amplitude", tốc độ "speed", độ cứng gốc "stiffness", độ dẻo ngọn "flexibility", độ nhiễu "turbulence" và góc nghiêng "lean".',
    boneDrivenLayersSkipWind,
    eligibleSoftWindLayers,
    weatherPresets,
    parameterGuide: [
      {
        param: 'points',
        range: 'Array<{x, y}> (3..8 điểm)',
        role: 'Đường trục xương sống của gió từ Gốc tới Ngọn',
        tuningGuide:
          'points[0] là GỐC CỐ ĐỊNH (đứng yên 100% làm mố neo), điểm cuối points[n-1] là NGỌN TỰ DO (đung đưa mạnh nhất). Nếu mẫu đã có sẵn points thì giữ nguyên.'
      },
      {
        param: 'direction',
        range: '"down" | "up" | "horizontal"',
        role: 'Hướng rủ / mọc của trục gió khi tạo tự động',
        tuningGuide:
          '"down" = gốc ở trên, ngọn rủ xuống (tóc dài, tà áo, dây leo); "up" = gốc dưới đất, ngọn vươn lên (thân cây, bụi cỏ, hoa); "horizontal" = gốc một bên, ngọn bay ngang (khăn choàng, cờ).'
      },
      {
        param: 'amplitude',
        range: '0 .. 45 (độ °)',
        role: 'Biên độ góc uốn lắc tối đa tại ngọn',
        tuningGuide:
          'Gió thoảng / đi bộ nhẹ: 4..8°; Gió vừa ngoài trời / chạy bộ: 10..15°; Gió mạnh / tung chiêu: 18..26°; Bão lốc: 28..35°.'
      },
      {
        param: 'speed',
        range: '0.2 .. 3.0 (chu kỳ/giây)',
        role: 'Tốc độ nhịp đung đưa của gió',
        tuningGuide:
          'Nên đồng bộ với nhịp động tác (ví dụ bước đi duration 1.6s -> speed: 0.6..0.9; đứng thở chậm -> speed: 0.45..0.6; chạy nhanh/gió mạnh -> speed: 1.2..1.8).'
      },
      {
        param: 'stiffness',
        range: '0.1 .. 0.85',
        role: 'Độ cứng giữ form ở phần gốc (Root Stiffness)',
        tuningGuide:
          'Thân gỗ / vải dày / vạt áo cứng: 0.45..0.65 (gốc ít cong); Tóc mềm / dải lụa / ngọn cỏ: 0.20..0.35.'
      },
      {
        param: 'flexibility',
        range: '0.15 .. 0.90',
        role: 'Độ mềm uốn sóng S-curve & vẩy ngọn (Tip Whip / Follow-through)',
        tuningGuide:
          'Tóc dài / áo choàng / dây leo mềm: 0.45..0.70 (ngọn uốn lượn trễ pha mượt mà); Cành cây / vật liệu cứng vừa: 0.25..0.40.'
      },
      {
        param: 'turbulence',
        range: '0.0 .. 0.90',
        role: 'Độ nhiễu loạn tự nhiên (tránh lắc đều đặn máy móc như con lắc)',
        tuningGuide:
          'Gió êm dịu: 0.08..0.18; Gió tự nhiên ngoài trời: 0.20..0.35; Gió giật mạnh: 0.45..0.75.'
      },
      {
        param: 'lean',
        range: '-45 .. +45 (độ °)',
        role: 'Góc nghiêng nền theo chiều gió thổi hoặc quán tính ngược hướng di chuyển',
        tuningGuide:
          'Đứng yên gió nhẹ: 0..3°; Đi bộ / chạy tiến về trước hoặc gió tạt ngang: 4..12°.'
      },
      {
        param: 'phaseOffset',
        range: '0.0 .. 3.0 (giây)',
        role: 'Độ lệch pha thời gian giữa các trục gió',
        tuningGuide:
          'Khi có nhiều trục gió (nhiều lọn tóc / nhiều tầng lá), đặt lệch nhau 0.25..0.45s để các mảnh đung đưa so le tự nhiên.'
      },
      {
        param: 'verticalBob',
        range: '0.0 .. 0.25',
        role: 'Độ nhún phập phồng theo chiều dọc khi gió thổi',
        tuningGuide:
          'Tóc / tà áo nhẹ: 0.03..0.06; Tán cây / áo choàng gió mạnh: 0.08..0.16.'
      }
    ]
  }
}

/**
 * Lọc và chuẩn hoá danh sách `plantSpines` khi nhập từ JSON:
 * 1. Nếu mẫu đã có sẵn `plantSpine` trên cùng layer, kế thừa `id` và `points` chuẩn của mẫu, chỉ cập nhật thông số gió.
 * 2. Nếu mảnh layer là bộ phận cơ thể chính (`head` có kính/mặt rời, `torso`, `arm`, `thigh`, `shin`...) ĐÃ CÓ logic xương trong `tracks`
 *    và ban đầu KHÔNG có `plantSpine`, tự động bỏ qua trục gió dư thừa để không làm lệch mắt kính / biến dạng chồng chéo.
 */
export function filterAndMergeImportedWindSpines(
  parsedSpines: PlantSpine[],
  composite: LayerComposite | undefined,
  animatedBoneIds: ReadonlySet<string>,
  fixesApplied: string[]
): PlantSpine[] {
  if (!composite || parsedSpines.length === 0) return parsedSpines

  const existingSpines = composite.plantSpines ?? []
  const hasSeparateFaceOrGlassesOnHead = composite.layers.some(
    (l) => /glass|face|eye|mouth|kính|mặt|biểu cảm/i.test(`${l.id} ${l.name}`) && l.boneId
  )

  const out: PlantSpine[] = []
  const skippedLayerNames: string[] = []

  for (const sp of parsedSpines) {
    // Kiểm tra xem có trục gió gốc nào trong composite đang gắn cùng layer hoặc cùng id không
    const matchedExisting =
      existingSpines.find((ex) => ex.id === sp.id) ??
      existingSpines.find((ex) => ex.layerIds.some((lid) => sp.layerIds.includes(lid)))

    if (matchedExisting) {
      // Kế thừa id và đường trục points gốc nếu trục gốc không phải là trục AI sinh tạm trên head/torso
      const isExistingAiTempOnCoreBody =
        /^spine-ai-/i.test(matchedExisting.id) &&
        matchedExisting.layerIds.every((lid) => {
          const layer = composite.layers.find((l) => l.id === lid)
          if (!layer) return false
          return (
            Boolean(layer.boneId && animatedBoneIds.has(layer.boneId)) &&
            !isDedicatedWindAccessoryOrNatureLayer(layer, composite.category)
          )
        })

      if (!isExistingAiTempOnCoreBody) {
        out.push({
          ...matchedExisting,
          ...sp,
          id: matchedExisting.id,
          points: matchedExisting.points.length >= 2 ? matchedExisting.points : sp.points
        })
        continue
      }
    }

    // Lọc các layerIds mà thực sự cần gió (bỏ qua các mảnh cơ thể đã có logic xương điều khiển như demo-head, demo-torso)
    const keptLayerIds = sp.layerIds.filter((lid) => {
      const layer = composite.layers.find((l) => l.id === lid)
      if (!layer) return true
      if (isDedicatedWindAccessoryOrNatureLayer(layer, composite.category)) return true

      const isBoneAnimated = Boolean(layer.boneId && animatedBoneIds.has(layer.boneId))
      const isCoreBody = CORE_RIGID_OR_SKELETAL_BODY_RE.test(`${layer.id} ${layer.name} ${layer.slot ?? ''}`)
      const isHeadWithDetachedFace =
        hasSeparateFaceOrGlassesOnHead && /head|đầu/i.test(`${layer.id} ${layer.name}`)

      if ((isBoneAnimated && isCoreBody) || isHeadWithDetachedFace) {
        skippedLayerNames.push(layer.name)
        return false
      }
      return true
    })

    if (keptLayerIds.length > 0) {
      out.push({
        ...sp,
        layerIds: keptLayerIds
      })
    }
  }

  if (skippedLayerNames.length > 0) {
    const uniqueNames = [...new Set(skippedLayerNames)]
    fixesApplied.push(
      `Lọc bỏ trục gió dư thừa trên bộ phận đã có logic xương (${uniqueNames.join(', ')}) để tránh lệch khớp mặt/kính & biến dạng chồng`
    )
  }

  return out
}

/**
 * Lọc danh sách `plantSpines` khi xuất JSON: loại bỏ các trục gió AI tạm (`spine-ai-*`) gắn nhầm vào bộ phận cơ thể chính đã có xương.
 */
export function filterExportableWindSpines(
  composite?: LayerComposite,
  animatedBoneIds?: ReadonlySet<string>
): PlantSpine[] {
  const spines = composite?.plantSpines ?? []
  if (!composite || spines.length === 0) return spines

  const hasSeparateFaceOrGlassesOnHead = composite.layers.some(
    (l) => /glass|face|eye|mouth|kính|mặt|biểu cảm/i.test(`${l.id} ${l.name}`) && l.boneId
  )

  return spines.filter((sp) => {
    if (!/^spine-ai-/i.test(sp.id)) return true
    const allRedundant = sp.layerIds.every((lid) => {
      const layer = composite.layers.find((l) => l.id === lid)
      if (!layer) return false
      if (isDedicatedWindAccessoryOrNatureLayer(layer, composite.category)) return false
      const hasBoneLogic = Boolean(
        layer.boneId && (!animatedBoneIds || animatedBoneIds.size === 0 || animatedBoneIds.has(layer.boneId))
      )
      const isHeadWithDetachedFace =
        hasSeparateFaceOrGlassesOnHead && /head|đầu/i.test(`${layer.id} ${layer.name}`)
      return hasBoneLogic || isHeadWithDetachedFace
    })
    return !allRedundant
  })
}

/** Sinh khối hướng dẫn cấu hình Gió chi tiết cho AI Prompt */
export function buildPromptWindInstructionBlock(composite?: LayerComposite): string {
  const cleanSpines = filterExportableWindSpines(composite)
  const guide = buildWindConfigurationGuide(composite, cleanSpines)

  const statusLine = guide.hasExistingWindSpines
    ? `   - TRẠNG THÁI MẪU HIỆN TẠI: Mẫu ĐÃ CÓ SẴN ${guide.existingSpinesCount} trục gió (plantSpines). BẮT BUỘC giữ nguyên "id", "layerIds" và mảng toạ độ "points" của các trục đó, chỉ tinh chỉnh các thông số nhịp gió bên dưới cho khớp với động tác.`
    : guide.eligibleSoftWindLayers.length > 0
      ? `   - TRẠNG THÁI MẪU HIỆN TẠI: Mẫu có các mảnh phụ kiện mềm/thiên nhiên (${guide.eligibleSoftWindLayers.join(', ')}) có thể gắn "plantSpines". Các mảnh cơ thể đã có xương (${guide.boneDrivenLayersSkipWind.length} mảnh) TUYỆT ĐỐI KHÔNG gắn thêm gió.`
      : `   - TRẠNG THÁI MẪU HIỆN TẠI (QUY TẮC "ĐÃ CÓ LOGIC XƯƠNG THÌ KHÔNG CẦN BỔ SUNG GIÓ"): Toàn bộ các bộ phận của nhân vật này ĐÃ CÓ LOGIC XƯƠNG điều khiển trong "tracks" (và mảnh đầu "head" có đi kèm mảnh kính/mặt rời). Vì vậy KHÔNG CẦN bổ sung trục gió "plantSpines" (đặt "wind": { "enabled": false, "weatherPreset": "breeze", "lean": 0, "plantSpines": [] }). Tuyệt đối KHÔNG gắn thêm plantSpines vào "demo-head" hay "demo-torso" vì sẽ làm uốn cong đầu trong khi mắt kính đứng yên gây lệch kính khỏi mặt!`

  return `6. Hiệu ứng Gió uốn mềm ("wind") & Cách điều chỉnh thông số đung đưa chuẩn:
${statusLine}
   - KHI NÀO DÙNG GIÓ & CÁCH CHỈNH THÔNG SỐ ĐUNG ĐƯA CHUẨN (Dành cho mẫu có trục gió có sẵn, tóc dài/áo choàng rời hoặc cây cối):
     * "weatherPreset": "breeze" (Gió hiu hiu ±6°, speed 0.55) | "moderate" (Gió vừa ±13°, speed 1.0) | "strong" (Gió mạnh ±22°, speed 1.65) | "storm" (Bão lốc ±32°, speed 2.4).
     * "points": mảng toạ độ [{x, y}] từ Gốc đến Ngọn — points[0] là GỐC CỐ ĐỊNH (đứng yên 100% làm mố neo), điểm cuối là NGỌN TỰ DO (đung đưa mạnh nhất). Nếu mẫu đã có sẵn points thì giữ nguyên.
     * "direction": "down" (tóc dài, tà áo rủ xuống) | "up" (cây cỏ, hoa mọc từ đất lên) | "horizontal" (khăn choàng, cờ bay ngang).
     * "amplitude" (0..45°): biên độ góc uốn tại ngọn (đi bộ nhẹ: 4..8°; chạy/gió vừa: 10..15°; tung chiêu/gió mạnh: 18..26°).
     * "speed" (0.2..3.0): tốc độ nhịp gió (chu kỳ/giây). Nên đồng bộ với nhịp động tác (VD bước đi 1.6s -> speed: 0.65..0.85; đứng thở -> speed: 0.45..0.6).
     * "stiffness" (0.1..0.85): độ cứng giữ form ở gốc (vải dày/thân cây: 0.45..0.65; tóc mềm/dải lụa: 0.20..0.35).
     * "flexibility" (0.15..0.90): độ dẻo uốn sóng S-curve & vẩy ngọn trễ pha (tóc dài/áo choàng: 0.45..0.65; cành cây: 0.25..0.40).
     * "turbulence" (0.0..0.90): độ nhiễu loạn tự nhiên tránh lắc đều như máy (gió êm: 0.10..0.20; gió tự nhiên: 0.22..0.35).
     * "lean" (-45..+45°): góc nghiêng nền theo chiều gió hoặc quán tính ngược chiều chạy (đi/chạy tiến tới: 4..10°).
     * "phaseOffset" (0..3.0s): độ lệch pha giữa các trục gió (đặt chênh nhau 0.25..0.45s để các lọn tóc/tà áo bay so le tự nhiên).
     * "verticalBob" (0..0.25): độ nhún phập phồng dọc theo nhịp gió (0.04..0.08).`
}

/** Sinh khối JSON mẫu cho trường `"wind"` trong AI Prompt */
export function buildPromptWindJsonExampleBlock(composite?: LayerComposite): string {
  const cleanSpines = filterExportableWindSpines(composite)
  if (cleanSpines.length > 0) {
    const sp = cleanSpines[0]
    return `  "wind": {
    "enabled": true,
    "weatherPreset": "breeze",
    "lean": ${sp.lean ?? 4},
    "plantSpines": [
      {
        "id": "${sp.id}",
        "name": "${sp.name}",
        "layerIds": ${JSON.stringify(sp.layerIds)},
        "points": ${JSON.stringify(sp.points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })))},
        "amplitude": ${Number(sp.amplitude.toFixed(1))},
        "speed": ${Number(sp.speed.toFixed(2))},
        "stiffness": ${Number(sp.stiffness.toFixed(2))},
        "flexibility": ${Number(sp.flexibility.toFixed(2))},
        "turbulence": ${Number(sp.turbulence.toFixed(2))},
        "lean": ${sp.lean ?? 4},
        "phaseOffset": ${sp.phaseOffset ?? 0},
        "verticalBob": ${sp.verticalBob ?? 0.05}
      }
    ]
  }`
  }

  const softLayer = composite?.layers.find((l) => isDedicatedWindAccessoryOrNatureLayer(l, composite?.category))
  if (softLayer) {
    return `  "wind": {
    "enabled": true,
    "weatherPreset": "breeze",
    "lean": 4,
    "plantSpines": [
      {
        "name": "Gió đung đưa ${softLayer.name}",
        "layerIds": ["${softLayer.id}"],
        "direction": "down",
        "amplitude": 8,
        "speed": 0.75,
        "stiffness": 0.32,
        "flexibility": 0.48,
        "turbulence": 0.2,
        "lean": 4,
        "phaseOffset": 0,
        "verticalBob": 0.05
      }
    ]
  }`
  }

  return `  "wind": {
    "enabled": false,
    "weatherPreset": "breeze",
    "lean": 0,
    "plantSpines": []
  }`
}



function resolveLayerIdFromComposite(rawIdOrName: string, composite?: LayerComposite): string {
  if (!composite?.layers?.length) return rawIdOrName
  const clean = rawIdOrName.trim().toLowerCase()
  const exact = composite.layers.find((l) => l.id.toLowerCase() === clean || l.name.toLowerCase() === clean)
  if (exact) return exact.id
  const partial = composite.layers.find(
    (l) =>
      l.id.toLowerCase().includes(clean) ||
      l.name.toLowerCase().includes(clean) ||
      clean.includes(l.name.toLowerCase())
  )
  return partial ? partial.id : rawIdOrName
}

export function parseWindFromData(
  data: Record<string, unknown>,
  composite?: LayerComposite,
  fixesApplied: string[] = []
): ParsedWindData | undefined {
  const rawWind =
    typeof data.wind === 'object' && data.wind !== null ? (data.wind as Record<string, unknown>) : undefined
  const rawTopSpines = Array.isArray(data.plantSpines) ? data.plantSpines : undefined
  const rawTopMotions = Array.isArray(data.layerMotions) ? data.layerMotions : undefined

  if (!rawWind && !rawTopSpines && !rawTopMotions) return undefined

  const weatherIdRaw = typeof rawWind?.weatherPreset === 'string' ? rawWind.weatherPreset : undefined
  const weatherPresetObj = WIND_WEATHER_PRESETS.find((w) => w.id === weatherIdRaw)
  const defaultParams = weatherPresetObj?.params ?? WIND_WEATHER_PRESETS[0].params
  const globalLean = typeof rawWind?.lean === 'number' && Number.isFinite(rawWind.lean) ? rawWind.lean : 0

  const rawSpinesList = Array.isArray(rawWind?.plantSpines)
    ? rawWind.plantSpines
    : rawTopSpines ?? []

  const plantSpines: PlantSpine[] = []
  for (let i = 0; i < rawSpinesList.length; i++) {
    const item = rawSpinesList[i]
    if (typeof item !== 'object' || item === null) continue
    const s = item as Record<string, unknown>

    const rawLayerIds = Array.isArray(s.layerIds)
      ? s.layerIds.filter((id): id is string => typeof id === 'string')
      : typeof s.layerId === 'string'
        ? [s.layerId]
        : []
    const resolvedLayerIds = rawLayerIds
      .map((id) => resolveLayerIdFromComposite(id, composite))
      .filter((id) => !composite || composite.layers.some((l) => l.id === id))

    const finalLayerIds =
      resolvedLayerIds.length > 0
        ? resolvedLayerIds
        : composite?.layers?.length
          ? [
              (
                composite.layers.find((l) => /head|hair|đầu|tóc|torso|áo/i.test(`${l.id} ${l.name}`)) ??
                composite.layers[0]
              ).id
            ]
          : rawLayerIds

    const dirRaw = typeof s.direction === 'string' ? s.direction : 'down'
    const direction: PlantSpineDirection =
      dirRaw === 'up' || dirRaw === 'horizontal' || dirRaw === 'down' ? dirRaw : 'down'

    let points: PlantSpinePoint[] = []
    if (Array.isArray(s.points)) {
      points = s.points
        .filter(
          (p): p is { x: number; y: number } =>
            typeof p === 'object' &&
            p !== null &&
            typeof (p as any).x === 'number' &&
            typeof (p as any).y === 'number'
        )
        .map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))
    }
    if (points.length < 2) {
      points = composite
        ? buildAutoPlantSpinePoints(composite, finalLayerIds, i, direction)
        : [
            { x: 0, y: -210 },
            { x: 0, y: -165 },
            { x: 0, y: -120 },
            { x: 0, y: -75 }
          ]
    }

    const numOr = (val: unknown, fallback: number, min: number, max: number) =>
      typeof val === 'number' && Number.isFinite(val) ? Math.max(min, Math.min(max, val)) : fallback

    plantSpines.push({
      id:
        typeof s.id === 'string' && s.id.trim()
          ? s.id.trim()
          : `spine-ai-${Date.now().toString(36)}-${i}`,
      name:
        typeof s.name === 'string' && s.name.trim()
          ? s.name.trim()
          : `Trục gió ${i + 1} (${weatherPresetObj?.label || 'Tự nhiên'})`,
      points,
      layerIds: finalLayerIds,
      amplitude: numOr(s.amplitude, defaultParams.amplitude, 0, 90),
      speed: numOr(s.speed, defaultParams.speed, 0.05, 8),
      stiffness: numOr(s.stiffness, defaultParams.stiffness, 0, 1),
      flexibility: numOr(s.flexibility, defaultParams.flexibility, 0, 1),
      turbulence: numOr(s.turbulence, defaultParams.turbulence, 0, 1),
      lean: numOr(s.lean, globalLean, -60, 60),
      phaseOffset: numOr(s.phaseOffset, i * 0.35, -10, 10),
      reach: numOr(s.reach, 0, 0, 2000),
      verticalBob: numOr(s.verticalBob, defaultParams.verticalBob ?? 0.06, 0, 1),
      enabled: s.enabled !== false
    })
  }

  // Nếu AI bật wind.enabled = true + có weatherPreset nhưng để trống plantSpines, tự tạo trục gió cho tóc/đầu
  if (rawWind?.enabled === true && plantSpines.length === 0 && composite && composite.layers.length > 0) {
    const hairOrHead =
      composite.layers.find((l) => /head|hair|đầu|tóc|cape|áo/i.test(`${l.id} ${l.name}`)) ??
      composite.layers[0]
    const autoPoints = buildAutoPlantSpinePoints(composite, [hairOrHead.id], 0, 'down')
    plantSpines.push({
      id: `spine-ai-auto-${Date.now().toString(36)}`,
      name: `Gió ${weatherPresetObj?.label || 'Tự nhiên'} (${hairOrHead.name})`,
      points: autoPoints,
      layerIds: [hairOrHead.id],
      ...defaultParams,
      lean: globalLean,
      phaseOffset: 0,
      reach: 0,
      enabled: true
    })
    fixesApplied.push(`Tự động khởi tạo trục sống Gió trên mảnh "${hairOrHead.name}" theo cấu hình wind`)
  }

  const rawMotionsList = Array.isArray(rawWind?.layerMotions)
    ? rawWind.layerMotions
    : rawTopMotions ?? []
  const layerMotions: MotionLayerWindItem[] = []
  for (const item of rawMotionsList) {
    if (typeof item !== 'object' || item === null) continue
    const m = item as Record<string, unknown>
    const rawId = typeof m.layerId === 'string' ? m.layerId : typeof m.id === 'string' ? m.id : ''
    if (!rawId) continue
    const layerId = resolveLayerIdFromComposite(rawId, composite)
    const type: MotionType =
      typeof m.type === 'string' && VALID_MOTION_TYPES.has(m.type as MotionType)
        ? (m.type as MotionType)
        : 'sway'
    const anchor: MotionAnchor =
      typeof m.anchor === 'string' && VALID_ANCHORS.has(m.anchor as MotionAnchor)
        ? (m.anchor as MotionAnchor)
        : 'bottom'
    const speed = typeof m.speed === 'number' && Number.isFinite(m.speed) ? Math.max(0.1, Math.min(10, m.speed)) : 1
    const amplitude =
      typeof m.amplitude === 'number' && Number.isFinite(m.amplitude) ? Math.max(0, Math.min(100, m.amplitude)) : 6
    layerMotions.push({
      layerId,
      layerName: typeof m.layerName === 'string' ? m.layerName : undefined,
      type,
      speed,
      amplitude,
      anchor,
      ...(typeof m.phaseOffset === 'number' && Number.isFinite(m.phaseOffset) ? { phaseOffset: m.phaseOffset } : {})
    })
  }

  const enabled =
    typeof rawWind?.enabled === 'boolean'
      ? rawWind.enabled
      : plantSpines.length > 0 || layerMotions.length > 0

  return {
    enabled,
    weatherPreset: (weatherPresetObj?.id ?? 'custom') as WindWeatherPresetId | 'custom',
    lean: globalLean,
    plantSpines,
    layerMotions
  }
}

