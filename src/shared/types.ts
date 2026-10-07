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
  category: 'opacity' | 'transform' | 'glow'
  startTime: number
  duration: number
  enabled: boolean
  targetProp?: 'opacity' | 'position' | 'scale' | 'rotation'
  keyframeIds?: string[]
  glow?: LayerGlow
  count?: number
  intensity?: number
}

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
  transform: Transform
  /** Procedural or looping motion (drift/sway/wind/float/pulse/wiggle). */
  motion?: LayerMotion
  /** Edge glow / neon outline effect following alpha silhouette. */
  glow?: LayerGlow
  /** List of individual fx presets applied to this layer with distinct icons and parameters. */
  appliedEffects?: AppliedLayerEffect[]
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
}

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
