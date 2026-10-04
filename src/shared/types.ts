/**
 * Core project schema for Parallax Studio.
 *
 * Coordinate system (world units == composition pixels):
 *   x → right, y → up, z → DEPTH (positive = farther from the viewer, like After Effects).
 * The default camera sits at z = -defaultCameraDistance(comp) looking toward +z, so a
 * layer at z = 0 with scale 1 renders at its native pixel size.
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

export type LayerType = 'image' | 'text' | 'solid' | 'particles'

export interface Transform {
  position: Animatable<Vec3>
  rotation: Animatable<Vec3> // degrees
  scale: Animatable<Vec3> // 1 = 100%
  opacity: Animatable<number> // 0..1
}

export interface ImageProps {
  assetId: string
  width: number
  height: number
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

interface LayerBase<T extends LayerType, P> {
  id: string
  name: string
  type: T
  visible: boolean
  locked: boolean
  /** Time in seconds the layer becomes visible / disappears. */
  inPoint: number
  outPoint: number
  blendMode: BlendMode
  /** Keep apparent size constant (from the default camera) when pushed in depth. */
  autoScale: boolean
  transform: Transform
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
  assetId: string
  offset: number // seconds; positive delays the audio
  volume: number // 0..1
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
}

export interface Project {
  version: 1
  comp: Composition
  camera: CameraSettings
  look: LookSettings
  /** Index 0 = top of the stack (drawn last when depths are equal). */
  layers: Layer[]
  assets: AssetMeta[]
  audio: AudioTrack | null
}
