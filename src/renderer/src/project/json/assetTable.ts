/**
 * assetTable.ts — Quản lý bảng tài nguyên (Asset Aliases Dictionary) dùng chung cho cả 3 phân hệ:
 * 1. Cảnh / Dự án (Shots / Project / Declarative Project Spec)
 * 2. Lắp ráp 3D (Models3D / Assembly 3D / Faces)
 * 3. Lắp ráp Layer (Layer Assembly / Composites / Layers)
 *
 * Cho phép định danh tài nguyên bằng nhãn (alias) 1 lần:
 *   "assets": {
 *     "hero_head": "character_cutout_demo/head.png",
 *     "pot": { "path": "assembly_3d/modular/bonsai_pot.png", "quality": "4k" }
 *   }
 * Các layer hoặc mặt 3D chỉ cần tham chiếu "asset": "@hero_head" hoặc "hero_head".
 * Khi nâng cấp chất lượng hoặc đổi đường dẫn, chỉ cần thay đổi 1 dòng trong bảng "assets".
 */

export interface DetailedAssetEntry {
  path: string
  title?: string
  quality?: string
  mime?: string
  width?: number
  height?: number
  [key: string]: unknown
}

export type AssetTableEntry = string | DetailedAssetEntry

export type AssetTable = Record<string, AssetTableEntry>

/**
 * Kiểm tra xem một đối tượng có phải là AssetTable hợp lệ không
 */
export function isAssetTable(obj: unknown): obj is AssetTable {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  return Object.values(obj as Record<string, unknown>).every(
    (v) => typeof v === 'string' || (v && typeof v === 'object' && typeof (v as any).path === 'string')
  )
}

/**
 * Lấy đường dẫn thực tế (path/url) từ một entry trong AssetTable
 */
export function getAssetPathFromEntry(entry?: AssetTableEntry | null): string | undefined {
  if (!entry) return undefined
  if (typeof entry === 'string') return entry.trim()
  if (typeof entry === 'object' && entry !== null) {
    if (typeof entry.path === 'string') return entry.path.trim()
    if (typeof (entry as any).src === 'string') return (entry as any).src.trim()
    if (typeof (entry as any).url === 'string') return (entry as any).url.trim()
  }
  return undefined
}

/**
 * Giải quyết tham chiếu tài nguyên (alias hoặc path trực tiếp) qua AssetTable:
 * - Nếu `ref` bắt đầu bằng '@', bỏ '@' rồi tra cứu trong table.
 * - Nếu `ref` tồn tại dưới dạng key trong table, tra cứu trực tiếp.
 * - Nếu tìm thấy trong table, trả về đường dẫn được cấu hình.
 * - Nếu không có trong table, trả về chính `ref` (bỏ '@' nếu có), bảo đảm tương thích ngược 100%.
 */
export function resolveAssetAlias(ref?: string | null, table?: AssetTable | null): string {
  if (!ref) return ''
  const trimmed = ref.trim()
  if (!trimmed) return ''

  if (table && typeof table === 'object') {
    // Trường hợp 1: ref bắt đầu bằng '@' (vd: "@hero_head")
    if (trimmed.startsWith('@')) {
      const aliasKey = trimmed.slice(1).trim()
      if (aliasKey in table) {
        const resolved = getAssetPathFromEntry(table[aliasKey])
        if (resolved) return resolved
      }
    }

    // Trường hợp 2: ref là key trực tiếp trong bảng assets (vd: "hero_head")
    if (trimmed in table) {
      const resolved = getAssetPathFromEntry(table[trimmed])
      if (resolved) return resolved
    }
  }

  // Trường hợp 3: không có trong table hoặc ref đã là đường dẫn trực tiếp
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
}

/**
 * Gán hoặc cập nhật nhãn tài nguyên trong AssetTable
 */
export function setAssetAliasInTable(
  table: AssetTable | undefined | null,
  alias: string,
  entry: AssetTableEntry
): AssetTable {
  const cleanAlias = alias.replace(/^@/, '').trim()
  if (!cleanAlias) throw new Error('Asset alias key cannot be empty')
  const next: AssetTable = { ...(table || {}) }
  next[cleanAlias] = typeof entry === 'string' ? entry.trim() : { ...entry }
  return next
}

/**
 * Xóa một nhãn tài nguyên khỏi AssetTable
 */
export function removeAssetAliasFromTable(
  table: AssetTable | undefined | null,
  alias: string
): AssetTable {
  const cleanAlias = alias.replace(/^@/, '').trim()
  const next: AssetTable = { ...(table || {}) }
  delete next[cleanAlias]
  return next
}

/**
 * Thay thế đường dẫn tài nguyên cũ bằng đường dẫn mới trên toàn bộ bảng assets
 */
export function replaceAssetPathInTable(
  table: AssetTable | undefined | null,
  oldPath: string,
  newPath: string
): { table: AssetTable; replacedCount: number } {
  const normOld = oldPath.trim().replace(/\\/g, '/').replace(/^assets\//, '')
  const normNew = newPath.trim().replace(/\\/g, '/')
  const next: AssetTable = { ...(table || {}) }
  let replacedCount = 0

  for (const [key, value] of Object.entries(next)) {
    const curPath = getAssetPathFromEntry(value)
    if (!curPath) continue
    const normCur = curPath.replace(/\\/g, '/').replace(/^assets\//, '')
    if (normCur === normOld || curPath === oldPath) {
      if (typeof value === 'string') {
        next[key] = normNew
      } else {
        next[key] = { ...value, path: normNew }
      }
      replacedCount++
    }
  }

  return { table: next, replacedCount }
}

/**
 * Trích xuất bảng AssetTable dạng rút gọn (key: path) từ các item có sẵn
 */
export function buildAssetTableFromItems(
  items: Array<{ id?: string; name?: string; asset?: string; assetPath?: string; src?: string }>
): AssetTable {
  const table: AssetTable = {}
  for (const item of items) {
    const p = item.assetPath || item.src || item.asset
    if (!p || p.startsWith('data:') || p.startsWith('blob:') || p.startsWith('http')) continue
    const cleanKey = (item.name || item.id || p.split('/').pop() || 'asset')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')

    if (cleanKey && !(cleanKey in table)) {
      table[cleanKey] = p
    }
  }
  return table
}
