import React from 'react'
import type { AssembledLayerItem } from '../types'
import { IconTrash, IconFlipHorizontal, IconPen } from '../../icons'

export interface CutterTargetFooterProps {
  selectedLayer: AssembledLayerItem | null
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  onDeleteLayer: (id: string) => void
}

export function CutterTargetFooter({
  selectedLayer,
  onUpdateLayer,
  onDeleteLayer
}: CutterTargetFooterProps) {
  return (
    <div className="layer-cutter-footer">
      {selectedLayer ? (
        <div className="layer-cutter-footer-controls">
          <div className="layer-cutter-footer-group">
            <div
              className="layer-cutter-part-input-wrap footer-name-wrap"
              title="Nhấp để đổi tên bộ phận đang chọn"
            >
              <IconPen width={11} height={11} className="layer-cutter-part-pen" />
              <input
                type="text"
                className="layer-cutter-part-name-input footer-name-input"
                value={selectedLayer.name}
                onChange={(e) => onUpdateLayer(selectedLayer.id, { name: e.target.value })}
                placeholder="Tên bộ phận..."
              />
            </div>
            <span className="layer-cutter-badge" style={{ fontSize: 9, padding: '1px 5px' }}>
              ({Math.round(selectedLayer.x)}, {Math.round(selectedLayer.y)})
            </span>
          </div>

          {/* Scale control */}
          <div className="layer-cutter-footer-group">
            <span>Thu phóng:</span>
            <button
              type="button"
              className="btn sm icon"
              style={{ width: 18, height: 18, padding: 0 }}
              title="Giảm kích thước (-5%)"
              onClick={() =>
                onUpdateLayer(selectedLayer.id, {
                  scale: Math.max(0.05, Number((selectedLayer.scale - 0.05).toFixed(2)))
                })
              }
            >
              -
            </button>
            <input
              type="range"
              min={0.05}
              max={3.0}
              step={0.01}
              value={selectedLayer.scale}
              onChange={(e) =>
                onUpdateLayer(selectedLayer.id, { scale: Number(e.target.value) })
              }
            />
            <button
              type="button"
              className="btn sm icon"
              style={{ width: 18, height: 18, padding: 0 }}
              title="Tăng kích thước (+5%)"
              onClick={() =>
                onUpdateLayer(selectedLayer.id, {
                  scale: Math.min(4.0, Number((selectedLayer.scale + 0.05).toFixed(2)))
                })
              }
            >
              +
            </button>
            <button
              type="button"
              className="layer-cutter-footer-mini-btn"
              title="Đặt lại tỉ lệ chuẩn 100%"
              onClick={() => onUpdateLayer(selectedLayer.id, { scale: 1 })}
            >
              {Math.round(selectedLayer.scale * 100)}%
            </button>
          </div>

          {/* Rotation control */}
          <div className="layer-cutter-footer-group">
            <span>Xoay:</span>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={selectedLayer.rotation}
              onChange={(e) =>
                onUpdateLayer(selectedLayer.id, { rotation: Number(e.target.value) })
              }
            />
            <button
              type="button"
              className="layer-cutter-footer-mini-btn"
              title="Đặt lại góc xoay 0°"
              onClick={() => onUpdateLayer(selectedLayer.id, { rotation: 0 })}
            >
              {selectedLayer.rotation}°
            </button>
          </div>

          {/* Z-Depth (Layer Stacking) control */}
          <div
            className="layer-cutter-footer-group"
            title="Chiều sâu Z: Z càng nhỏ (âm) càng nổi lên phía trước camera, Z càng lớn (dương) càng lùi ra sau. Nhấn phím '-' / '+' để thay đổi"
          >
            <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>Z:</span>
            <button
              type="button"
              className="btn sm icon"
              style={{ width: 18, height: 18, padding: 0 }}
              title="Đưa nổi lên trước (Z - 1, phím '-')"
              onClick={() => {
                const cur = selectedLayer.z ?? 0
                onUpdateLayer(selectedLayer.id, { z: cur - 1 })
              }}
            >
              -
            </button>
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: 700,
                color: 'var(--accent-cyan)',
                minWidth: 20,
                textAlign: 'center'
              }}
            >
              {selectedLayer.z ?? 0}
            </span>
            <button
              type="button"
              className="btn sm icon"
              style={{ width: 18, height: 18, padding: 0 }}
              title="Đưa chìm ra sau (Z + 1, phím '+')"
              onClick={() => {
                const cur = selectedLayer.z ?? 0
                onUpdateLayer(selectedLayer.id, { z: cur + 1 })
              }}
            >
              +
            </button>
          </div>

          {/* Flip Horizontal */}
          <button
            type="button"
            className={`btn sm ${(selectedLayer.scaleX ?? 1) < 0 ? 'primary' : ''}`}
            style={{ height: 22, padding: '0 8px', fontSize: 10 }}
            title="Lật ảnh nằm ngang (Flip Horizontal)"
            onClick={() =>
              onUpdateLayer(selectedLayer.id, {
                scaleX: (selectedLayer.scaleX ?? 1) * -1
              })
            }
          >
            <IconFlipHorizontal width={12} height={12} /> Lật ngang
          </button>

          {/* Center button */}
          <button
            type="button"
            className="btn sm"
            style={{ height: 22, padding: '0 8px', fontSize: 10 }}
            title="Đặt bộ phận về ngay chính giữa (0, 0)"
            onClick={() => onUpdateLayer(selectedLayer.id, { x: 0, y: 0 })}
          >
            ⊙ Về giữa
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-faint)' }}>
          <span>💡 Click chọn lớp để chỉnh sửa hoặc kéo khung Bbox · Kéo từ trái sang hoặc</span>
          <kbd
            style={{
              background: 'var(--bg-3)',
              padding: '1px 5px',
              borderRadius: 3,
              border: '1px solid var(--line)',
              color: 'var(--text)',
              fontSize: 10
            }}
          >
            Ctrl+V
          </kbd>
          <span>để dán tại chuột</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
        {selectedLayer && (
          <button
            type="button"
            className="btn sm lc-danger-btn"
            onClick={() => onDeleteLayer(selectedLayer.id)}
            title="Xóa bộ phận đang chọn khỏi bảng bố cục"
          >
            <IconTrash width={12} height={12} />
            <span>Xóa</span>
          </button>
        )}
      </div>
    </div>
  )
}
