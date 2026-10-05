import * as THREE from 'three'
import type { Animatable, AnimValue, Project, Vec3 } from '@shared/types'
import type { Draft } from 'immer'
import { addKeyframe, evaluate, removeKeyframe, setValueAt } from '../../animation/keyframes'
import { shotAtTime } from '../../animation/cameraPath'
import { EditorCamera } from '../../engine/EditorCamera'
import { evaluateScene } from '../../engine/evaluateScene'
import { getLiveRenderer } from '../../engine/liveRenderer'
import { SceneRenderer } from '../../engine/SceneRenderer'
import { depthToThree } from '../../engine/spatial'
import { assetStore } from '../../project/assets'
import * as factory from '../../project/factory'
import { frameTolerance, getDraftAnimatable, type PropRef } from '../../store/editor'
import { useView } from '../../store/view'
import { ParamError, ed, proj, type Handler, type Params } from '../types'
import {
  bool,
  CAMERA_PROPS,
  easeOf,
  has,
  LAYER_PROPS,
  num,
  propRef,
  requireLayer,
  requireShot,
  SHOT_PROPS,
  str,
  toPlain,
  valueFor
} from '../params'
import { runCommand } from '../commands'

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

type ScriptFn = (api: unknown, log: (...a: unknown[]) => void) => Promise<unknown>
let scriptSeq = 0

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

export const systemCommands: Record<string, Handler> = {
  get_memory_stats: () => {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory
    return {
      renderer: getLiveRenderer()?.stats() ?? null,
      js_heap_mb: mem ? { used: Math.round(mem.usedJSHeapSize / 1048576), total: Math.round(mem.totalJSHeapSize / 1048576), limit: Math.round(mem.jsHeapSizeLimit / 1048576) } : null,
      assets: { count: assetStore.all().length, decodes: assetStore.stats.decodes, decoded_mb: Math.round(assetStore.stats.decodedBytes / 1048576) }
    }
  },

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
      update: (fn: (d: Draft<Project>) => void) => ed().update(fn),
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
