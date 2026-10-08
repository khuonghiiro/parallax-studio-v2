import { useState, useMemo } from 'react'
import type { Model3D } from './types'
import {
  ALL_CREATE_TEMPLATES,
  CATEGORY_TABS,
  buildBlankModel,
  type CreateCategory,
  type CreateTemplateItem
} from './templateCatalogue'
import { TemplateCardVisual } from './TemplateCardVisual'
import { IconCube, IconPlus, IconSparkles } from '../../icons'

interface Create3DModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (model: Model3D) => void
}

export function Create3DModal({ isOpen, onClose, onSelectTemplate }: Create3DModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<CreateCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const handlePick = (tmpl: CreateTemplateItem) => {
    const model = tmpl.buildModel()
    onSelectTemplate(model)
    onClose()
  }

  const handleCreateBlank = () => {
    const blank = buildBlankModel()
    onSelectTemplate(blank)
    onClose()
  }

  // Filter templates by selected category tab and search query
  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return ALL_CREATE_TEMPLATES.filter((t) => {
      const matchCat = selectedCategory === 'all' || t.category === selectedCategory
      const matchSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.subtitle.toLowerCase().includes(q) ||
        t.categoryLabel.toLowerCase().includes(q)
      return matchCat && matchSearch
    })
  }, [selectedCategory, searchQuery])

  // Count items per category tab
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: ALL_CREATE_TEMPLATES.length }
    CATEGORY_TABS.forEach((tab) => {
      if (tab.id !== 'all') {
        counts[tab.id] = ALL_CREATE_TEMPLATES.filter((t) => t.category === tab.id).length
      }
    })
    return counts
  }, [])

  if (!isOpen) return null

  // Blank card only on the unfiltered view; the header button is always available.
  const showBlankCard = selectedCategory === 'all' && !searchQuery.trim()

  return (
    <div className="assembly-modal-overlay" onClick={onClose}>
      <div
        className="create-3d-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '95%',
          maxWidth: '920px',
          maxHeight: '88vh',
          background: 'var(--bg-2)',
          border: '1px solid var(--line)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-popup)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header with Title on Left, Custom Blank Button & Close on Right */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--line-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-3)',
            gap: '12px',
            flexShrink: 0
          }}
        >
          {/* Left Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'var(--accent)',
                color: 'var(--on-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <IconCube width={20} height={20} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>
                Tạo Mô Hình 3D Mới
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
                Chọn 1 trong {ALL_CREATE_TEMPLATES.length} khung mẫu (khung nhà + bộ phận trang trí tách rời) hoặc tự tạo mô hình trống
              </div>
            </div>
          </div>

          {/* Right Action: Button "+ Tự tạo mô hình trống" & Close Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn sm primary"
              onClick={handleCreateBlank}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontWeight: 600,
                fontSize: '12px',
                borderRadius: '6px',
                boxShadow: 'var(--shadow-popup)',
                whiteSpace: 'nowrap'
              }}
              title="Khởi tạo ngay mô hình 3D trống từ mặt phẳng cơ bản"
            >
              <IconPlus width={14} height={14} />
              <span>+ Tự tạo mô hình trống</span>
            </button>

            <button
              type="button"
              className="btn xs ghost"
              onClick={onClose}
              title="Đóng dialog"
              style={{ fontSize: '14px', padding: '4px 8px' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Toolbar: Category Tabs & Search Bar */}
        <div
          style={{
            padding: '10px 20px',
            background: 'var(--bg-2)',
            borderBottom: '1px solid var(--line-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            flexShrink: 0
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              overflowX: 'auto',
              maxWidth: '100%',
              paddingBottom: '2px'
            }}
          >
            {CATEGORY_TABS.map((tab) => {
              const active = selectedCategory === tab.id
              const count = categoryCounts[tab.id] ?? 0
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategory(tab.id)}
                  style={{
                    padding: '5px 11px',
                    fontSize: '12px',
                    fontWeight: active ? 600 : 500,
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: active ? 'var(--accent)' : 'var(--line-soft)',
                    background: active ? 'var(--accent)' : 'var(--bg-3)',
                    color: active ? 'var(--on-accent)' : 'var(--text-dim)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 5px',
                      borderRadius: '10px',
                      background: active ? 'color-mix(in srgb, var(--on-accent) 22%, transparent)' : 'var(--bg-1)',
                      color: active ? 'var(--on-accent)' : 'var(--text-faint)'
                    }}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Search Box */}
          <div style={{ minWidth: '220px', flex: '1 1 220px', maxWidth: '320px' }}>
            <input
              type="search"
              className="input-text sm"
              placeholder="Tìm kiếm khung mẫu 3D…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', fontSize: '12px' }}
            />
          </div>
        </div>

        {/* Scrollable Templates Grid */}
        <div
          style={{
            padding: '16px 20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(265px, 1fr))',
            gap: '14px',
            overflowY: 'auto',
            flex: 1
          }}
        >
          {/* First Card: Quick "Tự tạo mô hình trống" Blank Canvas Card */}
          {showBlankCard && (
            <div
              className="template-card-blank"
              onClick={handleCreateBlank}
              style={{
                background: 'var(--bg-1)',
                border: '2px dashed var(--accent)',
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.15s ease',
                position: 'relative'
              }}
            >
              {/* Graphic area */}
              <div
                style={{
                  height: '140px',
                  background: 'radial-gradient(circle at center, color-mix(in srgb, var(--accent-cyan) 10%, transparent) 0%, transparent 70%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderBottom: '1px dashed var(--line)'
                }}
              >
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: 'var(--bg-3)',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <IconPlus width={24} height={24} />
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <IconSparkles width={13} height={13} />
                  <span>TỰ TẠO MÔ HÌNH MỚI</span>
                </div>
              </div>

              {/* Meta */}
              <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)' }}>
                  Mô Hình Trống (Custom Blank)
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                  Bắt đầu từ một mặt phẳng cơ bản. Tự do thêm ảnh, uốn cong, xoay và ghép các mặt theo ý muốn trong Xưởng Lắp Ráp.
                </div>
              </div>

              {/* Action Button */}
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--bg-3)',
                  borderTop: '1px solid var(--line-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end'
                }}
              >
                <button
                  type="button"
                  className="btn xs primary"
                  style={{ gap: '4px', width: '100%', justifyContent: 'center' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCreateBlank()
                  }}
                >
                  <IconPlus width={12} height={12} />
                  <span>Bắt đầu tự tạo</span>
                </button>
              </div>
            </div>
          )}

          {/* Template Cards */}
          {filteredTemplates.map((t) => (
            <div
              key={t.id}
              className="template-card"
              onClick={() => handlePick(t)}
              style={{
                background: 'var(--bg-1)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.15s ease'
              }}
            >
              {/* Picture Area */}
              <div
                style={{
                  height: '140px',
                  background: 'var(--bg-0)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderBottom: '1px solid var(--line-soft)'
                }}
              >
                <TemplateCardVisual item={t} />

                {/* Badge Category */}
                <span
                  style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    background: 'var(--accent-cyan)',
                    color: 'var(--on-cyan)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    textTransform: 'uppercase'
                  }}
                >
                  {t.categoryLabel}
                </span>

                {/* Badge Face Count */}
                <span
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    fontSize: '10.5px',
                    background: 'var(--hud-bg)',
                    color: 'var(--text)',
                    border: '1px solid var(--hud-border)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backdropFilter: 'blur(4px)'
                  }}
                >
                  {t.facesCount} mặt phẳng
                </span>
              </div>

              {/* Meta */}
              <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                  {t.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.35 }}>
                  {t.subtitle}
                </div>
              </div>

              {/* Action Button */}
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--bg-3)',
                  borderTop: '1px solid var(--line-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end'
                }}
              >
                <button
                  type="button"
                  className="btn xs primary"
                  style={{ gap: '4px' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePick(t)
                  }}
                >
                  <IconPlus width={12} height={12} />
                  <span>Chọn mẫu này</span>
                </button>
              </div>
            </div>
          ))}

          {/* Empty search fallback */}
          {filteredTemplates.length === 0 && (
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '40px 20px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <div style={{ fontSize: '14px', color: 'var(--text-dim)' }}>
                Không tìm thấy khung mẫu nào phù hợp với từ khóa &quot;{searchQuery}&quot;
              </div>
              <button type="button" className="btn sm primary" onClick={handleCreateBlank}>
                <IconPlus width={13} height={13} />
                <span>+ Tự tạo mô hình trống ngay</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
