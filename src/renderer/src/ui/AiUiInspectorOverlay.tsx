import { useState, useEffect, useRef, useCallback } from 'react'
import {
  captureAiInspectorSnapshot,
  formatAiInspectorMarkdown,
  type AiInspectorSnapshot
} from './inspector/aiUiInspectorScanner'
import { AiUiInspectorPreviewModal } from './inspector/AiUiInspectorPreviewModal'
import { IconAiScan, IconCheck } from './icons'
import '../styles/aiUiInspector.css'

export function AiUiInspectorOverlay() {
  const [isArmed, setIsArmed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })
  const [lastCaptured, setLastCaptured] = useState<{
    snapshot: AiInspectorSnapshot
    report: string
  } | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const isDraggingRef = useRef(false)
  const isArmedRef = useRef(false)
  const showPreviewRef = useRef(false)
  const suppressNextClickRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const currentPosRef = useRef({ x: 0, y: 0 })
  const toastTimerRef = useRef<number | null>(null)

  isDraggingRef.current = isDragging
  isArmedRef.current = isArmed
  showPreviewRef.current = showPreview
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
      document.body.appendChild(ta)
      return ok
    } catch {
      return false
    }
  }, [])

  const handleFinishCapture = useCallback(
    async (box: { left: number; top: number; width: number; height: number }) => {
      // Quét DOM & trạng thái Xưởng đồng bộ ngay lập tức trước khi thực hiện bất kỳ thao tác bất đồng bộ nào
      const snapshot = captureAiInspectorSnapshot(box)
      const report = formatAiInspectorMarkdown(snapshot)

      setLastCaptured({ snapshot, report })
      setToastVisible(true)

      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = window.setTimeout(() => {
        setToastVisible(false)
      }, 5500)

      await copyToClipboard(report)
    },
    [copyToClipboard]
  )

  const finishCaptureRef = useRef(handleFinishCapture)
  finishCaptureRef.current = handleFinishCapture

  useEffect(() => {
    const handleToggle = () => {
      const next = !isArmedRef.current
      isArmedRef.current = next
      setIsArmed(next)
    }

    const isInspectorOwnUi = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false
      return Boolean(
        target.closest(
          '.ai-ui-inspector-arm-hud, .ai-ui-inspector-toast, .ai-ui-inspector-preview-backdrop'
        )
      )
    }

    const isToolbarTriggerBtn = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false
      return Boolean(target.closest('#ai-ui-inspector-btn'))
    }

    const startDragAt = (clientX: number, clientY: number) => {
      isArmedRef.current = false
      isDraggingRef.current = true
      suppressNextClickRef.current = true
      const pos = { x: clientX, y: clientY }
      startPosRef.current = pos
      currentPosRef.current = pos
      setIsArmed(false)
      setIsDragging(true)
      setStartPos(pos)
      setCurrentPos(pos)
    }

    const handlePointerDown = (e: PointerEvent) => {
      if (isToolbarTriggerBtn(e.target)) {
        // Chặn sự kiện pointerdown lan tới các popup/menu đang mở (như Xưởng sáng tạo) để không làm đóng popup
        e.stopPropagation()
        e.stopImmediatePropagation()
        return
      }
      if (isInspectorOwnUi(e.target)) return

      const isWinShift = e.shiftKey && e.metaKey && !e.altKey && !e.ctrlKey
      const shouldTrigger = (isWinShift || isArmedRef.current) && e.button === 0
      if (shouldTrigger) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        startDragAt(e.clientX, e.clientY)
      }
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (isToolbarTriggerBtn(e.target)) {
        e.stopPropagation()
        e.stopImmediatePropagation()
        return
      }
      if (isInspectorOwnUi(e.target)) return

      if (isDraggingRef.current) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return
      }

      const isWinShift = e.shiftKey && e.metaKey && !e.altKey && !e.ctrlKey
      const shouldTrigger = (isWinShift || isArmedRef.current) && e.button === 0
      if (shouldTrigger) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        startDragAt(e.clientX, e.clientY)
      }
    }

    const handleMove = (e: MouseEvent | PointerEvent) => {
      if (!isDraggingRef.current) return
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      const pos = { x: e.clientX, y: e.clientY }
      currentPosRef.current = pos
      setCurrentPos(pos)
    }

    const finishDragAt = (clientX: number, clientY: number) => {
      isDraggingRef.current = false
      suppressNextClickRef.current = true
      window.setTimeout(() => {
        suppressNextClickRef.current = false
      }, 80)
      setIsDragging(false)

      const x0 = startPosRef.current.x
      const y0 = startPosRef.current.y
      const x1 = clientX
      const y1 = clientY

      const box = {
        left: Math.min(x0, x1),
        top: Math.min(y0, y1),
        width: Math.abs(x1 - x0),
        height: Math.abs(y1 - y0)
      }

      void finishCaptureRef.current(box)
    }

    const handlePointerUp = (e: PointerEvent) => {
      if (isToolbarTriggerBtn(e.target)) {
        e.stopPropagation()
        e.stopImmediatePropagation()
        return
      }
      if (!isDraggingRef.current) return
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      finishDragAt(e.clientX, e.clientY)
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (isToolbarTriggerBtn(e.target)) {
        e.stopPropagation()
        e.stopImmediatePropagation()
        return
      }
      if (!isDraggingRef.current) {
        if (suppressNextClickRef.current) {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
        }
        return
      }
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      finishDragAt(e.clientX, e.clientY)
    }

    const handleClickCapture = (e: MouseEvent) => {
      if (isToolbarTriggerBtn(e.target)) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        handleToggle()
        return
      }
      if (isInspectorOwnUi(e.target)) return
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
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
          e.stopImmediatePropagation()
          isDraggingRef.current = false
          isArmedRef.current = false
          setIsDragging(false)
          setIsArmed(false)
        } else if (showPreviewRef.current) {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          showPreviewRef.current = false
          setShowPreview(false)
        }
      }
    }

    window.addEventListener('pxs:toggle-ai-inspector', handleToggle)
    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('mousedown', handleMouseDown, true)
    window.addEventListener('pointermove', handleMove, true)
    window.addEventListener('mousemove', handleMove, true)
    window.addEventListener('pointerup', handlePointerUp, true)
    window.addEventListener('mouseup', handleMouseUp, true)
    window.addEventListener('click', handleClickCapture, true)
    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      window.removeEventListener('pxs:toggle-ai-inspector', handleToggle)
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('mousedown', handleMouseDown, true)
      window.removeEventListener('pointermove', handleMove, true)
      window.removeEventListener('mousemove', handleMove, true)
      window.removeEventListener('pointerup', handlePointerUp, true)
      window.removeEventListener('mouseup', handleMouseUp, true)
      window.removeEventListener('click', handleClickCapture, true)
      window.removeEventListener('keydown', handleKeyDown, true)
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  // Cập nhật class body để đổi con trỏ chuột sang dạng crosshair
  useEffect(() => {
    if (isArmed || isDragging) {
      document.body.classList.add('ai-ui-inspector-active')
    } else {
      document.body.classList.remove('ai-ui-inspector-active')
    }
  }, [isArmed, isDragging])

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
        <div
          className="ai-ui-inspector-arm-hud"
          role="status"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="ai-ui-inspector-arm-dot" />
          <IconAiScan width={15} height={15} style={{ color: 'var(--accent-cyan)' }} />
          <span>ĐÃ BẬT SOI GIAO DIỆN AI (WIN+SHIFT)</span>
          <span className="ai-ui-inspector-arm-desc">
            Nhấn giữ chuột trái &amp; kéo khung quanh vùng / bộ phận cần soi
          </span>
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
      {toastVisible && lastCaptured && !showPreview && (
        <div
          className="ai-ui-inspector-toast"
          role="status"
          aria-live="polite"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="ai-ui-inspector-toast-icon">
            <IconCheck width={16} height={16} />
          </div>
          <div className="ai-ui-inspector-toast-msg">
            <div className="ai-ui-inspector-toast-title">
              Đã sao chép ngữ cảnh AI vào Clipboard!
            </div>
            <div className="ai-ui-inspector-toast-hint">
              {lastCaptured.snapshot.elements.length > 0
                ? `Phát hiện ${lastCaptured.snapshot.elements.length} thành phần. Nhấn Ctrl+V vào chat để gửi cho AI.`
                : 'Nhấn Ctrl+V vào chat để gửi thông tin cho AI.'}
            </div>
          </div>
          <button
            type="button"
            className="ai-ui-inspector-toast-btn"
            onClick={() => {
              if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
              setToastVisible(false)
              setShowPreview(true)
            }}
            title="Mở hộp thoại xem chi tiết trực quan nội dung vừa quét"
          >
            Xem trước
          </button>
          <button
            type="button"
            className="ai-ui-inspector-arm-close"
            onClick={() => setToastVisible(false)}
            title="Đóng thông báo"
          >
            ✕
          </button>
        </div>
      )}

      {/* 6. Hộp thoại Nội Dung Ngữ Cảnh AI (chỉ đóng khi bấm nút Đóng / ✕ hoặc phím Esc) */}
      {showPreview && lastCaptured && (
        <AiUiInspectorPreviewModal
          snapshot={lastCaptured.snapshot}
          report={lastCaptured.report}
          onClose={() => setShowPreview(false)}
          onCopyMarkdown={copyToClipboard}
        />
      )}
    </>
  )
}
