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

export type EaseName = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'easeInOutStrong' | 'hold'

export interface Keyframe<T> {
  id: string
  /** Time in seconds. */
  t: number
  value: T
  /** Easing applied to the segment that STARTS at this keyframe. */
  ease: EaseName
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

export interface ImageProps {
  assetId: string
  width: number
  height: number
  repeat?: [number, number]
  /** Animated GIF playback speed multiplier (default 1). */
  speed?: number
  /** Animated GIF loop mode (default 'loop'). */
  loopMode?: 'loop' | 'ping-pong' | 'once'
  /** Time offset in seconds to start animation. */
  timeOffset?: number
  /** Whether to continuously animate live in the editor viewport even when timeline playback is paused (default true). */
  autoPlayPaused?: boolean
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

export type LayerMotionType = 'none' | 'drift' | 'wind' | 'sway' | 'float' | 'pulse' | 'wiggle'

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

export type LayerPhysicsRole = 'auto' | 'prop_target' | 'striker' | 'vault_jumper' | 'both'

export type LayerPhysicsColliderZone =
  | 'full'
  | 'fist_hand'
  | 'foot_bottom'
  | 'top_surface'
  | 'trunk_center'

export interface PhysicsImpactPulse {
  id: string
  /** Thời điểm xảy ra va chạm / tác động (giây) */
  time: number
  /** Loại tác động: 'punch' (đấm/đá), 'vault' (chống tay nhảy qua), 'press' (nhấn lún như thạch), 'land' (tiếp đất) */
  type: 'punch' | 'vault' | 'press' | 'land'
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
  /** Vai trò tương tác: vật thể môi trường nhận lực, tác nhân đấm/đá, nhân vật nhảy vượt tường, hoặc cả hai */
  role?: LayerPhysicsRole
  /** Vùng mesh dùng để xét va chạm (ví dụ cạnh nắm đấm, mũi chân, mặt trên bờ tường/thạch, thân cây) */
  colliderZone?: LayerPhysicsColliderZone
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
  /** Cấu hình giả lập vật lý chất liệu, trọng lực và tương tác va chạm mesh 2.5D */
  physics?: LayerPhysicsConfig
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
}
