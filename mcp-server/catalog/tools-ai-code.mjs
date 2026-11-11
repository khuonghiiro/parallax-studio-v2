import { L, z } from './shared.mjs'

export const AI_CODE_TOOLS = [
  {
    name: 'export_ui_code', cat: 'inspect',
    doc: L('Export compact matching CSS rules and direct JSX/JS snippets with brief UI rules. No JS import traversal. Development repository only.',
      'Xuất gọn rule CSS khớp vùng quét và đoạn JSX/JS trực tiếp kèm quy tắc UI ngắn. Không lần theo import JS. Chỉ dùng trong repository phát triển.'),
    shape: (d) => ({
      left: z.number().describe(d('Left viewport coordinate in pixels.', 'Tọa độ trái trong viewport, pixel.')),
      top: z.number().describe(d('Top viewport coordinate in pixels.', 'Tọa độ trên trong viewport, pixel.')),
      width: z.number().positive().describe(d('Scan width in pixels.', 'Chiều rộng vùng quét, pixel.')),
      height: z.number().positive().describe(d('Scan height in pixels.', 'Chiều cao vùng quét, pixel.')),
      show: z.boolean().optional().describe(d('Open the handoff dialog after export.', 'Mở hộp thoại bàn giao sau khi xuất.'))
    }),
    example: '{"left":0,"top":0,"width":320,"height":150}'
  },
  {
    name: 'import_ui_code', cat: 'inspect',
    doc: L('Validate an AI code reply; apply=true writes source files with backups. Requires the saved export and unchanged originals. Not editor Undo; restore backup files to undo. Development only.',
      'Kiểm tra bản sửa code AI; apply=true ghi mã nguồn có sao lưu. Cần gói xuất đã lưu và file gốc chưa đổi. Không dùng Undo của editor; khôi phục file sao lưu để hoàn tác. Chỉ bản phát triển.'),
    shape: (d) => ({
      reply: z.string().describe(d('JSON reply containing version, bundleId and files (path, baseHash, edits with snippet id and content).', 'JSON bản sửa gồm version, bundleId và files (path, baseHash, edits gồm id đoạn và content).')),
      apply: z.boolean().optional().describe(d('Write after validation; default false previews only.', 'Ghi sau kiểm tra; mặc định false chỉ xem trước.'))
    }),
    example: '{"reply":"PASTE_AI_REPLY_JSON","apply":false}'
  }
]
