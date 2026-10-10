import { useMemo } from 'react'
import type { AssetUsageTarget } from './assetUsage'
import { findAssetUsages } from './assetUsage'
import { IconFilm, IconLayers, IconTrash, IconX } from '../icons'

export interface AssetDeleteConfirmModalProps {
  isOpen?: boolean
  onClose: () => void
  target: AssetUsageTarget | null
  onConfirmDelete: (target: AssetUsageTarget) => void
}

export function AssetDeleteConfirmModal({
  isOpen = true,
  onClose,
  target,
  onConfirmDelete
}: AssetDeleteConfirmModalProps) {
  const report = useMemo(() => {
    if (!target) return null
    return findAssetUsages(target)
  }, [target])

  if (!isOpen || !target || !report) return null

  const hasUsage = report.totalUsages > 0
  const name = target.name || target.fileName || 'Tài nguyên'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xác nhận xóa tài nguyên"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(4px)',
        zIndex: 65000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: '500px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-1)',
          border: hasUsage ? '1px solid #ef4444' : '1px solid var(--line-focus)',
          borderRadius: '10px',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.55)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--line-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: hasUsage ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {hasUsage ? (
              <span style={{ fontSize: '16px' }}>⚠️</span>
            ) : (
              <IconTrash width={16} height={16} style={{ color: 'var(--text-dim)' }} />
            )}
            <span
              style={{
                fontWeight: 600,
                fontSize: '13px',
                color: hasUsage ? '#ef4444' : 'var(--text)'
              }}
            >
              {hasUsage ? 'Cảnh Báo: Tài Nguyên Đang Được Sử Dụng' : 'Xác Nhận Xóa Tài Nguyên'}
            </span>
          </div>
          <button
            type="button"
            className="btn xs icon"
            onClick={onClose}
            title="Đóng"
            style={{ width: '22px', height: '22px' }}
          >
            <IconX width={12} height={12} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {hasUsage ? (
            <>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text)',
                  lineHeight: 1.5,
                  padding: '10px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  borderRadius: '6px',
                  border: '1px solid rgba(239, 68, 68, 0.25)'
                }}
              >
                Ảnh <b>&ldquo;{name}&rdquo;</b> đang được sử dụng tại{' '}
                <strong style={{ color: '#ef4444' }}>{report.totalUsages} vị trí</strong>. Nếu bạn xóa tài nguyên này, các layer/bộ phận tương ứng sẽ bị mất ảnh hiển thị:
              </div>

              {/* Danh sách các vị trí bị ảnh hưởng */}
              <div
                style={{
                  maxHeight: '160px',
                  overflowY: 'auto',
                  border: '1px solid var(--line-soft)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  background: 'var(--bg-0)',
                  fontSize: '11px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                {report.shots.map((s, i) => (
                  <div key={`s-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)' }}>
                    <IconFilm width={11} height={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span><b>{s.shotName}</b> › Layer: &ldquo;{s.layerName}&rdquo;</span>
                  </div>
                ))}
                {report.composites.map((c, i) => (
                  <div key={`c-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)' }}>
                    <IconLayers width={11} height={11} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                    <span><b>{c.compositeName}</b> › Bộ phận: &ldquo;{c.layerName}&rdquo;</span>
                  </div>
                ))}
                {report.models3D.map((m, i) => (
                  <div key={`m-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)' }}>
                    <span style={{ flexShrink: 0 }}>🏛️</span>
                    <span><b>{m.modelName}</b> › Mặt diện: &ldquo;{m.faceName}&rdquo;</span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
                Bạn có chắc chắn muốn tiếp tục xóa không? Hành động này có thể làm trống bộ phận nhân vật hoặc cảnh.
              </div>
            </>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.5 }}>
              Bạn có chắc chắn muốn xóa tài nguyên <b>&ldquo;{name}&rdquo;</b> không?
              <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-dim)' }}>
                ✨ Tài nguyên này chưa được sử dụng ở cảnh hay mẫu nào, có thể xóa an toàn.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--line-soft)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            background: 'var(--bg-2)'
          }}
        >
          <button type="button" className={`btn sm ${hasUsage ? 'primary' : ''}`} onClick={onClose}>
            {hasUsage ? 'Hủy bỏ (Giữ lại)' : 'Hủy'}
          </button>
          <button
            type="button"
            className="btn sm danger"
            onClick={() => {
              onClose()
              onConfirmDelete(target)
            }}
          >
            <IconTrash width={11} height={11} />
            <span>{hasUsage ? 'Vẫn xóa tài nguyên' : 'Xóa tài nguyên'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
