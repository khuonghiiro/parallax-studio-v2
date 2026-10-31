import React from 'react'

export interface IconActionBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  label?: React.ReactNode
  active?: boolean
  tone?: 'default' | 'primary' | 'cyan' | 'danger'
  size?: 'xs' | 'sm' | 'md'
  /** Hide text label when parent bar is compact, keeping crisp SVG icon + tooltip */
  compactHideLabel?: boolean
  mcpRegion?: string
}

export function IconActionBtn({
  icon,
  label,
  active = false,
  tone = 'default',
  size = 'sm',
  compactHideLabel = false,
  mcpRegion,
  className = '',
  title,
  ...rest
}: IconActionBtnProps) {
  const classes = [
    'pxs-action-btn',
    `pxs-action-btn--${size}`,
    `pxs-action-btn--${tone}`,
    !label ? 'is-icon-only' : '',
    compactHideLabel ? 'is-compact-collapsible' : '',
    active ? 'active' : '',
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      aria-pressed={active || undefined}
      aria-label={rest['aria-label'] ?? (typeof label === 'string' ? label : typeof title === 'string' ? title : undefined)}
      title={title}
      className={classes}
      {...(mcpRegion ? { 'data-mcp-region': mcpRegion } : {})}
      {...rest}
    >
      <span className="pxs-action-icon">{icon}</span>
      {label && <span className="pxs-action-label">{label}</span>}
    </button>
  )
}

export function ToolCluster({
  children,
  className = '',
  mcpRegion,
  ariaLabel
}: {
  children: React.ReactNode
  className?: string
  mcpRegion?: string
  ariaLabel?: string
}) {
  return (
    <div
      role={ariaLabel ? 'group' : undefined}
      aria-label={ariaLabel}
      className={`pxs-tool-cluster ${className}`.trim()}
      {...(mcpRegion ? { 'data-mcp-region': mcpRegion } : {})}
    >
      {children}
    </div>
  )
}
