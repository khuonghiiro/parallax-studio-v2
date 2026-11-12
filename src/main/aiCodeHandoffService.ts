import { mkdir, readFile, writeFile, rename, unlink } from 'fs/promises'
import { join, dirname } from 'path'
import { randomUUID } from 'crypto'
import { transform } from 'esbuild'
import { hashSource, safeSourcePath, safeNewSourcePath } from './aiCodeHandoffFiles'
import { handoffMarkdown } from './aiCodeHandoffMarkdown'
import type { AiCodeBundle, AiCodeFile, AiCodeImportResult, AiCodeTarget } from '../shared/aiCodeHandoff'

import { collectCompactSources } from './aiCodeCompactCollector'
import { parseCodeReply, reconstructSource } from './aiCodeHandoffReply'
import { splitOversizedCss } from './aiCodeCssSplitter'
export { parseCodeReply } from './aiCodeHandoffReply'

export class AiCodeHandoffService {
  private busy = false
  constructor(private root: string, private storage: string) {}

  async export(paths: AiCodeTarget[], report: string): Promise<AiCodeBundle> {
    if (!Array.isArray(paths) || !paths.length || paths.length > 150 || paths.some((p) => !p || typeof p.path !== 'string' || !p.path.startsWith('src/renderer/src/') || !Number.isInteger(p.line) || p.line < 1
      || (p.classes !== undefined && (!Array.isArray(p.classes) || p.classes.length > 200 || p.classes.some((c) => typeof c !== 'string' || c.length > 150))))) {
      throw new Error('Không có file nguồn hợp lệ. Hãy dùng pnpm dev và quét vùng nhỏ hơn.')
    }
    if (typeof report !== 'string' || report.length > 2_000_000) throw new Error('Báo cáo quá lớn.')
    if (paths.some((p) => p.selectors !== undefined && (!Array.isArray(p.selectors)
      || p.selectors.length > 2000 || p.selectors.some((s) => typeof s !== 'string' || s.length > 4000)))) {
      throw new Error('Danh sách selector không hợp lệ hoặc quá lớn.')
    }
    const { files, warnings } = await collectCompactSources(this.root, paths)
    const id = randomUUID()
    const markdown = await handoffMarkdown(id, files, report, warnings)
    if (markdown.length > 300000) throw new Error('Gói UI vượt 300.000 ký tự. Hãy quét vùng nhỏ hơn.')
    await mkdir(this.storage, { recursive: true })
    await writeFile(join(this.storage, `${id}.json`), JSON.stringify({ root: this.root, files }), { flag: 'wx' })
    return { version: 2, id, files: files.map(({ content: _content, ...file }) => file), markdown, warnings }
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
      const after = reconstructSource(original, file, reply.version)
      const lineCount = after.split('\n').length
      const extension = file.path.split('.').pop()!
      const isCss = extension === 'css'
      if (lineCount > 1000 && !isCss) throw new Error(`File vượt 1000 dòng: ${file.path}`)
      const loader = extension === 'mjs' ? 'js' : extension as 'ts' | 'tsx' | 'js' | 'jsx' | 'css'
      // Tự động tách CSS vượt 1000 dòng thành file gốc + file(s) phụ
      if (lineCount > 1000 && isCss) {
        const splitResult = splitOversizedCss(file.path, after)
        if (!splitResult) throw new Error(`File vượt 1000 dòng: ${file.path}`)
        await transform(splitResult.main, { loader: 'css', sourcefile: file.path, logLevel: 'silent' })
        if (before !== splitResult.main) changes.push({ path: file.path, full, before, after: splitResult.main })
        for (const part of splitResult.parts) {
          const partFull = await safeNewSourcePath(this.root, part.path)
          await transform(part.content, { loader: 'css', sourcefile: part.path, logLevel: 'silent' })
          // File phụ mới — đọc before nếu đã tồn tại, hoặc '' nếu chưa
          let partBefore = ''
          try { partBefore = await readFile(partFull, 'utf8') } catch { /* file mới */ }
          if (partBefore !== part.content) {
            changes.push({ path: part.path, full: partFull, before: partBefore, after: part.content })
          }
        }
      } else {
        await transform(after, { loader, sourcefile: file.path, logLevel: 'silent' })
        if (before !== after) changes.push({ path: file.path, full, before, after })
      }
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
      if (file.before) {
        const dest = join(backup, file.path)
        await mkdir(dirname(dest), { recursive: true })
        await writeFile(dest, file.before, 'utf8')
      }
    }
    const written: typeof changes = []
    try {
      for (const file of changes) {
        const isNewFile = file.before === ''
        if (!isNewFile) {
          await safeSourcePath(this.root, file.path)
          if (await readFile(file.full, 'utf8') !== file.before) throw new Error(`File vừa thay đổi: ${file.path}`)
        } else {
          // File phụ mới — kiểm tra đường dẫn an toàn và tạo thư mục cha nếu cần
          await safeNewSourcePath(this.root, file.path)
          await mkdir(dirname(file.full), { recursive: true })
        }
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
          if (file.before === '') {
            // File phụ mới — xóa khi rollback
            await unlink(file.full)
          } else {
            await writeFile(file.full, file.before, 'utf8')
          }
        } catch { failures.push(file.path) }
      }
      throw new Error(`${String(error)}. Bản sao: ${backup}${failures.length ? `. Khôi phục thủ công: ${failures.join(', ')}` : '. Đã hoàn tác các file đã ghi.'}`)
    }
  }
}
