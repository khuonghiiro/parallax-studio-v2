import React from 'react'
import type { AssembledLayerItem } from './types'
import { useLayerAssetImage } from './useLayerAssetImage'
import { IconGlobe, IconImage, IconInfo, IconLock, IconPlus, IconTrash } from '../icons'

export interface LayerItemCardProps {
  layer: AssembledLayerItem
  isSelected: boolean
  onSelect: () => void
  onDelete?: (id: string) => void
  onDuplicate?: (id: string) => void
  onDetail?: (layer: AssembledLayerItem) => void
}

/** Card hiển thị Layer trong tab Dự án của Xưởng Lắp Ráp Layer */
export function LayerItemCard({
  layer,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  onDetail
}: LayerItemCardProps) {
  const assetUrl = useLayerAssetImage(layer.assetPath, layer.imageUrl)
  const displayUrl = layer.imageUrl || assetUrl
  const isPublic = Boolean(
    layer.assetPath &&
    (layer.assetPath.startsWith('assembly_3d/') ||
      layer.assetPath.startsWith('demo_transparent/') ||
      layer.assetPath.startsWith('assets/'))
  )

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'layer', layer }))
      }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      style={{
        background: isSelected ? 'color-mix(in srgb, var(--accent) 15%, var(--bg-1))' : 'var(--bg-1)',
        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--line-soft)'}`,
        borderRadius: '4px',
        padding: '5px',
        cursor: 'grab',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
        transition: 'all 0.15s ease'
      }}
      title={`Click để chọn: ${layer.name} (Z: ${layer.z}px)`}
    >
      <div
        style={{
          height: '75px',
          width: '100%',
          minWidth: 0,
          background: 'var(--bg-0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: '3px',
          position: 'relative',
          boxSizing: 'border-box'
        }}
      >
        {/* Badge Public vs Private dạng icon nhỏ gọn ở góc trên trái */}
        <span
          className={`layer-scope-badge ${isPublic ? 'public' : 'private'}`}
          title={isPublic ? 'Tài nguyên Công khai (Public)' : 'Tài nguyên Riêng của mẫu (Private)'}
        >
          {isPublic ? <IconGlobe width={10} height={10} strokeWidth={2.2} /> : <IconLock width={10} height={10} strokeWidth={2.2} />}
        </span>

        {/* Cụm 3 button ở góc phải của layer: Xóa, Chi tiết và (+) Nhân bản layer */}
        <div
          style={{
            position: 'absolute',
            top: '3px',
            right: '3px',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            zIndex: 5
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {onDelete && (
            <button
              type="button"
              className="btn xs icon"
              style={{
                width: '18px',
                height: '18px',
                padding: 0,
                background: 'var(--danger, #ef4444)',
                color: '#fff',
                borderRadius: '3px',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                transition: 'transform 0.1s ease'
              }}
              onClick={(e) => {
                e.stopPropagation()
                onDelete(layer.id)
              }}
              title={`Xóa layer ${layer.name} khỏi mẫu`}
            >
              <IconTrash width={10} height={10} />
            </button>
          )}

          {onDetail && (
            <button
              type="button"
              className="btn xs icon"
              style={{
                width: '18px',
                height: '18px',
                padding: 0,
                background: 'var(--bg-3)',
                color: 'var(--text)',
                borderRadius: '3px',
                border: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                transition: 'transform 0.1s ease'
              }}
              onClick={(e) => {
                e.stopPropagation()
                onDetail(layer)
              }}
              title={`Xem chi tiết layer ${layer.name}`}
            >
              <IconInfo width={10} height={10} />
            </button>
          )}

          {onDuplicate && (
            <button
              type="button"
              className="btn xs icon"
              style={{
                width: '18px',
                height: '18px',
                padding: 0,
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: '3px',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                transition: 'transform 0.1s ease'
              }}
              onClick={(e) => {
                e.stopPropagation()
                onDuplicate(layer.id)
              }}
              title={`Nhân bản layer ${layer.name} (+)`}
            >
              <IconPlus width={10} height={10} />
            </button>
          )}
        </div>

        {displayUrl ? (
          <img
            src={displayUrl}
            alt={layer.name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            draggable={false}
          />
        ) : (
          <IconImage width={20} height={20} style={{ opacity: 0.4 }} />
        )}
        <span
          style={{
            position: 'absolute',
            bottom: '2px',
            right: '3px',
            fontSize: '8.5px',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            padding: '1px 3px',
            borderRadius: '2px'
          }}
        >
          Z:{layer.z}
        </span>
      </div>

      <span
        style={{
          fontSize: '10px',
          color: isSelected ? 'var(--accent)' : 'var(--text)',
          fontWeight: isSelected ? 600 : 400,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'block',
          width: '100%',
          minWidth: 0
        }}
        title={layer.name}
      >
        {layer.name}
      </span>
    </div>
  )
}

export interface AssetCardProps {
  item: { path: string; name: string; isCustom: boolean; previewUrl?: string }
  onAdd: () => void
  onDetail: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
}

/** Card hiển thị Tài nguyên mẫu hoặc Ảnh người dùng thêm vào (Tab Có sẵn) */
export function AssetCard({
  item,
  onAdd,
  onDetail,
  onDelete
}: AssetCardProps) {
  const isDataUrl = item.path?.startsWith('data:')
  const assetUrl = useLayerAssetImage(isDataUrl ? '' : item.path)
  const displayUrl = item.previewUrl || (isDataUrl ? item.path : assetUrl)

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          'application/json',
          JSON.stringify({
            type: 'asset',
            name: item.name,
            path: item.path,
            url: isDataUrl ? item.path : displayUrl || undefined
          })
        )
      }}
      onClick={onAdd}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onAdd()
        }
      }}
      style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--line-soft)',
        borderRadius: '4px',
        padding: '5px',
        cursor: 'grab',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        position: 'relative',
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        transition: 'all 0.15s ease'
      }}
      title={`Click hoặc Kéo thả để thêm ${item.name} làm layer mới`}
    >
      {/* Badge Công khai dạng icon ở góc trên trái (đối xứng với 3 nút góc trên phải) */}
      <span
        className="layer-scope-badge public"
        style={{ position: 'absolute', top: '3px', left: '3px', zIndex: 4 }}
        title={item.isCustom ? 'Ảnh đã thêm vào kho công khai' : 'Tài nguyên mẫu có sẵn (Công khai)'}
      >
        <IconGlobe width={10} height={10} strokeWidth={2.2} />
      </span>

      {/* 3 button ở góc phải của item: Xóa, Chi tiết và (+) Thêm layer */}
      <div
        style={{
          position: 'absolute',
          top: '3px',
          right: '3px',
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          zIndex: 5
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Button Thùng rác Xoá layer (nằm bên trái) */}
        <button
          type="button"
          className="btn xs icon"
          style={{
            width: '18px',
            height: '18px',
            padding: 0,
            background: 'var(--danger, #ef4444)',
            color: '#fff',
            borderRadius: '3px',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            transition: 'transform 0.1s ease, filter 0.1s ease'
          }}
          onClick={(e) => {
            e.stopPropagation()
            onDelete(e)
          }}
          title={`Xóa ${item.name} (kiểm tra cảnh báo nếu đang được dùng)`}
        >
          <IconTrash width={10} height={10} />
        </button>

        {/* Button Chi tiết & nơi sử dụng (ở giữa) */}
        <button
          type="button"
          className="btn xs icon"
          style={{
            width: '18px',
            height: '18px',
            padding: 0,
            background: 'var(--bg-3)',
            color: 'var(--text)',
            borderRadius: '3px',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            transition: 'transform 0.1s ease, filter 0.1s ease'
          }}
          onClick={(e) => {
            e.stopPropagation()
            onDetail(e)
          }}
          title={`Xem chi tiết & danh sách nơi sử dụng ${item.name}`}
        >
          <IconInfo width={10} height={10} />
        </button>

        {/* Button (+) Thêm layer (nằm bên phải) */}
        <button
          type="button"
          className="btn xs icon"
          style={{
            width: '18px',
            height: '18px',
            padding: 0,
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: '3px',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            transition: 'transform 0.1s ease, filter 0.1s ease'
          }}
          onClick={(e) => {
            e.stopPropagation()
            onAdd()
          }}
          title={`Thêm ${item.name} thành layer mới (+)`}
        >
          <IconPlus width={10} height={10} />
        </button>
      </div>

      <div
        style={{
          height: '75px',
          width: '100%',
          minWidth: 0,
          background: 'var(--bg-0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: '3px',
          position: 'relative',
          boxSizing: 'border-box'
        }}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={item.name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            draggable={false}
          />
        ) : (
          <IconImage width={20} height={20} style={{ opacity: 0.4 }} />
        )}
      </div>

      <span
        style={{
          fontSize: '10px',
          color: 'var(--text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'block',
          width: '100%',
          minWidth: 0
        }}
        title={item.name}
      >
        {item.name}
      </span>
    </div>
  )
}
