import { useState, useRef, useEffect, useCallback } from 'react'
import type { ImageMeshSlot } from './imageMeshTypes'
import {
  validateImageElement,
  type ImageValidationResult
} from '@renderer/engine/imageMesh/imageContractValidation'

interface ImageAlignmentEditorProps {
  slot: ImageMeshSlot
  imageUrl: string
  onApply: (alignedDataUrl: string) => void
  onClose: () => void
}

export function ImageAlignmentEditor({
  slot,
  imageUrl,
  onApply,
  onClose
}: ImageAlignmentEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [rotation, setRotation] = useState(0) // 0, 90, 180, 270
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [scale, setScale] = useState(1.0)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [fitMode, setFitMode] = useState<'contain' | 'cover' | 'stretch'>('contain')
  const [validation, setValidation] = useState<ImageValidationResult | null>(null)
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null)
  const [anchorUV, setAnchorUV] = useState<[number, number]>(slot.anchorUV ?? [0.5, 0.0])

  // Load image element with generation guard
  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      setImgElement(img)
    }
    img.src = imageUrl
    return () => {
      cancelled = true
    }
  }, [imageUrl])

  // Redraw canvas and run validation
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !imgElement) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    const [wRatio, hRatio] = slot.aspect
    const targetW = 512
    const targetH = Math.round((targetW * hRatio) / wRatio)
    canvas.width = targetW
    canvas.height = targetH

    ctx.clearRect(0, 0, targetW, targetH)

    // Compute transform
    ctx.save()
    ctx.translate(targetW / 2 + offsetX, targetH / 2 + offsetY)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(flipH ? -scale : scale, flipV ? -scale : scale)

    let drawW = imgElement.naturalWidth
    let drawH = imgElement.naturalHeight

    if (fitMode === 'contain') {
      const s = Math.min(targetW / drawW, targetH / drawH)
      drawW *= s
      drawH *= s
    } else if (fitMode === 'cover') {
      const s = Math.max(targetW / drawW, targetH / drawH)
      drawW *= s
      drawH *= s
    } else {
      drawW = targetW
      drawH = targetH
    }

    ctx.drawImage(imgElement, -drawW / 2, -drawH / 2, drawW, drawH)
    ctx.restore()

    // Validate the rendered canvas directly
    const res = validateImageElement(canvas, slot)
    setValidation(res)
  }, [imgElement, slot, rotation, flipH, flipV, scale, offsetX, offsetY, fitMode])

  useEffect(() => {
    redraw()
  }, [redraw])

  const handleApply = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    onApply(dataUrl)
  }

  const handleRotateCW = () => setRotation((r) => (r + 90) % 360)
  const handleRotateCCW = () => setRotation((r) => (r + 270) % 360)
  const handleToggleFlipH = () => setFlipH((v) => !v)
  const handleToggleFlipV = () => setFlipV((v) => !v)
  const handleReset = () => {
    setRotation(0)
    setFlipH(false)
    setFlipV(false)
    setScale(1.0)
    setOffsetX(0)
    setOffsetY(0)
    setFitMode('contain')
    setAnchorUV(slot.anchorUV ?? [0.5, 0.0])
  }

  const [wRatio, hRatio] = slot.aspect
  const previewH = 340
  const previewW = Math.round((previewH * wRatio) / hRatio)

  return (
    <div className="c3d-overlay" style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="c3d-modal" style={{ maxWidth: 840, width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>
            Căn Chỉnh Ảnh · {slot.label} ({wRatio}:{hRatio})
          </h3>
          <button className="btn xs" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {/* Canvas Preview Area with Guides */}
          <div style={{ position: 'relative', width: previewW, height: previewH, background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block'
              }}
            />

            {/* Guide Overlay */}
            <svg
              viewBox={`0 0 ${previewW} ${previewH}`}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            >
              {/* Attachment band */}
              {slot.attachmentBand && (
                <rect
                  x={(slot.attachmentBand.uMin ?? 0) * previewW}
                  y={(1 - slot.attachmentBand.vMax) * previewH}
                  width={((slot.attachmentBand.uMax ?? 1) - (slot.attachmentBand.uMin ?? 0)) * previewW}
                  height={(slot.attachmentBand.vMax - slot.attachmentBand.vMin) * previewH}
                  fill="rgba(239, 68, 68, 0.2)"
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
              )}
              {/* Center line */}
              <line x1={previewW / 2} y1={0} x2={previewW / 2} y2={previewH} stroke="var(--line-focus)" strokeDasharray="3 3" opacity={0.6} />
              {/* Anchor point */}
              <circle cx={anchorUV[0] * previewW} cy={(1 - anchorUV[1]) * previewH} r={6} fill="#f59e0b" stroke="#fff" strokeWidth={2} />
            </svg>
          </div>

          {/* Controls & Diagnostics */}
          <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>XOAY VÀ LẬT</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="btn xs" onClick={handleRotateCCW}>⟲ Xoay trái 90°</button>
                <button type="button" className="btn xs" onClick={handleRotateCW}>⟳ Xoay phải 90°</button>
                <button type="button" className={`btn xs ${flipH ? 'primary' : ''}`} onClick={handleToggleFlipH}>⇄ Lật ngang</button>
                <button type="button" className={`btn xs ${flipV ? 'primary' : ''}`} onClick={handleToggleFlipV}>⇅ Lật dọc</button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>CHẾ ĐỘ KHUNG HÌNH</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className={`btn xs ${fitMode === 'contain' ? 'primary' : ''}`} onClick={() => setFitMode('contain')}>Vừa vặn (Fit)</button>
                <button type="button" className={`btn xs ${fitMode === 'cover' ? 'primary' : ''}`} onClick={() => setFitMode('cover')}>Phủ đầy (Fill)</button>
                <button type="button" className={`btn xs ${fitMode === 'stretch' ? 'primary' : ''}`} onClick={() => setFitMode('stretch')}>Kéo giãn (Stretch)</button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>THU PHÓNG ({Math.round(scale * 100)}%)</div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            {/* Validation Feedback */}
            {validation && (
              <div
                style={{
                  padding: 10,
                  borderRadius: 6,
                  background: validation.status === 'pass' ? 'rgba(16, 185, 129, 0.1)' : validation.status === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${validation.status === 'pass' ? '#10b981' : validation.status === 'warning' ? '#f59e0b' : '#ef4444'}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontWeight: 600, fontSize: 13 }}>
                  <span>{validation.status === 'pass' ? '✓ Ảnh hợp lệ' : validation.status === 'warning' ? '⚠ Cảnh báo' : '✕ Không đạt tiêu chuẩn'}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                    {validation.metrics.width}×{validation.metrics.height}px · Alpha: {Math.round(validation.metrics.alphaCoverageRatio * 100)}%
                  </span>
                </div>

                {validation.errors.map((err: string, i: number) => (
                  <div key={`err-${i}`} style={{ color: '#ef4444', fontSize: 12, marginTop: 2 }}>• {err}</div>
                ))}
                {validation.warnings.map((warn: string, i: number) => (
                  <div key={`warn-${i}`} style={{ color: '#f59e0b', fontSize: 12, marginTop: 2 }}>• {warn}</div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
              <button type="button" className="btn sm" onClick={handleReset}>Đặt lại</button>
              <button
                type="button"
                className="btn sm primary"
                onClick={handleApply}
                disabled={validation?.status === 'fail'}
                style={{ marginLeft: 'auto' }}
              >
                Áp Dụng Căn Chỉnh
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
