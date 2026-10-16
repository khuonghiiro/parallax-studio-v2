import React from 'react'
import type { CutPiece } from './types'
import { IconCheck } from '../../icons'

export interface SpriteCutterFooterProps {
  selectedPiece: CutPiece | null
  copiedBadge: boolean
  onCopyPiece: () => void
  onTransferToTarget: (piece: CutPiece) => void
}

export function SpriteCutterFooter({
  selectedPiece,
  copiedBadge,
  onCopyPiece,
  onTransferToTarget
}: SpriteCutterFooterProps) {
  return (
    <div className="layer-cutter-footer">
      <div className="layer-cutter-footer-selected">
        {selectedPiece ? (
          <>
            <img
              src={selectedPiece.dataUrl}
              alt={selectedPiece.label}
              className="layer-cutter-piece-mini-thumb"
            />
            <span>
              <strong>Đang chọn:</strong> {selectedPiece.label}{' '}
              <span className="layer-cutter-val-mono">
                ({selectedPiece.width}×{selectedPiece.height}px)
              </span>
            </span>
          </>
        ) : (
          <span style={{ color: 'var(--text-faint)' }}>
            Chọn mảnh bên trên hoặc nhấp đúp trên ảnh để đưa sang Bố cục 2D
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
        <span className="layer-cutter-footer-hint">
          Nhấp đúp mảnh hoặc <kbd>Ctrl+C</kbd> ➔ <kbd>Ctrl+V</kbd>
        </span>
        <button
          id="btn-copy-piece"
          type="button"
          className="btn sm"
          disabled={!selectedPiece}
          onClick={onCopyPiece}
        >
          {copiedBadge ? (
            <>
              <IconCheck width={12} height={12} /> Đã chép!
            </>
          ) : (
            'Sao chép (Ctrl+C)'
          )}
        </button>
        <button
          id="btn-transfer-to-target"
          type="button"
          className="btn sm primary"
          disabled={!selectedPiece}
          onClick={() => selectedPiece && onTransferToTarget(selectedPiece)}
        >
          Đưa vào Bố cục 2D ➡️
        </button>
      </div>
    </div>
  )
}
