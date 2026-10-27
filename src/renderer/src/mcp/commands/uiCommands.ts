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
import { describeElement, isVisible, resolveTargetElement } from '../uiRegions'
export { UI_REGION_SELECTORS, findActiveDialog, isVisible, resolveTargetElement } from '../uiRegions'

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
  title?: string
  ariaLabel?: string
  placeholder?: string
  region?: string
  visible: boolean
}

export function normalizeUiText(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/\u2026/g, '...')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, ' ')
    .replace(/[·•|/\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export const UI_TEXT_SYNONYMS: Record<string, string[]> = {
  // Studio Mixamo & Tạo xương
  'studio mixamo': ['mở studio', 'mở studio mixamo', 'studio mixamo 2.5d', 'mixamo', 'gắn điểm mixamo', 'khung xương mixamo'],
  'mở studio': ['studio mixamo', 'mở studio mixamo'],
  'mở studio mixamo': ['studio mixamo', 'mở studio'],
  'đóng studio mixamo': ['đóng', 'x', 'huỷ', 'close'],
  'gắn điểm mixamo': ['gắn xương mixamo', 'tạo xương mixamo', 'khung xương mixamo', 'gắn điểm'],
  'gắn xương & áp động tác': ['áp động tác', 'gắn xương', 'áp dụng động tác', 'gắn xương và áp động tác'],
  'gắn xương + nạp 7 động tác': ['nạp 7 động tác', 'gắn xương và nạp 7 động tác', 'nạp 7 động tác mẫu'],
  'chỉ thêm động tác': ['thêm động tác', 'tạo clip mới', 'thêm clip'],
  'tự khớp': ['tự khớp nhân vật', 'tự căn chỉnh', 'khớp nhân vật', 'auto fit'],
  'tự khớp nhân vật': ['tự khớp', 'tự căn chỉnh', 'khớp nhân vật'],
  'đối xứng': ['đối xứng hai bên', 'symmetry'],
  'nối xương': ['hiện xương', 'đường nối xương'],
  'sơ đồ mẫu': ['sơ đồ 7 nhóm khớp', 'hình mẫu'],

  // Bộ phận & Khe biến thể
  'thay thế': ['thay thế...', 'thay thế…', 'thay ảnh tại chỗ', 'đổi ảnh', 'đổi ảnh bộ phận…'],
  'thay thế...': ['thay thế', 'thay thế…', 'đổi ảnh bộ phận…'],
  'thay thế…': ['thay thế', 'thay thế...', 'đổi ảnh bộ phận…'],
  'tự nhận diện': ['tự phân nhóm', 'tự nhận diện bộ phận', 'nhận diện tự động', 'phân nhóm tự động'],
  'tự phân nhóm': ['tự nhận diện', 'tự nhận diện bộ phận', 'nhận diện tự động', 'phân nhóm tự động'],
  'thêm biến thể': ['+ thêm', 'thêm', 'thêm làm biến thể mới'],
  '+ thêm': ['thêm biến thể', 'thêm', 'thêm làm biến thể mới'],
  'liên kết': ['khoá liên kết', 'liên kết bộ phận', 'đang liên kết'],
  'bộ phận': ['nhóm bộ phận', 'bộ phận & biến thể', 'bộ phận & thay thế'],

  // Xưởng & Tab
  'tạo xương': ['bones', 'khung xương', 'xương'],
  'animation': ['hoạt ảnh', 'chuyển động', 'diễn hoạt'],
  'motion': ['plant', 'cây cối', 'uốn thân cây', 'khớp uốn'],
  'xếp lớp': ['layers', 'danh sách layer', 'lớp'],
  'tạo lắp ráp': ['mở xưởng', 'xưởng lắp ráp', 'tạo mới lắp ráp'],
  'workflow': ['quy trình', 'tab workflow', 'luồng tạo video', 'sơ đồ workflow'],
  'áp dụng workflow': ['chạy workflow', 'thực thi workflow', 'apply workflow'],
  'qr': ['quét mã qr', 'remote', 'điều khiển điện thoại', 'mobile remote'],
  'remote': ['quét mã qr', 'qr', 'điều khiển điện thoại', 'mobile remote']
}

export function pickByText(candidates: UiCandidate[], query: string, index = 0): number {
  const cleanQ = normalizeUiText(query)
  if (!cleanQ) return -1

  const synonyms = UI_TEXT_SYNONYMS[cleanQ] ?? []
  const queries = [cleanQ, ...synonyms.map(normalizeUiText).filter(Boolean)]

  const exact: number[] = []
  const affix: number[] = []
  const partial: number[] = []

  candidates.forEach((c, i) => {
    if (!c.visible) return

    const labels = [
      c.text,
      c.ariaLabel,
      c.title,
      c.placeholder,
      c.region
    ]
      .filter((v): v is string => Boolean(v))
      .map(normalizeUiText)
      .filter(Boolean)

    if (!labels.length) return

    let matchedExact = false
    let matchedAffix = false
    let matchedPartial = false

    for (const q of queries) {
      for (const lbl of labels) {
        if (lbl === q) {
          matchedExact = true
          break
        }
        if (lbl.startsWith(q) || lbl.endsWith(q) || q.startsWith(lbl) || q.endsWith(lbl)) {
          matchedAffix = true
        } else if (lbl.includes(q) || q.includes(lbl)) {
          matchedPartial = true
        }
      }
      if (matchedExact) break
    }

    if (matchedExact) exact.push(i)
    else if (matchedAffix) affix.push(i)
    else if (matchedPartial) partial.push(i)
  })

  const pool = exact.length > 0 ? exact : affix.length > 0 ? affix : partial
  return pool[Math.max(0, Math.min(pool.length - 1, index))] ?? -1
}

const CLICKABLE = 'button, [role="button"], [role="tab"], [role="menuitem"], a, summary, label, .c3d-card, [data-mcp-region]'

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
  const candidates: UiCandidate[] = pool.map((el) => ({
    text: el.innerText || '',
    ariaLabel: el.getAttribute('aria-label') || undefined,
    title: el.getAttribute('title') || undefined,
    placeholder: el.getAttribute('placeholder') || undefined,
    region: el.getAttribute('data-mcp-region') || undefined,
    visible: isVisible(el)
  }))
  const i = pickByText(candidates, text!, index)
  if (i < 0) throw new Error(`No visible clickable element with text "${text}"`)
  return pool[i]
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
      const region = str(p, 'region')
      const selector = str(p, 'selector')
      const targetEl = resolveTargetElement(region, selector)
      if (targetEl) {
        try {
          targetEl.scrollIntoView({ block: 'center', inline: 'nearest' })
        } catch {
          /* ignore scroll errors */
        }
      }

      await sleep(Math.max(0, Math.min(5000, num(p, 'delay_ms') ?? 150)))
      await capture({ width: 64, format: 'jpeg' }).catch(() => undefined)
      await nextPaint()

      const width = num(p, 'width')
      const format = str(p, 'format') === 'jpeg' ? 'jpeg' : 'png'
      const padding = Math.max(0, Math.min(200, num(p, 'padding') ?? 8))

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

      const res = await capture({ width: rect ? undefined : (width ?? undefined), format })

      const matched = targetEl ? describeElement(targetEl) : undefined
      if (rect && typeof document !== 'undefined') {
        const cropped = await cropImageBase64(res.data, res.mime, rect, format, width ?? undefined)
        if (cropped) {
          return {
            ...cropped,
            target: 'region',
            region: region ?? undefined,
            selector: selector ?? undefined,
            matched,
            rect
          }
        }
      }

      return {
        ...res,
        target: rect ? 'region' : 'app-window',
        region: region ?? undefined,
        selector: selector ?? undefined,
        matched,
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
    let el: HTMLInputElement | HTMLTextAreaElement | null = null
    const selector = str(p, 'selector')
    const query = str(p, 'text') || str(p, 'label') || str(p, 'placeholder') || str(p, 'name')

    if (selector) {
      el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)
    }

    if (!el && query) {
      const direct = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input, textarea'
      )).find((inp) => {
        if (!isVisible(inp)) return false
        const attrs = [inp.placeholder, inp.getAttribute('aria-label'), inp.name, inp.id].filter(Boolean)
        return attrs.some((a) => normalizeUiText(a!).includes(normalizeUiText(query)))
      })
      if (direct) {
        el = direct
      } else {
        const labels = Array.from(document.querySelectorAll<HTMLElement>('label, .mx-field, .lw-field')).filter(isVisible)
        const cands = labels.map((l) => ({ text: l.innerText || l.title || '', visible: true }))
        const idx = pickByText(cands, query)
        if (idx >= 0) {
          const parent = labels[idx]
          const inp = parent.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea') ||
            (parent.getAttribute('for') ? document.getElementById(parent.getAttribute('for')!) as HTMLInputElement : null)
          if (inp && isVisible(inp)) el = inp
        }
      }
    }

    if (!el) {
      el = findTarget(p) as HTMLInputElement
    }

    if (!el || !('value' in el)) throw new Error(`Target is not a visible input/textarea: "${selector || query || ''}"`)
    const value = str(p, 'value') ?? ''
    const proto = Object.getPrototypeOf(el) as object
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    setter ? setter.call(el, value) : (el.value = value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    await nextPaint()
    return { ok: true, value, tag: el.tagName.toLowerCase(), name: el.name || el.id || el.placeholder || undefined }
  },

  get_ui_state: () => {
    const v = useView.getState()
    const lwSession = getActiveLayerAssemblySession()
    return {
      theme: v.theme,
      dialog: v.dialog,
      audio_dialog_mode: v.audioDialogMode,
      left_tab: v.leftTab,
      timeline_tab: v.timelineTab,
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
    const timelineTab = str(p, 'timeline_tab')
    const inspectorTab = str(p, 'inspector_tab')
    const mobileTab = str(p, 'mobile_tab')
    const theme = str(p, 'theme')

    if (theme === 'dark' || theme === 'light') {
      v.set({ theme })
    }

    if (timelineTab === 'timeline' || timelineTab === 'workflow') {
      v.setTimelineTab(timelineTab)
    }

    if (leftTab === 'shots' || leftTab === 'assets' || leftTab === 'topview') {
      v.setLeftTab(leftTab)
      useView.setState({ mobileTab: 'left', tabletTab: 'left' })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pxs:responsive-tab', { detail: { mobileTab: 'left', tabletTab: 'left' } }))
      }
    }

    if (inspectorTab === 'scene' || inspectorTab === 'layer' || inspectorTab === 'camera' || inspectorTab === 'route' || inspectorTab === 'node' || inspectorTab === 'json') {
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
        dialog === 'remote' ||
        dialog === 'export'
      ) {
        v.openDialog(dialog)
      } else if (dialog === 'layer_assembly' || dialog === 'layer_assembly_create') {
        requestOpenLayerAssembly(str(p, 'composite_id') ?? undefined)
      } else {
        throw new ParamError(
          `Invalid dialog "${dialog}". Expected none, path, sketch, performance, mcp, remote, audio, export, layer_assembly, or layer_assembly_create.`
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
      timeline_tab: s.timelineTab,
      mobile_tab: s.mobileTab,
      tablet_tab: s.tabletTab,
      assembly_workshop_open: !!s.assemblyModalModel,
      layer_assembly_open: !!getActiveLayerAssemblySession()
    }
  }
}
