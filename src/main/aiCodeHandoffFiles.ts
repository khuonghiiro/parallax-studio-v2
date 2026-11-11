import { readFile, realpath, stat } from 'fs/promises'
import { resolve, relative, dirname, extname } from 'path'
import { createHash } from 'crypto'
import type { AiCodeFile } from '../shared/aiCodeHandoff'

export const hashSource = (text: string): string => createHash('sha256').update(text).digest('hex')
const SOURCE = /^src\/(renderer\/src|shared|main|preload)\/.+\.(tsx?|jsx?|mjs|css)$/

export async function safeSourcePath(root: string, path: string): Promise<string> {
  if (!SOURCE.test(path) || path.includes('..') || path.includes('\\') || path.includes(':')) {
    throw new Error(`Đường dẫn nguồn không hợp lệ: ${path}`)
  }
  const base = await realpath(root)
  const full = await realpath(resolve(base, path))
  const rel = relative(base, full).replace(/\\/g, '/')
  if (rel !== path || !SOURCE.test(rel)) throw new Error(`File nằm ngoài phạm vi: ${path}`)
  if ((await stat(full)).size > 2_000_000) throw new Error(`File quá lớn: ${path}`)
  return full
}

async function resolveDependency(root: string, owner: string, spec: string): Promise<string | null> {
  const base = spec.startsWith('.') ? resolve(root, dirname(owner), spec)
    : spec.startsWith('@renderer/') ? resolve(root, 'src/renderer/src', spec.slice(10))
      : spec.startsWith('@shared/') ? resolve(root, 'src/shared', spec.slice(8)) : null
  if (!base) return null
  for (const suffix of ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '/index.ts', '/index.tsx']) {
    const path = relative(root, base + suffix).replace(/\\/g, '/')
    if (!SOURCE.test(path)) continue
    try { await safeSourcePath(root, path); return path } catch { /* try next extension */ }
  }
  return null
}

export async function collectSourceFiles(root: string, seeds: string[]) {
  const queue = [...new Set(seeds)]
  const files: AiCodeFile[] = []
  const visited = new Set<string>()
  const warnings = new Set<string>()
  let bytes = 0
  while (queue.length) {
    const path = queue.shift()!
    if (visited.has(path)) continue
    visited.add(path)
    const full = await safeSourcePath(root, path)
    const content = await readFile(full, 'utf8')
    bytes += Buffer.byteLength(content)
    if (bytes > 12_000_000 || visited.size > 600) throw new Error('Gói quá lớn. Hãy quét vùng nhỏ hơn.')
    files.push({ path, content, hash: hashSource(content) })
    const pattern = extname(path) === '.css'
      ? /@import\s+(?:url\(\s*)?["']([^"']+)["']/g
      : /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["']([^"']+)["']/g
    for (const match of content.matchAll(pattern)) {
      const spec = match[1]
      const dependency = await resolveDependency(root, path, spec)
      if (dependency) queue.push(dependency)
      else if (spec.startsWith('.') || spec.startsWith('@shared/') || spec.startsWith('@renderer/')) {
        warnings.add(`${path}: tham chiếu không đóng gói (asset hoặc không phân giải được): ${spec}`)
      }
    }
    if (/import\s*\(|import\.meta\.glob/.test(content)) {
      warnings.add(`${path}: có import động/glob; cần kiểm tra thêm phụ thuộc runtime.`)
    }
  }
  return { files, warnings: [...warnings] }
}
