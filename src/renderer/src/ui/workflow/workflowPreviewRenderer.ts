import { SceneRenderer } from '../../engine/SceneRenderer'

/** One bounded, short-lived preview context, reused when switching node dialogs. */
let cached: { canvas: HTMLCanvasElement; renderer: SceneRenderer } | undefined
let idleTimer: ReturnType<typeof setTimeout> | undefined

export function acquireWorkflowPreviewRenderer() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = undefined
  if (!cached) {
    const canvas = document.createElement('canvas')
    const renderer = new SceneRenderer(canvas, { budgetMB: 192 })
    renderer.maxTextureSize = 1024
    canvas.setAttribute('aria-label', 'Camera preview')
    cached = { canvas, renderer }
  }
  return cached
}

export function releaseWorkflowPreviewRenderer() {
  if (!cached) return
  cached.renderer.onInvalidate = () => {}
  cached.canvas.remove()
  idleTimer = setTimeout(disposeWorkflowPreviewRenderer, 15_000)
}

function disposeWorkflowPreviewRenderer() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = undefined
  cached?.renderer.dispose()
  cached = undefined
}

if (import.meta.hot) import.meta.hot.dispose(disposeWorkflowPreviewRenderer)
