import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import { findActiveDialog } from '../../mcp/uiRegions'
import {
  extractActiveWorkshopContext,
  type AiWorkshopContext,
  type Scanned25DBoneInfo,
  type Scanned25DPartInfo
} from './aiUiInspectorWorkshopContext'
import { resolveActiveDialogIdentifier } from './aiUiInspectorDialogContext'
import {
  extractEnhancedFiberInfo,
  type LinkedTargetModule,
  type ScannedControlDetails
} from './aiUiInspectorControlMeta'
import {
  enrichScannedWithViewerSceneHits,
  type ScannedSceneEntityInfo,
  type ScannedWorkflowNodeInfo
} from './aiUiInspectorSceneAndWorkflowContext'
import { findElementsInBox } from './aiUiInspectorElementFinder'
import { scanElementContext } from './aiUiInspectorElementContext'
import type { ScanBox } from './aiUiInspectorGeometry'
import type { ScannedSurfaceInfo } from './aiUiInspectorSurfaces'

/**
 * AI UI Inspector — điểm vào quét vùng giao diện (Win + Alt + kéo khung).
 * Module con:
 *  - `aiUiInspectorElementFinder.ts`  : tìm phần tử trong khung (phạm vi dialog/popup, hit-test che khuất).
 *  - `aiUiInspectorElementContext.ts` : ngữ cảnh từng phần tử (Fiber, JSX `data-ai-src`, CSS, bề mặt).
 *  - `aiUiInspectorSurfaces.ts`       : nhận diện Dialog / Popup / Màn hình chính.
 *  - `aiUiInspectorSourceLocator.ts`  : file:dòng JSX + CSS chính xác.
 *  - `aiUiInspectorMarkdown.ts`       : báo cáo Markdown gửi AI.
 */

export { formatAiInspectorMarkdown } from './aiUiInspectorMarkdown'
export { findElementsInBox } from './aiUiInspectorElementFinder'
export { scanElementContext } from './aiUiInspectorElementContext'
export type { LinkedTargetModule, ScannedControlDetails } from './aiUiInspectorControlMeta'
export type { ScannedSceneEntityInfo, ScannedWorkflowNodeInfo } from './aiUiInspectorSceneAndWorkflowContext'
export type { ScannedSurfaceInfo } from './aiUiInspectorSurfaces'
export type { ScannedComputedSizing, InspectorViewportInfo } from './aiUiInspectorSizing'
export type { ElementActiveFocusState } from './aiUiInspectorActiveFocus'
import { rankAndDesignatePrimaryFocus } from './aiUiInspectorActiveFocus'
import { getCurrentInspectorViewport } from './aiUiInspectorSizing'

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
  computedSizing?: import('./aiUiInspectorSizing').ScannedComputedSizing | null
  part25D?: Scanned25DPartInfo | null
  bone25D?: Scanned25DBoneInfo | null
  sceneEntity?: ScannedSceneEntityInfo | null
  workflowNode?: ScannedWorkflowNodeInfo | null
  ownerComponentName?: string | null
  controlDetails?: ScannedControlDetails | null
  linkedTarget?: LinkedTargetModule | null
  isPrimaryFocus?: boolean
  isFocused?: boolean
  isActive?: boolean
  focusReason?: string | null
  activeReason?: string | null
  activeStateLabel?: string | null
  /** file:dòng JSX CHÍNH XÁC đã render phần tử (thuộc tính `data-ai-src`, chỉ có khi dev) */
  sourceLocation?: string | null
  /** File CSS + dòng định nghĩa class của phần tử, ví dụ `src/renderer/src/styles/toolbar.css:42 (.tb-btn)` */
  cssSources?: string[]
  /** Bề mặt chứa phần tử: Dialog / Popup / Màn hình chính */
  surface?: ScannedSurfaceInfo | null
  /** Đường dẫn DOM ngắn để grep / `ui_click` */
  domPath?: string
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
  viewport?: import('./aiUiInspectorSizing').InspectorViewportInfo
}

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

function roundBox(box: ScanBox): ScanBox {
  return {
    left: Math.round(box.left),
    top: Math.round(box.top),
    width: Math.round(box.width),
    height: Math.round(box.height)
  }
}

/** Bộ phận 2.5D phát hiện qua khung nhìn Xưởng (không có DOM riêng) → phần tử tổng hợp cho báo cáo. */
function buildSyntheticPartItem(part: Scanned25DPartInfo, box: ScanBox): ScannedElementContext {
  return {
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
    bounds: part.screenBounds || roundBox(box),
    part25D: part,
    bone25D: null,
    isPrimaryFocus: true
  }
}

function mergeWorkshopParts(
  scanned: ScannedElementContext[],
  workshopContext: AiWorkshopContext | null,
  box: ScanBox
): void {
  if (workshopContext?.workshopType !== 'layer_assembly_25d' || workshopContext.scannedParts.length === 0) return
  const existingPartIds = new Set(scanned.map((s) => s.part25D?.id).filter(Boolean))
  for (const part of workshopContext.scannedParts) {
    if (!existingPartIds.has(part.id)) scanned.unshift(buildSyntheticPartItem(part, box))
  }
}

function resolvePrimaryRegion(scanned: ScannedElementContext[], workshopContext: AiWorkshopContext | null): string {
  const withRegion = scanned.find((item) => item.mcpRegion)
  if (withRegion?.mcpRegion) return withRegion.mcpRegion
  return workshopContext?.workshopType === 'layer_assembly_25d' ? 'layer_assembly' : 'general_view'
}

function buildAppState(activeDialog: string | null): AiInspectorSnapshot['appState'] {
  const editor = useEditor.getState()
  const view = useView.getState()
  const shots = editor.project.shots || []
  const shotIdx = shots.findIndex((s) => s.id === editor.selectedShotId)
  const activeShotIndex = shotIdx >= 0 ? shotIdx : 0
  const currentShot = shots[activeShotIndex]
  const selectedLayerNames: string[] = []
  if (editor.selectedLayerId) {
    const l = editor.project.layers.find((layer) => layer.id === editor.selectedLayerId)
    if (l) selectedLayerNames.push(`"${l.name}" (${l.id})`)
  }
  return {
    shotName: currentShot ? currentShot.name : `Shot ${activeShotIndex + 1}`,
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

/**
 * Chụp toàn bộ trạng thái app + Xưởng 2.5D/3D/Dialogs/Scene Layers và tạo snapshot cho AI & giao diện Xem trước.
 */
export function captureAiInspectorSnapshot(box: ScanBox, maxElements?: number): AiInspectorSnapshot {
  const editor = useEditor.getState()
  const elements = findElementsInBox(box, maxElements)
  let scanned = elements.map((el) => scanElementContext(el))
  const workshopContext = extractActiveWorkshopContext(box, elements)

  // Layer / Cụm 2.5D trong Khung nhìn 3D (#viewer-canvas) qua cầu nối WebGL Raycast & 3D Projection
  scanned = enrichScannedWithViewerSceneHits(editor.project, box, scanned, Boolean(findActiveDialog(document)))
  mergeWorkshopParts(scanned, workshopContext, box)
  scanned = rankAndDesignatePrimaryFocus(scanned)

  return {
    rect: roundBox(box),
    elements: scanned,
    primaryRegion: resolvePrimaryRegion(scanned, workshopContext),
    workshopContext,
    appState: buildAppState(resolveActiveDialogIdentifier(workshopContext?.workshopType, elements)),
    viewport: getCurrentInspectorViewport()
  }
}
