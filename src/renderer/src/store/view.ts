import { create } from 'zustand'
import type { EditorViewKind } from '../engine/EditorCamera'

export type PrimaryView = 'camera' | 'editor' | 'topview'
export type Theme = 'dark' | 'light'

interface ViewPrefs {
  /** Two views side by side: camera (left) + 3D editor view (right). */
  split: boolean
  /** Which view fills the viewer when not split. */
  primary: PrimaryView
  editorKind: EditorViewKind
  showPath: boolean
  /** 3D view previews streaming: only content the active camera loads is drawn. */
  cameraOnly: boolean
  theme: Theme
}

export interface FocusRequest {
  kind: 'shot' | 'layer' | 'all' | 'selection'
  id?: string
  n: number
}

export interface ViewState extends ViewPrefs {
  focus: FocusRequest | null
  dialog: 'path' | 'sketch' | 'performance' | 'mcp' | null
  set(p: Partial<ViewPrefs>): void
  toggleTheme(): void
  openDialog(d: ViewState['dialog']): void
  /** Frame something in the 3D view (switches to it if hidden). */
  requestFocus(kind: FocusRequest['kind'], id?: string): void
}

const KEY = 'pxs.viewPrefs.v2'

function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme)
    if (theme === 'light') {
      document.documentElement.classList.add('theme-light')
      document.documentElement.classList.remove('theme-dark')
    } else {
      document.documentElement.classList.add('theme-dark')
      document.documentElement.classList.remove('theme-light')
    }
  }
}

function load(): ViewPrefs {
  const d: ViewPrefs = { split: false, primary: 'camera', editorKind: 'custom', showPath: true, cameraOnly: false, theme: 'dark' }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ViewPrefs>
      const res = { ...d, ...parsed }
      applyTheme(res.theme)
      return res
    }
  } catch {
    /* ignore corrupt prefs */
  }
  applyTheme(d.theme)
  return d
}

export const useView = create<ViewState>((set, get) => ({
  ...load(),
  focus: null,
  dialog: null,
  openDialog(dialog) {
    set({ dialog })
  },
  toggleTheme() {
    const next: Theme = get().theme === 'light' ? 'dark' : 'light'
    get().set({ theme: next })
  },
  set(p) {
    if (p.theme) applyTheme(p.theme)
    set(p)
    const { split, primary, editorKind, showPath, cameraOnly, theme } = get()
    localStorage.setItem(KEY, JSON.stringify({ split, primary, editorKind, showPath, cameraOnly, theme }))
  },
  requestFocus(kind, id) {
    const s = get()
    if (!s.split && s.primary === 'camera') s.set({ primary: 'editor' })
    set({ focus: { kind, id, n: (s.focus?.n ?? 0) + 1 } })
  }
}))
