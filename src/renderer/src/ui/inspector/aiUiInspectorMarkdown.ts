import { formatFriendlyDialogLabel, formatFriendlyRegionLabel } from './aiUiInspectorWorkshopContext'
import type { AiInspectorSnapshot, ScannedElementContext } from './aiUiInspectorScanner'
import { formatElementsSection, formatFocusSection, formatWorkshopSection } from './aiUiInspectorMarkdownSections'

export { formatControlSpecsLine } from './aiUiInspectorMarkdownSections'

/**
 * Báo cáo Markdown của AI UI Inspector (copy vào Clipboard, dán cho AI).
 * Thứ tự ưu tiên token: hướng dẫn AI → bảng "Mở ngay" (file:dòng chính xác) → tâm điểm → xưởng → chi tiết → trạng thái.
 */

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
}

function elementHeading(item: ScannedElementContext): string {
  const raw = item.text || item.controlDetails?.fieldLabel || item.title || `<${item.tagName}>`
  return raw.length > 42 ? `${raw.slice(0, 40)}…` : raw
}

/** Component sở hữu + file:dòng ước lượng từ Fiber (khi khác dòng JSX chính xác). */
function ownerCell(item: ScannedElementContext): string {
  const owner = item.ownerComponentName ? `\`<${item.ownerComponentName}>\`` : ''
  const file = item.primaryFile && item.primaryFile !== item.sourceLocation ? ` \`${item.primaryFile}\`` : ''
  return `${owner}${file}`.trim() || '—'
}

/**
 * Bảng "Mở ngay": mỗi dòng = 1 phần tử với file:dòng JSX chính xác, component sở hữu và CSS — AI mở thẳng,
 * không cần grep / đọc luồng xử lý.
 */
export function formatJumpTable(elements: ScannedElementContext[]): string[] {
  if (elements.length === 0) return []
  const lines = [
    '#### ⚡ Mở ngay (Jump-to-code):',
    '| # | Thành phần | JSX render (file:dòng) | Component / Call-site | CSS |',
    '|---|---|---|---|---|'
  ]
  elements.slice(0, 8).forEach((item, idx) => {
    const jsx = item.sourceLocation
      ? `\`${item.sourceLocation}\``
      : item.primaryFile
        ? `≈ \`${item.primaryFile}\``
        : '—'
    const css = item.cssSources?.length ? item.cssSources.slice(0, 2).map((c) => `\`${c}\``).join('<br>') : '—'
    const isPrimary = item.isPrimaryFocus ?? (idx === 0 && !elements.some((e) => e.isPrimaryFocus))
    const stateTag = item.isFocused ? ' 🎯 [FOCUS]' : item.isActive ? ' ⭐ [ACTIVE]' : ''
    const name = `"${escapeCell(elementHeading(item))}" (${escapeCell(item.kindLabel)})${stateTag}`
    lines.push(`| ${idx + 1}${isPrimary ? ' 🎯' : ''} | ${name} | ${jsx} | ${escapeCell(ownerCell(item))} | ${css} |`)
  })
  lines.push('')
  return lines
}

function formatSurfaceLine(item: ScannedElementContext | undefined): string | null {
  const s = item?.surface
  if (!s || s.kind === 'main') return null
  const src = s.source ? ` · Gốc JSX: \`${s.source}\`` : ''
  return `${s.chain.join(' › ')} — Selector: \`${s.selector}\`${src}`
}

function formatHeader(snapshot: AiInspectorSnapshot): string[] {
  const { rect, elements, primaryRegion, appState, viewport } = snapshot
  const now = new Date()
  const pad = (n: number): string => n.toString().padStart(2, '0')
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  const lines = [
    '### 🎯 NGỮ CẢNH GIAO DIỆN (AI UI INSPECTOR)',
    '> 🤖 **AI:** mở thẳng các `file:dòng` trong bảng "Mở ngay" bên dưới — KHÔNG cần grep / đọc luồng xử lý để dò vị trí. `JSX render` là dòng chính xác đã vẽ phần tử; `≈` là ước lượng từ React Fiber.',
    `> 📍 **Vùng quét:** ${rect.width} × ${rect.height}px tại (${rect.left}, ${rect.top}) | Khu vực MCP: \`${primaryRegion}\` (${formatFriendlyRegionLabel(primaryRegion)})`
  ]
  if (viewport) {
    lines.push(`> 📱 **Thiết bị & Khung nhìn:** ${viewport.width} × ${viewport.height}px | ${viewport.breakpointLabel}`)
  }
  const surfaceLine = formatSurfaceLine(elements[0])
  if (surfaceLine) lines.push(`> 🪟 **Bề mặt đang quét:** ${surfaceLine}`)
  lines.push(`> 🕒 **Thời điểm:** ${timeStr} | Giao diện: \`${appState.theme}\``)
  lines.push('')
  return lines
}

function formatStudioState(appState: AiInspectorSnapshot['appState']): string[] {
  const layers = appState.selectedLayerNames.length > 0 ? appState.selectedLayerNames.join(', ') : 'Chưa chọn layer nào'
  const dialog = appState.activeDialog
    ? `\`${appState.activeDialog}\` (${formatFriendlyDialogLabel(appState.activeDialog)})`
    : 'Không có (Màn hình chính)'
  return [
    '#### ⚙️ Trạng thái Studio lúc quét:',
    `- 🎬 **Cảnh:** ${appState.shotName} (Cảnh ${appState.shotIndex}) | ⏱️ **Playhead:** ${appState.currentTime}s / ${appState.duration}s (${appState.fps}fps) | ${appState.isPlaying ? '▶️ Đang phát' : '⏸️ Đang dừng'}`,
    `- 📌 **Layer đang chọn:** ${layers}`,
    `- 💬 **Hộp thoại / Xưởng:** ${dialog}`,
    '',
    '---',
    '*(Gửi đoạn này cho AI để AI nhảy thẳng vào đúng file và hàm xử lý!)*'
  ]
}

/**
 * Biên soạn báo cáo Markdown chuyên biệt để lưu vào Clipboard gửi cho AI đọc code tức thì.
 */
export function formatAiInspectorMarkdown(snapshot: AiInspectorSnapshot): string {
  const { elements, workshopContext, appState } = snapshot
  return [
    ...formatHeader(snapshot),
    ...formatJumpTable(elements),
    ...formatFocusSection(elements[0], workshopContext),
    ...formatWorkshopSection(workshopContext),
    ...formatElementsSection(elements),
    ...formatStudioState(appState)
  ].join('\n')
}
