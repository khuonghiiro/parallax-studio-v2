import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { WORKFLOW_V2_SPAWN_CATALOG, type WorkflowV2SpawnCategory } from './workflowV2Theme'

const MENU_W = 220
const MENU_H = 7 * 30 + 34

/** Menu gắn nhanh Node Logic khi thả dây từ Layer ra khoảng trống (portal, luôn nằm trong cửa sổ) */
export const WorkflowV2SpawnMenu: React.FC<{
  clientX: number
  clientY: number
  onPick: (category: WorkflowV2SpawnCategory) => void
  onClose: () => void
}> = ({ clientX, clientY, onPick, onClose }) => {
  const ref = useRef<HTMLDivElement>(null)
  const left = Math.max(8, Math.min(window.innerWidth - MENU_W - 8, clientX - 24))
  const top = Math.max(8, Math.min(window.innerHeight - MENU_H - 8, clientY - 16))

  useEffect(() => {
    const onDown = (e: PointerEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className="wf-v2-quick-spawn-menu"
      data-mcp-region="workflow_spawn_menu"
      role="menu"
      style={{ left, top, width: MENU_W }}
    >
      <div className="wf-v2-quick-spawn-title">Gắn Node Logic vào Layer</div>
      {WORKFLOW_V2_SPAWN_CATALOG.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          style={{ ['--wf-v2-accent' as string]: item.accent }}
          onClick={() => onPick(item.id)}
        >
          <span className="wf-v2-spawn-ico" aria-hidden="true">{item.icon}</span>
          <span className="wf-v2-spawn-label">{item.label}</span>
          <small>{item.hint}</small>
        </button>
      ))}
    </div>,
    document.body
  )
}
