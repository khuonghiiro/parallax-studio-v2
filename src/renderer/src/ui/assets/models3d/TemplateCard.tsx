import type { KeyboardEvent } from 'react'
import type { CreateTemplateItem } from './templateCatalogue'
import { TemplateCardVisual } from './TemplateCardVisual'
import { IconPlus, IconSparkles } from '../../icons'

/** Enter / Space on a focused card behaves like a click (cards are div role="button"). */
function onCardKey(e: KeyboardEvent<HTMLDivElement>, action: () => void): void {
  if (e.target !== e.currentTarget) return
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    action()
  }
}

interface TemplateCardProps {
  item: CreateTemplateItem
  onPick: (item: CreateTemplateItem) => void
}

/** Grid card: fixed 4:3 preview, clamped title/hint, action button kept inside the card. */
export function TemplateCard({ item, onPick }: TemplateCardProps) {
  const pick = () => onPick(item)
  return (
    <div
      className="c3d-card"
      role="button"
      tabIndex={0}
      title={`${item.name} — ${item.subtitle}`}
      onClick={pick}
      onKeyDown={(e) => onCardKey(e, pick)}
    >
      <div className="c3d-card-media">
        <TemplateCardVisual item={item} />
        <span className="c3d-badge">{item.categoryLabel}</span>
        <span className="c3d-faces">{item.facesCount} mặt phẳng</span>
      </div>
      <div className="c3d-card-body">
        <div className="c3d-card-title">{item.name}</div>
        <div className="c3d-card-hint">{item.subtitle}</div>
      </div>
      <div className="c3d-card-foot">
        <button
          type="button"
          className="btn xs primary"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation()
            pick()
          }}
        >
          <IconPlus width={12} height={12} />
          <span>{item.assemblyTemplate?.imageRecipe ? 'Xem ảnh cần chuẩn bị' : 'Chọn mẫu này'}</span>
        </button>
      </div>
    </div>
  )
}

/** First card of the unfiltered grid: start from an empty plane. */
export function BlankTemplateCard({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      className="c3d-card blank"
      role="button"
      tabIndex={0}
      title="Khởi tạo mô hình 3D trống từ một mặt phẳng cơ bản"
      onClick={onCreate}
      onKeyDown={(e) => onCardKey(e, onCreate)}
    >
      <div className="c3d-card-media c3d-blank-media">
        <div className="c3d-blank-icon">
          <IconPlus width={24} height={24} />
        </div>
        <div className="c3d-blank-label">
          <IconSparkles width={13} height={13} />
          <span>TỰ TẠO MÔ HÌNH MỚI</span>
        </div>
      </div>
      <div className="c3d-card-body">
        <div className="c3d-card-title">Mô Hình Trống (Custom Blank)</div>
        <div className="c3d-card-hint">
          Bắt đầu từ một mặt phẳng cơ bản. Tự do thêm ảnh, uốn cong, xoay và ghép các mặt trong Xưởng Lắp Ráp.
        </div>
      </div>
      <div className="c3d-card-foot">
        <button
          type="button"
          className="btn xs primary"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation()
            onCreate()
          }}
        >
          <IconPlus width={12} height={12} />
          <span>Bắt đầu tự tạo</span>
        </button>
      </div>
    </div>
  )
}
