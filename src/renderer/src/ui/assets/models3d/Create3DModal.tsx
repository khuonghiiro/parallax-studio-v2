import { useState, useMemo } from 'react'
import type { Model3D } from './types'
import {
  ALL_CREATE_TEMPLATES,
  CATEGORY_TABS,
  buildBlankModel,
  type CreateCategory,
  type CreateTemplateItem
} from './templateCatalogue'
import { BlankTemplateCard, TemplateCard } from './TemplateCard'
import { IconCube, IconPlus } from '../../icons'
import { ImageMeshTemplateDetail } from './ImageMeshTemplateDetail'
import type { AssemblyTemplate } from './assemblyTemplateKit'

interface Create3DModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (model: Model3D) => void
}

function matchesQuery(t: CreateTemplateItem, q: string): boolean {
  if (!q) return true
  return (
    t.name.toLowerCase().includes(q) ||
    t.subtitle.toLowerCase().includes(q) ||
    t.categoryLabel.toLowerCase().includes(q)
  )
}

const CATEGORY_COUNTS: Record<string, number> = (() => {
  const counts: Record<string, number> = { all: ALL_CREATE_TEMPLATES.length }
  for (const tab of CATEGORY_TABS) {
    if (tab.id !== 'all') counts[tab.id] = ALL_CREATE_TEMPLATES.filter((t) => t.category === tab.id).length
  }
  return counts
})()

interface ToolbarProps {
  category: CreateCategory
  onCategory: (c: CreateCategory) => void
  query: string
  onQuery: (q: string) => void
}

function Create3DToolbar({ category, onCategory, query, onQuery }: ToolbarProps) {
  return (
    <div className="c3d-toolbar">
      <div className="c3d-tabs" role="tablist">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={category === tab.id}
            className={`c3d-tab${category === tab.id ? ' active' : ''}`}
            onClick={() => onCategory(tab.id)}
          >
            <span>{tab.label}</span>
            <span className="c3d-tab-count">{CATEGORY_COUNTS[tab.id] ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="c3d-search">
        <input
          type="search"
          className="input-text sm"
          placeholder="Tìm kiếm khung mẫu 3D…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>
    </div>
  )
}

function Create3DHeader({ onBlank, onClose }: { onBlank: () => void; onClose: () => void }) {
  return <div className="c3d-header">
    <div className="c3d-title-wrap">
      <div className="c3d-title-icon"><IconCube width={20} height={20} /></div>
      <div style={{ minWidth: 0 }}>
        <div className="c3d-title">Tạo Mô Hình 3D Mới</div>
        <div className="c3d-subtitle">{ALL_CREATE_TEMPLATES.length} mẫu · Mesh ảnh 2D thành 3D, khung nhà và bộ phận trang trí</div>
      </div>
    </div>
    <div className="c3d-actions">
      <button type="button" className="btn sm primary" onClick={onBlank} title="Khởi tạo mô hình trống">
        <IconPlus width={14} height={14} /><span>Tự tạo mô hình trống</span>
      </button>
      <button type="button" className="btn xs ghost" onClick={onClose} title="Đóng dialog">✕</button>
    </div>
  </div>
}

export function Create3DModal({ isOpen, onClose, onSelectTemplate }: Create3DModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<CreateCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [recipe, setRecipe] = useState<AssemblyTemplate | null>(null)

  const handlePickDirect = (tmpl: CreateTemplateItem) => {
    onSelectTemplate(tmpl.buildModel())
    onClose()
  }

  const handleViewRecipe = (tmpl: CreateTemplateItem) => {
    if (tmpl.assemblyTemplate?.imageRecipe) {
      setRecipe(tmpl.assemblyTemplate)
      return
    }
    handlePickDirect(tmpl)
  }

  const handleCreateBlank = () => {
    onSelectTemplate(buildBlankModel())
    onClose()
  }

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return ALL_CREATE_TEMPLATES.filter(
      (t) => (selectedCategory === 'all' || t.category === selectedCategory) && matchesQuery(t, q)
    )
  }, [selectedCategory, searchQuery])

  if (!isOpen) return null

  // Blank card only on the unfiltered view; the header button is always available.
  const showBlankCard = selectedCategory === 'all' && !searchQuery.trim()

  return (
    <div className="assembly-modal-overlay" onClick={onClose}>
      <div className="c3d-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Tạo mô hình 3D mới">
        <Create3DHeader onBlank={handleCreateBlank} onClose={onClose} />

        {recipe ? <ImageMeshTemplateDetail key={recipe.id} template={recipe} onBack={() => setRecipe(null)}
          onCreate={(model) => { onSelectTemplate(model); setRecipe(null); onClose() }} /> : <><Create3DToolbar
          category={selectedCategory}
          onCategory={setSelectedCategory}
          query={searchQuery}
          onQuery={setSearchQuery}
        />

        <div className="c3d-scroll">
          <div className="c3d-grid">
            {showBlankCard && <BlankTemplateCard onCreate={handleCreateBlank} />}
            {filteredTemplates.map((t) => (
              <TemplateCard
                key={t.id}
                item={t}
                onPick={handlePickDirect}
                onViewRecipe={handleViewRecipe}
              />
            ))}
            {filteredTemplates.length === 0 && (
              <div className="c3d-empty">
                <div>Không tìm thấy khung mẫu nào phù hợp với từ khóa &quot;{searchQuery}&quot;</div>
                <button type="button" className="btn sm primary" onClick={handleCreateBlank}>
                  <IconPlus width={13} height={13} />
                  <span>Tự tạo mô hình trống ngay</span>
                </button>
              </div>
            )}
          </div>
        </div>
        </>}
      </div>
    </div>
  )
}
