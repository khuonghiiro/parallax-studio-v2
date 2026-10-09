export type MotionType = 'none' | 'sway' | 'breathe' | 'float' | 'wave' | 'rocking'
export type MotionAnchor = 'bottom' | 'center' | 'top' | 'left' | 'right'

export interface LayerMotionSettings {
  type: MotionType
  speed: number // Tốc độ chu kỳ (chuẩn 1.0)
  amplitude: number // Biên độ dao động (pixel hoặc góc độ)
  anchor: MotionAnchor // Điểm neo tâm đung đưa
  phaseOffset?: number // Độ lệch pha giây để chuyển động so le tự nhiên
}

export interface AssembledLayerItem {
  id: string
  name: string
  assetPath?: string
  imageUrl?: string
  x: number // Offset ngang tính từ tâm cụm
  y: number // Offset dọc tính từ tâm cụm
  z: number // Độ sâu thứ tự layer: Z càng lớn thì càng ở xa phía sau, Z càng nhỏ càng ở phía trước
  scale: number // Tỉ lệ phóng to thu nhỏ (chuẩn 1.0)
  rotation: number // Góc xoay độ (độ)
  opacity: number // Độ trong suốt 0..1
  locked?: boolean
  hidden?: boolean
  motion: LayerMotionSettings
}

export interface LayerComposite {
  id: string
  name: string
  category: 'nature' | 'prop' | 'character' | 'architecture' | 'custom'
  description?: string
  thumbnail?: string
  width: number
  height: number
  layers: AssembledLayerItem[]
  createdAt?: number
  updatedAt?: number
}

export interface LayerCompositeCategory {
  id: string
  title: string
  icon: string
  order: number
}
