import type { AssetMeta, Composition, Layer, LayerMotion, LookSettings, Project, Shot, Vec3, EaseName } from '@shared/types'
import { addKeyframe } from '../animation/keyframes'
import { referenceDistance } from '../animation/math'
import { buildCameraPath, type PathStep, type TransitionType } from '../animation/cameraPath'
import { PARTICLE_PRESETS, type ParticlePreset } from '../animation/presets'
import { assetStore } from './assets'
import {
  createImageLayer,
  createParticleLayer,
  createProject,
  createShot,
  createSolidLayer,
  createTextLayer,
  migrateProject,
  shotSpacing
} from './factory'
import { PLATE_GENERATORS } from './plateGenerators'
import { EFFECT_ASSETS } from './effectAssets'

// ============================================================================
// BASE64 UTILITIES
// ============================================================================

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function parseDataUrl(url: string): { mime: string; data: Uint8Array } {
  const m = url.match(/^data:([^;,]+)(;base64)?,(.*)$/)
  if (!m) throw new Error('Invalid data URL: must start with data:<mime>;base64,...')
  const mime = m[1]
  const isBase64 = m[2] === ';base64'
  const raw = m[3]
  const data = isBase64 ? base64ToUint8Array(raw) : new TextEncoder().encode(decodeURIComponent(raw))
  return { mime, data }
}

// ============================================================================
// DECLARATIVE SCENE SPEC TYPES (Human-friendly JSON)
// ============================================================================

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
  src?: string // data:image/... or url or effect:mist
  assetName?: string
  z?: number
  position?: Vec3
  rotation?: Vec3
  scale?: Vec3
  opacity?: number
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

  // Procedural / Looping motion (drift, wind sway, float, pulse)
  motion?: LayerMotion

  // Keyframes
  keyframes?: {
    opacity?: DeclarativeKeyframe<number>[]
    position?: DeclarativeKeyframe<Vec3>[]
    rotation?: DeclarativeKeyframe<Vec3>[]
    scale?: DeclarativeKeyframe<Vec3>[]
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
  assets?: (AssetMeta & { dataUrl?: string })[]
}

// ============================================================================
// EXPORT TO JSON
// ============================================================================

/**
 * Exports a full Parallax Studio project to a 100% self-contained, portable JSON string.
 * All image and audio binaries in `assetStore` are encoded as base64 data URLs.
 */
export async function exportProjectToJson(project: Project, pretty = true): Promise<string> {
  const assetsWithData = await Promise.all(
    project.assets.map(async (a) => {
      const bytes = await assetStore.getBytes(a.id)
      const dataUrl = bytes ? `data:${a.mime};base64,${uint8ArrayToBase64(bytes)}` : undefined
      return { ...a, ...(dataUrl ? { dataUrl } : {}) }
    })
  )

  const serializable = {
    ...project,
    assets: assetsWithData
  }

  return JSON.stringify(serializable, null, pretty ? 2 : undefined)
}

/**
 * Exports a single shot and its associated layers to JSON.
 */
export async function exportShotToJson(project: Project, shotId: string, pretty = true): Promise<string> {
  const shot = project.shots.find((s) => s.id === shotId)
  if (!shot) throw new Error(`Shot with ID "${shotId}" not found`)

  const layers = project.layers.filter((l) => l.shotId === shotId)
  const usedAssetIds = new Set<string>()
  for (const l of layers) {
    if (l.type === 'image') usedAssetIds.add(l.props.assetId)
  }

  const assetsWithData = await Promise.all(
    project.assets
      .filter((a) => usedAssetIds.has(a.id))
      .map(async (a) => {
        const bytes = await assetStore.getBytes(a.id)
        const dataUrl = bytes ? `data:${a.mime};base64,${uint8ArrayToBase64(bytes)}` : undefined
        return { ...a, ...(dataUrl ? { dataUrl } : {}) }
      })
  )

  const payload = {
    type: 'parallax-shot',
    version: 2,
    shot,
    layers,
    assets: assetsWithData
  }

  return JSON.stringify(payload, null, pretty ? 2 : undefined)
}

// ============================================================================
// IMPORT FROM JSON
// ============================================================================

/**
 * Universal JSON Importer:
 * Can parse BOTH:
 * 1. Full Parallax Studio Project JSON (with embedded base64 dataUrl assets).
 * 2. High-level Declarative Scene Specification JSON (human-readable, easy to edit).
 */
export async function importProjectFromJson(jsonString: string): Promise<Project> {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch (err) {
    throw new Error(`Invalid JSON: ${String(err)}`)
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('JSON root must be an object')
  }

  const spec = parsed as DeclarativeProjectSpec

  // Case 1: Full raw Project v2 format
  if (spec.version === 2 && Array.isArray(spec.layers) && Array.isArray(spec.shots) && spec.comp && !spec.shots[0]?.layers) {
    assetStore.clear()
    if (Array.isArray(spec.assets)) {
      for (const a of spec.assets) {
        if (a.dataUrl) {
          const { mime, data } = parseDataUrl(a.dataUrl)
          await assetStore.add(a.name, mime, data, a.kind, a)
        }
      }
    }
    return migrateProject(spec as unknown as Project)
  }

  // Case 2: Declarative Project / Scene Specification
  return buildProjectFromDeclarativeSpec(spec)
}

/**
 * Imports a shot definition from JSON and attaches it to an existing project.
 */
export async function importShotFromJson(
  jsonString: string,
  targetProject: Project
): Promise<{ shot: Shot; layers: Layer[] }> {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch (err) {
    throw new Error(`Invalid JSON: ${String(err)}`)
  }

  const payload = parsed as { shot?: Shot; layers?: Layer[]; assets?: (AssetMeta & { dataUrl?: string })[] }
  if (payload.shot && Array.isArray(payload.layers)) {
    if (Array.isArray(payload.assets)) {
      for (const a of payload.assets) {
        if (a.dataUrl) {
          const { mime, data } = parseDataUrl(a.dataUrl)
          await assetStore.add(a.name, mime, data, a.kind, a)
          if (!targetProject.assets.some((ex) => ex.id === a.id)) {
            targetProject.assets.push(a)
          }
        }
      }
    }
    const shot = payload.shot
    targetProject.shots.push(shot)
    for (const l of payload.layers) {
      l.shotId = shot.id
      targetProject.layers.push(l)
    }
    return { shot, layers: payload.layers }
  }

  // If passed as a DeclarativeShotSpec
  const shotSpec = parsed as DeclarativeShotSpec
  if (shotSpec.name) {
    const shotIndex = targetProject.shots.length
    const spacing = shotSpacing(targetProject.comp)
    const shot = createShot(shotSpec.name, shotSpec.position ?? [shotIndex * spacing, 0, 0], shotIndex)
    targetProject.shots.push(shot)

    const layers = await buildLayersForShot(shotSpec, shot, targetProject)
    targetProject.layers.push(...layers)
    return { shot, layers }
  }

  throw new Error('JSON does not contain a recognized shot definition')
}

// ============================================================================
// DECLARATIVE SPEC COMPILER
// ============================================================================

async function buildProjectFromDeclarativeSpec(spec: DeclarativeProjectSpec): Promise<Project> {
  assetStore.clear()

  const project = createProject({
    name: spec.name ?? 'Parallax Journey',
    ...spec.comp
  })
  const comp = project.comp
  const spacing = shotSpacing(comp)
  const d = referenceDistance(comp)

  if (spec.look) {
    project.look = { ...project.look, ...spec.look }
  }

  if (spec.camera) {
    if (spec.camera.fov !== undefined) project.camera.fov.value = spec.camera.fov
    if (spec.camera.shakeAmount !== undefined) project.camera.shakeAmount = spec.camera.shakeAmount
    if (spec.camera.shakeSpeed !== undefined) project.camera.shakeSpeed = spec.camera.shakeSpeed
    if (spec.camera.dofEnabled !== undefined) project.camera.dofEnabled = spec.camera.dofEnabled
  }

  // Pre-load any explicitly provided dataUrl assets
  if (Array.isArray(spec.assets)) {
    for (const a of spec.assets) {
      if (a.dataUrl) {
        const { mime, data } = parseDataUrl(a.dataUrl)
        await assetStore.add(a.name, mime, data, a.kind, a)
        project.assets.push(a)
      }
    }
  }

  const shotSpecs = spec.shots ?? []
  for (let i = 0; i < shotSpecs.length; i++) {
    const sSpec = shotSpecs[i]
    const pos = sSpec.position ?? [i * spacing, 0, 0]
    const shot = createShot(sSpec.name, pos, i)
    project.shots.push(shot)

    const layers = await buildLayersForShot(sSpec, shot, project)
    project.layers.push(...layers)
  }

  // Build camera tour if specified
  if (spec.camera?.tour && spec.camera.tour.length > 0) {
    const steps: PathStep[] = []
    for (const step of spec.camera.tour) {
      const shot = project.shots.find((s) => s.name === step.shot)
      if (!shot) continue
      steps.push({
        shotId: shot.id,
        hold: step.hold ?? 3.0,
        type: step.type ?? 'arc',
        transition: step.transition ?? 2.5
      })
    }

    if (steps.length > 0) {
      const end = buildCameraPath(project, steps, { pushIn: 0.14 })
      project.comp.duration = Math.round(end * comp.fps) / comp.fps
      for (const l of project.layers) l.outPoint = project.comp.duration
    }
  }

  return structuredClone(project)
}

async function buildLayersForShot(
  sSpec: DeclarativeShotSpec,
  shot: Shot,
  project: Project
): Promise<Layer[]> {
  const comp = project.comp
  const d = referenceDistance(comp)
  const shotLayers: Layer[] = []

  // 1. Process plates & custom layers
  if (Array.isArray(sSpec.layers)) {
    for (const lSpec of sSpec.layers) {
      const layer = await buildSingleLayer(lSpec, comp, project)
      layer.shotId = shot.id
      shotLayers.unshift(layer)
    }
  }

  // 2. Process optional shot title
  if (sSpec.title) {
    const t = sSpec.title
    const arrive = t.arrive ?? sSpec.arrive ?? 0.6

    const title = createTextLayer(comp, t.text)
    title.name = `${sSpec.name} · Title`
    title.shotId = shot.id
    title.props = {
      ...title.props,
      fontFamily: t.fontFamily ?? 'Montserrat',
      fontWeight: t.fontWeight ?? 800,
      fontSize: t.fontSize ?? 88,
      letterSpacing: t.letterSpacing ?? 10,
      ...(t.color ? { color: t.color } : {})
    }
    const tPos = t.position ?? [0, 210, 700]
    title.transform.position.value = tPos
    addKeyframe(title.transform.opacity, arrive, 0, 'easeOut')
    addKeyframe(title.transform.opacity, arrive + 1.8, 1, 'easeOut')
    addKeyframe(title.transform.position, arrive, [tPos[0], tPos[1] - 50, tPos[2]] as Vec3, 'easeOut')
    addKeyframe(title.transform.position, arrive + 2.4, tPos, 'easeOut')
    shotLayers.unshift(title)

    if (t.subtitle) {
      const subPos = t.subtitlePosition ?? [0, 125, 700]
      const subtitle = createTextLayer(comp, t.subtitle)
      subtitle.name = `${sSpec.name} · Subtitle`
      subtitle.shotId = shot.id
      subtitle.props = {
        ...subtitle.props,
        fontFamily: 'Playfair Display',
        fontWeight: 400,
        fontSize: 42,
        letterSpacing: 5,
        color: t.subtitleColor ?? '#ffe57f'
      }
      subtitle.transform.position.value = subPos
      addKeyframe(subtitle.transform.opacity, arrive + 1.2, 0, 'easeOut')
      addKeyframe(subtitle.transform.opacity, arrive + 2.8, 0.9, 'easeOut')
      shotLayers.unshift(subtitle)
    }
  }

  // 3. Process optional particles
  if (sSpec.particles) {
    const pt = sSpec.particles
    const presetProps = pt.preset && PARTICLE_PRESETS[pt.preset] ? PARTICLE_PRESETS[pt.preset].props : {}
    const particles = createParticleLayer(comp)
    particles.name = pt.name ?? (pt.preset && PARTICLE_PRESETS[pt.preset] ? PARTICLE_PRESETS[pt.preset].label : 'Particles')
    particles.shotId = shot.id
    particles.props = {
      ...particles.props,
      ...presetProps,
      seed: pt.seed ?? particles.props.seed,
      count: pt.count ?? presetProps.count ?? 250,
      size: pt.size ?? presetProps.size ?? 6,
      color: pt.color ?? presetProps.color ?? '#fff9c4',
      area: [comp.width * 2.4, comp.height * 1.6, d * 1.8],
      velocity: pt.velocity ?? presetProps.velocity ?? [16, 10, 0],
      sway: pt.sway ?? presetProps.sway ?? 36,
      twinkle: pt.twinkle ?? presetProps.twinkle ?? particles.props.twinkle,
      glow: pt.glow ?? presetProps.glow ?? particles.props.glow
    }
    particles.transform.position.value = pt.position ?? [0, -150, 500]
    shotLayers.unshift(particles)
  }

  return shotLayers
}

async function buildSingleLayer(
  lSpec: DeclarativeLayerSpec,
  comp: Composition,
  project: Project
): Promise<Layer> {
  const z = lSpec.z ?? (lSpec.position ? lSpec.position[2] : 0)

  // 0. Realistic effect image layer (mist, rain, twilight mist)
  const effectKey = lSpec.effect ?? (lSpec.src?.startsWith('effect:') ? lSpec.src.slice(7) : undefined)
  if (effectKey) {
    const assetUrl =
      effectKey === 'mist' || effectKey === 'fog'
        ? EFFECT_ASSETS.mist
        : effectKey === 'rain'
          ? EFFECT_ASSETS.rain
          : effectKey === 'twilight_mist' || effectKey === 'twilightMist'
            ? EFFECT_ASSETS.twilightMist
            : undefined

    if (assetUrl) {
      const { mime, data } = parseDataUrl(assetUrl)
      const asset = await assetStore.add(`${lSpec.name}.webp`, mime, data, 'image')
      project.assets.push(asset.meta)
      const layer = createImageLayer(asset.meta, comp, z)
      layer.blendMode = lSpec.blendMode ?? 'screen'
      if (lSpec.opacity === undefined) layer.transform.opacity.value = effectKey === 'rain' ? 0.75 : 0.6
      if (!lSpec.scale) {
        layer.transform.scale.value = effectKey === 'rain' ? [2.0, 1.3, 1] : [2.2, 1.35, 1]
      }
      applyCommonLayerProps(layer, lSpec, comp)
      return layer
    }
  }

  // 1. Procedural generator plate (or image with generator)
  if (lSpec.generator || lSpec.type === 'generator') {
    const genKey = lSpec.generator ?? lSpec.name.toLowerCase().replace(/\s+/g, '_')
    const genFn = PLATE_GENERATORS[genKey]
    if (!genFn) {
      throw new Error(`Unknown generator plate "${genKey}". Available: ${Object.keys(PLATE_GENERATORS).join(', ')}`)
    }
    const canvas = genFn()
    const asset = await assetStore.addCanvas(`${lSpec.name}.png`, canvas)
    project.assets.push(asset.meta)
    const layer = createImageLayer(asset.meta, comp, z)
    applyCommonLayerProps(layer, lSpec, comp)
    return layer
  }

  // 2. Image layer from src (dataUrl or existing asset)
  if (lSpec.type === 'image' || lSpec.src) {
    let assetMeta: AssetMeta | undefined
    if (lSpec.src?.startsWith('data:')) {
      const { mime, data } = parseDataUrl(lSpec.src)
      const asset = await assetStore.add(lSpec.name || 'image.png', mime, data, 'image')
      assetMeta = asset.meta
      project.assets.push(assetMeta)
    } else if (lSpec.assetName) {
      assetMeta = project.assets.find((a) => a.name === lSpec.assetName)
    }

    if (!assetMeta) {
      // Fallback empty solid if asset couldn't be loaded
      const solid = createSolidLayer(comp)
      solid.props.color = '#444444'
      solid.props.gradient = false
      applyCommonLayerProps(solid, lSpec, comp)
      return solid
    }

    const layer = createImageLayer(assetMeta, comp, z)
    applyCommonLayerProps(layer, lSpec, comp)
    return layer
  }

  // 3. Text layer
  if (lSpec.type === 'text') {
    const layer = createTextLayer(comp, lSpec.text ?? lSpec.name)
    layer.name = lSpec.name
    layer.props = {
      ...layer.props,
      fontFamily: lSpec.fontFamily ?? layer.props.fontFamily,
      fontSize: lSpec.fontSize ?? layer.props.fontSize,
      fontWeight: lSpec.fontWeight ?? layer.props.fontWeight,
      letterSpacing: lSpec.letterSpacing ?? layer.props.letterSpacing,
      color: lSpec.color ?? layer.props.color,
      shadow: lSpec.shadow ?? layer.props.shadow
    }
    applyCommonLayerProps(layer, lSpec, comp)
    return layer
  }

  // 4. Ground plane / Floor (3D solid tilted horizontally)
  if (lSpec.type === 'ground') {
    const layer = createSolidLayer(comp)
    layer.name = lSpec.name
    layer.props.color = lSpec.color ?? '#4caf50'
    layer.props.gradient = false
    layer.props.width = lSpec.width ?? 3200
    layer.props.height = lSpec.height ?? 3200
    layer.transform.rotation.value = lSpec.rotation ?? [-90, 0, 0]
    layer.autoScale = false
    applyCommonLayerProps(layer, lSpec, comp)
    return layer
  }

  // 5. Solid layer
  if (lSpec.type === 'solid') {
    const layer = createSolidLayer(comp)
    layer.name = lSpec.name
    layer.props.color = lSpec.color ?? '#333333'
    layer.props.gradient = false
    if (lSpec.width) layer.props.width = lSpec.width
    if (lSpec.height) layer.props.height = lSpec.height
    applyCommonLayerProps(layer, lSpec, comp)
    return layer
  }

  // 6. Particle layer
  if (lSpec.type === 'particles') {
    const layer = createParticleLayer(comp)
    layer.name = lSpec.name
    const p = lSpec.particles ?? {}
    layer.props = {
      ...layer.props,
      seed: p.seed ?? 101,
      count: p.count ?? 200,
      size: p.size ?? 6,
      color: p.color ?? '#ffffff',
      velocity: p.velocity ?? [0, -20, 0],
      sway: p.sway ?? 20,
      area: p.area ?? layer.props.area
    }
    applyCommonLayerProps(layer, lSpec, comp)
    return layer
  }

  // Default to solid
  const layer = createSolidLayer(comp)
  layer.props.color = lSpec.color ?? '#555555'
  layer.props.gradient = false
  applyCommonLayerProps(layer, lSpec, comp)
  return layer
}

function applyCommonLayerProps(layer: Layer, spec: DeclarativeLayerSpec, comp: Composition): void {
  layer.name = spec.name
  if (spec.position) layer.transform.position.value = spec.position
  else if (spec.z !== undefined) layer.transform.position.value[2] = spec.z

  if (spec.rotation) layer.transform.rotation.value = spec.rotation
  if (spec.scale) layer.transform.scale.value = spec.scale
  else if (layer.type === 'image') layer.transform.scale.value = [comp.width / 1920, comp.width / 1920, 1]

  if (spec.opacity !== undefined) layer.transform.opacity.value = spec.opacity
  if (spec.visible !== undefined) layer.visible = spec.visible
  if (spec.locked !== undefined) layer.locked = spec.locked
  if (spec.blendMode) layer.blendMode = spec.blendMode
  if (spec.autoScale !== undefined) layer.autoScale = spec.autoScale
  if (spec.inPoint !== undefined) layer.inPoint = spec.inPoint
  if (spec.outPoint !== undefined) layer.outPoint = spec.outPoint

  if (spec.motion) {
    layer.motion = { ...spec.motion }
  }

  // Apply keyframes if provided
  if (spec.keyframes) {
    if (spec.keyframes.opacity) {
      for (const kf of spec.keyframes.opacity) {
        addKeyframe(layer.transform.opacity, kf.t, kf.value, kf.ease ?? 'easeOut')
      }
    }
    if (spec.keyframes.position) {
      for (const kf of spec.keyframes.position) {
        addKeyframe(layer.transform.position, kf.t, kf.value, kf.ease ?? 'easeOut')
      }
    }
    if (spec.keyframes.rotation) {
      for (const kf of spec.keyframes.rotation) {
        addKeyframe(layer.transform.rotation, kf.t, kf.value, kf.ease ?? 'easeOut')
      }
    }
    if (spec.keyframes.scale) {
      for (const kf of spec.keyframes.scale) {
        addKeyframe(layer.transform.scale, kf.t, kf.value, kf.ease ?? 'easeOut')
      }
    }
  }
}
