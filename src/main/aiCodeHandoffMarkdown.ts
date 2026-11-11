import { readFile } from 'fs/promises'
import { join } from 'path'
import type { AiCodeFile } from '../shared/aiCodeHandoff'

function fenced(content: string, language = ''): string {
  const runs = content.match(/`+/g) || []
  const fence = '`'.repeat(Math.max(3, ...runs.map((s) => s.length + 1)))
  return `${fence}${language}\n${content}\n${fence}`
}

export async function handoffMarkdown(root: string, id: string, files: AiCodeFile[], report: string, warnings: string[]) {
  const sections = [
    '# Gói bàn giao AI UI — mã nguồn và quy tắc',
    `Mã gói: ${id}. Các file bên dưới là toàn bộ nội dung; số dòng bắt đầu từ 1.`,
    'Phạm vi: các file được định vị trong vùng quét và chuỗi import nội bộ tĩnh. Không khẳng định bao phủ phụ thuộc runtime, IPC hay mã tạo động. Không có thư viện node_modules.',
    report,
    '## Hướng dẫn trả bản sửa',
    'Đọc quy tắc bên dưới. Chỉ sửa theo yêu cầu người dùng. Trả một khối JSON duy nhất theo mẫu, chỉ liệt kê file thay đổi. content là TOÀN BỘ nội dung file đã sửa, không thêm số dòng hoặc dấu …; giữ nguyên path, baseHash và bundleId. Không trả lệnh shell. Không sửa file ngoài gói. Không tự áp dụng quy tắc Git trên máy không có repository.',
    fenced(JSON.stringify({ version: 1, bundleId: id, files: [{ path: files[0]?.path, baseHash: files[0]?.hash, content: '<toàn bộ nội dung file đã sửa>' }] }, null, 2), 'json'),
    'Import kiểm tra phiên bản gốc, cú pháp và lưu bản sao. Cần chạy pnpm verify, unit test liên quan và QA giao diện cả hai theme trước commit. Sửa main/preload cần người dùng khởi động lại app.',
    '## Giới hạn và tham chiếu chưa đóng gói',
    ...(warnings.length ? warnings : ['Không phát hiện tham chiếu nội bộ bị thiếu bằng bộ phân tích import tĩnh.'])
  ]
  const rules = ['AGENTS.md', '.agents/skills/ai-ui-inspector/SKILL.md', '.agents/skills/mcp-ui-region/SKILL.md', '.agents/rules/responsive-standard.md']
  for (const path of rules) {
    sections.push(`## Quy tắc: ${path}`, fenced(await readFile(join(root, path), 'utf8'), 'markdown'))
  }
  for (const file of files) {
    sections.push(`## File: ${file.path}\nSHA-256: ${file.hash}\nDòng 1–${file.content.split('\n').length}`,
      fenced(file.content.split('\n').map((line, index) => `${index + 1} | ${line}`).join('\n'), 'text'))
  }
  return sections.join('\n\n')
}
