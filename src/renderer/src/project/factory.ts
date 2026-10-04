import { nanoid } from 'nanoid'
import type {
  AssetMeta,
  CameraSettings,
  Composition,
  ImageLayer,
  Layer,
  LookSettings,
  ParticleLayer,
  Project,
  SolidLayer,
  TextLayer,
  Transform,
  Vec3
} from '@shared/types'
import { anim } from '../animation/keyframes'
import { REFERENCE_FOV, referenceDistance } from '../animation/math'

export const DEFAULT_COMP: Composition = {
  name: 'Main Comp',
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 10,
  background: '#05060a'
}

export function defaultCamera(comp: Composition): CameraSettings {
  const d = referenceDistance(comp)
  return {
    position: anim<Vec3>([0, 0, -d]),
    target: anim<Vec3>([0, 0, 0]),
    fov: anim(REFERENCE_FOV),
    dofEnabled: false,
    focusDistance: anim(Math.round(d)),
    aperture: anim(0.6),
    shakeAmount: 0,
    shakeSpeed: 0.6
  }
}

export function defaultLook(): LookSettings {
  return {
    fogEnabled: false,
    fogColor: '#2a2140',
    fogNear: 1500,
    fogFar: 6000,
    vignette: 0.35,
    grain: 0.04,
    exposure: 0,
    contrast: 1,
    saturation: 1
  }
}

export function createProject(comp: Partial<Composition> = {}): Project {
  const c = { ...DEFAULT_COMP, ...comp }
  return {
    version: 1,
    comp: c,
    camera: defaultCamera(c),
    look: defaultLook(),
    layers: [],
    assets: [],
    audio: null
  }
}

function transform(z = 0, scale = 1): Transform {
  return {
    position: anim<Vec3>([0, 0, z]),
    rotation: anim<Vec3>([0, 0, 0]),
    scale: anim<Vec3>([scale, scale, 1]),
    opacity: anim(1)
  }
}

function base(comp: Composition, name: string, z: number, scale = 1) {
  return {
    id: nanoid(10),
    name,
    visible: true,
    locked: false,
    inPoint: 0,
    outPoint: comp.duration,
    blendMode: 'normal' as const,
    autoScale: true,
    transform: transform(z, scale)
  }
}

export function createImageLayer(asset: AssetMeta, comp: Composition, z = 0): ImageLayer {
  const w = asset.width ?? comp.width
  const h = asset.height ?? comp.height
  // Fit-cover the composition by default so full-frame plates fill the frame.
  const cover = Math.max(comp.width / w, comp.height / h)
  const scale = w >= comp.width * 0.9 || h >= comp.height * 0.9 ? cover : 1
  return {
    ...base(comp, asset.name.replace(/\.[^.]+$/, ''), z, Number(scale.toFixed(4))),
    type: 'image',
    props: { assetId: asset.id, width: w, height: h }
  }
}

export function createTextLayer(comp: Composition, text = 'Tiêu đề'): TextLayer {
  return {
    ...base(comp, `Text: ${text}`, 0),
    type: 'text',
    props: {
      text,
      fontFamily: 'Montserrat',
      fontSize: 120,
      fontWeight: 700,
      color: '#ffffff',
      letterSpacing: 4,
      shadow: true
    }
  }
}

export function createSolidLayer(comp: Composition): SolidLayer {
  return {
    ...base(comp, 'Solid', 1000),
    type: 'solid',
    props: {
      color: '#1b1f3a',
      color2: '#c0607a',
      gradient: true,
      width: comp.width * 1.4,
      height: comp.height * 1.4
    }
  }
}

export function createParticleLayer(comp: Composition): ParticleLayer {
  const d = referenceDistance(comp)
  return {
    ...base(comp, 'Particles', 300),
    autoScale: false,
    type: 'particles',
    blendMode: 'add',
    props: {
      count: 400,
      seed: Math.floor(Math.random() * 100000),
      size: 6,
      color: '#ffd59a',
      area: [comp.width * 2.2, comp.height * 2.2, d * 1.6],
      velocity: [12, 18, 0],
      sway: 30,
      twinkle: true,
      glow: true
    }
  }
}

export function duplicateLayer(layer: Layer): Layer {
  const copy = structuredClone(layer)
  copy.id = nanoid(10)
  copy.name = `${layer.name} copy`
  const reId = <T>(a: { keyframes: { id: string }[] } & T): void => a.keyframes.forEach((k) => (k.id = nanoid(8)))
  reId(copy.transform.position)
  reId(copy.transform.rotation)
  reId(copy.transform.scale)
  reId(copy.transform.opacity)
  return copy
}
