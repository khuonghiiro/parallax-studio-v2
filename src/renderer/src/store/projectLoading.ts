import { create } from 'zustand'

export type ProjectLoadPhase = 'parse' | 'assets' | 'workflow' | 'gpu' | 'done'

export interface ProjectLoadProgressPatch {
  title?: string
  phase?: ProjectLoadPhase
  stageLabel?: string
  detailLabel?: string
  loadedCount?: number
  totalCount?: number
  percent?: number
  shotCount?: number
  layerCount?: number
}

export interface ProjectLoadingState {
  active: boolean
  title: string
  phase: ProjectLoadPhase
  stageLabel: string
  detailLabel: string
  loadedCount: number
  totalCount: number
  percent: number
  shotCount: number
  layerCount: number
  startedAt: number
  begin: (title: string, initialStage?: string) => void
  report: (patch: ProjectLoadProgressPatch) => void
  finish: () => void
}

const isTestEnv = (): boolean => {
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, unknown> }).env
    if (metaEnv?.VITEST || metaEnv?.MODE === 'test') return true
  } catch {
    /* ignore */
  }
  try {
    const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }
    if (g.process?.env?.VITEST || g.process?.env?.NODE_ENV === 'test') return true
  } catch {
    /* ignore */
  }
  return false
}

/**
 * Yields back to the browser paint/compositor loop so loading progress bars
 * and animations stay responsive (60fps) instead of freezing the UI window.
 * Instant no-op under Vitest so automated test suites stay fast.
 */
export function yieldToUiFrame(): Promise<void> {
  if (isTestEnv()) return Promise.resolve()
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(resolve, 0)
    })
  })
}

export const useProjectLoading = create<ProjectLoadingState>((set) => ({
  active: false,
  title: '',
  phase: 'parse',
  stageLabel: 'Đang chuẩn bị mở dự án…',
  detailLabel: '',
  loadedCount: 0,
  totalCount: 0,
  percent: 0,
  shotCount: 0,
  layerCount: 0,
  startedAt: 0,

  begin: (title, initialStage = 'Đang phân tích cấu trúc cảnh & kịch bản…') => {
    set({
      active: true,
      title,
      phase: 'parse',
      stageLabel: initialStage,
      detailLabel: '',
      loadedCount: 0,
      totalCount: 0,
      percent: 6,
      shotCount: 0,
      layerCount: 0,
      startedAt: typeof performance !== 'undefined' ? performance.now() : Date.now()
    })
  },

  report: (patch) => {
    set((state) => {
      if (!state.active) return state
      const nextPercent =
        patch.percent !== undefined
          ? Math.max(state.percent, Math.min(100, Math.round(patch.percent)))
          : state.percent
      return {
        ...state,
        ...patch,
        percent: nextPercent
      }
    })
  },

  finish: () => {
    set({
      active: false,
      phase: 'done',
      percent: 100,
      detailLabel: ''
    })
  }
}))

/**
 * Wraps an async project/demo loader with step-by-step UI loading state
 * and guarantees clean teardown even if an error is thrown.
 */
export async function runWithProjectLoading<T>(
  title: string,
  task: (report: (patch: ProjectLoadProgressPatch) => void) => Promise<T>
): Promise<T> {
  const store = useProjectLoading.getState()
  store.begin(title)
  await yieldToUiFrame()
  try {
    const res = await task(store.report)
    store.report({
      phase: 'gpu',
      stageLabel: 'Đang đồng bộ khung cảnh GPU & hoàn tất…',
      percent: 98
    })
    await yieldToUiFrame()
    return res
  } finally {
    useProjectLoading.getState().finish()
  }
}
