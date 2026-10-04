import * as THREE from 'three'
import type { McpCommand } from '@shared/ipc'
import type { Animatable, AnimValue, BlendMode, EaseName, Layer, LookSettings, Project, Shot, Vec3 } from '@shared/types'
import type { Draft } from 'immer'
import { buildCameraPath, flyCameraToShot, shotAtTime, TRANSITIONS, type PathStep, type TransitionType } from '../animation/cameraPath'
import { addKeyframe, evaluate, isAnimated, removeKeyframe, setValueAt } from '../animation/keyframes'
import { referenceDistance } from '../animation/math'
import { applyCameraPreset, CAMERA_PRESETS, type CameraPreset } from '../animation/presets'
import { moveLayer, nextShotPosition, setCompDuration, SHOT_DIRECTIONS, type ShotDirection } from '../actions'
import { EditorCamera } from '../engine/EditorCamera'
import { evaluateCamera, evaluateScene, shotFramingPose, shotLocalToWorld } from '../engine/evaluateScene'
import { getLiveRenderer } from '../engine/liveRenderer'
import { SceneRenderer } from '../engine/SceneRenderer'
import { depthToThree } from '../engine/spatial'
import { isExporting, runExport } from '../export/runExport'
import { assetStore } from '../project/assets'
import * as factory from '../project/factory'
import { deserializeProject, serializeProject } from '../project/serialize'
import { frameTolerance, getDraftAnimatable, useEditor, type CameraProp, type LayerProp, type PropRef, type ShotProp } from '../store/editor'
import { useView } from '../store/view'

/**
 * Commands an external AI can run through the MCP bridge.
 *
 * Every mutation goes through `useEditor.update()`, so AI edits show up live in the UI
 * and can be undone with Ctrl+Z like any manual edit. Parameter names are snake_case
 * (MCP convention); coordinates use the project convention (x right, y up, z depth).
 */

type Params = Record<string, unknown>
type Handler = (p: Params, cmd: McpCommand) => unknown | Promise<unknown>

const ed = () => useEditor.getState()
const proj = (): Project => ed().project

// ------------------------------------------------------------------ param helpers

class ParamError extends Error {}

function has(p: Params, k: string): boolean {
  return p[k] !== undefined && p[k] !== null
}

function str(p: Params, k: string): string | undefined
function str(p: Params, k: string, required: true): string
function str(p: Params, k: string, required = false): string | undefined {
  const v = p[k]
  if (v === undefined || v === null) {
    if (required) throw new ParamError(`Missing parameter "${k}"`)
    return undefined
  }
  if (typeof v !== 'string') throw new ParamError(`"${k}" must be a string`)
  return v
}

function num(p: Params, k: string): number | undefined
function num(p: Params, k: string, required: true): number
function num(p: Params, k: string, required = false): number | undefined {
  const v = p[k]
  if (v === undefined || v === null) {
    if (required) throw new ParamError(`Missing parameter "${k}"`)
    return undefined
  }
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new ParamError(`"${k}" must be a number`)
  return n
}

function bool(p: Params, k: string): boolean | undefined {
  const v = p[k]
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'boolean') throw new ParamError(`"${k}" must be true/false`)
  return v
}

function vec3(p: Params, k: string): Vec3 | undefined {
  const v = p[k]
  if (v === undefined || v === null) return undefined
  if (!Array.isArray(v) || v.length !== 3 || v.some((x) => typeof x !== 'number' || !Number.isFinite(x)))
    throw new ParamError(`"${k}" must be [x, y, z]`)
  return [v[0], v[1], v[2]]
}

/** Scale accepts a number (uniform 2D scale) or [x, y, z]. */
function scale3(p: Params, k: string): Vec3 | undefined {
  const v = p[k]
  if (typeof v === 'number') return [v, v, 1]
  return vec3(p, k)
}

const EASES: EaseName[] = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'easeInOutStrong', 'hold']
function easeOf(p: Params, k = 'ease'): EaseName {
  const e = str(p, k) ?? 'easeInOut'
  if (!EASES.includes(e as EaseName)) throw new ParamError(`"${k}" must be one of ${EASES.join(', ')}`)
  return e as EaseName
}

const BLENDS: BlendMode[] = ['normal', 'add', 'screen', 'multiply']
function blendOf(p: Params): BlendMode | undefined {
  const b = str(p, 'blend_mode')
  if (b === undefined) return undefined
  if (!BLENDS.includes(b as BlendMode)) throw new ParamError(`"blend_mode" must be one of ${BLENDS.join(', ')}`)
  return b as BlendMode
}

function requireShot(project: Project, id: string | undefined): Shot {
  const s = project.shots.find((x) => x.id === id || (!!id && x.name === id))
  if (!s) throw new ParamError(`Shot "${id}" not found. Use get_project_info to list shots.`)
  return s
}

function requireLayer(project: Project, id: string | undefined): Layer {
  const l = project.layers.find((x) => x.id === id)
  if (!l) throw new ParamError(`Layer "${id}" not found. Use get_project_info to list layers.`)
  return l
}

/** shot_id param → owning shot id. Omitted = selected shot (or global when none); "global"/null = global. */
function shotIdParam(p: Params): string | null {
  if (!('shot_id' in p)) {
    const sel = ed().selectedShotId
    return sel && proj().shots.some((s) => s.id === sel) ? sel : null
  }
  const v = p.shot_id
  if (v === null || v === '' || v === 'global') return null
  return requireShot(proj(), String(v)).id
}

/**
 * Set an animatable property. With `at_time` → key at that time. Otherwise After-Effects
 * style: animated properties get a key at the current time, static ones change value.
 */
function setAnim<T extends AnimValue>(a: Draft<Animatable<T>>, value: T, p: Params, project: Project): void {
  const at = num(p, 'at_time')
  if (at !== undefined) addKeyframe(a as Animatable<T>, at, value, easeOf(p))
  else setValueAt(a as Animatable<T>, ed().time, value, frameTolerance(project))
}

function keyedProps<T extends object>(obj: T, keys: (keyof T)[]): string[] {
  return keys.filter((k) => isAnimated(obj[k] as unknown as Animatable<AnimValue>)).map(String)
}

function toPlain<T>(v: T): T {
  return v === undefined ? (null as T) : (JSON.parse(JSON.stringify(v)) as T)
}

const round = (v: number, d = 2): number => Math.round(v * 10 ** d) / 10 ** d
const r3 = (v: Vec3): Vec3 => [round(v[0]), round(v[1]), round(v[2])]

// ------------------------------------------------------------------ summaries

function layerSummary(l: Layer, t: number) {
  const tr = l.transform
  return {
    id: l.id,
    name: l.name,
    type: l.type,
    shot_id: l.shotId,
    visible: l.visible,
    locked: l.locked,
    in_point: l.inPoint,
    out_point: l.outPoint,
    blend_mode: l.blendMode,
    position: r3(evaluate(tr.position, t)),
    scale: r3(evaluate(tr.scale, t)),
    opacity: round(evaluate(tr.opacity, t), 3),
    animated: keyedProps(tr, ['position', 'rotation', 'scale', 'opacity']),
    ...(l.type === 'text' ? { text: l.props.text } : {}),
    ...(l.type === 'image' ? { asset_id: l.props.assetId, size: [l.props.width, l.props.height] } : {})
  }
}

function shotSummary(s: Shot, project: Project, t: number) {
  const pose = shotFramingPose(project, s, t)
  return {
    id: s.id,
    name: s.name,
    color: s.color,
    visible: s.visible,
    position: r3(evaluate(s.position, t)),
    rotation: r3(evaluate(s.rotation, t)),
    animated: keyedProps(s, ['position', 'rotation']),
    layer_count: project.layers.filter((l) => l.shotId === s.id).length,
    framing_camera: { position: r3(pose.position), target: r3(pose.target) }
  }
}

function cameraSummary(project: Project, t: number) {
  const c = project.camera
  const ev = evaluateCamera(project, t)
  return {
    at_time: t,
    position: r3(ev.position),
    target: r3(ev.target),
    fov: round(ev.fov),
    focus_distance: round(ev.focusDistance),
    aperture: round(ev.aperture, 3),
    fade: round(ev.fade, 3),
    dof_enabled: c.dofEnabled,
    shake_amount: c.shakeAmount,
    shake_speed: c.shakeSpeed,
    looking_at_shot: shotAtTime(project, t),
    keyframes: Object.fromEntries(
      (['position', 'target', 'fov', 'focusDistance', 'aperture', 'fade'] as CameraProp[]).map((k) => [
        k,
        c[k].keyframes.map((kf) => ({ t: round(kf.t, 3), value: kf.value, ease: kf.ease }))
      ])
    )
  }
}

// ------------------------------------------------------------------ layer helpers

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
const SOLID_MAP = { color: 'color', color2: 'color2', gradient: 'gradient', width: 'width', height: 'height' }
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

// ------------------------------------------------------------------ keyframe refs

const LAYER_PROPS: LayerProp[] = ['position', 'rotation', 'scale', 'opacity']
const CAMERA_PROPS: CameraProp[] = ['position', 'target', 'fov', 'focusDistance', 'aperture', 'fade']
const SHOT_PROPS: ShotProp[] = ['position', 'rotation']
const CAMERA_ALIASES: Record<string, CameraProp> = { focus_distance: 'focusDistance' }

function propRef(p: Params): PropRef {
  const target = str(p, 'target', true)
  const prop = str(p, 'property', true)
  if (target === 'camera') {
    const cp = (CAMERA_ALIASES[prop] ?? prop) as CameraProp
    if (!CAMERA_PROPS.includes(cp)) throw new ParamError(`camera property must be one of ${CAMERA_PROPS.join(', ')}`)
    return { kind: 'camera', prop: cp }
  }
  if (target === 'shot') {
    if (!SHOT_PROPS.includes(prop as ShotProp)) throw new ParamError(`shot property must be one of ${SHOT_PROPS.join(', ')}`)
    return { kind: 'shot', shotId: requireShot(proj(), str(p, 'id', true)).id, prop: prop as ShotProp }
  }
  if (target === 'layer') {
    if (!LAYER_PROPS.includes(prop as LayerProp)) throw new ParamError(`layer property must be one of ${LAYER_PROPS.join(', ')}`)
    return { kind: 'layer', layerId: requireLayer(proj(), str(p, 'id', true)).id, prop: prop as LayerProp }
  }
  throw new ParamError('"target" must be layer, camera or shot')
}

function isScalarProp(ref: PropRef): boolean {
  return (ref.kind === 'layer' && ref.prop === 'opacity') || (ref.kind === 'camera' && !['position', 'target'].includes(ref.prop))
}

function valueFor(ref: PropRef, p: Params): AnimValue {
  if (isScalarProp(ref)) return num(p, 'value', true)
  const v = ref.kind === 'layer' && ref.prop === 'scale' ? scale3(p, 'value') : vec3(p, 'value')
  if (!v) throw new ParamError('Missing parameter "value" ([x, y, z])')
  return v
}

// ------------------------------------------------------------------ screenshots

async function canvasToBase64(c: HTMLCanvasElement, mime: string, quality?: number): Promise<string> {
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, mime, quality))
  if (!blob) throw new Error('Could not encode screenshot')
  const buf = new Uint8Array(await blob.arrayBuffer())
  let s = ''
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(s)
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

async function screenshot(p: Params) {
  const project = proj()
  const t = num(p, 'time') ?? ed().time
  const view = str(p, 'view') === '3d' ? '3d' : 'camera'
  const w = Math.max(64, Math.min(3840, Math.round(num(p, 'width') ?? 960)))
  const h = Math.max(64, Math.round((w * project.comp.height) / project.comp.width / 2) * 2)
  const format = str(p, 'format') === 'jpeg' ? 'image/jpeg' : 'image/png'
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const r = new SceneRenderer(canvas, { preserveDrawingBuffer: true, budgetMB: 512 })
  try {
    r.setSize(w, h)
    await r.waitForContext()
    await document.fonts.ready
    if (view === 'camera') {
      await r.prepare(project, t, h)
      r.render(project, t)
    } else {
      const ec = new EditorCamera()
      const yaw = num(p, 'yaw')
      const pitch = num(p, 'pitch')
      if (yaw !== undefined) ec.yaw = (yaw * Math.PI) / 180
      if (pitch !== undefined) ec.pitch = (Math.max(-89, Math.min(89, pitch)) * Math.PI) / 180
      const ev = evaluateScene(project, t)
      const box = new THREE.Box3()
      const only = has(p, 'shot_id') ? requireShot(project, str(p, 'shot_id')).id : null
      for (const s of ev.shots) if (!only || s.shot.id === only) box.union(s.bounds)
      if (!only) {
        for (const el of ev.layers) if (!el.shot && el.layer.visible) box.union(el.bounds)
        box.expandByPoint(depthToThree(ev.camera.position))
      }
      ec.frame(box, w / h)
      const cam = ec.get(w / h)
      const draw = (): void => {
        r.beginFrame()
        r.renderEditor(project, t, cam, { viewport: { x: 0, y: 0, w, h }, showPath: true, selectedShotId: only })
      }
      draw()
      // Textures stream in asynchronously for the 3D view; give them a moment.
      for (let i = 0; i < 80 && r.stats().pending > 0; i++) await sleep(50)
      draw()
    }
    const data = await canvasToBase64(canvas, format, format === 'image/jpeg' ? 0.88 : undefined)
    return { mime: format, data, width: w, height: h, time: t, view, stats: r.stats() }
  } finally {
    r.dispose()
  }
}

// ------------------------------------------------------------------ scripting

type ScriptFn = (api: unknown, log: (...a: unknown[]) => void) => Promise<unknown>
let scriptSeq = 0

/**
 * Compile user code into an async function. The renderer CSP forbids `eval`/`new Function`
 * but allows inline scripts, so the code is wrapped in an inline <script> element.
 * Syntax errors surface through the window `error` event and are rethrown here.
 */
function compileScript(code: string): ScriptFn {
  const w = window as unknown as { __pxsScripts?: Record<string, ScriptFn> }
  const registry = (w.__pxsScripts ??= {})
  const id = `s${++scriptSeq}`
  let syntaxError: string | null = null
  const onError = (e: ErrorEvent): void => {
    syntaxError = e.message
    e.preventDefault()
  }
  window.addEventListener('error', onError)
  const el = document.createElement('script')
  el.textContent = `window.__pxsScripts[${JSON.stringify(id)}] = async function (api, log) {\n${code}\n};`
  document.head.appendChild(el)
  el.remove()
  window.removeEventListener('error', onError)
  const fn = registry[id]
  delete registry[id]
  if (!fn) throw new Error(`Script did not compile: ${syntaxError ?? 'unknown error'}`)
  return fn
}

// ------------------------------------------------------------------ commands

const commands: Record<string, Handler> = {
  list_commands: () => Object.keys(commands).sort(),

  // ---------------------------------------------------------------- inspect
  get_project_info: () => {
    const project = proj()
    const t = ed().time
    const s = ed()
    return {
      name: project.comp.name,
      composition: project.comp,
      time: t,
      file_path: s.filePath,
      dirty: s.dirty,
      can_undo: s.past.length > 0,
      selected: { layer_id: s.selectedLayerId, shot_id: s.selectedShotId },
      reference_distance: Math.round(referenceDistance(project.comp)),
      shot_spacing: factory.shotSpacing(project.comp),
      shots: project.shots.map((sh) => shotSummary(sh, project, t)),
      layers: project.layers.map((l) => layerSummary(l, t)),
      camera: cameraSummary(project, t),
      look: project.look,
      audio: project.audio && { ...project.audio, name: assetStore.get(project.audio.assetId)?.meta.name },
      assets: project.assets.map((a) => ({ id: a.id, name: a.name, kind: a.kind, width: a.width, height: a.height, duration: a.duration }))
    }
  },

  get_shot_info: (p) => {
    const project = proj()
    const s = requireShot(project, str(p, 'shot_id', true))
    const t = num(p, 'time') ?? ed().time
    return { ...shotSummary(s, project, t), shot: toPlain(s), layers: project.layers.filter((l) => l.shotId === s.id).map((l) => layerSummary(l, t)) }
  },

  get_layer_info: (p) => {
    const project = proj()
    const l = requireLayer(project, str(p, 'layer_id', true))
    const asset = l.type === 'image' ? project.assets.find((a) => a.id === l.props.assetId) : undefined
    return { layer: toPlain(l), asset: asset ?? null }
  },

  get_camera_info: (p) => cameraSummary(proj(), num(p, 'time') ?? ed().time),

  get_memory_stats: () => {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory
    return {
      renderer: getLiveRenderer()?.stats() ?? null,
      js_heap_mb: mem ? { used: Math.round(mem.usedJSHeapSize / 1048576), total: Math.round(mem.totalJSHeapSize / 1048576), limit: Math.round(mem.jsHeapSizeLimit / 1048576) } : null,
      assets: { count: assetStore.all().length, decodes: assetStore.stats.decodes, decoded_mb: Math.round(assetStore.stats.decodedBytes / 1048576) }
    }
  },

  // ---------------------------------------------------------------- project
  new_project: (p) => {
    assetStore.clear()
    const comp: Partial<Project['comp']> = {}
    for (const k of ['name', 'background'] as const) if (has(p, k)) comp[k] = str(p, k)!
    for (const k of ['width', 'height', 'fps', 'duration'] as const) if (has(p, k)) comp[k] = num(p, k)!
    ed().loadProject(factory.createProject(comp), null)
    return { ok: true, composition: proj().comp }
  },

  set_composition: (p) => {
    ed().update((d) => {
      if (has(p, 'name')) d.comp.name = str(p, 'name')!
      if (has(p, 'background')) d.comp.background = str(p, 'background')!
      if (has(p, 'width')) d.comp.width = Math.max(16, Math.round(num(p, 'width')!))
      if (has(p, 'height')) d.comp.height = Math.max(16, Math.round(num(p, 'height')!))
      if (has(p, 'fps')) d.comp.fps = Math.max(1, Math.min(120, num(p, 'fps')!))
      if (has(p, 'duration')) setCompDuration(d as Project, num(p, 'duration')!)
    })
    return proj().comp
  },

  save_project: async (p) => {
    const path = str(p, 'path') ?? ed().filePath
    if (!path) throw new ParamError('Missing "path" (absolute path ending in .pxs)')
    const data = await serializeProject(proj())
    const saved = await window.api.saveProject(data, path)
    if (!saved) throw new Error('Save failed')
    ed().markSaved(saved)
    return { path: saved, bytes: data.byteLength }
  },

  open_project: async (_p, cmd) => {
    if (!cmd.file) throw new ParamError('Missing "file_path"')
    const project = await deserializeProject(cmd.file.data)
    ed().loadProject(project, cmd.file.path)
    return { path: cmd.file.path, shots: project.shots.length, layers: project.layers.length }
  },

  undo: () => {
    ed().undo()
    return { can_undo: ed().past.length > 0, can_redo: ed().future.length > 0 }
  },

  redo: () => {
    ed().redo()
    return { can_undo: ed().past.length > 0, can_redo: ed().future.length > 0 }
  },

  // ---------------------------------------------------------------- shots
  add_shot: (p) => {
    const project = proj()
    const dir = (str(p, 'direction') ?? 'right') as ShotDirection
    if (!SHOT_DIRECTIONS.some((d) => d.id === dir)) throw new ParamError('"direction" must be right, down or depth')
    const shot = factory.createShot(str(p, 'name') ?? `Cảnh ${project.shots.length + 1}`, vec3(p, 'position') ?? nextShotPosition(project, dir), project.shots.length)
    const rot = vec3(p, 'rotation')
    if (rot) shot.rotation.value = rot
    const color = str(p, 'color')
    if (color) shot.color = color
    const adopt = bool(p, 'adopt_global_layers') ?? false
    ed().update((d) => {
      d.shots.push(shot)
      if (adopt) for (const l of d.layers) if (l.shotId === null) l.shotId = shot.id
    })
    ed().selectShot(shot.id)
    return shotSummary(shot, proj(), ed().time)
  },

  update_shot: (p) => {
    const project = proj()
    const id = requireShot(project, str(p, 'shot_id', true)).id
    ed().update((d) => {
      const s = d.shots.find((x) => x.id === id)!
      if (has(p, 'name')) s.name = str(p, 'name')!
      if (has(p, 'color')) s.color = str(p, 'color')!
      if (has(p, 'visible')) s.visible = bool(p, 'visible')!
      const pos = vec3(p, 'position')
      if (pos) setAnim(s.position, pos, p, project)
      const rot = vec3(p, 'rotation')
      if (rot) setAnim(s.rotation, rot, p, project)
    })
    return shotSummary(requireShot(proj(), id), proj(), ed().time)
  },

  delete_shot: (p) => {
    const id = requireShot(proj(), str(p, 'shot_id', true)).id
    const keep = bool(p, 'keep_layers') ?? false
    ed().update((d) => {
      d.shots = d.shots.filter((s) => s.id !== id)
      if (keep) {
        for (const l of d.layers) if (l.shotId === id) l.shotId = null
      } else {
        d.layers = d.layers.filter((l) => l.shotId !== id)
      }
    })
    if (ed().selectedShotId === id) ed().selectShot(null)
    return { deleted: id, kept_layers: keep }
  },

  // ---------------------------------------------------------------- layers
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

  // ---------------------------------------------------------------- keyframes
  set_keyframe: (p) => {
    const ref = propRef(p)
    const t = num(p, 'time') ?? ed().time
    const value = valueFor(ref, p)
    const e = easeOf(p)
    let keyId = ''
    ed().update((d) => {
      const a = getDraftAnimatable(d, ref)!
      keyId = addKeyframe(a as Animatable<AnimValue>, t, value, e, frameTolerance(proj())).id
    })
    return { key_id: keyId, time: t, value }
  },

  remove_keyframe: (p) => {
    const ref = propRef(p)
    const keyId = str(p, 'key_id')
    const t = num(p, 'time')
    if (!keyId && t === undefined) throw new ParamError('Provide "key_id" or "time"')
    let removed = false
    ed().update((d) => {
      const a = getDraftAnimatable(d, ref)!
      const k = keyId ? a.keyframes.find((x) => x.id === keyId) : a.keyframes.find((x) => Math.abs(x.t - t!) <= frameTolerance(proj()))
      if (k) removed = removeKeyframe(a as Animatable<AnimValue>, k.id)
    })
    return { removed }
  },

  clear_keyframes: (p) => {
    const target = str(p, 'target', true)
    const t = ed().time
    const refs: PropRef[] = []
    if (has(p, 'property')) refs.push(propRef(p))
    else if (target === 'camera') refs.push(...CAMERA_PROPS.map((prop) => ({ kind: 'camera' as const, prop })))
    else if (target === 'shot') {
      const shotId = requireShot(proj(), str(p, 'id', true)).id
      refs.push(...SHOT_PROPS.map((prop) => ({ kind: 'shot' as const, shotId, prop })))
    } else if (target === 'layer') {
      const layerId = requireLayer(proj(), str(p, 'id', true)).id
      refs.push(...LAYER_PROPS.map((prop) => ({ kind: 'layer' as const, layerId, prop })))
    } else throw new ParamError('"target" must be layer, camera or shot')
    let cleared = 0
    ed().update((d) => {
      for (const ref of refs) {
        const a = getDraftAnimatable(d, ref)!
        if (!a.keyframes.length) continue
        cleared += a.keyframes.length
        const v = evaluate(a as Animatable<AnimValue>, t)
        a.value = Array.isArray(v) ? ([...v] as Vec3) : v
        a.keyframes = []
      }
    })
    return { cleared }
  },

  // ---------------------------------------------------------------- camera
  set_camera: (p) => {
    const project = proj()
    ed().update((d) => {
      const c = d.camera
      const pos = vec3(p, 'position')
      if (pos) setAnim(c.position, pos, p, project)
      const tg = vec3(p, 'target')
      if (tg) setAnim(c.target, tg, p, project)
      for (const [param, prop] of [
        ['fov', 'fov'],
        ['focus_distance', 'focusDistance'],
        ['aperture', 'aperture'],
        ['fade', 'fade']
      ] as const) {
        const v = num(p, param)
        if (v !== undefined) setAnim(c[prop], v, p, project)
      }
      if (has(p, 'dof_enabled')) c.dofEnabled = bool(p, 'dof_enabled')!
      if (has(p, 'shake_amount')) c.shakeAmount = num(p, 'shake_amount')!
      if (has(p, 'shake_speed')) c.shakeSpeed = num(p, 'shake_speed')!
    })
    return cameraSummary(proj(), ed().time)
  },

  apply_camera_preset: (p) => {
    const preset = str(p, 'preset', true) as CameraPreset
    if (!CAMERA_PRESETS.some((x) => x.id === preset)) throw new ParamError(`"preset" must be one of ${CAMERA_PRESETS.map((x) => x.id).join(', ')}`)
    const project = proj()
    const shot = has(p, 'shot_id') ? requireShot(project, str(p, 'shot_id')) : null
    const t0 = num(p, 'start') ?? 0
    const t1 = num(p, 'end') ?? project.comp.duration
    ed().update((d) => applyCameraPreset(d.camera as Project['camera'], preset, d.comp as Project['comp'], t0, t1, num(p, 'intensity') ?? 1, shotLocalToWorld(shot, t0)))
    return cameraSummary(proj(), t0)
  },

  camera_fly_to_shot: (p) => {
    const id = requireShot(proj(), str(p, 'shot_id', true)).id
    const t = num(p, 'time') ?? ed().time
    ed().update((d) => flyCameraToShot(d as Project, id, t, num(p, 'duration') ?? 0, easeOf(p)))
    return cameraSummary(proj(), t)
  },

  build_camera_path: (p) => {
    if (!Array.isArray(p.steps) || p.steps.length === 0) throw new ParamError('"steps" must be a non-empty array')
    const project = proj()
    const types = TRANSITIONS.map((x) => x.id)
    const steps: PathStep[] = (p.steps as Params[]).map((s, i) => {
      const type = (str(s, 'transition') ?? 'fly') as TransitionType
      if (!types.includes(type)) throw new ParamError(`steps[${i}].transition must be one of ${types.join(', ')}`)
      return {
        shotId: requireShot(project, str(s, 'shot_id', true)).id,
        hold: num(s, 'hold') ?? 3,
        type,
        transition: num(s, 'transition_duration') ?? (type === 'cut' ? 0 : type === 'fade' ? 1 : 2)
      }
    })
    const fit = bool(p, 'fit_duration') ?? true
    let end = 0
    ed().update((d) => {
      end = buildCameraPath(d as Project, steps, { pushIn: num(p, 'push_in') ?? 0.12, startAt: num(p, 'start_at') ?? 0 })
      if (fit) setCompDuration(d as Project, end)
    })
    ed().setTime(num(p, 'start_at') ?? 0)
    return { end: round(end, 3), duration: proj().comp.duration, steps: steps.length }
  },

  // ---------------------------------------------------------------- look, audio, time, view
  set_look: (p) => {
    const keys: (keyof LookSettings)[] = ['fogEnabled', 'fogColor', 'fogNear', 'fogFar', 'vignette', 'grain', 'exposure', 'contrast', 'saturation']
    const alias: Record<string, keyof LookSettings> = { fog_enabled: 'fogEnabled', fog_color: 'fogColor', fog_near: 'fogNear', fog_far: 'fogFar' }
    ed().update((d) => {
      for (const [k, v] of Object.entries(p)) {
        const key = (alias[k] ?? k) as keyof LookSettings
        if (!keys.includes(key)) continue
        const cur = d.look[key]
        if (typeof cur !== typeof v) throw new ParamError(`"${k}" must be a ${typeof cur}`)
        ;(d.look as unknown as Record<string, unknown>)[key] = v
      }
    })
    return proj().look
  },

  set_audio: async (p, cmd) => {
    if (bool(p, 'remove')) {
      ed().update((d) => {
        d.audio = null
      })
      return { audio: null }
    }
    if (cmd.file) {
      if (!cmd.file.mime.startsWith('audio/')) throw new ParamError(`Not an audio file: ${cmd.file.name}`)
      const asset = await assetStore.add(cmd.file.name, cmd.file.mime, cmd.file.data, 'audio')
      ed().update((d) => {
        d.assets.push(asset.meta)
        d.audio = { assetId: asset.meta.id, offset: 0, volume: 1 }
      })
    }
    if (!proj().audio) throw new ParamError('No audio track: provide "file_path"')
    ed().update((d) => {
      if (has(p, 'offset')) d.audio!.offset = num(p, 'offset')!
      if (has(p, 'volume')) d.audio!.volume = Math.max(0, Math.min(1, num(p, 'volume')!))
    })
    const a = proj().audio!
    return { ...a, duration: assetStore.get(a.assetId)?.meta.duration }
  },

  set_time: (p) => {
    ed().setPlaying(false)
    ed().setTime(num(p, 'time', true))
    return { time: ed().time, looking_at_shot: shotAtTime(proj(), ed().time) }
  },

  set_playing: (p) => {
    ed().setPlaying(bool(p, 'playing') ?? true)
    return { playing: ed().playing }
  },

  select: (p) => {
    if (has(p, 'layer_id')) ed().selectLayer(requireLayer(proj(), str(p, 'layer_id')).id)
    else if (has(p, 'shot_id')) ed().selectShot(requireShot(proj(), str(p, 'shot_id')).id)
    else ed().selectLayer(null)
    return { layer_id: ed().selectedLayerId, shot_id: ed().selectedShotId }
  },

  set_view: (p) => {
    const v = useView.getState()
    const mode = str(p, 'mode')
    if (mode === 'camera') v.set({ split: false, primary: 'camera' })
    else if (mode === '3d') v.set({ split: false, primary: 'editor' })
    else if (mode === 'split') v.set({ split: true })
    else if (mode) throw new ParamError('"mode" must be camera, 3d or split')
    if (has(p, 'camera_only')) v.set({ cameraOnly: bool(p, 'camera_only')! })
    if (has(p, 'show_path')) v.set({ showPath: bool(p, 'show_path')! })
    const focus = str(p, 'focus')
    if (focus === 'all' || focus === 'selection') v.requestFocus(focus)
    else if (focus) v.requestFocus('shot', requireShot(proj(), focus).id)
    const s = useView.getState()
    return { split: s.split, primary: s.primary, camera_only: s.cameraOnly, show_path: s.showPath }
  },

  get_viewport_screenshot: (p) => screenshot(p),

  // ---------------------------------------------------------------- export & scripting
  export_video: async (p) => {
    const outPath = str(p, 'out_path', true)
    if (isExporting()) throw new Error('Another export is already running')
    const preset = str(p, 'preset') as 'ultrafast' | 'veryfast' | 'medium' | 'slow' | undefined
    const res = await runExport(proj(), {
      outPath,
      height: num(p, 'height'),
      fps: num(p, 'fps'),
      crf: num(p, 'crf'),
      preset,
      withAudio: bool(p, 'with_audio'),
      start: num(p, 'start'),
      end: num(p, 'end')
    })
    if (!res.ok) throw new Error(res.error ?? (res.cancelled ? 'Export cancelled' : 'Export failed'))
    return res
  },

  execute_script: async (p) => {
    const code = str(p, 'code', true)
    const logs: string[] = []
    const fmt = (a: unknown): string => (typeof a === 'string' ? a : JSON.stringify(a))
    const log = (...args: unknown[]): void => void logs.push(args.map(fmt).join(' '))
    const api = {
      get project() {
        return proj()
      },
      get time() {
        return ed().time
      },
      editor: ed,
      /** Undoable mutation: api.update(d => { d.comp.name = 'x' }) */
      update: (fn: (d: Draft<Project>) => void) => ed().update(fn),
      /** Run any MCP command: await api.run('add_text_layer', { text: 'Hi' }) */
      run: (method: string, params: Params = {}) => runCommand(method, params),
      factory,
      keyframes: { addKeyframe, evaluate, setValueAt, removeKeyframe },
      evaluateScene,
      THREE,
      log
    }
    const fn = compileScript(code)
    const result = await fn(api, log)
    let plain: unknown = null
    try {
      plain = toPlain(result)
    } catch {
      plain = String(result)
    }
    return { result: plain, logs }
  }
}

/** Run a command by name (also used by execute_script's `api.run`). */
export async function runCommand(method: string, params: Params = {}, cmd?: McpCommand): Promise<unknown> {
  const h = commands[method]
  if (!h) throw new Error(`Unknown method "${method}". Available: ${Object.keys(commands).sort().join(', ')}`)
  return h(params, cmd ?? { reqId: 'local', method, params })
}

export const MCP_COMMANDS = Object.keys(commands)

/** Subscribe to MCP commands from the main process. Returns an unsubscribe function. */
export function initMcp(onActivity?: (method: string, ok: boolean) => void): () => void {
  if (!window.api?.mcp) return () => undefined
  return window.api.mcp.onCommand(async (cmd) => {
    try {
      const result = await runCommand(cmd.method, cmd.params ?? {}, cmd)
      window.api.mcp.respond({ reqId: cmd.reqId, ok: true, result: toPlain(result) })
      onActivity?.(cmd.method, true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      window.api.mcp.respond({ reqId: cmd.reqId, ok: false, error: msg })
      onActivity?.(cmd.method, false)
    }
  })
}
