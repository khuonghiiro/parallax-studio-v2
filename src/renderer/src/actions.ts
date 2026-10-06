import type { Project, Shot, Vec3 } from '@shared/types'
import { create } from 'zustand'
import { buildCameraPath, flyCameraToShot, type PathOptions, type PathStep } from './animation/cameraPath'
import { applyDrawnCameraPath } from './animation/cameraSketch'
import { assetStore } from './project/assets'
import { buildDemoProject } from './project/demo'
import {
  createGroundLayer,
  createImageLayer,
  createParticleLayer,
  createProject,
  createShot,
  createSolidLayer,
  createTextLayer,
  duplicateLayer,
  shotSpacing
} from './project/factory'
import { exportProjectToJson, importProjectFromJson, parseDataUrl } from './project/jsonFormat'
import { deserializeProject, serializeProject } from './project/serialize'
import { EFFECT_ASSETS } from './project/effectAssets'
import { PARTICLE_PRESETS } from './animation/presets'
import { referenceDistance } from './animation/math'
import { evaluate, setValueAt } from './animation/keyframes'
import { frameTolerance, getDraftAnimatable, useEditor } from './store/editor'

// ------------------------------------------------------------------ toast

interface ToastState {
  message: string | null
  show(msg: string, ms?: number): void
}
let toastTimer: number | undefined
export const useToast = create<ToastState>((set) => ({
  message: null,
  show(message, ms = 2400) {
    set({ message })
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => set({ message: null }), ms)
  }
}))
const toast = (m: string): void => useToast.getState().show(m)

const editor = () => useEditor.getState()

function confirmDiscard(): boolean {
  return !editor().dirty || window.confirm('Dự án có thay đổi chưa lưu. Tiếp tục và bỏ thay đổi?')
}

// ------------------------------------------------------------------ project

export async function newProject(): Promise<void> {
  if (!confirmDiscard()) return
  assetStore.clear()
  editor().loadProject(createProject(), null)
  toast('Đã tạo dự án mới')
}

export async function loadDemo(force = false): Promise<void> {
  if (!force && !confirmDiscard()) return
  const p = await buildDemoProject()
  editor().loadProject(p, null)
  editor().setPlaying(false)
}

export async function openProject(): Promise<void> {
  if (!confirmDiscard()) return
  const res = await window.api.openProject()
  if (!res) return
  try {
    let p: Project
    if (res.path.endsWith('.json')) {
      const text = new TextDecoder('utf-8').decode(res.data)
      p = await importProjectFromJson(text)
    } else {
      p = await deserializeProject(res.data)
    }
    editor().loadProject(p, res.path)
    toast('Đã mở dự án')
  } catch (err) {
    window.alert(`Không mở được dự án:\n${String(err)}`)
  }
}

export async function openProjectJson(): Promise<void> {
  if (!confirmDiscard()) return
  try {
    const res = await window.api.openJson()
    if (!res) return
    const p = await importProjectFromJson(res.content)
    editor().loadProject(p, res.path)
    toast('Đã mở dự án từ JSON')
  } catch (err) {
    window.alert(`Không mở được file JSON:\n${String(err)}`)
  }
}

export async function saveProjectJson(): Promise<void> {
  const { project, filePath } = editor()
  try {
    const jsonStr = await exportProjectToJson(project)
    const baseName = (filePath ? filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') : project.comp.name || 'project') + '.json'
    const path = await window.api.saveJson(jsonStr, baseName)
    if (path) {
      editor().markSaved(path)
      toast('Đã xuất dự án ra JSON')
    }
  } catch (err) {
    window.alert(`Không xuất được JSON:\n${String(err)}`)
  }
}

export async function saveProject(saveAs = false): Promise<void> {
  const { project, filePath } = editor()
  const data = await serializeProject(project)
  const path = await window.api.saveProject(data, saveAs ? undefined : (filePath ?? undefined))
  if (path) {
    editor().markSaved(path)
    toast('Đã lưu dự án')
  }
}

// ------------------------------------------------------------------ assets & layers

function nextDepthForNewLayer(project: Project, shotId: string | null = activeShotId()): number {
  // Place new images with depth spacing so the scene has 3D depth, clamped safely in front of camera
  const zs = project.layers
    .filter((l) => l.type === 'image' && l.shotId === shotId)
    .map((l) => l.transform.position.value[2])
  if (!zs.length) return 0
  const d = referenceDistance(project.comp)
  const minAllowed = -Math.round(d * 0.7)
  return Math.max(minAllowed, Math.min(...zs) - 200)
}

/** Shot that receives newly created layers (null = global). */
function activeShotId(): string | null {
  const { selectedShotId, project } = editor()
  return selectedShotId && project.shots.some((s) => s.id === selectedShotId) ? selectedShotId : null
}

/** Insert a layer at the top of its shot's group (keeps layers of a shot contiguous in the stack). */
function insertLayerTop(d: Project, layer: Project['layers'][number]): void {
  const i = d.layers.findIndex((l) => l.shotId === layer.shotId)
  if (i < 0) d.layers.unshift(layer)
  else d.layers.splice(i, 0, layer)
}

function insertLayerBottom(d: Project, layer: Project['layers'][number]): void {
  let last = -1
  d.layers.forEach((l, i) => {
    if (l.shotId === layer.shotId) last = i
  })
  if (last < 0) d.layers.push(layer)
  else d.layers.splice(last + 1, 0, layer)
}

async function registerImages(files: { name: string; mime: string; data: Uint8Array }[], addLayers: boolean): Promise<void> {
  const shotId = activeShotId()
  let lastId: string | null = null
  for (const f of files) {
    try {
      const asset = await assetStore.add(f.name, f.mime, f.data, 'image')
      const p = (f as { path?: string }).path
      if (typeof p === 'string') {
        const norm = p.replace(/\\/g, '/')
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
      editor().update((d) => {
        // If importing into a completely clean project, adapt comp dimensions to match the source image
        if (d.layers.length === 0 && d.assets.length === 0 && asset.meta.width && asset.meta.height) {
          d.comp.width = asset.meta.width
          d.comp.height = asset.meta.height
          const refD = referenceDistance(d.comp)
          d.camera.position.value = [0, 0, -refD]
          d.camera.target.value = [0, 0, 0]
          d.camera.focusDistance.value = Math.round(refD)
        }
        d.assets.push(asset.meta)
        if (addLayers) {
          const depth = nextDepthForNewLayer(d as Project, shotId)
          const layer = createImageLayer(asset.meta, d.comp as Project['comp'], depth)
          layer.shotId = shotId
          insertLayerTop(d as Project, layer)
          lastId = layer.id
        }
      })
    } catch (err) {
      toast(`Lỗi đọc ảnh ${f.name}: ${String(err)}`)
    }
  }
  if (addLayers && lastId) {
    editor().selectLayer(lastId)
    toast(`Đã thêm ${files.length} layer ảnh`)
  }
}

export async function importImages(addLayers = true): Promise<void> {
  const files = await window.api.openFiles('image')
  await registerImages(files, addLayers)
}

export async function importAudio(): Promise<void> {
  const [f] = await window.api.openFiles('audio')
  if (!f) return
  await setAudioFromBytes(f.name, f.mime, f.data)
}

async function setAudioFromBytes(name: string, mime: string, data: Uint8Array): Promise<void> {
  const asset = await assetStore.add(name, mime, data, 'audio')
  editor().update((d) => {
    d.assets.push(asset.meta)
    d.audio = { assetId: asset.meta.id, offset: 0, volume: 1 }
  })
  toast(`Đã thêm nhạc nền: ${name}`)
}

/** Handle files dropped onto the window. */
export async function importDroppedFiles(list: FileList): Promise<void> {
  const images: { name: string; mime: string; data: Uint8Array }[] = []
  for (const file of Array.from(list)) {
    const data = new Uint8Array(await file.arrayBuffer())
    if (file.type.startsWith('image/')) images.push({ name: file.name, mime: file.type, data })
    else if (file.type.startsWith('audio/')) await setAudioFromBytes(file.name, file.type, data)
    else if (file.name.endsWith('.pxs')) {
      if (!confirmDiscard()) return
      const p = await deserializeProject(data)
      editor().loadProject(p, null)
      return
    } else if (file.name.endsWith('.json')) {
      if (!confirmDiscard()) return
      const text = new TextDecoder('utf-8').decode(data)
      const p = await importProjectFromJson(text)
      editor().loadProject(p, file.name)
      toast('Đã nạp dự án từ JSON')
      return
    }
  }
  if (images.length) await registerImages(images, true)
}

export async function importBuiltInAsset(
  item: { relativePath: string; name: string; kind: 'image' | 'audio'; mime?: string },
  addLayer = true
): Promise<string | null> {
  const file = await window.api.loadBuiltInAssetBytes(item.relativePath)
  if (!file) {
    toast(`Không tải được tệp: ${item.name}`)
    return null
  }
  const displayName = item.name || file.name
  if (item.kind === 'audio') {
    await setAudioFromBytes(displayName, file.mime, file.data)
    const audioTrack = editor().project.audio
    if (audioTrack) {
      const audioAsset = editor().project.assets.find((a) => a.id === audioTrack.assetId)
      if (audioAsset) {
        audioAsset.assetPath = item.relativePath
        audioAsset.path = `assets/${item.relativePath}`
      }
    }
    return null
  }
  const shotId = activeShotId()
  try {
    const asset = await assetStore.add(displayName, file.mime, file.data, 'image')
    asset.meta.assetPath = item.relativePath
    asset.meta.path = `assets/${item.relativePath}`
    let layerId: string | null = null
    editor().update((d) => {
      if (d.layers.length === 0 && d.assets.length === 0 && asset.meta.width && asset.meta.height) {
        d.comp.width = asset.meta.width
        d.comp.height = asset.meta.height
        const refD = referenceDistance(d.comp)
        d.camera.position.value = [0, 0, -refD]
        d.camera.target.value = [0, 0, 0]
        d.camera.focusDistance.value = Math.round(refD)
      }
      d.assets.push(asset.meta)
      if (addLayer) {
        const depth = nextDepthForNewLayer(d as Project, shotId)
        const layer = createImageLayer(asset.meta, d.comp as Project['comp'], depth)
        layer.shotId = shotId
        insertLayerTop(d as Project, layer)
        layerId = layer.id
      }
    })
    if (layerId) {
      editor().selectLayer(layerId)
      toast(`Đã thêm layer: ${file.name}`)
    } else {
      toast(`Đã nạp ${file.name} vào tài nguyên`)
    }
    return asset.meta.id
  } catch (err) {
    toast(`Lỗi khi nạp ảnh ${file.name}: ${String(err)}`)
    return null
  }
}

export function addLayerFromAsset(assetId: string): void {
  const meta = editor().project.assets.find((a) => a.id === assetId)
  if (!meta || meta.kind !== 'image') return
  const depth = nextDepthForNewLayer(editor().project, activeShotId())
  const layer = createImageLayer(meta, editor().project.comp, depth)
  layer.shotId = activeShotId()
  editor().update((d) => {
    insertLayerTop(d as Project, layer)
  })
  editor().selectLayer(layer.id)
}

export function removeAsset(assetId: string): void {
  const { project } = editor()
  const used = project.layers.some((l) => l.type === 'image' && l.props.assetId === assetId)
  if (used && !window.confirm('Asset đang được dùng bởi layer. Xoá cả các layer đó?')) return
  editor().update((d) => {
    d.layers = d.layers.filter((l) => !(l.type === 'image' && l.props.assetId === assetId))
    d.assets = d.assets.filter((a) => a.id !== assetId)
    if (d.audio?.assetId === assetId) d.audio = null
  })
}

export function addTextLayer(): void {
  const layer = createTextLayer(editor().project.comp)
  layer.shotId = activeShotId()
  editor().update((d) => {
    insertLayerTop(d as Project, layer)
  })
  editor().selectLayer(layer.id)
}

export function addSolidLayer(): void {
  const layer = createSolidLayer(editor().project.comp)
  layer.shotId = activeShotId()
  editor().update((d) => {
    insertLayerBottom(d as Project, layer)
  })
  editor().selectLayer(layer.id)
}

export function addGroundLayer(): void {
  const layer = createGroundLayer(editor().project.comp)
  layer.shotId = activeShotId()
  editor().update((d) => {
    insertLayerBottom(d as Project, layer)
  })
  editor().selectLayer(layer.id)
}

export function addParticleLayer(): void {
  const layer = createParticleLayer(editor().project.comp)
  layer.shotId = activeShotId()
  editor().update((d) => {
    insertLayerTop(d as Project, layer)
  })
  editor().selectLayer(layer.id)
}

export async function addMistLayer(): Promise<void> {
  const { mime, data } = parseDataUrl(EFFECT_ASSETS.mist)
  const asset = await assetStore.add('Sương mù thực (Mist).webp', mime, data, 'image')
  const comp = editor().project.comp
  const layer = createImageLayer(asset.meta, comp, 600)
  layer.name = 'Sương mù thực (Realistic Mist)'
  layer.blendMode = 'screen'
  layer.transform.opacity.value = 0.65
  layer.transform.scale.value = [2.2, 1.35, 1]
  layer.motion = {
    type: 'sway',
    speed: 0.22,
    amplitude: [160, 14, 0.3]
  }
  layer.shotId = activeShotId()
  editor().update((d) => {
    d.assets.push(asset.meta)
    insertLayerTop(d as Project, layer)
  })
  editor().selectLayer(layer.id)
  toast('Đã thêm layer Ảnh Sương mù thực (PNG/WebP)')
}

export async function addRainLayer(): Promise<void> {
  const { mime, data } = parseDataUrl(EFFECT_ASSETS.rain)
  const asset = await assetStore.add('Mưa rào thực (Rain).webp', mime, data, 'image')
  const comp = editor().project.comp
  const layer = createImageLayer(asset.meta, comp, 100)
  layer.name = 'Mưa rào thực (Realistic Rain Sheet)'
  layer.blendMode = 'screen'
  layer.transform.opacity.value = 0.75
  layer.transform.scale.value = [2.0, 1.3, 1]
  layer.motion = {
    type: 'drift',
    speed: 360,
    direction: 225,
    loopMode: 'uv'
  }
  layer.shotId = activeShotId()
  editor().update((d) => {
    d.assets.push(asset.meta)
    insertLayerTop(d as Project, layer)
  })
  editor().selectLayer(layer.id)
  toast('Đã thêm layer Ảnh Mưa rơi thực (PNG/WebP)')
}

export function deleteSelectedLayer(): void {
  const { selectedLayerId } = editor()
  if (!selectedLayerId) return
  editor().update((d) => {
    d.layers = d.layers.filter((l) => l.id !== selectedLayerId)
  })
  editor().selectLayer(null)
}

export function duplicateSelectedLayer(): void {
  const { selectedLayerId, project } = editor()
  const idx = project.layers.findIndex((l) => l.id === selectedLayerId)
  if (idx < 0) return
  const copy = duplicateLayer(project.layers[idx])
  editor().update((d) => {
    d.layers.splice(idx, 0, copy)
  })
  editor().selectLayer(copy.id)
}

/** Move a layer up/down in the stack, staying within its shot's group. */
export function moveLayer(id: string, dir: -1 | 1): void {
  editor().update((d) => {
    const i = d.layers.findIndex((l) => l.id === id)
    if (i < 0) return
    const shotId = d.layers[i].shotId
    let j = i + dir
    while (j >= 0 && j < d.layers.length && d.layers[j].shotId !== shotId) j += dir
    if (j < 0 || j >= d.layers.length) return
    const [l] = d.layers.splice(i, 1)
    d.layers.splice(j, 0, l)
  })
}

/** Move a layer to the top of its shot's stack. */
export function moveLayerToTop(id: string): void {
  editor().update((d) => {
    const i = d.layers.findIndex((l) => l.id === id)
    if (i < 0) return
    const [l] = d.layers.splice(i, 1)
    insertLayerTop(d as Project, l)
  })
}

/** Move a layer to the bottom of its shot's stack. */
export function moveLayerToBottom(id: string): void {
  editor().update((d) => {
    const i = d.layers.findIndex((l) => l.id === id)
    if (i < 0) return
    const [l] = d.layers.splice(i, 1)
    insertLayerBottom(d as Project, l)
  })
}

/** Nudge a layer's 3D position [dx, dy, dz]. */
export function nudgeLayerPosition(id: string, dx: number, dy: number, dz: number): void {
  const st = editor()
  const layer = st.project.layers.find((l) => l.id === id)
  if (!layer || layer.locked) return
  const cur = evaluate(layer.transform.position, st.time) as Vec3
  const next: Vec3 = [Math.round(cur[0] + dx), Math.round(cur[1] + dy), Math.round(cur[2] + dz)]
  st.update((d) => {
    const l = d.layers.find((x) => x.id === id)
    if (l) setValueAt(l.transform.position, st.time, next, frameTolerance(st.project))
  })
}

/** Add an asset layer at a specific 3D position. */
export async function addLayerAtPosition(
  assetData: { id?: string; relativePath?: string; name: string; kind: 'image' | 'audio'; mime?: string },
  pos: Vec3,
  shotId?: string | null
): Promise<string | null> {
  const targetShotId = shotId !== undefined ? shotId : activeShotId()
  let meta = assetData.id ? editor().project.assets.find((a) => a.id === assetData.id) : undefined

  if (!meta && assetData.relativePath) {
    const file = await window.api.loadBuiltInAssetBytes(assetData.relativePath)
    if (!file) return null
    if (assetData.kind === 'audio') {
      await setAudioFromBytes(file.name, file.mime, file.data)
      return null
    }
    const asset = await assetStore.add(file.name, file.mime, file.data, 'image')
    meta = asset.meta
    editor().update((d) => {
      d.assets.push(asset.meta)
    })
  }

  if (!meta || meta.kind !== 'image') return null

  const comp = editor().project.comp
  const layer = createImageLayer(meta, comp, pos[2])
  layer.shotId = targetShotId
  layer.transform.position.value = [pos[0], pos[1], pos[2]]

  editor().update((d) => {
    insertLayerTop(d as Project, layer)
  })
  editor().selectLayer(layer.id)
  toast(`Đã thêm layer ${meta.name} tại [${Math.round(pos[0])}, ${Math.round(pos[2])}]`)
  return layer.id
}

/** Move a layer into another shot (or global), keeping its local transform. */
export function setLayerShot(layerId: string, shotId: string | null): void {
  editor().update((d) => {
    const i = d.layers.findIndex((l) => l.id === layerId)
    if (i < 0 || d.layers[i].shotId === shotId) return
    const [l] = d.layers.splice(i, 1)
    l.shotId = shotId
    insertLayerTop(d as Project, l)
  })
  editor().selectLayer(layerId)
}

export function deleteSelectedKeyframe(): boolean {
  const { selectedKey } = editor()
  if (!selectedKey) return false
  editor().update((d) => {
    const a = getDraftAnimatable(d, selectedKey.ref)
    if (!a) return
    const i = a.keyframes.findIndex((k) => k.id === selectedKey.keyId)
    if (i >= 0) {
      const [removed] = a.keyframes.splice(i, 1)
      if (a.keyframes.length === 0) (a as { value: unknown }).value = removed.value
    }
  })
  editor().selectKey(null)
  return true
}

// ------------------------------------------------------------------ shots

export type ShotDirection = 'right' | 'left' | 'up' | 'down' | 'depth' | 'front' | 'up-right' | 'down-depth'

export const SHOT_DIRECTIONS: { id: ShotDirection; label: string }[] = [
  { id: 'right', label: '➡️ Bên phải (ngang +X)' },
  { id: 'left', label: '⬅️ Bên trái (ngang -X)' },
  { id: 'up', label: '⬆️ Bên trên (lên cao +Y)' },
  { id: 'down', label: '⬇️ Bên dưới (hạ thấp -Y)' },
  { id: 'depth', label: '⏹️ Phía sau (chiều sâu +Z)' },
  { id: 'front', label: '⏺️ Phía trước (lại gần -Z)' },
  { id: 'up-right', label: '↗️ Chéo lên trên - phải' },
  { id: 'down-depth', label: '↘️ Xuống dưới - lùi sâu' }
]

/** Where a new shot goes: next free slot along `dir`, aligned with the last shot on the other axes. */
export function nextShotPosition(project: Project, dir: ShotDirection): Vec3 {
  if (project.shots.length === 0) return [0, 0, 0]
  const { comp } = project
  const last = project.shots[project.shots.length - 1].position.value
  const pos: Vec3 = [...last] as Vec3
  const vals = project.shots.map((s) => s.position.value)
  const spacingX = shotSpacing(comp)
  const spacingY = Math.round(comp.height * 5.5)
  const spacingZ = Math.round(comp.width * 4)

  if (dir === 'right') pos[0] = Math.max(...vals.map((v) => v[0])) + spacingX
  else if (dir === 'left') pos[0] = Math.min(...vals.map((v) => v[0])) - spacingX
  else if (dir === 'up') pos[1] = Math.max(...vals.map((v) => v[1])) + spacingY
  else if (dir === 'down') pos[1] = Math.min(...vals.map((v) => v[1])) - spacingY
  else if (dir === 'depth') pos[2] = Math.max(...vals.map((v) => v[2])) + spacingZ
  else if (dir === 'front') pos[2] = Math.min(...vals.map((v) => v[2])) - spacingZ
  else if (dir === 'up-right') {
    pos[0] = Math.max(...vals.map((v) => v[0])) + spacingX
    pos[1] = Math.max(...vals.map((v) => v[1])) + spacingY
  } else if (dir === 'down-depth') {
    pos[1] = Math.min(...vals.map((v) => v[1])) - spacingY
    pos[2] = Math.max(...vals.map((v) => v[2])) + spacingZ
  }
  return pos
}

export function addShot(dir: ShotDirection = 'right', name?: string): Shot {
  const { project } = editor()
  const shot = createShot(name ?? `Cảnh ${project.shots.length + 1}`, nextShotPosition(project, dir), project.shots.length)
  const adoptGlobals = project.shots.length === 0 && project.layers.some((l) => l.shotId === null)
  editor().update((d) => {
    d.shots.push(shot)
    // The first shot adopts existing (v1-style) layers so the old scene becomes "Cảnh 1".
    if (adoptGlobals) for (const l of d.layers) if (l.shotId === null && l.type !== 'particles') l.shotId = shot.id
  })
  editor().selectShot(shot.id)
  toast(adoptGlobals ? `Đã tạo ${shot.name} (gom các layer hiện có vào cảnh này)` : `Đã tạo ${shot.name}`)
  return shot
}

export function deleteShot(shotId: string): void {
  const { project } = editor()
  const shot = project.shots.find((s) => s.id === shotId)
  if (!shot) return
  const count = project.layers.filter((l) => l.shotId === shotId).length
  if (count && !window.confirm(`Xoá "${shot.name}" cùng ${count} layer của nó?`)) return
  editor().update((d) => {
    d.shots = d.shots.filter((s) => s.id !== shotId)
    d.layers = d.layers.filter((l) => l.shotId !== shotId)
  })
  editor().selectShot(null)
}

export function updateShot(shotId: string, patch: Partial<Pick<Shot, 'name' | 'color' | 'visible'>>, mergeKey?: string): void {
  editor().update((d) => {
    const s = d.shots.find((x) => x.id === shotId)
    if (s) Object.assign(s, patch)
  }, mergeKey)
}

/** Key the camera to frame the shot at the current time (AE-style "fly here"). */
export function flyToShot(shotId: string, duration = 0): void {
  const { time } = editor()
  editor().update((d) => flyCameraToShot(d as Project, shotId, time, duration))
  const s = editor().project.shots.find((x) => x.id === shotId)
  if (s) toast(`Camera bay tới ${s.name} tại ${time.toFixed(2)}s`)
}

/** Change the comp duration; layers that ran to the old end are extended/trimmed to the new end. */
export function setCompDuration(d: Project, duration: number): void {
  const old = d.comp.duration
  const nd = Math.max(0.5, Math.round(duration * d.comp.fps) / d.comp.fps)
  for (const l of d.layers) if (l.outPoint >= old - 1e-3 || l.outPoint > nd) l.outPoint = nd
  d.comp.duration = nd
}

/** Replace the camera move with a tour through shots. Returns the tour end time. */
export function applyCameraPath(steps: PathStep[], opts: PathOptions & { fitDuration?: boolean } = {}): number {
  let end = 0
  editor().update((d) => {
    end = buildCameraPath(d as Project, steps, opts)
    if (opts.fitDuration) setCompDuration(d as Project, end)
  })
  editor().setTime(opts.startAt ?? 0)
  return end
}

/** Quick 1-click cinematic auto tour through all visible shots. */
export function autoBuildCameraTour(): number {
  const { project } = editor()
  const visibleShots = project.shots.filter((s) => s.visible)
  if (visibleShots.length === 0) {
    toast('Chưa có cảnh nào để tạo lộ trình')
    return 0
  }
  const steps: PathStep[] = visibleShots.map((s, i, arr) => ({
    shotId: s.id,
    hold: 2.8,
    type: i % 2 === 0 ? 'arc' : 'fly',
    transition: i < arr.length - 1 ? 2.2 : 0
  }))
  const end = applyCameraPath(steps, { pushIn: 0.1, fitDuration: true })
  toast(`⚡ Đã tự động tạo lộ trình camera ${end.toFixed(1)}s qua ${steps.length} cảnh! Bấm Space để xem`)
  return end
}

/** Apply a 2D drawn path as a 3D camera trajectory with keyframes */
export function applyDrawnCameraTour(
  rawPoints: import('./animation/cameraSketch').Point2D[],
  opts?: import('./animation/cameraSketch').CameraSketchOptions
): number {
  let count = 0
  let dur = 0
  editor().update((d) => {
    const res = applyDrawnCameraPath(d as Project, rawPoints, opts)
    count = res.keyframeCount
    dur = res.duration
  })
  editor().setTime(0)
  toast(`✏️ Đã tạo ${count} keyframe camera theo nét vẽ (${dur.toFixed(1)}s)! Bấm Space để xem`)
  return dur
}

