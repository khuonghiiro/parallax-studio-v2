import { useCallback, useRef, useState } from 'react'
import type { LayerComposite } from './types'
import { createWorkshopHistory } from './workshopHistory'

export function useWorkshopHistory(initial: () => LayerComposite) {
  const ref = useRef<ReturnType<typeof createWorkshopHistory> | null>(null)
  if (!ref.current) ref.current = createWorkshopHistory(initial())
  const history = ref.current
  const [, render] = useState(0)
  const setComposite = useCallback((update: LayerComposite | ((prev: LayerComposite) => LayerComposite), key = '') => {
    history.update(typeof update === 'function' ? update(history.current) : update, key)
    render((n) => n + 1)
  }, [history])
  return { composite: history.current, setComposite, history,
    undo: () => { history.undo(); render((n) => n + 1) },
    redo: () => { history.redo(); render((n) => n + 1) } }
}
