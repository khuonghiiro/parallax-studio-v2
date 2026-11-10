/**
 * Babel plugin (chỉ bật khi `electron-vite dev`) gắn `data-ai-src="<file>:<dòng>:<cột>"` lên mọi JSX element
 * trong `src/renderer/src/**`. AI UI Inspector (Win + Shift + kéo khung) đọc thuộc tính này để báo cho AI
 * CHÍNH XÁC file + dòng JSX đã render phần tử được quét — AI mở thẳng dòng đó, không phải grep dò luồng.
 *
 * - Phần tử HTML/SVG gốc (`<div>`, `<button>`…) → thuộc tính DOM `data-ai-src` = nơi viết JSX của phần tử.
 * - Component (`<Switch>`, `<CustomSelect>`…) → prop `data-ai-src` nằm trong `fiber.memoizedProps`
 *   = nơi component được GỌI (call-site), scanner dùng để chỉ ra dòng nghiệp vụ thay vì file primitive.
 * - Bỏ qua: Fragment/StrictMode/Suspense/Profiler (React cảnh báo prop lạ), `<Ctx.Provider>` (member expr),
 *   các thẻ con SVG trang trí (`path`, `g`, `circle`…) để DOM gọn, file ngoài `src/renderer/src`.
 * - Không chạy trong build production → không lộ đường dẫn mã nguồn vào bản phát hành.
 *
 * Tắt tạm: đặt biến môi trường `PXS_AI_SRC=0` trước khi `pnpm dev`.
 */

export const AI_SRC_ATTR = 'data-ai-src'

/** File dữ liệu .ts không có JSX: để Vite/esbuild xử lý, tránh Babel in lại base64 nhiều MB. */
export function aiSourceBabelOptions(id) {
  return { plugins: /\.[jt]sx(?:\?|$)/i.test(id) ? [aiSourceLocatorBabelPlugin] : [] }
}

const SKIP_COMPONENTS = new Set(['Fragment', 'StrictMode', 'Suspense', 'Profiler', 'Activity'])

const SKIP_HOST_TAGS = new Set([
  'path',
  'g',
  'circle',
  'ellipse',
  'rect',
  'line',
  'polyline',
  'polygon',
  'defs',
  'stop',
  'lineargradient',
  'radialgradient',
  'clippath',
  'mask',
  'pattern',
  'symbol',
  'use',
  'title',
  'desc',
  'tspan',
  'filter',
  'br',
  'wbr',
  'option',
  'optgroup'
])

/** Chuẩn hoá đường dẫn tuyệt đối → tương đối từ gốc dự án (`src/renderer/src/...`). Trả về null nếu bỏ qua. */
export function toProjectRelativeSource(filename) {
  if (!filename) return null
  const norm = String(filename).replace(/\\/g, '/')
  if (norm.includes('/node_modules/')) return null
  const idx = norm.lastIndexOf('/src/renderer/src/')
  if (idx < 0) return null
  return norm.slice(idx + 1).split('?')[0]
}

function shouldTagElement(nameNode) {
  if (!nameNode || nameNode.type !== 'JSXIdentifier') return false
  const tag = nameNode.name
  if (!tag) return false
  const first = tag[0]
  if (first >= 'A' && first <= 'Z') return !SKIP_COMPONENTS.has(tag)
  if (tag.includes('-')) return true // custom element
  return !SKIP_HOST_TAGS.has(tag.toLowerCase())
}

export default function aiSourceLocatorBabelPlugin({ types: t }) {
  return {
    name: 'pxs-ai-source-locator',
    visitor: {
      JSXOpeningElement(path, state) {
        const node = path.node
        if (!shouldTagElement(node.name)) return
        const loc = node.loc
        if (!loc) return
        const rel = toProjectRelativeSource(state.filename || state.file?.opts?.filename)
        if (!rel) return
        const already = node.attributes.some(
          (a) => a.type === 'JSXAttribute' && a.name && a.name.name === AI_SRC_ATTR
        )
        if (already) return
        node.attributes.push(
          t.jsxAttribute(
            t.jsxIdentifier(AI_SRC_ATTR),
            t.stringLiteral(`${rel}:${loc.start.line}:${loc.start.column + 1}`)
          )
        )
      }
    }
  }
}
