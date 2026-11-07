import { useState, useEffect, useRef, useCallback } from 'react'
import {
  captureAiInspectorSnapshot,
  formatAiInspectorMarkdown
} from './inspector/aiUiInspectorScanner'
import { IconAiScan, IconCopy, IconCheck, IconX } from './icons'
import '../styles/aiUiInspector.css'

export function AiUiInspectorOverlay() {
  const [isArmed, setIsArmed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })
  const [toastInfo, setToastInfo] = useState<{
    count: number
    report: string
  } | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const isDraggingRef = useRef(false)
  const isArmedRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const currentPosRef = useRef({ x: 0, y: 0 })
  const toastTimerRef = useRef<number | null>(null)

  isDraggingRef.current = isDragging
  isArmedRef.current = isArmed
  startPosRef.current = startPos
  currentPosRef.current = currentPos

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch {
      /* fallback below */
    }
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }, [])

  const handleFinishCapture = useCallback(
    async (box: { left: number; top: number; width: number; height: number }) => {
      const snapshot = captureAiInspectorSnapshot(box)
      const report = formatAiInspectorMarkdown(snapshot)
      await copyToClipboard(report)

      setToastInfo({
        count: snapshot.elements.length,
        report
      })

      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = window.setTimeout(() => {
        setToastInfo(null)
      }, 5500)
    },
    [copyToClipboard]
  )

  useEffect(() => {
    const handleToggle = () => {
      const next = !isArmedRef.current
      isArmedRef.current = next
      setIsArmed(next)
    }

    const handleMouseDown = (e: MouseEvent) => {
      // Phím tắt độc quyền: CHỈ Win + Shift (e.metaKey && e.shiftKey), không dùng Alt/Ctrl
      const isWinShift =
        e.shiftKey && e.metaKey && !e.altKey && !e.ctrlKey
      const shouldTrigger = (isWinShift || isArmedRef.current) && e.button === 0

      if (shouldTrigger) {
        e.preventDefault()
        e.stopPropagation()
        isArmedRef.current = false
        isDraggingRef.current = true
        const pos = { x: e.clientX, y: e.clientY }
        startPosRef.current = pos
        currentPosRef.current = pos
        setIsArmed(false)
        setIsDragging(true)
        setStartPos(pos)
        setCurrentPos(pos)
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      e.preventDefault()
      e.stopPropagation()
      const pos = { x: e.clientX, y: e.clientY }
      currentPosRef.current = pos
      setCurrentPos(pos)
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      e.preventDefault()
      e.stopPropagation()
      isDraggingRef.current = false
      setIsDragging(false)

      const x0 = startPosRef.current.x
      const y0 = startPosRef.current.y
      const x1 = e.clientX
      const y1 = e.clientY

      const box = {
        left: Math.min(x0, x1),
        top: Math.min(y0, y1),
        width: Math.abs(x1 - x0),
        height: Math.abs(y1 - y0)
      }

      handleFinishCapture(box)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Nhấn tổ hợp Win + Shift để bật ngay chế độ soi UI (khoá màn hình + hiện viền neon)
      if (e.metaKey && e.shiftKey && !e.altKey && !e.ctrlKey) {
        if (!isArmedRef.current && !isDraggingRef.current) {
          isArmedRef.current = true
          setIsArmed(true)
        }
      }

      if (e.key === 'Escape') {
        if (isDraggingRef.current || isArmedRef.current) {
          e.preventDefault()
          e.stopPropagation()
          isDraggingRef.current = false
          isArmedRef.current = false
          setIsDragging(false)
          setIsArmed(false)
        } else if (showPreview) {
          setShowPreview(false)
        }
      }
    }

    window.addEventListener('pxs:toggle-ai-inspector', handleToggle)
    window.addEventListener('mousedown', handleMouseDown, true)
    window.addEventListener('mousemove', handleMouseMove, true)
    window.addEventListener('mouseup', handleMouseUp, true)
    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      window.removeEventListener('pxs:toggle-ai-inspector', handleToggle)
      window.removeEventListener('mousedown', handleMouseDown, true)
      window.removeEventListener('mousemove', handleMouseMove, true)
      window.removeEventListener('mouseup', handleMouseUp, true)
      window.removeEventListener('keydown', handleKeyDown, true)
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [handleFinishCapture, showPreview])

  // Cập nhật class body để đổi con trỏ chuột sang dạng crosshair
  useEffect(() => {
    if (isArmed || isDragging) {
      document.body.classList.add('ai-ui-inspector-active')
    } else {
      document.body.classList.remove('ai-ui-inspector-active')
    }
  }, [isArmed, isDragging])

  // Tính toạ độ khung chữ nhật
  const boxLeft = Math.min(startPos.x, currentPos.x)
  const boxTop = Math.min(startPos.y, currentPos.y)
  const boxWidth = Math.abs(currentPos.x - startPos.x)
  const boxHeight = Math.abs(currentPos.y - startPos.y)

  const isModeActive = isArmed || isDragging

  return (
    <>
      {/* 1. LỚP CHẮN BẢO VỆ KHOÁ TOÀN BỘ UI MÀN HÌNH ĐỂ TRÁNH THAO TÁC NHẦM VÀO APP */}
      {isModeActive && (
        <div
          className="ai-ui-inspector-barrier"
          title="Chế độ soi UI đang bật: Giữ chuột trái và kéo khung để quét vị trí code, hoặc nhấn Esc để thoát."
        />
      )}

      {/* 2. VIỀN SÁNG NEON BÁO HIỆU TOÀN MÀN HÌNH ĐÃ ACTIVE CHẾ ĐỘ SOI */}
      {isModeActive && (
        <div className="ai-ui-inspector-screen-frame" aria-hidden="true">
          <div className="ai-ui-inspector-screen-glow" />
          <div className="ai-ui-inspector-screen-corner corner-tl" />
          <div className="ai-ui-inspector-screen-corner corner-tr" />
          <div className="ai-ui-inspector-screen-corner corner-bl" />
          <div className="ai-ui-inspector-screen-corner corner-br" />
        </div>
      )}

      {/* 3. Badge HUD trung tâm nổi ở đầu màn hình báo hiệu trạng thái sẵn sàng quét */}
      {isArmed && !isDragging && (
        <div className="ai-ui-inspector-arm-hud" role="status">
          <div className="ai-ui-inspector-arm-dot" />
          <IconAiScan width={15} height={15} style={{ color: 'var(--accent-cyan)' }} />
          <span>ĐÃ BẬT SOI GIAO DIỆN AI (WIN+SHIFT)</span>
          <span className="ai-ui-inspector-arm-desc">Nhấn giữ chuột trái &amp; kéo khung quanh nút cần soi</span>
          <kbd>Esc để thoát</kbd>
          <button
            type="button"
            className="ai-ui-inspector-arm-close"
            onClick={() => {
              isArmedRef.current = false
              setIsArmed(false)
            }}
            title="Đóng chế độ soi (Esc)"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4. Khung chữ nhật quét chuột (Marquee Snip Box) */}
      {isDragging && (
        <div
          className="ai-ui-inspector-marquee"
          style={{
            left: `${boxLeft}px`,
            top: `${boxTop}px`,
            width: `${boxWidth}px`,
            height: `${boxHeight}px`
          }}
        >
          <div className="ai-ui-inspector-badge">
            📐 {boxWidth} × {boxHeight} px
          </div>
        </div>
      )}

      {/* 5. Toast thông báo kết quả sau khi nhả chuột */}
      {toastInfo && !showPreview && (
        <div className="ai-ui-inspector-toast" role="status" aria-live="polite">
          <div className="ai-ui-inspector-toast-icon">
            <IconCheck width={16} height={16} />
          </div>
          <div className="ai-ui-inspector-toast-msg">
            <div className="ai-ui-inspector-toast-title">
              Đã sao chép ngữ cảnh AI vào Clipboard!
            </div>
            <div className="ai-ui-inspector-toast-hint">
              {toastInfo.count > 0
                ? `Phát hiện ${toastInfo.count} phần tử. Nhấn Ctrl+V vào chat để gửi cho AI.`
                : 'Nhấn Ctrl+V vào chat để gửi thông tin cho AI.'}
            </div>
          </div>
          <button
            type="button"
            className="ai-ui-inspector-toast-btn"
            onClick={() => setShowPreview(true)}
            title="Xem nội dung Markdown vừa copy"
          >
            Xem trước
          </button>
          <button
            type="button"
            className="ai-ui-inspector-arm-close"
            onClick={() => setToastInfo(null)}
            title="Đóng thông báo"
          >
            ✕
          </button>
        </div>
      )}

      {/* 6. Modal xem trước nội dung context (tuỳ chọn) */}
      {showPreview && toastInfo && (
        <div
          className="ai-ui-inspector-preview-backdrop"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="ai-ui-inspector-preview-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ai-ui-inspector-preview-header">
              <div className="ai-ui-inspector-preview-title">
                <IconAiScan width={16} height={16} style={{ color: 'var(--accent-cyan)' }} />
                <span>Nội Dung Ngữ Cảnh AI (Đã lưu trong Clipboard)</span>
              </div>
              <button
                type="button"
                className="ai-ui-inspector-arm-close"
                onClick={() => setShowPreview(false)}
                title="Đóng"
              >
                <IconX width={14} height={14} />
              </button>
            </div>
            <pre className="ai-ui-inspector-preview-body">{toastInfo.report}</pre>
            <div className="ai-ui-inspector-preview-footer">
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setShowPreview(false)}
              >
                Đóng (Esc)
              </button>
              <button
                type="button"
                className="btn primary sm"
                onClick={async () => {
                  await copyToClipboard(toastInfo.report)
                  setShowPreview(false)
                }}
              >
                <IconCopy width={13} height={13} /> Copy lại
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
