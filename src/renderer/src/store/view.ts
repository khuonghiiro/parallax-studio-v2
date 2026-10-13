import { create } from 'zustand'
import type { EditorViewKind } from '../engine/EditorCamera'
import type { Model3D } from '../ui/assets/models3d/types'

export type PrimaryView = 'camera' | 'editor' | 'topview'
export type TopViewMode = 'top' | 'side'
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
  /** 2.5D Depth Diagram projection mode: Top-down (X-Z) or Side-elevation (Z-Y). */
  topViewMode: TopViewMode
  /** Bounding box and resize handles for active layer selection. */
  showBbox: boolean
  /** 3D Translation Gizmo (XYZ arrows & axes). */
  showTranslate: boolean
  /** 3D Rotation Gizmo (XYZ rotation rings). */
  showRotate: boolean
  /** Layer position and rotation telemetry readout (P 0 / 0 / ... · R 0° / 0° / ...). */
  showReadout: boolean
  /** Whether the left sidebar (Assets / Shots / Library) is expanded. */
  leftPanelOpen: boolean
  /** Whether the right sidebar (Inspector / Layer / Camera properties) is expanded. */
  rightPanelOpen: boolean
}

export interface FocusRequest {
  kind: 'shot' | 'layer' | 'all' | 'selection'
  id?: string
  n: number
}

export interface ViewState extends ViewPrefs {
  focus: FocusRequest | null
  dialog: 'path' | 'sketch' | 'performance' | 'mcp' | 'audio' | null
  audioDialogMode: 'levels' | 'waveform'
  assemblyModalModel: Model3D | null
  audioSelectedCategory: string
  setAudioSelectedCategory(cat: string): void
  aiActive: boolean
  aiLocked: boolean
  aiActionLabel: string | null
  setAiControl(active: boolean, locked?: boolean, label?: string | null): void
  unlockAi(): void
  set(p: Partial<ViewPrefs>): void
  toggleTheme(): void
  toggleLeftPanel(): void
  toggleRightPanel(): void
  setLeftPanelOpen(open: boolean): void
  setRightPanelOpen(open: boolean): void
  openDialog(d: ViewState['dialog']): void
  openAudioDialog(mode?: 'levels' | 'waveform'): void
  openAssemblyWorkshop(model: Model3D): void
  closeAssemblyWorkshop(): void
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
  const d: ViewPrefs = {
    split: false,
    primary: 'camera',
    editorKind: 'custom',
    showPath: true,
    cameraOnly: false,
    theme: 'dark',
    topViewMode: 'top',
    showBbox: true,
    showTranslate: true,
    showRotate: true,
    showReadout: true,
    leftPanelOpen: true,
    rightPanelOpen: true
  }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ViewPrefs>
      const res: ViewPrefs = {
        ...d,
        ...parsed,
        showBbox: typeof parsed.showBbox === 'boolean' ? parsed.showBbox : d.showBbox,
        showTranslate: typeof parsed.showTranslate === 'boolean' ? parsed.showTranslate : d.showTranslate,
        showRotate: typeof parsed.showRotate === 'boolean' ? parsed.showRotate : d.showRotate,
        showReadout: typeof parsed.showReadout === 'boolean' ? parsed.showReadout : d.showReadout,
        leftPanelOpen: typeof parsed.leftPanelOpen === 'boolean' ? parsed.leftPanelOpen : d.leftPanelOpen,
        rightPanelOpen: typeof parsed.rightPanelOpen === 'boolean' ? parsed.rightPanelOpen : d.rightPanelOpen
      }
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
  audioDialogMode: 'waveform',
  assemblyModalModel: null,
  audioSelectedCategory: 'all',
  setAudioSelectedCategory(cat) {
    set({ audioSelectedCategory: cat })
  },
  aiActive: false,
  aiLocked: false,
  aiActionLabel: null,
  setAiControl(active, locked = false, label = null) {
    set({ aiActive: active, aiLocked: locked, aiActionLabel: label })
  },
  unlockAi() {
    set({ aiActive: false, aiLocked: false, aiActionLabel: null })
  },
  openDialog(dialog) {
    set({ dialog })
  },
  openAudioDialog(mode = 'waveform') {
    set({ dialog: 'audio', audioDialogMode: mode })
  },
  openAssemblyWorkshop(model) {
    set({ assemblyModalModel: model })
  },
  closeAssemblyWorkshop() {
    set({ assemblyModalModel: null })
  },
  toggleTheme() {
    const next: Theme = get().theme === 'light' ? 'dark' : 'light'
    get().set({ theme: next })
  },
  toggleLeftPanel() {
    get().set({ leftPanelOpen: !get().leftPanelOpen })
  },
  toggleRightPanel() {
    get().set({ rightPanelOpen: !get().rightPanelOpen })
  },
  setLeftPanelOpen(open) {
    get().set({ leftPanelOpen: open })
  },
  setRightPanelOpen(open) {
    get().set({ rightPanelOpen: open })
  },
  set(p) {
    if (p.theme) applyTheme(p.theme)
    set(p)
    const {
      split,
      primary,
      editorKind,
      showPath,
      cameraOnly,
      theme,
      topViewMode,
      showBbox,
      showTranslate,
      showRotate,
      showReadout,
      leftPanelOpen,
      rightPanelOpen
    } = get()
    localStorage.setItem(
      KEY,
      JSON.stringify({
        split,
        primary,
        editorKind,
        showPath,
        cameraOnly,
        theme,
        topViewMode,
        showBbox,
        showTranslate,
        showRotate,
        showReadout,
        leftPanelOpen,
        rightPanelOpen
      })
    )
  },
  requestFocus(kind, id) {
    const s = get()
    if (!s.split && s.primary === 'camera') s.set({ primary: 'editor' })
    set({ focus: { kind, id, n: (s.focus?.n ?? 0) + 1 } })
  }
}))
