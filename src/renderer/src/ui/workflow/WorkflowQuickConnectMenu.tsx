import '../../styles/workflowQuickConnect.css'
import React, { useMemo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { WorkflowNode, WorkflowPortKind } from '@shared/types'
import {
  type WorkflowLogicNodeCatalogItem
} from '../../project/workflowLogicCatalog'
import { WORKFLOW_PORT_SPECS } from '../../project/workflowCatalog'

import { getQuickConnectItems } from './workflowQuickConnect'

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
  const listRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [search])

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
    window.addEventListener('resize', onClose)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('resize', onClose)
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
    if (sourcePort === 'layers_tree' && isOutput && sourceNode.type === 'scene_shot' && onSelectSpecialAction) {
      specials.push(
        { id: 'add_image_layer', icon: '🖼️', label: 'Thêm Layer Ảnh 2.5D', desc: 'Chọn ảnh từ máy tính hoặc thư viện làm layer mới' },
        { id: 'add_particles', icon: '✨', label: 'Thêm Lớp Hạt Khí Quyển', desc: 'Tạo lớp đom đóm, bụi sáng hoặc sương mù' },
        { id: 'add_text_layer', icon: '🔤', label: 'Thêm Layer Chữ 2.5D', desc: 'Thêm tiêu đề hoặc phụ đề chữ 3D trong không gian' },
        { id: 'add_ground_layer', icon: '⛰️', label: 'Thêm Mặt Đất 3D', desc: 'Tạo mặt sàn phối cảnh 3D cho cảnh quay' }
      )
    }

    return {
      suggestedItems: getQuickConnectItems(sourceNode, sourcePort, isOutput, q),
      specialActions: specials.filter((s) => !q || `${s.label} ${s.desc}`.toLowerCase().includes(q))
    }
  }, [search, sourceNode, sourcePort, isOutput, onSelectSpecialAction])

  // Điều chỉnh toạ độ menu tránh tràn màn hình
  const menuStyle = useMemo(() => {
    const maxX = window.innerWidth - 372
    const maxY = window.innerHeight - Math.min(480, window.innerHeight - 24) - 12
    return {
      left: Math.max(12, Math.min(x, maxX)),
      top: Math.max(12, Math.min(y, maxY))
    }
  }, [x, y])

  return createPortal(
    <div
      ref={menuRef}
      className="wf-quick-connect-menu"
      style={menuStyle}
      data-mcp-region="workflow_quick_connect"
      data-mcp-dialog
      role="dialog"
      aria-label="Chọn chức năng node"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') { e.preventDefault(); onClose() }
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="wf-quick-menu-header">
        <span className="wf-quick-menu-badge" >
          {isOutput ? 'Nối tiếp từ' : 'Đưa vào'} {portSpec?.shortLabel ?? sourcePort}
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

      <div className="wf-quick-menu-context" title={sourceNode.title}>{sourceNode.title}</div>
      <div className="wf-quick-menu-search-wrap">
        <input
          ref={inputRef}
          type="text"
          className="wf-quick-menu-search-input"
          aria-label="Tìm chức năng tương thích"
          placeholder="Tìm nhanh node kết nối..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div ref={listRef} className="wf-quick-menu-list">
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
            <span className="wf-quick-menu-section-title">Chức năng tương thích · {suggestedItems.length}</span>
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
    </div>,
    document.body
  )
}
