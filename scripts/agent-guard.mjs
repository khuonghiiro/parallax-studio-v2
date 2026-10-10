#!/usr/bin/env node
/**
 * Agent guard – cưỡng chế quy chuẩn AGENTS.md bằng git hooks (áp dụng cho MỌI AI/người dùng).
 *
 *   node scripts/agent-guard.mjs commit-msg <file>   → kiểm tra commit message
 *   node scripts/agent-guard.mjs pre-commit          → kiểm tra file staged (≤ 1000 dòng, không secret)
 *   node scripts/agent-guard.mjs install             → bật hooks (git config core.hooksPath .githooks)
 *
 * Bỏ qua khẩn cấp: git commit --no-verify (không khuyến khích).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const MAX_FILE_LINES = 1000
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.py'])
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

/** Kiểm tra một file staged: giới hạn dòng và secret. */
export function checkStagedFile(path, content) {
  const errors = []
  if (SECRET_FILE.test(path)) errors.push(`${path}: file nhạy cảm (secret/key) không được commit.`)
  if (CODE_EXTS.has(extname(path).toLowerCase())) {
    const lines = content.split('\n').length - (content.endsWith('\n') ? 1 : 0)
    if (lines > MAX_FILE_LINES) {
      errors.push(`${path}: ${lines} dòng > ${MAX_FILE_LINES} (hard limit AGENTS.md §2.1) – hãy tách module.`)
    }
  }
  if (SECRET_TEXT.test(content)) errors.push(`${path}: phát hiện chuỗi giống private key / API token.`)
  return errors
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
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
  if (cmd === 'pre-commit') return report(runPreCommit(), 'File staged vi phạm quy chuẩn')
  if (cmd === 'install') {
    try {
      git(['config', 'core.hooksPath', '.githooks'])
      console.log('[agent-guard] Đã bật git hooks (.githooks).')
    } catch {
      console.log('[agent-guard] Bỏ qua: không phải git repository.')
    }
    return 0
  }
  console.log('Usage: node scripts/agent-guard.mjs <commit-msg <file>|pre-commit|install>')
  return 0
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) process.exit(main(process.argv.slice(2)))
