#!/usr/bin/env node
/**
 * Tải binary ffmpeg cho chức năng xuất video MP4 — KHÔNG BAO GIỜ làm hỏng quá trình cài đặt.
 *
 * Thứ tự ưu tiên tìm ffmpeg (đồng bộ với `src/main/ffmpeg.ts` → `ffmpegPath()`):
 *   1. Biến môi trường FFMPEG_BIN
 *   2. `bin/ffmpeg(.exe)` trong thư mục dự án (copy tay khi mạng nội bộ chặn tải)
 *   3. `node_modules/ffmpeg-static/ffmpeg(.exe)` (tải bởi script này)
 *   4. ffmpeg trên PATH hệ thống
 *
 * Khi chưa có, thử tải qua mirror npmmirror trước (mạng VN / proxy hay chặn GitHub), rồi GitHub gốc.
 * Luôn thoát mã 0 để `setup.bat` / CI không bị chặn chỉ vì thiếu ffmpeg.
 *
 * Dùng: `pnpm ffmpeg:install` hoặc `node scripts/ensure-ffmpeg.mjs [--force]`
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BIN_NAME = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
const FFMPEG_STATIC_DIR = join(ROOT, 'node_modules', 'ffmpeg-static')
const MIRRORS = [
  'https://registry.npmmirror.com/-/binary/ffmpeg-static',
  '' // rỗng = dùng URL GitHub mặc định của ffmpeg-static
]

/** Trả về đường dẫn ffmpeg đã có sẵn (hoặc null). */
export function findExistingFfmpeg(env = process.env) {
  if (env.FFMPEG_BIN && existsSync(env.FFMPEG_BIN)) return env.FFMPEG_BIN
  const local = join(ROOT, 'bin', BIN_NAME)
  if (existsSync(local)) return local
  const fromStatic = join(FFMPEG_STATIC_DIR, BIN_NAME)
  if (existsSync(fromStatic)) return fromStatic
  const probe = spawnSync(BIN_NAME, ['-version'], { stdio: 'ignore', windowsHide: true })
  if (probe.status === 0) return `${BIN_NAME} (PATH)`
  return null
}

function tryDownload(mirror) {
  const env = { ...process.env }
  delete env.FFMPEG_BIN
  if (mirror) env.FFMPEG_BINARIES_URL = mirror
  else delete env.FFMPEG_BINARIES_URL
  const label = mirror || 'GitHub (mặc định)'
  console.log(`[ffmpeg] Đang tải ffmpeg từ ${label} ...`)
  const res = spawnSync(process.execPath, [join(FFMPEG_STATIC_DIR, 'install.js')], {
    cwd: FFMPEG_STATIC_DIR,
    env,
    stdio: 'inherit',
    windowsHide: true,
    timeout: 5 * 60 * 1000
  })
  return res.status === 0 && existsSync(join(FFMPEG_STATIC_DIR, BIN_NAME))
}

function main() {
  const force = process.argv.includes('--force')
  const existing = force ? null : findExistingFfmpeg()
  if (existing) {
    console.log(`[ffmpeg] Đã có ffmpeg: ${existing}`)
    return
  }
  if (!existsSync(join(FFMPEG_STATIC_DIR, 'install.js'))) {
    console.warn('[ffmpeg] Chưa cài gói ffmpeg-static (chạy pnpm install trước). Bỏ qua.')
    return
  }
  for (const mirror of MIRRORS) {
    if (tryDownload(mirror)) {
      console.log('[ffmpeg] Tải ffmpeg thành công.')
      return
    }
  }
  console.warn(
    '[ffmpeg] Không tải được ffmpeg (mạng chặn). Chức năng xuất MP4 cần ffmpeg:\n' +
      '         copy file ffmpeg.exe vào thư mục "bin\\" của dự án hoặc đặt biến FFMPEG_BIN.'
  )
}

const normPath = (p) => (process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p))
if (process.argv[1] && normPath(fileURLToPath(import.meta.url)) === normPath(process.argv[1])) {
  try {
    main()
  } catch (err) {
    console.warn('[ffmpeg] Lỗi không nghiêm trọng khi tải ffmpeg:', err?.message || err)
  }
  process.exit(0)
}
