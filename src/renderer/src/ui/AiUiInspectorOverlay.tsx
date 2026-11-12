import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import {
  captureAiInspectorSnapshot,
  formatAiInspectorMarkdown,
  type AiInspectorSnapshot
} from './inspector/aiUiInspectorScanner'
import { AiUiInspectorPreviewModal } from './inspector/AiUiInspectorPreviewModal'
import { AiUiScanCallouts } from './inspector/AiUiScanCallouts'
import {
  AiUiArmHud,
  AiUiCrosshair,
  AiUiMarquee,
  AiUiScanToast,
  AiUiScreenFrame
} from './inspector/AiUiInspectorHud'
import { useAiInspectorCapture } from './inspector/useAiInspectorCapture'
import { AiCodeHandoffModal } from './inspector/AiCodeHandoffModal'
import { AiCodePreviewBar, type AiCodePreviewState } from './inspector/AiCodePreviewBar'
import { exportSnapshotCode } from './inspector/aiCodeHandoffClient'
import type { AiCaptureMode } from './inspector/useAiInspectorCapture'
import type { ScanBox } from './inspector/aiUiInspectorGeometry'
import type { CalloutBox } from './inspector/aiUiCalloutLayout'
import '../styles/aiUiInspector.css'

/** Thời gian hiển thị hiệu ứng quét + toast (khớp animation trong aiUiInspectorScanFx.css / Hud.css). */
const RESULT_VISIBLE_MS = 4000
/** Vùng toast trên cùng giữa màn hình — nhãn chú thích không được đặt vào đây. */
const TOAST_RESERVED_HEIGHT = 92
const TOAST_RESERVED_WIDTH = 660

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fallback bên dưới */
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
}

function useToastReservedArea(): CalloutBox[] {
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1920))
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return useMemo(() => {
    const w = Math.min(TOAST_RESERVED_WIDTH, vw - 16)
    return [{ left: (vw - w) / 2, top: 0, width: w, height: TOAST_RESERVED_HEIGHT }]
  }, [vw])
}

/**
 * AI UI Inspector — Win + Alt + kéo khung để quét vùng giao diện và copy ngữ cảnh code cho AI.
 */
export function AiUiInspectorOverlay() {
  const [lastCaptured, setLastCaptured] = useState<{ snapshot: AiInspectorSnapshot; report: string; mode: AiCaptureMode } | null>(
    null
  )
  const [codeOpen, setCodeOpen] = useState(false)
  const [codeReport, setCodeReport] = useState('')
  const [codeStatus, setCodeStatus] = useState('')
  const exportSequence = useRef(0)
  const [copied, setCopied] = useState(true)
  const [resultVisible, setResultVisible] = useState(false)
  const [waveId, setWaveId] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const [held, setHeld] = useState(false)
  const [previewApplied, setPreviewApplied] = useState<AiCodePreviewState | null>(null)
  const showPreviewRef = useRef(false)
  showPreviewRef.current = showPreview
  const hideTimerRef = useRef<number | null>(null)
  const crosshairRef = useRef<HTMLDivElement | null>(null)
  const reserved = useToastReservedArea()
  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = null
  }, [])

  const scheduleHide = useCallback(
    (ms: number) => {
      clearHideTimer()
      hideTimerRef.current = window.setTimeout(() => setResultVisible(false), ms)
    },
    [clearHideTimer]
  )

  useEffect(() => {
    const onBundle = (event: Event) => {
      const bundle = (event as CustomEvent<{ markdown: string; files: unknown[]; snapshot: AiInspectorSnapshot }>).detail
      exportSequence.current++
      clearHideTimer()
      setHeld(false)
      setCodeReport(bundle.markdown)
      setCodeStatus(`${bundle.files.length} file · Gói được xuất qua MCP`)
      setCodeOpen(false)
      setLastCaptured({ snapshot: bundle.snapshot, report: '', mode: 'code' })
      setShowPreview(false)
      setResultVisible(true)
      setWaveId((prev) => prev + 1)
    }
    const onOpenCodeHandoff = () => {
      clearHideTimer()
      setResultVisible(false)
      setShowPreview(false)
      setCodeOpen(true)
    }
    window.addEventListener('pxs:ai-code-bundle', onBundle)
    window.addEventListener('pxs:open-ai-code-handoff', onOpenCodeHandoff)
    return () => {
      window.removeEventListener('pxs:ai-code-bundle', onBundle)
      window.removeEventListener('pxs:open-ai-code-handoff', onOpenCodeHandoff)
    }
  }, [clearHideTimer])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && resultVisible && !showPreview && !codeOpen) {
        e.stopPropagation()
        clearHideTimer()
        setResultVisible(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [resultVisible, showPreview, codeOpen, clearHideTimer])

  useEffect(() => clearHideTimer, [clearHideTimer])

  const handleFinish = useCallback(
    (box: ScanBox, mode: AiCaptureMode) => {
      // Quét DOM & trạng thái đồng bộ ngay khi nhả chuột, trước mọi thao tác bất đồng bộ
      const snapshot = captureAiInspectorSnapshot(box, mode === 'code' ? Infinity : undefined)
      if (mode === 'code') {
        const sequence = ++exportSequence.current
        clearHideTimer()
        setCodeOpen(false)
        setLastCaptured({ snapshot, report: '', mode })
        setResultVisible(true)
        setHeld(false)
        setWaveId((prev) => prev + 1)
        setShowPreview(false)
        setCodeReport('')
        setCodeStatus('Đang thu thập mã nguồn và quy tắc…')
        void exportSnapshotCode(snapshot).then(async (bundle) => {
          if (sequence !== exportSequence.current) return
          setCodeReport(bundle.markdown)
          const ok = await copyToClipboard(bundle.markdown)
          if (sequence !== exportSequence.current) return
          clearHideTimer()
          setCodeStatus(`${bundle.files.length} file · ${bundle.warnings.length} lưu ý · ${ok ? 'Đã sao chép Markdown' : 'Chưa sao chép được, hãy dùng nút Sao chép hoặc Lưu Markdown'}`)
        }).catch((error) => {
          if (sequence !== exportSequence.current) return
          clearHideTimer()
          setCodeStatus(`${String(error)} (${snapshot.elements.length} phần tử trong vùng ${Math.round(box.width)} × ${Math.round(box.height)}). Hãy kéo quanh một nút hoặc panel có nội dung.`)
        })
        return
      }
      exportSequence.current++
      const report = formatAiInspectorMarkdown(snapshot)
      setLastCaptured({ snapshot, report, mode })
      setResultVisible(true)
      setHeld(false)
      setWaveId((prev) => prev + 1)
      scheduleHide(RESULT_VISIBLE_MS)
      void copyToClipboard(report).then(setCopied)
    },
    [scheduleHide, clearHideTimer]
  )

  const capture = useAiInspectorCapture({
    onFinish: handleFinish,
    onArm: () => {
      exportSequence.current++
      clearHideTimer()
      setResultVisible(false)
    },
    closePreview: () => {
      if (!showPreviewRef.current) return false
      setShowPreview(false)
      return true
    },
    crosshairRef
  })

  const { isArmed, isDragging, startPos, currentPos } = capture
  const isModeActive = isArmed || isDragging
  const showResult = resultVisible && lastCaptured && !isDragging && !showPreview && !codeOpen

  return (
    <>
      {codeOpen && <AiCodeHandoffModal report={codeReport} status={codeStatus}
        onClose={() => { setCodeOpen(false); setResultVisible(false) }} onCopy={copyToClipboard}
        onPreviewApply={(state) => { setPreviewApplied(state); setCodeOpen(false); setResultVisible(false) }} />}
      {isModeActive && <AiUiScreenFrame mode={capture.mode} />}
      {isModeActive && <AiUiCrosshair mode={capture.mode} ref={crosshairRef} />}
      {isArmed && !isDragging && <AiUiArmHud mode={capture.mode} placement={capture.armHudPlacement} onClose={capture.disarm} />}
      {isDragging && (
        <AiUiMarquee mode={capture.mode}
          left={Math.min(startPos.x, currentPos.x)}
          top={Math.min(startPos.y, currentPos.y)}
          width={Math.abs(currentPos.x - startPos.x)}
          height={Math.abs(currentPos.y - startPos.y)}
        />
      )}

      {showResult && (
        <AiUiScanCallouts snapshot={lastCaptured.snapshot} waveId={waveId} reserved={reserved} mode={lastCaptured.mode} held={held} />
      )}

      {showResult && (
        <AiUiScanToast
          key={`toast-${waveId}`}
          snapshot={lastCaptured.snapshot}
          copied={copied}
          mode={lastCaptured.mode}
          status={codeStatus}
          onHoverChange={(hovering) => {
            setHeld(hovering)
            if (hovering) {
              clearHideTimer()
            } else if (lastCaptured.mode !== 'code') {
              scheduleHide(4000)
            }
          }}
          onPreview={() => {
            clearHideTimer()
            if (lastCaptured.mode === 'code') { setCodeOpen(true); return }
            setResultVisible(false)
            setShowPreview(true)
          }}
          onClose={() => {
            clearHideTimer()
            setResultVisible(false)
          }}
        />
      )}

      {showPreview && lastCaptured && (
        <AiUiInspectorPreviewModal
          snapshot={lastCaptured.snapshot}
          report={lastCaptured.report}
          onClose={() => setShowPreview(false)}
          onCopyMarkdown={copyToClipboard}
        />
      )}

      {previewApplied && (
        <AiCodePreviewBar
          preview={previewApplied}
          onAccept={() => setPreviewApplied(null)}
          onRevert={() => setPreviewApplied(null)}
          onOpenModal={() => setCodeOpen(true)}
        />
      )}
    </>
  )
}
