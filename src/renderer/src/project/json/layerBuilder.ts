import type { AssetMeta, Composition, Layer, Project, Shot, Vec3 } from '@shared/types'
import { addKeyframe, anim } from '../../animation/keyframes'
import { referenceDistance } from '../../animation/math'
import { PARTICLE_PRESETS } from '../../animation/presets'
import { assetStore } from '../assets'
import {
  createImageLayer,
  createParticleLayer,
  createSolidLayer,
  createTextLayer
} from '../factory'
import { PLATE_GENERATORS } from '../plateGenerators'
import { EFFECT_ASSETS } from '../effectAssets'
import { parseDataUrl } from './base64'
import { loadAssetBytesFromDiskOrBuiltIn } from './assetLoader'
import type { DeclarativeLayerSpec, DeclarativeShotSpec } from './schema'

export async function buildLayersForShot(
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

    // Resolve parentName references within shot or project
    for (const lSpec of sSpec.layers) {
      if (lSpec.parentName) {
        const child = shotLayers.find((l) => l.name === lSpec.name)
        const parent = shotLayers.find((l) => l.name === lSpec.parentName) || project.layers.find((l) => l.name === lSpec.parentName)
        if (child && parent) {
          child.parentId = parent.id
        }
      }
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

export async function buildSingleLayer(
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
            : effectKey === 'magic_portal' || effectKey === 'magicPortal' || effectKey === 'portal'
              ? (EFFECT_ASSETS as any).magicPortal
              : undefined

    if (assetUrl) {
      const { mime, data } = parseDataUrl(assetUrl)
      const ext = mime === 'image/gif' ? 'gif' : 'webp'
      const asset = await assetStore.add(`${lSpec.name}.${ext}`, mime, data, 'image')
      project.assets.push(asset.meta)
      const layer = createImageLayer(asset.meta, comp, z)
      layer.blendMode = lSpec.blendMode ?? (ext === 'gif' ? 'normal' : 'screen')
      if (lSpec.opacity !== undefined) layer.transform.opacity.value = lSpec.opacity
      else if (ext !== 'gif') layer.transform.opacity.value = effectKey === 'rain' ? 0.75 : 0.6
      if (lSpec.scale) {
        layer.transform.scale.value = lSpec.scale
      } else if (ext !== 'gif') {
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

  // 2. Image layer from src (dataUrl or local path or existing asset)
  if (lSpec.type === 'image' || lSpec.src) {
    let assetMeta: AssetMeta | undefined
    if (lSpec.src?.startsWith('data:')) {
      const { mime, data } = parseDataUrl(lSpec.src)
      const asset = await assetStore.add(lSpec.name || 'image.png', mime, data, 'image')
      assetMeta = asset.meta
      project.assets.push(assetMeta)
    } else if (lSpec.assetName) {
      assetMeta = project.assets.find((a) => a.name === lSpec.assetName)
    } else if (lSpec.src || (lSpec as any).path) {
      const p = (lSpec.src || (lSpec as any).path || '').replace(/^assets\//, '')
      assetMeta = project.assets.find((a) => a.name === lSpec.name || a.assetPath === p || a.path === `assets/${p}`)
      if (!assetMeta) {
        const file = await loadAssetBytesFromDiskOrBuiltIn(p)
        if (file) {
          const asset = await assetStore.add(lSpec.name || file.name, file.mime, file.data, 'image')
          asset.meta.assetPath = p
          asset.meta.path = `assets/${p}`
          assetMeta = asset.meta
          project.assets.push(assetMeta)
        }
      }
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

export function applyCommonLayerProps(layer: Layer, spec: DeclarativeLayerSpec, comp: Composition): void {
  layer.name = spec.name
  if (spec.position) layer.transform.position.value = spec.position
  else if (spec.z !== undefined) layer.transform.position.value[2] = spec.z

  if (spec.rotation) layer.transform.rotation.value = spec.rotation
  if (spec.scale) layer.transform.scale.value = spec.scale
  else if (layer.type === 'image') layer.transform.scale.value = [comp.width / 1920, comp.width / 1920, 1]

  if (spec.anchor) layer.transform.anchor = anim<Vec3>(spec.anchor)
  if (spec.autoOrient) layer.autoOrient = spec.autoOrient
  if (spec.parentId !== undefined) layer.parentId = spec.parentId
  if (spec.fadeIn !== undefined) layer.fadeIn = spec.fadeIn
  if (spec.fadeOut !== undefined) layer.fadeOut = spec.fadeOut

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

  if (layer.type === 'image') {
    if (spec.speed !== undefined) layer.props.speed = spec.speed
    if (spec.loopMode !== undefined) layer.props.loopMode = spec.loopMode
    if (spec.timeOffset !== undefined) layer.props.timeOffset = spec.timeOffset
    if (spec.autoPlayPaused !== undefined) layer.props.autoPlayPaused = spec.autoPlayPaused
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
    if (spec.keyframes.anchor) {
      if (!layer.transform.anchor) {
        layer.transform.anchor = { value: [0, 0, 0], keyframes: [] }
      }
      for (const kf of spec.keyframes.anchor) {
        addKeyframe(layer.transform.anchor, kf.t, kf.value, kf.ease ?? 'easeOut')
      }
    }
  }
}
