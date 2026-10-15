import { ParamError, type Handler, type Params } from '../types'
import { bool, num, str } from '../params'
import { setManualAiLock } from '../commands'
import { useView } from '../../store/view'
import {
  getActiveLayerAssemblySession,
  requestCloseLayerAssembly,
  requestOpenLayerAssembly
} from '../../ui/layerAssembly/layerAssemblyBridge'
import type { McpRect } from '@shared/ipc'

/**
 * UI-level commands: let an AI see and drive the real app UI (dialogs, tabs, workshop),
 * not just the rendered scene. Screenshots come from the main process
 * (`webContents.capturePage`), so they match exactly what the user sees.
 */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const nextPaint = (): Promise<void> =>
  new Promise((r) => {
    if (typeof requestAnimationFrame !== 'function') return r()
    let done = false
    const finish = (): void => {
      if (!done) {
        done = true
        r()
      }
    }
    const timer = setTimeout(finish, 60)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        clearTimeout(timer)
        finish()
      })
    )
  })

export interface UiCandidate {
  text: string
  visible: boolean
}

/**
 * Pick the element whose visible text matches `query` (case-insensitive).
 * Exact matches win over partial ones; `index` selects among equal matches.
 * Returns -1 when nothing matches.
 */
export function pickByText(candidates: UiCandidate[], query: string, index = 0): number {
  const q = query.trim().toLowerCase()
  if (!q) return -1
  const norm = candidates.map((c) => c.text.replace(/\s+/g, ' ').trim().toLowerCase())
  const exact: number[] = []
  const partial: number[] = []
  norm.forEach((t, i) => {
    if (!candidates[i].visible) return
    if (t === q) exact.push(i)
    else if (t.includes(q)) partial.push(i)
  })
  const pool = exact.length > 0 ? exact : partial
  return pool[Math.max(0, Math.min(pool.length - 1, index))] ?? -1
}

const CLICKABLE = 'button, [role="button"], [role="tab"], [role="menuitem"], a, summary, label, .c3d-card'

export function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
}

function findTarget(p: Params): HTMLElement {
  const selector = str(p, 'selector')
  const text = str(p, 'text')
  const index = Math.max(0, Math.round(num(p, 'index') ?? 0))
  if (!selector && !text) throw new ParamError('Provide "selector" or "text"')
  if (selector && !text) {
    const all = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(isVisible)
    if (!all[index]) throw new Error(`No visible element matches selector "${selector}"`)
    return all[index]
  }
  const scope = selector ? Array.from(document.querySelectorAll<HTMLElement>(selector)) : null
  const pool = scope ?? Array.from(document.querySelectorAll<HTMLElement>(CLICKABLE))
  const candidates = pool.map((el) => ({
    text: el.innerText || el.getAttribute('aria-label') || el.title || '',
    visible: isVisible(el)
  }))
  const i = pickByText(candidates, text!, index)
  if (i < 0) throw new Error(`No visible clickable element with text "${text}"`)
  return pool[i]
}

export const UI_REGION_SELECTORS: Record<string, string[]> = {
  // Left Sidebar and sub-sections
  left_panel: ['aside.left', '.left', '.panel-left'],
  assets: ['.asset-panel-wrapper', '.asset-main-layout', 'aside.left'],
  asset_grid: [
    '.builtin-grid-wrap',
    '.builtin-asset-grid',
    '.project-asset-grid',
    '.music-list-scroll',
    '.model3d-grid-wrap',
    '.lw-template-grid'
  ],
  asset_bar: ['.asset-vertical-strip', '.builtin-asset-bar', '.music-category-bar', '.model3d-category-bar', '.lw-category-bar'],
  music: ['.music-panel-layout', '.music-panel-container', '.music-panel-main'],
  shots: ['.shots', '.shots-panel', 'aside.left .panel-body'],
  topview: ['.topview', '.topview-canvas-wrap', '.top-view', '#viewport-topview', '.topview-toolbar'],

  // Center Viewer and sub-sections
  viewer: ['.viewer-wrap', '.viewer', '#viewport-container'],
  viewer_canvas: ['#viewer-canvas', '.viewer canvas'],
  viewport: ['#viewer-canvas', '.viewer canvas'],
  camera_frame: ['#camera-frame', '.camera-frame'],
  viewer_hud: ['.viewer-hud'],
  viewer_tools: ['.viewer-tools'],

  // Right Inspector and sub-sections
  inspector: ['aside.right', '.right', '.inspector'],
  inspector_tabs: ['aside.right .tabs'],
  inspector_body: ['aside.right .panel-body'],
  effect_stack: ['.layer-effects-section'],
  effect_editor: ['.effect-editor'],
  timeline_effects: ['.timeline-effect-row'],
  fx_presets: ['.tl-fx-popover'],
  motion: ['.motion-controls'],
  motion_preview: ['.motion-preview'],
  motion_parameters: ['.motion-parameters'],
  motion_timing: ['.motion-timing'],

  // Bottom Timeline and sub-sections
  timeline: ['section.panel.timeline', 'section.timeline', '.timeline'],
  timeline_toolbar: ['.timeline-toolbar', '.tl-toolbar'],
  timeline_ruler: ['.tl-header', '.tl-ruler-wrap'],
  timeline_tracks: ['.tl-scroll', '.tl-body', '.tl-rows-scroll'],

  // Top Toolbar & Responsive Workspace Dock
  toolbar: ['header.toolbar', '.toolbar'],
  studio_menu: ['#menu-studio', '.toolbar'],
  mcp_chip: ['#mcp-chip', '.mcp-chip'],
  responsive_dock: ['#responsive-dock', '.responsive-dock'],

  // Floating Modals & Workshops (Never include full-screen backdrop/overlay here)
  dialog: [
    '.tpm-modal',
    '.layer-workshop-dialog',
    '.lat-dialog',
    '.assembly-modal-content',
    '.audio-studio-modal',
    '.audio-studio-dialog',
    '.export-modal',
    '.perf-modal',
    '.mcp-modal',
    '.camera-path-modal',
    '.camera-sketch-modal',
    '.modal[role="dialog"]',
    '.modal',
    '[role="dialog"]'
  ],

  // 1. Xưởng 3D (Assembly 3D Workshop) - Toàn bộ & Từng cột
  assembly_3d: ['.assembly-modal-content'],
  assembly_sidebar: ['.assembly-asset-sidebar', '.assembly-modal-body > aside'],
  assembly_viewport: ['.assembly-viewport-panel', '.assembly-split-container'],
  assembly_inspector: ['.assembly-inspector-panel'],
  assembly_header: ['.assembly-modal-header'],
  assembly_footer: ['.assembly-modal-footer'],
  assembly_hud: ['.assembly-3d-hud-container'],

  // 2. Xưởng Layer 2.5D (Layer Assembly Workshop) - Toàn bộ & Từng cột
  layer_assembly: ['.tpm-modal', '.layer-workshop-dialog', '.lat-dialog'],
  layer_assembly_sidebar: ['.layer-workshop-sidebar'],
  layer_assembly_workspace: ['.lw-workspace-column'],
  layer_assembly_inspector: ['.lw-right-panel'],
  layer_assembly_tools: ['.workshop-tools'],
  layer_assembly_header: ['.workshop-header'],
  layer_assembly_cutter: ['.layer-cutter-split-container'],
  layer_assembly_source: ['.layer-cutter-pane.left-pane'],
  layer_assembly_target: ['.layer-cutter-target-container'],
  layer_assembly_motion_sketch: ['.lw-motion-sketch-card', '.lw-motion-sketch-overlay'],
  layer_assembly_anim_tools: ['.lw-anim-chips', '.lw-anim-assist-card', '.lw-secondary-card'],
  layer_assembly_plant_motion: ['.lw-plant-motion', '.lw-plant-motion-chips'],

  // 3. Audio Studio (Phòng thu Âm thanh) - Toàn bộ & Từng cột
  audio_studio: ['.audio-studio-modal', '.audio-studio-dialog'],
  audio_studio_sidebar: ['.audio-track-list', '.audio-studio-track-list'],
  audio_studio_editor: ['.audio-track-editor'],
  audio_studio_waveform: ['.audio-waveform-panel'],
  audio_studio_tone: ['.audio-tone-panel'],
  audio_studio_mixer: ['.audio-levels-panel'],
  audio_studio_console: ['.audio-multitrack-console', '.audio-levels-panel'],

  // 4. Hộp thoại Hiệu năng (Performance Dialog) - Khối chi tiết
  perf_dialog: ['.perf-modal', '.modal:has(.hw-grid)'],
  perf_hardware: ['.hw-grid'],
  perf_meter: ['.perf-meter'],
  perf_settings: ['.perf-auto-box', '.perf-preset-grid'],

  // 5. Hộp thoại Xuất video (Export Dialog) - Khối chi tiết
  export: ['.export-modal', '.modal:has(#export-start)', '.modal[aria-labelledby="export-title"]'],
  export_dialog: ['.export-modal', '.modal:has(#export-start)', '.modal[aria-labelledby="export-title"]'],
  export_preview: ['.export-preview'],

  // 6. Hộp thoại Vẽ đường bay Camera (Camera Sketch Dialog) - Khối chi tiết
  camera_sketch: ['.camera-sketch-modal'],
  camera_sketch_canvas: ['.camera-sketch-canvas'],
  camera_sketch_sidebar: ['.camera-sketch-sidebar'],
  camera_sketch_waypoints: ['.camera-sketch-shot-pills', '.camera-sketch-modal'],

  // 7. Hộp thoại Lộ trình Camera (Camera Path Dialog) - Khối chi tiết
  camera_path: ['.camera-path-modal', '.modal[aria-labelledby="path-title"]'],
  camera_path_presets: ['.path-preset-bar', '.camera-path-modal'],
  camera_path_steps: ['.path-steps'],

  // 8. Hộp thoại MCP (MCP & AI Guide Dialog) - Khối chi tiết
  mcp_dialog: ['.mcp-modal', '.modal:has(#mcp-chip)'],
  mcp_status: ['.mcp-status-card'],
  mcp_config: ['.mcp-ide-config'],
  mcp_guide: ['.mcp-ai-guide-card'],

  // AI Neon HUD
  ai_hud: ['.ai-neon-hud-badge']
}

export function resolveTargetElement(region?: string, selector?: string): HTMLElement | null {
  if (selector) {
    try {
      const el = document.querySelector<HTMLElement>(selector)
      if (el && isVisible(el)) return el
    } catch {
      /* invalid selector */
    }
  }
  if (region && region !== 'window') {
    const candidates = UI_REGION_SELECTORS[region] || [`.${region}`, `#${region}`]
    for (const sel of candidates) {
      try {
        const el = document.querySelector<HTMLElement>(sel)
        if (el && isVisible(el)) return el
      } catch {
        /* continue */
      }
    }
  }
  return null
}

async function cropImageBase64(
  base64: string,
  mime: string,
  rect: McpRect,
  format: 'png' | 'jpeg',
  targetWidth?: number
): Promise<{ data: string; mime: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const winW = window.innerWidth || 1
        const winH = window.innerHeight || 1
        const scaleX = img.naturalWidth / winW
        const scaleY = img.naturalHeight / winH
        const sx = Math.max(0, Math.floor(rect.x * scaleX))
        const sy = Math.max(0, Math.floor(rect.y * scaleY))
        const sw = Math.min(img.naturalWidth - sx, Math.ceil(rect.width * scaleX))
        const sh = Math.min(img.naturalHeight - sy, Math.ceil(rect.height * scaleY))
        if (sw <= 0 || sh <= 0) return resolve(null)
        const outW = targetWidth && targetWidth > 0 && targetWidth < sw ? Math.round(targetWidth) : sw
        const outH = outW < sw ? Math.max(1, Math.round((sh * outW) / sw)) : sh
        canvas.width = outW
        canvas.height = outH
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)
        const targetMime = format === 'jpeg' ? 'image/jpeg' : 'image/png'
        const dataUrl = canvas.toDataURL(targetMime, 0.9)
        const data = dataUrl.split(',')[1] || ''
        resolve({ data, mime: targetMime, width: outW, height: outH })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = `data:${mime};base64,${base64}`
  })
}

export const uiCommands: Record<string, Handler> = {
  get_app_screenshot: async (p) => {
    const capture = window.api?.mcp?.captureWindow
    if (!capture) throw new Error('Window capture is not available in this build')

    const root = typeof document !== 'undefined' ? document.documentElement : null
    root?.classList.add('ai-screenshot-hide-neon')

    try {
      await sleep(Math.max(0, Math.min(5000, num(p, 'delay_ms') ?? 150)))
      // Đánh thức compositor ngầm của Chromium khi cửa sổ bị che khuất để commit frame DOM/WebGL mới nhất
      await capture({ width: 64, format: 'jpeg' }).catch(() => undefined)
      await nextPaint()
      const width = num(p, 'width')
      const format = str(p, 'format') === 'jpeg' ? 'jpeg' : 'png'
      const region = str(p, 'region')
      const selector = str(p, 'selector')
      const padding = Math.max(0, Math.min(200, num(p, 'padding') ?? 8))

      const targetEl = resolveTargetElement(region, selector)
      let rect: McpRect | undefined
      if (targetEl) {
        const b = targetEl.getBoundingClientRect()
        const winW = typeof window !== 'undefined' ? window.innerWidth : 1920
        const winH = typeof window !== 'undefined' ? window.innerHeight : 1080
        if (b.width > 0 && b.height > 0 && b.right > 0 && b.bottom > 0 && b.left < winW && b.top < winH) {
          const x = Math.max(0, Math.floor(b.left - padding))
          const y = Math.max(0, Math.floor(b.top - padding))
          const right = Math.min(winW, Math.ceil(b.right + padding))
          const bottom = Math.min(winH, Math.ceil(b.bottom + padding))
          const w = Math.max(1, right - x)
          const h = Math.max(1, bottom - y)
          if (w > 5 && h > 5) {
            rect = { x, y, width: w, height: h }
          }
        }
      }

      // Chụp toàn bộ khung hình trước (không truyền rect trực tiếp vào capturePage của Chromium)
      // để buộc GPU compositor kết xuất frame mới nhất khi cửa sổ đang nằm ở nền, sau đó crop vùng chọn.
      const res = await capture({ width: rect ? undefined : (width ?? undefined), format })

      if (rect && typeof document !== 'undefined') {
        const cropped = await cropImageBase64(res.data, res.mime, rect, format, width ?? undefined)
        if (cropped) {
          return {
            ...cropped,
            target: 'region',
            region: region ?? undefined,
            selector: selector ?? undefined,
            rect
          }
        }
      }

      return {
        ...res,
        target: rect ? 'region' : 'app-window',
        region: region ?? undefined,
        selector: selector ?? undefined,
        rect
      }
    } finally {
      root?.classList.remove('ai-screenshot-hide-neon')
    }
  },

  set_ai_lock: async (p) => {
    const locked = bool(p, 'locked') ?? true
    const reason = str(p, 'reason') ?? undefined
    const timeoutMs = num(p, 'timeout_ms') ?? 10000
    setManualAiLock(locked, reason, timeoutMs)
    return {
      ok: true,
      locked,
      reason: reason || (locked ? 'AI đang khoá UI để thao tác' : 'Đã mở khoá UI'),
      timeout_ms: locked ? timeoutMs : undefined
    }
  },

  ui_click: async (p) => {
    const el = findTarget(p)
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    el.click()
    await nextPaint()
    return { clicked: el.tagName.toLowerCase(), text: (el.innerText || el.title || '').trim().slice(0, 120) }
  },

  ui_type: async (p) => {
    const el = findTarget({ ...p, text: undefined }) as HTMLInputElement
    if (!('value' in el)) throw new Error('Target is not an input/textarea')
    const value = str(p, 'value') ?? ''
    const proto = Object.getPrototypeOf(el) as object
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    setter ? setter.call(el, value) : (el.value = value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    await nextPaint()
    return { ok: true, value }
  },

  get_ui_state: () => {
    const v = useView.getState()
    const lwSession = getActiveLayerAssemblySession()
    return {
      theme: v.theme,
      dialog: v.dialog,
      audio_dialog_mode: v.audioDialogMode,
      left_tab: v.leftTab,
      mobile_tab: v.mobileTab,
      tablet_tab: v.tabletTab,
      primary_view: v.primary,
      split_view: v.split,
      top_view_mode: v.topViewMode,
      camera_only: v.cameraOnly,
      show_path: v.showPath,
      assembly_workshop_open: !!v.assemblyModalModel,
      layer_assembly_open: !!lwSession,
      ai_active: v.aiActive,
      ai_locked: v.aiLocked
    }
  },

  set_ui_dialog: async (p) => {
    const v = useView.getState()
    const dialog = str(p, 'dialog')
    const audioMode = str(p, 'audio_mode')
    const leftTab = str(p, 'left_tab')
    const inspectorTab = str(p, 'inspector_tab')
    const mobileTab = str(p, 'mobile_tab')
    const theme = str(p, 'theme')

    if (theme === 'dark' || theme === 'light') {
      v.set({ theme })
    }

    if (leftTab === 'shots' || leftTab === 'assets' || leftTab === 'topview') {
      v.setLeftTab(leftTab)
      useView.setState({ mobileTab: 'left', tabletTab: 'left' })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pxs:responsive-tab', { detail: { mobileTab: 'left', tabletTab: 'left' } }))
      }
    }

    if (inspectorTab === 'scene' || inspectorTab === 'layer' || inspectorTab === 'camera') {
      const { useEditor } = await import('../../store/editor')
      useEditor.getState().setInspectorTab(inspectorTab)
      useView.setState({ mobileTab: 'right', tabletTab: 'right' })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pxs:responsive-tab', { detail: { mobileTab: 'right', tabletTab: 'right' } }))
      }
    }

    if (mobileTab === 'timeline' || mobileTab === 'left' || mobileTab === 'right') {
      useView.setState({
        mobileTab,
        ...(mobileTab === 'left' || mobileTab === 'right' ? { tabletTab: mobileTab } : {})
      })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pxs:responsive-tab', {
            detail: { mobileTab, ...(mobileTab === 'left' || mobileTab === 'right' ? { tabletTab: mobileTab } : {}) }
          })
        )
      }
    }

    if (dialog !== undefined) {
      if (dialog === 'none' || dialog === 'close' || dialog === '') {
        v.openDialog(null)
        if (v.assemblyModalModel) v.closeAssemblyWorkshop()
        requestCloseLayerAssembly()
      } else if (dialog === 'audio') {
        const mode =
          audioMode === 'levels' || audioMode === 'mixer' || audioMode === 'waveform'
            ? audioMode
            : v.audioDialogMode
        v.openAudioDialog(mode)
      } else if (
        dialog === 'path' ||
        dialog === 'sketch' ||
        dialog === 'performance' ||
        dialog === 'mcp' ||
        dialog === 'export'
      ) {
        v.openDialog(dialog)
      } else if (dialog === 'layer_assembly' || dialog === 'layer_assembly_create') {
        requestOpenLayerAssembly(str(p, 'composite_id') ?? undefined)
      } else {
        throw new ParamError(
          `Invalid dialog "${dialog}". Expected none, path, sketch, performance, mcp, audio, export, layer_assembly, or layer_assembly_create.`
        )
      }
    } else if (audioMode === 'levels' || audioMode === 'mixer' || audioMode === 'waveform') {
      v.openAudioDialog(audioMode)
    }

    await nextPaint()
    const s = useView.getState()
    return {
      ok: true,
      theme: s.theme,
      dialog: s.dialog,
      audio_dialog_mode: s.audioDialogMode,
      left_tab: s.leftTab,
      mobile_tab: s.mobileTab,
      tablet_tab: s.tabletTab,
      assembly_workshop_open: !!s.assemblyModalModel,
      layer_assembly_open: !!getActiveLayerAssemblySession()
    }
  }
}
