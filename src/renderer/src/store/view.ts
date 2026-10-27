import { create } from 'zustand'
import type { EditorViewKind } from '../engine/EditorCamera'
import type { Model3D } from '../ui/assets/models3d/types'
import { useEditor } from './editor'

export type PrimaryView = 'camera' | 'editor' | 'topview' | 'animate2d'
export type TopViewMode = 'top' | 'side'
export type Theme = 'dark' | 'light'
export type LeftTab = 'shots' | 'assets' | 'topview'
export type TimelineMainTab = 'timeline' | 'workflow'
export type MobileWorkspaceTab = 'timeline' | 'left' | 'right'
export type TabletSideTab = 'left' | 'right'
export type DialogKind = 'path' | 'sketch' | 'performance' | 'mcp' | 'audio' | 'export' | null

interface ViewPrefs {
  activeViews?: PrimaryView[]
  /** Two views side by side: camera (left) + 3D editor view (right). */
  split: boolean
  /** Which view fills the viewer when not split. */
  primary: PrimaryView
  /** In animate2d mode: true = 2D & 3D (Col 1: Row 1 Camera + Row 2 3D, Col 2: 2D Scene Stage), false = 2D Stage only. */
  animate2dSplit: boolean
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
}

export interface FocusRequest {
  kind: 'shot' | 'layer' | 'all' | 'selection'
  id?: string
  n: number
}

export interface ViewState extends ViewPrefs {
  focus: FocusRequest | null
  dialog: DialogKind
  audioDialogMode: 'levels' | 'waveform' | 'mixer'
  assemblyModalModel: Model3D | null
  leftTab: LeftTab
  setLeftTab(tab: LeftTab): void
  timelineTab: TimelineMainTab
  setTimelineTab(tab: TimelineMainTab): void
  mobileTab: MobileWorkspaceTab
  setMobileTab(tab: MobileWorkspaceTab): void
  tabletTab: TabletSideTab
  setTabletTab(tab: TabletSideTab): void
  audioSelectedCategory: string
  setAudioSelectedCategory(cat: string): void
  aiActive: boolean
  aiLocked: boolean
  aiActionLabel: string | null
  setAiControl(active: boolean, locked?: boolean, label?: string | null): void
  unlockAi(): void
  set(p: Partial<ViewPrefs>): void
  toggleTheme(): void
  openDialog(d: DialogKind): void
  openAudioDialog(mode?: 'levels' | 'waveform' | 'mixer'): void
  openAssemblyWorkshop(model: Model3D): void
  closeAssemblyWorkshop(): void
  /** Frame something without changing the user-selected visible views. */
  requestFocus(kind: FocusRequest['kind'], id?: string): void
}

const KEY = 'pxs.viewPrefs.v2'
const LEFT_TAB_KEY = 'pxs.leftTab'

function loadLeftTab(): LeftTab {
  try {
    const raw = localStorage.getItem(LEFT_TAB_KEY)
    if (raw === 'shots' || raw === 'assets' || raw === 'topview') return raw
  } catch {
    /* ignore */
  }
  return 'shots'
}

function closeLayerAssemblyOverlay(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('layerAssembly:close'))
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-theme', theme)
    document.body?.setAttribute('data-theme', theme)
    if (document.documentElement.classList) {
      if (theme === 'light') {
        document.documentElement.classList.add('theme-light')
        document.documentElement.classList.remove('theme-dark')
      } else {
        document.documentElement.classList.add('theme-dark')
        document.documentElement.classList.remove('theme-light')
      }
    }
  }
}

function load(): ViewPrefs {
  const d: ViewPrefs = {
    split: false,
    primary: 'camera',
    animate2dSplit: true,
    editorKind: 'custom',
    showPath: true,
    cameraOnly: false,
    theme: 'dark',
    topViewMode: 'top',
    showBbox: true,
    showTranslate: true,
    showRotate: true,
    showReadout: true
  }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ViewPrefs>
      const res: ViewPrefs = {
        ...d,
        ...parsed,
        animate2dSplit: typeof parsed.animate2dSplit === 'boolean' ? parsed.animate2dSplit : d.animate2dSplit,
        showBbox: typeof parsed.showBbox === 'boolean' ? parsed.showBbox : d.showBbox,
        showTranslate: typeof parsed.showTranslate === 'boolean' ? parsed.showTranslate : d.showTranslate,
        showRotate: typeof parsed.showRotate === 'boolean' ? parsed.showRotate : d.showRotate,
        showReadout: typeof parsed.showReadout === 'boolean' ? parsed.showReadout : d.showReadout
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
  leftTab: loadLeftTab(),
  setLeftTab(leftTab) {
    set({ leftTab, tabletTab: 'left', mobileTab: 'left' })
    try {
      localStorage.setItem(LEFT_TAB_KEY, leftTab)
    } catch {
      /* ignore */
    }
  },
  timelineTab: 'timeline',
  setTimelineTab(timelineTab) {
    set({ timelineTab, mobileTab: 'timeline' })
  },
  mobileTab: 'timeline',
  setMobileTab(mobileTab) {
    set({ mobileTab })
    if (mobileTab === 'left' || mobileTab === 'right') {
      set({ tabletTab: mobileTab })
    }
  },
  tabletTab: 'left',
  setTabletTab(tabletTab) {
    set({ tabletTab })
  },
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
    if (dialog !== null) {
      useEditor.getState().setPlaying(false)
      closeLayerAssemblyOverlay()
      set({ dialog, assemblyModalModel: null })
    } else {
      set({ dialog: null })
    }
  },
  openAudioDialog(mode = 'waveform') {
    useEditor.getState().setPlaying(false)
    closeLayerAssemblyOverlay()
    set({ dialog: 'audio', audioDialogMode: mode, assemblyModalModel: null })
  },
  openAssemblyWorkshop(model) {
    useEditor.getState().setPlaying(false)
    closeLayerAssemblyOverlay()
    set({ assemblyModalModel: model, dialog: null })
  },
  closeAssemblyWorkshop() {
    set({ assemblyModalModel: null })
  },
  toggleTheme() {
    const next: Theme = get().theme === 'light' ? 'dark' : 'light'
    get().set({ theme: next })
  },
  set(p) {
    if (p.theme) applyTheme(p.theme)
    if (!p.activeViews && (p.primary !== undefined || p.split !== undefined || p.animate2dSplit !== undefined)) {
      const next = { ...get(), ...p }
      p = { ...p, activeViews: next.primary === 'animate2d'
        ? (next.animate2dSplit ? ['camera', 'editor', 'animate2d'] : ['animate2d'])
        : next.split ? ['camera', 'editor'] : [next.primary] }
    }
    set(p)
    const {
      activeViews,
      split,
      primary,
      animate2dSplit,
      editorKind,
      showPath,
      cameraOnly,
      theme,
      topViewMode,
      showBbox,
      showTranslate,
      showRotate,
      showReadout
    } = get()
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          activeViews,
          split,
          primary,
          animate2dSplit,
          editorKind,
          showPath,
          cameraOnly,
          theme,
          topViewMode,
          showBbox,
          showTranslate,
          showRotate,
          showReadout
        })
      )
    } catch {
      /* ignore */
    }
  },
  requestFocus(kind, id) {
    const s = get()
    set({ focus: { kind, id, n: (s.focus?.n ?? 0) + 1 } })
  }
}))
