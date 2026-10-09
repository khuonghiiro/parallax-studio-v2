import type { WorkshopAction } from './workshopActions'
import { IconCopy, IconTrash } from '../icons'

export function WorkshopSelectionPanel({ selectedIds, onSelectLayer, onBatchAction }: {
  selectedIds: string[]; onSelectLayer: (id: string | null) => void; onBatchAction: (action: WorkshopAction) => void
}) {
  return (
<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
                Đang chọn {selectedIds.length} layer
              </span>
              <button
                type="button"
                className="btn xs"
                onClick={() => onSelectLayer(null)}
                style={{ fontSize: '10px' }}
              >
                Bỏ chọn
              </button>
            </div>

            {/* Quick Multi Actions Card */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '10px',
                background: 'var(--bg-1)',
                borderRadius: '6px',
                border: '1px solid var(--line-soft)'
              }}
            >
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-dim)' }}>Căn chỉnh & Phân bố:</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                <button type="button" className="btn xs" onClick={() => onBatchAction('center-x')}>Căn tâm X</button>
                <button type="button" className="btn xs" onClick={() => onBatchAction('center-y')}>Căn tâm Y</button>
                <button type="button" className="btn xs" disabled={selectedIds.length < 3} onClick={() => onBatchAction('distribute-x')}>Chia đều X</button>
                <button type="button" className="btn xs" disabled={selectedIds.length < 3} onClick={() => onBatchAction('distribute-y')}>Chia đều Y</button>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '10px',
                background: 'var(--bg-1)',
                borderRadius: '6px',
                border: '1px solid var(--line-soft)'
              }}
            >
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-dim)' }}>Chiều sâu Z & Hoạt ảnh:</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                <button type="button" className="btn xs" onClick={() => onBatchAction('depth-forward')}>Tách lớp Z</button>
                <button type="button" className="btn xs" onClick={() => onBatchAction('depth-reverse')}>Đảo chiều Z</button>
                <button type="button" className="btn xs" onClick={() => onBatchAction('flatten')}>Gom phẳng Z=0</button>
                <button type="button" className="btn xs" onClick={() => onBatchAction('stagger')}>So le pha 0.35s</button>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '10px',
                background: 'var(--bg-1)',
                borderRadius: '6px',
                border: '1px solid var(--line-soft)'
              }}
            >
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-dim)' }}>Trạng thái hàng loạt:</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                <button type="button" className="btn xs" onClick={() => onBatchAction('lock')}>Khóa tất cả</button>
                <button type="button" className="btn xs" onClick={() => onBatchAction('unlock')}>Mở khóa tất cả</button>
                <button type="button" className="btn xs" onClick={() => onBatchAction('hide')}>Ẩn tất cả</button>
                <button type="button" className="btn xs" onClick={() => onBatchAction('show')}>Hiện tất cả</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                className="btn sm"
                style={{ flex: 1 }}
                onClick={() => onBatchAction('duplicate')}
              >
                <IconCopy width={12} height={12} /> Nhân bản ({selectedIds.length})
              </button>
              <button
                type="button"
                className="btn sm"
                style={{ flex: 1, color: 'var(--danger)' }}
                onClick={() => onBatchAction('delete')}
              >
                <IconTrash width={12} height={12} /> Xóa ({selectedIds.length})
              </button>
            </div>
          </div>
  )
}
