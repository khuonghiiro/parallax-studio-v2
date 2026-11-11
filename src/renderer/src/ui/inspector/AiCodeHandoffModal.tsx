import { useEffect, useState } from 'react'
import type { AiCodeImportResult } from '@shared/aiCodeHandoff'
import '../../styles/aiCodeHandoff.css'

export function AiCodeHandoffModal({ report, status, onClose, onCopy }: {
  report: string; status: string; onClose: () => void; onCopy: (text: string) => Promise<boolean>
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
      setChecked(apply ? null : result)
      setMessage(apply ? `Đã áp dụng ${result.files.length} file. Bản gốc: ${result.backupPath}. Cần chạy verify, test và kiểm tra giao diện; main/preload cần khởi động lại.`
        : `Đã kiểm tra cú pháp và phiên bản gốc: ${result.files.length} file. Xem danh sách trước khi áp dụng.`)
    } catch (error) { setChecked(null); setMessage(String(error)) }
    finally { setBusy(false) }
  }
  return <div className="ai-ui-inspector-preview-backdrop">
    <section className="ai-code-handoff-modal" data-mcp-region="ai_code_handoff" data-mcp-dialog
      role="dialog" aria-modal="true" aria-label="Bàn giao mã nguồn AI" data-ai-surface="dialog"
      data-ai-surface-label="Bàn giao mã nguồn AI">
      <header><h2>Bàn giao mã nguồn AI</h2><button className="btn ghost" disabled={busy} onClick={onClose}
        title="Đóng bàn giao mã nguồn" aria-label="Đóng bàn giao mã nguồn">✕</button></header>
      <p role="status">{status}</p>
      <div className="ai-code-handoff-actions">
        <button className="btn ghost" disabled={!report || busy} onClick={() => {
          void onCopy(report).then((ok) => setMessage(ok ? 'Đã sao chép gói Markdown.' : 'Không thể sao chép. Hãy lưu gói Markdown.'))
        }}>Sao chép code + quy tắc</button>
        <button className="btn ghost" disabled={!report || busy} onClick={() => {
          const url = URL.createObjectURL(new Blob([report], { type: 'text/markdown;charset=utf-8' }))
          const a = document.createElement('a'); a.href = url; a.download = 'ai-ui-code-handoff.md'; a.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        }}>Lưu Markdown</button>
      </div>
      {report && <details onToggle={(e) => setPreview(e.currentTarget.open)}><summary>Xem gói gửi AI ({report.length.toLocaleString()} ký tự)</summary>{preview && <pre>{report}</pre>}</details>}
      <label htmlFor="ai-code-reply">Dán JSON bản sửa AI trả về hoặc chọn file JSON</label>
      <input type="file" accept=".json,.md,.txt" disabled={busy} aria-label="Chọn file bản sửa AI" onChange={(e) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 16_000_000) { setMessage('File vượt giới hạn 16 MB.'); return }
        void file.text().then(updateText).catch((error) => setMessage(String(error)))
      }} />
      <textarea id="ai-code-reply" value={text} disabled={busy} onChange={(e) => updateText(e.target.value)}
        placeholder="JSON có version, bundleId và files…" spellCheck={false} />
      {checked && <ul>{checked.files.map((file) => <li key={file}>{file}</li>)}</ul>}
      <p role="status" aria-live="polite">{message}</p>
      <footer><button className="btn ghost" disabled={busy || !text.trim()} onClick={() => void run(false)}>Kiểm tra bản sửa</button>
        <button className="btn primary" disabled={busy || !checked} onClick={() => void run(true)}>Áp dụng bản sửa</button></footer>
    </section>
  </div>
}
