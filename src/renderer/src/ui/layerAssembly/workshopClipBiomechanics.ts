import {
  normalizeBaseViewAngle,
  type BoneKeyframe,
  type LayerBone,
  type LayerRig,
  type MotionViewAngle
} from '@shared/layerRig'
import type { AssembledLayerItem, LayerComposite } from './types'
import { computeBoneTail } from './mohoRigHelpers'
import { extractLayerDimensions } from './workshopCutoutRig'
import { describeBoneRestDirection, detectGarmentCoversLegs } from './workshopClothScanner'
import { extraSoftBoneIdsForLayer } from './workshopRig'
import { inferHumanoidBoneRoles, type HumanoidBoneRoleMap } from './spineRigWorkflow'

export type AnatomicalBoneRole = keyof HumanoidBoneRoleMap | 'custom'

export interface BoneBiomechanicsMeta {
  id: string
  name: string
  parentId: string | null
  role: AnatomicalBoneRole
  x: number
  y: number
  tailX: number
  tailY: number
  length: number
  angle: number
  restDirectionDesc: string
  meshEnvelope: boolean
  strength: number
  influenceReach: number
  pin?: boolean
  boundLayers: string[]
  directionGuide: string
}

export interface MotionBoneEnvelopeItem {
  boneId: string
  boneName?: string
  meshEnvelope: boolean
  strength: number
  influenceReach: number
  pin?: boolean
}

export interface MotionLayerMeshBindingItem {
  layerId: string
  layerName: string
  bindingMode: 'soft' | 'rigid'
  boneId: string | null
  extraBoneIds?: string[]
  meshWidth?: number
  meshHeight?: number
  isCloth?: boolean
  clothFollowBoneId?: string
  clothAmplitude?: number
  physics?: {
    enabled: boolean
    material: string
    role?: string
    stiffness?: number
    damping?: number
    bounciness?: number
  }
}

export interface MotionMeshExportSection {
  enabled: boolean
  meshEnvelope: boolean
  groundContactImpact: {
    enabled: boolean
    footImpactSquash: { scaleX: number; scaleY: number; offsetY: number }
    shinImpactCompression: { scaleX: number; scaleY: number; offsetY: number }
    thighImpactCompression: { scaleX: number; scaleY: number }
    airborneFootStretch: { scaleX: number; scaleY: number }
    torsoElasticity: { squashScaleX: number; squashScaleY: number; stretchScaleX: number; stretchScaleY: number }
  }
  boneEnvelopes: MotionBoneEnvelopeItem[]
  layerBindings: MotionLayerMeshBindingItem[]
}

export interface MotionOrientationGuide {
  viewAngle: MotionViewAngle
  angleDeg: number
  facing: string
  facingDirection?: 'front' | 'left' | 'right' | 'back'
  walkType?: 'in-place' | 'root-motion'
  description: string
  motionRules: string[]
  diagonalRules?: {
    foreLimbSide: 'left' | 'right'
    hindLimbSide: 'left' | 'right'
    foreLimbSummary: string
    hindLimbSummary: string
    walkCoordinateSummary: string
    spriteIntegrityRule: string
  }
}

/** Xây dựng cấu trúc định hướng góc nhìn chi tiết (0° front, 45° diagonal left/right, 90° side left/right, 180° back) cho AI */
export function buildOrientationGuide(
  viewAngle: MotionViewAngle = 'front',
  walkType: 'in-place' | 'root-motion' = 'in-place'
): MotionOrientationGuide {
  switch (viewAngle) {
    case 'side-left':
    case 'side':
      return {
        viewAngle: viewAngle === 'side-left' ? 'side-left' : 'side',
        angleDeg: 90,
        facing: 'Góc ngang 90° nhìn hẳn sang BÊN TRÁI MÀN HÌNH (Side-Left Profile)',
        facingDirection: 'left',
        walkType,
        description:
          'Nhân vật quay ngang 90° sang bên trái màn hình. Hoạt ảnh chân và tay vung dọc theo trục trước - sau (bước tới trước sang trái và đạp ra sau sang phải).',
        motionRules: [
          'Chân bước dọc: Đùi vung ra trước (-X, rotation ÂM: -20°..-35°), chân đạp ra sau (+X, rotation DƯƠNG: +15°..+25°).',
          'Khớp gối: Cẳng chân gập ra sau (rotation DƯƠNG: +15°..+45°).',
          'Cánh tay: Đánh tay so le theo trục trước - sau tự nhiên nghịch pha với chân.',
          'Bước đi tại chỗ (In-place walk): Giữ pelvis.x dao động nhỏ trong khoảng -4px <= x <= +4px, không làm nhân vật trôi dạt ra lề màn hình.',
          'Chiều sâu: Chi tiết gần camera có Z lớn hơn chi tiết ở xa.'
        ]
      }
    case 'side-right':
      return {
        viewAngle: 'side-right',
        angleDeg: 90,
        facing: 'Góc ngang 90° nhìn hẳn sang BÊN PHẢI MÀN HÌNH (Side-Right Profile)',
        facingDirection: 'right',
        walkType,
        description:
          'Nhân vật quay ngang 90° sang bên phải màn hình. Hoạt ảnh chân và tay vung dọc theo trục trước - sau (bước tới trước sang phải và đạp ra sau sang trái).',
        motionRules: [
          'Chân bước dọc: Đùi vung ra trước (+X, rotation ÂM: -20°..-35°), chân đạp ra sau (-X, rotation DƯƠNG: +15°..+25°).',
          'Khớp gối: Cẳng chân gập ra sau (rotation DƯƠNG: +15°..+45°).',
          'Cánh tay: Đánh tay so le theo trục trước - sau tự nhiên nghịch pha với chân.',
          'Bước đi tại chỗ (In-place walk): Giữ pelvis.x dao động nhỏ trong khoảng -4px <= x <= +4px.',
          'Chiều sâu: Chi tiết gần camera có Z lớn hơn chi tiết ở xa.'
        ]
      }
    case 'diagonal-left':
      return {
        viewAngle: 'diagonal-left',
        angleDeg: 45,
        facing: 'Góc chéo 45° nghiêng sang BÊN TRÁI MÀN HÌNH (Diagonal-Left / 3/4 Left)',
        facingDirection: 'left',
        walkType,
        description:
          'Nhân vật quay góc 45° ba phần tư hướng sang BÊN TRÁI MÀN HÌNH. Nửa người bên TRÁI MÀN HÌNH (các khớp có hậu tố "-l": arm-l, thigh-l, foot-l) là CHI PHÍA TRƯỚC (Foreground, gần camera hơn). Nửa người bên PHẢI MÀN HÌNH ("-r") là CHI PHÍA SAU (Background, xa camera hơn).',
        motionRules: [
          'CHÂN GẦN CAMERA (Bên TRÁI màn hình "-l"): Là chân trụ & sải chính, bước tới hạ thấp (y: +4..+8px), to hơn (scale: 1.06..1.09), zOrder: +15..+20 đè lên chân sau.',
          'CHÂN XA CAMERA (Bên PHẢI màn hình "-r"): Biên độ ngắn hơn, co nhấc cao hơn (y: -6..-10px), nhỏ hơn (scale: 0.92..0.96), zOrder: -15..-20 chìm phía sau.',
          'TAY ĐÁNH NGHỊCH PHA: Khi chân -l bước tới, tay đối diện bone-arm-r vung ra trước ngực với zOrder: 50. Tay cùng bên bone-arm-l vung lùi sau lưng với zOrder: -40.',
          'BẢO VỆ SPRITE 2D CẮT RỜI: Sprite là hình vẽ phẳng nhìn thẳng. TUYỆT ĐỐI KHÔNG xoay thân (bone-torso) hoặc đầu (bone-head) quá ±5° và KHÔNG bóp dẹp scaleX cơ thể. Hiệu ứng nghiêng được thể hiện 100% bằng sải chi trước/sau và đè lớp zOrder!',
          'BƯỚC ĐI TẠI CHỖ (In-place walk): Giữ tọa độ "x" của Hông gốc (bone-pelvis) dao động nhỏ trong khoảng -4px <= x <= +4px, TUYỆT ĐỐI KHÔNG tịnh tiến dạt x sang trái (-50px, -100px...).'
        ],
        diagonalRules: {
          foreLimbSide: 'left',
          hindLimbSide: 'right',
          foreLimbSummary:
            'Bên TRÁI màn hình (-l) là CHI PHÍA TRƯỚC (Foreground): to hơn (scale: 1.06..1.09), hạ thấp (y: +4..+8px), zOrder: +15..+20.',
          hindLimbSummary:
            'Bên PHẢI màn hình (-r) là CHI PHÍA SAU (Background): nhỏ hơn (scale: 0.92..0.96), co nhấc cao (y: -6..-10px), zOrder: -15..-20.',
          walkCoordinateSummary: 'Bước đi tại chỗ (In-place walk): -4px <= pelvis.x <= +4px.',
          spriteIntegrityRule: 'CẤM xoay thân áo/đầu quá ±5° trên sprite 2D; bảo toàn hình thể nhân vật không bị gãy cột sống.'
        }
      }
    case 'diagonal-right':
      return {
        viewAngle: 'diagonal-right',
        angleDeg: 315,
        facing: 'Góc chéo 45° nghiêng sang BÊN PHẢI MÀN HÌNH (Diagonal-Right / 3/4 Right)',
        facingDirection: 'right',
        walkType,
        description:
          'Nhân vật quay góc 45° ba phần tư hướng sang BÊN PHẢI MÀN HÌNH. Nửa người bên PHẢI MÀN HÌNH (các khớp có hậu tố "-r": arm-r, thigh-r, foot-r) là CHI PHÍA TRƯỚC (Foreground, gần camera hơn). Nửa người bên TRÁI MÀN HÌNH ("-l") là CHI PHÍA SAU (Background, xa camera hơn).',
        motionRules: [
          'CHÂN GẦN CAMERA (Bên PHẢI màn hình "-r"): Là chân trụ & sải chính, bước tới hạ thấp (y: +4..+8px), to hơn (scale: 1.06..1.09), zOrder: +15..+20 đè lên chân sau.',
          'CHÂN XA CAMERA (Bên TRÁI màn hình "-l"): Biên độ ngắn hơn, co nhấc cao hơn (y: -6..-10px), nhỏ hơn (scale: 0.92..0.96), zOrder: -15..-20 chìm phía sau.',
          'TAY ĐÁNH NGHỊCH PHA: Khi chân -r bước tới, tay đối diện bone-arm-l vung ra trước ngực với zOrder: 50. Tay cùng bên bone-arm-r vung lùi sau lưng với zOrder: -40.',
          'BẢO VỆ SPRITE 2D CẮT RỜI: Sprite là hình vẽ phẳng nhìn thẳng. TUYỆT ĐỐI KHÔNG xoay thân (bone-torso) hoặc đầu (bone-head) quá ±5° và KHÔNG bóp dẹp scaleX cơ thể!',
          'BƯỚC ĐI TẠI CHỖ (In-place walk): Giữ tọa độ "x" của Hông gốc (bone-pelvis) dao động nhỏ trong khoảng -4px <= x <= +4px, TUYỆT ĐỐI KHÔNG tịnh tiến dạt x sang phải.'
        ],
        diagonalRules: {
          foreLimbSide: 'right',
          hindLimbSide: 'left',
          foreLimbSummary:
            'Bên PHẢI màn hình (-r) là CHI PHÍA TRƯỚC (Foreground): to hơn (scale: 1.06..1.09), hạ thấp (y: +4..+8px), zOrder: +15..+20.',
          hindLimbSummary:
            'Bên TRÁI màn hình (-l) là CHI PHÍA SAU (Background): nhỏ hơn (scale: 0.92..0.96), co nhấc cao (y: -6..-10px), zOrder: -15..-20.',
          walkCoordinateSummary: 'Bước đi tại chỗ (In-place walk): -4px <= pelvis.x <= +4px.',
          spriteIntegrityRule: 'CẤM xoay thân áo/đầu quá ±5° trên sprite 2D; bảo toàn hình thể nhân vật không bị gãy cột sống.'
        }
      }
    case 'diagonal':
      return {
        viewAngle: 'diagonal',
        angleDeg: 45,
        facing: 'Góc chéo 3/4 (45° Nghiêng chéo bán thân)',
        facingDirection: 'left',
        walkType,
        description: 'Nhân vật quay góc 45° ba phần tư so với Camera. Một bên thân (gần camera) to hơn và rõ chi tiết hơn bên thân xa.',
        motionRules: [
          'Phân biệt rõ tay/chân gần camera (Foreground, Z lớn hơn) và tay/chân xa camera (Background, Z nhỏ hơn).',
          'Cánh tay gần camera vươn rộng và nằm đè lên thân áo (zOrder: 50).',
          'Nhún gối kết hợp mở nhẹ gối và thu ngắn phối cảnh scaleY (0.88..0.92).',
          'Bước đi tại chỗ (In-place walk): Giữ pelvis.x dao động nhỏ trong khoảng -4px <= x <= +4px.',
          'Bảo vệ Sprite 2D: Giữ góc xoay thân (bone-torso) và đầu (bone-head) trong khoảng ±5°.'
        ],
        diagonalRules: {
          foreLimbSide: 'left',
          hindLimbSide: 'right',
          foreLimbSummary: 'Chi gần camera to hơn, hạ thấp y, zOrder dương.',
          hindLimbSummary: 'Chi xa camera nhỏ hơn, nhấc cao y, zOrder âm.',
          walkCoordinateSummary: 'Bước đi tại chỗ (In-place walk): -4px <= pelvis.x <= +4px.',
          spriteIntegrityRule: 'CẤM xoay thân/đầu quá ±5° trên sprite 2D phẳng.'
        }
      }
    case 'back':
      return {
        viewAngle: 'back',
        angleDeg: 180,
        facing: 'Góc sau lưng 180° (Nhìn từ phía sau)',
        facingDirection: 'back',
        walkType,
        description: 'Nhân vật quay lưng 180° về phía Camera / Người xem.',
        motionRules: [
          'Lưng và mái tóc sau hiển thị trên cùng đè lên thân trước.',
          'Hai cánh tay khi vung sang 2 bên có chiều xoay đối xứng ngược lại với góc chính diện.',
          'Bước đi tại chỗ (In-place walk): Giữ pelvis.x trong khoảng -4px <= x <= +4px.'
        ]
      }
    case 'front':
    default:
      return {
        viewAngle: 'front',
        angleDeg: 0,
        facing: 'Chính diện 0° (Đối diện trực tiếp với Camera / Người xem)',
        facingDirection: 'front',
        walkType,
        description: 'Nhân vật nhìn thẳng 0° vào mắt người xem. Hai bên cơ thể đối xứng qua trục dọc giữa thân.',
        motionRules: [
          'Mặt và ngực hướng thẳng 0° vào người xem.',
          'Hai cánh tay mở sang 2 bên đối xứng chữ V (Tay trái: rotation DƯƠNG +20°..+120°, Tay phải: rotation ÂM -20°..-120°).',
          'Hai chân nhún khuỵu mở nhẹ gối sang 2 bên kết hợp thu ngắn phối cảnh scaleY (0.88..0.93), không xoay chân lộn xộn.',
          'Bàn chân tiếp đất chịu lực nén dẹt (scaleX: 1.16, scaleY: 0.84) bám sàn tự nhiên.',
          'Bước đi tại chỗ (In-place walk): Giữ pelvis.x trong khoảng -4px <= x <= +4px.',
          'Chiều sâu: Kính (+42) > Mặt (+30) > Đầu (+20) > Thân (0) > Cánh tay sau (-35).'
        ]
      }
  }
}


/** Xây dựng hướng dẫn chiều xoay, phối cảnh 2.5D & biến dạng lưới Mesh chịu lực cho từng vai trò khớp */
function getRoleDirectionGuide(role: AnatomicalBoneRole, viewAngle: MotionViewAngle = 'front'): string {
  const baseAngle = normalizeBaseViewAngle(viewAngle)
  const isSide = baseAngle === 'side'
  const isDiagLeft = viewAngle === 'diagonal-left'
  const isDiagRight = viewAngle === 'diagonal-right'

  switch (role) {
    case 'pelvis':
      return 'Hông gốc (Root): Walk cycle tại chỗ (In-place), giữ x dao động nhỏ (±3px), y nhún nhịp (+8..+20px tiếp đất / -12..-35px nhấc/nhảy), rotation nhỏ (±3°).'
    case 'torso':
      return isDiagLeft || isDiagRight
        ? 'Thân/Ngực (Góc chéo 2.5D): QUAN TRỌNG: Trên sprite 2D phẳng, TUYỆT ĐỐI KHÔNG xoay thân quá ±4° kẻo vặn gãy cột sống; chỉ nhún nén nhẹ (scaleX: 1.03, scaleY: 0.94, y: +2px) khi tiếp đất.'
        : 'Thân/Ngực (Soft Mesh): rotation ±2°..±10°. Khi nhún/tiếp đất: nén Mesh thân (scaleX: 1.04, scaleY: 0.93, y: +3.5px); khi vươn người: giãn Mesh (scaleX: 0.97, scaleY: 1.04, y: -3px).'
    case 'head':
      return 'Đầu: rotation nhỏ (±3°..±6°), nhấp nhô nhún Y theo thân (y: +2px khi tiếp đất).'
    case 'armL':
      return 'Bắp tay trái (mặc định chúc xuống ~95°): QUAN TRỌNG: rotation DƯƠNG (+20°..+130°) = GIƠ TAY TRÁI MỞ RA NGOÀI & LÊN CAO; rotation ÂM (-5°..-18°) = khép nhẹ vào ngực. Đặt zOrder: 50 khi vươn tay ra trước ngực.'
    case 'forearmL':
      return 'Cẳng tay trái (Soft Mesh): rotation DƯƠNG (+10°..+45°) = mở/nâng cẳng tay trái hướng ra ngoài; có thể kèm scaleY: 0.95..1.04 tạo độ văng cơ.'
    case 'handL':
      return 'Bàn tay trái: rotation ±10°..±25° vẫy cổ tay mềm mại theo cẳng tay trái (Follow-through).'
    case 'armR':
      return 'Bắp tay phải (mặc định chúc xuống ~85°): QUAN TRỌNG: rotation ÂM (-20°..-130°) = GIƠ TAY PHẢI MỞ RA NGOÀI & LÊN CAO; rotation DƯƠNG (+5°..+18°) = khép nhẹ vào ngực. Đặt zOrder: 50..60 khi đưa tay lên trước thân.'
    case 'forearmR':
      return 'Cẳng tay phải (Soft Mesh): rotation ÂM (-15°..-45°) = gập khuỷu tay phải lên/ra ngoài; có thể kèm scaleY: 0.95..1.04.'
    case 'handR':
      return 'Bàn tay phải: rotation ±15°..±25° vẫy cổ tay mềm mại theo cẳng tay phải.'
    case 'thighL':
      if (isSide) return 'Đùi trái (góc ngang 90°): rotation ÂM (-20°..-35°) = bước đùi về trước; DƯƠNG (+15°..+25°) = đạp chân ra sau. Khi tiếp đất: scaleX: 1.05, scaleY: 0.90.'
      if (isDiagLeft) return 'Đùi trái (Góc chéo TRÁI - CHI PHÍA TRƯỚC Foreground): sải bước chính, hạ thấp y (+4..+8px), to hơn (scale: 1.06..1.09), zOrder: +15 đè lên đùi phải.'
      if (isDiagRight) return 'Đùi trái (Góc chéo PHẢI - CHI PHÍA SAU Background): sải hẹp hơn, co nhấc cao (y: -6..-10px), nhỏ hơn (scale: 0.92..0.96), zOrder: -15 lùi sau.'
      return 'Đùi trái (góc 0° - Soft Mesh): khi khuỵu gối/tiếp đất đặt rotation DƯƠNG nhẹ (+4°..+7°) + TÁC LỰC NÉN MESH ĐÙI (scaleX: 1.05, scaleY: 0.88..0.91); khi bật nhảy trên không đặt scaleX: 0.97, scaleY: 1.03.'
    case 'shinL':
      if (isSide) return 'Cẳng chân trái (góc ngang 90°): rotation DƯƠNG (+15°..+45°) = gập gối ra sau. Khi tiếp đất: scaleX: 1.06, scaleY: 0.88.'
      if (isDiagLeft) return 'Cẳng chân trái (Góc chéo TRÁI - Foreground): bước tới to hơn (scale: 1.06..1.08), hạ thấp (y: +4..+8px).'
      if (isDiagRight) return 'Cẳng chân trái (Góc chéo PHẢI - Background): nhỏ hơn (scale: 0.92..0.95), nhấc cao (y: -6..-10px).'
      return 'Cẳng chân trái (góc 0° - Soft Mesh): khi khuỵu gối/tiếp đất đặt rotation ÂM nhẹ (-4°..-6°) + TÁC LỰC NÉN MESH CẲNG CHÂN (scaleX: 1.06, scaleY: 0.87..0.90, y: -5..-7px); khi trên không đặt scaleX: 0.97, scaleY: 1.04.'
    case 'footL':
      return 'Bàn chân trái (Mesh Chịu Tác Lực Tiếp Đất): Khi nhún lấy đà / chạm đất chịu lực, BẮT BUỘC nén dẹt & bè ngang lưới Mesh đế giày (scaleX: 1.14..1.18, scaleY: 0.82..0.86, y: +2..+4px, rotation: +2°..+5°); khi bật nhảy rời đất, duỗi thon bàn chân (scaleX: 0.93..0.95, scaleY: 1.08..1.12, rotation: -6°..-10°).'
    case 'thighR':
      if (isSide) return 'Đùi phải (góc ngang 90°): rotation ÂM (-20°..-35°) = bước đùi về trước; DƯƠNG (+15°..+25°) = đạp chân ra sau.'
      if (isDiagRight) return 'Đùi phải (Góc chéo PHẢI - CHI PHÍA TRƯỚC Foreground): sải bước chính, hạ thấp y (+4..+8px), to hơn (scale: 1.06..1.09), zOrder: +15 đè lên đùi trái.'
      if (isDiagLeft) return 'Đùi phải (Góc chéo TRÁI - CHI PHÍA SAU Background): sải hẹp hơn, co nhấc cao (y: -6..-10px), nhỏ hơn (scale: 0.92..0.96), zOrder: -15 lùi sau.'
      return 'Đùi phải (góc 0° - Soft Mesh): khi khuỵu gối/tiếp đất đặt rotation ÂM nhẹ (-4°..-7°) đối xứng đùi trái + TÁC LỰC NÉN MESH ĐÙI (scaleX: 1.05, scaleY: 0.88..0.91); khi trên không đặt scaleX: 0.97, scaleY: 1.03.'
    case 'shinR':
      if (isSide) return 'Cẳng chân phải (góc ngang 90°): rotation DƯƠNG (+15°..+45°) = gập gối ra sau.'
      if (isDiagRight) return 'Cẳng chân phải (Góc chéo PHẢI - Foreground): bước tới to hơn (scale: 1.06..1.08), hạ thấp (y: +4..+8px).'
      if (isDiagLeft) return 'Cẳng chân phải (Góc chéo TRÁI - Background): nhỏ hơn (scale: 0.92..0.95), nhấc cao (y: -6..-10px).'
      return 'Cẳng chân phải (góc 0° - Soft Mesh): khi khuỵu gối/tiếp đất đặt rotation DƯƠNG nhẹ (+4°..+6°) + TÁC LỰC NÉN MESH CẲNG CHÂN (scaleX: 1.06, scaleY: 0.87..0.90, y: -5..-7px); khi trên không đặt scaleX: 0.97, scaleY: 1.04.'
    case 'footR':
      return 'Bàn chân phải (Mesh Chịu Tác Lực Tiếp Đất): Khi nhún lấy đà / chạm đất chịu lực, BẮT BUỘC nén dẹt & bè ngang lưới Mesh đế giày (scaleX: 1.14..1.18, scaleY: 0.82..0.86, y: +2..+4px, rotation: -2°..-5°); khi bật nhảy rời đất, duỗi thon bàn chân (scaleX: 0.93..0.95, scaleY: 1.08..1.12, rotation: +6°..+10°).'
    default:
      return 'Khớp tuỳ chỉnh (Soft Mesh): xoay mượt mà (±5°..±35°), kết hợp scaleX/scaleY (0.90..1.10) để uốn lưới tam giác theo quán tính.'
  }
}

/** Tạo danh sách metadata giải phẫu & vùng uốn Mesh chi tiết cho từng xương */
export function buildBoneBiomechanicsGuide(
  bones: ReadonlyArray<LayerBone>,
  composite?: LayerComposite,
  viewAngle: MotionViewAngle = 'front'
): BoneBiomechanicsMeta[] {
  const roleMap = inferHumanoidBoneRoles(bones)
  const idToRole = new Map<string, AnatomicalBoneRole>()
  for (const [role, boneId] of Object.entries(roleMap)) {
    if (boneId) idToRole.set(boneId, role as AnatomicalBoneRole)
  }

  return bones.map((b) => {
    const role = idToRole.get(b.id) ?? 'custom'
    const tail = computeBoneTail(b)
    const boundLayers = (composite?.layers ?? [])
      .filter((l) => l.boneId === b.id || l.extraBoneIds?.includes(b.id))
      .map((l) => {
        const { w, h } = extractLayerDimensions(l)
        return `${l.name} (${l.id} · ${Math.round(w)}×${Math.round(h)}px · Z=${Math.round(l.z ?? 0)}px)`
      })
    return {
      id: b.id,
      name: b.name,
      parentId: b.parentId || null,
      role,
      x: Math.round(b.x),
      y: Math.round(b.y),
      tailX: Math.round(tail.x),
      tailY: Math.round(tail.y),
      length: Math.round(b.length),
      angle: Number(b.angle.toFixed(1)),
      restDirectionDesc: describeBoneRestDirection(b, role),
      meshEnvelope: b.meshEnvelope ?? composite?.rig?.meshEnvelope ?? true,
      strength: Number((b.strength ?? 1.15).toFixed(2)),
      influenceReach: Number((b.influenceReach ?? 1.1).toFixed(2)),
      ...(b.pin ? { pin: true } : {}),
      boundLayers,
      directionGuide: getRoleDirectionGuide(role, viewAngle)
    }
  })
}

/** Xuất cấu hình Mesh Deformation & Tác lực tiếp đất của nhân vật ra JSON */
export function buildMeshDeformationExportSection(
  bones: ReadonlyArray<LayerBone>,
  composite?: LayerComposite
): MotionMeshExportSection {
  const layers = composite?.layers ?? []
  const rig = composite?.rig
  return {
    enabled: true,
    meshEnvelope: rig?.meshEnvelope ?? true,
    groundContactImpact: {
      enabled: true,
      footImpactSquash: { scaleX: 1.16, scaleY: 0.84, offsetY: 2.5 },
      shinImpactCompression: { scaleX: 1.06, scaleY: 0.88, offsetY: -6.0 },
      thighImpactCompression: { scaleX: 1.05, scaleY: 0.89 },
      airborneFootStretch: { scaleX: 0.94, scaleY: 1.10 },
      torsoElasticity: { squashScaleX: 1.04, squashScaleY: 0.93, stretchScaleX: 0.97, stretchScaleY: 1.04 }
    },
    boneEnvelopes: bones.map((b) => ({
      boneId: b.id,
      boneName: b.name,
      meshEnvelope: b.meshEnvelope ?? rig?.meshEnvelope ?? true,
      strength: Number((b.strength ?? 1.15).toFixed(2)),
      influenceReach: Number((b.influenceReach ?? 1.1).toFixed(2)),
      ...(b.pin ? { pin: true } : {})
    })),
    layerBindings: layers
      .filter((l) => Boolean(l.boneId || l.extraBoneIds?.length || l.physics?.enabled || l.isCloth))
      .map((l) => {
        const extra = l.extraBoneIds?.length
          ? l.extraBoneIds
          : extraSoftBoneIdsForLayer(layers, rig, l.id, l.boneId)
        return {
          layerId: l.id,
          layerName: l.name,
          bindingMode: l.bindingMode ?? 'soft',
          boneId: l.boneId ?? null,
          ...(extra.length > 0 ? { extraBoneIds: extra } : {}),
          ...(l.meshWidth && l.meshHeight ? { meshWidth: l.meshWidth, meshHeight: l.meshHeight } : {}),
          ...(l.isCloth
            ? {
                isCloth: true,
                clothFollowBoneId: l.clothFollowBoneId,
                clothAmplitude: l.clothAmplitude ?? 40
              }
            : {}),
          ...(l.physics?.enabled
            ? {
                physics: {
                  enabled: true,
                  material: l.physics.material,
                  role: l.physics.role,
                  stiffness: l.physics.stiffness,
                  damping: l.physics.damping,
                  bounciness: l.physics.bounciness
                }
              }
            : {})
        }
      })
  }
}

export { isGenericClipName, inferDescriptiveClipName, normalizeAndFixBiomechanicalTracks } from './workshopClipNormalization'

/**
 * Tự động kích hoạt Uốn mềm Lưới Mesh (bindingMode: 'soft', meshEnvelope: true, extraBoneIds liên kết khớp)
 * cho các bộ phận cơ thể và áp dụng cấu hình meshDeformation từ JSON để hiệu ứng nén/giãn Mesh hiển thị rõ nét.
 */
export function upgradeCompositeSoftMeshForImpact(
  layers: ReadonlyArray<AssembledLayerItem>,
  rig: LayerRig,
  meshSection?: Partial<MotionMeshExportSection>
): { layers: AssembledLayerItem[]; rig: LayerRig } {
  const envMap = new Map(
    (meshSection?.boneEnvelopes ?? []).map((e) => [e.boneId.toLowerCase(), e])
  )
  const bindMap = new Map(
    (meshSection?.layerBindings ?? []).map((b) => [b.layerId.toLowerCase(), b])
  )

  const nextBones = rig.bones.map((b) => {
    const customEnv = envMap.get(b.id.toLowerCase())
    return {
      ...b,
      meshEnvelope: customEnv?.meshEnvelope ?? b.meshEnvelope ?? true,
      strength: customEnv?.strength ?? b.strength ?? 1.15,
      influenceReach: customEnv?.influenceReach ?? b.influenceReach ?? 1.1
    }
  })

  const nextRig: LayerRig = {
    ...rig,
    meshEnvelope: meshSection?.meshEnvelope ?? rig.meshEnvelope ?? true,
    bones: nextBones
  }

  const garmentInfo = detectGarmentCoversLegs(layers, nextRig.bones)

  const nextLayers = layers.map((l) => {
    const customBind = bindMap.get(l.id.toLowerCase())
    const robeMatch = garmentInfo.robeLayers.find((r) => r.id === l.id)
    const isRigidAccessory = /glass|kính|hat|mũ|eye|mắt|mouth|miệng|brow|mày/i.test(`${l.id} ${l.name} ${l.slot ?? ''}`)
    const targetMode: 'soft' | 'rigid' =
      customBind?.bindingMode ?? (isRigidAccessory ? (l.bindingMode ?? 'rigid') : 'soft')
    const boneId = customBind?.boneId ?? l.boneId
    const baseExtra =
      customBind?.extraBoneIds ??
      (l.extraBoneIds?.length ? l.extraBoneIds : extraSoftBoneIdsForLayer(layers as AssembledLayerItem[], nextRig, l.id, boneId))
    const computedExtra =
      robeMatch && robeMatch.coveredBoneIds.length > 0
        ? Array.from(new Set([...baseExtra, ...robeMatch.coveredBoneIds]))
        : baseExtra
    const effectiveIsCloth = customBind?.isCloth ?? (l.isCloth || Boolean(robeMatch && robeMatch.coveredBoneIds.length > 0))
    const effectiveClothFollow = customBind?.clothFollowBoneId ?? l.clothFollowBoneId ?? robeMatch?.coveredBoneIds[0]
    const effectiveClothAmp = customBind?.clothAmplitude ?? l.clothAmplitude ?? (effectiveIsCloth ? 45 : undefined)

    return {
      ...l,
      ...(boneId ? { boneId, bindingMode: targetMode } : {}),
      ...(targetMode === 'soft' && computedExtra.length > 0 ? { extraBoneIds: computedExtra } : {}),
      ...(effectiveIsCloth ? { isCloth: true } : {}),
      ...(effectiveClothFollow ? { clothFollowBoneId: effectiveClothFollow } : {}),
      ...(effectiveClothAmp !== undefined ? { clothAmplitude: effectiveClothAmp } : {})
    }
  })

  return { layers: nextLayers, rig: nextRig }
}
