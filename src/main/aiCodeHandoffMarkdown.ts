import type { AiCodeFile } from '../shared/aiCodeHandoff'

function fenced(content: string, language = ''): string {
  const runs = content.match(/`+/g) || []
  const fence = '`'.repeat(Math.max(3, ...runs.map((s) => s.length + 1)))
  return `${fence}${language}\n${content}\n${fence}`
}

export function handoffMarkdown(id: string, files: AiCodeFile[], report: string, warnings: string[]) {
  const first = files[0]
  const sections = [
    '# Gói sửa UI gọn — CSS + JSX/JS trực tiếp',
    `Mã gói: ${id}. Đây là các ĐOẠN mã, không phải toàn bộ file.`,
    'CSS khớp class của vùng quét, gồm rule hover/active và điều kiện theme/media khi tìm được. JSX/JS lấy khoảng 21 dòng quanh vị trí render/call-site. Không lần theo import JS, store, engine hoặc module khác. Đoạn có thể cắt giữa hàm/JSX; chỉ sửa trong phạm vi đã gửi. Nếu thiếu ngữ cảnh hãy yêu cầu quét thêm.',
    report.slice(0, 1500),
    '## Quy tắc sửa UI — đã nhúng trong gói',
    'Các quy tắc UI liên quan đã được trích từ AGENTS.md và skill ai-ui-inspector/mcp-ui-region ngay bên dưới. AI chỉ cần Markdown này, không cần mở các file đó. Đây không phải toàn bộ quy chuẩn dự án. Nếu thiếu mã hoặc hướng dẫn để sửa an toàn, yêu cầu bổ sung; không đoán phần chưa được gửi.',
    '- Dùng token --bg-0…4, --text/--text-dim, --line, --accent; chữ trên accent dùng --on-accent, trên --key dùng --on-key. Giữ tương phản Dark/Light và hover/active.',
    '- Giữ layout responsive: phone ≤768, tablet ≤1120, laptop ≤1366, desktop >1366. Vùng bấm ≥36px, khoảng cách ≥6px; không cắt chữ/chồng nút.',
    '- Giữ data-mcp-region, role, aria-label, data-ai-surface và ID nghiệp vụ. Không tự thêm data-ai-src. Không đổi logic nghiệp vụ không liên quan. Không thêm bề mặt UI mới cần registry ngoài gói.',
    '- Sau nhập cần pnpm verify, test liên quan và xem UI Dark/Light. Import có sao lưu và kiểm tra cú pháp file ghép lại; không thay thế kiểm thử. Không chạy lệnh shell hoặc commit trong câu trả lời.',
    '## Trả bản sửa',
    'Trả duy nhất JSON theo mẫu. Chỉ gửi file/đoạn đã sửa; giữ bundleId, path, baseHash, id. content là TOÀN BỘ đoạn thay thế, không có số dòng hoặc dấu …; giữ xuống dòng đầu/cuối. KHÔNG trả toàn bộ file. Các phần ngoài đoạn được giữ nguyên. Điều kiện CSS ở mục Ngữ cảnh nằm ngoài đoạn và được giữ nguyên, không bọc thêm vào content.',
    fenced(JSON.stringify({ version: 2, bundleId: id, files: [{ path: first.path, baseHash: first.hash,
      edits: [{ id: first.snippets![0].id, content: '<đoạn đã sửa>' }] }] }, null, 2), 'json'),
    '## Phạm vi còn thiếu', ...warnings.slice(0, 12)
  ]
  for (const file of files) {
    sections.push(`## ${file.path}\nbaseHash: ${file.hash}`)
    for (const snippet of file.snippets || []) {
      sections.push(`### Đoạn ${snippet.id} · dòng ${snippet.startLine}–${snippet.startLine + snippet.content.split('\n').length - 1}`,
        snippet.context ? `Ngữ cảnh (không nằm trong đoạn): ${snippet.context}` : '',
        fenced(snippet.content.split('\n').map((line, i) => `${snippet.startLine + i} | ${line}`).join('\n'), 'text'))
    }
  }
  return sections.join('\n\n')
}
