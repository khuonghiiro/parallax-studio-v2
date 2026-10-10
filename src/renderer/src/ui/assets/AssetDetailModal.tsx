import { useMemo } from 'react'
import type { AssetUsageTarget } from './assetUsage'
import { findAssetUsages } from './assetUsage'
import { IconFilm, IconGlobe, IconInfo, IconLayers, IconLock, IconTrash, IconX } from '../icons'

export interface AssetDetailModalProps {
  isOpen?: boolean
  onClose: () => void
  target: AssetUsageTarget | null
  onDelete?: (target: AssetUsageTarget) => void
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function AssetDetailModal({ isOpen = true, onClose, target, onDelete }: AssetDetailModalProps) {
  const report = useMemo(() => {
    if (!target) return null
    return findAssetUsages(target)
  }, [target])

  if (!isOpen || !target || !report) return null

  const isPublic = target.scope === 'public' || Boolean(target.relativePath) || target.id?.startsWith('asset3ds:')
  const previewSrc = target.previewUrl || (target.path?.startsWith('data:') ? target.path : undefined)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chi tiết tài nguyên & Vị trí sử dụng"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 60000,
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
          width: '560px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--line-focus)',
          borderRadius: '10px',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.45)',
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
            background: 'var(--bg-2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconInfo width={16} height={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>
              Chi tiết tài nguyên & Vị trí sử dụng
            </span>
          </div>
          <button
            type="button"
            className="btn xs icon"
            onClick={onClose}
            title="Đóng hộp thoại"
            style={{ width: '22px', height: '22px' }}
          >
            <IconX width={12} height={12} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Card thông tin cơ bản: Preview + Metadata */}
          <div
            style={{
              display: 'flex',
              gap: '14px',
              padding: '12px',
              background: 'var(--bg-0)',
              borderRadius: '8px',
              border: '1px solid var(--line-soft)'
            }}
          >
            {/* Khung ảnh preview */}
            <div
              style={{
                width: '100px',
                height: '100px',
                flexShrink: 0,
                borderRadius: '6px',
                border: '1px solid var(--line)',
                background: 'var(--bg-2)',
                backgroundImage:
                  'linear-gradient(45deg, var(--bg-1) 25%, transparent 25%), linear-gradient(-45deg, var(--bg-1) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--bg-1) 75%), linear-gradient(-45deg, transparent 75%, var(--bg-1) 75%)',
                backgroundSize: '10px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}
            >
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt={target.name || 'Preview'}
                  style={{ maxWidth: '94%', maxHeight: '94%', objectFit: 'contain' }}
                />
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>Không có ảnh</span>
              )}
            </div>

            {/* Thông số kỹ thuật */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <strong
                  style={{
                    fontSize: '13px',
                    color: 'var(--text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  title={target.name}
                >
                  {target.name || target.fileName || 'Không tên'}
                </strong>
                {isPublic ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '9.5px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                      color: 'var(--accent)',
                      border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
                      fontWeight: 600,
                      flexShrink: 0
                    }}
                    title="Tài nguyên công khai (Public) dùng chung cho mọi dự án và xưởng"
                  >
                    <IconGlobe width={10} height={10} /> Công khai
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '9.5px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'color-mix(in srgb, var(--key) 15%, transparent)',
                      color: 'var(--key)',
                      border: '1px solid color-mix(in srgb, var(--key) 30%, transparent)',
                      fontWeight: 600,
                      flexShrink: 0
                    }}
                    title="Tài nguyên nội bộ riêng (Private) chỉ thuộc dự án hiện tại"
                  >
                    <IconLock width={10} height={10} /> Dự án
                  </span>
                )}
              </div>

              {target.fileName && (
                <span style={{ fontSize: '10.5px', color: 'var(--text-dim)', wordBreak: 'break-all' }}>
                  Tệp: <b>{target.fileName}</b>
                </span>
              )}

              {target.relativePath && (
                <span style={{ fontSize: '10px', color: 'var(--text-faint)', wordBreak: 'break-all' }}>
                  Đường dẫn: <code>assets/{target.relativePath}</code>
                </span>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '2px', fontSize: '10px', color: 'var(--text-faint)' }}>
                <span>Loại: <b>{target.kind === 'audio' ? 'Âm thanh' : 'Hình ảnh 2.5D'}</b></span>
                {Boolean(target.path && !target.relativePath) && <span>Nguồn: <b>Tự thêm từ máy</b></span>}
              </div>
            </div>
          </div>

          {/* Danh sách các vị trí đang sử dụng */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
                Vị trí đang sử dụng
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: '3px',
                  background: report.totalUsages > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                  color: report.totalUsages > 0 ? '#ef4444' : '#22c55e',
                  border: report.totalUsages > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)'
                }}
              >
                {report.totalUsages > 0 ? `Đang dùng tại ${report.totalUsages} nơi` : 'Chưa sử dụng (An toàn)'}
              </span>
            </div>

            {report.totalUsages === 0 ? (
              <div
                style={{
                  padding: '12px',
                  background: 'color-mix(in srgb, var(--bg-0) 80%, transparent)',
                  borderRadius: '6px',
                  border: '1px dashed var(--line)',
                  fontSize: '11px',
                  color: 'var(--text-dim)',
                  lineHeight: 1.5,
                  textAlign: 'center'
                }}
              >
                ✨ Tài nguyên này hiện chưa gắn vào bất kỳ cảnh nào trong dự án, mẫu lắp ráp layer hay mô hình 3D nào.
                <br />
                <span style={{ color: 'var(--text-faint)', fontSize: '10px' }}>
                  Bạn có thể xoá an toàn mà không ảnh hưởng tới bất kỳ cảnh hay bộ phận nào.
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* 1. Cảnh trong dự án */}
                {report.shots.length > 0 && (
                  <div
                    style={{
                      background: 'var(--bg-0)',
                      border: '1px solid var(--line-soft)',
                      borderRadius: '6px',
                      padding: '8px 10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: 'var(--accent)' }}>
                      <IconFilm width={12} height={12} />
                      <span>Cảnh trong dự án ({report.shots.length})</span>
                    </div>
                    <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: '10.5px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                      {report.shots.map((s, i) => (
                        <li key={i}>
                          <b>{s.shotName}</b> › Layer: <span style={{ color: 'var(--text)' }}>&ldquo;{s.layerName}&rdquo;</span>{' '}
                          <span style={{ fontSize: '9px', opacity: 0.7 }}>({s.layerType})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 2. Xưởng lắp ráp layer */}
                {report.composites.length > 0 && (
                  <div
                    style={{
                      background: 'var(--bg-0)',
                      border: '1px solid var(--line-soft)',
                      borderRadius: '6px',
                      padding: '8px 10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                      <IconLayers width={12} height={12} />
                      <span>Mẫu Xưởng Lắp Ráp Layer ({report.composites.length})</span>
                    </div>
                    <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: '10.5px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                      {report.composites.map((c, i) => (
                        <li key={i}>
                          <b>{c.compositeName}</b> › Bộ phận: <span style={{ color: 'var(--text)' }}>&ldquo;{c.layerName}&rdquo;</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 3. Mô hình 3D */}
                {report.models3D.length > 0 && (
                  <div
                    style={{
                      background: 'var(--bg-0)',
                      border: '1px solid var(--line-soft)',
                      borderRadius: '6px',
                      padding: '8px 10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: 'var(--key)' }}>
                      <span>🏛️</span>
                      <span>Mô hình 3D ({report.models3D.length})</span>
                    </div>
                    <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: '10.5px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                      {report.models3D.map((m, i) => (
                        <li key={i}>
                          <b>{m.modelName}</b> › Mặt diện: <span style={{ color: 'var(--text)' }}>&ldquo;{m.faceName}&rdquo;</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--line-soft)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-2)'
          }}
        >
          {onDelete ? (
            <button
              type="button"
              className="btn sm danger"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              onClick={() => {
                onClose()
                onDelete(target)
              }}
            >
              <IconTrash width={12} height={12} />
              <span>Xóa tài nguyên này</span>
            </button>
          ) : (
            <div />
          )}

          <button type="button" className="btn sm primary" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
