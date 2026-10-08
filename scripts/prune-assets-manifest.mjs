#!/usr/bin/env node
/**
 * Dọn dẹp assets/manifest.json sau khi xoá tài nguyên khỏi thư mục assets/.
 *
 * - Xoá các mục trong "assets" (và "items") trỏ tới file không còn tồn tại.
 * - Xoá các danh mục (categories) có thư mục không còn file media nào
 *   (giữ lại danh mục gốc folder '' – "Tất cả tài nguyên").
 * - Báo cáo các file media mới chưa khai báo tên trong manifest (tuỳ chọn --add-new để thêm).
 *
 * Cách dùng:
 *   node scripts/prune-assets-manifest.mjs [--dry-run] [--keep-empty] [--add-new] [--root <dir>]
 *   hoặc nhấp đúp assets/prune-manifest.bat
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MEDIA_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'])
const SKIP_NAMES = new Set(['manifest.json', 'readme.md'])

/** Liệt kê toàn bộ file media (đường dẫn tương đối dạng a/b.png) trong thư mục gốc. */
export function listMediaFiles(root) {
  const out = []
  const walk = (dir) => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && !SKIP_NAMES.has(entry.name.toLowerCase())) {
        const ext = extname(entry.name).slice(1).toLowerCase()
        if (MEDIA_EXTS.has(ext)) out.push(relative(root, full).replace(/\\/g, '/'))
      }
    }
  }
  walk(root)
  return out.sort()
}

/** Chuẩn hoá khoá manifest về đường dẫn tương đối so với assets/. */
function normalizeKey(key) {
  return String(key).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^assets\//, '')
}

/** Khoá manifest có còn trỏ tới file thật không (hỗ trợ cả khoá chỉ là tên file). */
function keyExists(key, fileSet, baseNames) {
  const rel = normalizeKey(key)
  if (fileSet.has(rel)) return true
  return !rel.includes('/') && baseNames.has(rel)
}

function folderHasMedia(folder, files) {
  const prefix = `${normalizeKey(folder).replace(/\/+$/, '')}/`
  return files.some((f) => f.startsWith(prefix))
}

function prettyName(rel) {
  return basename(rel, extname(rel)).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Hàm thuần: nhận manifest + danh sách file media hiện có, trả về manifest đã dọn và báo cáo.
 * Không đọc/ghi đĩa để có thể kiểm thử độc lập.
 */
export function pruneManifest(manifest, files, options = {}) {
  const { keepEmpty = false, addNew = false } = options
  const fileSet = new Set(files)
  const baseNames = new Set(files.map((f) => basename(f)))
  const next = { ...manifest }
  const report = { removedAssets: [], removedItems: [], removedCategories: [], unlisted: [], added: [] }

  if (manifest.assets && typeof manifest.assets === 'object' && !Array.isArray(manifest.assets)) {
    next.assets = {}
    for (const [key, value] of Object.entries(manifest.assets)) {
      if (keyExists(key, fileSet, baseNames)) next.assets[key] = value
      else report.removedAssets.push(key)
    }
  }

  if (Array.isArray(manifest.items)) {
    next.items = manifest.items.filter((it) => {
      const key = it && (it.path || it.relativePath || it.fileName)
      if (!key || keyExists(key, fileSet, baseNames)) return true
      report.removedItems.push(key)
      return false
    })
  }

  if (Array.isArray(manifest.categories) && !keepEmpty) {
    next.categories = manifest.categories.filter((c) => {
      const folder = typeof c?.folder === 'string' ? c.folder : ''
      if (!folder || folderHasMedia(folder, files)) return true
      report.removedCategories.push(c.id || folder)
      return false
    })
  }

  const declared = new Set([
    ...Object.keys(next.assets || {}).map(normalizeKey),
    ...(next.items || []).map((it) => normalizeKey(it?.path || it?.relativePath || it?.fileName || ''))
  ])
  const declaredBase = new Set([...declared].filter((k) => !k.includes('/')))
  for (const rel of files) {
    if (declared.has(rel) || declaredBase.has(basename(rel))) continue
    report.unlisted.push(rel)
    if (addNew) {
      next.assets = next.assets || {}
      next.assets[rel] = { name: prettyName(rel) }
      report.added.push(rel)
    }
  }
  return { manifest: next, report }
}

export function hasChanges(report) {
  return (
    report.removedAssets.length + report.removedItems.length + report.removedCategories.length + report.added.length > 0
  )
}

/** Giữ nguyên kiểu xuống dòng (CRLF/LF) và dòng trống cuối file của manifest gốc. */
export function serializeLike(raw, data) {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const trailing = /\r?\n$/.test(raw) ? eol : ''
  return JSON.stringify(data, null, 2).replace(/\n/g, eol) + trailing
}

function parseArgs(argv) {
  const opts = { dryRun: false, keepEmpty: false, addNew: false, root: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run' || a === '-n') opts.dryRun = true
    else if (a === '--keep-empty') opts.keepEmpty = true
    else if (a === '--add-new') opts.addNew = true
    else if (a === '--root') opts.root = argv[++i]
    else if (a === '--help' || a === '-h') opts.help = true
  }
  return opts
}

function printList(title, list) {
  if (list.length === 0) return
  console.log(`\n${title} (${list.length}):`)
  for (const entry of list) console.log(`  - ${entry}`)
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log('Usage: node scripts/prune-assets-manifest.mjs [--dry-run] [--keep-empty] [--add-new] [--root <dir>]')
    return 0
  }
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const root = resolve(opts.root || join(repoRoot, 'assets'))
  const manifestPath = join(root, 'manifest.json')
  if (!existsSync(manifestPath) || !statSync(manifestPath).isFile()) {
    console.error(`[prune] Không tìm thấy ${manifestPath}`)
    return 1
  }

  const raw = readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '')
  let manifest
  try {
    manifest = JSON.parse(raw)
  } catch (err) {
    console.error(`[prune] manifest.json sai cú pháp JSON: ${err.message}`)
    return 1
  }

  const files = listMediaFiles(root)
  const { manifest: next, report } = pruneManifest(manifest, files, opts)
  console.log(`[prune] Thư mục: ${root}`)
  console.log(`[prune] File media hiện có: ${files.length}`)
  printList('Đã xoá mục tài nguyên không còn file', report.removedAssets)
  printList('Đã xoá mục items không còn file', report.removedItems)
  printList('Đã xoá danh mục rỗng / thư mục không còn', report.removedCategories)
  printList(opts.addNew ? 'Đã thêm file mới vào manifest' : 'File mới chưa khai báo tên (dùng --add-new để thêm)', report.unlisted)

  if (!hasChanges(report)) {
    console.log('\n[prune] manifest.json đã sạch, không cần thay đổi.')
    return 0
  }
  if (opts.dryRun) {
    console.log('\n[prune] --dry-run: chưa ghi thay đổi nào.')
    return 0
  }
  writeFileSync(manifestPath, serializeLike(raw, next), 'utf8')
  console.log(`\n[prune] Đã cập nhật ${manifestPath}`)
  return 0
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) process.exit(main())
