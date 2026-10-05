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
  Shot,
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
    shakeSpeed: 0.6,
    fade: anim(0)
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
    version: 2,
    comp: c,
    camera: defaultCamera(c),
    look: defaultLook(),
    shots: [],
    layers: [],
    assets: [],
    audio: null
  }
}

export const SHOT_COLORS = ['#8b7bff', '#3dd6f5', '#f59e6b', '#4ade80', '#f472b6', '#ffc24b', '#60a5fa', '#c084fc']

export function createShot(name: string, position: Vec3 = [0, 0, 0], index = 0): Shot {
  return {
    id: nanoid(10),
    name,
    color: SHOT_COLORS[index % SHOT_COLORS.length],
    visible: true,
    position: anim<Vec3>(position),
    rotation: anim<Vec3>([0, 0, 0])
  }
}

/** Horizontal spacing between auto-placed shots: wide enough that far plates of neighbours never overlap. */
export function shotSpacing(comp: Composition): number {
  return Math.round(comp.width * 5.5)
}

/** Upgrade any older project JSON to the current schema (mutates and returns it). */
export function migrateProject(raw: unknown): Project {
  const p = raw as Project & { version: number }
  if (typeof p !== 'object' || !p || !Array.isArray(p.layers)) throw new Error('Not a Parallax Studio project')
  if (p.version > 2) throw new Error(`Project version ${p.version} is newer than this app supports`)
  if (p.version < 2) {
    p.shots = []
    for (const l of p.layers) (l as Layer).shotId = null
    p.version = 2
  }
  p.shots ??= []
  if (!p.camera.fade) p.camera.fade = anim(0)
  for (const l of p.layers) if ((l as Layer).shotId === undefined) (l as Layer).shotId = null
  return p as Project
}

function transform(z = 0, scale = 1): Transform {
  return {
    position: anim<Vec3>([0, 0, z]),
    rotation: anim<Vec3>([0, 0, 0]),
    scale: anim<Vec3>([scale, scale, 1]),
    opacity: anim(1),
    anchor: anim<Vec3>([0, 0, 0])
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
    fadeIn: 0,
    fadeOut: 0,
    blendMode: 'normal' as const,
    autoScale: true,
    autoOrient: 'none' as const,
    parentId: null as string | null,
    shotId: null as string | null,
    transform: transform(z, scale)
  }
}

export function createImageLayer(asset: AssetMeta, comp: Composition, z = 0): ImageLayer {
  const w = asset.width ?? comp.width
  const h = asset.height ?? comp.height
  return {
    ...base(comp, asset.name.replace(/\.[^.]+$/, ''), z, 1),
    autoScale: true,
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

export function createGroundLayer(comp: Composition, name = 'Mặt đất 3D'): SolidLayer {
  const d = referenceDistance(comp)
  const l = base(comp, name, Math.round(d * 0.9))
  l.autoScale = false
  l.transform.position.value = [0, -Math.round(comp.height * 0.42), Math.round(d * 0.9)]
  l.transform.rotation.value = [-90, 0, 0]
  return {
    ...l,
    type: 'solid',
    props: {
      color: '#141824',
      color2: '#28344e',
      gradient: true,
      pattern: 'grid',
      gridSize: 45,
      width: Math.round(comp.width * 2.5),
      height: Math.round(d * 3.5)
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
