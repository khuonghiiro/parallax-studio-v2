import type { AiCodeFile } from '../shared/aiCodeHandoff'

export interface CodeReplyFile {
  path: string
  baseHash: string
  content?: string
  edits?: { id: string; content: string }[]
}
export interface Reply {
  version: 1 | 2
  bundleId: string
  files?: CodeReplyFile[]
  needMore?: {
    classes?: string[]
    files?: string[]
    reason?: string
  }
}

export function parseCodeReply(text: string): Reply {
  if (typeof text !== 'string' || text.length > 16_000_000) throw new Error('Bản sửa vượt giới hạn 16 MB.')
  const raw = text.trim().replace(/^```json\s*\n([\s\S]*)\n```$/, '$1')
  const reply = JSON.parse(raw) as Reply
  if (![1, 2].includes(reply?.version) || !/^[0-9a-f-]{36}$/.test(reply.bundleId)) {
    throw new Error('Định dạng gói sửa không hợp lệ.')
  }
  if (reply.needMore) {
    if (typeof reply.needMore !== 'object' || reply.needMore === null) {
      throw new Error('Trường needMore không hợp lệ.')
    }
    if (reply.needMore.classes !== undefined && (!Array.isArray(reply.needMore.classes) || reply.needMore.classes.some((c) => typeof c !== 'string'))) {
      throw new Error('needMore.classes phải là danh sách chuỗi.')
    }
    if (reply.needMore.files !== undefined && (!Array.isArray(reply.needMore.files) || reply.needMore.files.some((f) => typeof f !== 'string'))) {
      throw new Error('needMore.files phải là danh sách chuỗi.')
    }
    if (reply.needMore.reason !== undefined && typeof reply.needMore.reason !== 'string') {
      throw new Error('needMore.reason phải là chuỗi.')
    }
    if (!Array.isArray(reply.files) || reply.files.length === 0) {
      return reply
    }
  }
  if (!Array.isArray(reply.files) || !reply.files.length || reply.files.length > 600) {
    throw new Error('Định dạng gói sửa không hợp lệ.')
  }
  const paths = new Set<string>()
  for (const file of reply.files) {
    if (!file || typeof file.path !== 'string' || !/^[0-9a-f]{64}$/.test(file.baseHash) || paths.has(file.path)) {
      throw new Error('File sửa thiếu dữ liệu hoặc trùng đường dẫn.')
    }
    if (reply.version === 1 && typeof file.content !== 'string') throw new Error('Thiếu nội dung file.')
    if (reply.version === 2) {
      if (!Array.isArray(file.edits) || !file.edits.length || file.content !== undefined) throw new Error('Gói UI chỉ nhận edits theo đoạn.')
      const ids = new Set<string>()
      for (const edit of file.edits) {
        if (!edit || typeof edit.id !== 'string' || typeof edit.content !== 'string' || ids.has(edit.id)) {
          throw new Error('Đoạn sửa thiếu dữ liệu hoặc trùng ID.')
        }
        ids.add(edit.id)
      }
    }
    paths.add(file.path)
  }
  return reply
}

export function reconstructSource(original: AiCodeFile, file: CodeReplyFile, version: number): string {
  if (version === 1) {
    if (original.snippets) throw new Error('Không được thay toàn bộ file của gói UI theo đoạn.')
    return file.content!
  }
  const edits = file.edits!.map((edit) => {
    const snippet = original.snippets?.find((s) => s.id === edit.id)
    if (!snippet) throw new Error(`Đoạn không thuộc gói: ${edit.id}`)
    return { ...snippet, replacement: edit.content }
  }).sort((a, b) => b.start - a.start)
  let result = original.content
  let boundary = result.length
  for (const edit of edits) {
    if (edit.end > boundary) throw new Error('Các đoạn sửa chồng lấn.')
    result = result.slice(0, edit.start) + edit.replacement + result.slice(edit.end)
    boundary = edit.start
  }
  return result
}
