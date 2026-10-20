import type { AppliedLayerEffect, AssetMeta, AutoOrientMode, Composition, EaseName, Layer, LayerMotion, LayerPhysicsConfig, LayerVirtualLightConfig, LookSettings, Vec3 } from '@shared/types'
import type { TransitionType } from '../../animation/cameraPath'
import type { ParticlePreset } from '../../animation/presets'
import type { AssetTable } from './assetTable'

export interface DeclarativeKeyframe<T = unknown> {
  t: number
  value: T
  ease?: EaseName
}

export interface DeclarativeLayerSpec {
  name: string
  type?: 'image' | 'text' | 'solid' | 'ground' | 'particles' | 'generator'
  effect?: 'mist' | 'fog' | 'rain' | 'twilight_mist' | 'twilightMist'
  generator?: string
  /** Resource path, data URL, or alias reference in assets table (e.g. '@hero_head' or 'hero_head') */
  asset?: string
  src?: string // data:image/... or url or effect:mist or @alias
  assetName?: string
  z?: number
  position?: Vec3
  rotation?: Vec3
  scale?: Vec3
  opacity?: number
  anchor?: Vec3
  autoOrient?: AutoOrientMode
  parentId?: string | null
  parentName?: string
  fadeIn?: number
  fadeOut?: number
  visible?: boolean
  locked?: boolean
  blendMode?: Layer['blendMode']
  autoScale?: boolean
  inPoint?: number
  outPoint?: number

  // Text props
  text?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  letterSpacing?: number
  color?: string
  shadow?: boolean

  // Solid / Ground props
  width?: number
  height?: number

  // Particle props
  particles?: {
    seed?: number
    count?: number
    size?: number
    color?: string
    velocity?: Vec3
    sway?: number
    area?: Vec3
  }

  // Procedural / Looping motion (drift, wind sway, float, pulse, wiggle)
  motion?: LayerMotion
  appliedEffects?: AppliedLayerEffect[]
  physics?: LayerPhysicsConfig
  virtualLight?: LayerVirtualLightConfig

  // GIF / Animated Image props
  speed?: number
  loopMode?: 'loop' | 'ping-pong' | 'once'
  timeOffset?: number
  autoPlayPaused?: boolean

  // Keyframes
  keyframes?: {
    opacity?: DeclarativeKeyframe<number>[]
    position?: DeclarativeKeyframe<Vec3>[]
    rotation?: DeclarativeKeyframe<Vec3>[]
    scale?: DeclarativeKeyframe<Vec3>[]
    anchor?: DeclarativeKeyframe<Vec3>[]
  }
}

export interface DeclarativeTitleSpec {
  text: string
  subtitle?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  letterSpacing?: number
  color?: string
  subtitleColor?: string
  arrive?: number
  position?: Vec3
  subtitlePosition?: Vec3
}

export interface DeclarativeParticleSpec {
  preset?: ParticlePreset
  name?: string
  seed?: number
  count?: number
  size?: number
  color?: string
  velocity?: Vec3
  sway?: number
  position?: Vec3
  twinkle?: boolean
  glow?: boolean
}

export interface DeclarativeShotSpec {
  name: string
  position?: Vec3
  duration?: number
  arrive?: number
  title?: DeclarativeTitleSpec
  particles?: DeclarativeParticleSpec
  layers?: DeclarativeLayerSpec[]
  /** Optional local asset dictionary for this shot */
  assets?: AssetTable
}

export interface DeclarativeCameraTourStep {
  shot: string
  hold?: number
  type?: TransitionType
  transition?: number
}

export interface DeclarativeProjectSpec {
  version?: number
  name?: string
  comp?: Partial<Composition>
  look?: Partial<LookSettings>
  camera?: {
    fov?: number
    shakeAmount?: number
    shakeSpeed?: number
    dofEnabled?: boolean
    tour?: DeclarativeCameraTourStep[]
  }
  shots?: DeclarativeShotSpec[]
  layers?: Layer[] // in case of raw layer array
  /** Assets can be either raw metadata array or human-friendly alias table dictionary */
  assets?: AssetTable | (AssetMeta & { dataUrl?: string })[]
  /** Explicit alias dictionary for easy lookup */
  assetTable?: AssetTable
  /** Optional node-port video production workflow graph */
  workflow?: import('@shared/types').WorkflowGraph
}


