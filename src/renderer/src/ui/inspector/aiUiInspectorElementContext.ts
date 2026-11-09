import {
  buildScanned25DBoneInfo,
  buildScanned25DPartInfo,
  type Scanned25DBoneInfo,
  type Scanned25DPartInfo
} from './aiUiInspectorWorkshopContext'
import {
  buildControlDetails,
  extractEnhancedFiberInfo,
  resolveLinkedTargetModule,
  type ScannedControlDetails
} from './aiUiInspectorControlMeta'
import {
  extractDomSceneEntityInfo,
  extractDomWorkflowNodeInfo,
  type ScannedSceneEntityInfo,
  type ScannedWorkflowNodeInfo
} from './aiUiInspectorSceneAndWorkflowContext'
import { getVisibleElementRect } from './aiUiInspectorGeometry'
import { resolveElementSurface } from './aiUiInspectorSurfaces'
import {
  buildShortDomPath,
  findCssSourcesForClasses,
  readDomSourceLocation
} from './aiUiInspectorSourceLocator'
import type { ScannedElementContext } from './aiUiInspectorScanner'

/**
 * Trích xuất ngữ cảnh của MỘT phần tử: DOM + React Fiber + vị trí JSX/CSS chính xác + bề mặt (dialog/popup)
 * + thông số control + bộ phận 2.5D / xương + Scene Layer / Workflow Node.
 */

function classifyElementKindLabel(
  el: Element,
  tagName: string,
  classes: string[],
  part25D: Scanned25DPartInfo | null,
  bone25D: Scanned25DBoneInfo | null,
  sceneEntity: ScannedSceneEntityInfo | null,
  workflowNode: ScannedWorkflowNodeInfo | null
): string {
  const role = el.getAttribute?.('role')
  const type = el.getAttribute?.('type')
  if (sceneEntity) return sceneEntity.bboxRoleLabel
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
    (classes.includes('lw-row') || classes.includes('lw-cutout-part-row') || classes.includes('layer-cutter-slot-card'))
  ) {
    return 'Hàng Bộ phận 2.5D trong danh sách'
  }
  if (part25D) return 'Bộ phận 2.5D'
  if (classes.includes('menu-item') || role === 'menuitem') return 'Mục chọn trong Menu Popup'
  if (classes.includes('custom-select-item') || role === 'option') return 'Mục chọn trong Danh sách xổ xuống'
  if (classes.includes('custom-select-trigger') || classes.includes('custom-select-wrap') || tagName === 'select') {
    return 'Hộp chọn danh sách (Select / Combobox)'
  }
  if (classes.includes('switch') || role === 'switch' || (tagName === 'input' && type === 'checkbox')) {
    return 'Công tắc Bật/Tắt (Switch)'
  }
  if ((tagName === 'input' && type === 'range') || role === 'slider') return 'Thanh trượt điều chỉnh (Range Slider)'
  if (classes.includes('tab') || classes.includes('pxs-tab') || role === 'tab') return 'Thẻ chuyển Tab'
  if (classes.includes('wf-v2-card')) {
    return workflowNode ? `Thẻ Node Sơ đồ (${workflowNode.levelLabel})` : 'Thẻ Node Sơ đồ (Workflow V2 Node)'
  }
  if (classes.includes('wf-v2-time-pill') || classes.includes('wf-v2-timebar')) return 'Thanh Thời lượng Node'
  if (classes.includes('wf-v2-socket')) return 'Cổng nối dây sơ đồ'
  if (tagName === 'canvas') return 'Khung vẽ Đồ hoạ (Canvas 2D/3D)'
  if (tagName === 'input' || tagName === 'textarea' || classes.includes('num')) return 'Ô nhập / Điều chỉnh thông số'
  if (tagName === 'button' || classes.includes('btn') || role === 'button') return 'Nút bấm thao tác'
  if (/^h[1-4]$/.test(tagName)) return 'Tiêu đề / Nhãn khu vực'
  if (classes.some((c) => c.includes('card'))) return 'Thẻ cấu hình / Node'
  return 'Thành phần giao diện'
}

/** Nhãn tường minh cho control con bên trong Thẻ Node Workflow V2 (tránh ký tự đơn "−", "🔒", "0.0–15.0s"). */
function labelWorkflowNodeChild(
  el: Element,
  classes: string[],
  cleanText: string,
  workflowNode: ScannedWorkflowNodeInfo
): string {
  const titleAttr = el.getAttribute?.('title') || ''
  if (classes.includes('wf-v2-icon-btn')) {
    if (cleanText === '−' || cleanText.startsWith('+')) {
      const actionWord = titleAttr.includes('Thu gọn')
        ? 'Thu gọn mảnh phụ'
        : titleAttr.includes('Bung')
          ? 'Bung mở rộng'
          : 'Thu gọn/Bung'
      return `Nút ${actionWord} (${cleanText})`
    }
    if (classes.includes('danger') || cleanText === '✕') return 'Nút Xoá Node khỏi Layer (✕)'
    if (classes.includes('wf-v2-cam-add-btn') || cleanText === '+') return 'Nút Thêm mốc quay Camera (+)'
    if (cleanText.length <= 2 && titleAttr) return `Nút ${titleAttr.slice(0, 45)} (${cleanText})`
    return cleanText
  }
  if (classes.includes('wf-v2-toggle-pill') || el.getAttribute?.('role') === 'switch') {
    if (workflowNode.logicCategory === 'cluster_lock' || cleanText === '🔒' || cleanText === '🔓') {
      const isLocked = cleanText === '🔒' || cleanText === 'BẬT' || el.classList?.contains?.('on')
      return `Công tắc Khóa Cụm 2.5D (${isLocked ? '🔒 Đang Khóa' : '🔓 Đang Mở'})`
    }
    const onState = el.classList?.contains?.('on') ? 'BẬT' : 'TẮT'
    return `Công tắc Bật/Tắt Node (${cleanText || onState})`
  }
  if (classes.includes('wf-v2-time-pill') || el.closest?.('.wf-v2-timebar')) return `Thời lượng Node (${cleanText})`
  if (classes.includes('wf-v2-socket')) {
    const isIn = classes.includes('in') || classes.includes('port-left') || classes.includes('port-top')
    return `Cổng kết nối dây (${isIn ? 'Cổng Vào' : 'Cổng Ra'})`
  }
  if (classes.includes('wf-v2-card-badge')) return `Huy hiệu Cấp bậc Node (${cleanText})`
  if (classes.includes('wf-v2-time-chip')) return `Chip Nhóm Thời gian (${cleanText})`
  if (cleanText.length <= 2 && titleAttr) return `${titleAttr.slice(0, 45)} (${cleanText})`
  return cleanText
}

const SCENE_ENTITY_CLASSES = [
  'wf-v2-direct-layer-bbox',
  'wf-v2-direct-cam-bbox',
  'wf-v2-direct-layer',
  'layer-gizmo',
  'anim2d-selected-layer-bbox',
  'anim2d-layer-item',
  'anim2d-layer-pin'
]

/** Văn bản mô tả khi phần tử không có chữ (icon button, canvas…). */
function fallbackElementText(
  el: Element,
  part25D: Scanned25DPartInfo | null,
  bone25D: Scanned25DBoneInfo | null,
  controlDetails: ScannedControlDetails
): string {
  const ariaLabel = el.getAttribute?.('aria-label')?.trim()
  const titleAttr = el.getAttribute?.('title')?.trim()
  const attrName =
    el.getAttribute?.('data-scene-layer-name') ||
    el.getAttribute?.('data-layer-name') ||
    el.getAttribute?.('data-bone-name') ||
    el.getAttribute?.('data-ai-id')
  if (ariaLabel && ariaLabel.length <= 80) return ariaLabel
  if (attrName) return attrName
  if (part25D) return `${part25D.name} (${part25D.roleLabel})`
  if (bone25D) return `Xương: ${bone25D.name}`
  if (controlDetails.fieldLabel) {
    return controlDetails.axis ? `${controlDetails.fieldLabel} (${controlDetails.axis})` : controlDetails.fieldLabel
  }
  if (titleAttr && titleAttr.length <= 80) return titleAttr
  if (typeof el.querySelector === 'function') {
    const childImg = el.querySelector('img[alt]')
    const svgTitle = el.querySelector('title')
    return childImg?.getAttribute('alt') || svgTitle?.textContent?.trim()?.slice(0, 80) || ''
  }
  return ''
}

function resolveElementText(
  el: Element,
  classes: string[],
  ctx: {
    sceneEntity: ScannedSceneEntityInfo | null
    workflowNode: ScannedWorkflowNodeInfo | null
    part25D: Scanned25DPartInfo | null
    bone25D: Scanned25DBoneInfo | null
    controlDetails: ScannedControlDetails
  }
): string {
  const rawText = (el as HTMLElement).innerText || el.textContent || ''
  const cleanText = rawText.replace(/\s+/g, ' ').trim().slice(0, 80)
  const isV2Card = classes.includes('wf-v2-card')
  const isSceneEntityEl =
    SCENE_ENTITY_CLASSES.some((c) => classes.includes(c)) || Boolean(el.hasAttribute?.('data-scene-layer-id'))
  if (ctx.sceneEntity && isSceneEntityEl) return ctx.sceneEntity.displayName
  if (ctx.workflowNode && isV2Card) return ctx.workflowNode.title
  if (ctx.workflowNode) return labelWorkflowNodeChild(el, classes, cleanText, ctx.workflowNode)
  if (cleanText) return cleanText
  return fallbackElementText(el, ctx.part25D, ctx.bone25D, ctx.controlDetails)
}

function readAttrFromSelfOrAncestor(el: Element, attr: string): string | null {
  return el.getAttribute?.(attr) || el.closest?.(`[${attr}]`)?.getAttribute?.(attr) || null
}

/**
 * Trích xuất toàn bộ ngữ cảnh DOM + React Fiber + Thông số Control + Bộ phận 2.5D/Xương + Scene Layer/Workflow Node.
 */
export function scanElementContext(el: Element): ScannedElementContext {
  const rect = getVisibleElementRect(el)
  const rawRect = rect.width > 0 && rect.height > 0 ? rect : el.getBoundingClientRect()
  const fiberResult = extractEnhancedFiberInfo(el)
  const { componentChain, primaryFile, primaryHandler, ownerComponentName } = fiberResult

  const layerAttrId = readAttrFromSelfOrAncestor(el, 'data-layer-id')
  const boneAttrId =
    el.getAttribute?.('data-bone-id') ||
    el.getAttribute?.('data-bone-row') ||
    el.closest?.('[data-bone-id]')?.getAttribute?.('data-bone-id') ||
    null

  const part25D = layerAttrId ? buildScanned25DPartInfo(layerAttrId) : null
  const bone25D = boneAttrId ? buildScanned25DBoneInfo(boneAttrId) : null
  const sceneEntity = extractDomSceneEntityInfo(el)
  const workflowNode = extractDomWorkflowNodeInfo(el)

  const classes = Array.from(el.classList || []).filter((c) => !c.startsWith('ai-ui-') && !c.includes('hover'))
  const tagName = (el.tagName || 'div').toLowerCase()
  const controlDetails = buildControlDetails(el, tagName, classes, fiberResult)
  const text = resolveElementText(el, classes, { sceneEntity, workflowNode, part25D, bone25D, controlDetails })

  const mcpRegion = readAttrFromSelfOrAncestor(el, 'data-mcp-region')
  const mcpDialogEl = el.closest?.('[data-mcp-dialog]')
  const mcpDialog = mcpDialogEl ? mcpDialogEl.getAttribute('data-mcp-dialog') : null

  const title =
    el.getAttribute?.('title') ||
    el.getAttribute?.('aria-label') ||
    el.getAttribute?.('placeholder') ||
    (sceneEntity ? `${sceneEntity.bboxRoleLabel} · ${sceneEntity.coordsSummary}` : null)

  const kindLabel = classifyElementKindLabel(el, tagName, classes, part25D, bone25D, sceneEntity, workflowNode)
  const isV2Card = classes.includes('wf-v2-card')
  const effectiveId =
    el.id || sceneEntity?.layerId || (isV2Card ? workflowNode?.nodeId : null) || layerAttrId || boneAttrId || ''
  const linkedTarget = resolveLinkedTargetModule(effectiveId, classes, primaryHandler, mcpRegion)

  return {
    element: el,
    tagName,
    kindLabel,
    id: effectiveId,
    classes,
    text,
    title,
    primaryFile,
    primaryHandler,
    componentChain,
    mcpRegion,
    mcpDialog,
    bounds: {
      left: Math.round(rawRect.left),
      top: Math.round(rawRect.top),
      width: Math.round(rawRect.width),
      height: Math.round(rawRect.height)
    },
    part25D,
    bone25D,
    sceneEntity,
    workflowNode,
    ownerComponentName,
    controlDetails,
    linkedTarget,
    sourceLocation: readDomSourceLocation(el)?.ref || null,
    cssSources: findCssSourcesForClasses(classes),
    surface: resolveElementSurface(el),
    domPath: buildShortDomPath(el)
  }
}
