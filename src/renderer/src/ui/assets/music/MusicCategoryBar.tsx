import { useState } from 'react'
import {
  IconActionFx,
  IconAudioLibrary,
  IconCinematicClapper,
  IconFolder,
  IconMusic,
  IconPlus,
  IconVoiceDialogue,
  IconWindAmbience
} from '../../icons'

export type AudioCategoryType = 'all' | 'music' | 'ambient' | 'sfx' | 'voice' | 'cinematic'

export interface AudioCategoryItem {
  id: AudioCategoryType
  title: string
  subtitle: string
  icon: string
  color: string
}

export const AUDIO_CATEGORIES: AudioCategoryItem[] = [
  {
    id: 'all',
    title: 'Tất cả âm thanh',
    subtitle: 'Toàn bộ nhạc nền, âm đệm và hiệu ứng âm thanh',
    icon: 'all',
    color: 'var(--accent)'
  },
  {
    id: 'music',
    title: 'Nhạc nền & Giai điệu',
    subtitle: 'Ca khúc, BGM, giai điệu piano, hợp âm cảm xúc',
    icon: 'music',
    color: '#38bdf8'
  },
  {
    id: 'ambient',
    title: 'Âm đệm & Môi trường',
    subtitle: 'Chuông gió, tiếng gió mưa, sóng biển, đêm tĩnh',
    icon: 'ambient',
    color: '#34d399'
  },
  {
    id: 'sfx',
    title: 'Hiệu ứng & Tiếng động',
    subtitle: 'Súng bắn, cành gãy, bước chân, va chạm, tác động',
    icon: 'sfx',
    color: '#f59e0b'
  },
  {
    id: 'voice',
    title: 'Lời thoại & Lồng tiếng',
    subtitle: 'Giọng đọc, hội thoại nhân vật, podcast, cảm xúc',
    icon: 'voice',
    color: '#ec4899'
  },
  {
    id: 'cinematic',
    title: 'Kịch tính & Chuyển cảnh',
    subtitle: 'Whoosh lướt camera, risers, booms, điểm nhấn phân cảnh',
    icon: 'cinematic',
    color: '#a855f7'
  }
]

interface TooltipInfo {
  category: AudioCategoryItem
  top: number
  right: number
  count: number
}

interface ActionTooltipInfo {
  label: string
  top: number
  right: number
}

interface MusicCategoryBarProps {
  selectedCategory: AudioCategoryType
  onSelectCategory: (cat: AudioCategoryType) => void
  categoryCounts: Record<AudioCategoryType, number>
  onImportClick: () => void
  onOpenFolder?: () => void
}

export function MusicCategoryBar({
  selectedCategory,
  onSelectCategory,
  categoryCounts,
  onImportClick,
  onOpenFolder
}: MusicCategoryBarProps) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)
  const [actionTooltip, setActionTooltip] = useState<ActionTooltipInfo | null>(null)

  const showTooltip = (e: React.MouseEvent<HTMLElement>, cat: AudioCategoryItem) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({
      category: cat,
      top: rect.top + rect.height / 2,
      right: rect.right,
      count: categoryCounts[cat.id] || 0
    })
  }

  const showActionTooltip = (e: React.MouseEvent<HTMLElement>, label: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setActionTooltip({
      label,
      top: rect.top + rect.height / 2,
      right: rect.right
    })
  }

  const hideAllTooltips = () => {
    setTooltip(null)
    setActionTooltip(null)
  }

  const renderIcon = (id: AudioCategoryType) => {
    switch (id) {
      case 'all':
        return <IconAudioLibrary width={16} height={16} />
      case 'music':
        return <IconMusic width={16} height={16} />
      case 'ambient':
        return <IconWindAmbience width={16} height={16} />
      case 'sfx':
        return <IconActionFx width={16} height={16} />
      case 'voice':
        return <IconVoiceDialogue width={16} height={16} />
      case 'cinematic':
        return <IconCinematicClapper width={16} height={16} />
      default:
        return <IconMusic width={16} height={16} />
    }
  }

  return (
    <aside className="asset-vertical-strip music-vertical-strip" aria-label="Thể loại âm thanh">
      <div className="asset-strip-scroll" onScroll={hideAllTooltips}>
        {AUDIO_CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.id
          const count = categoryCounts[cat.id] || 0

          return (
            <div
              key={cat.id}
              className="vertical-tab-wrap"
              onMouseEnter={(e) => showTooltip(e, cat)}
              onMouseLeave={hideAllTooltips}
            >
              <button
                type="button"
                className={`vertical-tab-btn music-cat-tab-btn${isActive ? ' active' : ''}`}
                onClick={() => onSelectCategory(cat.id)}
                aria-label={cat.title}
                style={{
                  color: isActive ? '#ffffff' : undefined,
                  ['--cat-accent' as string]: cat.color
                }}
              >
                {renderIcon(cat.id)}
                {count > 0 && !isActive && (
                  <span className="music-cat-dot-badge" />
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Footer các nút tiện ích nhanh phía dưới thanh dọc */}
      <div className="asset-strip-footer">
        <div className="strip-divider" />

        <div
          className="vertical-tab-wrap"
          onMouseEnter={(e) => showActionTooltip(e, 'Thêm tệp âm thanh từ máy tính')}
          onMouseLeave={hideAllTooltips}
        >
          <button
            type="button"
            className="vertical-tab-btn vertical-action-btn music-add-action-btn"
            onClick={onImportClick}
            aria-label="Thêm audio"
            title="Thêm audio từ máy tính"
          >
            <IconPlus width={15} height={15} />
          </button>
        </div>

        {onOpenFolder && (
          <div
            className="vertical-tab-wrap"
            onMouseEnter={(e) => showActionTooltip(e, 'Mở thư mục assets/audio')}
            onMouseLeave={hideAllTooltips}
          >
            <button
              type="button"
              className="vertical-tab-btn vertical-action-btn action-folder"
              onClick={onOpenFolder}
              aria-label="Mở thư mục âm thanh"
            >
              <IconFolder width={15} height={15} />
            </button>
          </div>
        )}
      </div>

      {/* Tooltip nổi giải thích thể loại */}
      {tooltip && (
        <div
          className="category-tooltip music-category-tooltip"
          style={{
            top: tooltip.top,
            left: tooltip.right + 8
          }}
        >
          <div className="cat-tooltip-header">
            <span className="cat-tooltip-title">{tooltip.category.title}</span>
            <span className="cat-tooltip-count">{tooltip.count}</span>
          </div>
          <div className="cat-tooltip-desc">{tooltip.category.subtitle}</div>
        </div>
      )}

      {/* Tooltip cho action nút phụ */}
      {actionTooltip && (
        <div
          className="category-tooltip music-category-tooltip"
          style={{
            top: actionTooltip.top,
            left: actionTooltip.right + 8
          }}
        >
          <div className="cat-tooltip-title">{actionTooltip.label}</div>
        </div>
      )}
    </aside>
  )
}
