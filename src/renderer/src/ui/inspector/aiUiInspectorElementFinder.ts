import { findActiveDialog } from '../../mcp/uiRegions'
import {
  computeBoxCoverageRatio,
  computeOverlapRatio,
  getVisibleElementRect,
  isRectCenterInBox,
  rectIntersectsBox,
  type ScanBox
} from './aiUiInspectorGeometry'
import {
  NESTED_MODAL_SELECTORS,
  POPUP_CONTAINER_SELECTORS,
  findTopSurfaceRootAt,
  isElementUnobstructed,
  isInsideSurface,
  isInspectorInternalElement,
  probeTopmostAt,
  withInspectorOverlaysHidden
} from './aiUiInspectorSurfaces'
import { getElementInteractionScore } from './aiUiInspectorActiveFocus'

/**
 * Tìm phần tử giao diện trong khung quét của AI UI Inspector.
 * Pipeline: phạm vi (popup → modal lồng → dialog trên cùng) → ứng viên theo selector + lấy mẫu lưới hit-test
 * → loại phần tử bị che khuất → khử trùng lặp cha-con → lọc sượt qua → sắp xếp (bề mặt trên cùng trước).
 */

export const MAX_SCANNED_ELEMENTS = 12

export const INTERACTIVE_ELEMENT_SELECTORS = [
  '.menu-item',
  '[role="menuitem"]',
  '[role="option"]',
  '.custom-select-item',
  '.custom-select-trigger',
  '.switch',
  '[role="switch"]',
  '.wf-v2-direct-layer-bbox',
  '.wf-v2-direct-cam-bbox',
  '.wf-v2-direct-layer',
  'polygon.gizmo-box',
  '.anim2d-selected-layer-bbox',
  '.anim2d-layer-pin',
  '.anim2d-layer-item',
  '.anim2d-shot-card',
  '[data-scene-layer-id]',
  '[data-waypoint-node-id]',
  '.lw-stage-layer-item',
  '.layer-cutter-placed-layer',
  '.lw-cutout-preview-tile',
  '.lw-layer-callout-bubble',
  'g.lw-blender-bone',
  '.lw-bone-item',
  '[data-bone-id]',
  '[data-layer-id]',
  '[data-ai-id]',
  '.lw-row',
  '.lw-cutout-part-row',
  '.lw-part-member',
  '.lw-variant',
  '.layer-cutter-slot-card',
  '.cutter-part-chip',
  '.lw-part-slot-card',
  '.lw-part-group-card',
  '.composite-card',
  '.lw-template-card',
  '.wf-v2-card',
  '.loop-frame-card',
  'button',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="slider"]',
  '[contenteditable="true"]',
  'a',
  '.btn',
  '.tab',
  '.pxs-tab',
  '.card',
  '.shot-item',
  '.tl-track',
  '.tb-btn-icon',
  'h1, h2, h3, h4',
  'label',
  '.splitter',
  'canvas',
  '[data-mcp-region]'
]

const INTERACTIVE_SELECTOR = INTERACTIVE_ELEMENT_SELECTORS.join(', ')

const SINGLE_CLICK_MEANINGFUL_SELECTOR =
  '.menu-item, [role="menuitem"], [role="option"], .custom-select-item, .custom-select-trigger, .switch, [role="switch"], .wf-v2-direct-layer-bbox, .wf-v2-direct-cam-bbox, .wf-v2-direct-layer, svg.layer-gizmo, .anim2d-selected-layer-bbox, .anim2d-layer-pin, .anim2d-layer-item, [data-scene-layer-id], [data-waypoint-node-id], .lw-stage-layer-item, .layer-cutter-placed-layer, .lw-cutout-preview-tile, .lw-layer-callout-bubble, g.lw-blender-bone, .lw-bone-item, [data-bone-id], [data-layer-id], [data-ai-id], button, input, select, textarea, [role="button"], [role="tab"], a, .btn, .tab, .pxs-tab, .wf-v2-card, .lw-row, .card, .shot-item, .tl-track, .panel-header, [data-mcp-region]'

const CONTAINER_DEDUPE_SELECTOR =
  '[data-mcp-region], .panel, .tabs, .pxs-tabs, header, aside, section, .viewer-wrap, .layer-workshop-dialog, .lw-workspace-column, .row, .custom-select-wrap, .slider, .card, .lw-row, .lw-part-slot-card, .lw-part-group-card, .composite-card, .shot-item, .tl-track'

const FOCUSED_BBOX_SELECTOR =
  '.wf-v2-direct-layer-bbox, .wf-v2-direct-cam-bbox, [data-bbox-role="motion_start"], [data-bbox-role="motion_target"]'

/** Click đơn (khung < 8px): xuyên lớp chắn inspector và lấy control có nghĩa gần nhất tại điểm. */
function findElementAtPoint(box: ScanBox): Element[] {
  const target = withInspectorOverlaysHidden(() => probeTopmostAt(box.left, box.top))
  if (!target) return []
  const meaningful = target.closest?.(SINGLE_CLICK_MEANINGFUL_SELECTOR)
  if (meaningful?.matches?.('label.num') && typeof meaningful.querySelector === 'function') {
    const innerInput = meaningful.querySelector('input')
    if (innerInput) return [innerInput]
  }
  return [meaningful || target]
}

function collectIntersecting(selectors: string[], box: ScanBox, minW = 0, minH = 0): Element[] {
  const out: Element[] = []
  const nodes = Array.from(document.querySelectorAll(selectors.join(', ')))
  for (const node of nodes) {
    if (isInspectorInternalElement(node)) continue
    const r = getVisibleElementRect(node)
    if (r.width >= minW && r.height >= minH && rectIntersectsBox(r, box)) out.push(node)
  }
  return out
}

/** Phạm vi quét: popup đang mở → modal lồng → dialog trên cùng → toàn trang. */
function resolveScopeRoots(box: ScanBox): Array<Element | Document> {
  let openPopups: Element[] = []
  let openNestedModals: Element[] = []
  try {
    openPopups = collectIntersecting(POPUP_CONTAINER_SELECTORS, box)
    openNestedModals = collectIntersecting(NESTED_MODAL_SELECTORS, box, 60, 40)
  } catch {
    /* môi trường mock */
  }
  if (openPopups.length > 0) return openPopups.map((p) => p.closest?.('.menu-wrap') || p)
  if (openNestedModals.length > 0) return [openNestedModals[openNestedModals.length - 1]]
  const activeDialog = findActiveDialog(document)
  if (activeDialog && rectIntersectsBox(activeDialog.getBoundingClientRect(), box)) return [activeDialog]
  return [document]
}

function isWithinScopes(el: Element, scopes: Array<Element | Document>): boolean {
  return scopes.some((s) => s === document || (s as Element).contains?.(el))
}

/** Lấy mẫu lưới điểm trong khung quét để bắt cả phần tử văn bản không khớp selector (popup/dialog mới). */
function sampleGridHits(box: ScanBox, scopes: Array<Element | Document>): Element[] {
  const cols = Math.max(2, Math.min(7, Math.round(box.width / 80)))
  const rows = Math.max(2, Math.min(6, Math.round(box.height / 60)))
  const hits: Element[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = box.left + ((c + 0.5) / cols) * box.width
      const y = box.top + ((r + 0.5) / rows) * box.height
      const hit = probeTopmostAt(x, y)
      if (!hit || !isWithinScopes(hit, scopes)) continue
      const meaningful = hit.closest?.(INTERACTIVE_SELECTOR)
      if (meaningful && isWithinScopes(meaningful, scopes)) {
        hits.push(meaningful)
      } else if (hit.hasAttribute?.('data-ai-src') && (hit.textContent || '').trim().length > 0) {
        hits.push(hit)
      }
    }
  }
  return hits
}

function collectCandidates(box: ScanBox): Element[] {
  const scopes = resolveScopeRoots(box)
  const candidateSet = new Set<Element>()
  for (const root of scopes) {
    if (typeof root.querySelectorAll !== 'function') continue
    for (const item of Array.from(root.querySelectorAll(INTERACTIVE_SELECTOR))) candidateSet.add(item)
  }
  return withInspectorOverlaysHidden(() => {
    for (const hit of sampleGridHits(box, scopes)) candidateSet.add(hit)
    const matched: Element[] = []
    for (const el of candidateSet) {
      if (isInspectorInternalElement(el)) continue
      const r = getVisibleElementRect(el)
      if (!rectIntersectsBox(r, box)) continue
      if (!isElementUnobstructed(el, r, box)) continue
      matched.push(el)
    }
    return matched
  })
}

/** Khung chỉnh BBox: luôn đưa BBox đang focus trong `workflow_preview` vào kết quả. */
function includeFocusedBboxes(matched: Element[], box: ScanBox): void {
  const stage = matched.find((el) => el.matches?.('[data-mcp-region="workflow_preview"]'))
  if (!stage || typeof stage.querySelectorAll !== 'function') return
  for (const fb of Array.from(stage.querySelectorAll('[data-bbox-focused="true"]'))) {
    const rect = getVisibleElementRect(fb)
    if (!matched.includes(fb) && rectIntersectsBox(rect, box) &&
      withInspectorOverlaysHidden(() => isElementUnobstructed(fb, rect, box))) matched.push(fb)
  }
}

/** Khử trùng lặp cha-con, wrapper của compound control & phần tử phụ quanh BBox đang focus. */
function dedupeParentChild(matched: Element[], box: ScanBox): Element[] {
  const hasFocusedDirectBbox = matched.some(
    (el) => el.getAttribute?.('data-bbox-focused') === 'true' && el.matches?.(FOCUSED_BBOX_SELECTOR)
  )
  return matched.filter((el) => {
    const tag = (el.tagName || '').toLowerCase()
    if (tag === 'canvas') {
      const parentPart = el.closest?.('[data-layer-id]')
      if (parentPart && parentPart !== el && matched.includes(parentPart)) return false
    }
    if (tag === 'label') {
      const hasChildControl = matched.some(
        (o) =>
          o !== el &&
          el.contains?.(o) &&
          ['input', 'select', 'textarea', 'button'].includes((o.tagName || '').toLowerCase())
      )
      if (hasChildControl) return false
    }
    if (hasFocusedDirectBbox) {
      if (el.matches?.('.wf-v2-direct-layer')) return false
      if (
        (box.width >= 48 || box.height >= 48) &&
        el.matches?.('.wf-v2-direct-rot-handle, .wf-v2-direct-scale-badge')
      ) {
        return false
      }
    }
    const hasDescendant = matched.some((o) => o !== el && el.contains?.(o))
    if (hasDescendant && !el.matches?.('.wf-v2-card') && el.matches?.(CONTAINER_DEDUPE_SELECTOR)) {
      return false
    }
    return true
  })
}

/** Bỏ nút kích hoạt AI UI Inspector nếu khung quét đã có control mục tiêu rõ hơn. */
function dropInspectorTrigger(filtered: Element[], box: ScanBox): Element[] {
  if (filtered.length <= 1) return filtered
  const trigger = filtered.find((el) => el.id === 'ai-ui-inspector-btn')
  if (!trigger) return filtered
  const aiOverlap = computeOverlapRatio(getVisibleElementRect(trigger), box)
  const hasBetter = filtered.some((o) => {
    if (o === trigger) return false
    const or = getVisibleElementRect(o)
    return isRectCenterInBox(or, box) || computeOverlapRatio(or, box) >= aiOverlap
  })
  return hasBetter ? filtered.filter((el) => el !== trigger) : filtered
}

/** Bộ phận sân khấu 2.5D: bỏ các mảnh nền khổng lồ chỉ sượt qua góc khung. */
function focusStageParts(filtered: Element[], box: ScanBox): Element[] {
  const sel = '.lw-stage-layer-item, .layer-cutter-placed-layer'
  const stageParts = filtered.filter((el) => el.matches?.(sel))
  if (stageParts.length <= 1) return filtered
  const focused = stageParts.filter((el) => {
    const r = getVisibleElementRect(el)
    return isRectCenterInBox(r, box) || computeOverlapRatio(r, box) >= 0.35
  })
  if (focused.length === 0 || focused.length >= stageParts.length) return filtered
  const keep = new Set(focused)
  return filtered.filter((el) => !el.matches?.(sel) || keep.has(el))
}

/** Bộ lọc tâm điểm (Anti-Grazing): khi có mục tiêu mạnh, bỏ phần tử chỉ sượt mép khung. */
function applyDominanceFilter(filtered: Element[], box: ScanBox): Element[] {
  if (filtered.length <= 1) return filtered
  const scored = filtered.map((el) => {
    const r = getVisibleElementRect(el)
    const centerIn = isRectCenterInBox(r, box)
    const elOverlap = computeOverlapRatio(r, box)
    const boxCover = computeBoxCoverageRatio(r, box)
    const isStrong =
      (centerIn && elOverlap >= 0.42) ||
      elOverlap >= 0.62 ||
      (boxCover >= 0.55 && elOverlap >= 0.25)
    return { el, centerIn, elOverlap, boxCover, isStrong }
  })
  if (!scored.some((s) => s.isStrong)) return filtered
  const focused = scored
    .filter((s) => s.isStrong || s.centerIn || s.elOverlap >= 0.32 || s.boxCover >= 0.35)
    .map((s) => s.el)
  return focused.length > 0 ? focused : filtered
}

function compareCandidates(a: Element, b: Element, box: ScanBox, topSurface: Element | null): number {
  if (topSurface) {
    const aTop = isInsideSurface(a, topSurface)
    const bTop = isInsideSurface(b, topSurface)
    if (aTop !== bTop) return aTop ? -1 : 1
  }

  // Ưu tiên phần tử đang Focus hoặc Active (ví dụ: tab/nút đang chọn, input đang focus)
  const scoreA = getElementInteractionScore(a)
  const scoreB = getElementInteractionScore(b)
  if (Math.abs(scoreA - scoreB) >= 20) {
    return scoreB - scoreA
  }

  if (box.width >= 36 && box.height >= 24) {
    if (a.matches?.('.wf-v2-card') && a.contains?.(b) && computeOverlapRatio(getVisibleElementRect(a), box) >= 0.62) return -1
    if (b.matches?.('.wf-v2-card') && b.contains?.(a) && computeOverlapRatio(getVisibleElementRect(b), box) >= 0.62) return 1
  }
  const ra = getVisibleElementRect(a)
  const rb = getVisibleElementRect(b)
  const aIn = isRectCenterInBox(ra, box)
  const bIn = isRectCenterInBox(rb, box)
  if (aIn !== bIn) return aIn ? -1 : 1
  const aOverlap = computeOverlapRatio(ra, box)
  const bOverlap = computeOverlapRatio(rb, box)
  if (Math.abs(aOverlap - bOverlap) > 0.22) return bOverlap - aOverlap
  const cx = box.left + box.width * 0.5
  const cy = box.top + box.height * 0.5
  const da = Math.hypot(ra.left + ra.width * 0.5 - cx, ra.top + ra.height * 0.5 - cy)
  const db = Math.hypot(rb.left + rb.width * 0.5 - cx, rb.top + rb.height * 0.5 - cy)
  return da - db
}

/**
 * Tìm các phần tử giao diện nằm bên trong hoặc cắt ngang khung quét hình chữ nhật.
 */
export function findElementsInBox(box: ScanBox, maxElements = MAX_SCANNED_ELEMENTS): Element[] {
  if (box.width < 8 && box.height < 8) return findElementAtPoint(box)

  const matched = collectCandidates(box)
  includeFocusedBboxes(matched, box)

  let filtered = dedupeParentChild(matched, box)
  filtered = dropInspectorTrigger(filtered, box)
  filtered = focusStageParts(filtered, box)
  filtered = applyDominanceFilter(filtered, box)

  const topSurface = findTopSurfaceRootAt(box)
  filtered.sort((a, b) => compareCandidates(a, b, box, topSurface))
  return filtered.slice(0, maxElements)
}
