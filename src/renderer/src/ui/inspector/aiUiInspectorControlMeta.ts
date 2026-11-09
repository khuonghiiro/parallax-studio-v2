import type { ElementFiberInfo } from './aiUiInspectorScanner'
import { readFiberPropsSource } from './aiUiInspectorSourceLocator'

export interface LinkedTargetModule {
  name: string
  file: string
  subFiles?: string[]
  description: string
}

export interface ScannedControlDetails {
  /** Nhãn ngữ nghĩa của thông số / control (VD: "Độ phân giải", "Vị trí", "Chế độ hoà trộn") */
  fieldLabel: string | null
  /** Trục tọa độ nếu có (VD: "X", "Y", "Z") */
  axis: string | null
  /** Giá trị hiện tại đang hiển thị hoặc đang chọn */
  currentValue: string | null
  /** Phạm vi giá trị nếu là thanh trượt / ô số */
  rangeSpec: string | null
  /** Danh sách các lựa chọn nếu là Select / SegmentedTabs */
  optionsSummary: string | null
  /** Liên kết thuộc tính store nếu là AnimRow / PropRef */
  propBinding: string | null
  /** Tên component control dùng chung (VD: "CustomSelect", "NumberInput", "AnimRow", "Slider", "Switch", "SegmentedTabs") */
  primitiveName: string | null
  /** File nguồn của primitive control nếu khác với primaryFile */
  primitiveFile: string | null
  /** Selector định danh ngắn gọn nhất để tìm trong code hoặc gọi MCP ui_click */
  targetSelector: string
}

const STACK_REGEX =
  /at\s+([A-Za-z0-9_$]+)\s+\((?:https?:\/\/[^\/]+|[a-zA-Z]:[^\/]+)?\/(src\/[^?:]+)(?:\?[^:]*)?:(\d+)(?::(\d+))?\)/g

/** Danh sách file UI primitive dùng chung — cần vượt qua để lấy đúng file nghiệp vụ / Dialog gọi nó */
const SHARED_PRIMITIVE_PATTERNS = [
  'src/renderer/src/ui/controls.tsx',
  'src/renderer/src/ui/controls/',
  'src/renderer/src/ui/primitives/',
  'src/renderer/src/ui/icons.tsx',
  'src/renderer/src/ui/remote/remoteIcons.tsx'
]

const SHARED_PRIMITIVE_COMPONENT_NAMES = new Set([
  'NumberInput',
  'AnimRow',
  'Row',
  'Switch',
  'Slider',
  'TextInput',
  'CustomSelect',
  'Select',
  'Menu',
  'MenuPortal',
  'ColorInput',
  'ColorPicker',
  'SegmentedTabs',
  'CollapsibleRail',
  'IconActionBar',
  'ToolCluster'
])

const HTML_HOST_TAGS = new Set([
  'div',
  'span',
  'p',
  'svg',
  'path',
  'g',
  'circle',
  'rect',
  'polygon',
  'polyline',
  'line',
  'defs',
  'lineargradient',
  'radialgradient',
  'stop',
  'clippath',
  'button',
  'input',
  'select',
  'option',
  'textarea',
  'label',
  'header',
  'footer',
  'aside',
  'section',
  'main',
  'nav',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'a',
  'img',
  'canvas',
  'form',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'strong',
  'b',
  'i',
  'em',
  'small',
  'code',
  'pre',
  'kbd'
])

export function isSharedPrimitiveFile(fileInfo: string | null | undefined): boolean {
  if (!fileInfo) return false
  const clean = fileInfo.replace(/\\/g, '/')
  return SHARED_PRIMITIVE_PATTERNS.some((pat) => clean.includes(pat))
}

export function summarizeHandlerFunction(key: string, fn: Function): string {
  const rawName = fn.name || ''
  if (
    rawName &&
    rawName !== key &&
    rawName !== 'anonymous' &&
    rawName !== 'onClick' &&
    rawName !== 'onPointerDown' &&
    rawName !== 'onChange' &&
    rawName !== 'onCommit' &&
    rawName !== 'handleClick' &&
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
      if (body.length > 0 && body.length <= 92 && !body.includes('[native code]')) {
        return `${key}={() => ${body}}`
      }
    }
  } catch {
    /* ignore */
  }
  return `${key}={${rawName || 'anonymous'}}`
}

function extractDebugSourceFile(fiber: any): string | null {
  if (!fiber) return null
  // Chính xác nhất: `data-ai-src` do Babel plugin dev chèn vào JSX (host = nơi viết thẻ, component = call-site)
  const exact = readFiberPropsSource(fiber.memoizedProps || fiber.pendingProps)
  if (exact) return exact
  if (fiber._debugSource && fiber._debugSource.fileName) {
    const fn = String(fiber._debugSource.fileName).replace(/\\/g, '/')
    const norm = fn.includes('src/') ? fn.slice(fn.indexOf('src/')) : fn
    return `${norm}:${fiber._debugSource.lineNumber}`
  }
  if (fiber._debugStack) {
    const s = fiber._debugStack.stack || String(fiber._debugStack)
    STACK_REGEX.lastIndex = 0
    const m = STACK_REGEX.exec(s)
    if (m) {
      let filePath = m[2]
      if (!filePath.startsWith('src/renderer/') && filePath.startsWith('src/')) {
        filePath = `src/renderer/${filePath}`
      }
      return `${filePath}:${m[3]}`
    }
  }
  return null
}

function isInternalPrimitiveHandler(
  componentName: string,
  fileInfo: string | null,
  formattedHandler: string
): boolean {
  if (
    isSharedPrimitiveFile(fileInfo) ||
    SHARED_PRIMITIVE_COMPONENT_NAMES.has(componentName)
  ) {
    if (
      formattedHandler.includes('setIsOpen') ||
      formattedHandler.includes('handleOpen') ||
      formattedHandler.includes('setOpen') ||
      formattedHandler.includes('setText') ||
      formattedHandler.includes('startScrub') ||
      formattedHandler.includes('commit') ||
      formattedHandler.includes('onChange(!active)') ||
      formattedHandler.includes('onChange(item.id)') ||
      formattedHandler.includes('handleSelectOption') ||
      formattedHandler.includes('e.preventDefault()')
    ) {
      return true
    }
  }
  return false
}

export interface FiberExtractionResult {
  componentChain: ElementFiberInfo[]
  primaryFile: string | null
  primaryHandler: string | null
  ownerComponentName: string | null
  primitiveName: string | null
  primitiveFile: string | null
  fiberPropsMeta: {
    label: string | null
    axis: string | null
    value: unknown
    min: number | undefined
    max: number | undefined
    step: number | undefined
    suffix: string | undefined
    options: Array<{ label: string; value: unknown }> | null
    propBinding: string | null
  }
}

/**
 * Phân tích sâu cây React Fiber:
 * - Tách bạch file UI Primitive (`controls.tsx`, `CustomSelect.tsx`, `SegmentedTabs.tsx`...) với file Nghiệp vụ / Dialog thực sự gọi control đó (`primaryFile`).
 * - Trích xuất hàm xử lý nghiệp vụ thực (`primaryHandler`) thay vì hàm đóng/mở nội bộ của control.
 * - Trích xuất nhãn thông số (`label`), giá trị hiện tại (`value`), danh sách `options`, và `PropRef` (`refp`).
 */
export function extractEnhancedFiberInfo(domNode: Element): FiberExtractionResult {
  const emptyMeta: FiberExtractionResult['fiberPropsMeta'] = {
    label: null,
    axis: null,
    value: undefined,
    min: undefined,
    max: undefined,
    step: undefined,
    suffix: undefined,
    options: null,
    propBinding: null
  }
  if (!domNode || typeof domNode !== 'object') {
    return {
      componentChain: [],
      primaryFile: null,
      primaryHandler: null,
      ownerComponentName: null,
      primitiveName: null,
      primitiveFile: null,
      fiberPropsMeta: emptyMeta
    }
  }

  const keys = Object.keys(domNode)
  const fiberKey = keys.find(
    (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
  )
  const fiber = fiberKey ? (domNode as Record<string, any>)[fiberKey] : null
  if (!fiber) {
    return {
      componentChain: [],
      primaryFile: null,
      primaryHandler: null,
      ownerComponentName: null,
      primitiveName: null,
      primitiveFile: null,
      fiberPropsMeta: emptyMeta
    }
  }

  const componentChain: ElementFiberInfo[] = []
  let featureFile: string | null = null
  let fallbackPrimitiveFile: string | null = null
  let primitiveName: string | null = null
  let businessHandler: string | null = null
  let fallbackHandler: string | null = null
  let ownerComponentName: string | null = null
  let lastSeenFeatureFile: string | null = null

  const meta = { ...emptyMeta }

  let curr = fiber
  let depth = 0
  const maxDepth = 28

  const PRIORITY_HANDLER_KEYS = [
    'onChange',
    'onCommit',
    'onSelect',
    'onApply',
    'onClick',
    'onPointerDown',
    'onToggle'
  ]

  while (curr && depth < maxDepth) {
    depth++
    const rawType = curr.type
    const isHostTag = typeof rawType === 'string'
    const name = rawType
      ? isHostTag
        ? rawType
        : rawType.displayName || rawType.name || 'Component'
      : ''

    const fileInfo = extractDebugSourceFile(curr)
    if (fileInfo && !fileInfo.includes('node_modules')) {
      if (isSharedPrimitiveFile(fileInfo)) {
        if (!fallbackPrimitiveFile) fallbackPrimitiveFile = fileInfo
      } else {
        if (!featureFile) featureFile = fileInfo
        lastSeenFeatureFile = fileInfo
      }
    }

    if (!isHostTag && name && SHARED_PRIMITIVE_COMPONENT_NAMES.has(name) && !primitiveName) {
      primitiveName = name
    }

    if (
      !isHostTag &&
      name &&
      !SHARED_PRIMITIVE_COMPONENT_NAMES.has(name) &&
      !name.startsWith('Icon') &&
      name !== 'Component' &&
      !ownerComponentName
    ) {
      ownerComponentName = name
    }

    const props = curr.memoizedProps || {}

    // Trích xuất metadata từ props của các control (AnimRow, Row, NumberInput, Slider, CustomSelect, SegmentedTabs, Switch...)
    if (!meta.label && typeof props.label === 'string' && props.label.trim()) {
      meta.label = props.label.trim()
    } else if (!meta.label && typeof props.ariaLabel === 'string' && props.ariaLabel.trim()) {
      meta.label = props.ariaLabel.trim()
    }
    if (!meta.axis && typeof props.axis === 'string' && props.axis.trim()) {
      meta.axis = props.axis.trim().toUpperCase()
    }
    if (meta.value === undefined) {
      if (props.value !== undefined && typeof props.value !== 'object') {
        meta.value = props.value
      } else if (typeof props.on === 'boolean') {
        meta.value = props.on
      } else if (typeof props.checked === 'boolean') {
        meta.value = props.checked
      }
    }
    if (meta.min === undefined && typeof props.min === 'number') meta.min = props.min
    if (meta.max === undefined && typeof props.max === 'number') meta.max = props.max
    if (meta.step === undefined && typeof props.step === 'number') meta.step = props.step
    if (meta.suffix === undefined && typeof props.suffix === 'string') meta.suffix = props.suffix

    if (!meta.options && Array.isArray(props.options) && props.options.length > 0) {
      meta.options = props.options.slice(0, 8).map((opt: any) => {
        if (opt && typeof opt === 'object' && 'value' in opt) {
          return { label: String(opt.label ?? opt.value), value: opt.value }
        }
        return { label: String(opt), value: opt }
      })
    } else if (!meta.options && Array.isArray(props.items) && props.items.length > 0) {
      meta.options = props.items.slice(0, 8).map((it: any) => ({
        label: typeof it?.label === 'string' ? it.label : String(it?.title || it?.id || ''),
        value: it?.id
      }))
    }

    if (!meta.propBinding && props.refp && typeof props.refp === 'object') {
      const r = props.refp
      if (r.kind === 'layer') {
        meta.propBinding = `layer("${r.layerId}").${r.prop}`
      } else if (r.kind === 'camera') {
        meta.propBinding = `camera.${r.prop}`
      } else if (r.kind === 'shot') {
        meta.propBinding = `shot("${r.shotId}").${r.prop}`
      } else if (r.kind === 'effect') {
        meta.propBinding = `layer("${r.layerId}").effect("${r.effectId}").${r.param}`
      }
    }

    const handlers: string[] = []
    for (const key of Object.keys(props)) {
      if (key.startsWith('on') && typeof props[key] === 'function') {
        const formatted = summarizeHandlerFunction(key, props[key])
        handlers.push(formatted)
        if (!fallbackHandler && PRIORITY_HANDLER_KEYS.includes(key)) {
          fallbackHandler = formatted
        }
        if (
          !businessHandler &&
          PRIORITY_HANDLER_KEYS.includes(key) &&
          !isInternalPrimitiveHandler(name, fileInfo, formatted)
        ) {
          businessHandler = formatted
        }
      }
    }

    if (
      name &&
      !isHostTag &&
      !HTML_HOST_TAGS.has(name.toLowerCase()) &&
      !name.startsWith('Icon')
    ) {
      const effectiveFile =
        fileInfo && !fileInfo.includes('node_modules') ? fileInfo : lastSeenFeatureFile
      const prev = componentChain[componentChain.length - 1]
      if (!prev || prev.componentName !== name) {
        componentChain.push({
          componentName: name,
          fileInfo: effectiveFile,
          handlers
        })
      }
    }

    curr = curr.return
  }

  const primaryFile = featureFile || fallbackPrimitiveFile
  const primaryHandler = businessHandler || fallbackHandler
  const primitiveFile =
    fallbackPrimitiveFile && fallbackPrimitiveFile !== primaryFile ? fallbackPrimitiveFile : null

  return {
    componentChain,
    primaryFile,
    primaryHandler,
    ownerComponentName,
    primitiveName,
    primitiveFile,
    fiberPropsMeta: meta
  }
}

/**
 * Xây dựng thông tin chi tiết về Control UI (nhãn thông số, giá trị hiện tại, phạm vi, danh sách lựa chọn, selector).
 */
export function buildControlDetails(
  el: Element,
  tagName: string,
  classes: string[],
  fiberResult: FiberExtractionResult
): ScannedControlDetails {
  const { fiberPropsMeta, primitiveName, primitiveFile } = fiberResult

  // 1. Tìm nhãn thông số (Field Label) từ Fiber hoặc từ hàng chứa control trong DOM
  let fieldLabel = fiberPropsMeta.label
  if (!fieldLabel && typeof el.closest === 'function') {
    const rowEl = el.closest(
      '.row, .field-row, .ps-slider-row, .la-field, .mx-field, .wf-field, .insp-row, .setting-row, .form-group, .lw-prop-row, .audio-tone-row'
    )
    if (rowEl && typeof rowEl.querySelector === 'function') {
      const labelNode = rowEl.querySelector(
        '.row-label-text, .row-label, .field-label, .slider-label, label:not(.num)'
      )
      const txt = labelNode?.textContent?.replace(/\s+/g, ' ').trim()
      if (txt && txt.length <= 60) {
        fieldLabel = txt
      }
    }
  }
  if (!fieldLabel) {
    const ariaLabel = el.getAttribute?.('aria-label')?.trim()
    if (ariaLabel && ariaLabel.length <= 60) fieldLabel = ariaLabel
  }

  // 2. Tìm trục tọa độ (Axis X/Y/Z)
  let axis = fiberPropsMeta.axis
  if (!axis && typeof el.closest === 'function') {
    const numLabel = el.closest('label.num') || (el.matches?.('label.num') ? el : null)
    const axisNode = numLabel?.querySelector?.('.axis')
    const axisTxt = axisNode?.textContent?.trim()
    if (axisTxt && axisTxt.length <= 4) axis = axisTxt
  }

  // 3. Giá trị hiện tại (Current Value)
  let currentValue: string | null = null
  const role = el.getAttribute?.('role')
  const ariaPressed = el.getAttribute?.('aria-pressed')
  const ariaSelected = el.getAttribute?.('aria-selected')
  const isSwitch =
    classes.includes('switch') ||
    role === 'switch' ||
    (tagName === 'input' && el.getAttribute?.('type') === 'checkbox')

  if (isSwitch || ariaPressed === 'true' || ariaPressed === 'false') {
    const isOn =
      classes.includes('on') ||
      classes.includes('active') ||
      ariaPressed === 'true' ||
      fiberPropsMeta.value === true
    currentValue = isOn ? 'Đang BẬT (true)' : 'Đang TẮT (false)'
  } else if (role === 'tab' || classes.includes('pxs-tab') || classes.includes('tab')) {
    const isActive = classes.includes('active') || ariaSelected === 'true'
    currentValue = isActive ? 'Tab đang mở (Active)' : 'Tab chưa mở'
  } else if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    const domVal = (el as HTMLInputElement).value
    if (domVal !== undefined && domVal !== '') {
      currentValue = String(domVal).slice(0, 60)
    } else if (fiberPropsMeta.value !== undefined) {
      currentValue = `${fiberPropsMeta.value}${fiberPropsMeta.suffix ?? ''}`
    }
  } else if (fiberPropsMeta.options && fiberPropsMeta.value !== undefined) {
    const matchedOpt = fiberPropsMeta.options.find((o) => o.value === fiberPropsMeta.value)
    currentValue = matchedOpt
      ? `"${matchedOpt.label}" (${String(fiberPropsMeta.value)})`
      : String(fiberPropsMeta.value)
  } else if (fiberPropsMeta.value !== undefined && typeof fiberPropsMeta.value !== 'boolean') {
    currentValue = `${fiberPropsMeta.value}${fiberPropsMeta.suffix ?? ''}`
  }

  // 4. Phạm vi (Range Spec)
  let rangeSpec: string | null = null
  const minAttr = el.getAttribute?.('min')
  const maxAttr = el.getAttribute?.('max')
  const stepAttr = el.getAttribute?.('step')
  const minVal = minAttr !== null && minAttr !== undefined ? Number(minAttr) : fiberPropsMeta.min
  const maxVal = maxAttr !== null && maxAttr !== undefined ? Number(maxAttr) : fiberPropsMeta.max
  const stepVal = stepAttr !== null && stepAttr !== undefined ? Number(stepAttr) : fiberPropsMeta.step
  if (
    (minVal !== undefined && Number.isFinite(minVal)) ||
    (maxVal !== undefined && Number.isFinite(maxVal))
  ) {
    const minStr = minVal !== undefined && Number.isFinite(minVal) ? String(minVal) : '-∞'
    const maxStr = maxVal !== undefined && Number.isFinite(maxVal) ? String(maxVal) : '+∞'
    const stepStr = stepVal !== undefined && Number.isFinite(stepVal) ? `, step=${stepVal}` : ''
    rangeSpec = `[${minStr} .. ${maxStr}${stepStr}]`
  }

  // 5. Tóm tắt danh sách lựa chọn (Options Summary)
  let optionsSummary: string | null = null
  if (fiberPropsMeta.options && fiberPropsMeta.options.length > 0) {
    optionsSummary = fiberPropsMeta.options
      .map((o) => o.label || String(o.value))
      .filter(Boolean)
      .slice(0, 6)
      .join(' | ')
  }

  // 6. Selector định danh chuẩn xác nhất
  let targetSelector = tagName
  if (el.id) {
    targetSelector = `#${el.id}`
  } else if (el.getAttribute?.('data-mcp-region')) {
    targetSelector = `[data-mcp-region="${el.getAttribute('data-mcp-region')}"]`
  } else if (el.getAttribute?.('data-bone-id')) {
    targetSelector = `[data-bone-id="${el.getAttribute('data-bone-id')}"]`
  } else if (el.getAttribute?.('data-layer-id')) {
    targetSelector = `[data-layer-id="${el.getAttribute('data-layer-id')}"]`
  } else if (classes.length > 0) {
    targetSelector = `${tagName}.${classes.slice(0, 2).join('.')}`
  }

  return {
    fieldLabel,
    axis,
    currentValue,
    rangeSpec,
    optionsSummary,
    propBinding: fiberPropsMeta.propBinding,
    primitiveName,
    primitiveFile,
    targetSelector
  }
}

/**
 * Nhận diện xem nút bấm / menu item được quét có mở hoặc điều khiển một Hộp thoại / Xưởng đích nào không,
 * giúp AI nhảy thẳng tới đúng file Dialog cần sửa mà không phải dò từ Toolbar.
 */
export function resolveLinkedTargetModule(
  id: string,
  classes: string[],
  primaryHandler: string | null,
  mcpRegion: string | null
): LinkedTargetModule | null {
  const h = primaryHandler || ''
  const cls = classes.join(' ')

  if (
    id === 'remote-qr-btn' ||
    mcpRegion === 'remote_chip' ||
    cls.includes('remote-qr-chip') ||
    h.includes('openDialog("remote")') ||
    h.includes("openDialog('remote')")
  ) {
    return {
      name: 'MobileRemoteDialog',
      file: 'src/renderer/src/ui/MobileRemoteDialog.tsx',
      subFiles: [
        'src/renderer/src/ui/remote/RemoteQrNetworkCard.tsx',
        'src/renderer/src/ui/remote/RemoteLiveTouchpadPanel.tsx',
        'src/renderer/src/mcp/commands/remoteCommands.ts'
      ],
      description: 'Hộp thoại Điều khiển qua Điện thoại & QR Code (Mobile Wi-Fi Remote)'
    }
  }

  if (
    id === 'manifest-assets-btn' ||
    mcpRegion === 'manifest_chip' ||
    h.includes('openDialog("manifest")') ||
    h.includes("openDialog('manifest')")
  ) {
    return {
      name: 'AssetManifestDialog',
      file: 'src/renderer/src/ui/manifest/AssetManifestDialog.tsx',
      subFiles: [
        'src/renderer/src/ui/manifest/ManifestCategorySection.tsx',
        'src/renderer/src/ui/manifest/ManifestAssetSection.tsx',
        'src/renderer/src/store/assetManifest.ts'
      ],
      description: 'Hộp thoại Quản lý Manifest Tài nguyên & Khôi phục File xoá tạm'
    }
  }

  if (
    id === 'perf-settings-btn' ||
    h.includes('openDialog("performance")') ||
    h.includes("openDialog('performance')")
  ) {
    return {
      name: 'PerformanceDialog',
      file: 'src/renderer/src/ui/PerformanceDialog.tsx',
      subFiles: ['src/renderer/src/store/performance.ts'],
      description: 'Hộp thoại Cấu hình Hiệu năng, RAM & VRAM GPU'
    }
  }

  if (
    id === 'export' ||
    id === 'menu-export' ||
    h.includes('openDialog("export")') ||
    h.includes("openDialog('export')") ||
    h.includes('onExport')
  ) {
    return {
      name: 'ExportDialog',
      file: 'src/renderer/src/ui/ExportDialog.tsx',
      subFiles: ['src/renderer/src/export/runExport.ts', 'src/main/ffmpeg.ts'],
      description: 'Hộp thoại Xuất Video MP4 (Render Queue)'
    }
  }

  if (
    id === 'mcp-chip' ||
    mcpRegion === 'mcp_chip' ||
    cls.includes('mcp-chip') ||
    h.includes('openDialog("mcp")') ||
    h.includes("openDialog('mcp')")
  ) {
    return {
      name: 'McpDialog',
      file: 'src/renderer/src/ui/McpDialog.tsx',
      subFiles: [
        'src/renderer/src/ui/mcp/McpAiGuideCard.tsx',
        'src/renderer/src/ui/mcp/McpIdeAndShellCard.tsx'
      ],
      description: 'Hộp thoại Cấu hình Kết nối AI (MCP Server & CLI)'
    }
  }

  if (
    id === 'audio-studio-btn' ||
    id === 'create-audio-studio' ||
    h.includes('openAudioDialog') ||
    h.includes('openDialog("audio")') ||
    h.includes("openDialog('audio')")
  ) {
    return {
      name: 'AudioStudioDialog',
      file: 'src/renderer/src/ui/AudioStudioDialog.tsx',
      subFiles: [
        'src/renderer/src/ui/audioStudio/AudioStudioTrackList.tsx',
        'src/renderer/src/ui/audioStudio/AudioStudioWaveform.tsx'
      ],
      description: 'Phòng thu Âm thanh, Sóng âm & Bàn trộn Mixer'
    }
  }

  if (
    id === 'create-photo-editor' ||
    h.includes('openPhotoEditor') ||
    h.includes('openDialog("photo_editor")') ||
    h.includes("openDialog('photo_editor')")
  ) {
    return {
      name: 'PhotoStudioDialog',
      file: 'src/renderer/src/ui/photoStudio/PhotoStudioDialog.tsx',
      subFiles: [
        'src/renderer/src/ui/photoStudio/PhotoStudioToolbar.tsx',
        'src/renderer/src/ui/photoStudio/PhotoStudioLeftRail.tsx',
        'src/renderer/src/ui/photoStudio/PhotoStudioRightRail.tsx'
      ],
      description: 'Xưởng Tách Nền & Chỉnh Sửa Ảnh (Photo Studio)'
    }
  }

  if (
    id === 'create-loop-animator' ||
    h.includes('openLoopAnimator') ||
    h.includes('openDialog("loop_animator")') ||
    h.includes("openDialog('loop_animator')")
  ) {
    return {
      name: 'LoopAnimatorDialog',
      file: 'src/renderer/src/ui/loopAnimator/LoopAnimatorDialog.tsx',
      subFiles: [
        'src/renderer/src/ui/loopAnimator/LoopAnimatorSourcePane.tsx',
        'src/renderer/src/ui/loopAnimator/LoopAnimatorPlayerPane.tsx',
        'src/renderer/src/ui/loopAnimator/loopAnimatorState.ts'
      ],
      description: 'Xưởng Hoạt Ảnh Lặp (Loop Sprite Animator)'
    }
  }

  if (
    id === 'create-3d-model' ||
    h.includes('openDialog("create_3d")') ||
    h.includes("openDialog('create_3d')") ||
    h.includes('openAssemblyWorkshop')
  ) {
    return {
      name: 'Assembly3DDialog',
      file: 'src/renderer/src/ui/assets/models3d/Assembly3DDialog.tsx',
      subFiles: [
        'src/renderer/src/ui/assets/models3d/AssemblyViewport.tsx',
        'src/renderer/src/ui/assets/models3d/FaceInspector.tsx'
      ],
      description: 'Xưởng Lắp Ráp Mô Hình 3D'
    }
  }

  if (
    id === 'add-assembly-workshop' ||
    id === 'create-layer-assembly' ||
    h.includes('requestOpenLayerAssembly')
  ) {
    return {
      name: 'LayerAssemblyDialog',
      file: 'src/renderer/src/ui/layerAssembly/LayerAssemblyDialog.tsx',
      subFiles: [
        'src/renderer/src/ui/layerAssembly/WorkshopWorkspace.tsx',
        'src/renderer/src/ui/layerAssembly/LayerAssemblyInspector.tsx'
      ],
      description: 'Xưởng Lắp Ráp Layer & Rigging 2.5D'
    }
  }

  if (h.includes('openDialog("path")') || h.includes("openDialog('path')")) {
    return {
      name: 'CameraPathDialog',
      file: 'src/renderer/src/ui/CameraPathDialog.tsx',
      subFiles: ['src/renderer/src/animation/cameraPath.ts'],
      description: 'Hộp thoại Lộ trình Camera 3D qua các Cảnh'
    }
  }

  if (h.includes('openDialog("sketch")') || h.includes("openDialog('sketch')")) {
    return {
      name: 'CameraSketchDialog',
      file: 'src/renderer/src/ui/CameraSketchDialog.tsx',
      subFiles: ['src/renderer/src/animation/cameraSketch.ts'],
      description: 'Hộp thoại Vẽ Đường Bay Camera tự do'
    }
  }

  if (id === 'ai-ui-inspector-btn' || h.includes('pxs:toggle-ai-inspector')) {
    return {
      name: 'AiUiInspectorOverlay',
      file: 'src/renderer/src/ui/AiUiInspectorOverlay.tsx',
      subFiles: [
        'src/renderer/src/ui/inspector/aiUiInspectorScanner.ts',
        'src/renderer/src/ui/inspector/aiUiInspectorMarkdown.ts'
      ],
      description: 'Hệ thống Soi Ngữ Cảnh Giao Diện AI (AI UI Inspector)'
    }
  }

  return null
}
