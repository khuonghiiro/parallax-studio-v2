import { useEffect, useCallback } from 'react'
import { useView } from '../store/view'
import { IconAiSparkle, IconLock } from './icons'

/**
 * Hiển thị chỉ báo viền sáng Neon và Lớp chắn khoá UI khi AI Agent đang thao tác.
 * Bảo vệ trạng thái giao diện tránh người dùng can thiệp click/drag gây xung đột
 * với thao tác tự động của AI.
 */
export function AiControlOverlay() {
  const aiActive = useView((s) => s.aiActive)
  const aiLocked = useView((s) => s.aiLocked)
  const actionLabel = useView((s) => s.aiActionLabel)
  const unlockAi = useView((s) => s.unlockAi)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (aiActive || aiLocked)) {
        e.preventDefault()
        e.stopPropagation()
        unlockAi()
      }
    },
    [aiActive, aiLocked, unlockAi]
  )

  useEffect(() => {
    if (!aiActive && !aiLocked) return
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [aiActive, aiLocked, handleKeyDown])

  if (!aiActive && !aiLocked) return null

  return (
    <>
      {/* 1. Lớp chắn an toàn ngăn chặn người dùng vô tình click/drag vào UI khi AI đang thao tác */}
      {aiLocked && (
        <div
          className="ai-safety-barrier"
          title="Giao diện đang được khoá để AI thao tác. Nhấn Esc để mở khoá khẩn cấp."
        />
      )}

      {/* 2. Khung viền Neon nhịp tim (Heartbeat) lan toả từ mép vào trong như browser agent */}
      <div className="ai-neon-border-frame" aria-hidden="true">
        <div className="ai-neon-heartbeat-edge" />
        <div className="ai-neon-heartbeat-vignette" />
      </div>

      {/* 3. Badge trạng thái neon nổi ở cạnh trên cùng giữa màn hình */}
      <div className="ai-neon-hud-badge" role="status" aria-live="polite">
        <div className="ai-neon-glow-dot" />
        <IconAiSparkle width={14} height={14} className="ai-sparkle-icon" />
        <span className="ai-hud-label">
          {actionLabel || 'AI Agent Đang Thao Tác…'}
        </span>
        {aiLocked && (
          <span className="ai-lock-tag" title="UI đang được khoá bảo vệ">
            <IconLock width={11} height={11} /> Khoá UI
          </span>
        )}
        <button
          type="button"
          className="ai-hud-unlock-btn"
          onClick={unlockAi}
          title="Huỷ khoá thao tác khẩn cấp (Phím tắt: Esc)"
        >
          ✕ Mở khoá
        </button>
      </div>
    </>
  )
}
