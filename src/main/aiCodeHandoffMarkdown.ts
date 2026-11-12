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
    'CSS khớp class của phần tử đích và chuỗi tổ tiên, gồm rule hover/active và điều kiện theme/media. JSX/JS lấy khoảng 21 dòng quanh vị trí render/call-site. Không lần theo import JS, store, engine hoặc module khác. Đoạn có thể cắt giữa hàm/JSX; chỉ sửa trong phạm vi đã gửi. Nếu thiếu ngữ cảnh hãy yêu cầu thêm qua needMore.',
    report.slice(0, 2000),
    '## Quy tắc sửa UI — đã nhúng trong gói',
    'Các quy tắc UI liên quan đã được trích từ AGENTS.md và skill ai-ui-inspector/mcp-ui-region ngay bên dưới. AI chỉ cần Markdown này, không cần mở các file đó. Đây không phải toàn bộ quy chuẩn dự án. Nếu thiếu mã hoặc hướng dẫn để sửa an toàn, yêu cầu bổ sung qua needMore; không đoán phần chưa được gửi.',
    '- Dùng token --bg-0…4, --text/--text-dim, --line, --accent; chữ trên accent dùng --on-accent, trên --key dùng --on-key. Giữ tương phản Dark/Light và hover/active.',
    '- TUYỆT ĐỐI CẤM sửa bằng inline style (style={{...}}) trong JSX để lách việc thiếu CSS. Mọi style phải khai báo trong file CSS qua class/selector chuẩn.',
    '- Kích thước & Typography an toàn: CẤM gán font-size >20px cho controls/cards/inputs (chuẩn: badges 10–11px, labels/subtext 11–12px, buttons/inputs/controls 12–14px, headers 14–18px). CẤM gán width/height fixed lớn (như width: 800px hoặc 100vw). Dùng %, auto, minmax(320px, 1fr), clamp().',
    '- Giữ layout responsive 4 breakpoints: phone ≤768 (1 cột), tablet ≤1120 (2 cột), laptop ≤1366, desktop >1366 (3–4 cột max-width 1600px). Triệt tiêu "sa mạc trống trải" bằng lưới Card co giãn, cấm kéo dài 1 dòng trên desktop rộng. Vùng bấm ≥36px (nút chính 40–44px), khoảng cách gap ≥6–8px; không cắt chữ/chồng nút.',
    '- Mục tiêu chính xác: Ưu tiên phần tử được đánh dấu [FOCUS] (đang nhận focus) hoặc [ACTIVE] (tab/nút/layer đang kích hoạt) để sửa đúng đối tượng người dùng đang tương tác.',
    '- Danh sách mục tiêu ở trên: vị trí file:dòng trỏ vào dòng mở thẻ JSX (<tag...>) hoặc nơi gọi component. Chuỗi [runtime: ...] được trích xuất từ runtime V8 nhằm nhận biết hành động; hãy đối chiếu với đoạn mã nguồn thực tế trong các khối mã bên dưới thay vì tìm kiếm cứng chuỗi runtime.',
    '- Giữ data-mcp-region, role, aria-label, data-ai-surface và ID nghiệp vụ. Không tự thêm data-ai-src. Không đổi logic nghiệp vụ không liên quan. Không thêm bề mặt UI mới cần registry ngoài gói.',
    '- Sau nhập cần pnpm verify, test liên quan và xem UI Dark/Light. Import có sao lưu và kiểm tra cú pháp file ghép lại; không thay thế kiểm thử. Không chạy lệnh shell hoặc commit trong câu trả lời.',
    '## Trả bản sửa (JSON duy nhất)',
    '### Trường hợp 1: Đủ ngữ cảnh — Trả bản sửa theo đoạn\nChỉ gửi file/đoạn đã sửa; giữ bundleId, path, baseHash, id. content là TOÀN BỘ đoạn thay thế, không có số dòng hoặc dấu …; giữ xuống dòng đầu/cuối. KHÔNG trả toàn bộ file. Các phần ngoài đoạn được giữ nguyên. Điều kiện CSS ở mục Ngữ cảnh nằm ngoài đoạn và được giữ nguyên, không bọc thêm vào content.',
    fenced(JSON.stringify({ version: 2, bundleId: id, files: [{ path: first.path, baseHash: first.hash,
      edits: [{ id: first.snippets![0].id, content: '<đoạn đã sửa>' }] }] }, null, 2), 'json'),
    '### Trường hợp 2: THIẾU rule CSS hoặc ngữ cảnh — Trả needMore (KHÔNG sửa inline style)\nNếu thiếu rule CSS của class đích hoặc cần thêm class/file để sửa an toàn, TUYỆT ĐỐI KHÔNG sửa inline style trong JSX. Hãy trả JSON với "needMore" để ứng dụng nạp bổ sung:',
    fenced(JSON.stringify({ version: 2, bundleId: id, needMore: {
      classes: ['.route-waypoints-stack', '.route-wp-card'],
      files: ['src/renderer/src/styles/cameraRouteInspector.css'],
      reason: 'Cần thêm rule CSS cho các class vùng chứa để điều chỉnh layout thay vì inline style'
    } }, null, 2), 'json'),
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
