import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'

export interface ElementFiberInfo {
  componentName: string
  fileInfo: string | null
  handlers: string[]
}

export interface ScannedElementContext {
  element: Element
  tagName: string
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
}

export interface AiInspectorSnapshot {
  rect: { left: number; top: number; width: number; height: number }
  elements: ScannedElementContext[]
  primaryRegion: string
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
  const maxDepth = 12

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
        const handlerName = props[key].name || 'anonymous'
        handlers.push(`${key}={${handlerName}}`)
        if (!primaryHandler && key === 'onClick') {
          primaryHandler = `${key}={${handlerName}}`
        }
      }
    }

    if (name && !['div', 'span', 'p', 'svg', 'path', 'g', 'circle', 'rect'].includes(name.toLowerCase())) {
      componentChain.push({ componentName: name, fileInfo, handlers })
    }

    curr = curr.return
  }

  return { componentChain, primaryFile, primaryHandler }
}

/**
 * Trích xuất toàn bộ ngữ cảnh DOM + React của 1 phần tử.
 */
export function scanElementContext(el: Element): ScannedElementContext {
  const rect = el.getBoundingClientRect()
  const { componentChain, primaryFile, primaryHandler } = extractFiberInfo(el)

  // Lấy text hiển thị (tối đa 80 ký tự)
  const rawText = (el as HTMLElement).innerText || el.textContent || ''
  const cleanText = rawText.replace(/\s+/g, ' ').trim().slice(0, 80)

  // Tìm khu vực MCP gần nhất
  const mcpRegionEl = el.closest('[data-mcp-region]')
  const mcpRegion = mcpRegionEl ? mcpRegionEl.getAttribute('data-mcp-region') : null

  // Tìm hộp thoại modal gần nhất
  const mcpDialogEl = el.closest('[data-mcp-dialog]')
  const mcpDialog = mcpDialogEl ? mcpDialogEl.getAttribute('data-mcp-dialog') : null

  const title =
    el.getAttribute('title') ||
    el.getAttribute('aria-label') ||
    el.getAttribute('placeholder') ||
    null

  const classes = Array.from(el.classList).filter(
    (c) => !c.startsWith('ai-ui-') && !c.includes('hover')
  )

  return {
    element: el,
    tagName: el.tagName.toLowerCase(),
    id: el.id || '',
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
    }
  }
}

/**
 * Tìm kiếm các phần tử giao diện nằm bên trong hoặc cắt ngang khung quét hình chữ nhật.
 */
export function findElementsInBox(box: {
  left: number
  top: number
  width: number
  height: number
}): Element[] {
  // Nếu là click chuột đơn lẻ hoặc quét cực nhỏ (< 8px), trỏ đúng phần tử tại toạ độ
  if (box.width < 8 && box.height < 8) {
    let target = document.elementFromPoint(box.left, box.top)
    if (
      target &&
      (target.classList?.contains?.('ai-safety-barrier') ||
        target.classList?.contains?.('ai-ui-inspector-overlay') || target.classList?.contains?.('ai-ui-inspector-barrier'))
    ) {
      const origPointerEvents = (target as HTMLElement).style.pointerEvents
      ;(target as HTMLElement).style.pointerEvents = 'none'
      target = document.elementFromPoint(box.left, box.top)
      ;(target as HTMLElement).style.pointerEvents = origPointerEvents
    }
    if (!target) return []
    // Nếu target là text node hoặc icon svg nhỏ, tìm phần tử cha có ý nghĩa (button, input, tab...)
    const meaningful = target.closest(
      'button, input, select, textarea, [role="button"], a, .btn, .tab, [data-mcp-region], .tree-item, .card, .shot-item, .tl-track, .panel-header'
    )
    return [meaningful || target]
  }

  const boxRight = box.left + box.width
  const boxBottom = box.top + box.height

  // Tập hợp các selector UI tương tác và có ý nghĩa
  const selector = [
    'button',
    'input',
    'select',
    'textarea',
    '[role="button"]',
    'a',
    '.btn',
    '.tab',
    '.pxs-tab',
    '.menu-item',
    '.card',
    '.shot-item',
    '.tl-track',
    '.tb-btn-icon',
    '[data-mcp-region]',
    'h1, h2, h3, h4',
    'label',
    '.splitter'
  ].join(', ')

  const candidates = Array.from(document.querySelectorAll(selector))
  const matched: Element[] = []

  for (const el of candidates) {
    // Bỏ qua các overlay của chính công cụ soi AI hoặc safety barrier
    if (
      el.closest('.ai-ui-inspector-overlay') || el.closest('.ai-ui-inspector-barrier') || el.closest('.ai-ui-inspector-screen-frame') ||
      el.closest('.ai-control-overlay') ||
      el.classList.contains('ai-safety-barrier') ||
      el.classList.contains('ai-neon-border-frame')
    ) {
      continue
    }

    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue

    // Kiểm tra giao cắt hình chữ nhật
    const intersects = !(
      r.right < box.left ||
      r.left > boxRight ||
      r.bottom < box.top ||
      r.top > boxBottom
    )

    if (intersects) {
      matched.push(el)
    }
  }

  // Khử trùng lặp quan hệ cha-con: nếu cả button và span bên trong button đều khớp, giữ button
  const filtered = matched.filter((el) => {
    // Nếu có một phần tử khác trong matched là con trực tiếp có ý nghĩa hơn, hoặc el là wrapper lớn chứa nhiều nút con
    const hasDescendantInMatched = matched.some(
      (other) => other !== el && el.contains(other)
    )
    // Nếu el là container lớn (như panel, region) mà bên trong đã có các button con khớp, bỏ qua container
    if (hasDescendantInMatched && (el.matches('[data-mcp-region], .panel, .tabs, header, aside, .viewer-wrap'))) {
      return false
    }
    return true
  })

  // Giới hạn tối đa 12 phần tử để context súc tích, dễ đọc
  return filtered.slice(0, 12)
}

/**
 * Chụp toàn bộ trạng thái app và tạo snapshot Markdown súc tích cho AI.
 */
export function captureAiInspectorSnapshot(box: {
  left: number
  top: number
  width: number
  height: number
}): AiInspectorSnapshot {
  const elements = findElementsInBox(box)
  const scanned = elements.map(scanElementContext)

  // Xác định mcpRegion tiêu biểu nhất trong vùng quét
  let primaryRegion = 'general_view'
  for (const item of scanned) {
    if (item.mcpRegion) {
      primaryRegion = item.mcpRegion
      break
    }
  }

  // Đọc trạng thái Editor & View hiện tại
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

  return {
    rect: {
      left: Math.round(box.left),
      top: Math.round(box.top),
      width: Math.round(box.width),
      height: Math.round(box.height)
    },
    elements: scanned,
    primaryRegion,
    appState: {
      shotName,
      shotIndex: activeShotIndex + 1,
      currentTime: Number(editor.time.toFixed(2)),
      duration: Number(editor.project.comp.duration.toFixed(2)),
      fps: editor.project.comp.fps,
      isPlaying: editor.playing,
      selectedLayerNames,
      activeDialog: view.dialog || (view.assemblyModalModel ? 'layer_assembly' : null),
      theme: view.theme
    }
  }
}

/**
 * Biên soạn báo cáo Markdown chuyên biệt để gửi cho AI đọc code tức thì.
 */
export function formatAiInspectorMarkdown(snapshot: AiInspectorSnapshot): string {
  const { rect, elements, primaryRegion, appState } = snapshot
  const now = new Date()
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`

  const lines: string[] = []
  lines.push('### 🎯 NGỮ CẢNH GIAO DIỆN (AI UI INSPECTOR)')
  lines.push(
    `> 📍 **Vùng quét:** ${rect.width} × ${rect.height}px tại (${rect.left}, ${rect.top}) | Khu vực MCP: \`${primaryRegion}\``
  )
  lines.push(
    `> 🕒 **Thời điểm:** ${timeStr} | Giao diện: \`${appState.theme}\``
  )
  lines.push('')

  if (elements.length === 0) {
    lines.push('*Không phát hiện phần tử tương tác nào trong vùng quét này.*')
  } else {
    lines.push(`#### 🧩 Thành phần giao diện được chọn (${elements.length}):`)
    elements.forEach((item, idx) => {
      const label = item.text ? `"${item.text}"` : item.title ? `[${item.title}]` : 'Phần tử'
      const tagDesc = `<${item.tagName}${item.id ? ` id="${item.id}"` : ''}>`
      lines.push(`${idx + 1}. **${label}** — \`${tagDesc}\``)

      if (item.primaryFile) {
        lines.push(`   - 📂 **File nguồn:** \`${item.primaryFile}\``)
      }

      if (item.primaryHandler) {
        lines.push(`   - ⚡ **Hàm xử lý:** \`${item.primaryHandler}\``)
      }

      if (item.componentChain.length > 0) {
        const chainStr = item.componentChain
          .slice(0, 4)
          .map((c) => `<${c.componentName}>`)
          .join(' ➔ ')
        lines.push(`   - 🧱 **Cây Component:** ${chainStr}`)
      }

      if (item.title && item.title !== item.text) {
        lines.push(`   - 💡 **Tooltip / Title:** "${item.title}"`)
      }

      if (item.classes.length > 0) {
        lines.push(`   - 🎨 **CSS Classes:** \`${item.classes.slice(0, 5).join(' ')}\``)
      }

      lines.push('')
    })
  }

  lines.push('#### ⚙️ Trạng thái Studio lúc quét:')
  lines.push(
    `- 🎬 **Cảnh:** ${appState.shotName} (Cảnh ${appState.shotIndex}) | ⏱️ **Playhead:** ${appState.currentTime}s / ${appState.duration}s (${appState.fps}fps) | ${appState.isPlaying ? '▶️ Đang phát' : '⏸️ Đang dừng'}`
  )
  lines.push(
    `- 📌 **Layer đang chọn:** ${
      appState.selectedLayerNames.length > 0
        ? appState.selectedLayerNames.join(', ')
        : 'Chưa chọn layer nào'
    }`
  )
  lines.push(
    `- 💬 **Hộp thoại / Xưởng:** ${appState.activeDialog ? `\`${appState.activeDialog}\`` : 'Không có'}`
  )
  lines.push('')
  lines.push('---')
  lines.push('*(Gửi đoạn này cho AI để AI nhảy thẳng vào đúng file và hàm xử lý!)*')

  return lines.join('\n')
}
