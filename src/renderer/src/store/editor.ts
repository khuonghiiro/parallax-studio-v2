import { create } from 'zustand'
import { produce, type Draft } from 'immer'
import type { Animatable, AnimValue, CameraSettings, Layer, Project, Transform } from '@shared/types'
import { createProject } from '../project/factory'

export type LayerProp = keyof Transform
export type CameraProp = 'position' | 'target' | 'fov' | 'focusDistance' | 'aperture'

export type PropRef =
  | { kind: 'layer'; layerId: string; prop: LayerProp }
  | { kind: 'camera'; prop: CameraProp }

export interface KeySelection {
  ref: PropRef
  keyId: string
}

export function getAnimatable(project: Project, ref: PropRef): Animatable<AnimValue> | undefined {
  if (ref.kind === 'camera') return project.camera[ref.prop] as Animatable<AnimValue>
  const layer = project.layers.find((l) => l.id === ref.layerId)
  return layer?.transform[ref.prop] as Animatable<AnimValue> | undefined
}

export function getDraftAnimatable(
  project: Draft<Project>,
  ref: PropRef
): Draft<Animatable<AnimValue>> | undefined {
  return getAnimatable(project as Project, ref) as Draft<Animatable<AnimValue>> | undefined
}

const HISTORY_LIMIT = 200
const MERGE_WINDOW_MS = 800

interface EditorState {
  project: Project
  filePath: string | null
  dirty: boolean
  time: number
  playing: boolean
  loop: boolean
  selectedLayerId: string | null
  selectedKey: KeySelection | null
  inspectorTab: 'layer' | 'camera' | 'scene'
  past: Project[]
  future: Project[]
  lastMerge: { key: string; at: number } | null

  /** Apply an undoable change. Changes sharing `mergeKey` within a short window collapse into one undo step. */
  update(fn: (draft: Draft<Project>) => void, mergeKey?: string): void
  undo(): void
  redo(): void
  setTime(t: number): void
  setPlaying(p: boolean): void
  setLoop(l: boolean): void
  selectLayer(id: string | null): void
  selectKey(k: KeySelection | null): void
  setInspectorTab(tab: EditorState['inspectorTab']): void
  loadProject(p: Project, filePath: string | null): void
  markSaved(path: string): void
}

export const useEditor = create<EditorState>((set, get) => ({
  project: createProject(),
  filePath: null,
  dirty: false,
  time: 0,
  playing: false,
  loop: true,
  selectedLayerId: null,
  selectedKey: null,
  inspectorTab: 'scene',
  past: [],
  future: [],
  lastMerge: null,

  update(fn, mergeKey) {
    const { project, past, lastMerge } = get()
    const next = produce(project, fn)
    if (next === project) return
    const now = performance.now()
    const merge = !!mergeKey && !!lastMerge && lastMerge.key === mergeKey && now - lastMerge.at < MERGE_WINDOW_MS
    set({
      project: next,
      past: merge ? past : [...past.slice(-HISTORY_LIMIT + 1), project],
      future: [],
      dirty: true,
      lastMerge: mergeKey ? { key: mergeKey, at: now } : null
    })
  },

  undo() {
    const { past, future, project } = get()
    if (past.length === 0) return
    const prev = past[past.length - 1]
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future], dirty: true, lastMerge: null })
    get().selectLayer(prev.layers.some((l) => l.id === get().selectedLayerId) ? get().selectedLayerId : null)
  },

  redo() {
    const { past, future, project } = get()
    if (future.length === 0) return
    const next = future[0]
    set({ project: next, past: [...past, project], future: future.slice(1), dirty: true, lastMerge: null })
  },

  setTime(t) {
    const d = get().project.comp.duration
    set({ time: Math.max(0, Math.min(d, t)) })
  },
  setPlaying(p) {
    set({ playing: p })
  },
  setLoop(l) {
    set({ loop: l })
  },
  selectLayer(id) {
    set((s) => ({
      selectedLayerId: id,
      selectedKey: null,
      inspectorTab: id ? 'layer' : s.inspectorTab === 'layer' ? 'scene' : s.inspectorTab
    }))
  },
  selectKey(k) {
    set({ selectedKey: k })
  },
  setInspectorTab(tab) {
    set({ inspectorTab: tab })
  },
  loadProject(p, filePath) {
    set({
      project: p,
      filePath,
      dirty: false,
      time: 0,
      playing: false,
      selectedLayerId: null,
      selectedKey: null,
      past: [],
      future: [],
      lastMerge: null,
      inspectorTab: 'scene'
    })
  },
  markSaved(path) {
    set({ filePath: path, dirty: false })
  }
}))

/** Frame-tolerance for "keyframe at current time" checks. */
export function frameTolerance(project: Project): number {
  return 0.5 / project.comp.fps
}

export function findLayer(project: Project, id: string | null): Layer | undefined {
  return id ? project.layers.find((l) => l.id === id) : undefined
}

export type { CameraSettings }
