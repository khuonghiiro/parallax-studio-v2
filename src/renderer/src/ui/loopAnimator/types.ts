import type {
  LoopAnimationMode,
  LoopPackageGroupDef,
  LoopRhythmMode,
  LoopTriggerMode
} from '@shared/types'

export type SlicerMode = 'grid' | 'contour' | 'manual'
export type { LoopAnimationMode, LoopPackageGroupDef, LoopRhythmMode, LoopTriggerMode }

export type LoopCategorySlug = 'fire' | 'magic' | 'nature' | 'electric' | 'custom' | (string & {})

export interface LoopFrameBox {
  id: string
  index: number
  /** Top-left X in source image pixels */
  x: number
  /** Top-left Y in source image pixels */
  y: number
  /** Width in source image pixels */
  width: number
  /** Height in source image pixels */
  height: number
  /** Frame-specific pivot/offset X adjustment (px) for stabilizing jittery sprites */
  offsetX: number
  /** Frame-specific pivot/offset Y adjustment (px) */
  offsetY: number
  /** Whether this frame is included in playback & export */
  enabled: boolean
  /** Frame duration multiplier (1.0 = standard 1/fps) */
  durationRatio: number
  /** Nhóm hiệu ứng chứa frame này (phục vụ lưu animation.json & điều phối Node Animation Loop) */
  groupId?: string
  groupIndex?: number
  groupName?: string
  localFrameIndex?: number
}

export type LoopShadowMode = 'off' | 'include' | 'only'
export type LoopShadowType = 'auto' | 'light' | 'dark'
/** Phạm vi tách nền: 'all' (Tách toàn bộ — cả trong lẫn ngoài viền kín) | 'outer_only' (Chỉ tách nền ngoài) */
export type LoopIsolationMode = 'all' | 'outer_only'

export interface ChromaKeyConfig {
  enabled: boolean
  /** Hex color to remove, e.g. '#00ff00' */
  keyColor: string
  /** Color distance tolerance (0..1, default 0.28) */
  similarity: number
  /** Edge feathering smoothness (0..1, default 0.10) */
  smoothness: number
  /** Green/color spill suppression on semi-transparent edges (0..1, default 0.35) */
  spill: number
  /**
   * Phạm vi tách nền (mặc định 'all' để tương thích mẫu cũ):
   * - 'all': xoá mọi pixel trùng màu nền, kể cả nền nằm kín bên trong viền (vòng tròn chỉ còn viền).
   * - 'outer_only': chỉ xoá nền liên thông với mép ảnh, giữ nguyên phần nền bên trong viền kín.
   */
  isolationMode?: LoopIsolationMode
  /** Chế độ giữ bóng mờ / quầng sáng bán trong suốt: 'off' | 'include' (Lấy cả bóng) | 'only' (Chỉ lấy bóng) */
  shadowMode?: LoopShadowMode
  /** Phân loại bóng cần giữ: 'auto' | 'light' (Mây/Sáng) | 'dark' (Bóng tối) */
  shadowType?: LoopShadowType
  /** Độ đậm giữ bóng / quầng sáng (5..100, mặc định 68) */
  shadowRetention?: number
  /** Ngưỡng tách biên đặc khỏi bóng mờ (30..90, mặc định 62) */
  shadowSolidThreshold?: number
  /** Tự động khử màu nền pha trộn trong bóng mờ / quầng sáng (Color Unmixing) */
  shadowUnmixColor?: boolean
}

export interface GridSlicerConfig {
  cols: number
  rows: number
  marginX: number
  marginY: number
  paddingX: number
  paddingY: number
  /** Độ dày viền lưới cần loại bỏ quanh từng ô (px, mặc định 0) để khử sạch khung viền đen */
  borderPadding?: number
}

export interface ContourSlicerConfig {
  /** Alpha threshold (1..254) for considering a pixel non-empty */
  alphaThreshold: number
  /** Minimum bounding box area (px²) to ignore tiny dust specks */
  minArea: number
  /** Merge nearby bounding boxes within this pixel distance */
  mergeGap: number
  /** Automatically normalize all detected frames to uniform max width & height to prevent pulsing */
  uniformSize?: boolean
  /** Anchor alignment for uniform sizing: 'bottom' (ground) or 'center' */
  alignAnchor?: 'bottom' | 'center'
  /** Reading order: row_first (left to right), col_first, or snake (boustrophedon) */
  readingOrder?: 'row_first' | 'col_first' | 'snake'
}

export interface LoopRhythmConfig {
  rhythmMode: LoopRhythmMode
  rhythmRateHz: number
  rhythmIntensity: number
  minOpacity: number
  scaleBeatPct: number
}

export interface LoopPlaybackConfig {
  fps: number
  speed: number
  loopMode: LoopAnimationMode
  isPlaying: boolean
  onionSkin: boolean
  onionSkinOpacity: number
  previewBg: 'checker' | 'dark' | 'light' | 'green'
  rhythm: LoopRhythmConfig
  /** Stage anchor alignment: 'bottom' aligns sprite base to ground line, 'center' aligns to stage center */
  anchor?: 'bottom' | 'center'
}

export interface SampleLoopPreset {
  id: string
  name: string
  category: LoopCategorySlug
  badge: string
  description: string
  imageUrl: string
  defaultGrid: GridSlicerConfig
  defaultChroma: ChromaKeyConfig
  defaultFps: number
  defaultLoopMode?: LoopAnimationMode
  defaultSpeed?: number
  defaultRhythm?: Partial<LoopRhythmConfig>
}

export interface LoopAnimationTemplate {
  id: string
  name: string
  category: LoopCategorySlug
  badge: string
  description: string
  /** Source sprite sheet url or data URL */
  imageUrl: string
  /** Cropped preview PNG data URL (with Chroma Key removed) */
  thumbUrl?: string
  /** Chỉ số khung hình (0-based) được chọn làm ảnh đại diện thumbnail (mặc định 0 = Frame #1) */
  thumbnailFrameIndex?: number
  /** Các frame ảnh PNG trong suốt đã tách nền sẵn (Data URLs) để tái sử dụng ngay lập tức mà không phải khử nền hay cắt lại */
  renderedFrames?: string[]
  /** Toàn bộ sprite sheet đã khử nền trong suốt hoàn toàn (PNG Data URL) */
  transparentSheetUrl?: string
  /** Đường dẫn tương đối tới tệp cấu hình animation.json (ví dụ: loop_animations/<slug>/animation.json) */
  loopJsonPath?: string
  /** Thư mục gói hoạt ảnh đã tách frame (ví dụ: loop_animations/<slug>) */
  packageFolder?: string
  /** Danh sách đường dẫn tương đối tới từng frame ảnh PNG đã tách nền (ví dụ: loop_animations/<slug>/frame_000.png) */
  framePaths?: string[]
  /** Cấu hình màu sắc mặc định của gói hoạt ảnh */
  colorConfig?: import('@shared/types').LoopColorConfig
  slicerMode: SlicerMode
  gridConfig: GridSlicerConfig
  contourConfig?: ContourSlicerConfig
  chromaKey: ChromaKeyConfig
  fps: number
  speed?: number
  loopMode: LoopAnimationMode
  rhythm?: LoopRhythmConfig
  frameCount: number
  /** Kích thước pixel của ảnh Sprite Sheet nguồn khi lưu mẫu (để quy đổi tỉ lệ khi nâng cấp ảnh 2K/4K) */
  sourceWidth?: number
  sourceHeight?: number
  /** Kích thước mặt phẳng Mesh chuẩn trong không gian 3D/Xưởng (giữ nguyên bố cục khi nâng cấp texture lên 2K/4K) */
  baseMeshWidth?: number
  baseMeshHeight?: number
  /** Optional custom frame boxes if edited manually or via contour */
  frames?: LoopFrameBox[]
  /** Danh sách định nghĩa các nhóm hiệu ứng nối tiếp / kết hợp frame trong gói hoạt ảnh */
  groups?: LoopPackageGroupDef[]
  /** Dữ liệu các nhóm hiệu ứng trong phiên xưởng để mở lại chỉnh sửa từng nhóm */
  sequenceGroups?: LoopSequenceGroup[]
  isBuiltin?: boolean
  createdAt?: number
  updatedAt?: number
}

/**
 * Cấu hình độc lập của mỗi nhóm hiệu ứng (ảnh 1 -> ảnh 2 -> ảnh 3...) trong Xưởng Tách Hoạt Ảnh Loop.
 * Cho phép mỗi ảnh có cấu hình cắt khung, tách nền, FPS/tốc độ, vị trí chạy lệch (offsetX, offsetY, scale),
 * thời gian chờ (delaySec), thời lượng giữ (holdDurationSec) và kích hoạt theo frame (triggerMode: 'on_frame').
 */
export interface LoopSequenceGroup {
  id: string
  name: string
  sourceImageUrl: string
  sourceWidth: number
  sourceHeight: number
  baseMeshWidth: number
  baseMeshHeight: number
  slicerMode: SlicerMode
  gridConfig: GridSlicerConfig
  contourConfig: ContourSlicerConfig
  chromaKey: ChromaKeyConfig
  frames: LoopFrameBox[]
  selectedFrameIndex: number
  focusedFrameIndex: number | null
  fps: number
  speed: number
  loopMode: LoopAnimationMode
  rhythm: LoopRhythmConfig
  /** Chế độ kích hoạt so với nhóm trước: 'sequential' (Nối tiếp), 'on_frame' (Kết hợp tại Frame #), 'parallel' (Song song) */
  triggerMode: LoopTriggerMode
  /** Chỉ số frame (1-based) của nhóm trước kích hoạt nhóm này chạy cùng thời điểm (khi triggerMode = 'on_frame') */
  triggerFrameIndex: number
  /** Thời gian chờ (giây) trước khi nhóm này bắt đầu chạy */
  delaySec: number
  /** Thời lượng duy trì chạy/hiển thị của nhóm này (giây, 0 = tự động hết chu kỳ) */
  holdDurationSec: number
  /** Độ dịch chuyển vị trí X (px) trên sân khấu để căn khớp điểm chạm (VD: sét đánh -> tâm vụ nổ) */
  offsetX: number
  /** Độ dịch chuyển vị trí Y (px) trên sân khấu */
  offsetY: number
  /** Tỉ lệ kích thước của nhóm trên sân khấu (1 = 100%) */
  scale: number
  /** Tích chọn đồng bộ cấu hình Tách nền (Chroma Key) cùng các nhóm khác (mặc định true; bỏ tích nếu ảnh có nền khác biệt) */
  syncChromaKey?: boolean
}
