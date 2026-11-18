#!/usr/bin/env node
/**
 * Biên dịch crate `crates/pxs_native_napi` (NAPI-RS 64-bit đa luồng Rayon)
 * thành addon Node-API `native/pxs_native_napi.<platform>-<arch>.node` cho Electron Main.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const CARGO_TOML = resolve(ROOT, 'crates/pxs_native_napi/Cargo.toml')
const TARGET_RELEASE = resolve(ROOT, 'crates/pxs_native_napi/target/release')
const OUT_DIR = resolve(ROOT, 'native')

const optionalIfNoRust = process.argv.includes('--if-rust')

function hasCargo() {
  try {
    execFileSync('cargo', ['--version'], { stdio: 'ignore', cwd: ROOT })
    return true
  } catch {
    return false
  }
}

function resolveCompiledLibraryPath() {
  if (process.platform === 'win32') {
    return resolve(TARGET_RELEASE, 'pxs_native_napi.dll')
  }
  if (process.platform === 'darwin') {
    return resolve(TARGET_RELEASE, 'libpxs_native_napi.dylib')
  }
  return resolve(TARGET_RELEASE, 'libpxs_native_napi.so')
}

function resolveNodeAddonFileName() {
  return `pxs_native_napi.${process.platform}-${process.arch}.node`
}

function buildAddon() {
  if (!hasCargo()) {
    if (optionalIfNoRust) {
      console.log('[napi:build] Không tìm thấy cargo — bỏ qua build native .node (giữ fallback WASM).')
      return
    }
    throw new Error('Không tìm thấy trình biên dịch Rust (cargo) trong PATH.')
  }

  console.log('[napi:build] Đang biên dịch pxs_native_napi (NAPI-RS 64-bit + Rayon)...')
  const env = { ...process.env }
  if (process.arch === 'x64' && !env.RUSTFLAGS) {
    env.RUSTFLAGS = '-C target-cpu=x86-64-v2'
  }

  execFileSync('cargo', ['build', '--release', '--manifest-path', CARGO_TOML], {
    stdio: 'inherit',
    cwd: ROOT,
    env
  })

  const dylibPath = resolveCompiledLibraryPath()
  if (!existsSync(dylibPath)) {
    throw new Error(`Không tìm thấy thư viện biên dịch tại: ${dylibPath}`)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const addonName = resolveNodeAddonFileName()
  const destPath = resolve(OUT_DIR, addonName)
  const stagedPath = resolve(OUT_DIR, `${addonName}.next`)

  const nextBytes = readFileSync(dylibPath)
  if (existsSync(destPath)) {
    const curBytes = readFileSync(destPath)
    if (curBytes.equals(nextBytes)) {
      console.log(`[napi:build] ✓ Addon đã cập nhật sẵn (${destPath}, ${nextBytes.length} bytes).`)
      return
    }
  }

  try {
    copyFileSync(dylibPath, destPath)
    console.log(`[napi:build] ✓ Đã xuất addon native: ${destPath} (${nextBytes.length} bytes).`)
  } catch (err) {
    const code = err && typeof err === 'object' ? err.code : ''
    if (code === 'EBUSY' || code === 'EPERM') {
      copyFileSync(dylibPath, stagedPath)
      console.warn(
        `[napi:build] Addon đang được tiến trình Electron giữ khoá — đã ghi bản mới vào ${stagedPath}.`
      )
      return
    }
    throw err
  }
}

buildAddon()
