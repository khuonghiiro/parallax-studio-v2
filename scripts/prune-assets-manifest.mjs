#!/usr/bin/env node
/**
 * Dọn dẹp assets/manifest.json và các phân hệ assets/manifests/*.json
 * sau khi xoá tài nguyên khỏi thư mục assets/ hoặc assets/_temp_deleted/.
 *
 * - Xoá hẳn các mục trong "assets" (và "items") trỏ tới file không còn tồn tại
 *   ở cả thư mục chính lẫn thư mục tạm `assets/_temp_deleted/`.
 * - Tự động đánh dấu `status: "deleted"` cho các mục đang nằm trong `assets/_temp_deleted/`
 *   và khôi phục `status: "active"` nếu file đã được đưa trở lại `assets/`.
 * - Xoá các danh mục (categories) có thư mục không còn file media nào
 *   (giữ lại danh mục gốc folder '' – "Tất cả tài nguyên" và danh mục chủ đề xưởng).
 * - Báo cáo các file media mới chưa khai báo tên trong manifest (tuỳ chọn --add-new để thêm).
 *
 * Cách dùng:
 *   node scripts/prune-assets-manifest.mjs [--dry-run] [--keep-empty] [--add-new] [--root <dir>]
 *   hoặc nhấp đúp assets/prune-manifest.bat
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MEDIA_EXTS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'svg',
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'aac',
  'flac'
])
const SKIP_NAMES = new Set(['manifest.json', 'readme.md', '.gitkeep'])
const SKIP_DIRS = new Set(['_temp_deleted', 'manifests', 'icons'])

/** Liệt kê toàn bộ file media (đường dẫn tương đối dạng a/b.png) trong thư mục gốc (bỏ qua _temp_deleted, manifests, icons). */
export function listMediaFiles(root, options = {}) {
  const skipDirs = options.skipDirs || SKIP_DIRS
  const out = []
  const walk = (dir, isRoot = false) => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (isRoot && entry.isDirectory() && skipDirs.has(entry.name.toLowerCase())) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full, false)
      else if (entry.isFile() && !SKIP_NAMES.has(entry.name.toLowerCase())) {
        const ext = extname(entry.name).slice(1).toLowerCase()
        if (MEDIA_EXTS.has(ext)) out.push(relative(root, full).replace(/\\/g, '/'))
      }
    }
  }
  walk(root, true)
  return out.sort()
}

/** Liệt kê các file đang nằm trong thư mục xoá tạm `assets/_temp_deleted/` (trả về đường dẫn tương đối gốc). */
export function listTempDeletedFiles(root, tempFolderName = '_temp_deleted') {
  const tempRoot = join(root, tempFolderName)
  if (!existsSync(tempRoot)) return []
  return listMediaFiles(tempRoot, { skipDirs: new Set() })
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
  const { keepEmpty = false, addNew = false, tempFiles = [], tempFolderName = '_temp_deleted', skipUnlisted = false } = options
  const fileSet = new Set(files)
  const baseNames = new Set(files.map((f) => basename(f)))
  const tempFileSet = new Set(tempFiles)
  const tempBaseNames = new Set(tempFiles.map((f) => basename(f)))
  const next = { ...manifest }
  const report = {
    removedAssets: [],
    removedItems: [],
    removedCategories: [],
    softDeletedAssets: [],
    restoredAssets: [],
    unlisted: [],
    added: []
  }

  if (manifest.assets && typeof manifest.assets === 'object' && !Array.isArray(manifest.assets)) {
    next.assets = {}
    for (const [key, value] of Object.entries(manifest.assets)) {
      const inActive = keyExists(key, fileSet, baseNames)
      const inTemp = !inActive && tempFiles.length > 0 && keyExists(key, tempFileSet, tempBaseNames)
      if (inActive) {
        if (value && typeof value === 'object' && value.status === 'deleted') {
          const rest = { ...value, status: 'active' }
          delete rest.tempPath
          delete rest.deletedAt
          next.assets[key] = rest
          report.restoredAssets.push(key)
        } else {
          next.assets[key] = value
        }
      } else if (inTemp) {
        const rel = normalizeKey(key)
        const baseObj = typeof value === 'string' ? { name: value } : { ...(value || {}) }
        if (baseObj.status !== 'deleted') {
          report.softDeletedAssets.push(key)
        }
        next.assets[key] = {
          ...baseObj,
          status: 'deleted',
          tempPath: `${tempFolderName}/${rel}`
        }
      } else {
        report.removedAssets.push(key)
      }
    }
  }

  if (Array.isArray(manifest.items)) {
    next.items = manifest.items.filter((it) => {
      const key = it && (it.path || it.relativePath || it.fileName)
      if (!key || keyExists(key, fileSet, baseNames) || keyExists(key, tempFileSet, tempBaseNames)) return true
      report.removedItems.push(key)
      return false
    })
  }

  const isTopicModule = Boolean(manifest.moduleId && manifest.moduleId !== 'builtin')
  if (Array.isArray(manifest.categories) && !keepEmpty && !isTopicModule) {
    const allKnownFiles = [...files, ...tempFiles]
    next.categories = manifest.categories.filter((c) => {
      const folder = typeof c?.folder === 'string' ? c.folder : ''
      if (!folder || folderHasMedia(folder, allKnownFiles)) return true
      report.removedCategories.push(c.id || folder)
      return false
    })
  }

  if (!skipUnlisted) {
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
  }
  return { manifest: next, report }
}

export function hasChanges(report) {
  return (
    report.removedAssets.length +
      report.removedItems.length +
      report.removedCategories.length +
      (report.softDeletedAssets?.length || 0) +
      (report.restoredAssets?.length || 0) +
      report.added.length >
    0
  )
}

/** Giữ nguyên kiểu xuống dòng (CRLF/LF) và dòng trống cuối file của manifest gốc. */
export function serializeLike(raw, data) {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const trailing = /\r?\n$/.test(raw) ? eol : ''
  return JSON.stringify(data, null, 2).replace(/\n/g, eol) + trailing
}

/**
 * Quét và đồng bộ cả `assets/manifest.json` lẫn toàn bộ `assets/manifests/*.json` được khai báo trong `modules`.
 */
export function pruneModularWorkspace(root, opts = {}) {
  const manifestPath = join(root, 'manifest.json')
  if (!existsSync(manifestPath) || !statSync(manifestPath).isFile()) {
    throw new Error(`Không tìm thấy ${manifestPath}`)
  }
  const raw = readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '')
  const manifest = JSON.parse(raw)
  const tempFolderName = manifest.tempTrashFolder || '_temp_deleted'
  const files = listMediaFiles(root)
  const tempFiles = listTempDeletedFiles(root, tempFolderName)

  const { manifest: nextRoot, report: rootReport } = pruneManifest(manifest, files, {
    ...opts,
    tempFiles,
    tempFolderName
  })

  const moduleReports = {}
  if (nextRoot.modules && typeof nextRoot.modules === 'object') {
    for (const [modId, modEntry] of Object.entries(nextRoot.modules)) {
      if (!modEntry || typeof modEntry.file !== 'string') continue
      const modPath = join(root, modEntry.file)
      if (!existsSync(modPath)) continue
      try {
        const modRaw = readFileSync(modPath, 'utf8').replace(/^\uFEFF/, '')
        const modJson = JSON.parse(modRaw)
        const isBuiltinMod = modId === 'builtin'
        const { manifest: nextMod, report: modReport } = pruneManifest(modJson, files, {
          ...opts,
          keepEmpty: isBuiltinMod ? opts.keepEmpty : true,
          skipUnlisted: !isBuiltinMod,
          tempFiles,
          tempFolderName
        })
        if (isBuiltinMod) {
          nextMod.categories = nextRoot.categories
          nextMod.assets = nextRoot.assets
        }
        moduleReports[modId] = modReport
        if (!opts.dryRun && (hasChanges(modReport) || isBuiltinMod)) {
          writeFileSync(modPath, serializeLike(modRaw, nextMod), 'utf8')
        }
      } catch (err) {
        console.warn(`[prune] Bỏ qua module ${modId}: ${err.message}`)
      }
    }
  }

  if (!opts.dryRun && hasChanges(rootReport)) {
    writeFileSync(manifestPath, serializeLike(raw, nextRoot), 'utf8')
  }

  return {
    root,
    files,
    tempFiles,
    manifest: nextRoot,
    report: rootReport,
    moduleReports
  }
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
  if (!list || list.length === 0) return
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

  let result
  try {
    result = pruneModularWorkspace(root, opts)
  } catch (err) {
    console.error(`[prune] ${err.message}`)
    return 1
  }

  const { files, tempFiles, report, moduleReports } = result
  console.log(`[prune] Thư mục: ${root}`)
  console.log(`[prune] File media hoạt động: ${files.length} | File trong kho tạm (_temp_deleted): ${tempFiles.length}`)
  printList('Đã xoá vĩnh viễn mục tài nguyên không còn file', report.removedAssets)
  printList('Đã chuyển sang trạng thái xoá tạm (nằm trong _temp_deleted)', report.softDeletedAssets)
  printList('Đã khôi phục trạng thái active', report.restoredAssets)
  printList('Đã xoá mục items không còn file', report.removedItems)
  printList('Đã xoá danh mục rỗng / thư mục không còn', report.removedCategories)
  printList(
    opts.addNew ? 'Đã thêm file mới vào manifest' : 'File mới chưa khai báo tên (dùng --add-new để thêm)',
    report.unlisted
  )

  const changedMods = Object.entries(moduleReports).filter(([, r]) => hasChanges(r))
  if (!hasChanges(report) && changedMods.length === 0) {
    console.log('\n[prune] manifest.json và các manifests/*.json đã sạch, không cần thay đổi.')
    return 0
  }
  if (opts.dryRun) {
    console.log('\n[prune] --dry-run: chưa ghi thay đổi nào.')
    return 0
  }
  console.log(`\n[prune] Đã đồng bộ manifest.json và ${ Object.keys(moduleReports).length } phân hệ con.`)
  return 0
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) process.exit(main())
