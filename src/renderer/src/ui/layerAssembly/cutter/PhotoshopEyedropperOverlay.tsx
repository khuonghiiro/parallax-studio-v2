import React from 'react'
import type { EyedropperSample, EyedropperTarget } from './types'
import { IconEyedropper } from '../../icons'

export interface PhotoshopEyedropperButtonProps {
  id?: string
  active: boolean
  currentHex: string
  hoveredHex?: string | null
  label?: string
  title?: string
  onToggle: () => void
}

const TARGET_LABELS: Record<EyedropperTarget, string> = {
  key: 'Màu nền cần tách (Chroma Key)',
  fringe: 'Màu viền rác bám (Defringe)',
  smooth: 'Màu làm mịn viền (Edge Smooth)'
}

export function PhotoshopEyedropperButton({
  id,
  active,
  currentHex,
  hoveredHex,
  label = 'Hút màu',
  title,
  onToggle
}: PhotoshopEyedropperButtonProps) {
  const displayHex = (active && hoveredHex ? hoveredHex : currentHex || '#FFFFFF').toUpperCase()
  const normCurrent = (currentHex || '#FFFFFF').toUpperCase()

  return (
    <button
      id={id}
      type="button"
      className={`ps-eyedropper-btn ${active ? 'active' : ''}`}
      onClick={onToggle}
      title={
        title ||
        'Bấm để bật Kính lúp Hút màu kiểu Adobe Photoshop trên ảnh gốc (Nhấn ESC để huỷ)'
      }
    >
      <span className="ps-eyedropper-icon-wrap">
        <IconEyedropper width={12} height={12} />
      </span>

      {/* Vòng đối chiếu màu Mới / Cũ kiểu Adobe Photoshop ngay trên nút */}
      <span
        className="ps-eyedropper-dual-swatch"
        title={`Màu đang chọn: ${displayHex} (Màu trước đó: ${normCurrent})`}
      >
        <span
          className="ps-swatch-half top"
          style={{ backgroundColor: displayHex }}
        />
        <span
          className="ps-swatch-half bottom"
          style={{ backgroundColor: normCurrent }}
        />
      </span>

      <span className="ps-eyedropper-label">
        {active ? 'Đang hút…' : label}
      </span>

      <code className="ps-eyedropper-hex">{displayHex}</code>
    </button>
  )
}

export interface PhotoshopEyedropperOverlayProps {
  target: EyedropperTarget | null
  currentHex: string
  sample: EyedropperSample | null
  onCancel: () => void
}

export function PhotoshopEyedropperOverlay({
  target,
  currentHex,
  sample,
  onCancel
}: PhotoshopEyedropperOverlayProps) {
  if (!target) return null

  const activeHex = (sample?.hex || currentHex || '#FFFFFF').toUpperCase()
  const prevHex = (sample?.prevHex || currentHex || '#FFFFFF').toUpperCase()
  const targetLabel = TARGET_LABELS[target]

  return (
    <>
      {/* Thanh trạng thái nổi phía trên Canvas khi đang bật chế độ Hút màu Photoshop */}
      <div className="ps-eyedropper-banner" role="status">
        <div className="ps-eyedropper-banner-left">
          <span className="ps-eyedropper-pulse-dot" />
          <IconEyedropper width={13} height={13} />
          <strong>Hút màu Photoshop:</strong>
          <span className="ps-eyedropper-target-tag">{targetLabel}</span>
        </div>

        <div className="ps-eyedropper-banner-compare">
          <div className="ps-compare-chip">
            <span className="ps-compare-swatch" style={{ backgroundColor: activeHex }} />
            <span className="ps-compare-meta">
              <small>Mới</small>
              <code>{activeHex}</code>
            </span>
          </div>
          <span className="ps-compare-arrow">⇄</span>
          <div className="ps-compare-chip">
            <span className="ps-compare-swatch" style={{ backgroundColor: prevHex }} />
            <span className="ps-compare-meta">
              <small>Hiện tại</small>
              <code>{prevHex}</code>
            </span>
          </div>
          {sample && (
            <span className="ps-compare-rgb">
              RGB({sample.r}, {sample.g}, {sample.b})
            </span>
          )}
        </div>

        <button
          type="button"
          className="ps-eyedropper-cancel-btn"
          onClick={onCancel}
          title="Thoát chế độ hút màu (Phím tắt: ESC)"
        >
          ✕ Thoát (ESC)
        </button>
      </div>

      {/* Vòng Nhẫn Đối Chiếu Màu & Kính Lúp Pixel 9x9 Đi Theo Chuột Kiểu Adobe Photoshop */}
      {sample && (
        <div
          className="ps-eyedropper-loupe-container"
          style={{
            left: `${sample.canvasX}px`,
            top: `${sample.canvasY}px`
          }}
        >
          {/* Vòng tròn Photoshop Sample Ring + Lưới Pixel 9x9 ở tâm */}
          <div className="ps-loupe-ring-outer">
            <div className="ps-loupe-color-ring">
              <div
                className="ps-loupe-ring-half ps-ring-new"
                style={{ backgroundColor: activeHex }}
              />
              <div
                className="ps-loupe-ring-half ps-ring-old"
                style={{ backgroundColor: prevHex }}
              />

              {/* Lưới phóng đại 9x9 pixel bên trong vòng nhẫn */}
              <div className="ps-loupe-pixel-grid">
                {sample.pixelGrid.map((row, rIdx) =>
                  row.map((cellColor, cIdx) => {
                    const isCenter = rIdx === 4 && cIdx === 4
                    return (
                      <div
                        key={`${rIdx}-${cIdx}`}
                        className={`ps-loupe-pixel-cell ${isCenter ? 'center' : ''}`}
                        style={{
                          backgroundColor:
                            cellColor === 'transparent' ? 'transparent' : cellColor
                        }}
                      />
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Thẻ HUD hiển thị Mã Màu HEX + RGB + So sánh Mới/Cũ bên cạnh Kính lúp */}
          <div className="ps-loupe-readout-card">
            <div className="ps-readout-top">
              <div className="ps-readout-dual-swatch">
                <div
                  className="ps-readout-swatch-new"
                  style={{ backgroundColor: activeHex }}
                  title="Màu mới tại mũi trỏ"
                />
                <div
                  className="ps-readout-swatch-old"
                  style={{ backgroundColor: prevHex }}
                  title="Màu đang dùng trước đó"
                />
              </div>
              <div className="ps-readout-codes">
                <div className="ps-readout-hex">{activeHex}</div>
                <div className="ps-readout-rgb">
                  R:{sample.r} G:{sample.g} B:{sample.b}
                </div>
              </div>
            </div>
            <div className="ps-readout-footer">
              <span>XY ({sample.imgX}, {sample.imgY})</span>
              <span className="ps-readout-click-hint">Nhấp để chọn</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
