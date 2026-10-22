import { useEffect, useRef, useState } from 'react'
import type { Project } from '@shared/types'
import { acquireWorkflowPreviewRenderer, releaseWorkflowPreviewRenderer } from './workflowPreviewRenderer'

/** Paint the dialog first; render only on invalidation, with no idle RAF loop. */
export function useWorkflowCameraPreview(project: Project, time: number, playing: boolean) {
  const mountRef = useRef<HTMLDivElement>(null)
  const latest = useRef({ project, time, playing })
  const invalidateRef = useRef<() => void>(() => {})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    latest.current = { project, time, playing }
    invalidateRef.current()
  }, [project, time, playing])
  useEffect(() => {
    const host = mountRef.current
    if (!host) return
    let frame = 0, timer = 0, lastDraw = 0
    let disposed = false, acquired = false
    let observer: ResizeObserver | undefined
    window.dispatchEvent(new CustomEvent('pxs:workflow-preview-active', { detail: true }))
    const initialize = () => {
      timer = 0
      if (disposed) return
      try {
        const { canvas, renderer } = acquireWorkflowPreviewRenderer()
        acquired = true
        host.appendChild(canvas)
        let width = 0, height = 0
        const draw = () => {
          timer = 0
          if (disposed) return
          const state = latest.current
          const w = Math.max(64, Math.min(720, Math.round(host.clientWidth)))
          const h = Math.max(36, Math.round(w * state.project.comp.height / state.project.comp.width))
          try {
            if (width !== w || height !== h) {
              width = w; height = h
              renderer.setSize(w, h)
              canvas.style.aspectRatio = `${w} / ${h}`
            }
            renderer.render(state.project, state.time, { playing: state.playing, prefetch: false })
            lastDraw = performance.now()
            setLoading(false)
          } catch (cause) { setError(String(cause)); setLoading(false) }
        }
        const invalidate = () => {
          if (!disposed && !timer) timer = window.setTimeout(draw, Math.max(0, 50 - (performance.now() - lastDraw)))
        }
        invalidateRef.current = invalidate
        renderer.onInvalidate = invalidate
        observer = new ResizeObserver(invalidate)
        observer.observe(host)
        void document.fonts.ready.then(() => { if (!disposed) invalidate() })
        invalidate()
      } catch (cause) { setError(String(cause)); setLoading(false) }
    }
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => { timer = window.setTimeout(initialize, 0) })
    })
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      observer?.disconnect()
      invalidateRef.current = () => {}
      if (acquired) releaseWorkflowPreviewRenderer()
      window.dispatchEvent(new CustomEvent('pxs:workflow-preview-active', { detail: false }))
    }
  }, [])
  return { mountRef, error, loading }
}
