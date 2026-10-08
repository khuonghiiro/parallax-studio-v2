import type { KeyboardEvent } from 'react'
import type { CreateTemplateItem } from './templateCatalogue'
import { TemplateCardVisual } from './TemplateCardVisual'
import { IconImage, IconPlus, IconSparkles } from '../../icons'

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
  onViewRecipe?: (item: CreateTemplateItem) => void
}

/** Grid card: fixed 4:3 preview, clamped title/hint, recipe slots summary, and dual actions. */
export function TemplateCard({ item, onPick, onViewRecipe }: TemplateCardProps) {
  const recipe = item.assemblyTemplate?.imageRecipe
  const hasRecipe = Boolean(recipe && recipe.slots.length > 0)

  const slotsSummary = hasRecipe && recipe
    ? `Cần ${recipe.slots.length} ảnh: ${recipe.slots.map((s) => `${s.label} (${s.aspect.join(':')})`).join(', ')}`
    : null

  const recipeFullTitle = hasRecipe && recipe
    ? [
        `${item.name} — Cần chuẩn bị ${recipe.slots.length} ảnh PNG tách nền:`,
        ...recipe.slots.map((s, i) => `${i + 1}. [${s.label}] Tỉ lệ ${s.aspect.join(':')} — ${s.guidance || s.prompt}`)
      ].join('\n')
    : undefined

  const handleDirectSelect = () => onPick(item)
  const handleViewRecipe = () => {
    if (onViewRecipe && hasRecipe) {
      onViewRecipe(item)
    } else {
      onPick(item)
    }
  }

  return (
    <div
      className="c3d-card"
      role="button"
      tabIndex={0}
      title={recipeFullTitle || `${item.name} — ${item.subtitle}`}
      onClick={handleViewRecipe}
      onKeyDown={(e) => onCardKey(e, handleViewRecipe)}
    >
      <div className="c3d-card-media">
        <TemplateCardVisual item={item} />
        <span className="c3d-badge">{item.categoryLabel}</span>
        <span className="c3d-faces">{item.facesCount} mặt phẳng</span>
      </div>
      <div className="c3d-card-body">
        <div className="c3d-card-title">{item.name}</div>
        <div className="c3d-card-hint">{item.subtitle}</div>
        {slotsSummary && (
          <div className="c3d-card-recipe-tag" title={recipeFullTitle}>
            <IconImage width={11} height={11} />
            <span>{slotsSummary}</span>
          </div>
        )}
      </div>
      <div className="c3d-card-foot">
        <button
          type="button"
          className="btn xs primary c3d-btn-select"
          tabIndex={-1}
          title="Sử dụng ngay khung mẫu này vào Xưởng 3D"
          onClick={(e) => {
            e.stopPropagation()
            handleDirectSelect()
          }}
        >
          <IconPlus width={12} height={12} />
          <span>Chọn mẫu này</span>
        </button>

        {hasRecipe && onViewRecipe && (
          <button
            type="button"
            className="btn xs c3d-btn-recipe"
            tabIndex={-1}
            title={recipeFullTitle || 'Xem chi tiết ảnh cần chuẩn bị'}
            onClick={(e) => {
              e.stopPropagation()
              handleViewRecipe()
            }}
          >
            <IconSparkles width={11} height={11} />
            <span>Chuẩn bị ảnh</span>
          </button>
        )}
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
