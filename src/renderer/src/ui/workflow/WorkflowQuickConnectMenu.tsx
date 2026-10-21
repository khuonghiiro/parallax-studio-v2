import React, { useMemo, useState, useEffect, useRef } from 'react'
import type { WorkflowNode, WorkflowPortKind } from '@shared/types'
import {
  WORKFLOW_LOGIC_NODE_CATALOG,
  type WorkflowLogicNodeCatalogItem
} from '../../project/workflowLogicCatalog'
import { WORKFLOW_PORT_SPECS } from '../../project/workflowCatalog'

export interface WorkflowQuickConnectMenuProps {
  x: number
  y: number
  sourceNode: WorkflowNode
  sourcePort: WorkflowPortKind
  isOutput: boolean
  onSelectLogicItem: (item: WorkflowLogicNodeCatalogItem) => void
  onSelectSpecialAction?: (actionId: string, label: string) => void
  onClose: () => void
}

/**
 * Menu gợi ý ngữ cảnh thông minh khi kéo dây từ cổng ra khoảng trống (Release-to-Spawn).
 * Tự động lọc các Node Logic tương thích với cổng nguồn, hỗ trợ tìm kiếm nhanh và phím tắt ESC.
 */
export const WorkflowQuickConnectMenu: React.FC<WorkflowQuickConnectMenuProps> = ({
  x,
  y,
  sourceNode,
  sourcePort,
  isOutput,
  onSelectLogicItem,
  onSelectSpecialAction,
  onClose
}) => {
  const [search, setSearch] = useState('')
  const menuRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Focus ô tìm kiếm ngay khi menu mở
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Đóng khi click ra ngoài hoặc bấm Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [onClose])

  const portSpec = WORKFLOW_PORT_SPECS[sourcePort]

  // Lọc danh sách Node tương thích theo Cổng nguồn
  const { suggestedItems, specialActions } = useMemo(() => {
    const q = search.trim().toLowerCase()

    // 1. Kiểm tra các hành động đặc biệt cho cổng Phân cấp Scene
    const specials: { id: string; icon: string; label: string; desc: string }[] = []
    if (sourcePort === 'layers_tree') {
      specials.push(
        { id: 'add_image_layer', icon: '🖼️', label: 'Thêm Layer Ảnh 2.5D', desc: 'Chọn ảnh từ máy tính hoặc thư viện làm layer mới' },
        { id: 'add_particles', icon: '✨', label: 'Thêm Lớp Hạt Khí Quyển', desc: 'Tạo lớp đom đóm, bụi sáng hoặc sương mù' },
        { id: 'add_text_layer', icon: '🔤', label: 'Thêm Layer Chữ 2.5D', desc: 'Thêm tiêu đề hoặc phụ đề chữ 3D trong không gian' },
        { id: 'add_ground_layer', icon: '⛰️', label: 'Thêm Mặt Đất 3D', desc: 'Tạo mặt sàn phối cảnh 3D cho cảnh quay' }
      )
    }

    if (q) {
      const filteredLogics = WORKFLOW_LOGIC_NODE_CATALOG.filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          it.description.toLowerCase().includes(q) ||
          it.shortLabel.toLowerCase().includes(q)
      )
      const filteredSpecials = specials.filter(
        (s) => s.label.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q)
      )
      return { suggestedItems: filteredLogics, specialActions: filteredSpecials }
    }

    // Lọc theo ngữ nghĩa cổng
    let filtered: WorkflowLogicNodeCatalogItem[] = []
    if (sourcePort === 'motion_stream') {
      filtered = WORKFLOW_LOGIC_NODE_CATALOG.filter((it) => it.category === 'motion')
    } else if (sourcePort === 'vfx_stage') {
      filtered = WORKFLOW_LOGIC_NODE_CATALOG.filter(
        (it) => it.category === 'physics' || it.category === 'light_fx'
      )
    } else if (sourcePort === 'scene_ctx') {
      filtered = WORKFLOW_LOGIC_NODE_CATALOG.filter(
        (it) => it.category === 'camera' || it.category === 'audio'
      )
    } else if (sourcePort === 'actors_rig') {
      filtered = WORKFLOW_LOGIC_NODE_CATALOG.filter(
        (it) => it.category === 'assembly' || it.category === 'motion'
      )
    } else {
      filtered = WORKFLOW_LOGIC_NODE_CATALOG.slice(0, 8)
    }

    return { suggestedItems: filtered, specialActions: specials }
  }, [search, sourcePort])

  // Điều chỉnh toạ độ menu tránh tràn màn hình
  const menuStyle = useMemo(() => {
    const maxX = window.innerWidth - 300
    const maxY = window.innerHeight - 380
    return {
      left: Math.max(12, Math.min(x, maxX)),
      top: Math.max(12, Math.min(y, maxY))
    }
  }, [x, y])

  return (
    <div
      ref={menuRef}
      className="wf-quick-connect-menu"
      style={menuStyle}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="wf-quick-menu-header">
        <span className="wf-quick-menu-badge" style={{ color: portSpec?.color ?? '#38bdf8' }}>
          {isOutput ? '📤 Nối tiếp từ:' : '📥 Đưa vào:'} {portSpec?.shortLabel ?? sourcePort}
        </span>
        <button
          type="button"
          className="wf-quick-menu-close"
          onClick={onClose}
          title="Đóng menu (Esc)"
        >
          ✕
        </button>
      </div>

      <div className="wf-quick-menu-search-wrap">
        <input
          ref={inputRef}
          type="text"
          className="wf-quick-menu-search-input"
          placeholder="Tìm nhanh node kết nối..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="wf-quick-menu-list">
        {specialActions.length > 0 && (
          <div className="wf-quick-menu-section">
            <span className="wf-quick-menu-section-title">Hành động Phân cảnh:</span>
            {specialActions.map((s) => (
              <button
                key={s.id}
                type="button"
                className="wf-quick-menu-item special"
                onClick={() => {
                  onSelectSpecialAction?.(s.id, s.label)
                  onClose()
                }}
              >
                <span className="wf-quick-item-icon">{s.icon}</span>
                <div className="wf-quick-item-text">
                  <span className="wf-quick-item-title">{s.label}</span>
                  <span className="wf-quick-item-desc">{s.desc}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {suggestedItems.length > 0 ? (
          <div className="wf-quick-menu-section">
            <span className="wf-quick-menu-section-title">Khối Chức Năng Tương Thích:</span>
            {suggestedItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="wf-quick-menu-item"
                onClick={() => {
                  onSelectLogicItem(item)
                  onClose()
                }}
                title={item.description}
              >
                <span className="wf-quick-item-icon">{item.icon}</span>
                <div className="wf-quick-item-text">
                  <span className="wf-quick-item-title">{item.title}</span>
                  <span className="wf-quick-item-desc">{item.description}</span>
                </div>
              </button>
            ))}
          </div>
        ) : specialActions.length === 0 ? (
          <div className="wf-quick-menu-empty">
            <span>Không tìm thấy khối phù hợp</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
