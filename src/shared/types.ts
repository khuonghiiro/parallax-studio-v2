/**
 * Core project schema for Parallax Studio.
 *
 * Coordinate system (world units == composition pixels):
 *   x → right, y → up, z → DEPTH (positive = farther from the viewer, like After Effects).
 * The default camera sits at z = -defaultCameraDistance(comp) looking toward +z, so a
 * layer at z = 0 with scale 1 renders at its native pixel size.
 *
 * Shots (v2): a shot is a group of layers placed somewhere in the world. Layer transforms
 * are LOCAL to their shot; a shot's "framing" camera sits at local (0, 0, -referenceDistance)
 * looking at its local origin, so authoring inside a shot works exactly like a v1 scene.
 */

export type Vec3 = [number, number, number]

export type EaseName = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'easeInOutStrong' | 'hold' | 'pulse' | 'blink'

export interface EaseOptions {
  cycles?: number
  strength?: number
  holdUntil?: number
  duty?: number
}

export interface Keyframe<T> {
  id: string
  /** Time in seconds. */
  t: number
  value: T
  /** Easing applied to the segment that STARTS at this keyframe. */
  ease: EaseName
  easeOptions?: EaseOptions
  /** Authored interval role, independent of outgoing interpolation. */
  timelineBoundary?: 'start' | 'end'
}

export interface Animatable<T> {
  value: T
  /** Empty => static property. Always kept sorted by t. */
  keyframes: Keyframe<T>[]
}

export type AnimValue = number | Vec3

export type BlendMode = 'normal' | 'add' | 'screen' | 'multiply'

export type AutoOrientMode = 'none' | 'camera' | 'camera-y'

export type LayerType = 'image' | 'text' | 'solid' | 'particles'

export interface Transform {
  position: Animatable<Vec3>
  rotation: Animatable<Vec3> // degrees
  scale: Animatable<Vec3> // 1 = 100%
  opacity: Animatable<number> // 0..1
  /** Anchor point (pivot) relative to center [-0.5..0.5]. e.g. [0, -0.5, 0] = base of tree/character. */
  anchor?: Animatable<Vec3>
}

export type LoopAnimationMode = 'loop' | 'ping-pong' | 'once' | 'random'
export type LoopRhythmMode = 'none' | 'flicker_opacity' | 'pulse_scale' | 'sync_both' | 'strobe_beat'
/** Hành vi khi Loop kết thúc (hết số lần chạy của chế độ `once` hoặc hết thời gian Node): giữ khung cuối, ẩn ngay, hoặc mờ dần rồi ẩn */
export type LoopEndAction = 'hold' | 'hide' | 'fade_out'

export interface LoopColorConfig {
  /** Màu phủ sắc tố (hex e.g. '#ff6600', null = màu gốc) */
  tintColor?: string | null
  /** Cường độ phủ màu (0..1, mặc định 0) */
  tintIntensity?: number
  /** Độ sáng (0..2, mặc định 1.0) */
  brightness?: number
  /** Độ tương phản (0..2, mặc định 1.0) */
  contrast?: number
  /** Độ bão hoà màu (0..2, mặc định 1.0) */
  saturation?: number
  /** Xoay vòng màu (độ, -180..180, mặc định 0) */
  hueRotate?: number
  /** Chế độ hoà trộn màu: 'normal' | 'screen' | 'additive' | 'multiply' */
  blendMode?: string
  /** Độ trong suốt tổng thể (0..1, mặc định 1.0) */
  opacity?: number
}

export interface LoopFrameMeta {
  index: number
  file: string
  durationRatio?: number
  offsetX?: number
  offsetY?: number
  tintColor?: string | null
  brightness?: number
  contrast?: number
  saturation?: number
  hueRotate?: number
  opacity?: number
}

export interface LoopAnimationPackageJson {
  version: '1.0'
  id: string
  name: string
  slug: string
  category: string
  fps: number
  speed: number
  loopMode: LoopAnimationMode
  frameCount: number
  width: number
  height: number
  baseMeshWidth?: number
  baseMeshHeight?: number
  duration: number
  thumbnail?: string
  colorConfig?: LoopColorConfig
  rhythm?: {
    rhythmMode: LoopRhythmMode
    rhythmRateHz: number
    rhythmIntensity: number
    minOpacity: number
    scaleBeatPct: number
  }
  frames: LoopFrameMeta[]
  sourceConfig?: {
    slicerMode?: string
    gridConfig?: Record<string, unknown>
    chromaKey?: Record<string, unknown>
    contourConfig?: Record<string, unknown>
  }
  createdAt?: number
  updatedAt?: number
}

export interface LoopAnimationConfigOverrides {
  speed?: number
  fps?: number
  loopMode?: LoopAnimationMode
  color?: LoopColorConfig
  rhythm?: Partial<{
    rhythmMode: LoopRhythmMode
    rhythmRateHz: number
    rhythmIntensity: number
    minOpacity: number
    scaleBeatPct: number
  }>
  timeOffset?: number
}

export interface ImageProps {
  assetId: string
  width: number
  height: number
  repeat?: [number, number]
  /** Animated GIF / Loop playback speed multiplier (default 1). */
  speed?: number
  /** Animated GIF / Loop mode (default 'loop'). */
  loopMode?: LoopAnimationMode
  /** Time offset in seconds to start animation. */
  timeOffset?: number
  /** Whether to continuously animate live in the editor viewport even when timeline playback is paused (default true). */
  autoPlayPaused?: boolean
  /** Optional Loop Animator template ID that generated this layer (for quick re-editing). */
  loopTemplateId?: string
  /** Rhythmic modulation synchronized with the loop animation (opacity flicker, scale pulse, strobe beat). */
  loopRhythmMode?: LoopRhythmMode
  /** Frequency in Hz for loop rhythm modulation (default 2.0). */
  loopRhythmRateHz?: number
  /** Intensity (0..1) of the opacity flicker or scale pulse (default 0.35). */
  loopRhythmIntensity?: number
  /** Minimum opacity floor (0..1) when flickering (default 0.35). */
  loopMinOpacity?: number
  /** Scale pulse amplitude in percentage (0..50%, default 12). */
  loopScaleBeatPct?: number
  /** Số lần chạy hết chu kỳ khi `loopMode = 'once'` (1..20, mặc định 1). */
  loopPlayCount?: number
  /** Mốc giây (timeline) bắt đầu đồng hồ Loop & vòng đời xuất hiện (mặc định = inPoint của layer). */
  loopStartTime?: number
  /** Mốc giây (timeline) kết thúc Loop dùng cho chế độ lặp vô tận khi chọn ẩn / mờ dần lúc hết thời gian. */
  loopEndTime?: number
  /** Hành vi khi Loop kết thúc: 'hold' (giữ khung cuối), 'hide' (ẩn ngay), 'fade_out' (mờ dần rồi ẩn). */
  loopEndAction?: LoopEndAction
  /** Thời lượng hiện dần từ trong suốt đến rõ nét khi Loop bắt đầu (giây, 0 = tắt). */
  loopFadeInSec?: number
  /** Thời lượng mờ dần trước khi ẩn khi `loopEndAction = 'fade_out'` (giây, mặc định 0.5). */
  loopFadeOutSec?: number
  /** Đường dẫn tương đối tới file cấu hình animation.json (ví dụ 'loop_animations/anh_lua_chay/animation.json') */
  loopJsonPath?: string
  /** Thuộc tính tuỳ biến của layer kế thừa và ghi đè lên animation.json mà không sửa đổi file gốc */
  loopOverrides?: LoopAnimationConfigOverrides
  /** Shorthand cấu hình màu sắc ghi đè (tiện dụng) */
  loopColor?: LoopColorConfig
}

export interface TextProps {
  text: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  color: string
  letterSpacing: number
  shadow: boolean
}

export interface SolidProps {
  color: string
  color2: string
  gradient: boolean
  width: number
  height: number
  pattern?: 'none' | 'grid' | 'stripes' | 'dots'
  gridSize?: number
}

export interface ParticleProps {
  count: number
  seed: number
  size: number
  color: string
  /** Emission box size (world units). */
  area: Vec3
  /** Velocity in units/second. */
  velocity: Vec3
  /** Random sway amplitude in units. */
  sway: number
  twinkle: boolean
  glow: boolean
}

export type LayerMotionType = 'none' | 'drift' | 'wind' | 'sway' | 'float' | 'pulse' | 'wiggle' | 'spin'

export type DriftDirection =
  | 'right'
  | 'up-right'
  | 'up'
  | 'up-left'
  | 'left'
  | 'down-left'
  | 'down'
  | 'down-right'

export type DriftLoopMode = 'wrap' | 'uv' | 'ping-pong' | 'continuous'

export interface LayerMotion {
  enabled?: boolean
  /** Overall effect strength, 0..1. */
  amount?: number
  /** Composition seconds; absent preserves legacy absolute timing. */
  startTime?: number
  /** Seconds; 0 means unlimited. */
  duration?: number
  fadeIn?: number
  fadeOut?: number
  /** Deterministic Wiggle variation; 0 preserves legacy noise. */
  seed?: number
  type: LayerMotionType
  /** Speed multiplier (units/sec for drift, cycles/sec for periodic waves). */
  speed?: number
  /** Displacement amplitude [x, y, z] or angle for sway. */
  amplitude?: Vec3
  /** Initial phase offset in radians or time units. */
  phase?: number
  /** Loop span in world units along drift direction for wrapping. */
  loopWidth?: number
  /** Drift direction: angle in degrees (0-360) or named preset ('left', 'right', 'up', 'down', 'down-left'...). */
  direction?: number | DriftDirection
  /** Loop mode: 'wrap' (directional wrap), 'uv' (seamless texture scroll), 'ping-pong' (smooth wave), 'continuous'. */
  loopMode?: DriftLoopMode
}

export type GlowSide = 'outer' | 'inner' | 'both'
export type GlowAnimation = 'none' | 'blink' | 'breathe' | 'flicker'

export interface LayerGlow {
  enabled: boolean
  /** Glow placement relative to alpha silhouette: 'outer' (default), 'inner', or 'both'. */
  side?: GlowSide
  /** Hex color for the neon edge glow (default: '#3dd6f5'). */
  color?: string
  /** Outline glow radius in texels / pixels (1-40, default: 8). */
  thickness?: number
  /** Glow brightness / intensity multiplier (0.1-3.0, default: 1.2). */
  intensity?: number
  /** Animated glow modulation: 'none', 'blink', 'breathe', 'flicker'. */
  animated?: GlowAnimation
  /** Speed / frequency of blink or breathe in Hz (default: 2.0). */
  speed?: number
  /** Minimum intensity when blinking / breathing (0-1, default: 0.1). */
  minIntensity?: number
  /** Start time in seconds for the glow effect (default: 0). */
  startTime?: number
  /** Duration in seconds for the glow effect (0 or undefined = active until layer end). */
  duration?: number
}

export interface AppliedLayerEffect {
  id: string
  presetId: string
  name: string
  badge: string
  category: 'opacity' | 'transform' | 'glow' | 'motion'
  startTime: number
  duration: number
  enabled: boolean
  /** Procedural effect parameters. Timing and enabled state belong to this effect instance. */
  motion?: LayerMotion
  targetProp?: 'opacity' | 'position' | 'scale' | 'rotation'
  keyframeIds?: string[]
  glow?: LayerGlow
  count?: number
  intensity?: number
}

import type { ImageMeshDefinition } from './imageMeshDefinition'

export interface LayerModel3DRef {
  instanceId: string // Unique ID for this assembled 3D object in the shot
  modelId: string // e.g. 'model-tudor-cottage'
  modelName: string // e.g. 'Ngôi Nhà Tudor 3D'
  faceId: string // e.g. 'face-front'
  initialScale: number // base scale of the model (e.g. 0.6)
  globalScale: number // current overall scale factor
  basePosition: Vec3 // unscaled face offset from model origin [x, y, z]
  centerPosition?: Vec3 // position of the 3D model center in the shot
  baseSize?: [number, number]
  lockedGroup?: boolean
  /** Deformable organic mesh definition */
  mesh?: ImageMeshDefinition
}

export interface LayerCompositeRef {
  /** Unique ID for this composite instance in the shot */
  instanceId: string
  /** Composite template or preset ID */
  compositeId: string
  /** Composite display name (e.g. 'Cây Sồi Đung Đưa 3 Lớp') */
  compositeName: string
  /** True if this layer acts as the positioning anchor / root of the composite */
  isRoot?: boolean
  /**
   * If true, moving or transforming this layer moves/transforms all layers in the composite together.
   * If false, this layer can be moved, animated, or replaced individually.
   */
  lockedGroup: boolean
  /** Shot-space center position of the composite group */
  centerPosition?: Vec3
  /** Offset relative to the root layer */
  rootOffset?: Vec3
  /** ID of the source layer inside the composite template (used for quick part / expression swaps). */
  sourceLayerId?: string
  /** Swap slot of the source layer (e.g. 'face'); layers of the template sharing it are interchangeable variants. */
  slot?: string
  /** Variant name currently shown in the slot (e.g. 'happy'). */
  variant?: string
  /** Part group of the source layer (e.g. 'part-head'). */
  partGroupId?: string
  /** Danh sách động tác đặt tên động (nhép miệng, nháy mắt, đổi biểu cảm...) của cụm 2.5D */
  customActions?: CompositeCustomAction[]
}

export interface CompositeCustomAction {
  id: string
  /** Tên động do người dùng cấu hình (ví dụ: 'Nhép miệng nói', 'Nháy mắt', 'Cười tươi') */
  name: string
  icon?: string
  /** Kiểu động tác: 'sprite_cycle' (luân phiên ảnh miệng/mắt/biểu cảm), 'part_pose' (xoay/nhún bộ phận), 'rig_clip' (clip xương) */
  kind: 'sprite_cycle' | 'part_pose' | 'rig_clip'
  /** Danh sách ID layer trong mẫu (hoặc tên bộ phận) tham gia động tác */
  layerIds: string[]
  /** Tốc độ luân phiên ảnh / nhịp cử động (Hz, mặc định 4.0 cho nhép miệng, 0.45 cho nháy mắt) */
  speedHz?: number
  /** Thời lượng mặc định (giây) */
  duration?: number
  /** Có lặp lại trong khoảng thời gian hay không */
  loop?: boolean
  /** Góc xoay cử động (độ) cho part_pose */
  rotDeg?: number
  /** ID clip xương liên kết (nếu kind === 'rig_clip') */
  rigClipId?: string
}

export type LayerPhysicsMaterial =
  | 'none'
  | 'wood_tree'
  | 'foliage_bush'
  | 'jelly_slime'
  | 'stone_wall'
  | 'metal_armor'
  | 'cloth_rope'
  | 'flesh_body'
  | 'ground_terrain'

export type LayerPhysicsRole =
  | 'auto'
  | 'prop_target'
  | 'striker'
  | 'projectile'
  | 'vault_jumper'
  | 'ground_surface'
  | 'both'

export type LayerPhysicsColliderZone =
  | 'full'
  | 'fist_hand'
  | 'foot_bottom'
  | 'top_surface'
  | 'trunk_center'
  | 'arrow_tip'
  | 'cave_portal'
  | 'custom_uv'

/** Vùng 1 phần Mesh (Sub-Mesh UV Region) được khoanh chọn để gắn nhãn vật lý / mặt đất / điểm chạm */
export interface PhysicsSubMeshRegion {
  /** Nhãn hiển thị của vùng Sub-Mesh (tùy chọn) */
  label?: string
  /** Giới hạn ngang u từ trái (0) sang phải (1) */
  minU: number
  maxU: number
  /** Giới hạn dọc v từ đáy (0) lên đỉnh (1) */
  minV: number
  maxV: number
}

/**
 * Cấu hình Vùng Độ Sâu / Lối Vào Hang Động (Cave Depth Portal) trên ảnh layer 2D:
 * Khi nhân vật đi vào vùng cửa hang sẽ tự động thu nhỏ dần theo phối cảnh,
 * bị bóng tối hang động che phủ dần, và được chiếu sáng lại nếu có Nguồn sáng ảo trong hang.
 */
export interface DepthPortalConfig {
  enabled: boolean
  /** Tâm lối vào hang động / đường hầm trên chuẩn UV [u, v] (0..1, mặc định [0.5, 0.45]) */
  centerUV: [number, number]
  /** Bán kính vùng cửa hang tính theo tỉ lệ kích thước ảnh ([rx, ry] hoặc bán kính đơn, mặc định [0.35, 0.35]) */
  radiusUV: [number, number] | number
  /** Tỉ lệ thu nhỏ tối đa khi nhân vật đi sâu vào tâm hang (0.15 .. 0.9, mặc định 0.38) */
  minScale: number
  /** Độ tối bóng đêm trong lòng hang che phủ dần nhân vật (0 .. 1, mặc định 0.82) */
  darkness: number
  /** Màu bóng tối trong hang (mặc định '#060812') */
  shadowTint?: string
  /** Độ lùi chiều sâu Z giả lập khi đi sâu vào tâm cửa hang (px, mặc định 120) */
  depthPullZ?: number
  /** Hình dáng vòm cửa hang: 'arch' (vòm hang đáy phẳng tự nhiên), 'ellipse' (elip), 'circle' (tròn) */
  archShape?: 'arch' | 'ellipse' | 'circle'
  /** Độ mềm viền chuyển tiếp từ mép đá vào bóng tối lòng hang (0.1 .. 1.0, mặc định 0.55) */
  feather?: number
}

export type VirtualLightKind =
  | 'none'
  | 'candle'
  | 'flashlight'
  | 'bulb'
  | 'campfire'
  | 'cave_crystal'
  | 'magic_orb'

export type WindStrengthPreset = 'none' | 'gentle' | 'strong' | 'storm'

/**
 * Chế độ hành vi quang học & vật lý theo thời gian của Nguồn sáng ảo 2.5D:
 * - 'auto': Tự động theo bản chất nguồn sáng (Nến/Lửa -> đối lưu & nhạy gió; Đèn pin -> ổn định kèm vi rung; Tinh thể/Phép thuật -> nhịp thở)
 * - 'steady': Ổn định êm (điện áp chuẩn / LED, vi dao động siêu nhỏ ~1.5%)
 * - 'subtle_flicker': Nhấp nháy nhẹ tự nhiên (nến cháy êm lặng gió / đèn sợi đốt ấm)
 * - 'wind_reactive': Phản ứng khí động học theo gió (lặng / gió nhẹ / gió mạnh / gió bão)
 * - 'breathing': Nhịp đập / thở ánh sáng nhẹ (chu kỳ sin êm ái co giãn cường độ & quầng sáng)
 * - 'intermittent': Chập chờn / pin yếu / tiếp xúc kém (sụt áp từng đợt ngắt quãng chân thực)
 * - 'strobe': Nháy cảnh báo / tia chớp dứt khoát
 */
export type VirtualLightBehaviorMode =
  | 'auto'
  | 'steady'
  | 'subtle_flicker'
  | 'wind_reactive'
  | 'breathing'
  | 'intermittent'
  | 'strobe'

/**
 * Công cụ Ánh Sáng Ảo 2.5D (Virtual Light):
 * Thay thế nguồn sáng tĩnh bằng ánh nến nhạy theo gió (không gió / gió nhẹ / gió mạnh / bão),
 * đèn pin chiếu góc hình nón, bóng đèn điện, lửa trại hoặc tinh thể phát sáng trong hang động.
 */
export interface LayerVirtualLight {
  enabled: boolean
  kind: VirtualLightKind
  /** Màu ánh sáng (hex) */
  color: string
  /** Cường độ sáng cơ bản (0.1 .. 4.0, mặc định 1.35) */
  intensity: number
  /** Bán kính vùng chiếu sáng (world units / px, mặc định 420) */
  radius: number
  /** Vị trí tương đối của nguồn sáng trên layer UV [u, v] (0..1, mặc định [0.5, 0.5]) */
  originUV?: [number, number]
  /** Góc chiếu (độ, 0 = sang phải, 90 = lên trên, -90 = xuống dưới) dành cho Đèn pin / Spotlight */
  beamAngleDeg?: number
  /** Độ mở chùm sáng hình nón (độ, 15..360, mặc định 52 cho đèn pin, 360 cho nến/bóng đèn) */
  coneAngleDeg?: number
  /** Mức gió thổi tác động lên ánh nến / ngọn lửa */
  windPreset?: WindStrengthPreset
  /** Cường độ gió chi tiết (0 .. 1.5) */
  windStrength?: number
  /** Độ nhạy phản ứng gió (0 .. 2.0) */
  windSensitivity?: number
  /** Hướng gió thổi (độ, mặc định 0 = thổi sang phải) */
  windDirectionDeg?: number
  /** Tốc độ chập chờn / nhấp nháy (Hz, mặc định 1.0) */
  flickerSpeed?: number
  /** Khoảng cách chiều sâu Z tối đa mà ánh sáng chiếu tới các layer lân cận (px, mặc định 280) */
  zReach?: number
  /** Khoảng cách chiều sâu Z tối đa chiếu tới các layer PHÍA TRƯỚC (tiền cảnh, z < z_light). Mặc định bằng zReach hoặc 1200 */
  zReachFront?: number
  /** Khoảng cách chiều sâu Z tối đa chiếu tới các layer PHÍA SAU (hậu cảnh, z > z_light). Mặc định bằng zReach hoặc 1200 */
  zReachBack?: number
  /** Độ dìm tối môi trường xung quanh ngoài vùng sáng để tạo tương phản sáng-tối vật lý (0 .. 0.85, mặc định 0.25) */
  ambientDim?: number
  /** Độ mềm viền chùm sáng / vùng bán dạ (0.1 .. 1.0, mặc định 0.5) */
  softness?: number
  /** Độ cong khung sáng (-0.8 = chụm tiêu điểm, 0 = nón thẳng, +1.0 = vòm bầu parabol rộng, mặc định 0.25) */
  beamCurvature?: number
  /** Chế độ hành vi thời gian của nguồn sáng (nhấp nháy nhẹ, nhịp đập, chập chờn pin yếu, nhạy gió...) */
  behaviorMode?: VirtualLightBehaviorMode
  /** Biên độ / độ sâu của nhịp thở, nhấp nháy hoặc chập chờn (0 .. 1, mặc định theo loại đèn) */
  pulseDepth?: number
  /** Cường độ tỉa tia sáng khí quyển Tyndall ra ngoài môi trường (0 .. 1, mặc định 0.48 cho đèn pin, 0.26 cho nến) */
  rayIntensity?: number
  /** Toggle bật/tắt tia sáng xuất hiện ngẫu nhiên & động theo gió / nhịp (mặc định true) */
  rayDynamic?: boolean
  /** Số luồng tia tỉa ra ngoài môi trường (3 .. 24, mặc định 9 cho đèn pin, 12 cho tỏa tròn) */
  rayCount?: number
  /** Độ hội tụ lõi chóa đèn Hotspot so với quầng loang môi trường Spill (0 .. 1, mặc định 0.58 cho đèn pin) */
  hotspotFocus?: number
  /** Hệ số khuếch tán & phản xạ ánh sáng sang các layer môi trường xung quanh (0 .. 1.5, mặc định 0.85) */
  envBounce?: number
  /** Thời điểm bắt đầu bật nguồn sáng (giây, mặc định theo layer) */
  startTime?: number
  /** Thời lượng bật nguồn sáng (giây, 0 hoặc undefined = tới hết layer) */
  duration?: number
}

export interface PhysicsImpactPulse {
  id: string
  /** Thời điểm xảy ra va chạm / tác động (giây) */
  time: number
  /** Loại tác động: 'punch' (đấm/đá), 'vault' (chống tay nhảy qua), 'press' (nhấn lún như thạch), 'land' (tiếp đất), 'arrow' (mũi tên/đạn cắm vào) */
  type: 'punch' | 'vault' | 'press' | 'land' | 'arrow'
  /** Vận tốc tác động [vx, vy, vz] (px/giây: độ lớn càng cao rung/lún càng mạnh) */
  velocity: Vec3
  /** Tọa độ điểm chạm chuẩn hóa trên mesh [u, v] trong khoảng [0..1] (u: trái->phải, v: gốc->đỉnh) */
  contactUV?: [number, number]
  /** ID layer gây ra tác động (nếu có) */
  sourceLayerId?: string
  /** Thời lượng hiệu lực / hồi phục (giây, mặc định 1.2s) */
  duration?: number
}

export interface LayerPhysicsConfig {
  enabled: boolean
  /** Chất liệu vật lý của layer quyết định phản ứng của mesh khi va chạm */
  material: LayerPhysicsMaterial
  /** Vai trò tương tác: vật thể môi trường nhận lực, tác nhân đấm/đá, mũi tên bay xuyên Z, mặt đất đỡ, nhân vật nhảy vượt tường, hoặc cả hai */
  role?: LayerPhysicsRole
  /** Vùng mesh dùng để xét va chạm (ví dụ cạnh nắm đấm, mũi chân, mặt trên bờ tường/thạch, thân cây, mũi tên, vùng khoanh UV) */
  colliderZone?: LayerPhysicsColliderZone
  /** Khoảng cách lệch Z-Depth tối đa để 2 layer được phép tương tác va chạm (mặc định 55px: phải cùng lớp Z mới chạm được nhau) */
  zTolerance?: number
  /** Dành cho mũi tên / đạn bay ('projectile'): tự động ghim dừng lại trên mesh mục tiêu khi bay tới đúng Z và chạm mesh */
  stickOnHit?: boolean
  /** Vùng 1 phần Mesh [minU..maxU, minV..maxV] được khoanh chọn để gắn nhãn */
  meshRegion?: PhysicsSubMeshRegion
  /** Cấu hình lối vào hang động / vùng độ sâu trên layer nền/đất */
  depthPortal?: DepthPortalConfig
  /** Độ dốc mặt đất (độ, -45..45) khi layer đóng vai trò mặt đất nghiêng */
  groundSlopeDeg?: number
  /** Khối lượng tương đối (0.1 .. 50, mặc định theo chất liệu) */
  mass?: number
  /** Hệ số trọng lực (0 = gắn cố định, 1 = trọng lực chuẩn cho nhảy/rơi parabol) */
  gravityScale?: number
  /** Cao độ mặt đất/sàn cục bộ (Y) để chặn rơi và tạo nảy khi tiếp đất */
  groundY?: number
  /** Độ cứng lò xo đàn hồi của chất liệu (0.1 .. 2.5) */
  stiffness?: number
  /** Hệ số giảm chấn tắt dần (0.05 .. 1.0: càng nhỏ rung/nảy càng lâu như thạch) */
  damping?: number
  /** Độ nảy đàn hồi / Jiggle biên độ (0.1 .. 2.5) */
  bounciness?: number
  /** Độ nhạy nhận lực theo vận tốc va chạm (0.2 .. 3.0, mặc định 1.0) */
  hitSensitivity?: number
  /** Các xung lực combat / tương tác vật lý được kích hoạt hoặc ghi nhận trên layer */
  impacts?: PhysicsImpactPulse[]
}

interface LayerBase<T extends LayerType, P> {
  id: string
  name: string
  type: T
  visible: boolean
  locked: boolean
  /** Time in seconds the layer becomes visible / disappears. */
  inPoint: number
  outPoint: number
  /** Fade in transition duration in seconds. */
  fadeIn?: number
  /** Fade out transition duration in seconds. */
  fadeOut?: number
  blendMode: BlendMode
  /** Keep apparent size constant (from the default camera) when pushed in depth. */
  autoScale: boolean
  /** Auto-orient toward camera (After Effects billboard). 'camera' = full 3D, 'camera-y' = upright tree/character. */
  autoOrient?: AutoOrientMode
  /** Parent layer ID (After Effects Parent & Link): transforms relative to parent layer. */
  parentId?: string | null
  /** Owning shot, or null for a global layer (shared sky, subtitles…). */
  shotId: string | null
  /** 3D model assembly reference if this layer is part of an assembled 3D model. */
  model3d?: LayerModel3DRef
  /** Layer composite reference if this layer is part of an assembled multi-layer composite. */
  composite?: LayerCompositeRef
  /** Deformable organic mesh definition (curves, bends, tapers, lattices, sculpts) */
  mesh?: ImageMeshDefinition
  transform: Transform
  /** Procedural or looping motion (drift/sway/wind/float/pulse/wiggle). */
  motion?: LayerMotion
  /** Edge glow / neon outline effect following alpha silhouette. */
  glow?: LayerGlow
  /** List of individual fx presets applied to this layer with distinct icons and parameters. */
  appliedEffects?: AppliedLayerEffect[]
  /** Cấu hình giả lập vật lý chất liệu, trọng lực, vùng hang động và tương tác va chạm mesh 2.5D */
  physics?: LayerPhysicsConfig
  /** Nguồn sáng ảo 2.5D gắn trên layer (Ánh nến theo gió, Đèn pin chiếu góc, Bóng đèn, Lửa trại, Tinh thể) */
  virtualLight?: LayerVirtualLight
  props: P
}

export type ImageLayer = LayerBase<'image', ImageProps>
export type TextLayer = LayerBase<'text', TextProps>
export type SolidLayer = LayerBase<'solid', SolidProps>
export type ParticleLayer = LayerBase<'particles', ParticleProps>
export type Layer = ImageLayer | TextLayer | SolidLayer | ParticleLayer

export interface CameraSettings {
  position: Animatable<Vec3>
  target: Animatable<Vec3>
  fov: Animatable<number> // vertical, degrees
  /** Optional camera roll / Dutch angle tilt in degrees (clockwise). */
  roll?: Animatable<number>
  dofEnabled: boolean
  focusDistance: Animatable<number> // distance from camera, world units
  aperture: Animatable<number> // blur strength
  shakeAmount: number // units
  shakeSpeed: number // Hz-ish
  /** 0 = clear, 1 = fully faded to black. Used for fade transitions between shots. */
  fade: Animatable<number>
}

export interface Shot {
  id: string
  name: string
  color: string
  visible: boolean
  /** World placement (depth space). */
  position: Animatable<Vec3>
  /** Degrees; Y = yaw is the most useful one. */
  rotation: Animatable<Vec3>
}

export interface LookSettings {
  fogEnabled: boolean
  fogColor: string
  fogNear: number
  fogFar: number
  vignette: number // 0..1
  grain: number // 0..1
  exposure: number // stops
  contrast: number // 0..2 (1 = neutral)
  saturation: number // 0..2 (1 = neutral)
}

export interface Composition {
  name: string
  width: number
  height: number
  fps: number
  duration: number
  background: string
}

export interface AudioTrack {
  id?: string
  name?: string
  assetId: string
  offset: number // seconds; positive delays the audio
  volume: number // 0..1
  targetType?: AudioTargetType
  targetId?: string
  targetName?: string
  characterRole?: AudioCharacterRole
  lipSyncEnabled?: boolean
}

export type AudioTargetType = 'character' | 'layer' | 'model3d' | 'ambient'
export type AudioCharacterRole = 'voice' | 'sfx' | 'footstep' | 'foley' | 'bgm'

export interface AudioTrackItem {
  id: string
  assetId: string
  name?: string
  offset: number // seconds; start time on timeline
  volume: number // 0..2 (supports decibel gain boost)
  playbackRate?: number // 0.25..4, default 1 (speed & pitch)
  trimIn?: number // seconds from start of original asset, default 0
  duration?: number // seconds to play, default undefined (plays to end)
  fadeIn?: number // seconds, default 0
  fadeOut?: number // seconds, default 0
  tone?: 'normal' | 'bass' | 'treble' | 'vocal' | 'warm' // EQ tone filter preset
  muted?: boolean // true if track is muted
  loop?: boolean // true if track loops
  gainDb?: number // gain in decibels

  /** Loại mục tiêu gắn âm thanh: nhân vật composite, mô hình 3D, layer đơn lẻ hoặc âm thanh chung */
  targetType?: AudioTargetType
  /** ID thực thể mục tiêu (instanceId đối với nhân vật/mô hình 3D, hoặc layer.id) */
  targetId?: string
  /** Tên hiển thị của đối tượng mục tiêu (ví dụ: 'Nam Hiệp Sĩ', 'Ngôi Nhà Tudor 3D') */
  targetName?: string
  /** ID phân cảnh chứa đối tượng mục tiêu */
  targetShotId?: string
  /** Vai trò âm thanh của nhân vật: lồng tiếng/thoại, hiệu ứng, bước chân, foley, nhạc nền */
  characterRole?: AudioCharacterRole

  /** Bật cơ chế chuyển động / hé mở khẩu hình miệng (Lip-sync) theo biên độ giọng nói */
  lipSyncEnabled?: boolean
  /** ID của layer miệng cụ thể (nếu không chỉ định sẽ tự động nhận diện trong cụm nhân vật) */
  lipSyncLayerId?: string
  /** Độ nhạy / biên độ hé mở khẩu hình miệng (0.2 .. 3.0, mặc định: 1.0) */
  lipSyncIntensity?: number
}

export type AssetKind = 'image' | 'audio'

export interface AssetMeta {
  id: string
  name: string
  kind: AssetKind
  mime: string
  width?: number
  height?: number
  duration?: number
  /** Whether the asset is an animated GIF or animated WebP */
  isAnimated?: boolean
  /** Total number of frames in the animation */
  frameCount?: number
  /** File path if asset is stored on disk or relative to assets/ */
  path?: string
  /** Normalized relative path within assets/ (e.g. "demo_transparent/layer1_sky.png") */
  assetPath?: string
  /** Base64 dataUrl if embedded */
  dataUrl?: string
  /** Audio category: 'music' | 'ambient' | 'sfx' | 'voice' | 'cinematic' */
  category?: string
}

import type { WorkflowGraph } from './workflowTypes'
export * from './workflowTypes'
export type LayerVirtualLightConfig = LayerVirtualLight

export interface Project {
  version: 2
  comp: Composition
  camera: CameraSettings
  look: LookSettings
  shots: Shot[]
  /** Index 0 = top of the stack (drawn last when depths are equal). */
  layers: Layer[]
  assets: AssetMeta[]
  audio: AudioTrack | null
  audioTracks?: AudioTrackItem[]
  /** Quy trình Node-Port cấu hình kịch bản tạo video và chỉ dẫn Tác nhân Logic cho AI/MCP */
  workflow?: WorkflowGraph
}

