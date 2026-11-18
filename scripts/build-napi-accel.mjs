#!/usr/bin/env node
/**
 * Biên dịch crate `crates/pxs_native_napi` (NAPI-RS 64-bit đa luồng Rayon)
 * thành addon Node-API `native/pxs_native_napi.<platform>-<arch>.node` cho Electron Main.
 *
 * Hỗ trợ cơ chế chống lỗi khoá file trên Windows (`EBUSY` / `EPERM` khi Electron đang mở):
 * - Nếu `.node` đang bị khoá, ghi bản mới ra `*.next.node` (giữ đuôi `.node` chuẩn cho `dlopen`)
 *   để lần khởi động kế tiếp tự động nâng cấp sang bản mới.
 * - Cờ hỗ trợ:
 *   `--if-rust`         : Không báo lỗi nếu máy chưa cài `cargo` (tôn trọng `PXS_AUTO_BUILD_NAPI=0` trong `.env`).
 *   `--only-if-missing` : Chỉ biên dịch khi chưa có sẵn `.node` (hoặc thúc đẩy `.next.node` nếu có).
 *   `--promote-only`    : Chỉ nâng cấp `*.next.node` -> `*.node` (dùng trong `start.bat` sau khi đóng tiến trình cũ).
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(import.meta.dirname, '..')
const CARGO_TOML = resolve(ROOT, 'crates/pxs_native_napi/Cargo.toml')
const TARGET_RELEASE = resolve(ROOT, 'crates/pxs_native_napi/target/release')
const OUT_DIR = resolve(ROOT, 'native')
const DIST_NATIVE_DIR = resolve(ROOT, 'out/native')

export function loadRootDotEnvForScript(rootDir = ROOT, targetEnv = process.env) {
  const envFile = resolve(rootDir, '.env')
  if (!existsSync(envFile)) return
  try {
    const raw = readFileSync(envFile, 'utf8').replace(/^\uFEFF/, '')
    for (const rawLine of raw.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const body = line.startsWith('export ') ? line.slice(7).trim() : line
      const eq = body.indexOf('=')
      if (eq <= 0) continue
      const key = body.slice(0, eq).trim()
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
      let val = body.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      } else {
        const cIdx = val.search(/\s+#/)
        if (cIdx >= 0) val = val.slice(0, cIdx).trim()
      }
      if (val !== '' && (targetEnv[key] === undefined || targetEnv[key] === '')) {
        targetEnv[key] = val
      }
    }
  } catch {
    /* Bỏ qua nếu .env không đọc được */
  }
}

export function resolveNodeAddonFileName(platform = process.platform, arch = process.arch) {
  return `pxs_native_napi.${platform}-${arch}.node`
}

export function resolveStagedAddonFileName(addonName) {
  return addonName.endsWith('.node')
    ? `${addonName.slice(0, -5)}.next.node`
    : `${addonName}.next.node`
}

function buildCargoEnv(baseEnv = process.env) {
  const env = { ...baseEnv }
  const cargoBin = join(homedir(), '.cargo', 'bin')
  if (existsSync(cargoBin) && !(env.PATH || '').includes(cargoBin)) {
    env.PATH = `${cargoBin}${delimiter}${env.PATH || ''}`
  }
  const targetCpu = (env.PXS_NAPI_TARGET_CPU || 'x86-64-v2').trim()
  if (process.arch === 'x64' && !env.RUSTFLAGS && targetCpu) {
    env.RUSTFLAGS = `-C target-cpu=${targetCpu}`
  }
  return env
}

function hasCargo(env) {
  try {
    execFileSync('cargo', ['--version'], { stdio: 'ignore', cwd: ROOT, env })
    return true
  } catch {
    return false
  }
}

function resolveCompiledLibraryPath() {
  if (process.platform === 'win32') return resolve(TARGET_RELEASE, 'pxs_native_napi.dll')
  if (process.platform === 'darwin') return resolve(TARGET_RELEASE, 'libpxs_native_napi.dylib')
  return resolve(TARGET_RELEASE, 'libpxs_native_napi.so')
}

function tryRemoveFile(filePath) {
  if (!existsSync(filePath)) return
  try {
    unlinkSync(filePath)
  } catch {
    /* Bỏ qua nếu file tạm vẫn đang bị giữ */
  }
}

/**
 * Thúc đẩy bản chờ `*.next.node` (hoặc `.node.next` cũ) sang `*.node` chính thức khi khoá đã nhả.
 */
export function promotePendingAddon({ outDir = OUT_DIR, addonName = resolveNodeAddonFileName() } = {}) {
  const destPath = resolve(outDir, addonName)
  const stagedPath = resolve(outDir, resolveStagedAddonFileName(addonName))
  const legacyStaged = resolve(outDir, `${addonName}.next`)
  const pendingPath = existsSync(stagedPath) ? stagedPath : existsSync(legacyStaged) ? legacyStaged : null
  if (!pendingPath) return { promoted: false, destPath }

  try {
    copyFileSync(pendingPath, destPath)
    tryRemoveFile(stagedPath)
    tryRemoveFile(legacyStaged)
    return { promoted: true, destPath }
  } catch {
    return { promoted: false, destPath, pendingPath }
  }
}

/**
 * Sao chép thư viện biên dịch ra `.node`, tự động chuyển sang `*.next.node` nếu Windows báo `EBUSY` / `EPERM`.
 */
export function deployCompiledAddon({
  dylibPath,
  outDir = OUT_DIR,
  addonName = resolveNodeAddonFileName(),
  copyFileImpl = copyFileSync
}) {
  mkdirSync(outDir, { recursive: true })
  const destPath = resolve(outDir, addonName)
  const stagedPath = resolve(outDir, resolveStagedAddonFileName(addonName))
  const legacyStaged = resolve(outDir, `${addonName}.next`)
  const nextBytes = readFileSync(dylibPath)

  if (existsSync(destPath)) {
    const curBytes = readFileSync(destPath)
    if (curBytes.equals(nextBytes)) {
      tryRemoveFile(stagedPath)
      tryRemoveFile(legacyStaged)
      return { status: 'unchanged', path: destPath, bytes: nextBytes.length }
    }
  }

  try {
    copyFileImpl(dylibPath, destPath)
    tryRemoveFile(stagedPath)
    tryRemoveFile(legacyStaged)
    return { status: 'updated', path: destPath, bytes: nextBytes.length }
  } catch (err) {
    const code = err && typeof err === 'object' ? err.code : ''
    if (code === 'EBUSY' || code === 'EPERM') {
      copyFileImpl(dylibPath, stagedPath)
      tryRemoveFile(legacyStaged)
      return { status: 'staged', path: stagedPath, bytes: nextBytes.length }
    }
    throw err
  }
}

function syncDistNativeIfBuilt(sourceAddonPath, addonName) {
  if (!existsSync(resolve(ROOT, 'out')) || !existsSync(sourceAddonPath)) return
  try {
    mkdirSync(DIST_NATIVE_DIR, { recursive: true })
    copyFileSync(sourceAddonPath, resolve(DIST_NATIVE_DIR, addonName))
  } catch {
    /* Bỏ qua nếu out/native đang bị giữ khoá */
  }
}

export function runNapiBuildCli(argv = process.argv.slice(2)) {
  loadRootDotEnvForScript()
  const optionalIfNoRust = argv.includes('--if-rust')
  const onlyIfMissing = argv.includes('--only-if-missing')
  const promoteOnly = argv.includes('--promote-only')
  const addonName = resolveNodeAddonFileName()

  const promoted = promotePendingAddon({ outDir: OUT_DIR, addonName })
  if (promoted.promoted) {
    console.log(`[napi:build] ✓ Đã nâng cấp addon chờ sang bản chính thức: ${promoted.destPath}`)
  }
  if (promoteOnly) {
    syncDistNativeIfBuilt(resolve(OUT_DIR, addonName), addonName)
    return
  }

  if (optionalIfNoRust && process.env.PXS_AUTO_BUILD_NAPI === '0') {
    console.log('[napi:build] PXS_AUTO_BUILD_NAPI=0 trong .env — bỏ qua tự động biên dịch .node.')
    return
  }

  const destPath = resolve(OUT_DIR, addonName)
  if (onlyIfMissing && existsSync(destPath)) {
    return
  }

  const env = buildCargoEnv()
  if (!hasCargo(env)) {
    if (optionalIfNoRust) {
      console.log('[napi:build] Không tìm thấy cargo — bỏ qua build native .node (giữ fallback WASM).')
      return
    }
    throw new Error('Không tìm thấy trình biên dịch Rust (cargo) trong PATH.')
  }

  console.log('[napi:build] Đang biên dịch pxs_native_napi (NAPI-RS 64-bit + Rayon)...')
  execFileSync('cargo', ['build', '--release', '--manifest-path', CARGO_TOML], {
    stdio: 'inherit',
    cwd: ROOT,
    env
  })

  const dylibPath = resolveCompiledLibraryPath()
  if (!existsSync(dylibPath)) {
    throw new Error(`Không tìm thấy thư viện biên dịch tại: ${dylibPath}`)
  }

  const result = deployCompiledAddon({ dylibPath, outDir: OUT_DIR, addonName })
  if (result.status === 'unchanged') {
    console.log(`[napi:build] ✓ Addon đã cập nhật sẵn (${result.path}, ${result.bytes} bytes).`)
  } else if (result.status === 'updated') {
    console.log(`[napi:build] ✓ Đã xuất addon native: ${result.path} (${result.bytes} bytes).`)
  } else {
    console.warn(
      `[napi:build] Addon đang được Electron giữ khoá — đã ghi bản chờ vào ${result.path} (tự áp dụng ở lần mở tiếp theo).`
    )
  }

  syncDistNativeIfBuilt(result.path, addonName)
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  runNapiBuildCli()
}
