import { readFile } from 'fs/promises'
import { dirname, relative, resolve } from 'path'
import type { AiCodeFile, AiCodeSnippet, AiCodeTarget } from '../shared/aiCodeHandoff'
import { hashSource, safeSourcePath } from './aiCodeHandoffFiles'
import { cssSnippets } from './aiCodeCssSnippets'

export function jsSnippets(content: string, targets: AiCodeTarget[]): AiCodeSnippet[] {
  const lines = content.split('\n')
  const ranges = targets.filter((t) => t.line <= lines.length)
    .map((t) => ({ start: Math.max(0, t.line - 22), end: Math.min(lines.length, t.line + 21) }))
    .sort((a, b) => a.start - b.start)
  const merged: typeof ranges = []
  for (const range of ranges) {
    const last = merged.at(-1)
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end)
    else merged.push({ ...range })
  }
  return merged.map((r) => {
    const start = r.start ? lines.slice(0, r.start).join('\n').length + 1 : 0
    const end = r.end >= lines.length ? content.length : lines.slice(0, r.end).join('\n').length + 1
    return { id: '', start, end, startLine: r.start + 1, content: content.slice(start, end) }
  })
}

/** Follow CSS @imports only to locate matching rules; never follow JS imports. */
async function cssFiles(root: string, seeds: string[], warnings: string[]) {
  const result = new Map<string, string>()
  const queue = [...seeds]
  while (queue.length) {
    const path = queue.shift()!
    if (result.has(path)) continue
    if (result.size >= 400) { warnings.push('Đã dừng tìm CSS sau 400 stylesheet.'); break }
    const content = await readFile(await safeSourcePath(root, path), 'utf8')
    result.set(path, content)
    for (const match of content.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/g)) {
      if (!match[1].endsWith('.css') || match[1].startsWith('@') || match[1].includes('://')) continue
      const child = relative(root, resolve(root, dirname(path), match[1])).replace(/\\/g, '/')
      try { await safeSourcePath(root, child); queue.push(child) }
      catch { warnings.push(`CSS chưa đọc được: ${child}`) }
    }
  }
  return result
}

export async function collectCompactSources(root: string, targets: AiCodeTarget[]) {
  const warnings: string[] = []
  const files: AiCodeFile[] = []
  let remaining = 200000, serial = 0, omitted = 0
  const include = (path: string, content: string, candidates: AiCodeSnippet[]) => {
    const snippets = candidates.filter((s) => {
      // Reserve room for direct JSX/JS when collecting CSS first.
      const limit = path.endsWith('.css') ? Math.max(0, remaining - 60000) : remaining
      const maxFiles = path.endsWith('.css') ? 70 : 100
      if (s.content.length > limit || files.length >= maxFiles) { omitted++; return false }
      remaining -= s.content.length; s.id = `s${++serial}`; return true
    })
    if (snippets.length) files.push({ path, content, hash: hashSource(content), snippets })
  }
  const paths = [...new Set(targets.map((t) => t.path))]
  const classes = [...new Set(targets.flatMap((t) => t.classes || []))]
  const cssTargets = targets.filter((t) => t.path.endsWith('.css'))
  const selectors = cssTargets.length && cssTargets.every((t) => Array.isArray(t.selectors))
    ? new Set(cssTargets.flatMap((t) => t.selectors!)) : undefined
  if (!selectors && cssTargets.length) warnings.push('Không đọc được selector từ DOM; CSS được lọc theo class, có thể cần kiểm tra lại ngữ cảnh tổ tiên.')
  const css = await cssFiles(root, paths.filter((p) => p.endsWith('.css')), warnings)
  const score = (snippet: AiCodeSnippet) => Math.max(0, ...classes
    .filter((name) => snippet.content.includes(`.${name}`)).map((name) => name.length))
  const candidates = [...css].map(([path, content]) => ({ path, content,
    snippets: cssSnippets(content, classes, selectors).sort((a, b) => score(b) - score(a)) }))
    .sort((a, b) => (b.snippets[0] ? score(b.snippets[0]) : 0) - (a.snippets[0] ? score(a.snippets[0]) : 0))
  for (const candidate of candidates) include(candidate.path, candidate.content, candidate.snippets)
  if (!files.length) warnings.push('Không tìm được rule CSS khớp class; style có thể là inline hoặc selector khác.')
  for (const path of paths.filter((p) => !p.endsWith('.css'))) {
    const content = await readFile(await safeSourcePath(root, path), 'utf8')
    include(path, content, jsSnippets(content, targets.filter((t) => t.path === path)))
  }
  if (omitted) warnings.push(`${omitted} đoạn chưa đưa vào do giới hạn 200.000 ký tự nguồn / 100 file. Quét vùng nhỏ hơn để lấy đoạn đó.`)
  if (!files.length) throw new Error('Không có đoạn UI phù hợp trong giới hạn. Hãy quét một control nhỏ hơn.')
  return { files, warnings }
}
