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
export interface BoneKeyframe extends BonePose {
  time: number
  easing: 'smooth' | 'linear' | 'hold'
}

/** Từng phân đoạn động tác hoạt ảnh độc lập (Animation Clip) của khung xương */
export interface AnimationClip {
  id: string
  name: string
  duration: number
  loop: boolean
  tracks: Record<string, BoneKeyframe[]>
  description?: string
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

