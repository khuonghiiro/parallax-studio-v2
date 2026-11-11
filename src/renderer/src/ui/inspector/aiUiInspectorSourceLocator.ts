/**
 * Định vị mã nguồn chính xác cho AI UI Inspector:
 *  - `data-ai-src` (gắn bởi `scripts/vite/aiSourceLocatorBabel.mjs` khi dev) → file:dòng JSX đã render phần tử.
 *  - Stylesheet Vite dev (`<style data-vite-dev-id>`) → file CSS + dòng định nghĩa class của phần tử.
 *  - Đường dẫn DOM ngắn gọn (`.dialog > .panel > button.cta`) để AI grep khi thiếu sourcemap.
 */

export const AI_SRC_ATTR = 'data-ai-src'

export interface AiSourceLocation {
  /** Đường dẫn tương đối từ gốc dự án, ví dụ `src/renderer/src/ui/Toolbar.tsx` */
  file: string
  line: number
  column: number
  /** Dạng gọn `file:line` dùng trong báo cáo */
  ref: string
}

/** Class trạng thái tạm thời — không mang ý nghĩa định vị CSS. */
const STATE_CLASS_RE =
  /^(active|open|opened|on|off|selected|focused|hover|disabled|is-|has-|show|hidden|visible|expanded|collapsed|dragging|primary|secondary|sm|md|lg|xs|ghost)/

export function parseAiSourceRef(raw: string | null | undefined): AiSourceLocation | null {
  if (!raw || typeof raw !== 'string') return null
  const m = /^(.+?):(\d+)(?::(\d+))?$/.exec(raw.trim())
  if (!m) return null
  const file = m[1].replace(/\\/g, '/')
  const line = Number(m[2])
  const column = m[3] ? Number(m[3]) : 1
  if (!Number.isFinite(line) || line <= 0) return null
  return { file, line, column, ref: `${file}:${line}` }
}

/** Đọc vị trí JSX của chính phần tử (hoặc tổ tiên gần nhất có gắn `data-ai-src`). */
export function readDomSourceLocation(el: Element | null | undefined): AiSourceLocation | null {
  if (!el || typeof el.getAttribute !== 'function') return null
  const own = el.getAttribute(AI_SRC_ATTR)
  if (own) return parseAiSourceRef(own)
  const host = typeof el.closest === 'function' ? el.closest(`[${AI_SRC_ATTR}]`) : null
  return host ? parseAiSourceRef(host.getAttribute(AI_SRC_ATTR)) : null
}

/** Đọc call-site của component từ props fiber (`data-ai-src` được Babel plugin chèn vào JSX component). */
export function readFiberPropsSource(props: unknown): string | null {
  if (!props || typeof props !== 'object') return null
  const raw = (props as Record<string, unknown>)[AI_SRC_ATTR]
  const loc = typeof raw === 'string' ? parseAiSourceRef(raw) : null
  return loc ? loc.ref : null
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeViteDevId(id: string): string {
  const norm = id.replace(/\\/g, '/').split('?')[0]
  const idx = norm.lastIndexOf('/src/renderer/src/')
  return idx >= 0 ? norm.slice(idx + 1) : norm
}

function collectDevStyleSources(): Array<{ file: string; text: string }> {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return []
  try {
    const tags = Array.from(document.querySelectorAll('style[data-vite-dev-id]'))
    return tags
      .map((tag) => ({
        file: normalizeViteDevId(tag.getAttribute('data-vite-dev-id') || ''),
        text: tag.textContent || ''
      }))
      .filter((s) => s.file.endsWith('.css') && s.text.length > 0)
  } catch {
    return []
  }
}

/** Các class "định danh" của phần tử (bỏ class trạng thái + class nội bộ inspector). */
export function pickIdentityClasses(classes: string[], max = 3): string[] {
  return classes
    .filter((c) => c && !c.startsWith('ai-ui-') && !STATE_CLASS_RE.test(c) && c.length > 2)
    .slice(0, max)
}

/**
 * Tìm file CSS + dòng đầu tiên định nghĩa selector chứa class của phần tử (chỉ khả dụng khi dev).
 * Trả về dạng `src/renderer/src/styles/toolbar.css:42 (.tb-btn)`.
 */
export function findCssSourcesForClasses(classes: string[], max = 3, all = false): string[] {
  const identity = all ? classes.filter((c) => c && !c.startsWith('ai-ui-')) : pickIdentityClasses(classes, 4)
  if (identity.length === 0) return []
  const sheets = collectDevStyleSources()
  if (sheets.length === 0) return []
  const results: string[] = []
  const seen = new Set<string>()
  for (const cls of identity) {
    const re = new RegExp(`\\.${escapeRegExp(cls)}(?![\\w-])[^{};]*\\{`)
    for (const sheet of sheets) {
      const m = re.exec(sheet.text)
      if (!m) continue
      const line = sheet.text.slice(0, m.index).split('\n').length
      const key = `${sheet.file}:${cls}`
      if (seen.has(key)) continue
      seen.add(key)
      results.push(`${sheet.file}:${line} (.${cls})`)
      if (!all) break
    }
    if (!all && results.length >= max) break
  }
  return results
}

function describeNodeForPath(el: Element): string {
  const tag = (el.tagName || 'div').toLowerCase()
  const region = el.getAttribute?.('data-mcp-region')
  if (region) return `[data-mcp-region="${region}"]`
  if (el.id) return `${tag}#${el.id}`
  const cls = pickIdentityClasses(Array.from(el.classList || []), 1)[0]
  return cls ? `${tag}.${cls}` : tag
}

/**
 * Đường dẫn DOM ngắn (tối đa `depth` cấp, dừng tại vùng `data-mcp-region` gần nhất) để AI grep / ui_click.
 */
export function buildShortDomPath(el: Element | null | undefined, depth = 4): string {
  if (!el || typeof el.getAttribute !== 'function') return ''
  const parts: string[] = []
  let node: Element | null = el
  while (node && parts.length < depth && node.tagName && node.tagName !== 'BODY') {
    parts.unshift(describeNodeForPath(node))
    if (node !== el && node.getAttribute?.('data-mcp-region')) break
    node = node.parentElement
  }
  return parts.join(' > ')
}
