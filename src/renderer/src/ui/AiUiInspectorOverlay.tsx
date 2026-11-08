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
  const [hudPlacement, setHudPlacement] = useState<'top' | 'bottom'>('top')
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })
  const [lastCaptured, setLastCaptured] = useState<{
    snapshot: AiInspectorSnapshot
    report: string
  } | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const [highlightVisible, setHighlightVisible] = useState(false)
  const [highlightWaveId, setHighlightWaveId] = useState(0)
  const [showPreview, setShowPreview] = useState(false)

  const isDraggingRef = useRef(false)
  const isArmedRef = useRef(false)
  const hudPlacementRef = useRef<'top' | 'bottom'>('top')
  const toastVisibleRef = useRef(false)
  const showPreviewRef = useRef(false)
  const suppressNextClickRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const currentPosRef = useRef({ x: 0, y: 0 })
  const toastTimerRef = useRef<number | null>(null)
  const highlightTimerRef = useRef<number | null>(null)

  isDraggingRef.current = isDragging
  isArmedRef.current = isArmed
  hudPlacementRef.current = hudPlacement
  toastVisibleRef.current = toastVisible
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
      document.body.removeChild(ta)
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

      // Nếu vùng vừa quét nằm ở nửa trên màn hình, đặt Toast thông báo xuống dưới để không che hiệu ứng đánh dấu
      if (typeof window !== 'undefined' && box.top < 140) {
        hudPlacementRef.current = 'bottom'
        setHudPlacement('bottom')
      }

      setLastCaptured({ snapshot, report })
      setToastVisible(true)
      setHighlightVisible(true)
      setHighlightWaveId((prev) => prev + 1)

      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
      toastTimerRef.current = window.setTimeout(() => {
        setToastVisible(false)
      }, 5500)

      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightVisible(false)
      }, 3600)

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
      if (next) {
        setHighlightVisible(false)
      }
    }

    const isInspectorOwnActionControl = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false
      return Boolean(
        target.closest(
          '.ai-ui-inspector-arm-close, .ai-ui-inspector-toast-btn, .ai-ui-inspector-preview-backdrop'
        )
      )
    }

    const isToolbarTriggerBtn = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false
      return Boolean(target.closest('#ai-ui-inspector-btn'))
    }

    const maybeAutoDodgeHud = (clientX: number, clientY: number) => {
      if (typeof window === 'undefined') return
      const winW = window.innerWidth || 1920
      const winH = window.innerHeight || 1080
      const nearHorizontalCenter = Math.abs(clientX - winW * 0.5) < 430
      if (!nearHorizontalCenter) return

      if (hudPlacementRef.current === 'top' && clientY < 105) {
        hudPlacementRef.current = 'bottom'
        setHudPlacement('bottom')
      } else if (hudPlacementRef.current === 'bottom' && clientY > winH - 115) {
        hudPlacementRef.current = 'top'
        setHudPlacement('top')
      }
    }

    const startDragAt = (clientX: number, clientY: number) => {
      isArmedRef.current = false
      isDraggingRef.current = true
      suppressNextClickRef.current = true
      const pos = { x: clientX, y: clientY }
      startPosRef.current = pos
      currentPosRef.current = pos
      setIsArmed(false)
      setHighlightVisible(false)
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
      if (isInspectorOwnActionControl(e.target)) return

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
      if (isInspectorOwnActionControl(e.target)) return

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
      if (isArmedRef.current || toastVisibleRef.current) {
        maybeAutoDodgeHud(e.clientX, e.clientY)
      }
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
      if (isInspectorOwnActionControl(e.target)) return
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
          setHighlightVisible(false)
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
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current)
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

      {/* 3. Badge HUD trung tâm tự động né chuột (top/bottom) & cho phép kéo xuyên qua */}
      {isArmed && !isDragging && (
        <div
          className={`ai-ui-inspector-arm-hud${hudPlacement === 'bottom' ? ' is-bottom' : ''}`}
          role="status"
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
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
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

      {/* 4b. HIỆU ỨNG ĐÁNH DẤU CÁC THÀNH PHẦN & VÙNG VỪA QUÉT TRONG VÀI GIÂY */}
      {highlightVisible && lastCaptured && !isDragging && !showPreview && (
        <div
          key={`scan-wave-${highlightWaveId}`}
          className="ai-ui-scanned-highlights-layer"
          aria-hidden="true"
        >
          {/* Khung vùng quét gốc nếu người dùng kéo khung marquee */}
          {lastCaptured.snapshot.rect.width >= 10 && lastCaptured.snapshot.rect.height >= 10 && (
            <div
              className="ai-ui-scanned-region-pulse"
              style={{
                left: `${lastCaptured.snapshot.rect.left}px`,
                top: `${lastCaptured.snapshot.rect.top}px`,
                width: `${lastCaptured.snapshot.rect.width}px`,
                height: `${lastCaptured.snapshot.rect.height}px`
              }}
            />
          )}

          {/* Khung viền sáng + Nhãn đánh số cho từng thành phần UI đã được quét */}
          {lastCaptured.snapshot.elements.map((item, idx) => {
            if (item.bounds.width <= 0 || item.bounds.height <= 0) return null
            const rawLabel =
              item.text ||
              item.controlDetails?.fieldLabel ||
              item.part25D?.name ||
              item.bone25D?.name ||
              item.title ||
              `<${item.tagName}>`
            const shortLabel = rawLabel.length > 34 ? `${rawLabel.slice(0, 32)}…` : rawLabel
            const flipDown = item.bounds.top < 30
            const alignRight =
              typeof window !== 'undefined' && item.bounds.left + 210 > window.innerWidth
            const isPrimary = idx === 0

            return (
              <div
                key={`scanned-hl-${item.tagName}-${item.id}-${idx}`}
                className={`ai-ui-scanned-target-box${isPrimary ? ' is-primary' : ' is-secondary'}`}
                style={{
                  left: `${item.bounds.left}px`,
                  top: `${item.bounds.top}px`,
                  width: `${Math.max(16, item.bounds.width)}px`,
                  height: `${Math.max(16, item.bounds.height)}px`
                }}
              >
                <div className="ai-ui-scanned-target-ripple" />
                <div
                  className={`ai-ui-scanned-target-tag${flipDown ? ' flip-down' : ''}${alignRight ? ' align-right' : ''}`}
                >
                  <span className="ai-ui-scanned-target-idx">
                    {isPrimary ? '🎯 #1' : `#${idx + 1}`}
                  </span>
                  <span className="ai-ui-scanned-target-name">{shortLabel}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 5. Toast thông báo kết quả sau khi nhả chuột (tự động né chuột top/bottom) */}
      {toastVisible && lastCaptured && !showPreview && (
        <div
          className={`ai-ui-inspector-toast${hudPlacement === 'bottom' ? ' is-bottom' : ''}`}
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
                ? `Đã đánh dấu ${lastCaptured.snapshot.elements.length} thành phần trên màn hình. Nhấn Ctrl+V để gửi cho AI.`
                : 'Nhấn Ctrl+V vào chat để gửi thông tin cho AI.'}
            </div>
          </div>
          <button
            type="button"
            className="ai-ui-inspector-toast-btn"
            onClick={() => {
              if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
              if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current)
              setToastVisible(false)
              setHighlightVisible(false)
              setShowPreview(true)
            }}
            title="Mở hộp thoại xem chi tiết trực quan nội dung vừa quét"
          >
            Xem trước
          </button>
          <button
            type="button"
            className="ai-ui-inspector-arm-close"
            onClick={() => {
              setToastVisible(false)
              setHighlightVisible(false)
            }}
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
