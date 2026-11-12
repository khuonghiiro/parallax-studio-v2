import { useEffect, useState } from 'react'
import type { AiCodeImportResult } from '@shared/aiCodeHandoff'
import type { AiCodePreviewState } from './AiCodePreviewBar'
import '../../styles/aiCodeHandoff.css'

export function AiCodeHandoffModal({ report, status, onClose, onCopy, onPreviewApply }: {
  report: string; status: string; onClose: () => void; onCopy: (text: string) => Promise<boolean>
  onPreviewApply?: (state: AiCodePreviewState) => void
}) {
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  const [checked, setChecked] = useState<AiCodeImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])
  const updateText = (value: string) => { setText(value); setChecked(null); setMessage('') }
  const run = async (apply: boolean) => {
    setBusy(true)
    try {
      if (!window.api?.aiCode) throw new Error('Cần khởi động lại app để nạp tính năng.')
      const result = await window.api.aiCode.import(text, apply)
      if (result.needMore) {
        setChecked(null)
        const req = result.needMore
        const details: string[] = []
        if (req.reason) details.push(`Lý do: "${req.reason}"`)
        if (req.classes?.length) details.push(`Classes: ${req.classes.join(', ')}`)
        if (req.files?.length) details.push(`Files: ${req.files.join(', ')}`)
        setMessage(`⚠️ AI yêu cầu thêm ngữ cảnh (chưa áp dụng): ${details.join(' · ')}`)
        return
      }
      setChecked(apply ? null : result)
      setMessage(apply ? `Đã áp dụng ${result.files.length} file. Bản gốc: ${result.backupPath}. Cần chạy verify, test và kiểm tra giao diện; main/preload cần khởi động lại.`
        : `Đã kiểm tra cú pháp và phiên bản gốc: ${result.files.length} file. Xem danh sách trước khi áp dụng.`)
    } catch (error) { setChecked(null); setMessage(String(error)) }
    finally { setBusy(false) }
  }
  const runPreview = async () => {
    setBusy(true)
    try {
      if (!window.api?.aiCode) throw new Error('Cần khởi động lại app để nạp tính năng.')
      const result = await window.api.aiCode.import(text, true)
      if (result.needMore) {
        const req = result.needMore
        const details: string[] = []
        if (req.reason) details.push(`Lý do: "${req.reason}"`)
        if (req.classes?.length) details.push(`Classes: ${req.classes.join(', ')}`)
        if (req.files?.length) details.push(`Files: ${req.files.join(', ')}`)
        setMessage(`⚠️ AI yêu cầu thêm ngữ cảnh: ${details.join(' · ')}`)
        return
      }
      if (result.applied && onPreviewApply) {
        onPreviewApply({ backupPath: result.backupPath, files: result.files })
      } else {
        setMessage(`Đã áp dụng ${result.files.length} file. Bản gốc: ${result.backupPath}.`)
      }
    } catch (error) { setMessage(String(error)) }
    finally { setBusy(false) }
  }
  return <div className="ai-ui-inspector-preview-backdrop">
    <section className="ai-code-handoff-modal" data-mcp-region="ai_code_handoff" data-mcp-dialog
      role="dialog" aria-modal="true" aria-label="Gói sửa UI gọn" data-ai-surface="dialog"
      data-ai-surface-label="Gói sửa UI gọn">
      <header><h2>〈/〉 Gói sửa UI · CSS/JSX/JS</h2><button className="btn ghost" disabled={busy} onClick={onClose}
        title="Đóng bàn giao mã nguồn" aria-label="Đóng bàn giao mã nguồn">✕</button></header>
      <p className="ai-code-handoff-guide">Markdown chứa mã, số dòng và quy tắc sửa UI. Dán cho AI trên web hoặc AI đang làm dự án; nhập JSON AI trả về để áp dụng.</p>
      <p role="status">{status || 'Sẵn sàng nhập bản sửa JSON (hoặc nhấn Win + Ctrl để quét xuất gói mã UI).'}</p>
      <div className="ai-code-handoff-actions">
        <button className="btn ghost" disabled={!report || busy} onClick={() => {
          void onCopy(report).then((ok) => setMessage(ok ? 'Đã sao chép gói Markdown.' : 'Không thể sao chép. Hãy lưu gói Markdown.'))
        }}>Sao chép CSS + JSX/JS</button>
        <button className="btn ghost" disabled={!report || busy} onClick={() => {
          const url = URL.createObjectURL(new Blob([report], { type: 'text/markdown;charset=utf-8' }))
          const a = document.createElement('a'); a.href = url; a.download = 'ai-ui-code-handoff.md'; a.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        }}>Lưu Markdown</button>
      </div>
      {report && <details onToggle={(e) => setPreview(e.currentTarget.open)}><summary>Xem gói gửi AI ({report.length.toLocaleString()} ký tự · ~{Math.ceil(report.length / 3).toLocaleString()} token, ước lượng)</summary>{preview && <pre>{report}</pre>}</details>}
      <label htmlFor="ai-code-reply">Dán JSON bản sửa AI trả về hoặc chọn file JSON</label>
      <input type="file" accept=".json,.md,.txt" disabled={busy} aria-label="Chọn file bản sửa AI" onChange={(e) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 16_000_000) { setMessage('File vượt giới hạn 16 MB.'); return }
        void file.text().then(updateText).catch((error) => setMessage(String(error)))
      }} />
      <textarea id="ai-code-reply" value={text} disabled={busy} onChange={(e) => updateText(e.target.value)}
        placeholder="JSON version 2, bundleId, files và edits theo ID đoạn…" spellCheck={false} />
      {checked && <ul>{checked.files.map((file) => <li key={file}>{file}</li>)}</ul>}
      <p role="status" aria-live="polite">{message}</p>
      <footer>
        <button className="btn ghost" disabled={busy || !text.trim()} onClick={() => void run(false)}>Kiểm tra bản sửa</button>
        <button className="btn ghost ai-code-preview-trigger" disabled={busy || !checked}
          onClick={() => void runPreview()}
          title="Áp dụng bản sửa để xem thử trực tiếp trên giao diện (Vite HMR). Có thể Hoàn tác 100% nếu không ưng ý."
        >👁️ Áp dụng thử</button>
        <button className="btn primary" disabled={busy || !checked} onClick={() => void run(true)}>Áp dụng bản sửa</button>
      </footer>
    </section>
  </div>
}
