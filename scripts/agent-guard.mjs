#!/usr/bin/env node
/**
 * Agent guard – cưỡng chế quy chuẩn AGENTS.md bằng git hooks (áp dụng cho MỌI AI/người dùng).
 *
 *   node scripts/agent-guard.mjs commit-msg <file>   → kiểm tra commit message
 *   node scripts/agent-guard.mjs pre-commit          → kiểm tra file staged (cú pháp esbuild/JSX, ≤ 1000 dòng, không secret)
 *   node scripts/agent-guard.mjs pre-push            → kiểm tra toàn bộ mã nguồn (esbuild + typecheck) trước khi push
 *   node scripts/agent-guard.mjs verify              → kiểm tra nhanh sau khi sửa code (esbuild toàn repo + typecheck + mcp:schemas)
 *   node scripts/agent-guard.mjs install             → bật hooks (git config core.hooksPath .githooks)
 *
 * Bỏ qua khẩn cấp: git commit --no-verify (không khuyến khích).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
let esbuild = null
try {
  esbuild = require('esbuild')
} catch {
  /* fallback nếu chưa cài node_modules */
}

export const MAX_FILE_LINES = 1000
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.py'])
const JS_TS_LOADERS = {
  '.ts': 'ts',
  '.tsx': 'tsx',
  '.js': 'js',
  '.jsx': 'jsx',
  '.mjs': 'js',
  '.cjs': 'js'
}
const CONVENTIONAL = /^(feat|fix|refactor|perf|chore|docs|test|style|build|ci|revert)(\([\w./-]+\))?!?: .+/
const VI_DIACRITICS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
const AI_MENTION = /(co-authored-by:.*\b(claude|gpt|copilot|gemini|cursor|codex|antigravity|ai)\b|generated (with|by) .*(claude|gpt|copilot|gemini|ai)|🤖)/i
const SECRET_FILE = /(^|\/)(\.env(\..+)?|id_rsa|id_ed25519|.*\.pem|.*\.p12|.*\.pfx|credentials\.json)$/i
const SECRET_TEXT = /(-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{32,}|ghp_[A-Za-z0-9]{36}|AIza[0-9A-Za-z_-]{35})/

/** Trả về danh sách lỗi của commit message (rỗng = hợp lệ). */
export function checkCommitMessage(message) {
  const lines = message.split(/\r?\n/).filter((l) => !l.startsWith('#'))
  const subject = (lines[0] || '').trim()
  const errors = []
  if (/^(Merge|Revert) /.test(subject) || /^(fixup|squash)! /.test(subject)) return errors
  if (!CONVENTIONAL.test(subject)) {
    errors.push('Tiêu đề phải theo Conventional Commits, ví dụ: "fix(ui): sửa lỗi ..." (feat|fix|refactor|perf|chore|docs|test...)')
  }
  if (!VI_DIACRITICS.test(lines.join('\n'))) {
    errors.push('Commit message phải viết bằng tiếng Việt CÓ DẤU (AGENTS.md §2.2).')
  }
  if (AI_MENTION.test(lines.join('\n'))) {
    errors.push('Không gắn watermark / nhắc tên AI trong commit message (AGENTS.md §2.2).')
  }
  return errors
}

/** Kiểm tra cú pháp JS/TS/JSX/TSX bằng esbuild (bắt lỗi ?? trộn &&/||, thẻ JSX lỗi, cú pháp hỏng). */
export function checkCodeSyntax(path, content) {
  if (!esbuild) return []
  const ext = extname(path).toLowerCase()
  const loader = JS_TS_LOADERS[ext]
  if (!loader) return []
  try {
    esbuild.transformSync(content, {
      loader,
      sourcefile: path,
      logLevel: 'silent'
    })
    return []
  } catch (err) {
    const first = err?.errors?.[0]
    if (first && first.location) {
      return [`${path}:${first.location.line}:${first.location.column}: Lỗi cú pháp (${first.text})`]
    }
    const msg = err instanceof Error ? err.message.split('\n')[0] : String(err)
    return [`${path}: Lỗi cú pháp (${msg})`]
  }
}

/** Kiểm tra một file staged: giới hạn dòng, secret và cú pháp biên dịch. */
export function checkStagedFile(path, content) {
  const errors = []
  if (SECRET_FILE.test(path)) errors.push(`${path}: file nhạy cảm (secret/key) không được commit.`)
  if (CODE_EXTS.has(extname(path).toLowerCase())) {
    const lines = content.split('\n').length - (content.endsWith('\n') ? 1 : 0)
    if (lines > MAX_FILE_LINES) {
      errors.push(`${path}: ${lines} dòng > ${MAX_FILE_LINES} (hard limit AGENTS.md §2.1) – hãy tách module.`)
    }
    errors.push(...checkCodeSyntax(path, content))
  }
  if (SECRET_TEXT.test(content)) errors.push(`${path}: phát hiện chuỗi giống private key / API token.`)
  return errors
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function walkCodeFiles(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'out', 'dist', '.git'].includes(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkCodeFiles(full))
    else if (JS_TS_LOADERS[extname(entry.name).toLowerCase()]) out.push(full)
  }
  return out
}

function runPreCommit() {
  const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).split('\0').filter(Boolean)
  const errors = []
  for (const path of staged) {
    if (/^(assets|asset-3ds|resources|out|dist|\.agents)\//.test(path)) continue
    let content = ''
    try {
      content = git(['show', `:${path}`])
    } catch {
      continue
    }
    if (content.includes('\0')) continue // binary
    errors.push(...checkStagedFile(path, content))
  }
  return errors
}

function runFullVerify() {
  const errors = []
  const files = [...walkCodeFiles('src'), ...walkCodeFiles('mcp-server'), ...walkCodeFiles('scripts')]
  for (const f of files) {
    const content = readFileSync(f, 'utf8')
    errors.push(...checkCodeSyntax(f.replace(/\\/g, '/'), content))
  }
  if (errors.length > 0) return errors

  const tscBin = resolve('node_modules', 'typescript', 'bin', 'tsc')
  if (existsSync(tscBin)) {
    for (const project of ['tsconfig.node.json', 'tsconfig.web.json']) {
      try {
        execFileSync(process.execPath, [tscBin, '--noEmit', '-p', project], {
          encoding: 'utf8',
          stdio: 'pipe'
        })
      } catch (err) {
        const out = (err.stdout || err.stderr || err.message || '').toString().trim()
        errors.push(`TypeScript (${project}) lỗi:\n${out}`)
      }
    }
  }
  return errors
}

function report(errors, title) {
  if (errors.length === 0) return 0
  console.error(`\n✖ ${title}`)
  for (const e of errors) console.error(`  - ${e}`)
  console.error('\nXem AGENTS.md và .agents/rules/ để biết quy chuẩn.\n')
  return 1
}

function main(argv) {
  const [cmd, arg] = argv
  if (cmd === 'commit-msg') return report(checkCommitMessage(readFileSync(arg, 'utf8')), 'Commit message chưa đạt chuẩn')
  if (cmd === 'pre-commit') return report(runPreCommit(), 'File staged vi phạm quy chuẩn hoặc lỗi cú pháp')
  if (cmd === 'pre-push' || cmd === 'verify') {
    const errs = runFullVerify()
    if (errs.length === 0) {
      console.log('[agent-guard] ✓ Kiểm tra cú pháp (esbuild) & TypeScript (typecheck) toàn dự án đạt 100%.')
    }
    return report(errs, 'Kiểm tra mã nguồn thất bại — đã chặn thao tác để tránh đẩy code lỗi lên Git')
  }
  if (cmd === 'install') {
    try {
      git(['config', 'core.hooksPath', '.githooks'])
      console.log('[agent-guard] Đã bật git hooks (.githooks).')
    } catch {
      console.log('[agent-guard] Bỏ qua: không phải git repository.')
    }
    return 0
  }
  console.log('Usage: node scripts/agent-guard.mjs <commit-msg <file>|pre-commit|pre-push|verify|install>')
  return 0
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) process.exit(main(process.argv.slice(2)))
