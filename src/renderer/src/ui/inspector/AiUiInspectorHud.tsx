import { forwardRef } from 'react'
import { IconAiScan, IconCheck } from '../icons'
import type { AiInspectorSnapshot } from './aiUiInspectorScanner'
import '../../styles/aiUiInspectorHud.css'

/**
 * Các mảnh HUD của AI UI Inspector: lớp chắn + viền neon, badge chế độ quét, khung marquee + thước,
 * tâm ngắm theo chuột, toast kết quả. Logic sự kiện nằm ở `AiUiInspectorOverlay.tsx`.
 */

type ScanModeProps = { mode?: 'context' | 'code' }

export function AiUiScreenFrame({ mode = 'context' }: ScanModeProps) {
  return (
    <>
      <div
        className="ai-ui-inspector-barrier" data-ai-scan-mode={mode}
        title="Chế độ soi UI đang bật: Giữ chuột trái và kéo khung để quét vị trí code, hoặc nhấn Esc để thoát."
      />
      <div className="ai-ui-inspector-screen-frame" data-ai-scan-mode={mode} aria-hidden="true">
        <div className="ai-ui-inspector-screen-glow" />
        <div className="ai-ui-inspector-screen-scanline" />
        <div className="ai-ui-inspector-screen-corner corner-tl" />
        <div className="ai-ui-inspector-screen-corner corner-tr" />
        <div className="ai-ui-inspector-screen-corner corner-bl" />
        <div className="ai-ui-inspector-screen-corner corner-br" />
      </div>
    </>
  )
}

export function AiUiArmHud({ placement, onClose, mode = 'context' }: { placement: 'top' | 'bottom'; onClose: () => void; mode?: 'context' | 'code' }) {
  return (
    <div
      className={`ai-ui-inspector-arm-hud${placement === 'bottom' ? ' is-bottom' : ''}`}
      data-mcp-region="ai_inspector_arm_hud"
      data-ai-scan-mode={mode}
      role="status"
    >
      <div className="ai-ui-inspector-arm-dot" />
      <IconAiScan width={15} height={15} className="ai-ui-inspector-arm-icon" />
      <span className="ai-ui-inspector-arm-title">{mode === 'code' ? 'GÓI SỬA UI · CSS/JSX/JS' : 'NGỮ CẢNH UI · VỊ TRÍ CODE'}</span>
      <span className="ai-ui-inspector-arm-desc">{mode === 'code' ? 'Kéo vùng → mã + quy tắc để gửi AI' : 'Kéo vùng → thông tin UI cho AI'}</span>
      <kbd>{mode === 'code' ? 'Win+Ctrl' : 'Win+Shift'}</kbd>
      <kbd>Esc</kbd>
      <button
        type="button"
        className="ai-ui-inspector-arm-close"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onClose}
        title="Đóng chế độ soi (Esc)" aria-label="Đóng chế độ soi"
      >
        ✕
      </button>
    </div>
  )
}

export function AiUiMarquee(props: ScanModeProps & { left: number; top: number; width: number; height: number }) {
  const { left, top, width, height, mode = 'context' } = props
  return (
    <div className="ai-ui-inspector-marquee" data-ai-scan-mode={mode} style={{ left, top, width, height }}>
      <i className="mq-corner tl" />
      <i className="mq-corner tr" />
      <i className="mq-corner bl" />
      <i className="mq-corner br" />
      <div className="ai-ui-inspector-badge">
        <b>{mode === 'code' ? '</> CODE' : 'UI'}</b> <span>W</span> {Math.round(width)} <span>H</span> {Math.round(height)}
        <span className="ai-ui-inspector-badge-pos">
          · {Math.round(left)},{Math.round(top)}
        </span>
      </div>
    </div>
  )
}

/** Tâm ngắm theo chuột — cập nhật trực tiếp qua ref (không re-render React mỗi lần di chuột). */
export const AiUiCrosshair = forwardRef<HTMLDivElement, ScanModeProps>(function AiUiCrosshair({ mode = 'context' }, ref) {
  return (
    <div ref={ref} className="ai-ui-inspector-crosshair" data-ai-scan-mode={mode} aria-hidden="true">
      <div className="ai-ui-inspector-crosshair-h" />
      <div className="ai-ui-inspector-crosshair-v" />
      <div className="ai-ui-inspector-crosshair-reticle" />
      <div className="ai-ui-inspector-crosshair-coords" />
    </div>
  )
})

function primarySummary(snapshot: AiInspectorSnapshot): { title: string; ref: string | null } {
  const item = snapshot.elements[0]
  if (!item) return { title: '', ref: null }
  const raw = item.text || item.controlDetails?.fieldLabel || item.title || `<${item.tagName}>`
  const title = raw.length > 34 ? `${raw.slice(0, 32)}…` : raw
  const src = item.sourceLocation || item.primaryFile
  const ref = src ? src.replace(/\\/g, '/').split('/').pop() || src : null
  return { title, ref }
}

interface ToastProps {
  snapshot: AiInspectorSnapshot
  copied: boolean
  onHoverChange: (hovering: boolean) => void
  onPreview: () => void
  onClose: () => void
}

export function AiUiScanToast({ snapshot, copied, onHoverChange, onPreview, onClose }: ToastProps) {
  const { title, ref } = primarySummary(snapshot)
  const count = snapshot.elements.length
  return (
    <div
      className="ai-ui-inspector-toast"
      data-mcp-region="ai_inspector_toast"
      role="status"
      aria-live="polite"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="ai-ui-inspector-toast-icon">
        <IconCheck width={16} height={16} />
      </div>
      <div className="ai-ui-inspector-toast-msg">
        <div className="ai-ui-inspector-toast-title">
          {copied ? 'Đã sao chép ngữ cảnh AI' : 'Đã quét xong (chưa sao chép được Clipboard)'}
          <span className="ai-ui-inspector-toast-count">{count} mục tiêu</span>
        </div>
        <div className="ai-ui-inspector-toast-hint">
          {count > 0 ? (
            <>
              <b>FOCUS</b> {title}
              {ref ? <code>{ref}</code> : null}
              <span className="ai-ui-inspector-toast-paste">· Ctrl+V để gửi AI</span>
            </>
          ) : (
            'Không có phần tử tương tác — Ctrl+V vẫn gửi trạng thái Studio cho AI.'
          )}
        </div>
      </div>
      <button
        type="button"
        className="ai-ui-inspector-toast-btn"
        onClick={onPreview}
        title="Mở hộp thoại xem chi tiết trực quan nội dung vừa quét"
      >
        Xem trước
      </button>
      <button type="button" className="ai-ui-inspector-arm-close" onClick={onClose} title="Đóng thông báo">
        ✕
      </button>
      <div className="ai-ui-inspector-toast-progress" />
    </div>
  )
}
