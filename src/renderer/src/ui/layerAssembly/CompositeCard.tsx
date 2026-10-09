import { useState, useEffect } from 'react'
import type { AssembledLayerItem, LayerComposite } from './types'
import { captureCompositeThumbnail } from './layerAssemblyThumbnail'
import { IconLayers, IconPlus, IconTrash } from '../icons'

export interface CompositeCardProps {
  item: LayerComposite
  isBuiltin: boolean
  onLoad?: (item: LayerComposite) => void
  onAppend: (layers: AssembledLayerItem[]) => void
  onDelete?: (id: string, e: React.MouseEvent) => void
}

/**
 * Card hiển thị Mẫu Layer xếp chồng kèm ảnh xem trước (Preview Thumbnail)
 * Giúp người dùng nhìn rõ hình thù cụm layer trước khi mở hoặc ghép vào cảnh.
 */
export function CompositeCard({
  item,
  isBuiltin,
  onLoad,
  onAppend,
  onDelete
}: CompositeCardProps) {
  const [thumb, setThumb] = useState<string | undefined>(item.thumbnail)

  useEffect(() => {
    if (item.thumbnail) {
      setThumb(item.thumbnail)
      return
    }
    let active = true
    captureCompositeThumbnail(item, 220)
      .then((url) => {
        if (active && url) {
          setThumb(url)
          item.thumbnail = url
        }
      })
      .catch((err) => {
        console.warn('[CompositeCard] Failed to generate thumbnail:', item.name, err)
      })
    return () => {
      active = false
    }
  }, [item])

  return (
    <div
      style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--line-soft)',
        borderRadius: '6px',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minWidth: 0,
        boxSizing: 'border-box'
      }}
    >
      {/* 1. Header: Tên mẫu & Badge loại mẫu */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0
          }}
          title={item.name}
        >
          {item.name}
        </span>
        <span
          style={{
            fontSize: '9px',
            padding: '1px 5px',
            borderRadius: '3px',
            background: isBuiltin ? 'var(--bg-2)' : 'color-mix(in srgb, var(--accent) 15%, transparent)',
            color: isBuiltin ? 'var(--text-faint)' : 'var(--accent)',
            flexShrink: 0
          }}
        >
          {isBuiltin ? 'Mẫu sẵn' : 'Đã lưu'}
        </span>
      </div>

      {/* 2. Khung ảnh Preview hình thù mẫu layer */}
      <div
        style={{
          height: '115px',
          width: '100%',
          background: 'var(--bg-0)',
          backgroundImage:
            'linear-gradient(45deg, var(--bg-1) 25%, transparent 25%), linear-gradient(-45deg, var(--bg-1) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--bg-1) 75%), linear-gradient(-45deg, transparent 75%, var(--bg-1) 75%)',
          backgroundSize: '12px 12px',
          backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {thumb ? (
          <img
            src={thumb}
            alt={item.name}
            style={{
              maxWidth: '94%',
              maxHeight: '94%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.35))'
            }}
            draggable={false}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--text-faint)',
              fontSize: '10px'
            }}
          >
            <IconLayers width={22} height={22} style={{ opacity: 0.4 }} />
            <span>Nạp ảnh mẫu...</span>
          </div>
        )}

        {/* Badge số lượng lớp góc dưới phải */}
        <span
          style={{
            position: 'absolute',
            bottom: '3px',
            right: '4px',
            fontSize: '8.5px',
            fontWeight: 600,
            background: 'rgba(0, 0, 0, 0.65)',
            color: '#ffffff',
            padding: '1px 5px',
            borderRadius: '2px',
            backdropFilter: 'blur(3px)'
          }}
        >
          {item.layers.length} lớp
        </span>
      </div>

      {/* 3. Footer: Thông số kích thước & Nút hành động Mở / Ghép / Xóa */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: '9.5px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
          {item.width}×{item.height}
        </span>

        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {onLoad && (
            <button
              type="button"
              className="btn xs"
              style={{ padding: '2px 7px', fontSize: '10px' }}
              onClick={() => onLoad(item)}
              title="Mở toàn bộ mẫu này vào xưởng để chỉnh sửa"
            >
              Mở
            </button>
          )}
          <button
            type="button"
            className="btn xs primary"
            style={{ padding: '2px 7px', fontSize: '10px' }}
            onClick={() => onAppend(item.layers)}
            title="Ghép các layer từ mẫu này vào cụm hiện tại"
          >
            <IconPlus width={10} height={10} /> Ghép
          </button>
          {!isBuiltin && onDelete && (
            <button
              type="button"
              className="btn xs icon"
              style={{ width: '20px', height: '20px', padding: 0, color: 'var(--text-faint)' }}
              onClick={(e) => onDelete(item.id, e)}
              title="Xóa mẫu tự tạo này"
            >
              <IconTrash width={11} height={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
