import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ construct: vi.fn(), dispose: vi.fn() }))
vi.mock('../../engine/SceneRenderer', () => ({ SceneRenderer: class {
  onInvalidate = () => {}
  maxTextureSize = 8192
  constructor() { state.construct() }
  dispose() { state.dispose() }
} }))
import { acquireWorkflowPreviewRenderer, releaseWorkflowPreviewRenderer } from './workflowPreviewRenderer'

beforeEach(() => {
  vi.useFakeTimers()
  state.construct.mockClear(); state.dispose.mockClear()
  vi.stubGlobal('document', { createElement: () => ({ setAttribute: vi.fn(), remove: vi.fn() }) })
})
afterEach(() => {
  releaseWorkflowPreviewRenderer(); vi.runAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals()
})
describe('workflow preview resource lifetime', () => {
  it('reuses one context while switching node dialogs', () => {
    const first = acquireWorkflowPreviewRenderer()
    expect(first.renderer.maxTextureSize).toBe(1024)
    releaseWorkflowPreviewRenderer()
    vi.advanceTimersByTime(1000)
    expect(acquireWorkflowPreviewRenderer()).toBe(first)
    vi.advanceTimersByTime(16000)
    expect(state.construct).toHaveBeenCalledTimes(1)
    expect(state.dispose).not.toHaveBeenCalled()
  })
  it('disposes GPU resources after the idle timeout', () => {
    acquireWorkflowPreviewRenderer(); releaseWorkflowPreviewRenderer()
    vi.advanceTimersByTime(15000)
    expect(state.dispose).toHaveBeenCalledTimes(1)
    acquireWorkflowPreviewRenderer()
    expect(state.construct).toHaveBeenCalledTimes(2)
  })
})
