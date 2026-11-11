import { mkdir, readFile, writeFile, rename, unlink } from 'fs/promises'
import { join, dirname } from 'path'
import { randomUUID } from 'crypto'
import { transform } from 'esbuild'
import { collectSourceFiles, hashSource, safeSourcePath } from './aiCodeHandoffFiles'
import { handoffMarkdown } from './aiCodeHandoffMarkdown'
import type { AiCodeBundle, AiCodeFile, AiCodeImportResult } from '../shared/aiCodeHandoff'

interface Reply { version: 1; bundleId: string; files: { path: string; baseHash: string; content: string }[] }

export function parseCodeReply(text: string): Reply {
  if (typeof text !== 'string' || text.length > 16_000_000) throw new Error('Bản sửa vượt giới hạn 16 MB.')
  const raw = text.trim().replace(/^```json\s*\n([\s\S]*)\n```$/, '$1')
  const reply = JSON.parse(raw) as Reply
  if (reply?.version !== 1 || !/^[0-9a-f-]{36}$/.test(reply.bundleId) || !Array.isArray(reply.files)
    || !reply.files.length || reply.files.length > 600) throw new Error('Định dạng gói sửa không hợp lệ.')
  const paths = new Set<string>()
  for (const file of reply.files) {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string'
      || !/^[0-9a-f]{64}$/.test(file.baseHash) || paths.has(file.path)) {
      throw new Error('File sửa thiếu dữ liệu hoặc trùng đường dẫn.')
    }
    paths.add(file.path)
  }
  return reply
}

export class AiCodeHandoffService {
  private busy = false
  constructor(private root: string, private storage: string) {}

  async export(paths: string[], report: string): Promise<AiCodeBundle> {
    if (!Array.isArray(paths) || !paths.length || paths.length > 150 || paths.some((p) => typeof p !== 'string')) {
      throw new Error('Không có file nguồn hợp lệ. Hãy dùng pnpm dev và quét vùng nhỏ hơn.')
    }
    if (typeof report !== 'string' || report.length > 2_000_000) throw new Error('Báo cáo quá lớn.')
    const { files, warnings } = await collectSourceFiles(this.root, paths)
    const id = randomUUID()
    const markdown = await handoffMarkdown(this.root, id, files, report, warnings)
    await mkdir(this.storage, { recursive: true })
    await writeFile(join(this.storage, `${id}.json`), JSON.stringify({ root: this.root, files }), { flag: 'wx' })
    return { version: 1, id, files, markdown, warnings }
  }

  async import(text: string, apply: boolean): Promise<AiCodeImportResult> {
    if (this.busy) throw new Error('Đang áp dụng một gói khác.')
    this.busy = true
    try { return await this.importUnlocked(text, apply) } finally { this.busy = false }
  }

  private async importUnlocked(text: string, apply: boolean): Promise<AiCodeImportResult> {
    const reply = parseCodeReply(text)
    const saved = JSON.parse(await readFile(join(this.storage, `${reply.bundleId}.json`), 'utf8')) as {
      root: string; files: AiCodeFile[]
    }
    if (saved.root !== this.root) throw new Error('Gói thuộc repository khác.')
    const changes: { path: string; full: string; before: string; after: string }[] = []
    for (const file of reply.files) {
      const original = saved.files.find((f) => f.path === file.path)
      if (!original || original.hash !== file.baseHash) throw new Error(`File không thuộc gói gốc: ${file.path}`)
      const full = await safeSourcePath(this.root, file.path)
      const before = await readFile(full, 'utf8')
      if (hashSource(before) !== original.hash) throw new Error(`File đã thay đổi sau khi xuất: ${file.path}. Hãy quét lại.`)
      if (file.content.split('\n').length > 1000) throw new Error(`File vượt 1000 dòng: ${file.path}`)
      const extension = file.path.split('.').pop()!
      const loader = extension === 'mjs' ? 'js' : extension as 'ts' | 'tsx' | 'js' | 'jsx' | 'css'
      await transform(file.content, { loader, sourcefile: file.path, logLevel: 'silent' })
      if (before !== file.content) changes.push({ path: file.path, full, before, after: file.content })
    }
    if (!changes.length) throw new Error('Không có nội dung thay đổi.')
    if (!apply) return { files: changes.map((f) => f.path), backupPath: '', applied: false }
    const backupPath = join(this.storage, `backup-${reply.bundleId}-${randomUUID()}`)
    await this.writeChanges(changes, backupPath)
    return { files: changes.map((f) => f.path), backupPath, applied: true }
  }

  private async writeChanges(changes: { path: string; full: string; before: string; after: string }[], backup: string) {
    // Back up the entire batch before touching any source file.
    for (const file of changes) {
      const dest = join(backup, file.path)
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, file.before, 'utf8')
    }
    const written: typeof changes = []
    try {
      for (const file of changes) {
        await safeSourcePath(this.root, file.path)
        if (await readFile(file.full, 'utf8') !== file.before) throw new Error(`File vừa thay đổi: ${file.path}`)
        const temp = `${file.full}.${randomUUID()}.tmp`
        try {
          await writeFile(temp, file.after, { flag: 'wx' })
          await rename(temp, file.full)
          written.push(file)
        } finally { await unlink(temp).catch(() => undefined) }
      }
    } catch (error) {
      const failures: string[] = []
      for (const file of written.reverse()) {
        try {
          if (await readFile(file.full, 'utf8') !== file.after) throw new Error('Có thay đổi đồng thời')
          await writeFile(file.full, file.before, 'utf8')
        } catch { failures.push(file.path) }
      }
      throw new Error(`${String(error)}. Bản sao: ${backup}${failures.length ? `. Khôi phục thủ công: ${failures.join(', ')}` : '. Đã hoàn tác các file đã ghi.'}`)
    }
  }
}
