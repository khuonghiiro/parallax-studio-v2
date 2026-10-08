export interface Face3D {
  id: string
  name: string
  /** Relative asset path (e.g. 'house/origami_front.png') or project assetId or data URL */
  assetPath?: string
  assetId?: string
  color?: string
  width: number
  height: number
  position: [number, number, number]
  rotation: [number, number, number] // [rx, ry, rz] in degrees
  scale?: [number, number, number]
  opacity?: number
  /** Độ uốn cong theo chiều ngang (-100 đến 100, tạo vòm cung / hình trụ / uốn cong) */
  bendX?: number
  /** Độ uốn cong / vểnh mép theo chiều dọc (-100 đến 100, tạo mái cong / mép vểnh) */
  bendY?: number
  /** Khu vực uốn cong 1 phần: 'all' (toàn bộ), 'bottom' (mái hiên / mép dưới), 'top' (nửa trên), 'left' (mép trái), 'right' (mép phải) */
  bendRegion?: 'all' | 'bottom' | 'top' | 'left' | 'right'
  /** Độ phân giải lưới mesh (16, 24, 32, 48) */
  gridRes?: number
  /** Số cột lưới tự tạo thủ công */
  gridCols?: number
  /** Số hàng lưới tự tạo thủ công */
  gridRows?: number
  /** Góc xoay của khung lưới (-180° đến 180°) để xoay căn chỉnh lấy đúng phần pixel nghiêng */
  gridRotation?: number
  /** Chế độ tạo Mesh: 'auto' (tự động theo viền pixel ảnh) | 'manual' (tự tạo khung lưới thủ công) */
  meshMode?: 'auto' | 'manual'
  /** Vùng khung lưới thủ công lấy pixel [uMin, vMin, uMax, vMax] (0..1) */
  cropBounds?: [number, number, number, number]
  /** Danh sách các ô mesh đang được chọn để bẻ/uốn/xoay cục bộ */
  selectedCells?: string[]
  /** Góc bẻ / uốn riêng của các ô mesh đang chọn (-90° đến 90°) */
  cellBendAngle?: number
  /** Danh sách các cell / ô lưới bị gọt/xóa thủ công: ["r_c", "r_c_t0", ...] */
  hiddenCells?: string[]
  /** After Effects 2.5D Depth Profile: 'none' | 'luminance' | 'sphere' | 'cylinder' | 'slope' | 'ridge' */
  depthProfile?: 'none' | 'luminance' | 'sphere' | 'cylinder' | 'slope' | 'ridge'
  /** Cường độ đùn sâu (-200% đến 200%) */
  depthIntensity?: number
  /** Đảo ngược chiều sâu (vùng tối lồi, vùng sáng lõm) */
  depthInvert?: boolean
  /** After Effects Procedural Mesh Motion: 'none' | 'wind' | 'wave' | 'breathe' | 'wiggle' */
  motionType?: 'none' | 'wind' | 'wave' | 'breathe' | 'wiggle'
  /** Tốc độ chuyển động dao động (0.1 đến 5.0) */
  motionSpeed?: number
  /** Biên độ dao động / uốn lượn (0 đến 100) */
  motionAmplitude?: number
  /** Hướng dao động chuyển động */
  motionDirection?: 'both' | 'horizontal' | 'vertical' | 'depthZ'
  /** Điểm neo / gốc ghim cố định không chuyển động */
  motionAnchor?: 'bottom' | 'top' | 'left' | 'center' | 'all'
  /** Danh sách các ô mesh bị ghim cố định (Starch Pin / Puppet Pin) không bị chuyển động */
  pinnedCells?: string[]
  /** Cấu hình nếp gấp Origami 3D chia đôi ảnh theo đường thẳng/chéo */
  foldLine?: OrigamiFoldLine
  /** Chế độ biến dạng khung lưới 3x3 kiểu Photoshop Warp (stairs, arch, corner, wave) */
  warp3x3Mode?: Warp3x3Preset
  /** Cường độ biến dạng 3x3 / Độ cao bậc thang (-100 đến 100) */
  warp3x3Intensity?: number
}

export interface OrigamiFoldLine {
  enabled: boolean
  /** Điểm bắt đầu [u, v] (0..1) */
  p1: [number, number]
  /** Điểm kết thúc [u, v] (0..1) */
  p2: [number, number]
  /** Bên được gấp: 'sideA' (phần phía trên/trái) | 'sideB' (phần phía dưới/phải) */
  foldSide: 'sideA' | 'sideB'
  /** Góc gấp 3D quanh trục đường kẻ (-180° đến 180°) */
  angle: number
}

export type Warp3x3Preset = 'none' | 'stairs' | 'arch' | 'corner' | 'wave'

export type PresetType = 'cottage' | 'cube' | 'corner' | 'room'

export interface Model3D {
  id: string
  name: string
  description?: string
  category: 'architecture' | 'props' | 'room' | 'custom'
  thumbnail?: string
  thumbnailDataUrl?: string
  scale: number // overall scaling factor (default 1.0)
  faces: Face3D[]
  createdAt: number
  updatedAt: number
}
