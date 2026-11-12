/**
 * Tách file CSS vượt 1000 dòng thành file gốc + file(s) phụ.
 * File gốc giữ phần đầu và thêm @import cho các phần sau.
 * Tách tại ranh giới CSS rule (dòng kết thúc `}` ở top-level).
 */
import { dirname, basename, extname, join } from 'path'

export interface CssSplitResult {
  /** Nội dung file gốc (đã thêm @import) */
  main: string
  /** Các file phụ { relativePath, content } */
  parts: { path: string; content: string }[]
}

const MAX_LINES = 1000
/** Mục tiêu cắt — để mỗi phần có chừa dư cho @import */
const TARGET_LINES = 800

/**
 * Tìm ranh giới cắt tốt nhất — dòng kết thúc `}` ở nesting depth 0,
 * hoặc dòng trống, gần nhất với `targetLine`.
 */
function findCutPoint(lines: string[], startSearch: number, endSearch: number): number {
  // Quét từ targetLine ngược lại tìm dòng `}` ở depth 0
  let depth = 0
  // Tính depth tích lũy từ startSearch đến endSearch
  let bestCut = -1
  for (let i = startSearch; i < endSearch && i < lines.length; i++) {
    const line = lines[i]
    for (const ch of line) {
      if (ch === '{') depth++
      else if (ch === '}') depth--
    }
    if (depth === 0 && line.trim().endsWith('}')) {
      bestCut = i + 1 // cắt SAU dòng này
    }
    if (depth === 0 && line.trim() === '') {
      bestCut = i + 1
    }
  }
  // Nếu không tìm thấy vị trí đẹp, cắt đúng tại targetLine
  return bestCut > startSearch ? bestCut : endSearch
}

/**
 * Tách nội dung CSS thành nhiều phần, mỗi phần <= MAX_LINES.
 * @param cssPath Đường dẫn tương đối từ root (vd: `src/renderer/src/styles/foo.css`)
 * @param content Toàn bộ nội dung CSS
 */
export function splitOversizedCss(cssPath: string, content: string): CssSplitResult | null {
  const lines = content.split('\n')
  if (lines.length <= MAX_LINES) return null

  const dir = dirname(cssPath)
  const ext = extname(cssPath)
  const base = basename(cssPath, ext)

  // Thu thập các @import ở đầu file (giữ nguyên trong file gốc)
  let importEnd = 0
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed === '' || trimmed.startsWith('@import') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/')) {
      importEnd = i + 1
    } else {
      break
    }
  }

  // Chia nội dung CSS (sau phần import) thành các chunk
  const chunks: string[][] = []
  let chunkStart = importEnd

  while (chunkStart < lines.length) {
    const targetEnd = Math.min(chunkStart + TARGET_LINES, lines.length)
    if (targetEnd >= lines.length) {
      // Phần còn lại vừa đủ
      chunks.push(lines.slice(chunkStart))
      break
    }
    const cutAt = findCutPoint(lines, chunkStart, targetEnd)
    // Đảm bảo tiến tới, tránh loop vô hạn
    const actualCut = cutAt <= chunkStart ? chunkStart + TARGET_LINES : cutAt
    chunks.push(lines.slice(chunkStart, actualCut))
    chunkStart = actualCut
  }

  // Nếu chunk đầu + import header vẫn <= MAX_LINES, gộp vào file gốc
  // Ngược lại tách hết ra file phụ
  const headerLines = lines.slice(0, importEnd)

  // Xây file phụ từ chunk thứ 2 trở đi (chunk[0] giữ trong file gốc)
  const parts: { path: string; content: string }[] = []
  const imports: string[] = []

  for (let i = 1; i < chunks.length; i++) {
    const partName = `${base}-part${i + 1}${ext}`
    const partPath = join(dir, partName).replace(/\\/g, '/')
    parts.push({ path: partPath, content: chunks[i].join('\n') })
    imports.push(`@import './${partName}';`)
  }

  // File gốc = header + chunk[0] + @import các phần phụ
  const mainLines = [...headerLines, ...chunks[0]]
  // Thêm @import ở cuối file gốc
  const mainContent = mainLines.join('\n') + '\n\n/* === Auto-split: các phần mở rộng === */\n' + imports.join('\n') + '\n'

  // Kiểm tra lại — file gốc vẫn vượt thì cần tách sâu hơn
  if (mainContent.split('\n').length > MAX_LINES) {
    // Trường hợp hiếm: chunk đầu quá lớn — tách chunk đầu thêm
    return splitDeeper(cssPath, headerLines, chunks, dir, base, ext)
  }

  return { main: mainContent, parts }
}

/** Tách sâu hơn khi chunk đầu vẫn > MAX_LINES */
function splitDeeper(
  _cssPath: string,
  headerLines: string[],
  chunks: string[][],
  dir: string, base: string, ext: string
): CssSplitResult {
  // Gộp tất cả chunks thành flat, rồi chia đều
  const allContentLines = chunks.flat()
  const chunkSize = TARGET_LINES - headerLines.length - 10 // chừa cho import lines
  const newChunks: string[][] = []
  for (let i = 0; i < allContentLines.length; i += chunkSize) {
    newChunks.push(allContentLines.slice(i, i + chunkSize))
  }

  const parts: { path: string; content: string }[] = []
  const imports: string[] = []

  for (let i = 0; i < newChunks.length; i++) {
    const partName = i === 0 ? null : `${base}-part${i + 1}${ext}`
    if (partName) {
      const partPath = join(dir, partName).replace(/\\/g, '/')
      parts.push({ path: partPath, content: newChunks[i].join('\n') })
      imports.push(`@import './${partName}';`)
    }
  }

  const mainContent = [
    ...headerLines,
    ...newChunks[0],
    '',
    '/* === Auto-split: các phần mở rộng === */',
    ...imports,
    ''
  ].join('\n')

  return { main: mainContent, parts }
}

