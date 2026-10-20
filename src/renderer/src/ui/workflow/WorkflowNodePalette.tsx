import React, { useMemo, useState } from 'react'
import {
  WORKFLOW_LOGIC_NODE_CATALOG,
  WORKFLOW_LOGIC_NODE_CATEGORIES,
  type WorkflowLogicNodeCatalogItem,
  type WorkflowLogicNodeCategory
} from '../../project/workflowLogicCatalog'
import { WORKFLOW_NODE_SPECS, WORKFLOW_PORT_SPECS } from '../../project/workflowCatalog'
import { renderSchematicSvg } from './WorkflowNodePreview'

export interface WorkflowNodePaletteProps {
  onAddLogicNode: (logicId: string) => void
  onSpawnSceneLayers: () => void
  shotCount?: number
  layerCount?: number
}

export function getLogicCategoryColor(cat: WorkflowLogicNodeCategory): string {
  switch (cat) {
    case 'camera':
      return '#22c55e'
    case 'audio':
      return '#06b6d4'
    case 'physics':
      return '#10b981'
    case 'light_fx':
      return '#ec4899'
    case 'motion':
      return '#f59e0b'
    case 'scene':
      return '#38bdf8'
    case 'assembly':
      return '#8b5cf6'
    case 'look':
      return '#eab308'
    default:
      return '#38bdf8'
  }
}

export const WorkflowNodePalette: React.FC<WorkflowNodePaletteProps> = React.memo(({
  onAddLogicNode,
  onSpawnSceneLayers,
  shotCount = 1,
  layerCount = 0
}) => {
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState<WorkflowLogicNodeCategory | 'all'>('all')
  const [previewItem, setPreviewItem] = useState<WorkflowLogicNodeCatalogItem>(
    WORKFLOW_LOGIC_NODE_CATALOG[0]
  )

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return WORKFLOW_LOGIC_NODE_CATALOG.filter((item) => {
      if (activeCat !== 'all' && item.category !== activeCat) return false
      if (!q) return true
      return (
        item.title.toLowerCase().includes(q) ||
        item.shortLabel.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q)
      )
    })
  }, [activeCat, search])

  const activePreview = useMemo(() => {
    if (previewItem && filteredItems.some((x) => x.id === previewItem.id)) {
      return previewItem
    }
    return filteredItems[0] ?? WORKFLOW_LOGIC_NODE_CATALOG[0]
  }, [previewItem, filteredItems])

  const previewColor = getLogicCategoryColor(activePreview.category)
  const previewSpec = WORKFLOW_NODE_SPECS[activePreview.nodeType]
  const previewInputs = (previewSpec?.inputs ?? []).map((p) => WORKFLOW_PORT_SPECS[p]).filter(Boolean)
  const previewOutputs = (previewSpec?.outputs ?? []).map((p) => WORKFLOW_PORT_SPECS[p]).filter(Boolean)

  if (collapsed) {
    return (
      <aside
        className="wf-node-palette collapsed"
        data-mcp-region="workflow_palette"
        title="Mở Cột Trái — Thư viện Node Logic & Preview chức năng"
      >
        <button
          type="button"
          className="wf-palette-expand-btn"
          onClick={() => setCollapsed(false)}
          title="Mở rộng Cột Trái: Thư viện Node Logic & Preview"
        >
          <span>▶</span>
          <span className="wf-palette-vertical-text">🧩 THƯ VIỆN NODE LOGIC</span>
        </button>
      </aside>
    )
  }

  return (
    <aside
      className="wf-node-palette"
      data-mcp-region="workflow_palette"
      onWheel={(e) => e.stopPropagation()}
    >
      {/* 1. Thanh tiêu đề Cột Trái */}
      <div className="wf-palette-header">
        <div className="wf-palette-title-wrap">
          <span className="wf-palette-icon">🧩</span>
          <span className="wf-palette-title">Thư viện Node Logic</span>
          <span className="wf-palette-count">{WORKFLOW_LOGIC_NODE_CATALOG.length}</span>
        </div>
        <button
          type="button"
          className="wf-palette-collapse-btn"
          onClick={() => setCollapsed(true)}
          title="Thu gọn Cột Trái để mở rộng sơ đồ"
        >
          ◀
        </button>
      </div>

      {/* 2. Ô tìm kiếm nhanh & Nút Bung Cảnh gốc */}
      <div className="wf-palette-top-controls">
        <div className="wf-palette-search-row">
          <input
            type="text"
            className="wf-palette-search-input"
            placeholder="🔍 Tìm node: lộ trình, gió, đèn, âm thanh..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="wf-palette-search-clear"
              onClick={() => setSearch('')}
              title="Xóa từ khóa tìm kiếm"
            >
              ✕
            </button>
          )}
        </div>

        <button
          type="button"
          className="wf-palette-spawn-scene-btn"
          onClick={onSpawnSceneLayers}
          title="Bung hoặc cập nhật Node Root Cảnh kèm toàn bộ các Node Layer con của cảnh hiện tại (tự động chống trùng lặp)"
        >
          <span className="spawn-ic">🎬</span>
          <span className="spawn-txt">
            <strong>Bung Cảnh & Layer Con</strong>
            <small>
              {shotCount} cảnh · {layerCount} layer
            </small>
          </span>
          <span className="spawn-plus">↻</span>
        </button>
      </div>

      {/* 3. Dải lọc Danh mục Logic (1-Click Pills) */}
      <div className="wf-palette-cat-pills" role="tablist" aria-label="Danh mục Node Logic">
        <button
          type="button"
          className={`wf-palette-cat-pill${activeCat === 'all' ? ' active' : ''}`}
          onClick={() => setActiveCat('all')}
        >
          Tất cả
        </button>
        {WORKFLOW_LOGIC_NODE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`wf-palette-cat-pill${activeCat === cat.id ? ' active' : ''}`}
            style={{ ['--cat-c' as string]: getLogicCategoryColor(cat.id) }}
            onClick={() => setActiveCat(cat.id)}
            title={cat.label}
          >
            {cat.icon} {cat.label.replace(/^[^\s]+\s/, '')}
          </button>
        ))}
      </div>

      {/* 4. Hộp Preview Chức Năng & Cổng Kết Nối (Hiển thị trực quan Node đang chọn/di chuột) */}
      <div
        className="wf-palette-preview-card"
        style={{ ['--prev-c' as string]: previewColor }}
      >
        <div className="wf-palette-preview-head">
          <span className="wf-palette-preview-ic" style={{ background: previewColor }}>
            {activePreview.icon}
          </span>
          <div className="wf-palette-preview-titles">
            <span className="wf-palette-preview-name">{activePreview.title}</span>
            <span className="wf-palette-preview-cat" style={{ color: previewColor }}>
              ● {activePreview.categoryLabel}
            </span>
          </div>
          <button
            type="button"
            className="wf-palette-preview-add-btn"
            onClick={() => onAddLogicNode(activePreview.id)}
            title={`Thêm ngay "${activePreview.title}" vào sơ đồ Workflow`}
          >
            + Thêm
          </button>
        </div>

        {/* Minh họa SVG trực quan cơ chế hoạt động của Node */}
        <div className="wf-palette-preview-stage">
          {renderSchematicSvg(activePreview.nodeType, activePreview.preset, previewColor)}
        </div>

        {/* Mô tả chi tiết chức năng của Node */}
        <p className="wf-palette-preview-desc">{activePreview.description}</p>

        {/* Sơ đồ Cổng Nhận -> Cổng Xuất để dễ hiểu cách nối dây */}
        <div className="wf-palette-preview-ports">
          <div className="wf-palette-port-col">
            <span className="port-col-lbl">Nhận vào:</span>
            <div className="port-col-chips">
              {previewInputs.length === 0 ? (
                <span className="wf-palette-port-chip root">🎬 Gốc khởi nguồn</span>
              ) : (
                previewInputs.map((p) => (
                  <span
                    key={`in-${p.id}`}
                    className="wf-palette-port-chip"
                    style={{ ['--p-c' as string]: p.color }}
                  >
                    ● {p.shortLabel}
                  </span>
                ))
              )}
            </div>
          </div>
          <span className="wf-palette-port-arrow">➔</span>
          <div className="wf-palette-port-col">
            <span className="port-col-lbl">Xuất ra:</span>
            <div className="port-col-chips">
              {previewOutputs.map((p) => (
                <span
                  key={`out-${p.id}`}
                  className="wf-palette-port-chip"
                  style={{ ['--p-c' as string]: p.color }}
                >
                  {p.shortLabel} ●
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Danh sách các Node Logic để bấm chọn hoặc kéo thả vào Canvas */}
      <div className="wf-palette-list">
        {filteredItems.map((item) => {
          const itemColor = getLogicCategoryColor(item.category)
          const isPreviewing = activePreview.id === item.id
          return (
            <div
              key={item.id}
              className={`wf-palette-item${isPreviewing ? ' active' : ''}`}
              style={{ ['--item-c' as string]: itemColor }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-pxs-logic-id', item.id)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onMouseEnter={() => setPreviewItem(item)}
              onClick={() => {
                setPreviewItem(item)
                onAddLogicNode(item.id)
              }}
              title={`${item.title}\n${item.description}\n\n👉 Bấm để thêm vào sơ đồ hoặc kéo thả vào vị trí bất kỳ trên Canvas`}
            >
              <span className="wf-palette-item-ic" style={{ background: itemColor }}>
                {item.icon}
              </span>
              <div className="wf-palette-item-info">
                <div className="wf-palette-item-top">
                  <span className="wf-palette-item-title">{item.title}</span>
                </div>
                <span className="wf-palette-item-sub">{item.description}</span>
              </div>
              <span className="wf-palette-item-plus" title="Bấm để thêm vào sơ đồ">
                +
              </span>
            </div>
          )
        })}
      </div>
    </aside>
  )
})
