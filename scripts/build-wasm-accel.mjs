#!/usr/bin/env node
/**
 * Biên dịch crate `crates/pxs_core_accel` sang target `wasm32-unknown-unknown` (SIMD128)
 * và xuất chuỗi hex an toàn vào `src/renderer/src/engine/wasm/wasmBytes.ts`.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const CARGO_TOML = resolve(ROOT, 'crates/pxs_core_accel/Cargo.toml')
const WASM_OUT = resolve(
  ROOT,
  'crates/pxs_core_accel/target/wasm32-unknown-unknown/release/pxs_core_accel.wasm'
)
const TS_OUT = resolve(ROOT, 'src/renderer/src/engine/wasm/wasmBytes.ts')
const LINE_WIDTH = 1024

function ensureWasmTarget() {
  const installed = execFileSync('rustup', ['target', 'list', '--installed'], {
    encoding: 'utf8',
    cwd: ROOT
  })
  if (!installed.split(/\r?\n/).some((line) => line.trim() === 'wasm32-unknown-unknown')) {
    console.log('[wasm:build] Cài đặt target wasm32-unknown-unknown...')
    execFileSync('rustup', ['target', 'add', 'wasm32-unknown-unknown'], {
      stdio: 'inherit',
      cwd: ROOT
    })
  }
}

function buildWasm() {
  console.log('[wasm:build] Đang biên dịch pxs_core_accel (wasm32-unknown-unknown + simd128)...')
  execFileSync(
    'cargo',
    ['build', '--release', '--target', 'wasm32-unknown-unknown', '--manifest-path', CARGO_TOML],
    { stdio: 'inherit', cwd: ROOT }
  )
  if (!existsSync(WASM_OUT)) {
    throw new Error(`Không tìm thấy file WASM sau khi biên dịch: ${WASM_OUT}`)
  }
}

function emitTsHexModule() {
  const bytes = readFileSync(WASM_OUT)
  const hex = bytes.toString('hex')
  const chunks = []
  for (let i = 0; i < hex.length; i += LINE_WIDTH) {
    chunks.push(`  '${hex.slice(i, i + LINE_WIDTH)}'`)
  }

  const content = [
    '// Tệp tự động sinh bởi scripts/build-wasm-accel.mjs — không sửa tay.',
    `// Kích thước WASM: ${bytes.length} bytes`,
    'export const PXS_CORE_ACCEL_WASM_HEX = [',
    chunks.join(',\n'),
    "].join('')",
    ''
  ].join('\n')

  mkdirSync(dirname(TS_OUT), { recursive: true })
  writeFileSync(TS_OUT, content, 'utf8')
  const lineCount = content.split('\n').length
  console.log(
    `[wasm:build] Đã ghi ${TS_OUT} (${bytes.length} bytes, ${lineCount} dòng).`
  )
}

ensureWasmTarget()
buildWasm()
emitTsHexModule()
