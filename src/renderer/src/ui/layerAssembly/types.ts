export type MotionType = 'none' | 'sway' | 'breathe' | 'float' | 'wave' | 'rocking'
export type MotionAnchor = 'bottom' | 'center' | 'top' | 'left' | 'right'

export interface LayerMotionSettings {
  type: MotionType
  speed: number // Tốc độ chu kỳ (chuẩn 1.0)
  amplitude: number // Biên độ dao động (pixel hoặc góc độ)
  anchor: MotionAnchor // Điểm neo tâm đung đưa
  phaseOffset?: number // Độ lệch pha giây để chuyển động so le tự nhiên
}

import type { AssetTable } from '../../project/json/assetTable'
export type { AssetTable }

export interface AssembledLayerItem {
  boneId?: string
  extraBoneIds?: string[]
  bindingMode?: 'rigid' | 'soft'
  /** Transient preview rig, never persisted by workshop actions. */
  previewRig?: import('@shared/layerRig').LayerRig
  /** Transient: xương motion đang tác động lên layer (chỉ để xem trước, không lưu). */
  previewPlantSpines?: import('@shared/plantSpine').PlantSpine[]
  bindPose?: { x: number; y: number; rotation: number }
  id: string
  name: string
  /** Resource path or alias in composite assets table (e.g. '@head' or 'head') */
  asset?: string
  assetPath?: string
  imageUrl?: string
  x: number // Offset ngang tính từ tâm cụm
  y: number // Offset dọc tính từ tâm cụm
  z: number // Độ sâu thứ tự layer: Z càng lớn thì càng ở xa phía sau, Z càng nhỏ càng ở phía trước
  scale: number // Tỉ lệ phóng to thu nhỏ (chuẩn 1.0)
  scaleX?: number // Tỉ lệ co dãn ngang (squash & stretch)
  scaleY?: number // Tỉ lệ co dãn dọc (squash & stretch)
  rotation: number // Góc xoay trục Z (Roll) tính bằng độ (độ)
  rotationX?: number // Góc xoay trục X (Pitch) tính bằng độ (độ)
  rotationY?: number // Góc xoay trục Y (Yaw) tính bằng độ (độ)
  opacity: number // Độ trong suốt 0..1
  locked?: boolean
  hidden?: boolean
  /** Nhóm bộ phận (VD 'Đầu' gồm mặt/mắt/miệng/kính/tóc) — khi nhóm khoá, kéo 1 bộ phận sẽ kéo cả nhóm. */
  partGroupId?: string
  /** Khe biến thể (VD 'face'): các layer cùng khe là các phương án thay thế nhau, chỉ 1 layer hiển thị. */
  slot?: string
  /** Tên biến thể trong khe (VD 'happy', 'cry'). */
  variant?: string
  motion: LayerMotionSettings
  /** Nhãn chất liệu vật lý, mặt đất đỡ, vùng Sub-Mesh UV & cổng chiều sâu hang động gắn sẵn tại Xưởng */
  physics?: import('@shared/types').LayerPhysicsConfig
  /** Nguồn sáng ảo 2.5D (Ánh nến phản ứng gió, Đèn pin, Tinh thể hang động...) gắn sẵn tại Xưởng */
  virtualLight?: import('@shared/types').LayerVirtualLight
}

export type LayerPartKind = 'head' | 'torso' | 'arm' | 'leg' | 'accessory' | 'custom'

export interface LayerPartGroup {
  id: string
  name: string
  kind: LayerPartKind
  /** Khoá liên kết: di chuyển một bộ phận sẽ dịch chuyển đồng bộ toàn bộ bộ phận trong nhóm. */
  locked: boolean
  /** Layer neo của nhóm (VD layer 'head'). */
  anchorLayerId?: string
}

import type { AssemblyLighting } from '../assets/models3d/types'
export type { AssemblyLighting }

export interface LayerComposite {
  rig?: import('@shared/layerRig').LayerRig
  /** Xương motion: đường cong vẽ tay giúp layer uốn đung đưa như cây cỏ */
  plantSpines?: import('@shared/plantSpine').PlantSpine[]
  id: string
  name: string
  category: 'nature' | 'prop' | 'character' | 'architecture' | 'scene' | 'custom'
  description?: string
  thumbnail?: string
  width: number
  height: number
  /** Bảng tài nguyên ánh xạ nhãn -> đường dẫn (Asset Aliases Table), giúp dễ dàng thay thế tài nguyên linh hoạt */
  assets?: AssetTable
  layers: AssembledLayerItem[]
  /** Nhóm bộ phận & liên kết (Đầu, Thân, Tay trái…) */
  partGroups?: LayerPartGroup[]
  /** Danh sách động tác chuyển động ảnh đặt tên động (nhép miệng, nháy mắt, đổi biểu cảm...) để Node Animation lấy ra sử dụng */
  customActions?: import('@shared/types').CompositeCustomAction[]
  lighting?: AssemblyLighting
  createdAt?: number
  updatedAt?: number
}

export interface LayerCompositeCategory {
  id: string
  title: string
  icon: string
  order: number
}
