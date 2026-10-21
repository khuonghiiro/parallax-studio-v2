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
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/x-pxs-logic-id', '__SPAWN_SCENE_LAYERS__')
            e.dataTransfer.effectAllowed = 'copy'
          }}
          onClick={onSpawnSceneLayers}
          title="Bấm hoặc kéo thả vào bản vẽ: Bung hoặc cập nhật Node Root Cảnh kèm toàn bộ các Node Layer con (tự động chống trùng lặp)"
        >
          <span className="spawn-ic">🎬</span>
          <span className="spawn-txt">
            <strong>Bung Cảnh & Layer Con</strong>
            <small>
              {shotCount} cảnh · {layerCount} layer (Kéo hoặc Bấm)
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

      {/* 4. Danh sách các Node dạng Thẻ Mô Phỏng Trực Quan để bấm chọn hoặc kéo thả trực tiếp vào Canvas */}
      <div className="wf-palette-list">
        {filteredItems.map((item) => {
          const itemColor = getLogicCategoryColor(item.category)
          const spec = WORKFLOW_NODE_SPECS[item.nodeType]
          const inputs = (spec?.inputs ?? []).map((p) => WORKFLOW_PORT_SPECS[p]?.shortLabel).filter(Boolean)
          const outputs = (spec?.outputs ?? []).map((p) => WORKFLOW_PORT_SPECS[p]?.shortLabel).filter(Boolean)

          return (
            <div
              key={item.id}
              className="wf-palette-item wf-palette-node-card"
              style={{ ['--item-c' as string]: itemColor }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-pxs-logic-id', item.id)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => {
                onAddLogicNode(item.id)
              }}
              title={`${item.title}\n${item.description}\n\n👉 Bấm để thêm hoặc kéo thả vào bất kỳ vị trí nào trên bản vẽ sơ đồ`}
            >
              <div className="wf-palette-node-head">
                <span className="wf-palette-node-ic" style={{ background: itemColor }}>
                  {item.icon}
                </span>
                <div className="wf-palette-node-title-group">
                  <span className="wf-palette-node-title">{item.title}</span>
                  <span className="wf-palette-node-cat" style={{ color: itemColor }}>
                    ● {item.categoryLabel}
                  </span>
                </div>
                <button
                  type="button"
                  className="wf-palette-node-add-btn"
                  title="Thêm ngay vào sơ đồ"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddLogicNode(item.id)
                  }}
                >
                  +
                </button>
              </div>

              {/* Minh họa sơ đồ trực quan của Node */}
              <div className="wf-palette-node-stage">
                {renderSchematicSvg(item.nodeType, item.preset, itemColor, item.id)}
              </div>

              {/* Mô tả chức năng */}
              <div className="wf-palette-node-desc">
                {item.description}
              </div>

              {/* Cổng vào/ra & Nút kéo */}
              <div className="wf-palette-node-footer">
                <div className="wf-palette-node-ports-summary">
                  {inputs.length > 0 ? (
                    <span className="wf-port-sum-in" title={`Nhận: ${inputs.join(', ')}`}>
                      ● {inputs[0]}
                    </span>
                  ) : (
                    <span className="wf-port-sum-in root">🎬 Gốc</span>
                  )}
                  <span className="wf-port-sum-arr">➔</span>
                  {outputs.length > 0 && (
                    <span className="wf-port-sum-out" title={`Xuất: ${outputs.join(', ')}`}>
                      {outputs[0]} ●
                    </span>
                  )}
                </div>

                <div className="wf-palette-drag-pill" title="Nắm kéo vào bản vẽ bất kỳ vị trí nào">
                  <span>⋮⋮ Kéo dùng</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
})
