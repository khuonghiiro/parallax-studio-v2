import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import { findActiveDialog } from '../../mcp/uiRegions'
import {
  buildScanned25DBoneInfo,
  buildScanned25DPartInfo,
  extractActiveWorkshopContext,
  type AiWorkshopContext,
  type Scanned25DBoneInfo,
  type Scanned25DPartInfo
} from './aiUiInspectorWorkshopContext'
import { resolveActiveDialogIdentifier } from './aiUiInspectorDialogContext'
import {
  buildControlDetails,
  extractEnhancedFiberInfo,
  resolveLinkedTargetModule,
  type LinkedTargetModule,
  type ScannedControlDetails
} from './aiUiInspectorControlMeta'

export { formatAiInspectorMarkdown } from './aiUiInspectorMarkdown'
export type { LinkedTargetModule, ScannedControlDetails } from './aiUiInspectorControlMeta'

export interface ElementFiberInfo {
  componentName: string
  fileInfo: string | null
  handlers: string[]
}

export interface ScannedElementContext {
  element: Element
  tagName: string
  kindLabel: string
  id: string
  classes: string[]
  text: string
  title: string | null
  primaryFile: string | null
  primaryHandler: string | null
  componentChain: ElementFiberInfo[]
  mcpRegion: string | null
  mcpDialog: string | null
  bounds: { left: number; top: number; width: number; height: number }
  part25D?: Scanned25DPartInfo | null
  bone25D?: Scanned25DBoneInfo | null
  ownerComponentName?: string | null
  controlDetails?: ScannedControlDetails | null
  linkedTarget?: LinkedTargetModule | null
  isPrimaryFocus?: boolean
}

export interface AiInspectorSnapshot {
  rect: { left: number; top: number; width: number; height: number }
  elements: ScannedElementContext[]
  primaryRegion: string
  workshopContext: AiWorkshopContext | null
  appState: {
    shotName: string
    shotIndex: number
    currentTime: number
    duration: number
    fps: number
    isPlaying: boolean
    selectedLayerNames: string[]
    activeDialog: string | null
    theme: string
  }
}

const POPUP_CONTAINER_SELECTORS = [
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
  '.wf-quick-connect-menu',
  '.wf-v2-quick-spawn-menu',
  '.ah-help-pop'
]

const NESTED_MODAL_SELECTORS = [
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

const INTERACTIVE_ELEMENT_SELECTORS = [
  '.menu-item',
  '[role="menuitem"]',
  '[role="option"]',
  '.custom-select-item',
  '.custom-select-trigger',
  '.switch',
  '[role="switch"]',
  '.lw-stage-layer-item',
  '.layer-cutter-placed-layer',
  '.lw-cutout-preview-tile',
  '.lw-layer-callout-bubble',
  'g.lw-blender-bone',
  '.lw-bone-item',
  '[data-bone-id]',
  '[data-layer-id]',
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
  '.anim2d-layer-item',
  '.anim2d-shot-card',
  'button',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="tab"]',
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

/**
 * Phân tích React Fiber và trích xuất cây component, đường dẫn file nguồn (.tsx) và tên hàm xử lý.
 */
export function extractFiberInfo(domNode: Element): {
  componentChain: ElementFiberInfo[]
  primaryFile: string | null
  primaryHandler: string | null
} {
  const res = extractEnhancedFiberInfo(domNode)
  return {
    componentChain: res.componentChain,
    primaryFile: res.primaryFile,
    primaryHandler: res.primaryHandler
  }
}

function classifyElementKindLabel(
  el: Element,
  tagName: string,
  classes: string[],
  part25D: Scanned25DPartInfo | null,
  bone25D: Scanned25DBoneInfo | null
): string {
  if (classes.includes('lw-stage-layer-item') || classes.includes('layer-cutter-placed-layer')) {
    return 'Bộ phận 2.5D trên sân khấu'
  }
  if (classes.includes('lw-cutout-preview-tile')) return 'Ô Preview Bộ phận 2.5D'
  if (classes.includes('lw-layer-callout-bubble')) return 'Bóng chọn nhanh Layer 2.5D'
  if (bone25D || classes.includes('lw-blender-bone') || classes.includes('lw-bone-item')) {
    return 'Khớp xương 2.5D (Bone Rig)'
  }
  if (
    part25D &&
    (classes.includes('lw-row') ||
      classes.includes('lw-cutout-part-row') ||
      classes.includes('layer-cutter-slot-card'))
  ) {
    return 'Hàng Bộ phận 2.5D trong danh sách'
  }
  if (part25D) return 'Bộ phận 2.5D'
  if (classes.includes('menu-item') || el.getAttribute?.('role') === 'menuitem') {
    return 'Mục chọn trong Menu Popup'
  }
  if (classes.includes('custom-select-item') || el.getAttribute?.('role') === 'option') {
    return 'Mục chọn trong Danh sách xổ xuống'
  }
  if (
    classes.includes('custom-select-trigger') ||
    classes.includes('custom-select-wrap') ||
    tagName === 'select'
  ) {
    return 'Hộp chọn danh sách (Select / Combobox)'
  }
  if (
    classes.includes('switch') ||
    el.getAttribute?.('role') === 'switch' ||
    (tagName === 'input' && el.getAttribute?.('type') === 'checkbox')
  ) {
    return 'Công tắc Bật/Tắt (Switch)'
  }
  if (tagName === 'input' && el.getAttribute?.('type') === 'range') {
    return 'Thanh trượt điều chỉnh (Range Slider)'
  }
  if (classes.includes('tab') || classes.includes('pxs-tab') || el.getAttribute?.('role') === 'tab') {
    return 'Thẻ chuyển Tab'
  }
  if (classes.includes('wf-v2-card')) return 'Thẻ Node Sơ đồ (Workflow V2 Node)'
  if (tagName === 'canvas') return 'Khung vẽ Đồ hoạ (Canvas 2D/3D)'
  if (tagName === 'input' || tagName === 'textarea' || classes.includes('num')) {
    return 'Ô nhập / Điều chỉnh thông số'
  }
  if (tagName === 'button' || classes.includes('btn') || el.getAttribute?.('role') === 'button') {
    return 'Nút bấm thao tác'
  }
  if (classes.some((c) => c.includes('card'))) return 'Thẻ cấu hình / Node'
  return 'Thành phần giao diện'
}

/**
 * Trích xuất toàn bộ ngữ cảnh DOM + React Fiber + Thông số Control + Bộ phận 2.5D/Xương của 1 phần tử.
 */
export function scanElementContext(el: Element): ScannedElementContext {
  const rect = el.getBoundingClientRect()
  const fiberResult = extractEnhancedFiberInfo(el)
  const { componentChain, primaryFile, primaryHandler, ownerComponentName } = fiberResult

  const layerAttrId =
    el.getAttribute?.('data-layer-id') ||
    el.closest?.('[data-layer-id]')?.getAttribute?.('data-layer-id') ||
    null
  const boneAttrId =
    el.getAttribute?.('data-bone-id') ||
    el.getAttribute?.('data-bone-row') ||
    el.closest?.('[data-bone-id]')?.getAttribute?.('data-bone-id') ||
    null

  const part25D = layerAttrId ? buildScanned25DPartInfo(layerAttrId) : null
  const bone25D = boneAttrId ? buildScanned25DBoneInfo(boneAttrId) : null

  const classes = Array.from(el.classList || []).filter(
    (c) => !c.startsWith('ai-ui-') && !c.includes('hover')
  )
  const tagName = (el.tagName || 'div').toLowerCase()
  const controlDetails = buildControlDetails(el, tagName, classes, fiberResult)

  const rawText = (el as HTMLElement).innerText || el.textContent || ''
  let cleanText = rawText.replace(/\s+/g, ' ').trim().slice(0, 80)

  if (!cleanText) {
    const ariaLabel = el.getAttribute?.('aria-label')?.trim()
    const attrName = el.getAttribute?.('data-layer-name') || el.getAttribute?.('data-bone-name')
    if (ariaLabel && ariaLabel.length <= 80) {
      cleanText = ariaLabel
    } else if (attrName) {
      cleanText = attrName
    } else if (part25D) {
      cleanText = `${part25D.name} (${part25D.roleLabel})`
    } else if (bone25D) {
      cleanText = `Xương: ${bone25D.name}`
    } else if (controlDetails.fieldLabel) {
      cleanText = controlDetails.axis
        ? `${controlDetails.fieldLabel} (${controlDetails.axis})`
        : controlDetails.fieldLabel
    } else if (typeof el.querySelector === 'function') {
      const childImg = el.querySelector('img[alt]')
      const svgTitle = el.querySelector('title')
      cleanText =
        childImg?.getAttribute('alt') || svgTitle?.textContent?.trim()?.slice(0, 80) || ''
    }
  }

  const mcpRegionEl = el.closest?.('[data-mcp-region]')
  const mcpRegion =
    el.getAttribute?.('data-mcp-region') ||
    (mcpRegionEl ? mcpRegionEl.getAttribute('data-mcp-region') : null)

  const mcpDialogEl = el.closest?.('[data-mcp-dialog]')
  const mcpDialog = mcpDialogEl ? mcpDialogEl.getAttribute('data-mcp-dialog') : null

  const title =
    el.getAttribute?.('title') ||
    el.getAttribute?.('aria-label') ||
    el.getAttribute?.('placeholder') ||
    null

  const kindLabel = classifyElementKindLabel(el, tagName, classes, part25D, bone25D)
  const effectiveId = el.id || layerAttrId || boneAttrId || ''
  const linkedTarget = resolveLinkedTargetModule(effectiveId, classes, primaryHandler, mcpRegion)

  return {
    element: el,
    tagName,
    kindLabel,
    id: effectiveId,
    classes,
    text: cleanText,
    title,
    primaryFile,
    primaryHandler,
    componentChain,
    mcpRegion,
    mcpDialog,
    bounds: {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    },
    part25D,
    bone25D,
    ownerComponentName,
    controlDetails,
    linkedTarget
  }
}

function isInspectorInternalElement(el: Element): boolean {
  return Boolean(
    el.closest?.('.ai-ui-inspector-overlay') ||
      el.closest?.('.ai-ui-inspector-barrier') ||
      el.closest?.('.ai-ui-inspector-screen-frame') ||
      el.closest?.('.ai-ui-inspector-arm-hud') ||
      el.closest?.('.ai-ui-inspector-toast') ||
      el.closest?.('.ai-ui-inspector-preview-backdrop') ||
      el.closest?.('.ai-control-overlay') ||
      el.classList?.contains?.('ai-safety-barrier') ||
      el.classList?.contains?.('ai-neon-border-frame')
  )
}

function rectIntersectsBox(
  r: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  box: { left: number; top: number; width: number; height: number }
): boolean {
  if (r.width <= 0 || r.height <= 0) return false
  const boxRight = box.left + box.width
  const boxBottom = box.top + box.height
  if (r.right < box.left || r.left > boxRight || r.bottom < box.top || r.top > boxBottom) {
    return false
  }
  // Với khung kéo marquee (>= 10px), đòi hỏi phần giao nhau tối thiểu 3px để loại bỏ lỗi chạm viền 1-2px với nút bên cạnh
  if (box.width >= 10 && box.height >= 10 && r.width >= 8 && r.height >= 8) {
    const iw = Math.min(r.right, boxRight) - Math.max(r.left, box.left)
    const ih = Math.min(r.bottom, boxBottom) - Math.max(r.top, box.top)
    if (iw < 3 || ih < 3) return false
  }
  return true
}

function computeOverlapRatio(
  r: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  box: { left: number; top: number; width: number; height: number }
): number {
  const elArea = r.width * r.height
  if (elArea <= 0) return 0
  const ix0 = Math.max(r.left, box.left)
  const iy0 = Math.max(r.top, box.top)
  const ix1 = Math.min(r.right, box.left + box.width)
  const iy1 = Math.min(r.bottom, box.top + box.height)
  const iw = Math.max(0, ix1 - ix0)
  const ih = Math.max(0, iy1 - iy0)
  return (iw * ih) / elArea
}

function computeBoxCoverageRatio(
  r: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  box: { left: number; top: number; width: number; height: number }
): number {
  const boxArea = Math.max(1, box.width * box.height)
  const ix0 = Math.max(r.left, box.left)
  const iy0 = Math.max(r.top, box.top)
  const ix1 = Math.min(r.right, box.left + box.width)
  const iy1 = Math.min(r.bottom, box.top + box.height)
  const iw = Math.max(0, ix1 - ix0)
  const ih = Math.max(0, iy1 - iy0)
  return (iw * ih) / boxArea
}

/**
 * Tìm kiếm các phần tử giao diện nằm bên trong hoặc cắt ngang khung quét hình chữ nhật.
 * - Tự động ưu tiên Popup đang mở (Menu, Dropdown, Flyout) và Hộp thoại lồng / Xưởng nổi trên cùng.
 * - Loại bỏ các nút lân cận chỉ chạm viền mỏng (Anti-Grazing Dominance Filter) và khử trùng lặp thẻ bọc cha-con.
 */
export function findElementsInBox(box: {
  left: number
  top: number
  width: number
  height: number
}): Element[] {
  if (box.width < 8 && box.height < 8) {
    const hiddenBarriers: Array<{ el: HTMLElement; orig: string }> = []
    let target = document.elementFromPoint(box.left, box.top)
    let guard = 0
    while (target && isInspectorInternalElement(target) && guard < 5) {
      guard++
      const htmlEl = target as HTMLElement
      hiddenBarriers.push({ el: htmlEl, orig: htmlEl.style?.pointerEvents || '' })
      if (htmlEl.style) htmlEl.style.pointerEvents = 'none'
      target = document.elementFromPoint(box.left, box.top)
    }
    for (const b of hiddenBarriers) {
      if (b.el.style) b.el.style.pointerEvents = b.orig
    }
    if (!target) return []
    const meaningful = target.closest?.(
      '.menu-item, [role="menuitem"], [role="option"], .custom-select-item, .custom-select-trigger, .switch, [role="switch"], .lw-stage-layer-item, .layer-cutter-placed-layer, .lw-cutout-preview-tile, .lw-layer-callout-bubble, g.lw-blender-bone, .lw-bone-item, [data-bone-id], [data-layer-id], button, input, select, textarea, [role="button"], [role="tab"], a, .btn, .tab, .pxs-tab, .wf-v2-card, .lw-row, .card, .shot-item, .tl-track, .panel-header, [data-mcp-region]'
    )
    if (meaningful?.matches?.('label.num') && typeof meaningful.querySelector === 'function') {
      const innerInput = meaningful.querySelector('input')
      if (innerInput) return [innerInput]
    }
    return [meaningful || target]
  }

  const selector = INTERACTIVE_ELEMENT_SELECTORS.join(', ')

  const openPopups: Element[] = []
  const openNestedModals: Element[] = []
  try {
    const popupNodes = Array.from(document.querySelectorAll(POPUP_CONTAINER_SELECTORS.join(', ')))
    for (const pop of popupNodes) {
      if (isInspectorInternalElement(pop)) continue
      const r = pop.getBoundingClientRect()
      if (rectIntersectsBox(r, box)) {
        openPopups.push(pop)
      }
    }
    const nestedNodes = Array.from(document.querySelectorAll(NESTED_MODAL_SELECTORS.join(', ')))
    for (const nm of nestedNodes) {
      if (isInspectorInternalElement(nm)) continue
      const r = nm.getBoundingClientRect()
      if (r.width >= 60 && r.height >= 40 && rectIntersectsBox(r, box)) {
        openNestedModals.push(nm)
      }
    }
  } catch {
    /* ignore in mock environment */
  }

  let scopeRoots: Array<Element | Document> = [document]
  if (openPopups.length > 0) {
    scopeRoots = openPopups.map((p) => p.closest?.('.menu-wrap') || p)
  } else if (openNestedModals.length > 0) {
    scopeRoots = [openNestedModals[openNestedModals.length - 1]]
  } else {
    const activeDialog = findActiveDialog(document)
    if (activeDialog && rectIntersectsBox(activeDialog.getBoundingClientRect(), box)) {
      scopeRoots = [activeDialog]
    }
  }

  const candidateSet = new Set<Element>()
  for (const root of scopeRoots) {
    if (typeof root.querySelectorAll === 'function') {
      const list = Array.from(root.querySelectorAll(selector))
      for (const item of list) candidateSet.add(item)
    }
  }

  const matched: Element[] = []
  for (const el of candidateSet) {
    if (isInspectorInternalElement(el)) continue
    const r = el.getBoundingClientRect()
    if (rectIntersectsBox(r, box)) {
      matched.push(el)
    }
  }

  const boxRight = box.left + box.width
  const boxBottom = box.top + box.height
  const boxCx = box.left + box.width * 0.5
  const boxCy = box.top + box.height * 0.5

  // 1. Khử trùng lặp cha-con, wrapper của compound control (label.num > input, .slider > input) & vùng bao lớn
  let filtered = matched.filter((el) => {
    const tag = (el.tagName || '').toLowerCase()
    if (tag === 'canvas') {
      const parentPart = el.closest?.('[data-layer-id]')
      if (parentPart && parentPart !== el && matched.includes(parentPart)) {
        return false
      }
    }
    if (tag === 'label') {
      const hasChildControlInMatched = matched.some(
        (other) =>
          other !== el &&
          el.contains?.(other) &&
          ['input', 'select', 'textarea', 'button'].includes((other.tagName || '').toLowerCase())
      )
      if (hasChildControlInMatched) return false
    }

    const hasDescendantInMatched = matched.some((other) => other !== el && el.contains?.(other))
    if (
      hasDescendantInMatched &&
      el.matches?.(
        '[data-mcp-region], .panel, .tabs, .pxs-tabs, header, aside, section, .viewer-wrap, .layer-workshop-dialog, .lw-workspace-column, .row, .custom-select-wrap, .slider, .card, .lw-row, .lw-part-slot-card, .lw-part-group-card, .composite-card, .shot-item, .tl-track'
      )
    ) {
      return false
    }
    return true
  })

  // 2. Loại bỏ nút kích hoạt AI UI Inspector (#ai-ui-inspector-btn) nếu trong khung quét đã có control mục tiêu khác rõ ràng hơn
  if (filtered.length > 1) {
    const aiTriggerBtn = filtered.find((el) => el.id === 'ai-ui-inspector-btn')
    if (aiTriggerBtn) {
      const aiRect = aiTriggerBtn.getBoundingClientRect()
      const aiOverlap = computeOverlapRatio(aiRect, box)
      const hasBetterTarget = filtered.some((other) => {
        if (other === aiTriggerBtn) return false
        const or = other.getBoundingClientRect()
        const ocx = or.left + or.width * 0.5
        const ocy = or.top + or.height * 0.5
        const oCenterIn = ocx >= box.left && ocx <= boxRight && ocy >= box.top && ocy <= boxBottom
        return oCenterIn || computeOverlapRatio(or, box) >= aiOverlap
      })
      if (hasBetterTarget) {
        filtered = filtered.filter((el) => el !== aiTriggerBtn)
      }
    }
  }

  // 3. Nếu có các bộ phận sân khấu 2.5D nằm gọn tâm trong khung quét, lọc bỏ các bộ phận nền khổng lồ chỉ sượt nhẹ qua góc
  const stageParts = filtered.filter((el) =>
    el.matches?.('.lw-stage-layer-item, .layer-cutter-placed-layer')
  )
  if (stageParts.length > 1) {
    const focusedStageParts = stageParts.filter((el) => {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width * 0.5
      const cy = r.top + r.height * 0.5
      const centerIn = cx >= box.left && cx <= boxRight && cy >= box.top && cy <= boxBottom
      return centerIn || computeOverlapRatio(r, box) >= 0.35
    })
    if (focusedStageParts.length > 0 && focusedStageParts.length < stageParts.length) {
      const focusedSet = new Set(focusedStageParts)
      filtered = filtered.filter(
        (el) =>
          !el.matches?.('.lw-stage-layer-item, .layer-cutter-placed-layer') || focusedSet.has(el)
      )
    }
  }

  // 4. Bộ lọc Tập trung Tâm điểm (Anti-Grazing Dominance Filter) cho các UI Control thông thường:
  // Khi đã có ít nhất 1 control nằm trọn tâm hoặc có độ phủ cao (>= 45%) trong khung quét,
  // tự động loại bỏ các nút/control hàng xóm chỉ bị chạm sượt mép khung (< 30% diện tích và tâm nằm ngoài khung).
  if (filtered.length > 1) {
    const scored = filtered.map((el) => {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width * 0.5
      const cy = r.top + r.height * 0.5
      const centerIn = cx >= box.left && cx <= boxRight && cy >= box.top && cy <= boxBottom
      const elOverlap = computeOverlapRatio(r, box)
      const boxCover = computeBoxCoverageRatio(r, box)
      const isStrong =
        (centerIn && elOverlap >= 0.42) ||
        elOverlap >= 0.62 ||
        (boxCover >= 0.55 && elOverlap >= 0.25)
      return { el, centerIn, elOverlap, boxCover, isStrong }
    })

    const hasStrongTarget = scored.some((s) => s.isStrong)
    if (hasStrongTarget) {
      const focused = scored
        .filter((s) => s.isStrong || s.centerIn || s.elOverlap >= 0.32 || s.boxCover >= 0.35)
        .map((s) => s.el)
      if (focused.length > 0) {
        filtered = focused
      }
    }
  }

  filtered.sort((a, b) => {
    const ra = a.getBoundingClientRect()
    const rb = b.getBoundingClientRect()
    const acx = ra.left + ra.width * 0.5
    const acy = ra.top + ra.height * 0.5
    const bcx = rb.left + rb.width * 0.5
    const bcy = rb.top + rb.height * 0.5
    const aIn = acx >= box.left && acx <= boxRight && acy >= box.top && acy <= boxBottom
    const bIn = bcx >= box.left && bcx <= boxRight && bcy >= box.top && bcy <= boxBottom
    if (aIn !== bIn) return aIn ? -1 : 1
    const aOverlap = computeOverlapRatio(ra, box)
    const bOverlap = computeOverlapRatio(rb, box)
    if (Math.abs(aOverlap - bOverlap) > 0.22) return bOverlap - aOverlap
    return Math.hypot(acx - boxCx, acy - boxCy) - Math.hypot(bcx - boxCx, bcy - boxCy)
  })

  return filtered.slice(0, 12)
}

/**
 * Chụp toàn bộ trạng thái app + Xưởng 2.5D/3D/Dialogs và tạo snapshot cho AI & giao diện Xem trước.
 */
export function captureAiInspectorSnapshot(box: {
  left: number
  top: number
  width: number
  height: number
}): AiInspectorSnapshot {
  const elements = findElementsInBox(box)
  const scanned = elements.map((el, idx) => {
    const ctx = scanElementContext(el)
    ctx.isPrimaryFocus = idx === 0
    return ctx
  })
  const workshopContext = extractActiveWorkshopContext(box, elements)

  if (
    workshopContext?.workshopType === 'layer_assembly_25d' &&
    workshopContext.scannedParts.length > 0
  ) {
    const existingPartIds = new Set(scanned.map((s) => s.part25D?.id).filter(Boolean))
    for (const part of workshopContext.scannedParts) {
      if (!existingPartIds.has(part.id)) {
        scanned.unshift({
          element: (typeof document !== 'undefined' ? document.body : {}) as Element,
          tagName: 'layer-25d',
          kindLabel: 'Bộ phận 2.5D trong không gian 3D/2D',
          id: part.id,
          classes: ['lw-stage-layer-item'],
          text: `${part.name} (${part.roleLabel})`,
          title: `Độ sâu Z: ${part.z}px · Tỷ lệ: ${part.scale} · ${part.boneName ? `Xương: ${part.boneName}` : 'Chưa gắn xương'}`,
          primaryFile: 'src/renderer/src/ui/layerAssembly/AssembledLayerItemView.tsx',
          primaryHandler: 'onPointerDown={handleStartDragLayer}',
          componentChain: [
            {
              componentName: 'AssembledLayerItemView',
              fileInfo: 'src/renderer/src/ui/layerAssembly/AssembledLayerItemView.tsx',
              handlers: []
            },
            {
              componentName: 'LayerAssemblyViewport',
              fileInfo: 'src/renderer/src/ui/layerAssembly/LayerAssemblyViewport.tsx',
              handlers: []
            }
          ],
          mcpRegion: 'layer_assembly_viewport_2d',
          mcpDialog: 'layer_assembly',
          bounds: {
            left: Math.round(box.left),
            top: Math.round(box.top),
            width: Math.round(box.width),
            height: Math.round(box.height)
          },
          part25D: part,
          bone25D: null,
          isPrimaryFocus: true
        })
      }
    }
  }

  let primaryRegion = 'general_view'
  for (const item of scanned) {
    if (item.mcpRegion) {
      primaryRegion = item.mcpRegion
      break
    }
  }
  if (primaryRegion === 'general_view' && workshopContext?.workshopType === 'layer_assembly_25d') {
    primaryRegion = 'layer_assembly'
  }

  const editor = useEditor.getState()
  const view = useView.getState()

  const shots = editor.project.shots || []
  const shotIdx = shots.findIndex((s) => s.id === editor.selectedShotId)
  const activeShotIndex = shotIdx >= 0 ? shotIdx : 0
  const currentShot = shots[activeShotIndex]
  const shotName = currentShot ? currentShot.name : `Shot ${activeShotIndex + 1}`

  const selectedLayerNames: string[] = []
  if (editor.selectedLayerId) {
    const l = editor.project.layers.find((layer) => layer.id === editor.selectedLayerId)
    if (l) selectedLayerNames.push(`"${l.name}" (${l.id})`)
  }

  const activeDialog = resolveActiveDialogIdentifier(workshopContext?.workshopType, elements)

  return {
    rect: {
      left: Math.round(box.left),
      top: Math.round(box.top),
      width: Math.round(box.width),
      height: Math.round(box.height)
    },
    elements: scanned,
    primaryRegion,
    workshopContext,
    appState: {
      shotName,
      shotIndex: activeShotIndex + 1,
      currentTime: Number(editor.time.toFixed(2)),
      duration: Number(editor.project.comp.duration.toFixed(2)),
      fps: editor.project.comp.fps,
      isPlaying: editor.playing,
      selectedLayerNames,
      activeDialog,
      theme: view.theme
    }
  }
}
