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
export interface LayerRig {
  bones: LayerBone[]
  duration: number
  loop: boolean
  tracks: Record<string, BoneKeyframe[]>
}
