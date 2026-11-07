import type { AnimationClip, BoneEasing, BoneKeyframe, LayerBone, MotionViewAngle } from '@shared/layerRig'
import type { PlantSpine, PlantSpinePoint } from '@shared/plantSpine'
import type { LayerComposite, MotionAnchor, MotionType } from './types'
import {
  buildAutoPlantSpinePoints,
  WIND_WEATHER_PRESETS,
  type PlantSpineDirection,
  type WindWeatherPresetId
} from './workshopPlantSpines'
import {
  buildBoneBiomechanicsGuide,
  buildMeshDeformationExportSection,
  buildOrientationGuide,
  inferDescriptiveClipName,
  isGenericClipName,
  normalizeAndFixBiomechanicalTracks,
  upgradeCompositeSoftMeshForImpact,
  type MotionMeshExportSection,
  type MotionOrientationGuide
} from './workshopClipBiomechanics'

export {
  isGenericClipName,
  inferDescriptiveClipName,
  normalizeAndFixBiomechanicalTracks,
  buildMeshDeformationExportSection,
  upgradeCompositeSoftMeshForImpact,
  buildOrientationGuide,
  type MotionMeshExportSection,
  type MotionOrientationGuide
}

export interface MotionLayerWindItem {
  layerId: string
  layerName?: string
  type: MotionType
  speed: number
  amplitude: number
  anchor: MotionAnchor
  phaseOffset?: number
}

export interface MotionWindSpineExportItem {
  id: string
  name: string
  layerIds: string[]
  direction?: PlantSpineDirection
  points: PlantSpinePoint[]
  amplitude: number
  speed: number
  stiffness: number
  flexibility: number
  turbulence: number
  lean?: number
  phaseOffset?: number
  reach?: number
  verticalBob?: number
  enabled?: boolean
  motion?: PlantSpine['motion']
}

export interface MotionWindExportSection {
  enabled: boolean
  weatherPreset?: WindWeatherPresetId | 'custom'
  lean?: number
  plantSpines: MotionWindSpineExportItem[]
  layerMotions?: MotionLayerWindItem[]
}

export interface MotionJsonExportFormat {
  format: 'parallax-motion-v1'
  name: string
  duration: number
  loop: boolean
  fps?: number
  viewAngle?: 'front' | 'diagonal' | 'side' | 'back'
  /** Chi tiết góc độ (°), hướng nhìn khuôn mặt & quy tắc giải phẫu riêng cho góc đó */
  characterOrientation?: MotionOrientationGuide
  description?: string
  rigConventions?: {
    coordinateSystem: string
    namingConvention?: {
      rule: string
      explanation: string
      screenLeft: string
      screenRight: string
      contralateralCoordination: string
    }
    viewAngleGuide?: string
    depthOrderRule?: string
    perspectiveWalkDepthRule?: {
      summary: string
      forwardFoot: { yPosition: string; scale: string; depthOrder: string }
      backwardFoot: { yPosition: string; scale: string; depthOrder: string }
      contralateralArm: { forwardArm: string; backwardArm: string }
      torsoAndHeadBob: { rule: string }
      zOrderTransition: string
    }
    armRotationRule: string
    frontViewLegRule: string
    pelvisVerticalRule: string
    meshImpactRule: string
  }
  /** Danh sách xương kèm hướng dẫn cơ học từng khớp */
  bones: Array<{
    id: string
    name: string
    parentId?: string | null
    role?: string
    x?: number
    y?: number
    length?: number
    angle?: number
    meshEnvelope?: boolean
    strength?: number
    influenceReach?: number
    pin?: boolean
    boundLayers?: string[]
    directionGuide?: string
  }>
  /** Danh sách các mảnh Layer kèm chế độ gắn Mesh (soft/rigid) & vật lý */
  layers?: Array<{
    id: string
    name: string
    z?: number
    depthOrder?: string
    boneId?: string | null
    bindingMode?: 'soft' | 'rigid'
    extraBoneIds?: string[]
    partGroupId?: string | null
    isCloth?: boolean
    physicsMaterial?: string | null
  }>
  /** Keyframe của từng xương theo thời gian */
  tracks: Record<string, BoneKeyframe[]>
  /** Cấu hình biến dạng Lưới Mesh chịu tác lực tiếp đất & uốn mềm da cơ (Soft Mesh & Ground Impact) */
  meshDeformation?: MotionMeshExportSection
  /** Cấu hình chuyển động Gió uốn mềm (Tóc, Tà áo, Khăn choàng, Cành lá) */
  wind?: MotionWindExportSection
}

const VALID_EASINGS = new Set<BoneEasing>([
  'smooth',
  'linear',
  'hold',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'bezier'
])

const VALID_MOTION_TYPES = new Set<MotionType>(['none', 'sway', 'breathe', 'float', 'wave', 'rocking'])
const VALID_ANCHORS = new Set<MotionAnchor>(['bottom', 'center', 'top', 'left', 'right'])

function inferWeatherPresetFromSpines(spines: ReadonlyArray<PlantSpine>): WindWeatherPresetId | 'custom' {
  if (!spines.length) return 'breeze'
  const avgAmp = spines.reduce((acc, s) => acc + (s.amplitude || 0), 0) / spines.length
  if (avgAmp <= 8) return 'breeze'
  if (avgAmp <= 16) return 'moderate'
  if (avgAmp <= 26) return 'strong'
  return 'storm'
}

/**
 * Xuất AnimationClip kèm thông tin khung xương, hướng dẫn cơ học 2.5D và cấu hình Gió (wind) thành JSON chuẩn
 */
export interface ExportClipJsonOptions {
  composite?: LayerComposite
  includeWind?: boolean
  includeMesh?: boolean
  suggestedName?: string
}

export function exportAnimationClipToJson(
  clip: AnimationClip,
  bones: LayerBone[],
  pretty = true,
  optionsOrComposite?: LayerComposite | ExportClipJsonOptions
): string {
  const opts: ExportClipJsonOptions =
    optionsOrComposite && 'layers' in optionsOrComposite && Array.isArray(optionsOrComposite.layers)
      ? { composite: optionsOrComposite, includeWind: true }
      : (optionsOrComposite as ExportClipJsonOptions) ?? { includeWind: true }
  const composite = opts.composite
  const includeWind = opts.includeWind !== false
  const includeMesh = opts.includeMesh !== false
  const viewAngle = clip.viewAngle ?? 'front'
  const bonesMeta = buildBoneBiomechanicsGuide(bones, composite, viewAngle).map((b) => ({
    id: b.id,
    name: b.name,
    parentId: b.parentId,
    role: b.role,
    x: b.x,
    y: b.y,
    length: b.length,
    angle: b.angle,
    meshEnvelope: b.meshEnvelope,
    strength: b.strength,
    influenceReach: b.influenceReach,
    ...(b.pin ? { pin: true } : {}),
    ...(b.boundLayers.length > 0 ? { boundLayers: b.boundLayers } : {}),
    directionGuide: b.directionGuide
  }))

  const sortedTracks: Record<string, BoneKeyframe[]> = {}
  for (const b of bones) {
    if (clip.tracks[b.id] && clip.tracks[b.id].length > 0) {
      sortedTracks[b.id] = clip.tracks[b.id]
    }
  }
  for (const [boneId, kfs] of Object.entries(clip.tracks)) {
    if (!sortedTracks[boneId] && kfs && kfs.length > 0) {
      sortedTracks[boneId] = kfs
    }
  }

  const effectiveName =
    opts.suggestedName && !isGenericClipName(opts.suggestedName)
      ? opts.suggestedName.trim()
      : isGenericClipName(clip.name)
        ? inferDescriptiveClipName(sortedTracks, bones, composite?.plantSpines?.length ?? 0, clip.description)
        : clip.name

  const spines = composite?.plantSpines ?? []
  const layerMotions: MotionLayerWindItem[] = (composite?.layers ?? [])
    .filter((l) => l.motion && l.motion.type !== 'none' && l.motion.amplitude > 0)
    .map((l) => ({
      layerId: l.id,
      layerName: l.name,
      type: l.motion.type,
      speed: Number((l.motion.speed ?? 1).toFixed(2)),
      amplitude: Number((l.motion.amplitude ?? 0).toFixed(2)),
      anchor: l.motion.anchor ?? 'bottom',
      ...(l.motion.phaseOffset ? { phaseOffset: Number(l.motion.phaseOffset.toFixed(2)) } : {})
    }))

  const windSection: MotionWindExportSection = {
    enabled: spines.some((s) => s.enabled !== false) || layerMotions.length > 0,
    weatherPreset: inferWeatherPresetFromSpines(spines),
    lean: spines[0]?.lean ?? 0,
    plantSpines: spines.map((s) => ({
      id: s.id,
      name: s.name,
      layerIds: s.layerIds,
      points: s.points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
      amplitude: Number(s.amplitude.toFixed(2)),
      speed: Number(s.speed.toFixed(2)),
      stiffness: Number(s.stiffness.toFixed(2)),
      flexibility: Number(s.flexibility.toFixed(2)),
      turbulence: Number(s.turbulence.toFixed(2)),
      ...(s.lean !== undefined ? { lean: Number(s.lean.toFixed(1)) } : {}),
      ...(s.phaseOffset !== undefined ? { phaseOffset: Number(s.phaseOffset.toFixed(2)) } : {}),
      ...(s.reach !== undefined ? { reach: Math.round(s.reach) } : {}),
      ...(s.verticalBob !== undefined ? { verticalBob: Number(s.verticalBob.toFixed(2)) } : {}),
      enabled: s.enabled !== false,
      ...(s.motion ? { motion: s.motion } : {})
    })),
    ...(layerMotions.length > 0 ? { layerMotions } : {})
  }

  const payload: MotionJsonExportFormat = {
    format: 'parallax-motion-v1',
    name: effectiveName,
    duration: Number(clip.duration.toFixed(2)),
    loop: clip.loop ?? true,
    fps: clip.fps ?? 30,
    viewAngle,
    description: clip.description || undefined,
    characterOrientation: buildOrientationGuide(viewAngle),
    rigConventions: {
      coordinateSystem: '2D Screen Space (+X sang phải, +Y hướng xuống, +rotation xoay cùng chiều kim đồng hồ).',
      namingConvention: {
        rule: 'SCREEN_SPACE_NAMING',
        explanation: 'Hậu tố "-l" (Left) và "-r" (Right) được đặt THEO MÀN HÌNH (Screen Space), KHÔNG PHẢI giải phẫu nhân vật.',
        screenLeft: 'ID có đuôi "-l" (arm-l, leg-l, thigh-l, shin-l, foot-l) nằm ở BÊN TRÁI MÀN HÌNH (X < 0). Ở góc chính diện 0°, đây là TAY/CHÂN PHẢI CỦA BẢN THÂN NHÂN VẬT.',
        screenRight: 'ID có đuôi "-r" (arm-r, leg-r, thigh-r, shin-r, foot-r) nằm ở BÊN PHẢI MÀN HÌNH (X > 0). Ở góc chính diện 0°, đây là TAY/CHÂN TRÁI CỦA BẢN THÂN NHÂN VẬT.',
        contralateralCoordination: 'PHỐI HỢP TAY - CHÂN NGHỊCH PHA: Khi chân bên trái màn hình bước tới trước, BẮT BUỘC vung tay bên phải màn hình ra trước ngực (zOrder: 50). Khi chân bên phải màn hình bước tới trước, BẮT BUỘC vung tay bên trái màn hình ra trước ngực (zOrder: 50). Tuyệt đối không đi cùng tay cùng chân!'
      },
      perspectiveWalkDepthRule: {
        summary: 'Quy tắc tạo ảo giác chiều sâu 2.5D khi nhân vật bước đi / tiến về phía camera',
        forwardFoot: {
          yPosition: 'Thấp hơn trên màn hình (y: +6..+12px) vì bàn chân bước về gần camera tiếp đất ở vị trí thấp hơn trong phối cảnh.',
          scale: 'To hơn (scaleX & scaleY: 1.05..1.10) theo luật phối cảnh gần to xa nhỏ.',
          depthOrder: 'BẮT BUỘC ĐÈ LÊN chân kia: đặt zOrder cao hơn chân kia (ví dụ zOrder: 15 trong khi chân sau zOrder: -15).'
        },
        backwardFoot: {
          yPosition: 'Cao hơn trên màn hình (y: -4..-10px) khi nhấc ra phía sau.',
          scale: 'Nhỏ hơn (scaleX & scaleY: 0.93..0.96) theo luật phối cảnh xa nhỏ.',
          depthOrder: 'Bị che: zOrder thấp hơn chân trước, chui ra phía sau.'
        },
        contralateralArm: {
          forwardArm: 'Tay đối diện chân bước tới đưa ra trước ngực: zOrder: 50 (đè lên thân áo sơ mi Z=0).',
          backwardArm: 'Tay cùng bên chân bước tới đưa ra sau lưng: zOrder: -50 (chui ra sau thân áo).'
        },
        torsoAndHeadBob: {
          rule: 'Khi đi tới camera: Thân và Đầu hơi to ra (scale: 1.02..1.04, y nhún nhẹ +2px) ở bước tiếp đất dồn lực và hơi nhỏ lại (scale: 0.98..1.0) ở bước nhấc chân.'
        },
        zOrderTransition: 'Đổi lớp zOrder là bước nhảy tức thời (dùng easing: "hold" hoặc chuyển đổi trong 0.03s - 0.05s), không nội suy mờ mịt.'
      },
      viewAngleGuide: `Nhân vật đang ở góc ${viewAngle === 'side' ? 'NGANG 90° (side)' : viewAngle === 'diagonal' ? 'CHÉO 45° (diagonal)' : viewAngle === 'back' ? 'SAU LƯNG 180° (back)' : 'CHÍNH DIỆN 0° (front)'}. ${buildOrientationGuide(viewAngle).description}`,
      depthOrderRule:
        'Quy chuẩn Z-Index / Chiều sâu 2.5D: Z càng CAO (dương) thì bộ phận CÀNG Ở PHÍA TRƯỚC (Foreground, hiển thị đè lên các bộ phận khác). Z càng THẤP (âm) thì CÀNG Ở PHÍA SAU (Background, bị các bộ phận có Z cao hơn đè lên). Ví dụ: Kính mắt Z=+42 > Biểu cảm mặt Z=+30..+32 > Đầu Z=+20 > Thân áo Z=0 > Đùi/Cẳng chân Z=-20..-25 > Cánh tay sau Z=-35..-40.',
      armRotationRule:
        'Bắp tay trái (arm-l) & phải (arm-r) mặc định buông xuống (~90°). Muốn GIƠ TAY TRÁI RA NGOÀI / LÊN CAO: arm-l phải DƯƠNG (+25°..+125°). Muốn GIƠ TAY PHẢI RA NGOÀI / LÊN CAO: arm-r phải ÂM (-25°..-125°). Tuyệt đối không đặt ngược dấu làm 2 tay đâm chéo qua bụng!',
      frontViewLegRule:
        'Ở góc chính diện 0° (front): khi khuỵu gối / nhún nhảy, đặt thigh-l DƯƠNG nhẹ (+8°..+16°), thigh-r ÂM nhẹ (-8°..-16°), shin-l ÂM (-6°..-14°), shin-r DƯƠNG (+6°..+14°) KÈM scaleY (0.88..0.94) để tạo phối cảnh thu ngắn 2.5D. Không xoay chân ±35° ở góc 0°.',
      pelvisVerticalRule:
        'Hông gốc (pelvis): y > 0 (+8..+22px) là nhún gối hạ thấp; y < 0 (-15..-46px) là bật nhảy lên cao. Giữ trong ngưỡng -48px <= y <= +22px để chân bám đất tự nhiên.',
      meshImpactRule:
        'Biến dạng lưới Mesh chịu tác lực tiếp đất (Soft Mesh & Ground Contact Impact): Các bộ phận cơ thể uốn mềm theo lưới tam giác Alpha Mesh (bindingMode: "soft", meshEnvelope: true). Khi chân tiếp xúc mặt đất (nhún lấy đà / tiếp đất chịu lực), BẮT BUỘC truyền phản lực nén Mesh qua scaleX > 1 & scaleY < 1: Bàn chân (foot-l/r) bè ngang & nén dẹt (scaleX: 1.14..1.18, scaleY: 0.82..0.86, y: +2..+4), Cẳng chân (shin-l/r) nén cơ (scaleX: 1.06, scaleY: 0.88, y: -6), Đùi (thigh-l/r) nén phối cảnh (scaleX: 1.05, scaleY: 0.89). Khi bật nhảy rời đất, duỗi thon Mesh bàn chân (scaleX: 0.94, scaleY: 1.10).'
    },
    bones: bonesMeta,
    ...(composite?.layers?.length
      ? {
          layers: composite.layers.map((l) => {
            const zVal = Math.round(l.z ?? 0)
            const depthRole = zVal > 15 ? 'foreground' : zVal < -15 ? 'background' : 'mid'
            return {
              id: l.id,
              name: l.name,
              z: zVal,
              depthOrder: `${depthRole} (Z: ${zVal >= 0 ? '+' : ''}${zVal}px · ${zVal > 0 ? 'ở phía trước' : zVal < 0 ? 'ở phía sau' : 'ở giữa'})`,
              boneId: l.boneId || null,
              bindingMode: l.bindingMode ?? 'soft',
              ...(l.extraBoneIds?.length ? { extraBoneIds: l.extraBoneIds } : {}),
              partGroupId: l.partGroupId || null,
              ...(l.isCloth ? { isCloth: true } : {}),
              physicsMaterial: l.physics?.enabled ? l.physics.material : null
            }
          })
        }
      : {}),
    tracks: sortedTracks,
    ...(includeMesh ? { meshDeformation: buildMeshDeformationExportSection(bones, composite) } : {}),
    ...(includeWind ? { wind: windSection } : {})
  }

  return JSON.stringify(payload, null, pretty ? 2 : undefined)
}

/**
 * Sinh Prompt hướng dẫn chi tiết dành cho AI (ChatGPT, Claude, Gemini, DeepSeek...)
 * kèm bảng giải phẫu chiều xoay từng xương + hướng dẫn tạo hiệu ứng Gió (Tóc/Áo/Cây).
 */
export function generateAiMotionPrompt(
  clip: AnimationClip,
  bones: LayerBone[],
  promptIntent = 'Tạo động tác hoạt ảnh tự nhiên cho nhân vật',
  optionsOrComposite?: LayerComposite | ExportClipJsonOptions,
  legacySuggestedName?: string
): string {
  const opts: ExportClipJsonOptions =
    optionsOrComposite && 'layers' in optionsOrComposite && Array.isArray(optionsOrComposite.layers)
      ? { composite: optionsOrComposite, includeWind: true, suggestedName: legacySuggestedName }
      : (optionsOrComposite as ExportClipJsonOptions) ?? { includeWind: true, suggestedName: legacySuggestedName }
  const composite = opts.composite
  const suggestedName = opts.suggestedName ?? legacySuggestedName
  const viewAngle = clip.viewAngle ?? 'front'
  const boneMetaList = buildBoneBiomechanicsGuide(bones, composite, viewAngle)
  const boneTreeLines = boneMetaList.map((b) => {
    const parent = bones.find((p) => p.id === b.parentId)
    const parentLabel = parent ? `Cha: "${parent.name}" [${parent.id}]` : 'Gốc / Root'
    const layersText = b.boundLayers.length ? ` | Layer gắn: ${b.boundLayers.join(', ')}` : ''
    return `  - ID: "${b.id}" | Tên: "${b.name}" (${parentLabel}, Góc nghỉ: ${b.angle}°, Dài: ${b.length}px${layersText})\n    ↳ Quy tắc cơ học: ${b.directionGuide}`
  })

  const layerLines = (composite?.layers ?? []).map((l) => {
    const zVal = Math.round(l.z ?? 0)
    const posDesc = zVal > 15 ? 'Phía trước (Foreground · Đè lên)' : zVal < -15 ? 'Phía sau (Background · Bị đè)' : 'Ở giữa (Mid)'
    return `  - Layer ID: "${l.id}" | Tên: "${l.name}" | Z: ${zVal >= 0 ? '+' : ''}${zVal}px (${posDesc}) | Gắn xương: "${l.boneId || 'không'}"`
  })

  const nameInstruction =
    suggestedName && !isGenericClipName(suggestedName)
      ? `"${suggestedName.trim()}"`
      : !isGenericClipName(clip.name)
        ? `"${clip.name}" (hoặc đặt tên mới sát với yêu cầu hoạt ảnh)`
        : 'BẮT BUỘC tự đặt tên tiếng Việt ngắn gọn, giàu hình ảnh mô tả đúng động tác (VD: "Nhún nhảy vươn tay", "Vẫy chào trong gió", "Đứng thở tự nhiên") — TUYỆT ĐỐI KHÔNG đặt là "Động tác 1..9" hay "Tên động tác"'

  return `Bạn là một Chuyên gia Diễn hoạt 2.5D (Senior 2D/2.5D Technical Animator). Hãy thiết kế chuyển động khung xương (Bone Keyframes) kết hợp chuyển động Gió uốn mềm (Wind / Plant Spines cho tóc, áo, phụ kiện) trong ứng dụng Parallax Studio.

🎯 YÊU CẦU HOẠT ẢNH TỪ NGƯỜI DÙNG:
${promptIntent}

⏱️ THÔNG SỐ ĐỘNG TÁC:
- Tên động tác ("name"): ${nameInstruction}
- Thời lượng ("duration"): ${clip.duration.toFixed(1)} giây (có thể điều chỉnh 1.2s – 3.0s tuỳ nhịp độ động tác)
- Tốc độ khung hình ("fps"): ${clip.fps ?? 30} fps
- Vòng lặp ("loop"): ${clip.loop ? 'true (Lặp vô tận — tư thế tại time = 0 và time = duration BẮT BUỘC giống hệt nhau)' : 'false (Chạy 1 lần)'}
📐 GÓC ĐỘ & HƯỚNG NHÌN NHÂN VẬT ("characterOrientation"):
- Mã góc nhìn ("viewAngle"): "${viewAngle}" (${viewAngle === 'front' ? 'Chính diện 0°' : viewAngle === 'side' ? 'Góc ngang 90°' : viewAngle === 'diagonal' ? 'Góc chéo 45°' : 'Góc sau lưng 180°'})
- Hướng mặt & thân người: ${buildOrientationGuide(viewAngle).facing}
- Đặc điểm giải phẫu góc này: ${buildOrientationGuide(viewAngle).description}

🦴 CẤU TRÚC KHUNG XƯƠNG & QUY ƯỚC CHIỀU XOAY TỪNG KHỚP (BẮT BUỘC TUÂN THỦ 100%):
${boneTreeLines.join('\n')}

${layerLines.length > 0 ? `🧩 DANH SÁCH MẢNH LAYER (ĐỂ GẮN HIỆU ỨNG GIÓ "wind" CHO TÓC / ÁO / ĐẠO CỤ):\n${layerLines.join('\n')}\n` : ''}📋 QUY TẮC KEYFRAME & GIẢI PHẪU 2.5D QUAN TRỌNG (TRÁNH LỖI DỊ DẠNG):
1. Quy ước đặt tên xương theo Màn hình & Chiều xoay 2 cánh tay (CỰC KỲ QUAN TRỌNG):
   - ĐẶT TÊN THEO MÀN HÌNH (Screen Space): ID có đuôi "-l" (arm-l, thigh-l, foot-l...) nằm ở BÊN TRÁI MÀN HÌNH (X < 0). Với nhân vật nhìn chính diện 0°, đây là NỬA NGƯỜI BÊN PHẢI CỦA BẢN THÂN NHÂN VẬT. ID "-r" nằm ở BÊN PHẢI MÀN HÌNH (X > 0), là NỬA NGƯỜI BÊN TRÁI NHÂN VẬT.
   - PHỐI HỢP TAY - CHÂN NGHỊCH PHA (Contralateral Limb Swing): Khi chân bên trái màn hình bước tới trước, BẮT BUỘC vung tay bên phải màn hình ra trước ngực ("zOrder": 50). Khi chân bên phải màn hình bước tới trước, BẮT BUỘC vung tay bên trái màn hình ra trước ngực ("zOrder": 50). Tuyệt đối không đi cùng tay cùng chân làm thân bị xoắn ngược!
   - Hai cánh tay ở tư thế nghỉ đều buông dọc xuống (~90°).
   - Muốn GIƠ TAY TRÁI ("bone-arm-l") mở sang trái & lên cao: "rotation" PHẢI LÀ SỐ DƯƠNG (+25° đến +125°).
   - Muốn GIƠ TAY PHẢI ("bone-arm-r") mở sang phải & lên cao: "rotation" PHẢI LÀ SỐ ÂM (-25° đến -125°).
   - QUY ƯỚC CHIỀU SÂU Z-INDEX: Z hoặc zOrder CÀNG CAO thì bộ phận CÀNG Ở PHÍA TRƯỚC (hiển thị đè lên các bộ phận khác); Z càng thấp thì càng ở phía sau (bị đè lên). Nếu vung tay ra trước ngực (vẫy tay, cúi chào, vung đòn), đặt "zOrder": 50 (lớn hơn Z thân áo = 0) để tay nổi lên trước ngực. Nếu giấu tay ra sau lưng, đặt "zOrder": -50 để chìm sau thân áo.
2. Quy ước 2 chân & Hông ở góc Chính diện 0° ("front"):
   - Khi nhún gối / hạ trọng tâm: Hông ("bone-pelvis") dịch xuống "y" DƯƠNG vừa phải (+10 đến +22px, KHÔNG vượt quá +24px kẻo lún chân xuống đất). Khi bật nhảy lên không: "y" ÂM (-20 đến -45px, KHÔNG vượt quá -50px kẻo bay mất khỏi khung hình).
   - Khi khuỵu 2 gối ở góc Chính diện 0°: mở nhẹ 2 gối đối xứng ("bone-thigh-l" DƯƠNG +10°..+16°, "bone-thigh-r" ÂM -10°..-16°, "bone-shin-l" ÂM -8°..-14°, "bone-shin-r" DƯƠNG +8°..+14°) VÀ BẮT BUỘC kết hợp thu ngắn phối cảnh 2.5D "scaleY": 0.88..0.93 trên đùi & cẳng chân. Tuyệt đối KHÔNG đặt thigh-l âm / thigh-r dương ở góc 0° vì sẽ làm 2 đầu gối chụm chữ X!
3. Đàn hồi Squash & Stretch cho Thân ("bone-torso") & Đầu ("bone-head"):
   - Khi nhún lấy đà / tiếp đất: "bone-torso" nén nhẹ ("scaleX": 1.03, "scaleY": 0.93, "y": 4).
   - Khi vươn người / bật nhảy / hít vào: "bone-torso" giãn nhẹ ("scaleX": 0.98, "scaleY": 1.03, "y": -3).
4. Biến dạng Lưới Mesh Chịu Tác Lực Tiếp Đất & Uốn Mềm Da Cơ ("meshDeformation" & Keyframe scaleX/scaleY):
   - Toàn bộ các mảnh cơ thể (đùi, cẳng chân, bàn chân, thân, cánh tay) đều dùng lưới tam giác Alpha Mesh uốn mềm ("bindingMode": "soft", "meshEnvelope": true).
   - KHI NHÚN LẤY ĐÀ / CHÂN TIẾP XÚC MẶT ĐẤT CHỊU LỰC (Ground Contact Impact):
     * Bàn chân ("bone-foot-l", "bone-foot-r"): chịu phản lực trực tiếp từ mặt sàn ➔ Mesh đế giày bè ngang và nén dẹt ("scaleX": 1.14..1.18, "scaleY": 0.82..0.86, "y": 2.5, "rotation": ±3°).
     * Cẳng chân ("bone-shin-l", "bone-shin-r"): hấp thụ xung lực từ cổ chân lên gối ➔ Mesh bắp chân & ống quần nén dọc, phình ngang ("scaleX": 1.06, "scaleY": 0.88, "y": -6).
     * Đùi ("bone-thigh-l", "bone-thigh-r"): nén cơ đùi phối cảnh 2.5D ("scaleX": 1.05, "scaleY": 0.89).
   - KHI BẬT NHẢY TRÊN KHÔNG / DUỖI CHÂN RỜI ĐẤT (Airborne Stretch):
     * Bàn chân ("bone-foot-l", "bone-foot-r"): thoát lực nén, duỗi thon mũi giày ("scaleX": 0.94, "scaleY": 1.10, "rotation": ∓6°).
     * Cẳng chân & Đùi: duỗi thon ("scaleX": 0.97, "scaleY": 1.04).
   - Bổ sung trường "meshDeformation" trong JSON đầu ra để kích hoạt uốn mềm Mesh ("meshEnvelope": true) và thông số nén phản lực mặt đất.
5. QUY ƯỚC CHIỀU SÂU Z-INDEX 2.5D ("depthConventions" & Thứ tự xếp lớp hiển thị):
   - Quy chuẩn bất biến của Parallax Studio: Z-INDEX / CHIỀU SÂU Z CÀNG CAO (DƯƠNG) THÌ CÀNG Ở PHÍA TRƯỚC (Foreground, hiển thị trên cùng đè lên các bộ phận khác). Z CÀNG THẤP (ÂM) THÌ CÀNG Ở PHÍA SAU (Background, bị các bộ phận có Z cao hơn đè lên).
   - Thứ tự xếp lớp giải phẫu chuẩn: Kính mắt / Phụ kiện trước (Z: +42) > Biểu cảm mặt (Z: +30..+32) > Đầu (Z: +20) > Thân áo sơ mi (Z: 0) > Đùi & Cẳng chân (Z: -20..-25) > Cánh tay sau (Z: -35..-40).
   - Khi tạo keyframe có chiều sâu: muốn đưa một chi tiết ra đằng trước một chi tiết khác, giá trị Z của chi tiết đó BẮT BUỘC phải lớn hơn Z của chi tiết bị che.
6. Hiệu ứng Gió uốn mềm ("wind") cho Tóc / Tà áo / Cành lá:
   - Bổ sung trường "wind" trong JSON để mái tóc (layer đầu/tóc) và tà áo (layer thân/áo) đung đưa mềm mại theo quán tính và thời tiết:
   - "weatherPreset": "breeze" (Hiu hiu ±6°) | "moderate" (Gió vừa ±13°) | "strong" (Gió mạnh ±22°) | "storm" (Gió lốc ±32°).
   - "plantSpines": danh sách trục uốn gió gắn vào layer tóc/đầu (direction: "down" cho tóc/áo rủ xuống, "up" cho cây cỏ mọc lên, "horizontal" cho khăn/cờ bay ngang).
7. BỘ QUY TẮC VÀNG PHỐI CẢNH 2.5D KHI BƯỚC ĐI / TIẾN VỀ PHÍA CAMERA (Tránh não đọc nhầm là đi lùi):
   - Ở sprite 2D, chuyển động đi tới và đi lùi rất dễ bị nhầm nếu thiếu tín hiệu phối cảnh chiều sâu. BẮT BUỘC kết hợp đủ 4 tín hiệu sau:
   a) Vị trí Y tiếp đất: Chân bước tới trước chạm sàn THẤP HƠN trên màn hình ("y": +6..+12px). Chân sau đang nhấc cao hơn ("y": -4..-10px).
   b) Kích thước Scale (Gần to xa nhỏ): Chân bước tới trước to hơn ("scaleX": 1.05..1.10, "scaleY": 1.05..1.10). Chân sau nhỏ hơn ("scaleX": 0.93..0.96, "scaleY": 0.93..0.96).
   c) Thứ tự đè lớp (zOrder): Chân bước tới trước BẮT BUỘC ĐÈ LÊN chân kia (chân trước đặt "zOrder": 15..20, chân sau đặt "zOrder": -15..-20). Đổi zOrder giữa 2 chân phải là bước nhảy tức thời ("easing": "hold" hoặc chuyển trong 0.03s..0.05s), không nội suy làm lộn xộn các lớp.
   d) Nhấp nhô Thân & Đầu (Torso & Head Bob): Thân và Đầu hơi to ra nhẹ ("scale": 1.02..1.04, nhún "y": +2px) ở bước tiếp đất dồn trọng tâm và thu nhỏ nhẹ ("scale": 0.98..1.0) ở bước nhấc chân.

📦 ĐỊNH DẠNG ĐẦU RA (BẮT BUỘC):
Chỉ trả về DUY NHẤT một khối mã JSON hợp lệ nằm trong \`\`\`json ... \`\`\` theo cấu trúc chuẩn sau:

\`\`\`json
{
  "format": "parallax-motion-v1",
  "name": "Tên động tác tiếng Việt cụ thể (VD: Nhún nhảy vươn tay)",
  "description": "Mô tả ngắn nhịp điệu động tác & hiệu ứng gió",
  "duration": ${clip.duration.toFixed(1)},
  "loop": ${clip.loop ? 'true' : 'false'},
  "fps": ${clip.fps ?? 30},
  "viewAngle": "${viewAngle}",
  "tracks": {
    "${bones[0]?.id || 'bone-pelvis'}": [
      { "time": 0.0, "x": 0, "y": 0, "rotation": 0, "scaleX": 1, "scaleY": 1, "easing": "smooth" },
      { "time": ${(clip.duration * 0.25).toFixed(2)}, "x": 0, "y": 16, "rotation": 0, "scaleX": 1, "scaleY": 1, "easing": "ease-in-out" },
      { "time": ${(clip.duration * 0.55).toFixed(2)}, "x": 0, "y": -38, "rotation": 0, "scaleX": 1, "scaleY": 1, "easing": "smooth" },
      { "time": ${clip.duration.toFixed(2)}, "x": 0, "y": 0, "rotation": 0, "scaleX": 1, "scaleY": 1, "easing": "smooth" }
    ],
    "bone-foot-l": [
      { "time": 0.0, "x": 0, "y": 0, "rotation": 0, "scaleX": 1, "scaleY": 1, "easing": "smooth" },
      { "time": ${(clip.duration * 0.25).toFixed(2)}, "x": 0, "y": 2.5, "rotation": 3, "scaleX": 1.16, "scaleY": 0.84, "zOrder": 15, "easing": "ease-in-out" },
      { "time": ${(clip.duration * 0.55).toFixed(2)}, "x": 0, "y": -1.5, "rotation": -6, "scaleX": 0.94, "scaleY": 1.10, "easing": "smooth" },
      { "time": ${clip.duration.toFixed(2)}, "x": 0, "y": 0, "rotation": 0, "scaleX": 1, "scaleY": 1, "easing": "smooth" }
    ]
  },
  "meshDeformation": {
    "enabled": true,
    "meshEnvelope": true,
    "groundContactImpact": {
      "enabled": true,
      "footImpactSquash": { "scaleX": 1.16, "scaleY": 0.84, "offsetY": 2.5 },
      "shinImpactCompression": { "scaleX": 1.06, "scaleY": 0.88, "offsetY": -6 },
      "thighImpactCompression": { "scaleX": 1.05, "scaleY": 0.89 },
      "airborneFootStretch": { "scaleX": 0.94, "scaleY": 1.10 }
    }
  },
  "wind": {
    "enabled": true,
    "weatherPreset": "breeze",
    "lean": 4,
    "plantSpines": [
      {
        "name": "Gió bay mái tóc & đầu",
        "layerIds": ["${composite?.layers.find((l) => /head|hair|đầu|tóc/i.test(`${l.id} ${l.name}`))?.id || composite?.layers[0]?.id || 'demo-head'}"],
        "direction": "down",
        "amplitude": 8,
        "speed": 0.85,
        "stiffness": 0.32,
        "flexibility": 0.45,
        "turbulence": 0.2,
        "lean": 4,
        "verticalBob": 0.06
      }
    ]
  }
}
\`\`\``
}

export interface ParseClipOptions {
  composite?: LayerComposite
  /** Tự động khử lỗi ngược chiều tay/chân, hông quá đà & bổ sung scaleY 2.5D (mặc định: true) */
  autoFixBiomechanics?: boolean
  /** Tên động tác do người dùng chỉ định ghi đè */
  customNameOverride?: string
}

export interface ParsedWindData {
  enabled: boolean
  weatherPreset?: WindWeatherPresetId | 'custom'
  lean?: number
  plantSpines: PlantSpine[]
  layerMotions: MotionLayerWindItem[]
}

export type ClipJsonParseResult = ParseClipResult

export interface ParseClipResult {
  success: boolean
  clip?: AnimationClip
  wind?: ParsedWindData
  mesh?: Partial<MotionMeshExportSection>
  fixesApplied?: string[]
  error?: string
  warnings?: string[]
}

/**
 * Trích xuất chuỗi JSON từ văn bản người dùng dán (kể cả có bọc markdown ```json ... ```)
 */
export function extractJsonFromText(rawText: string): string {
  const trimmed = rawText.trim()
  const mdMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (mdMatch && mdMatch[1]) {
    return mdMatch[1].trim()
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  return trimmed
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

function parseWindFromData(
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

/**
 * Phân tích, tự động khử dị dạng cơ học 2.5D và chuẩn hóa AnimationClip + Gió (wind) từ JSON
 */
export function parseAnimationClipFromJson(
  rawText: string,
  existingBones?: LayerBone[],
  optionsOrComposite?: LayerComposite | ParseClipOptions
): ParseClipResult {
  const warnings: string[] = []
  const fixesApplied: string[] = []

  const options: ParseClipOptions =
    optionsOrComposite && 'layers' in optionsOrComposite && Array.isArray(optionsOrComposite.layers)
      ? { composite: optionsOrComposite, autoFixBiomechanics: true }
      : (optionsOrComposite as ParseClipOptions) ?? { autoFixBiomechanics: true }

  const composite = options.composite
  const autoFix = options.autoFixBiomechanics !== false

  if (!rawText || !rawText.trim()) {
    return { success: false, error: 'Dữ liệu JSON trống, vui lòng dán nội dung JSON.' }
  }

  const jsonStr = extractJsonFromText(rawText)
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch (err) {
    return {
      success: false,
      error: `Cú pháp JSON không hợp lệ: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { success: false, error: 'Dữ liệu JSON phải là một đối tượng (Object).' }
  }

  const data = parsed as Record<string, unknown>
  const parsedWind = parseWindFromData(data, composite, fixesApplied)
  const parsedMesh =
    typeof data.meshDeformation === 'object' && data.meshDeformation !== null
      ? (data.meshDeformation as Partial<MotionMeshExportSection>)
      : { enabled: true, meshEnvelope: true }

  const rawTracks = data.tracks
  const hasValidWind = Boolean(parsedWind && (parsedWind.plantSpines.length > 0 || parsedWind.layerMotions.length > 0))

  if ((typeof rawTracks !== 'object' || rawTracks === null) && !hasValidWind) {
    return {
      success: false,
      error: 'Thiếu trường "tracks" chứa danh sách keyframe của các xương (hoặc trường "wind" chứa cấu hình gió).'
    }
  }

  const boneMap = new Map<string, string>()
  if (existingBones) {
    for (const b of existingBones) {
      boneMap.set(b.id.toLowerCase(), b.id)
      boneMap.set(b.name.toLowerCase(), b.id)
      boneMap.set(b.id.replace(/-/g, '').toLowerCase(), b.id)
      boneMap.set(b.name.replace(/\s+/g, '').toLowerCase(), b.id)
    }
  }

  let maxKeyframeTime = 0
  let normalizedTracks: Record<string, BoneKeyframe[]> = {}

  if (typeof rawTracks === 'object' && rawTracks !== null) {
    for (const [key, val] of Object.entries(rawTracks as Record<string, unknown>)) {
      if (!Array.isArray(val)) continue

      let targetBoneId = key
      const cleanKey = key.trim().toLowerCase()
      if (boneMap.has(cleanKey)) {
        targetBoneId = boneMap.get(cleanKey)!
      } else if (existingBones && existingBones.length > 0) {
        const matchedBone = existingBones.find(
          (b) =>
            b.id.toLowerCase().includes(cleanKey) ||
            b.name.toLowerCase().includes(cleanKey) ||
            cleanKey.includes(b.name.toLowerCase())
        )
        if (matchedBone) {
          targetBoneId = matchedBone.id
        } else {
          warnings.push(`Xương "${key}" không có trong khung xương hiện tại, vẫn giữ track này.`)
        }
      }

      const keyframes: BoneKeyframe[] = []
      for (const item of val) {
        if (typeof item !== 'object' || item === null) continue
        const kf = item as Record<string, unknown>

        const rawTime = kf.time ?? kf.t
        const time = typeof rawTime === 'number' && !isNaN(rawTime) ? Math.max(0, rawTime) : 0
        const rawRot = kf.rotation ?? kf.rot ?? kf.angle ?? 0
        const generalScale = typeof kf.scale === 'number' && !isNaN(kf.scale) ? kf.scale : 1
        const rawSx = kf.scaleX ?? kf.sx ?? generalScale
        const rawSy = kf.scaleY ?? kf.sy ?? generalScale
        const rawZ = kf.zOrder ?? kf.zIndex ?? kf.z ?? kf.layerZ ?? kf.order
        const parsedZ = rawZ !== undefined && Number.isFinite(Number(rawZ)) ? Number(rawZ) : undefined
        const rotation =
          typeof rawRot === 'number' && !isNaN(rawRot) ? Number(rawRot.toFixed(3)) : 0
        const x = typeof kf.x === 'number' && !isNaN(kf.x) ? Number(kf.x.toFixed(2)) : 0
        const y = typeof kf.y === 'number' && !isNaN(kf.y) ? Number(kf.y.toFixed(2)) : 0
        const scaleX =
          typeof rawSx === 'number' && !isNaN(rawSx) ? Number(rawSx.toFixed(3)) : 1
        const scaleY =
          typeof rawSy === 'number' && !isNaN(rawSy) ? Number(rawSy.toFixed(3)) : 1

        let easing: BoneEasing = 'smooth'
        const rawEase = kf.easing ?? kf.ease
        if (typeof rawEase === 'string' && VALID_EASINGS.has(rawEase as BoneEasing)) {
          easing = rawEase as BoneEasing
        }

        if (time > maxKeyframeTime) {
          maxKeyframeTime = time
        }

        keyframes.push({
          time: Number(time.toFixed(4)),
          rotation,
          x,
          y,
          scaleX,
          scaleY,
          easing,
          ...(parsedZ !== undefined ? { zOrder: parsedZ } : {})
        })
      }

      keyframes.sort((a, b) => a.time - b.time)
      if (keyframes.length > 0) {
        normalizedTracks[targetBoneId] = keyframes
      }
    }
  }

  const trackCount = Object.keys(normalizedTracks).length
  if (trackCount === 0 && !hasValidWind) {
    return {
      success: false,
      error: 'Không tìm thấy keyframe hợp lệ nào trong trường "tracks" hay cấu hình "wind".'
    }
  }

  const viewAngle: MotionViewAngle =
    typeof data.viewAngle === 'string' && ['front', 'diagonal', 'side', 'back'].includes(data.viewAngle)
      ? (data.viewAngle as MotionViewAngle)
      : 'front'

  // Tự động khử lỗi cơ học (tay đâm chéo bụng, chân chữ X góc 0°, hông nhảy vọt/lún đất)
  if (autoFix && trackCount > 0) {
    const fixed = normalizeAndFixBiomechanicalTracks(normalizedTracks, existingBones ?? [], viewAngle)
    normalizedTracks = fixed.tracks
    fixesApplied.push(...fixed.fixesApplied)
  }

  let duration = typeof data.duration === 'number' && !isNaN(data.duration) ? data.duration : 0
  if (duration <= 0) {
    duration = maxKeyframeTime > 0 ? maxKeyframeTime : 2.0
  }
  duration = Math.max(0.1, Math.min(120, Number(duration.toFixed(2))))

  const rawName = typeof data.name === 'string' ? data.name.trim() : ''
  const customOverride = options.customNameOverride?.trim()
  let name: string
  if (customOverride) {
    name = customOverride
  } else if (rawName && !isGenericClipName(rawName)) {
    name = rawName
  } else {
    name = inferDescriptiveClipName(
      normalizedTracks,
      existingBones ?? [],
      parsedWind?.plantSpines.length ?? 0,
      typeof data.description === 'string' ? data.description : undefined
    )
    if (rawName && isGenericClipName(rawName)) {
      fixesApplied.push(`Tự động đặt tên động tác: "${name}" (thay cho tên mặc định "${rawName}")`)
    }
  }

  const loop = typeof data.loop === 'boolean' ? data.loop : true
  const fps = typeof data.fps === 'number' && [12, 24, 30, 60].includes(data.fps) ? data.fps : 30

  const clip: AnimationClip = {
    id: `clip-imported-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    duration,
    loop,
    fps,
    tracks: normalizedTracks,
    viewAngle,
    description:
      typeof data.description === 'string' && data.description.trim()
        ? data.description.trim()
        : parsedWind && parsedWind.plantSpines.length > 0
          ? `Nhập từ JSON / AI (${parsedWind.plantSpines.length} trục gió)`
          : 'Nhập từ JSON / AI'
  }

  return {
    success: true,
    clip,
    wind: parsedWind,
    mesh: parsedMesh,
    fixesApplied: fixesApplied.length > 0 ? fixesApplied : undefined,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}
