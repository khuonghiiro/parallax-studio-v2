import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  WORKFLOW_LOGIC_NODE_CATALOG,
  WORKFLOW_LOGIC_NODE_CATEGORIES,
  type WorkflowLogicNodeCategory,
  type WorkflowLogicNodeCatalogItem
} from '../../project/workflowLogicNodes'
import { IconPlus, IconSearch } from '../icons'

export interface WorkflowAddNodeMenuProps {
  onSpawnLogicNode: (logicId: string) => void
  onSpawnSceneLayers?: () => void
}

/**
 * Menu Thêm Node Logic Chuyên Biệt Phong Cách Blender & Adobe Animate.
 * Hỗ trợ phân nhóm theo nghiệp vụ (Camera, Chuyển động, Vật lý, Ánh sáng, Audio...),
 * tìm kiếm tức thì và phím tắt Shift + A trên Canvas.
 */
export const WorkflowAddNodeMenu: React.FC<WorkflowAddNodeMenuProps> = ({
  onSpawnLogicNode,
  onSpawnSceneLayers
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCat, setSelectedCat] = useState<'all' | WorkflowLogicNodeCategory>('all')
  const menuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Đóng khi click ngoài hoặc ấn Escape
  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Lắng nghe phím tắt Shift + A toàn cục khi đang ở màn hình Workflow
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (
        e.shiftKey &&
        (e.key === 'A' || e.key === 'a') &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleGlobalShortcuts)
    return () => window.removeEventListener('keydown', handleGlobalShortcuts)
  }, [])

  // Tự động focus vào ô tìm kiếm khi mở menu
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    } else {
      setSearchQuery('')
    }
  }, [isOpen])

  const filteredItems = useMemo(() => {
    return WORKFLOW_LOGIC_NODE_CATALOG.filter((item) => {
      if (selectedCat !== 'all' && item.category !== selectedCat) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      return (
        item.title.toLowerCase().includes(q) ||
        item.shortLabel.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q)
      )
    })
  }, [selectedCat, searchQuery])

  const handleSelectItem = (item: WorkflowLogicNodeCatalogItem) => {
    if (item.id === 'logic-scene-spawn-layers' && onSpawnSceneLayers) {
      onSpawnSceneLayers()
    } else {
      onSpawnLogicNode(item.id)
    }
    setIsOpen(false)
  }

  return (
    <div className="wf-add-node-wrapper" ref={menuRef}>
      <button
        id="wf-btn-add-node-menu"
        type="button"
        className={`btn ghost sm tl-action-btn wf-quick-add-btn${isOpen ? ' active' : ''}`}
        title="Mở Thư viện Node Logic kiểu Blender (Phím tắt: Shift + A) để thả khối chức năng vào sơ đồ"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <IconPlus width={12} height={12} />
        <span>+ Thêm Node</span>
        <span className="wf-btn-kbd">Shift+A</span>
      </button>

      {isOpen && (
        <div className="wf-add-node-popover" role="dialog" aria-label="Thư viện Node Logic Blender">
          {/* Header & Quick Search */}
          <div className="wf-add-node-header">
            <span className="wf-add-node-title">⚡ Thêm Node Logic (Blender / Animate)</span>
            <div className="wf-add-node-search-box">
              <IconSearch width={13} height={13} className="wf-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                className="wf-add-node-search-input"
                placeholder="Tìm node: gió, nến, camera, thoại, lưới..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="wf-search-clear-btn"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Dải Danh mục Phân loại kiểu Blender */}
          <div className="wf-add-node-cats-bar" role="tablist">
            <button
              type="button"
              className={`wf-cat-pill${selectedCat === 'all' ? ' active' : ''}`}
              onClick={() => setSelectedCat('all')}
            >
              Tất cả ({WORKFLOW_LOGIC_NODE_CATALOG.length})
            </button>
            {WORKFLOW_LOGIC_NODE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`wf-cat-pill${selectedCat === cat.id ? ' active' : ''}`}
                onClick={() => setSelectedCat(cat.id)}
              >
                <span>{cat.icon}</span>
                <span>{cat.label.replace(/^[^\s]+\s*/, '')}</span>
              </button>
            ))}
          </div>

          {/* Danh sách Node dạng Grid thẻ trực quan */}
          <div className="wf-add-node-list">
            {filteredItems.length === 0 ? (
              <div className="wf-add-node-empty">
                Không tìm thấy Node nào khớp với &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="wf-add-node-item-card"
                  onClick={() => handleSelectItem(item)}
                >
                  <span className="wf-add-node-item-icon">{item.icon}</span>
                  <div className="wf-add-node-item-info">
                    <div className="wf-add-node-item-title-row">
                      <span className="wf-add-node-item-title">{item.title}</span>
                      <span className="wf-add-node-item-cat">{item.categoryLabel}</span>
                    </div>
                    <div className="wf-add-node-item-desc">{item.description}</div>
                  </div>
                  <span className="wf-add-node-item-action">+ Thả</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
