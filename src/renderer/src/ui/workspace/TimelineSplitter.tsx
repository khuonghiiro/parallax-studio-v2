import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { clampTimelineHeight, timelineBounds } from './timelineSizing'

export function TimelineSplitter({ onResize }: { onResize: (height: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; height: number } | null>(null)
  const [size, setSize] = useState(0)
  const [bounds, setBounds] = useState(() => timelineBounds(window.innerHeight))

  useEffect(() => {
    const timeline = ref.current?.parentElement?.querySelector('.timeline')
    if (!timeline) return
    const update = () => {
      setSize(Math.round(timeline.getBoundingClientRect().height))
      setBounds(timelineBounds(window.innerHeight))
    }
    const observer = new ResizeObserver(update)
    observer.observe(timeline)
    window.addEventListener('resize', update)
    update()
    return () => { observer.disconnect(); window.removeEventListener('resize', update) }
  }, [])

  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { y: event.clientY, height: size }
  }

  return (
    <div ref={ref} className="splitter" role="separator" tabIndex={0}
      aria-label="Chiều cao timeline" aria-orientation="horizontal"
      aria-valuemin={bounds.min} aria-valuemax={bounds.max}
      aria-valuenow={Math.min(bounds.max, Math.max(bounds.min, size))}
      title="Kéo hoặc dùng phím ↑ ↓ để đổi chiều cao timeline; nhấp đúp để đặt lại"
      onPointerDown={start}
      onPointerMove={(event) => {
        if (drag.current) onResize(clampTimelineHeight(
          drag.current.height + drag.current.y - event.clientY, window.innerHeight))
      }}
      onPointerUp={(event) => {
        drag.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      }}
      onPointerCancel={() => { drag.current = null }}
      onLostPointerCapture={() => { drag.current = null }}
      onDoubleClick={() => onResize(clampTimelineHeight(window.innerHeight * 0.3, window.innerHeight))}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 48 : 16
        const next = event.key === 'ArrowUp' ? size + step : event.key === 'ArrowDown' ? size - step
          : event.key === 'Home' ? bounds.min : event.key === 'End' ? bounds.max : null
        if (next === null) return
        event.preventDefault()
        event.stopPropagation()
        onResize(clampTimelineHeight(next, window.innerHeight))
      }} />
  )
}
