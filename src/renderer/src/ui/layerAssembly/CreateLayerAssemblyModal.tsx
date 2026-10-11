import { useState, useMemo } from 'react'
import type { LayerComposite } from './types'
import {
  ALL_LAYER_TEMPLATES,
  LAYER_TEMPLATE_CATEGORY_TABS,
  type LayerAssemblyTemplate,
  type LayerTemplateCategory
} from './templates'
import { renderTemplateThumbnail } from './templates/templateIcons'
import { TemplatePromptModal } from './templates/TemplatePromptModal'
import { IconLayers, IconPlus, IconX, IconSparkles } from '../icons'
import '../../styles/layerAssemblyTemplates.css'

interface CreateLayerAssemblyModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (composite: LayerComposite) => void
  onSelectBlank: () => void
}

function matchesFilter(tmpl: LayerAssemblyTemplate, cat: LayerTemplateCategory, q: string): boolean {
  if (cat !== 'all' && tmpl.category !== cat) return false
  if (!q) return true
  const query = q.toLowerCase()
  return (
    tmpl.name.toLowerCase().includes(query) ||
    tmpl.description.toLowerCase().includes(query) ||
    tmpl.nameEn.toLowerCase().includes(query) ||
    tmpl.slots.some((s) => s.name.toLowerCase().includes(query))
  )
}

function TemplateCard({
  template,
  onPick,
  onViewPrompt
}: {
  template: LayerAssemblyTemplate
  onPick: () => void
  onViewPrompt: () => void
}) {
  return (
    <div className="lat-card">
      <div className="lat-card-thumb">
        {renderTemplateThumbnail(template.id, 54)}
        <div className="lat-card-badges">
          <span className="lat-badge-count">{template.slots.length} lớp</span>
          {template.clips.length > 0 && (
            <span className="lat-badge-clips" title={`${template.clips.length} hoạt ảnh chuyển động`}>
              ⚡ {template.clips.length} clips
            </span>
          )}
        </div>
      </div>
      <div className="lat-card-info">
        <div className="lat-card-title">{template.name}</div>
        <div className="lat-card-desc">{template.description}</div>
      </div>
      <div className="lat-card-actions">
        <button
          type="button"
          className="btn xs secondary lat-btn-prompt"
          onClick={onViewPrompt}
          title="Xem prompt tiếng Anh chuẩn để tạo ảnh atlas bằng AI"
        >
          <IconSparkles width={13} height={13} />
          <span>Prompt AI</span>
        </button>
        <button
          type="button"
          className="btn sm primary lat-btn-use"
          onClick={onPick}
          title="Nạp mẫu này vào Xưởng Lắp Ráp Layer"
        >
          Dùng mẫu này
        </button>
      </div>
    </div>
  )
}

export function CreateLayerAssemblyModal({
  isOpen,
  onClose,
  onSelectTemplate,
  onSelectBlank
}: CreateLayerAssemblyModalProps) {
  const [category, setCategory] = useState<LayerTemplateCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [promptTemplate, setPromptTemplate] = useState<LayerAssemblyTemplate | null>(null)

  const filteredTemplates = useMemo(() => {
    return ALL_LAYER_TEMPLATES.filter((t) => matchesFilter(t, category, searchQuery.trim()))
  }, [category, searchQuery])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: ALL_LAYER_TEMPLATES.length }
    for (const tab of LAYER_TEMPLATE_CATEGORY_TABS) {
      if (tab.id !== 'all') {
        counts[tab.id] = ALL_LAYER_TEMPLATES.filter((t) => t.category === tab.id).length
      }
    }
    return counts
  }, [])

  if (!isOpen) return null

  const handlePick = (t: LayerAssemblyTemplate) => {
    const comp = t.buildComposite()
    onSelectTemplate(comp)
    onClose()
  }

  return (
    <div className="lat-overlay" role="dialog" aria-modal="true" aria-label="Tạo lắp ráp layer mới">
      <div className="lat-dialog">
        {/* Header */}
        <div className="lat-header">
          <div className="lat-title-wrap">
            <div className="lat-header-icon">
              <IconLayers width={22} height={22} />
            </div>
            <div>
              <div className="lat-title">Tạo Lắp Ráp Layer Mới</div>
              <div className="lat-subtitle">
                {ALL_LAYER_TEMPLATES.length} mẫu phân tầng nhân vật theo độ tuổi, động vật 4 chân, chim cá & thiên nhiên kèm Prompt AI
              </div>
            </div>
          </div>
          <div className="lat-header-actions">
            <button
              type="button"
              className="btn sm primary"
              onClick={() => {
                onSelectBlank()
                onClose()
              }}
              title="Khởi tạo một cụm layer rỗng để tự ghép ảnh từ đầu"
            >
              <IconPlus width={14} height={14} />
              <span>Tự tạo lắp ráp trống</span>
            </button>
            <button type="button" className="btn sm icon ghost" onClick={onClose} aria-label="Đóng">
              <IconX width={16} height={16} />
            </button>
          </div>
        </div>

        {/* Toolbar: Category Tabs & Search */}
        <div className="lat-toolbar">
          <div className="lat-tabs" role="tablist">
            {LAYER_TEMPLATE_CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={category === tab.id}
                className={`lat-tab${category === tab.id ? ' active' : ''}`}
                onClick={() => setCategory(tab.id)}
              >
                <span>{tab.label}</span>
                <span className="lat-tab-count">{categoryCounts[tab.id] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="lat-search">
            <input
              type="search"
              className="input-text sm"
              placeholder="Tìm kiếm mẫu lắp ráp hoặc bộ phận…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Grid of Templates */}
        <div className="lat-content">
          <div className="lat-grid">
            {filteredTemplates.map((tmpl) => (
              <TemplateCard
                key={tmpl.id}
                template={tmpl}
                onPick={() => handlePick(tmpl)}
                onViewPrompt={() => setPromptTemplate(tmpl)}
              />
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="lat-empty-state">
              <IconLayers width={36} height={36} style={{ opacity: 0.4, marginBottom: 8 }} />
              <div>Không tìm thấy mẫu lắp ráp phù hợp với từ khóa "{searchQuery}".</div>
              <button
                type="button"
                className="btn sm"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setCategory('all')
                  setSearchQuery('')
                }}
              >
                Xem tất cả {ALL_LAYER_TEMPLATES.length} mẫu
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Popover / Modal for AI Prompt & Slot Guide */}
      {promptTemplate && (
        <TemplatePromptModal
          template={promptTemplate}
          onClose={() => setPromptTemplate(null)}
          onUseTemplate={(t) => handlePick(t)}
        />
      )}
    </div>
  )
}
