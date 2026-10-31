/** Cutout skeleton in workshop coordinates: X right, Y down, degrees clockwise. */
export interface LayerBone {
  id: string
  name: string
  parentId?: string
  x: number
  y: number
  length: number
  angle: number
  /** Moho Bone Strength / Influence Envelope multiplier (0.1..4.0, default 1.0). */
  strength?: number
  /** True when created as a Moho Pin Bone (point-pivot bone with compact capsule). */
  pin?: boolean
}

export interface BonePose {
  x: number
  y: number
  rotation: number
  scaleX?: number
  scaleY?: number
}
export type BoneEasing = 'smooth' | 'linear' | 'hold' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bezier'
export type BoneBezier = [number, number, number, number]

export interface BoneKeyframe extends BonePose {
  time: number
  easing: BoneEasing
  /** Outgoing cubic Bezier curve [x1, y1, x2, y2]; x controls are in [0, 1]. */
  bezier?: BoneBezier
}

export type MotionViewAngle = 'front' | 'diagonal' | 'side' | 'back'

/** Từng phân đoạn động tác hoạt ảnh độc lập (Animation Clip) của khung xương */
export interface AnimationClip {
  id: string
  name: string
  duration: number
  loop: boolean
  tracks: Record<string, BoneKeyframe[]>
  description?: string
  /** Source preset metadata for template catalog consumers. */
  presetKey?: string
  viewAngle?: MotionViewAngle
}

export interface LayerRig {
  bones: LayerBone[]
  duration: number
  loop: boolean
  tracks: Record<string, BoneKeyframe[]>
  /** Danh sách các clips động tác của khung xương */
  clips?: AnimationClip[]
  /** ID của động tác đang được kích hoạt và chỉnh sửa */
  activeClipId?: string
}
