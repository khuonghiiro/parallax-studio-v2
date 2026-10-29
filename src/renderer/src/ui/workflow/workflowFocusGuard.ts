import type { Project } from '@shared/types'
import { useEffect, useState } from 'react'
import { useEditor } from '../../store/editor'

export function canFocusWorkflowNode(current: string | null, target: string, shift: boolean): boolean {
  return !current || current === target || shift
}

export function guardWorkflowNodeEvent(event: { shiftKey: boolean; preventDefault(): void; stopPropagation(): void }, target: string): boolean {
  if (canFocusWorkflowNode(useEditor.getState().selectedWorkflowNodeId, target, event.shiftKey)) return true
  event.preventDefault()
  event.stopPropagation()
  return false
}

/** Inactive overlapping boxes must not intercept the active box until Shift is held. */
export function useShiftToFocus(): boolean {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    const key = (event: KeyboardEvent) => setHeld(event.shiftKey)
    const reset = () => setHeld(false)
    window.addEventListener('keydown', key)
    window.addEventListener('keyup', key)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', key)
      window.removeEventListener('keyup', key)
      window.removeEventListener('blur', reset)
    }
  }, [])
  return held
}

export function canEditViewportTarget(project: Project, current: string | null,
  target: { layerId?: string | null; shotId?: string; camera?: boolean }, shift: boolean): boolean {
  const node = project.workflow?.nodes.find(n => n.id === current)
  if (!node || shift) return true
  if (target.camera) return node.type === 'camera_director'
  if (target.layerId) return Boolean(node.params?.targetLayerIds?.includes(target.layerId) || node.params?.rootLayerId === target.layerId)
  if (target.shotId) return node.id === `v2-root-${target.shotId}` && node.params?.shotId === target.shotId
  return false
}
