import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Project, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { getCompatibleLogicCatalogForNode } from '../../project/workflowV2Engine'
import { cleanV2NodeTitle, type WorkflowV2SpawnCategory } from './workflowV2Theme'

const MENU_W = 276

/** Menu gắn nhanh Node Logic ngữ cảnh khi thả dây từ Layer / Khoá Cụm ra khoảng trống */
export const WorkflowV2SpawnMenu: React.FC<{
  clientX: number
  clientY: number
  parentNode?: WorkflowNode
  project?: Project
  onPick: (
    category: WorkflowV2SpawnCategory,
    presetId?: string,
    extraParams?: Partial<WorkflowNodeParams>,
    customTitle?: string
  ) => void
  onClose: () => void
}> = ({ clientX, clientY, parentNode, project, onPick, onClose }) => {
  const ref = useRef<HTMLDivElement>(null)
  const compat = useMemo(() => getCompatibleLogicCatalogForNode(parentNode, project), [parentNode, project])
  const estH = 38 + compat.categories.length * 30
  const [pos, setPos] = useState<{ left: number; top: number }>(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    const initLeft = Math.max(8, Math.min(vw - MENU_W - 8, clientX - 24))
    const preferUp = clientY + estH + 16 > vh
    const rawTop = preferUp ? clientY - estH - 8 : clientY - 12
    const initTop = Math.max(8, Math.min(vh - estH - 8, rawTop))
    return { left: initLeft, top: initTop }
  })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const w = Math.max(MENU_W, Math.ceil(rect.width))
    const h = Math.ceil(rect.height)
    const nextLeft = Math.max(8, Math.min(vw - w - 8, clientX - 24))
    const preferUp = clientY + h + 12 > vh
    const rawTop = preferUp ? clientY - h - 8 : clientY - 12
    const nextTop = Math.max(8, Math.min(vh - h - 8, rawTop))
    setPos({ left: nextLeft, top: nextTop })
  }, [clientX, clientY, compat.categories.length])

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

  const parentLabel =
    compat.parentKind === 'composite_25d'
      ? 'Cụm 2.5D'
      : compat.parentKind === 'model_3d'
        ? 'Khối 3D'
        : 'Layer 2.5D'

  return createPortal(
    <div
      ref={ref}
      className="wf-v2-quick-spawn-menu"
      data-mcp-region="workflow_spawn_menu"
      role="menu"
      style={{ left: pos.left, top: pos.top, width: MENU_W }}
    >
      <div className="wf-v2-quick-spawn-title">
        Gắn Node Logic ({parentLabel}) · {parentNode ? cleanV2NodeTitle(parentNode.title) : parentLabel}
      </div>
      {compat.categories.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          style={{ ['--wf-v2-accent' as string]: item.accent }}
          onClick={() => {
            if (item.id === 'part_swap' && compat.dynamicParts.length > 0) {
              const first = compat.dynamicParts[0]
              onPick(
                'part_swap',
                first.kind === 'slot_variant' ? 'v2:part_swap:expression' : 'v2:part_swap:part_group',
                {
                  partGroupId: first.id,
                  partGroupTitle: first.title,
                  swapMode: first.kind === 'slot_variant' ? 'expression' : 'part_variant',
                  ...(first.kind === 'slot_variant' ? { targetSlotId: first.id.replace(/^slot:/, '') } : {})
                },
                'Bộ phận lắp ráp'
              )
              return
            }
            onPick(item.id)
          }}
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
