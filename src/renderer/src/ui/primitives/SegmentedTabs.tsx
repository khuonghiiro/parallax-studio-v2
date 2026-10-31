import React from 'react'

export interface SegmentedTabItem<T extends string = string> {
  id: T
  domId?: string
  label: React.ReactNode
  icon?: React.ReactNode
  badge?: React.ReactNode
  badgeTone?: 'neutral' | 'accent' | 'cyan'
  title?: string
  className?: string
  disabled?: boolean
}

export interface SegmentedTabsProps<T extends string = string> {
  items: ReadonlyArray<SegmentedTabItem<T>>
  value: T | null
  onChange: (id: T) => void
  /**
   * - `underline`: Panel header tab strip with bottom active bar (LeftPanel, Inspector top tabs)
   * - `segmented`: Recessed track pill switcher (AssetPanel subtabs, Timeline/Workflow switcher)
   * - `docked`: Bordered action tabs (Inspector bottom Node/JSON bar)
   */
  variant?: 'underline' | 'segmented' | 'docked'
  size?: 'sm' | 'md'
  /** Automatically hides inactive tab text when sidebar container becomes narrow (< 275px), keeping active tab label + all icons visible. */
  adaptiveCompact?: boolean
  dockBottom?: boolean
  ariaLabel?: string
  mcpRegion?: string
  className?: string
  tabClassName?: string
  trailing?: React.ReactNode
}

export function SegmentedTabs<T extends string = string>({
  items,
  value,
  onChange,
  variant = 'underline',
  size = 'md',
  adaptiveCompact = false,
  dockBottom = false,
  ariaLabel,
  mcpRegion,
  className = '',
  tabClassName = '',
  trailing
}: SegmentedTabsProps<T>) {
  const rootClasses = [
    'pxs-tabs',
    `pxs-tabs--${variant}`,
    `pxs-tabs--${size}`,
    variant === 'underline' ? 'tabs' : '',
    adaptiveCompact ? 'pxs-tabs--adaptive' : '',
    dockBottom ? 'pxs-tabs--dock-bottom' : '',
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={rootClasses}
      role="tablist"
      aria-label={ariaLabel}
      {...(mcpRegion ? { 'data-mcp-region': mcpRegion } : {})}
    >
      <div className="pxs-tabs-track">
        {items.map((item) => {
          const active = value === item.id
          const btnClasses = [
            'pxs-tab',
            variant === 'underline' ? 'tab' : '',
            active ? 'active' : '',
            tabClassName,
            item.className ?? ''
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              key={item.id}
              id={item.domId}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={item.disabled}
              title={item.title}
              className={btnClasses}
              onClick={() => onChange(item.id)}
            >
              {item.icon && <span className="pxs-tab-icon">{item.icon}</span>}
              <span className="pxs-tab-label">{item.label}</span>
              {item.badge !== undefined && item.badge !== null && item.badge !== false && (
                <span
                  className={`pxs-tab-badge tab-count${item.badgeTone ? ` tone-${item.badgeTone}` : ''}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {trailing && <div className="pxs-tabs-trailing">{trailing}</div>}
    </div>
  )
}
