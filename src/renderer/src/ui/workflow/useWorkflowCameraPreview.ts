import { useEffect, useRef, useState } from 'react'
import type { Project } from '@shared/types'
import { SceneRenderer } from '../../engine/SceneRenderer'

/** A private camera renderer: no edits to the editor playhead or playback state. */
export function useWorkflowCameraPreview(project: Project, time: number, playing: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latest = useRef({ project, time, playing })
  const dirty = useRef(true)
  const [error, setError] = useState('')
  useEffect(() => {
    latest.current = { project, time, playing }
    dirty.current = true
  }, [project, time, playing])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let renderer: SceneRenderer
    try { renderer = new SceneRenderer(canvas, { budgetMB: 192 }) }
    catch (cause) { setError(String(cause)); return }
    let frame = 0
    let lastDraw = 0
    let disposed = false
    let width = 0
    let height = 0
    renderer.onInvalidate = () => { dirty.current = true }
    const observer = new ResizeObserver(() => { dirty.current = true })
    observer.observe(canvas)
    const draw = (now: number) => {
      if (disposed) return
      frame = requestAnimationFrame(draw)
      if (!dirty.current || now - lastDraw < 1000 / 30) return
      const state = latest.current
      const nextWidth = Math.max(64, Math.min(960, Math.round(canvas.clientWidth * devicePixelRatio)))
      const nextHeight = Math.max(36, Math.round(nextWidth * state.project.comp.height / state.project.comp.width))
      try {
        if (width !== nextWidth || height !== nextHeight) {
          width = nextWidth; height = nextHeight
          renderer.setSize(width, height)
        }
        dirty.current = false
        renderer.render(state.project, state.time, { playing: state.playing, prefetch: state.playing })
        lastDraw = now
      } catch (cause) {
        setError(String(cause))
        cancelAnimationFrame(frame)
      }
    }
    frame = requestAnimationFrame(draw)
    void document.fonts.ready.then(() => { if (!disposed) dirty.current = true })
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.onInvalidate = () => {}
      renderer.dispose()
    }
  }, [])
  return { canvasRef, error }
}
