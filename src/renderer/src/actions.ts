import type { Project } from '@shared/types'
import { create } from 'zustand'
import { assetStore } from './project/assets'
import { buildDemoProject } from './project/demo'
import {
  createImageLayer,
  createParticleLayer,
  createProject,
  createSolidLayer,
  createTextLayer,
  duplicateLayer
} from './project/factory'
import { deserializeProject, serializeProject } from './project/serialize'
import { useEditor } from './store/editor'

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
    const p = await deserializeProject(res.data)
    editor().loadProject(p, res.path)
    toast('Đã mở dự án')
  } catch (err) {
    window.alert(`Không mở được dự án:\n${String(err)}`)
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

function nextDepthForNewLayer(project: Project): number {
  // Place new images slightly in front of the front-most image layer.
  const zs = project.layers.filter((l) => l.type === 'image').map((l) => l.transform.position.value[2])
  return zs.length ? Math.min(...zs) - 200 : 0
}

async function registerImages(files: { name: string; mime: string; data: Uint8Array }[], addLayers: boolean): Promise<void> {
  for (const f of files) {
    try {
      const asset = await assetStore.add(f.name, f.mime, f.data, 'image')
      editor().update((d) => {
        d.assets.push(asset.meta)
        if (addLayers) {
          const layer = createImageLayer(asset.meta, d.comp as Project['comp'], nextDepthForNewLayer(d as Project))
          d.layers.unshift(layer)
        }
      })
    } catch (err) {
      toast(`Lỗi đọc ảnh ${f.name}: ${String(err)}`)
    }
  }
  if (addLayers && files.length) {
    const first = editor().project.layers[0]
    if (first) editor().selectLayer(first.id)
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
    }
  }
  if (images.length) await registerImages(images, true)
}

export function addLayerFromAsset(assetId: string): void {
  const meta = editor().project.assets.find((a) => a.id === assetId)
  if (!meta || meta.kind !== 'image') return
  const layer = createImageLayer(meta, editor().project.comp, nextDepthForNewLayer(editor().project))
  editor().update((d) => {
    d.layers.unshift(layer)
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
  editor().update((d) => {
    d.layers.unshift(layer)
  })
  editor().selectLayer(layer.id)
}

export function addSolidLayer(): void {
  const layer = createSolidLayer(editor().project.comp)
  editor().update((d) => {
    d.layers.push(layer)
  })
  editor().selectLayer(layer.id)
}

export function addParticleLayer(): void {
  const layer = createParticleLayer(editor().project.comp)
  editor().update((d) => {
    d.layers.unshift(layer)
  })
  editor().selectLayer(layer.id)
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

export function moveLayer(id: string, dir: -1 | 1): void {
  editor().update((d) => {
    const i = d.layers.findIndex((l) => l.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= d.layers.length) return
    const [l] = d.layers.splice(i, 1)
    d.layers.splice(j, 0, l)
  })
}

export function deleteSelectedKeyframe(): boolean {
  const { selectedKey } = editor()
  if (!selectedKey) return false
  editor().update((d) => {
    const ref = selectedKey.ref
    const a =
      ref.kind === 'camera'
        ? d.camera[ref.prop]
        : d.layers.find((l) => l.id === ref.layerId)?.transform[ref.prop]
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
