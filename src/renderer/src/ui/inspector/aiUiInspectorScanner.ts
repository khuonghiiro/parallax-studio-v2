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
export { formatAiInspectorMarkdown } from './aiUiInspectorMarkdown'

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

const STACK_REGEX =
  /at\s+([A-Za-z0-9_$]+)\s+\((?:https?:\/\/[^\/]+|[a-zA-Z]:[^\/]+)?\/(src\/[^?:]+)(?:\?[^:]*)?:(\d+)(?::(\d+))?\)/g

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

const INTERACTIVE_ELEMENT_SELECTORS = [
  '.menu-item',
  '[role="menuitem"]',
  '[role="option"]',
  '.custom-select-item',
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

function summarizeHandlerFunction(key: string, fn: Function): string {
  const rawName = fn.name || ''
  if (
    rawName &&
    rawName !== key &&
    rawName !== 'anonymous' &&
    rawName !== 'onClick' &&
    rawName !== 'onPointerDown' &&
    rawName !== 'onChange' &&
    rawName !== 'stop'
  ) {
    return `${key}={${rawName}}`
  }
  try {
    const src = Function.prototype.toString.call(fn).replace(/\s+/g, ' ').trim()
    const arrowIdx = src.indexOf('=>')
    if (arrowIdx >= 0) {
      let body = src.slice(arrowIdx + 2).trim()
      if (body.startsWith('{') && body.endsWith('}')) {
        body = body.slice(1, -1).trim()
      }
      if (body.length > 0 && body.length <= 68 && !body.includes('[native code]')) {
        return `${key}={() => ${body}}`
      }
    }
  } catch {
    /* ignore */
  }
  return `${key}={${rawName || 'anonymous'}}`
}

/**
 * Phân tích React Fiber và trích xuất cây component, đường dẫn file nguồn (.tsx) và tên hàm xử lý.
 */
export function extractFiberInfo(domNode: Element): {
  componentChain: ElementFiberInfo[]
  primaryFile: string | null
  primaryHandler: string | null
} {
  const keys = Object.keys(domNode)
  const fiberKey = keys.find(
    (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
  )
  const fiber = fiberKey ? (domNode as Record<string, any>)[fiberKey] : null
  if (!fiber) {
    return { componentChain: [], primaryFile: null, primaryHandler: null }
  }

  const componentChain: ElementFiberInfo[] = []
  let primaryFile: string | null = null
  let primaryHandler: string | null = null

  let curr = fiber
  let depth = 0
  const maxDepth = 20

  while (curr && depth < maxDepth) {
    depth++
    const rawType = curr.type
    const name = rawType
      ? typeof rawType === 'string'
        ? rawType
        : rawType.displayName || rawType.name || 'Component'
      : ''

    let fileInfo: string | null = null

    if (curr._debugSource && curr._debugSource.fileName) {
      const fn = String(curr._debugSource.fileName).replace(/\\/g, '/')
      const norm = fn.includes('src/') ? fn.slice(fn.indexOf('src/')) : fn
      fileInfo = `${norm}:${curr._debugSource.lineNumber}`
    } else if (curr._debugStack) {
      const s = curr._debugStack.stack || String(curr._debugStack)
      STACK_REGEX.lastIndex = 0
      const m = STACK_REGEX.exec(s)
      if (m) {
        let filePath = m[2]
        if (!filePath.startsWith('src/renderer/') && filePath.startsWith('src/')) {
          filePath = `src/renderer/${filePath}`
        }
        fileInfo = `${filePath}:${m[3]}`
      }
    }

    if (fileInfo && !primaryFile && !fileInfo.includes('node_modules')) {
      primaryFile = fileInfo
    }

    const props = curr.memoizedProps || {}
    const handlers: string[] = []
    for (const key of Object.keys(props)) {
      if (key.startsWith('on') && typeof props[key] === 'function') {
        const formatted = summarizeHandlerFunction(key, props[key])
        handlers.push(formatted)
        if (!primaryHandler && (key === 'onClick' || key === 'onPointerDown' || key === 'onChange')) {
          primaryHandler = formatted
        }
      }
    }

    if (
      name &&
      !['div', 'span', 'p', 'svg', 'path', 'g', 'circle', 'rect', 'polygon', 'line', 'defs'].includes(
        name.toLowerCase()
      )
    ) {
      componentChain.push({ componentName: name, fileInfo, handlers })
    }

    curr = curr.return
  }

  return { componentChain, primaryFile, primaryHandler }
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
  if (part25D && (classes.includes('lw-row') || classes.includes('lw-cutout-part-row') || classes.includes('layer-cutter-slot-card'))) {
    return 'Hàng Bộ phận 2.5D trong danh sách'
  }
  if (part25D) return 'Bộ phận 2.5D'
  if (classes.includes('menu-item') || el.getAttribute?.('role') === 'menuitem') {
    return 'Mục chọn trong Menu Popup'
  }
  if (classes.includes('custom-select-item') || el.getAttribute?.('role') === 'option') {
    return 'Mục chọn trong Danh sách xổ xuống'
  }
  if (classes.includes('tab') || classes.includes('pxs-tab') || el.getAttribute?.('role') === 'tab') {
    return 'Thẻ chuyển Tab'
  }
  if (tagName === 'canvas') return 'Khung vẽ Đồ hoạ (Canvas 2D/3D)'
  if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') {
    return 'Ô nhập / Điều chỉnh thông số'
  }
  if (tagName === 'button' || classes.includes('btn') || el.getAttribute?.('role') === 'button') {
    return 'Nút bấm thao tác'
  }
  if (classes.some((c) => c.includes('card'))) return 'Thẻ cấu hình / Node'
  return 'Thành phần giao diện'
}

/**
 * Trích xuất toàn bộ ngữ cảnh DOM + React + Bộ phận 2.5D/Xương của 1 phần tử.
 */
export function scanElementContext(el: Element): ScannedElementContext {
  const rect = el.getBoundingClientRect()
  const { componentChain, primaryFile, primaryHandler } = extractFiberInfo(el)

  const layerAttrId =
    el.getAttribute?.('data-layer-id') || el.closest?.('[data-layer-id]')?.getAttribute?.('data-layer-id') || null
  const boneAttrId =
    el.getAttribute?.('data-bone-id') ||
    el.getAttribute?.('data-bone-row') ||
    el.closest?.('[data-bone-id]')?.getAttribute?.('data-bone-id') ||
    null

  const part25D = layerAttrId ? buildScanned25DPartInfo(layerAttrId) : null
  const bone25D = boneAttrId ? buildScanned25DBoneInfo(boneAttrId) : null

  const rawText = (el as HTMLElement).innerText || el.textContent || ''
  let cleanText = rawText.replace(/\s+/g, ' ').trim().slice(0, 80)

  if (!cleanText) {
    const attrName = el.getAttribute?.('data-layer-name') || el.getAttribute?.('data-bone-name')
    if (attrName) {
      cleanText = attrName
    } else if (part25D) {
      cleanText = `${part25D.name} (${part25D.roleLabel})`
    } else if (bone25D) {
      cleanText = `Xương: ${bone25D.name}`
    } else if (typeof el.querySelector === 'function') {
      const childImg = el.querySelector('img[alt]')
      const svgTitle = el.querySelector('title')
      cleanText =
        childImg?.getAttribute('alt') || svgTitle?.textContent?.trim()?.slice(0, 80) || ''
    }
  }

  const mcpRegionEl = el.closest?.('[data-mcp-region]')
  const mcpRegion = mcpRegionEl ? mcpRegionEl.getAttribute('data-mcp-region') : null

  const mcpDialogEl = el.closest?.('[data-mcp-dialog]')
  const mcpDialog = mcpDialogEl ? mcpDialogEl.getAttribute('data-mcp-dialog') : null

  const title =
    el.getAttribute?.('title') ||
    el.getAttribute?.('aria-label') ||
    el.getAttribute?.('placeholder') ||
    null

  const classes = Array.from(el.classList || []).filter(
    (c) => !c.startsWith('ai-ui-') && !c.includes('hover')
  )
  const tagName = (el.tagName || 'div').toLowerCase()
  const kindLabel = classifyElementKindLabel(el, tagName, classes, part25D, bone25D)

  return {
    element: el,
    tagName,
    kindLabel,
    id: el.id || layerAttrId || boneAttrId || '',
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
    bone25D
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
  return !(r.right < box.left || r.left > boxRight || r.bottom < box.top || r.top > boxBottom)
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

/**
 * Tìm kiếm các phần tử giao diện nằm bên trong hoặc cắt ngang khung quét hình chữ nhật.
 * Tự động ưu tiên Popup đang mở (Menu, Dropdown, Flyout) và Hộp thoại / Xưởng nổi trên cùng (như Xưởng Lắp Ráp 2.5D),
 * loại bỏ hoàn toàn các phần tử nền bị che khuất phía dưới.
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
      '.menu-item, [role="menuitem"], .lw-stage-layer-item, .layer-cutter-placed-layer, .lw-cutout-preview-tile, .lw-layer-callout-bubble, g.lw-blender-bone, .lw-bone-item, [data-bone-id], [data-layer-id], button, input, select, textarea, [role="button"], a, .btn, .tab, .pxs-tab, .lw-row, .card, .shot-item, .tl-track, .panel-header, [data-mcp-region]'
    )
    return [meaningful || target]
  }

  const selector = INTERACTIVE_ELEMENT_SELECTORS.join(', ')

  const openPopups: Element[] = []
  try {
    const popupNodes = Array.from(document.querySelectorAll(POPUP_CONTAINER_SELECTORS.join(', ')))
    for (const pop of popupNodes) {
      if (isInspectorInternalElement(pop)) continue
      const r = pop.getBoundingClientRect()
      if (rectIntersectsBox(r, box)) {
        openPopups.push(pop)
      }
    }
  } catch {
    /* ignore in mock environment */
  }

  let scopeRoots: Array<Element | Document> = [document]
  if (openPopups.length > 0) {
    scopeRoots = openPopups.map((p) => p.closest?.('.menu-wrap') || p)
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

  // Khử trùng lặp cha-con & canvas phụ bên trong bộ phận 2.5D
  let filtered = matched.filter((el) => {
    if ((el.tagName || '').toLowerCase() === 'canvas') {
      const parentPart = el.closest?.('[data-layer-id]')
      if (parentPart && parentPart !== el && matched.includes(parentPart)) {
        return false
      }
    }
    const hasDescendantInMatched = matched.some((other) => other !== el && el.contains?.(other))
    if (
      hasDescendantInMatched &&
      el.matches?.(
        '[data-mcp-region], .panel, .tabs, header, aside, .viewer-wrap, .layer-workshop-dialog, .lw-workspace-column'
      )
    ) {
      return false
    }
    return true
  })

  // Nếu có các bộ phận sân khấu 2.5D nằm gọn tâm trong khung quét, lọc bỏ các bộ phận nền khổng lồ chỉ sượt nhẹ qua góc
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
    return Math.hypot(acx - boxCx, acy - boxCy) - Math.hypot(bcx - boxCx, bcy - boxCy)
  })

  return filtered.slice(0, 14)
}

/**
 * Chụp toàn bộ trạng thái app + Xưởng 2.5D/3D và tạo snapshot cho AI & giao diện Xem trước.
 */
export function captureAiInspectorSnapshot(box: {
  left: number
  top: number
  width: number
  height: number
}): AiInspectorSnapshot {
  const elements = findElementsInBox(box)
  const scanned = elements.map(scanElementContext)
  const workshopContext = extractActiveWorkshopContext(box, elements)

  if (workshopContext?.workshopType === 'layer_assembly_25d' && workshopContext.scannedParts.length > 0) {
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
            { componentName: 'AssembledLayerItemView', fileInfo: 'src/renderer/src/ui/layerAssembly/AssembledLayerItemView.tsx', handlers: [] },
            { componentName: 'LayerAssemblyViewport', fileInfo: 'src/renderer/src/ui/layerAssembly/LayerAssemblyViewport.tsx', handlers: [] }
          ],
          mcpRegion: 'layer_assembly_viewport_2d',
          mcpDialog: 'layer_assembly',
          bounds: { left: Math.round(box.left), top: Math.round(box.top), width: Math.round(box.width), height: Math.round(box.height) },
          part25D: part,
          bone25D: null
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

  const activeDialog =
    workshopContext?.workshopType === 'layer_assembly_25d'
      ? 'layer_assembly'
      : view.dialog || (view.assemblyModalModel ? 'create_3d' : null)

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
