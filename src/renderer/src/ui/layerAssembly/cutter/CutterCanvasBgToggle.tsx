import React from 'react'

export type CanvasBgMode =
  | 'checker-dark'
  | 'checker-light'
  | 'solid-dark'
  | 'solid-light'
  | 'checker'
  | 'dark'
  | 'light'

export interface ResolvedCanvasBgState {
  isChecker: boolean
  tone: 'dark' | 'light'
  cssClass: 'bg-checker-dark' | 'bg-checker-light' | 'bg-solid-dark' | 'bg-solid-light'
}

export function resolveCanvasBgState(mode: CanvasBgMode): ResolvedCanvasBgState {
  switch (mode) {
    case 'checker-light':
      return { isChecker: true, tone: 'light', cssClass: 'bg-checker-light' }
    case 'solid-dark':
    case 'dark':
      return { isChecker: false, tone: 'dark', cssClass: 'bg-solid-dark' }
    case 'solid-light':
    case 'light':
      return { isChecker: false, tone: 'light', cssClass: 'bg-solid-light' }
    case 'checker-dark':
    case 'checker':
    default:
      return { isChecker: true, tone: 'dark', cssClass: 'bg-checker-dark' }
  }
}

export interface CutterCanvasBgControlProps {
  value: CanvasBgMode
  onChange: (next: CanvasBgMode) => void
}

export function CutterCanvasBgControl({ value, onChange }: CutterCanvasBgControlProps) {
  const { isChecker, tone } = resolveCanvasBgState(value)

  const handleToggleChecker = () => {
    const nextChecker = !isChecker
    onChange(
      nextChecker
        ? tone === 'light'
          ? 'checker-light'
          : 'checker-dark'
        : tone === 'light'
          ? 'solid-light'
          : 'solid-dark'
    )
  }

  const handleSelectTone = (nextTone: 'dark' | 'light') => {
    onChange(
      isChecker
        ? nextTone === 'light'
          ? 'checker-light'
          : 'checker-dark'
        : nextTone === 'light'
          ? 'solid-light'
          : 'solid-dark'
    )
  }

  return (
    <div
      className="layer-cutter-seg-mini"
      title="Phông nền vùng làm việc: Bật/tắt lưới Caro kết hợp chọn tông Sáng hoặc Tối"
    >
      <span className="seg-label">Nền:</span>
      <button
        type="button"
        className={`seg-btn ${isChecker ? 'active' : ''}`}
        onClick={handleToggleChecker}
        title={
          isChecker
            ? 'Đang bật nền Caro trong suốt (Nhấn để tắt Caro sang nền đơn sắc Trắng/Đen)'
            : 'Đang tắt nền Caro (Nhấn để bật lại lưới Caro Sáng/Tối)'
        }
      >
        Caro
      </button>
      <span className="seg-divider" />
      <button
        type="button"
        className={`seg-btn ${tone === 'dark' ? 'active' : ''}`}
        onClick={() => handleSelectTone('dark')}
        title={isChecker ? 'Nền Caro tối (soi viền sáng/trắng)' : 'Nền đen/tối đơn sắc'}
      >
        Tối
      </button>
      <button
        type="button"
        className={`seg-btn ${tone === 'light' ? 'active' : ''}`}
        onClick={() => handleSelectTone('light')}
        title={isChecker ? 'Nền Caro sáng (soi viền tối/đen)' : 'Nền trắng/sáng đơn sắc'}
      >
        Sáng
      </button>
    </div>
  )
}

export interface CutterZoomControlProps {
  zoomMode: 'fit' | number
  effectiveScale: number
  onStepZoom: (delta: number) => void
  onSetZoomMode: (mode: 'fit' | number) => void
  title?: string
}

export function CutterZoomControl({
  zoomMode,
  effectiveScale,
  onStepZoom,
  onSetZoomMode,
  title = 'Thu phóng khung nhìn (Lăn chuột để zoom theo con trỏ, giữ Space + kéo chuột trái để di chuyển)'
}: CutterZoomControlProps) {
  const pct = Math.max(10, Math.round(effectiveScale * 100))

  return (
    <div className="layer-cutter-zoom-pill" title={title}>
      <button
        type="button"
        className="stepper-btn"
        onClick={() => onStepZoom(-0.15)}
        title="Thu nhỏ (-15%)"
      >
        −
      </button>
      <button
        type="button"
        className={`layer-cutter-zoom-mode-btn ${zoomMode === 'fit' ? 'active' : ''}`}
        onClick={() => onSetZoomMode('fit')}
        title={`Tự động thu phóng vừa khung nhìn (${pct}%)`}
      >
        Vừa ({pct}%)
      </button>
      <button
        type="button"
        className={`layer-cutter-zoom-mode-btn ${zoomMode === 1 ? 'active' : ''}`}
        onClick={() => onSetZoomMode(1)}
        title="Kích thước chuẩn 100%"
      >
        100%
      </button>
      <button
        type="button"
        className="stepper-btn"
        onClick={() => onStepZoom(0.15)}
        title="Phóng to (+15%)"
      >
        +
      </button>
    </div>
  )
}
