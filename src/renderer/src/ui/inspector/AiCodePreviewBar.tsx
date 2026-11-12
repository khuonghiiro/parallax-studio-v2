import { useEffect, useState } from 'react'
import type { AiCodePreviewMode } from '@shared/aiCodeHandoff'
import '../../styles/aiCodeHandoff.css'

export interface AiCodePreviewState {
  backupPath: string
  files: string[]
}

/**
 * Thanh điều khiển Live Preview nổi — hiển thị khi đã áp dụng thử bản sửa UI.
 * Cho phép người dùng chuyển đổi qua lại giữa giao diện "Trước (gốc)" và "Sau (mới sửa)",
 * duyệt toàn bộ app để kiểm tra, rồi quyết định Giữ lại hoặc Hoàn tác 100% về bản gốc.
 */
export function AiCodePreviewBar({ preview, onAccept, onRevert, onOpenModal }: {
  preview: AiCodePreviewState
  onAccept: () => void
  onRevert: () => void
  onOpenModal?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<AiCodePreviewMode>('after')
  const [status, setStatus] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault()
        void handleRevert()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, preview.backupPath])

  const handleToggle = async (targetMode: AiCodePreviewMode) => {
    if (targetMode === mode || busy) return
    if (!window.api?.aiCode?.togglePreview) {
      setStatus('Cần khởi động lại app từ terminal (Ctrl+C rồi pnpm dev) để nạp tính năng chuyển đổi Trước/Sau.')
      return
    }
    setBusy(true)
    setStatus(`Đang chuyển sang bản ${targetMode === 'before' ? 'Gốc (Trước)' : 'Sửa (Sau)'}…`)
    try {
      await window.api.aiCode.togglePreview(preview.backupPath, targetMode)
      setMode(targetMode)
      setStatus(`Đang xem: ${targetMode === 'before' ? 'Bản gốc (Trước khi sửa)' : 'Bản mới (Sau khi sửa)'}`)
    } catch (error) {
      setStatus(`Lỗi chuyển đổi: ${String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const handleRevert = async () => {
    setBusy(true)
    setStatus('Đang hoàn tác về bản gốc…')
    try {
      if (!window.api?.aiCode?.revert) {
        throw new Error('Cần khởi động lại app từ terminal (Ctrl+C rồi pnpm dev) để nạp tính năng Hoàn tác mới.')
      }
      const result = await window.api.aiCode.revert(preview.backupPath)
      setStatus(`Đã hoàn tác ${result.files.length} file về bản gốc.`)
      setTimeout(onRevert, 600)
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
      data-ai-surface-label="Thanh điều khiển xem thử Trước / Sau bản sửa UI"
    >
      <div className="ai-code-preview-bar-icon">👁️</div>
      <div className="ai-code-preview-bar-info">
        <strong>So sánh giao diện Trực tiếp (Live Preview)</strong>
        <span className="ai-code-preview-bar-files">
          {status || `${preview.files.length} file · Vite HMR đang cập nhật tức thì`}
        </span>
      </div>

      <div className="ai-code-preview-bar-actions">
        {/* Cụm nút chuyển đổi Trước / Sau */}
        <div className="ai-code-preview-toggle-group" role="group" aria-label="Chuyển đổi giao diện Trước và Sau">
          <button
            type="button"
            className={`ai-code-preview-toggle-btn${mode === 'before' ? ' active' : ''}`}
            disabled={busy}
            onClick={() => void handleToggle('before')}
            title="Chuyển giao diện về Bản gốc (Trước khi sửa)"
            aria-pressed={mode === 'before'}
          >
            ◀ Trước (Gốc)
          </button>
          <button
            type="button"
            className={`ai-code-preview-toggle-btn${mode === 'after' ? ' active' : ''}`}
            disabled={busy}
            onClick={() => void handleToggle('after')}
            title="Chuyển giao diện sang Bản sửa (Sau khi sửa)"
            aria-pressed={mode === 'after'}
          >
            ▶ Sau (Sửa)
          </button>
        </div>

        {onOpenModal && (
          <button
            type="button"
            className="btn ghost ai-code-preview-bar-btn"
            disabled={busy}
            onClick={onOpenModal}
            title="Mở lại hộp thoại gói sửa UI"
          >
            〈/〉 Gói mã
          </button>
        )}

        <button
          type="button"
          className="btn ghost ai-code-preview-bar-btn revert"
          disabled={busy}
          onClick={() => void handleRevert()}
          title="Hoàn tác tất cả thay đổi về bản gốc (Esc)"
          aria-label="Hoàn tác về bản gốc"
        >
          ↩ Hoàn tác
        </button>
        <button
          type="button"
          className="btn primary ai-code-preview-bar-btn accept"
          disabled={busy}
          onClick={onAccept}
          title="Giữ lại bản sửa UI này"
          aria-label="Giữ bản sửa này"
        >
          ✅ Giữ bản sửa
        </button>
      </div>
    </div>
  )
}
