import React from 'react'
import { NAME_W } from './timelineTypes'

export interface TimelineRowProps {
  name: React.ReactNode
  track: React.ReactNode
  sub?: boolean
  selected?: boolean
  onClick?: () => void
  className?: string
}

export function TimelineRow({
  name,
  track,
  sub,
  selected,
  onClick,
  className
}: TimelineRowProps) {
  return (
    <div
      className={`tl-row${sub ? ' sub' : ''}${selected ? ' selected' : ''}${className ? ' ' + className : ''}`}
      onPointerDown={onClick}
    >
      <div
        style={{
          width: NAME_W,
          flex: 'none',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          borderRight: '1px solid var(--line-soft)'
        }}
      >
        {name}
      </div>
      <div style={{ flex: 1, position: 'relative', height: '100%' }}>{track}</div>
    </div>
  )
}
