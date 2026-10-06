import type { Animatable, Layer, Project, Vec3 } from '@shared/types'
import type { Draft } from 'immer'
import { evaluate } from '../../animation/keyframes'
import { moveLayer } from '../../actions'
import { splitSelectedLayer } from '../../ui/timeline/timelineActions'
import { applyFxPresetToSelectedLayer, type FxPresetId } from '../../ui/timeline/timelineEffects'
import { assetStore } from '../../project/assets'
import * as factory from '../../project/factory'
import { ParamError, ed, proj, type Handler, type Params } from '../types'
import { blendOf, bool, has, num, requireLayer, round, scale3, setAnim, shotIdParam, str, toPlain, vec3 } from '../params'
import { layerSummary } from '../summaries'

function insertTop(d: Draft<Project>, layer: Layer): void {
  const i = d.layers.findIndex((l) => l.shotId === layer.shotId)
  if (i < 0) d.layers.unshift(layer as Draft<Layer>)
  else d.layers.splice(i, 0, layer as Draft<Layer>)
}

function insertBottom(d: Draft<Project>, layer: Layer): void {
  let last = -1
  d.layers.forEach((l, i) => {
    if (l.shotId === layer.shotId) last = i
  })
  if (last < 0) d.layers.push(layer as Draft<Layer>)
  else d.layers.splice(last + 1, 0, layer as Draft<Layer>)
}

/** Static properties for a freshly created layer (no keyframes yet). */
function applyNewLayerOptions(layer: Layer, p: Params): void {
  const name = str(p, 'name')
  if (name) layer.name = name
  const pos = vec3(p, 'position')
  if (pos) layer.transform.position.value = pos
  const z = num(p, 'z')
  if (z !== undefined) layer.transform.position.value = [layer.transform.position.value[0], layer.transform.position.value[1], z]
  const rot = vec3(p, 'rotation')
  if (rot) layer.transform.rotation.value = rot
  const ori = str(p, 'orientation')
  if (ori === 'ground') {
    layer.transform.rotation.value = [-90, 0, 0]
    layer.autoScale = false
  } else if (ori === 'tilted') {
    layer.transform.rotation.value = [-75, 0, 0]
    layer.autoScale = false
  } else if (ori === 'ceiling') {
    layer.transform.rotation.value = [90, 0, 0]
    layer.autoScale = false
  } else if (ori === 'vertical') {
    layer.transform.rotation.value = [0, 0, 0]
  }
  const sc = scale3(p, 'scale')
  if (sc) layer.transform.scale.value = sc
  const op = num(p, 'opacity')
  if (op !== undefined) layer.transform.opacity.value = Math.max(0, Math.min(1, op))
  const blend = blendOf(p)
  if (blend) layer.blendMode = blend
  const vis = bool(p, 'visible')
  if (vis !== undefined) layer.visible = vis
  const auto = bool(p, 'auto_scale')
  if (auto !== undefined) layer.autoScale = auto
  const ip = num(p, 'in_point')
  if (ip !== undefined) layer.inPoint = Math.max(0, ip)
  const outp = num(p, 'out_point')
  if (outp !== undefined) layer.outPoint = outp
}

function mergeProps(layer: Layer, p: Params, map: Record<string, string>): void {
  const props = layer.props as unknown as Record<string, unknown>
  for (const [param, prop] of Object.entries(map)) if (has(p, param)) props[prop] = structuredClone(p[param])
  if (p.props && typeof p.props === 'object') Object.assign(props, structuredClone(p.props))
}

const TEXT_MAP = {
  text: 'text',
  font_family: 'fontFamily',
  font_size: 'fontSize',
  font_weight: 'fontWeight',
  color: 'color',
  letter_spacing: 'letterSpacing',
  shadow: 'shadow'
}
const SOLID_MAP = {
  color: 'color',
  color2: 'color2',
  gradient: 'gradient',
  width: 'width',
  height: 'height',
  pattern: 'pattern',
  grid_size: 'gridSize'
}
const PARTICLE_MAP = {
  count: 'count',
  seed: 'seed',
  size: 'size',
  color: 'color',
  area: 'area',
  velocity: 'velocity',
  sway: 'sway',
  twinkle: 'twinkle',
  glow: 'glow'
}

function addLayer(layer: Layer, p: Params, bottom = false) {
  layer.shotId = shotIdParam(p)
  applyNewLayerOptions(layer, p)
  ed().update((d) => (bottom ? insertBottom(d, layer) : insertTop(d, layer)))
  ed().selectLayer(layer.id)
  return layerSummary(layer, ed().time)
}

function decodeBase64(s: string): Uint8Array {
  const b64 = s.includes(',') && s.startsWith('data:') ? s.slice(s.indexOf(',') + 1) : s
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function mimeFromBase64(s: string, name: string): string {
  const m = /^data:([^;,]+)/.exec(s)
  if (m) return m[1]
  const ext = name.split('.').pop()?.toLowerCase()
  return ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/png'
}

export const layerCommands: Record<string, Handler> = {
  get_layer_info: (p) => {
    const project = proj()
    const l = requireLayer(project, str(p, 'layer_id', true))
    const asset = l.type === 'image' ? project.assets.find((a) => a.id === l.props.assetId) : undefined
    return { layer: toPlain(l), asset: asset ?? null }
  },

  add_image_layer: async (p, cmd) => {
    let file = cmd.file
    if (!file) {
      const b64 = str(p, 'image_base64')
      if (!b64) throw new ParamError('Provide "file_path" (absolute path) or "image_base64"')
      const name = str(p, 'file_name') ?? str(p, 'name') ?? 'image.png'
      file = { name, path: '', mime: mimeFromBase64(b64, name), data: decodeBase64(b64) }
    }
    if (!file.mime.startsWith('image/')) throw new ParamError(`Not an image: ${file.name}`)
    const asset = await assetStore.add(file.name, file.mime, file.data, 'image')
    const origPath = typeof p.file_path === 'string' ? p.file_path : file.path
    if (origPath) {
      const norm = origPath.replace(/\\/g, '/')
      const idx = norm.toLowerCase().lastIndexOf('/assets/')
      if (idx >= 0) {
        const rel = norm.slice(idx + '/assets/'.length)
        asset.meta.assetPath = rel
        asset.meta.path = `assets/${rel}`
      } else if (norm.toLowerCase().startsWith('assets/')) {
        const rel = norm.slice('assets/'.length)
        asset.meta.assetPath = rel
        asset.meta.path = `assets/${rel}`
      }
    }
    const comp = proj().comp
    const layer = factory.createImageLayer(asset.meta, comp, 0)
    const w = asset.meta.width ?? comp.width
    const h = asset.meta.height ?? comp.height
    const fit = str(p, 'fit')
    if (fit) {
      const s = fit === 'cover' ? Math.max(comp.width / w, comp.height / h) : fit === 'contain' ? Math.min(comp.width / w, comp.height / h) : fit === 'native' ? 1 : NaN
      if (Number.isNaN(s)) throw new ParamError('"fit" must be cover, contain or native')
      layer.transform.scale.value = [round(s, 4), round(s, 4), 1]
    }
    if (Array.isArray(p.repeat) && p.repeat.length === 2) {
      layer.props.repeat = [Number(p.repeat[0]) || 1, Number(p.repeat[1]) || 1]
    }
    ed().update((d) => void d.assets.push(asset.meta))
    return { ...addLayer(layer, p), asset: asset.meta }
  },

  add_text_layer: (p) => {
    const layer = factory.createTextLayer(proj().comp, str(p, 'text') ?? 'Tiêu đề')
    mergeProps(layer, p, TEXT_MAP)
    if (!has(p, 'name')) layer.name = `Text: ${layer.props.text}`
    return addLayer(layer, p)
  },

  add_solid_layer: (p) => {
    const layer = factory.createSolidLayer(proj().comp)
    mergeProps(layer, p, SOLID_MAP)
    return addLayer(layer, p, true)
  },

  add_ground_layer: (p) => {
    const layer = factory.createGroundLayer(proj().comp)
    mergeProps(layer, p, SOLID_MAP)
    return addLayer(layer, p, true)
  },

  add_particles: (p) => {
    const layer = factory.createParticleLayer(proj().comp)
    mergeProps(layer, p, PARTICLE_MAP)
    return addLayer(layer, p)
  },

  update_layer: (p) => {
    const project = proj()
    const id = requireLayer(project, str(p, 'layer_id', true)).id
    const newShot = 'shot_id' in p ? shotIdParam(p) : undefined
    ed().update((d) => {
      const i = d.layers.findIndex((l) => l.id === id)
      const l = d.layers[i]
      if (has(p, 'name')) l.name = str(p, 'name')!
      if (has(p, 'visible')) l.visible = bool(p, 'visible')!
      if (has(p, 'locked')) l.locked = bool(p, 'locked')!
      if (has(p, 'auto_scale')) l.autoScale = bool(p, 'auto_scale')!
      if (has(p, 'in_point')) l.inPoint = Math.max(0, num(p, 'in_point')!)
      if (has(p, 'out_point')) l.outPoint = num(p, 'out_point')!
      const blend = blendOf(p)
      if (blend) l.blendMode = blend
      const map = l.type === 'text' ? TEXT_MAP : l.type === 'solid' ? SOLID_MAP : l.type === 'particles' ? PARTICLE_MAP : {}
      mergeProps(l as Layer, p, map)
      if (Array.isArray(p.repeat) && p.repeat.length === 2 && l.type === 'image') {
        l.props.repeat = [Number(p.repeat[0]) || 1, Number(p.repeat[1]) || 1]
      }
      const pos = vec3(p, 'position')
      if (pos) setAnim(l.transform.position, pos, p, project)
      const z = num(p, 'z')
      if (z !== undefined) {
        const cur = evaluate(l.transform.position as Animatable<Vec3>, num(p, 'at_time') ?? ed().time)
        setAnim(l.transform.position, [cur[0], cur[1], z], p, project)
      }
      const rot = vec3(p, 'rotation')
      if (rot) setAnim(l.transform.rotation, rot, p, project)
      const sc = scale3(p, 'scale')
      if (sc) setAnim(l.transform.scale, sc, p, project)
      const op = num(p, 'opacity')
      if (op !== undefined) setAnim(l.transform.opacity, Math.max(0, Math.min(1, op)), p, project)
      if (newShot !== undefined && newShot !== l.shotId) {
        d.layers.splice(i, 1)
        l.shotId = newShot
        insertTop(d, l as Layer)
      }
    })
    return layerSummary(requireLayer(proj(), id), ed().time)
  },

  delete_layer: (p) => {
    const id = requireLayer(proj(), str(p, 'layer_id', true)).id
    ed().update((d) => {
      d.layers = d.layers.filter((l) => l.id !== id)
    })
    if (ed().selectedLayerId === id) ed().selectLayer(null)
    return { deleted: id }
  },

  move_layer: (p) => {
    const id = requireLayer(proj(), str(p, 'layer_id', true)).id
    const dir = str(p, 'direction', true)
    if (dir !== 'up' && dir !== 'down') throw new ParamError('"direction" must be up or down')
    moveLayer(id, dir === 'up' ? -1 : 1)
    return { index: proj().layers.findIndex((l) => l.id === id) }
  },

  apply_layer_fx: (p) => {
    const layer = requireLayer(proj(), str(p, 'layer_id', true))
    const preset = str(p, 'preset', true) as FxPresetId
    const time = num(p, 'time') ?? ed().time
    const duration = num(p, 'duration')
    const blinks = num(p, 'blinks')
    const intensity = num(p, 'intensity')

    ed().selectLayer(layer.id)
    const ok = applyFxPresetToSelectedLayer(preset, {
      targetTime: time,
      duration,
      blinks,
      intensity
    })
    if (!ok) throw new ParamError(`Failed to apply FX preset "${preset}" to layer "${layer.name}"`)
    return layerSummary(requireLayer(proj(), layer.id), time)
  },

  split_layer: (p) => {
    const layer = requireLayer(proj(), str(p, 'layer_id', true))
    const time = num(p, 'time') ?? ed().time
    ed().selectLayer(layer.id)
    const ok = splitSelectedLayer(time)
    if (!ok) throw new ParamError(`Cannot split layer "${layer.name}" at ${time}s`)
    return { layer_id: layer.id, split_at: time }
  }
}
