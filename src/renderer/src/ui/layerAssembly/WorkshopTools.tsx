import { useState } from 'react'
import type { WorkshopAction } from './workshopActions'
import type { LayerComposite } from './types'

export interface WorkshopToolsProps {
  count: number
  total: number
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  selectAll: () => void
  clear: () => void
  run: (action: WorkshopAction, spacing?: number) => void
  composite: LayerComposite
  setComposite: (update: LayerComposite) => void
  estimate: () => void
}

export function WorkshopTools({
  count,
  total,
  canUndo,
  canRedo,
  undo,
  redo,
  selectAll,
  clear,
  run,
  composite,
  setComposite,
  estimate
}: WorkshopToolsProps) {
  const [spacing, setSpacing] = useState(80)

  const dimension = (key: 'width' | 'height', value: number) => {
    setComposite({
      ...composite,
      [key]: Math.max(200, Math.min(4000, Math.round(value) || 600))
    })
  }

  return (
    <div className="lw-tools" aria-label="Công cụ lắp ráp">
      {/* 1. Lịch sử hoàn tác */}
      <div className="lw-tool-group">
        <button className="btn sm" disabled={!canUndo} onClick={undo} title="Hoàn tác (Ctrl+Z)">
          ↶ Hoàn tác
        </button>
        <button className="btn sm icon" disabled={!canRedo} onClick={redo} title="Làm lại (Ctrl+Shift+Z)">
          ↷
        </button>
      </div>

      {/* 2. Vùng chọn */}
      <div className="lw-tool-group">
        <button className="btn sm" disabled={!total} onClick={selectAll} title="Chọn tất cả các layer (Ctrl+A)">
          Tất cả
        </button>
        {count > 0 && (
          <button className="btn sm" onClick={clear} title="Bỏ chọn (Esc)">
            {count} chọn ×
          </button>
        )}
      </div>

      {/* 3. Căn chỉnh */}
      <div className="lw-tool-group">
        <button className="btn sm" disabled={!count} onClick={() => run('center-x')} title="Căn tâm ngang về X = 0">
          Tâm X
        </button>
        <button className="btn sm" disabled={!count} onClick={() => run('center-y')} title="Căn tâm dọc về Y = 0">
          Tâm Y
        </button>
        <button className="btn sm" disabled={count < 3} onClick={() => run('distribute-x')} title="Chia đều tâm theo trục ngang X (tối thiểu 3 layer)">
          Đều X
        </button>
        <button className="btn sm" disabled={count < 3} onClick={() => run('distribute-y')} title="Chia đều tâm theo trục dọc Y (tối thiểu 3 layer)">
          Đều Y
        </button>
      </div>

      {/* 4. Chiều sâu Z */}
      <div className="lw-tool-group">
        <label title="Khoảng cách pixel giữa các tấm layer khi phân tách Z">
          Bước Z
          <input
            type="number"
            min={1}
            max={2000}
            value={spacing}
            onChange={(e) => setSpacing(Math.max(1, Math.min(2000, Number(e.target.value) || 1)))}
          />
        </label>
        <button className="btn sm" disabled={count < 2} onClick={() => run('depth-forward', spacing)} title="Phân tầng Z: Lớp nền Z dương → Tiền cảnh Z âm">
          Tách Z
        </button>
        <button className="btn sm" disabled={count < 2} onClick={() => run('depth-reverse', spacing)} title="Đảo chiều phân bố Z">
          Đảo Z
        </button>
      </div>

      {/* 5. Khung dựng Canvas */}
      <div className="lw-tool-group">
        <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>Khung:</span>
        <label title="Chiều rộng khung hình">
          W
          <input
            type="number"
            min={200}
            max={4000}
            value={composite.width}
            onChange={(e) => dimension('width', Number(e.target.value))}
          />
        </label>
        <span style={{ color: 'var(--text-faint)' }}>×</span>
        <label title="Chiều cao khung hình">
          H
          <input
            type="number"
            min={200}
            max={4000}
            value={composite.height}
            onChange={(e) => dimension('height', Number(e.target.value))}
          />
        </label>
        <select
          aria-label="Khổ khung mẫu"
          className="input-text sm"
          value=""
          onChange={(e) => {
            const [width, height] = e.target.value.split('x').map(Number)
            setComposite({ ...composite, width, height })
          }}
          style={{ width: '92px' }}
        >
          <option value="" disabled>Khổ mẫu…</option>
          <option value="600x600">600 × 600</option>
          <option value="1920x1080">1920 × 1080</option>
          <option value="1080x1920">1080 × 1920</option>
          <option value="1080x1080">1080 × 1080</option>
        </select>
        <button
          className="btn sm"
          onClick={() => setComposite({
            ...composite,
            width: Math.min(4000, composite.width + 100),
            height: Math.min(4000, composite.height + 100)
          })}
          title="Mở rộng thêm +100px cho cả 2 chiều"
        >
          +100
        </button>
        <button
          className="btn sm"
          disabled={!composite.layers.length}
          onClick={estimate}
          title="Tự động co giãn khung vừa khít kích thước các layer"
        >
          📐 Vừa khít
        </button>
      </div>

      {/* 6. Thao tác hàng loạt */}
      <div className="lw-tool-group" style={{ borderRight: 'none' }}>
        <select
          aria-label="Thao tác với các lớp đã chọn"
          className="input-text sm"
          disabled={!count}
          value=""
          onChange={(e) => run(e.target.value as WorkshopAction)}
          style={{ width: '115px' }}
        >
          <option value="" disabled>Thao tác…</option>
          <option value="duplicate">Nhân bản (Ctrl+D)</option>
          <option value="delete">Xóa (Delete)</option>
          <option value="lock">Khóa layer</option>
          <option value="unlock">Mở khóa layer</option>
          <option value="hide">Ẩn layer</option>
          <option value="show">Hiện layer</option>
          <option value="flatten">Gom phẳng về Z = 0</option>
          <option value="reset-transform">Đặt lại biến đổi</option>
          <option value="stagger">Hoạt ảnh so le pha</option>
          <option value="stop-motion">Tắt hoạt ảnh</option>
        </select>
      </div>
    </div>
  )
}
