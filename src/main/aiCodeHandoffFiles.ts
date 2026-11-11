import { readFile, realpath, stat } from 'fs/promises'
import { resolve, relative } from 'path'
import { createHash } from 'crypto'

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
