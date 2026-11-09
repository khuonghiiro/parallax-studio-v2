import type { AnimationClip, LayerBone, MotionViewAngle } from '@shared/layerRig'
import type { LayerComposite } from './types'
import { buildBoneBiomechanicsGuide, type AnatomicalBoneRole } from './workshopClipBiomechanics'
import { buildStarterMotionExample, type StarterMotionExample } from './workshopClipAiStarter'

/**
 * "Hợp đồng cấu trúc" gắn vào JSON xuất động tác (`aiAuthoringGuide`) để một AI KHÁC (ChatGPT, Claude,
 * Gemini, DeepSeek…) chỉ cần đọc file JSON là hiểu: hệ toạ độ, ý nghĩa từng trường keyframe, cách engine
 * nội suy & cộng dồn cha → con, cây xương thật của cụm 2.5D, biên độ an toàn và quy tắc chuyển động mượt
 * — từ đó tự tạo động tác mới import ngược lại vào Xưởng Layer 2.5D không cần chỉnh tay.
 *
 * Nguồn sự thật của mô hình đánh giá: `engine/boneInterpolation.ts` (nội suy) + `engine/layerRig.ts` (FK).
 */

export const MOTION_AI_GUIDE_VERSION = 'parallax-motion-ai-guide-v1'

interface RoleAmplitude {
  /** Biên độ xoay điển hình khi đứng yên / thở (°, độ lớn) */
  idle: [number, number]
  /** Biên độ xoay tối đa khi diễn động tác mạnh (°, độ lớn) */
  action: number
  /** Có nên dịch chuyển x/y không (chỉ hông/gốc) */
  translate: 'free' | 'small' | 'avoid'
}

const ROLE_AMPLITUDE: Record<string, RoleAmplitude> = {
  pelvis: { idle: [0, 2], action: 10, translate: 'free' },
  torso: { idle: [1, 3], action: 14, translate: 'small' },
  head: { idle: [1, 5], action: 22, translate: 'small' },
  arm: { idle: [2, 6], action: 125, translate: 'avoid' },
  forearm: { idle: [2, 8], action: 120, translate: 'avoid' },
  hand: { idle: [3, 10], action: 45, translate: 'avoid' },
  thigh: { idle: [0, 3], action: 60, translate: 'avoid' },
  shin: { idle: [0, 4], action: 95, translate: 'avoid' },
  foot: { idle: [0, 3], action: 30, translate: 'avoid' }
}

export interface MotionBoneTreeNode {
  id: string
  name: string
  role: AnatomicalBoneRole
  /** Độ sâu trong chuỗi xương (0 = gốc) — dùng để trễ pha follow-through */
  depth: number
  restAngleDeg: number
  lengthPx: number
  pivot: { x: number; y: number }
  /** Giới hạn góc xoay khớp do người dựng rig đặt (°, tương đối so với dáng nghỉ) */
  rotationLimitDeg?: { min: number; max: number }
  typicalRotationDeg: { idle: [number, number]; actionMax: number }
  translation: 'free' | 'small' | 'avoid'
  /** Trễ pha gợi ý so với xương gốc (giây) để tạo chuyển động gối đầu (overlapping action) */
  suggestedPhaseDelaySec: number
  boundLayers?: string[]
  children?: MotionBoneTreeNode[]
}

export interface MotionAuthoringGuide {
  guideVersion: typeof MOTION_AI_GUIDE_VERSION
  purpose: string
  howToUse: string[]
  outputContract: {
    returnFormat: string
    requiredFields: string[]
    optionalFields: string[]
    readOnlyContextFields: string[]
    allowedBoneIds: string[]
    rules: string[]
  }
  coordinateSystem: Record<string, string>
  keyframeSchema: Record<string, { type: string; unit?: string; default?: unknown; meaning: string }>
  evaluationModel: { interpolation: Record<string, string>; hierarchy: string[]; loop: string; missingData: string }
  timing: { fps: number; frameSec: number; minKeySpacingSec: number; recommendedKeysPerBone: string; rules: string[] }
  smoothMotionRules: string[]
  qualityChecklist: string[]
  boneHierarchy: MotionBoneTreeNode[]
  starterExample: StarterMotionExample
}

function roleBucket(role: AnatomicalBoneRole): string {
  if (role === 'pelvis' || role === 'torso' || role === 'head') return role
  const m = /^(arm|forearm|hand|thigh|shin|foot)/.exec(role)
  return m ? m[1] : 'custom'
}

function amplitudeFor(role: AnatomicalBoneRole, depth: number): RoleAmplitude {
  const known = ROLE_AMPLITUDE[roleBucket(role)]
  if (known) return known
  const idleMax = Math.min(12, 2 + depth * 2)
  return { idle: [1, idleMax], action: Math.min(60, 20 + depth * 8), translate: depth === 0 ? 'free' : 'avoid' }
}

const round = (v: number, d = 1) => Number(v.toFixed(d))

/** Dựng cây xương lồng nhau (dễ hiểu cho AI hơn danh sách phẳng parentId). */
export function buildBoneHierarchyTree(
  bones: ReadonlyArray<LayerBone>,
  composite: LayerComposite | undefined,
  viewAngle: MotionViewAngle
): MotionBoneTreeNode[] {
  const meta = new Map(buildBoneBiomechanicsGuide(bones, composite, viewAngle).map((m) => [m.id, m]))
  const ids = new Set(bones.map((b) => b.id))
  const childrenOf = new Map<string, LayerBone[]>()
  for (const b of bones) {
    const key = b.parentId && ids.has(b.parentId) ? b.parentId : '__root__'
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), b])
  }
  const build = (bone: LayerBone, depth: number, guard: Set<string>): MotionBoneTreeNode => {
    guard.add(bone.id)
    const m = meta.get(bone.id)
    const role = (m?.role ?? 'custom') as AnatomicalBoneRole
    const amp = amplitudeFor(role, depth)
    const kids = (childrenOf.get(bone.id) ?? []).filter((c) => !guard.has(c.id))
    const hasLimit = typeof bone.minAngle === 'number' || typeof bone.maxAngle === 'number'
    return {
      id: bone.id,
      name: bone.name,
      role,
      depth,
      restAngleDeg: round(bone.angle),
      lengthPx: round(bone.length),
      pivot: { x: round(bone.x), y: round(bone.y) },
      ...(hasLimit ? { rotationLimitDeg: { min: bone.minAngle ?? -180, max: bone.maxAngle ?? 180 } } : {}),
      typicalRotationDeg: { idle: amp.idle, actionMax: amp.action },
      translation: depth === 0 ? 'free' : amp.translate,
      suggestedPhaseDelaySec: round(depth * 0.05, 2),
      ...(m?.boundLayers.length ? { boundLayers: m.boundLayers } : {}),
      ...(kids.length ? { children: kids.map((k) => build(k, depth + 1, guard)) } : {})
    }
  }
  const guard = new Set<string>()
  return (childrenOf.get('__root__') ?? []).map((b) => build(b, 0, guard))
}

function buildKeyframeSchema(): MotionAuthoringGuide['keyframeSchema'] {
  return {
    time: { type: 'number', unit: 'giây', meaning: 'Thời điểm keyframe, 0 ≤ time ≤ duration, tăng dần, làm tròn theo khung hình (1/fps).' },
    x: { type: 'number', unit: 'px', default: 0, meaning: 'Độ lệch vị trí khớp (pivot) so với dáng nghỉ, trong hệ trục của xương cha (đã xoay theo cha). Xương gốc: hệ màn hình.' },
    y: { type: 'number', unit: 'px', default: 0, meaning: 'Như x; +y = đi XUỐNG màn hình. Với hông: +y = nhún thấp, -y = bật lên.' },
    rotation: { type: 'number', unit: 'độ', default: 0, meaning: 'Góc xoay CỘNG THÊM so với dáng nghỉ (không phải góc tuyệt đối). + = cùng chiều kim đồng hồ. Cộng dồn cho toàn bộ xương con.' },
    scaleX: { type: 'number', default: 1, meaning: 'Hệ số co giãn ngang (nhân dồn xuống xương con). Squash & stretch nhẹ: 0.9..1.12.' },
    scaleY: { type: 'number', default: 1, meaning: 'Hệ số co giãn dọc (nhân dồn xuống xương con). Kết hợp scaleX nghịch đảo để giữ thể tích.' },
    zOrder: { type: 'number', default: 0, meaning: 'Độ nổi lớp tương đối (cộng dồn cha → con). Dương = ra trước, âm = lùi sau. Chỉ đặt ở xương gốc của chi.' },
    easing: { type: "'smooth' | 'linear' | 'hold' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bezier'", default: 'smooth', meaning: 'Kiểu nội suy của ĐOẠN từ keyframe này tới keyframe kế tiếp.' },
    bezier: { type: '[x1, y1, x2, y2]', meaning: 'Chỉ dùng khi easing = "bezier"; x1, x2 trong [0, 1] (giống CSS cubic-bezier).' }
  }
}

function buildEvaluationModel(): MotionAuthoringGuide['evaluationModel'] {
  return {
    interpolation: {
      smooth: 'Spline Hermite liên tục vận tốc, tiếp tuyến tính theo GIÂY (khoảng cách key không đều vẫn mượt); key có giá trị bằng key kề bên → tiếp tuyến 0 (tự êm, không vọt quá).',
      'ease-in-out': 'Cubic ease-in-out trong đoạn — dừng hẳn ở 2 đầu (hợp với tư thế giữ/pose-to-pose).',
      'ease-in': 'Tăng tốc dần (cubic) — dùng khi rơi / bắt đầu vung.',
      'ease-out': 'Giảm tốc dần (cubic) — dùng khi dừng lại / tiếp đất.',
      linear: 'Tuyến tính — chỉ dùng cho chuyển động cơ khí đều (quay bánh xe).',
      hold: 'Giữ nguyên giá trị đến keyframe kế tiếp (bước nhảy) — dùng cho đổi zOrder.',
      bezier: 'Cubic Bezier theo trường "bezier".'
    },
    hierarchy: [
      'Forward Kinematics: xử lý từ xương gốc xuống xương con theo "boneHierarchy".',
      'worldRotation(con) = worldRotation(cha) + rotation(con); scale nhân dồn; zOrder cộng dồn.',
      'Vị trí khớp con = vị trí khớp cha + xoay(cha)·(pivot con + [x, y] − pivot cha)·scale(cha).',
      'Layer gắn xương đi theo xương → chỉ cần animate xương, KHÔNG animate layer.'
    ],
    loop: 'loop = true: thời gian quấn vòng; nếu có key ở 0 và ở duration thì 2 key PHẢI giống hệt nhau để vòng lặp liền mạch (spline nối qua điểm quấn).',
    missingData: 'Trường bị bỏ trống = giá trị dáng nghỉ (x=0, y=0, rotation=0, scale=1, zOrder=0). Xương không có track = đứng yên ở dáng nghỉ.'
  }
}

function buildSmoothRules(): string[] {
  return [
    'Mặc định easing "smooth"; dùng "ease-in-out" cho tư thế giữ (pose) và "hold" CHỈ cho đổi zOrder.',
    'Chuyển động gối đầu (overlapping action): xương con trễ pha so với cha theo "suggestedPhaseDelaySec" (≈0.04–0.08s mỗi cấp) — không cho mọi xương đổi hướng cùng một khung hình.',
    'Theo đà (follow-through): biên độ GIẢM dần từ gốc ra ngọn đối với lực tác động lên thân, nhưng đầu mút (tay, tóc) vọt nhẹ rồi lắng lại 1–2 dao động nhỏ.',
    'Lấy đà (anticipation) 0.1–0.2s ngược hướng trước động tác chính; giảm tốc (ease-out) khi dừng.',
    'Vận tốc xoay không vượt ~720°/s và không đảo chiều liên tục giữa 2 key cách nhau < 2 khung hình (gây giật).',
    'Không lặp lại giá trị giống nhau ở nhiều key liền kề nếu không cần giữ dáng — spline đã tự mượt.',
    'Xương có "translation": "avoid" giữ x = y = 0 (dịch khớp con làm rời bộ phận); "small" ≤ ±4px; chỉ hông/gốc dịch tự do.',
    'Squash & stretch giữ thể tích: scaleX ≈ 1 / scaleY (ví dụ 1.05 ↔ 0.95), biên độ ≤ 12%.',
    'Tôn trọng "rotationLimitDeg" (nếu có) và "typicalRotationDeg"; vượt actionMax sẽ trông gãy khớp.',
    'Động tác lặp (loop): giá trị tại time = 0 và time = duration giống hệt nhau cho MỌI xương có track.'
  ]
}

function buildQualityChecklist(): string[] {
  return [
    'Chỉ dùng id xương có trong "outputContract.allowedBoneIds".',
    'time tăng dần, nằm trong [0, duration], làm tròn 3 chữ số thập phân.',
    'Loop khép kín: key đầu = key cuối.',
    'Không có cú nhảy góc > 45° giữa 2 key cách nhau < 0.1s (trừ khi easing = "hold" có chủ đích).',
    'Hông không lún quá +24px hay bay quá −50px; xương "avoid" không có x/y khác 0.',
    'Mỗi xương 3–9 key mỗi chu kỳ; dùng trễ pha cho xương con.',
    'JSON hợp lệ, không chú thích (comment), không dấu phẩy thừa.'
  ]
}

function collectIds(nodes: MotionBoneTreeNode[], out: string[] = []): string[] {
  for (const n of nodes) {
    out.push(n.id)
    if (n.children) collectIds(n.children, out)
  }
  return out
}

/** Tạo khối `aiAuthoringGuide` cho JSON xuất động tác. */
export function buildMotionAuthoringGuide(
  clip: AnimationClip,
  bones: ReadonlyArray<LayerBone>,
  composite: LayerComposite | undefined,
  viewAngle: MotionViewAngle
): MotionAuthoringGuide {
  const fps = clip.fps ?? 30
  const tree = buildBoneHierarchyTree(bones, composite, viewAngle)
  const allowedBoneIds = collectIds(tree)
  return {
    guideVersion: MOTION_AI_GUIDE_VERSION,
    purpose:
      'File này mô tả 1 động tác (clip) của cụm nhân vật/đối tượng 2.5D cắt rời gắn xương trong Parallax Studio. Đọc mục này để hiểu cấu trúc rồi tạo động tác MỚI, mượt, import ngược lại được.',
    howToUse: [
      '1. Đọc "boneHierarchy" để biết xương nào điều khiển bộ phận nào ("boundLayers") và thứ tự cha → con.',
      '2. Đọc "keyframeSchema" + "evaluationModel" để hiểu mỗi số trong "tracks" được engine dùng thế nào.',
      '3. Thiết kế động tác theo "smoothMotionRules", tham khảo "starterExample" (dùng đúng id xương thật).',
      '4. Trả về JSON theo "outputContract"; kiểm tra lại "qualityChecklist" trước khi trả lời.'
    ],
    outputContract: {
      returnFormat: 'Một object JSON duy nhất (có thể bọc trong ```json```), cùng "format": "parallax-motion-v1".',
      requiredFields: ['format', 'name', 'duration', 'loop', 'fps', 'tracks'],
      optionalFields: ['description', 'viewAngle', 'wind', 'meshDeformation'],
      readOnlyContextFields: ['aiAuthoringGuide', 'bones', 'layers', 'rigConventions', 'characterOrientation', 'characterPostureAndGarment'],
      allowedBoneIds,
      rules: [
        '"tracks" là object: key = id xương, value = mảng keyframe theo "keyframeSchema".',
        'Không đổi id/cấu trúc xương, không thêm xương mới; KHÔNG cần trả lại các trường chỉ-đọc.',
        '"name" là tên tiếng Việt mô tả động tác (không dùng "Động tác 1").',
        'fps ∈ {12, 24, 30, 60}; duration 0.5–10 giây.'
      ]
    },
    coordinateSystem: {
      axes: 'Không gian màn hình 2D: +X sang phải, +Y xuống dưới, rotation + = cùng chiều kim đồng hồ (độ).',
      units: 'px cho x/y, độ cho rotation, hệ số cho scale, giây cho time/duration.',
      naming: 'Hậu tố -l / -r theo MÀN HÌNH (trái/phải khung hình), không theo giải phẫu nhân vật.',
      depth: 'Z / zOrder càng cao càng ở phía trước.'
    },
    keyframeSchema: buildKeyframeSchema(),
    evaluationModel: buildEvaluationModel(),
    timing: {
      fps,
      frameSec: round(1 / fps, 4),
      minKeySpacingSec: round(2 / fps, 3),
      recommendedKeysPerBone: '3–9 key mỗi chu kỳ (idle 3–5, đi/chạy 5–9)',
      rules: [
        'Làm tròn time theo bội số của frameSec.',
        'Nhịp tham khảo: thở/idle 2.0–3.2s; vẫy tay 1.0–1.6s; đi bộ 0.9–1.2s/chu kỳ 2 bước; chạy 0.5–0.7s; nhảy 1.0–1.4s.'
      ]
    },
    smoothMotionRules: buildSmoothRules(),
    qualityChecklist: buildQualityChecklist(),
    boneHierarchy: tree,
    starterExample: buildStarterMotionExample(tree, clip.duration > 0.4 ? clip.duration : 2.4, fps)
  }
}
