import { DIALOG_SELECTORS } from '../../mcp/uiRegions'
import { intersectionCenter, type ScanBox, type VisibleRect } from './aiUiInspectorGeometry'
import { readDomSourceLocation } from './aiUiInspectorSourceLocator'

/**
 * Bề mặt UI (surface) cho AI UI Inspector: Dialog / Modal lồng / Popup-Menu / Màn hình chính.
 * - Nhận diện TỔNG QUÁT qua `data-ai-surface`, `data-mcp-dialog`, `role="dialog|menu|listbox"`, `aria-modal`
 *   cộng danh sách class đã biết → popup/dialog mới không bị bỏ sót khi quét.
 * - Hit-test bằng `elementFromPoint` (đã tạm vô hiệu lớp phủ inspector) để loại phần tử bị dialog che khuất.
 */

export type SurfaceKind = 'dialog' | 'popup' | 'main'

export interface ScannedSurfaceInfo {
  kind: SurfaceKind
  /** Tên dễ đọc của bề mặt (data-ai-surface / data-mcp-region / tiêu đề / class) */
  label: string
  region: string | null
  selector: string
  /** file:dòng JSX gốc của dialog/popup (khi dev) */
  source: string | null
  /** Chuỗi bề mặt từ trong ra ngoài, ví dụ ["Popup: Menu Hành động", "Dialog: layer_assembly"] */
  chain: string[]
  root: Element | null
}

export const POPUP_CONTAINER_SELECTORS = [
  '[data-ai-surface="popup"]',
  '.menu-wrap.open .menu',
  '.menu[role="menu"]',
  '[role="menu"]',
  '[role="listbox"]',
  '.custom-select-menu',
  '.custom-select-dropdown',
  '.layer-workshop-popover-menu',
  '.layer-brush-popover',
  '.ps-flyout',
  '.loop-flyout',
  '.cutter-flyout',
  '.color-picker-popover',
  '.tl-fx-popover',
  '.tl-motion-popup',
  '.tl-key-menu',
  '.tl-logic-picker',
  '.wf-quick-connect-menu',
  '.wf-v2-quick-spawn-menu',
  '.ah-help-pop',
  '[popover]'
]

export const NESTED_MODAL_SELECTORS = [
  '[data-ai-surface="dialog"]',
  '.lw-mixamo-motion-modal',
  '.lw-clip-json-modal',
  '.lw-swap-modal',
  '.composite-swap-modal',
  '[data-mcp-region="layer_assembly_retarget"]',
  '[data-mcp-region="layer_assembly_create"]',
  '.lw-confirm-modal',
  '.tpm-modal',
  '.ps-save-modal',
  '.loop-align-studio-modal',
  '.loop-del-dialog',
  '.wf-node-config-modal',
  '.wf-node-dialog-window'
]

const POPUP_SELECTOR = POPUP_CONTAINER_SELECTORS.join(', ')
const DIALOG_SELECTOR = ['[data-ai-surface]:not([data-ai-surface="popup"])', ...NESTED_MODAL_SELECTORS, ...DIALOG_SELECTORS].join(', ')

const INSPECTOR_OVERLAY_SELECTOR = [
  '.ai-ui-inspector-overlay',
  '.ai-ui-inspector-barrier',
  '.ai-ui-inspector-screen-frame',
  '.ai-ui-inspector-arm-hud',
  '.ai-ui-inspector-marquee',
  '.ai-ui-inspector-crosshair',
  '.ai-ui-inspector-toast',
  '.ai-ui-inspector-preview-backdrop',
  '.ai-ui-scan-fx-layer',
  '.ai-control-overlay',
  '.ai-safety-barrier',
  '.ai-neon-border-frame'
].join(', ')

export function isInspectorInternalElement(el: Element | null | undefined): boolean {
  if (!el) return false
  try {
    return Boolean(el.closest?.(INSPECTOR_OVERLAY_SELECTOR))
  } catch {
    return false
  }
}

/** Tạm thời cho lớp phủ inspector "trong suốt với chuột" để `elementFromPoint` trúng UI thật bên dưới. */
export function withInspectorOverlaysHidden<T>(fn: () => T): T {
  const restored: Array<{ el: HTMLElement; value: string }> = []
  try {
    const overlays =
      typeof document?.querySelectorAll === 'function'
        ? Array.from(document.querySelectorAll<HTMLElement>(INSPECTOR_OVERLAY_SELECTOR))
        : []
    for (const el of overlays) {
      if (!el.style) continue
      restored.push({ el, value: el.style.pointerEvents })
      el.style.pointerEvents = 'none'
    }
  } catch {
    /* môi trường mock */
  }
  try {
    return fn()
  } finally {
    for (const r of restored) r.el.style.pointerEvents = r.value
  }
}

/**
 * Phần tử UI thật trên cùng tại điểm. Lớp phủ inspector nào còn chặn chuột (chưa được
 * `withInspectorOverlaysHidden` vô hiệu) sẽ bị tạm xuyên qua rồi khôi phục ngay.
 */
export function probeTopmostAt(x: number, y: number): Element | null {
  if (typeof document?.elementFromPoint !== 'function') return null
  const pierced: Array<{ el: HTMLElement; value: string }> = []
  try {
    for (let guard = 0; guard < 6; guard++) {
      const hit = document.elementFromPoint(x, y)
      if (!hit || typeof hit !== 'object' || typeof (hit as Element).closest !== 'function') return null
      if (!isInspectorInternalElement(hit)) return hit
      const html = hit as HTMLElement
      if (!html.style) return null
      pierced.push({ el: html, value: html.style.pointerEvents })
      html.style.pointerEvents = 'none'
    }
    return null
  } catch {
    return null
  } finally {
    for (const p of pierced) p.el.style.pointerEvents = p.value
  }
}

function isSameStack(el: Element, hit: Element): boolean {
  return hit === el || Boolean(el.contains?.(hit)) || Boolean(hit.contains?.(el))
}

/**
 * Phần tử có thực sự nhìn thấy trong vùng quét không (không bị dialog/popup khác đè lên)?
 * Không xác định được (môi trường test / hit null) → coi như nhìn thấy để không bỏ sót.
 */
export function isElementUnobstructed(el: Element, rect: VisibleRect, box: ScanBox): boolean {
  const points: Array<{ x: number; y: number }> = []
  const ic = intersectionCenter(rect, box)
  if (ic) points.push(ic)
  points.push({ x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5 })
  let decided = false
  for (const p of points) {
    const hit = probeTopmostAt(p.x, p.y)
    if (!hit) continue
    decided = true
    if (isSameStack(el, hit)) return true
  }
  return !decided
}

function shortClass(el: Element): string {
  const cls = Array.from(el.classList || []).find((c) => !c.startsWith('ai-ui-') && c.length > 2)
  return cls ? `.${cls}` : (el.tagName || 'div').toLowerCase()
}

function surfaceTitle(el: Element): string {
  const attr =
    el.getAttribute?.('data-ai-surface-label') ||
    el.getAttribute?.('aria-label') ||
    el.getAttribute?.('data-mcp-region')
  if (attr) return attr.slice(0, 60)
  try {
    const heading = el.querySelector?.('h1, h2, h3, h4, [class*="title"], [class*="header"] strong')
    const text = (heading?.textContent || '').replace(/\s+/g, ' ').trim()
    if (text) return text.slice(0, 60)
  } catch {
    /* ignore */
  }
  return shortClass(el)
}

function surfaceSelector(el: Element): string {
  const region = el.getAttribute?.('data-mcp-region')
  const base = shortClass(el)
  return region ? `${base}[data-mcp-region="${region}"]` : base
}

function closestSurface(el: Element | null): { root: Element; kind: SurfaceKind } | null {
  if (!el || typeof el.closest !== 'function') return null
  let popup: Element | null = null
  let dialog: Element | null = null
  try {
    popup = el.closest(POPUP_SELECTOR)
    dialog = el.closest(DIALOG_SELECTOR)
  } catch {
    return null
  }
  if (popup && dialog) {
    return dialog.contains(popup) ? { root: popup, kind: 'popup' } : { root: dialog, kind: 'dialog' }
  }
  if (popup) return { root: popup, kind: 'popup' }
  if (dialog) return { root: dialog, kind: 'dialog' }
  return null
}

const KIND_LABEL: Record<SurfaceKind, string> = {
  dialog: 'Dialog',
  popup: 'Popup',
  main: 'Màn hình chính'
}

/** Xác định bề mặt (dialog / popup / màn hình chính) chứa phần tử + chuỗi lồng nhau. */
export function resolveElementSurface(el: Element | null | undefined): ScannedSurfaceInfo {
  const first = closestSurface(el || null)
  if (!first) {
    return { kind: 'main', label: KIND_LABEL.main, region: null, selector: 'body', source: null, chain: [], root: null }
  }
  const chain: string[] = []
  let cursor: { root: Element; kind: SurfaceKind } | null = first
  let guard = 0
  while (cursor && guard < 4) {
    guard++
    chain.push(`${KIND_LABEL[cursor.kind]}: ${surfaceTitle(cursor.root)}`)
    cursor = closestSurface(cursor.root.parentElement)
  }
  return {
    kind: first.kind,
    label: surfaceTitle(first.root),
    region: first.root.getAttribute?.('data-mcp-region') || null,
    selector: surfaceSelector(first.root),
    source: readDomSourceLocation(first.root)?.ref || null,
    chain,
    root: first.root
  }
}

/** Bề mặt nằm trên cùng tại tâm khung quét (ưu tiên sắp xếp phần tử thuộc bề mặt này). */
export function findTopSurfaceRootAt(box: ScanBox): Element | null {
  const hit = withInspectorOverlaysHidden(() =>
    probeTopmostAt(box.left + box.width * 0.5, box.top + box.height * 0.5)
  )
  return hit ? closestSurface(hit)?.root || null : null
}

export function isInsideSurface(el: Element, root: Element | null): boolean {
  if (!root) return false
  return root === el || Boolean(root.contains?.(el))
}
