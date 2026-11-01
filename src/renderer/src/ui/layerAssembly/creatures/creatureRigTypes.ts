import type { LayerBone } from '@shared/layerRig'

/**
 * Kiểu dữ liệu Thư viện khung xương sinh vật (Creature Skeleton Library) — tham khảo bộ khung mẫu
 * của Moho (Character Wizard / Bone Rig) và Adobe Animate (Bone Tool / IK Armature):
 * mỗi xương mang một "vai trò" (role) để bộ sinh chuyển động biết cách diễn hoạt (dáng đi, bơi, trườn, vỗ cánh).
 */

export type CreatureSpecies =
  | 'spider'
  | 'insect'
  | 'crab'
  | 'octopus'
  | 'snake'
  | 'fish'
  | 'bird'
  | 'butterfly'
  | 'horse'
  | 'dog'
  | 'lizard'
  | 'dragon'

export const CREATURE_SPECIES_IDS: CreatureSpecies[] = [
  'spider',
  'insect',
  'crab',
  'octopus',
  'snake',
  'fish',
  'bird',
  'butterfly',
  'horse',
  'dog',
  'lizard',
  'dragon'
]

export type CreatureFacing = 'left' | 'right'

export type CreatureBoneKind =
  | 'core'
  | 'head'
  | 'jaw'
  | 'neck'
  | 'leg'
  | 'arm'
  | 'wing'
  | 'tail'
  | 'tentacle'
  | 'antenna'
  | 'fin'
  | 'mane'
  | 'ear'

export interface CreatureBoneRole {
  kind: CreatureBoneKind
  side: 'l' | 'r' | 'c'
  /** Nhóm chuỗi xương (VD 'leg2-l', 'tail', 'arm3-r'). */
  group: string
  /** Chỉ số đốt trong chuỗi (0 = đốt gốc). */
  segment: number
  /** Tổng số đốt của chuỗi. */
  count: number
  /** Pha dáng đi 0..1 (chân bước so le). */
  phase: number
  /** Chi trước / sau với thú 4 chân (tính pha dáng chạy nước kiệu). */
  limb?: 'front' | 'hind'
  /** Chiều chuyển động (đảo dấu khi phản chiếu Trái ⇄ Phải hoặc đổi hướng mặt). */
  sign: 1 | -1
}

export interface CreatureRigOptions {
  /** Số cặp chân / cặp xúc tu. */
  legPairs?: number
  /** Số đốt mỗi chân. */
  legSegments?: number
  /** Số đốt chuỗi chính (đuôi, thân rắn, xúc tu, cột sống cá). */
  chainSegments?: number
  /** Có cánh (côn trùng). */
  wings?: boolean
  /** Hướng mặt với sinh vật nhìn ngang. */
  facing?: CreatureFacing
}

export interface CreatureRigBuild {
  species: CreatureSpecies
  bones: LayerBone[]
  roles: Record<string, CreatureBoneRole>
}

export type CreatureClipKind = 'walk' | 'trot' | 'idle' | 'swim' | 'slither' | 'flap' | 'scuttle' | 'snap'

export type CreatureBindMode = 'auto' | 'rigid' | 'soft'

export interface LayerPixelSize {
  w: number
  h: number
}
