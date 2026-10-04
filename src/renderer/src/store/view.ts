import { create } from 'zustand'
import type { EditorViewKind } from '../engine/EditorCamera'

export type PrimaryView = 'camera' | 'editor'

interface ViewPrefs {
  /** Two views side by side: camera (left) + 3D editor view (right). */
  split: boolean
  /** Which view fills the viewer when not split. */
  primary: PrimaryView
  editorKind: EditorViewKind
  showPath: boolean
  /** 3D view previews streaming: only content the active camera loads is drawn. */
  cameraOnly: boolean
}

export interface FocusRequest {
  kind: 'shot' | 'layer' | 'all' | 'selection'
  id?: string
  n: number
}

interface ViewState extends ViewPrefs {
  focus: FocusRequest | null
  dialog: 'path' | null
  set(p: Partial<ViewPrefs>): void
  openDialog(d: ViewState['dialog']): void
  /** Frame something in the 3D view (switches to it if hidden). */
  requestFocus(kind: FocusRequest['kind'], id?: string): void
}

const KEY = 'pxs.viewPrefs.v2'

function load(): ViewPrefs {
  const d: ViewPrefs = { split: false, primary: 'camera', editorKind: 'custom', showPath: true, cameraOnly: false }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...d, ...(JSON.parse(raw) as Partial<ViewPrefs>) }
  } catch {
    /* ignore corrupt prefs */
  }
  return d
}

export const useView = create<ViewState>((set, get) => ({
  ...load(),
  focus: null,
  dialog: null,
  openDialog(dialog) {
    set({ dialog })
  },
  set(p) {
    set(p)
    const { split, primary, editorKind, showPath, cameraOnly } = get()
    localStorage.setItem(KEY, JSON.stringify({ split, primary, editorKind, showPath, cameraOnly }))
  },
  requestFocus(kind, id) {
    const s = get()
    if (!s.split && s.primary === 'camera') s.set({ primary: 'editor' })
    set({ focus: { kind, id, n: (s.focus?.n ?? 0) + 1 } })
  }
}))
