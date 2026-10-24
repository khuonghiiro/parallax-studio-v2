import { useLayoutEffect, useState, type RefObject, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** A menu above dock stacking contexts, positioned and clamped to the window. */
export function MenuPortal({ anchor, popup, className, children, close }: {
  anchor: RefObject<HTMLDivElement | null>; popup: RefObject<HTMLDivElement | null>
  className: string; children: ReactNode; close: () => void
}) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  useLayoutEffect(() => {
    const rect = anchor.current?.getBoundingClientRect()
    const menu = popup.current?.getBoundingClientRect()
    if (!rect || !menu) return
    setPosition({
      left: Math.max(8, Math.min(rect.right - menu.width, window.innerWidth - menu.width - 8)),
      top: Math.max(8, rect.bottom + menu.height + 8 <= window.innerHeight ? rect.bottom + 4 : rect.top - menu.height - 4)
    })
    const onScroll = (event: Event) => { if (!(event.target instanceof Node) || !popup.current?.contains(event.target)) close() }
    window.addEventListener('resize', close)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [anchor, popup, close])
  return createPortal(<div ref={popup} role="menu" className={`menu ${className}`}
    style={{ position: 'fixed', zIndex: 50000, top: position?.top ?? 0, left: position?.left ?? 0,
      visibility: position ? 'visible' : 'hidden', maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' }}
    onClick={close}>{children}</div>, document.body)
}
