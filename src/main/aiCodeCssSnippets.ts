import type { AiCodeSnippet } from '../shared/aiCodeHandoff'
import { normalizeUiSelector } from '../shared/aiCodeSelectors'

/** Balanced CSS blocks; comments/quoted braces do not affect offsets. */
function blocks(text: string, start = 0, end = text.length) {
  const result: { start: number; open: number; end: number }[] = []
  let head = start, open = -1, depth = 0, quote = '', comment = false
  for (let i = start; i < end; i++) {
    const c = text[i], next = text[i + 1]
    if (comment) { if (c === '*' && next === '/') { comment = false; i++ }; continue }
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue }
    if (c === '/' && next === '*') { comment = true; i++; continue }
    if (c === '"' || c === "'") { quote = c; continue }
    if (c === '{') { if (depth++ === 0) open = i }
    if (c === '}' && --depth === 0 && open >= 0) {
      result.push({ start: head, open, end: i + 1 }); head = i + 1; open = -1
    }
    if (c === ';' && depth === 0) head = i + 1
  }
  return result
}

export function cssSnippets(text: string, classes: string[], selectors?: Set<string>): AiCodeSnippet[] {
  const found: AiCodeSnippet[] = []
  const matches = classes.map((name) => new RegExp(`\\.${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`))
  const walk = (start: number, end: number, context: string[]) => {
    for (const block of blocks(text, start, end)) {
      const head = text.slice(block.start, block.open).replace(/\/\*[\s\S]*?\*\//g, '').trim()
      if (/^@(media|supports|layer|container|scope)\b/.test(head)) {
        walk(block.open + 1, block.end - 1, [...context, head]); continue
      }
      const headNormalized = normalizeUiSelector(head)
      const headParts = head.split(',').map((p) => normalizeUiSelector(p)).filter(Boolean)
      const isMatched = selectors
        ? selectors.has(headNormalized) || headParts.some((p) => selectors.has(p))
        : matches.some((re) => re.test(head))
      if (!isMatched) continue
      const offset = block.start + (text.slice(block.start, block.open).match(/^\s*/)?.[0].length || 0)
      found.push({ id: '', start: offset, end: block.end, startLine: text.slice(0, offset).split('\n').length,
        content: text.slice(offset, block.end), context: context.join(' → ') })
    }
  }
  walk(0, text.length, [])
  return found
}
