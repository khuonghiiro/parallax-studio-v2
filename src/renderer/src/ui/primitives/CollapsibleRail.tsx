import React from 'react'
import { IconSidebarLeftExpand, IconSidebarRightExpand } from '../icons'

export interface RailItem<T extends string = string> {
  id: T
  domId?: string
  label: string
  icon: React.ReactNode
  badge?: number | string
  accent?: 'primary' | 'cyan'
  title?: string
}

export interface CollapsibleRailProps<T extends string = string> {
  side: 'left' | 'right'
  activeId: T | null
  items: ReadonlyArray<RailItem<T>>
  bottomItems?: ReadonlyArray<RailItem<T>>
  expandDomId?: string
  expandTitle: string
  mcpRegion?: string
  tabsMcpRegion?: string
  bottomMcpRegion?: string
  onExpand: () => void
  onSelectItem: (id: T) => void
}

/**
 * Thanh Icon Rail dọc gọn 40px chuẩn Figma UI3 / Linear cho cả Cột Trái và Cột Phải.
 * Khi bấm vào bất kỳ icon tab nào sẽ mở ngay đúng tab đó và tự bung cột ra.
 */
export function CollapsibleRail<T extends string = string>({
  side,
  activeId,
  items,
  bottomItems,
  expandDomId,
  expandTitle,
  mcpRegion,
  tabsMcpRegion,
  bottomMcpRegion,
  onExpand,
  onSelectItem
}: CollapsibleRailProps<T>) {
  const ExpandIcon = side === 'left' ? IconSidebarLeftExpand : IconSidebarRightExpand

  return (
    <aside
      className={`${side} is-collapsed-rail pxs-rail pxs-rail--${side}`}
      {...(mcpRegion ? { 'data-mcp-region': mcpRegion } : {})}
    >
      <div
        className="pxs-rail-inner"
        {...(tabsMcpRegion ? { 'data-mcp-region': tabsMcpRegion } : {})}
      >
        <button
          id={expandDomId}
          type="button"
          className="pxs-rail-expand-btn"
          title={expandTitle}
          aria-label={expandTitle}
          onClick={onExpand}
        >
          <ExpandIcon width={15} height={15} />
        </button>

        <div className="pxs-rail-divider" />

        <div className="pxs-rail-group" role="tablist" aria-orientation="vertical">
          {items.map((item) => {
            const active = activeId === item.id
            return (
              <button
                key={item.id}
                id={item.domId}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={item.label}
                title={item.title ?? `${item.label} — Bấm để mở rộng`}
                className={`pxs-rail-btn${active ? ' active' : ''}${item.accent === 'cyan' ? ' tone-cyan' : ''}`}
                onClick={() => onSelectItem(item.id)}
              >
                <span className="pxs-rail-icon">{item.icon}</span>
                {item.badge !== undefined && Number(item.badge) > 0 && (
                  <span className="pxs-rail-badge">{item.badge}</span>
                )}
              </button>
            )
          })}
        </div>

        {bottomItems && bottomItems.length > 0 && (
          <div
            className="pxs-rail-bottom"
            role="tablist"
            aria-orientation="vertical"
            {...(bottomMcpRegion ? { 'data-mcp-region': bottomMcpRegion } : {})}
          >
            {bottomItems.map((item) => {
              const active = activeId === item.id
              return (
                <button
                  key={item.id}
                  id={item.domId}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={item.label}
                  title={item.title ?? `${item.label} — Bấm để mở rộng`}
                  className={`pxs-rail-btn${active ? ' active' : ''}${item.accent === 'cyan' ? ' tone-cyan' : ''}`}
                  onClick={() => onSelectItem(item.id)}
                >
                  <span className="pxs-rail-icon">{item.icon}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
