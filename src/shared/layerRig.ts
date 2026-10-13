/** Cutout skeleton in workshop coordinates: X right, Y down, degrees clockwise. */
export interface LayerBone {
  id: string
  name: string
  parentId?: string
  x: number
  y: number
  length: number
  angle: number
}

export interface BonePose {
  x: number
  y: number
  rotation: number
  scaleX?: number
  scaleY?: number
}
export type BoneEasing = 'smooth' | 'linear' | 'hold' | 'ease-in' | 'ease-out' | 'ease-in-out'

export interface BoneKeyframe extends BonePose {
  time: number
  easing: BoneEasing
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

