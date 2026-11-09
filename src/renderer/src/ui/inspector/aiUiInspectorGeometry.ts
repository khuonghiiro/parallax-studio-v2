/**
 * Hình học cho AI UI Inspector: hình chữ nhật hiển thị thực (đã cắt theo khung cuộn) và tỷ lệ chồng lấn.
 */

export interface ScanBox {
  left: number
  top: number
  width: number
  height: number
}

export interface VisibleRect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

const SCROLL_CLIP_CONTAINER_SELECTOR =
  '.wf-v2-insp-body, .inspector-body, .asset-grid, .shots-list, .tl-tracks-scroll, .lw-layers-list, .lw-parts-list, .wf-canvas-viewport'

function shouldClipByParent(parent: Element): boolean {
  if (parent.matches?.(SCROLL_CLIP_CONTAINER_SELECTOR)) return true
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return false
  const style = window.getComputedStyle(parent)
  const ov = `${style.overflow || ''} ${style.overflowY || ''} ${style.overflowX || ''}`
  return /(auto|scroll|hidden|clip)/.test(ov)
}

/** Cắt phần bị thanh tab dưới cùng của cột Inspector che khuất. */
function clipByInspectorBottomTabs(el: Element, rawBottom: number, bottom: number): number {
  if (!el.closest?.('.wf-v2-insp-body, .inspector-body')) return bottom
  const bottomTabs = document.querySelector?.('[data-mcp-region="inspector_bottom_tabs"]')
  if (!bottomTabs || bottomTabs.contains(el)) return bottom
  const btr = bottomTabs.getBoundingClientRect()
  if (btr.width > 0 && btr.height > 0 && btr.top < bottom && btr.bottom >= rawBottom - 4) {
    return Math.min(bottom, btr.top)
  }
  return bottom
}

/**
 * Hình chữ nhật hiển thị thực tế của phần tử sau khi cắt theo các khung cuộn cha
 * và các thanh ghim cố định đè lên trên.
 */
export function getVisibleElementRect(el: Element): VisibleRect {
  const raw = el.getBoundingClientRect()
  let left = raw.left
  let top = raw.top
  let right = raw.right
  let bottom = raw.bottom

  let parent = el.parentElement
  let depth = 0
  while (parent && parent !== document.body && parent !== document.documentElement && depth < 14) {
    depth++
    if (shouldClipByParent(parent)) {
      const pr = parent.getBoundingClientRect()
      if (pr.width > 0 && pr.height > 0) {
        left = Math.max(left, pr.left)
        top = Math.max(top, pr.top)
        right = Math.min(right, pr.right)
        bottom = Math.min(bottom, pr.bottom)
      }
    }
    parent = parent.parentElement
  }

  bottom = clipByInspectorBottomTabs(el, raw.bottom, bottom)
  const width = Math.max(0, right - left)
  const height = Math.max(0, bottom - top)
  return { left, top, right: left + width, bottom: top + height, width, height }
}

export function rectIntersectsBox(r: VisibleRect, box: ScanBox): boolean {
  if (r.width <= 0 || r.height <= 0) return false
  const boxRight = box.left + box.width
  const boxBottom = box.top + box.height
  if (r.right < box.left || r.left > boxRight || r.bottom < box.top || r.top > boxBottom) {
    return false
  }
  if (box.width >= 10 && box.height >= 10 && r.width >= 8 && r.height >= 8) {
    const iw = Math.min(r.right, boxRight) - Math.max(r.left, box.left)
    const ih = Math.min(r.bottom, boxBottom) - Math.max(r.top, box.top)
    if (iw < 3 || ih < 3) return false
  }
  return true
}

function intersectionArea(r: VisibleRect, box: ScanBox): number {
  const ix0 = Math.max(r.left, box.left)
  const iy0 = Math.max(r.top, box.top)
  const ix1 = Math.min(r.right, box.left + box.width)
  const iy1 = Math.min(r.bottom, box.top + box.height)
  return Math.max(0, ix1 - ix0) * Math.max(0, iy1 - iy0)
}

/** Tỷ lệ diện tích phần tử nằm trong khung quét (0..1). */
export function computeOverlapRatio(r: VisibleRect, box: ScanBox): number {
  const elArea = r.width * r.height
  if (elArea <= 0) return 0
  return intersectionArea(r, box) / elArea
}

/** Tỷ lệ diện tích khung quét bị phần tử phủ (0..1). */
export function computeBoxCoverageRatio(r: VisibleRect, box: ScanBox): number {
  return intersectionArea(r, box) / Math.max(1, box.width * box.height)
}

export function isRectCenterInBox(r: VisibleRect, box: ScanBox): boolean {
  const cx = r.left + r.width * 0.5
  const cy = r.top + r.height * 0.5
  return cx >= box.left && cx <= box.left + box.width && cy >= box.top && cy <= box.top + box.height
}

/** Điểm giữa phần giao giữa phần tử và khung quét (dùng để hit-test che khuất). */
export function intersectionCenter(r: VisibleRect, box: ScanBox): { x: number; y: number } | null {
  const ix0 = Math.max(r.left, box.left)
  const iy0 = Math.max(r.top, box.top)
  const ix1 = Math.min(r.right, box.left + box.width)
  const iy1 = Math.min(r.bottom, box.top + box.height)
  if (ix1 <= ix0 || iy1 <= iy0) return null
  return { x: (ix0 + ix1) * 0.5, y: (iy0 + iy1) * 0.5 }
}
