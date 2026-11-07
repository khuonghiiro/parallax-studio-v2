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

export interface LoopWorkshopFrameRect {
  x: number
  y: number
  width: number
  height: number
  offsetX?: number
  offsetY?: number
  durationRatio?: number
}

export interface LoopWorkshopLayerConfig {
  enabled: boolean
  /** ID of the LoopAnimationTemplate or SampleLoopPreset */
  templateId?: string
  /** Source sprite sheet URL or data URL */
  spriteSheetUrl?: string
  /** Extracted frames (bounding rects on the sprite sheet) */
  frames?: LoopWorkshopFrameRect[]
  /** Chroma key config to remove background on the sprite sheet */
  chromaKey?: {
    enabled: boolean
    keyColor: string
    similarity: number
    smoothness: number
    spill: number
  }
  /** Base FPS (default 12) */
  fps: number
  /** Speed multiplier (0.1 .. 4.0, default 1.0) */
  speed: number
  /** Loop playback mode */
  loopMode: import('@shared/types').LoopAnimationMode
  /** Time offset in seconds */
  timeOffset?: number
  /** Rhythmic modulation synchronized with the loop animation */
  rhythmMode?: import('@shared/types').LoopRhythmMode
  rhythmRateHz?: number
  rhythmIntensity?: number
  minOpacity?: number
  scaleBeatPct?: number
  /** Các frame ảnh PNG trong suốt đã tách nền sẵn (Data URLs) để tái sử dụng ngay lập tức */
  renderedFrames?: string[]
  /** Kích thước mặt phẳng Mesh chuẩn của hoạt ảnh lặp trong không gian Xưởng (giữ nguyên khi nâng cấp ảnh 2K/4K) */
  meshWidth?: number
  meshHeight?: number
}

export interface AssembledLayerItem {
  boneId?: string
  extraBoneIds?: string[]
  bindingMode?: 'rigid' | 'soft'
  /** Transient: cô lập biến dạng mesh chỉ theo xương thuộc riêng bộ phận này khi composite có nhiều layer. */
  isolateToBoundBones?: boolean
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
  /** Kích thước mặt phẳng Mesh chuẩn trong Xưởng/Cảnh (giữ khớp xương & bộ phận khi thay ảnh 2K/4K) */
  meshWidth?: number
  meshHeight?: number
  /** Hộp bao vùng lưới Alpha Mesh chuẩn hoá UV [0..1] để căn tâm & tỉ lệ khi nâng cấp ảnh 2K/4K */
  meshBounds?: import('../../project/meshRatioSync').AlphaMeshBounds
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
  /** Cấu hình Hoạt ảnh Lặp (Loop Animate Sprite & Logic Nhịp Nháy) gắn trực tiếp cho mảnh trong Xưởng 2.5D */
  loopConfig?: LoopWorkshopLayerConfig
  /** Nhãn Vải / Quần áo: Uốn mềm Mesh theo xương chân/tay dẫn dắt */
  isCloth?: boolean
  /** Xương dẫn dắt uốn vải (chân/tay) */
  clothFollowBoneId?: string
  /** Biên độ uốn vải theo xương dẫn dắt (0..100%, mặc định 40%) */
  clothAmplitude?: number
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
  category: 'nature' | 'prop' | 'character' | 'animal' | 'architecture' | 'scene' | 'custom' | (string & {})
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
  folder?: string
  title: string
  shortTitle?: string
  icon: string
  iconUrl?: string
  iconText?: string
  accent?: string
  description?: string
  order?: number
  status?: 'active' | 'deleted' | 'hidden'
}
