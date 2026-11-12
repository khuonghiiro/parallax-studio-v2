import { useState } from 'react'
import '../../styles/aiCodeHandoff.css'

export interface AiCodePreviewState {
  backupPath: string
  files: string[]
}

/**
 * Thanh điều khiển Live Preview nổi — hiển thị khi đã áp dụng thử bản sửa UI.
 * Cho phép người dùng duyệt toàn bộ app để kiểm tra giao diện,
 * rồi quyết định Giữ lại hoặc Hoàn tác 100% về bản gốc.
 */
export function AiCodePreviewBar({ preview, onAccept, onRevert }: {
  preview: AiCodePreviewState
  onAccept: () => void
  onRevert: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const handleRevert = async () => {
    setBusy(true)
    setStatus('Đang hoàn tác…')
    try {
      if (!window.api?.aiCode) throw new Error('Cần khởi động lại app.')
      const result = await window.api.aiCode.revert(preview.backupPath)
      setStatus(`Đã hoàn tác ${result.files.length} file về bản gốc.`)
      setTimeout(onRevert, 800)
    } catch (error) {
      setStatus(`Lỗi hoàn tác: ${String(error)}`)
      setBusy(false)
    }
  }

  return (
    <div
      className="ai-code-preview-bar"
      data-mcp-region="ai_code_preview_bar"
      role="status"
      aria-live="polite"
      data-ai-surface="dialog"
      data-ai-surface-label="Thanh điều khiển xem thử bản sửa UI"
    >
      <div className="ai-code-preview-bar-icon">👁️</div>
      <div className="ai-code-preview-bar-info">
        <strong>Đang xem thử bản sửa UI</strong>
        <span className="ai-code-preview-bar-files">
          {status || `${preview.files.length} file đã thay đổi · Vite HMR đã cập nhật giao diện`}
        </span>
      </div>
      <button
        type="button"
        className="btn ghost ai-code-preview-bar-btn revert"
        disabled={busy}
        onClick={() => void handleRevert()}
        title="Hoàn tác tất cả thay đổi về bản gốc trước khi áp dụng thử (Esc)"
        aria-label="Hoàn tác về bản gốc"
      >
        ↩ Hoàn tác
      </button>
      <button
        type="button"
        className="btn primary ai-code-preview-bar-btn accept"
        disabled={busy}
        onClick={onAccept}
        title="Giữ lại bản sửa UI này, không hoàn tác nữa"
        aria-label="Giữ bản sửa này"
      >
        ✅ Giữ bản sửa
      </button>
    </div>
  )
}

