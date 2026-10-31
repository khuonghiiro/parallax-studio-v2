import type { Project } from '@shared/types'
import { computeShotRoute, getShotTimeRange } from './workflowV2Scope'

export interface PlaybackRange {
  start: number
  end: number
  duration: number
  source: 'shot' | 'custom' | 'comp'
  shotId?: string
  shotName?: string
}

/**
 * Xác định biên thời gian hiệu dụng [start, end] khi phát:
 * - Khi isolateShotPlayback = false: chạy toàn cảnh từ 0 đến comp.duration.
 * - Khi isolateShotPlayback = true và đang chọn 1 Cảnh cụ thể (focusedShotId):
 *   chạy duy nhất trong phạm vi thời gian của cảnh đó [shotStart, shotEnd].
 * - Khi isolateShotPlayback = true và đang chọn 'Toàn cảnh' (focusedShotId = null):
 *   chạy trong khoảng thời gian tuỳ chọn [customPlaybackRange.start, customPlaybackRange.end].
 */
export function resolveActivePlaybackRange(
  project: Project,
  isolateShotPlayback: boolean,
  focusedShotId: string | null,
  customPlaybackRange: { start: number; end: number } | null
): PlaybackRange {
  const compDur = Math.max(0.1, Number((project?.comp?.duration || 10).toFixed(2)))

  if (!isolateShotPlayback) {
    return {
      start: 0,
      end: compDur,
      duration: compDur,
      source: 'comp'
    }
  }

  if (focusedShotId) {
    const shot = project.shots.find((s) => s.id === focusedShotId)
    if (shot) {
      const route = computeShotRoute(project)
      const r = route.ranges.get(shot.id) ?? getShotTimeRange(project, shot)
      const start = Math.max(0, Math.min(compDur, Number(r.start.toFixed(2))))
      const end = Math.max(start + 0.1, Math.min(compDur, Number(r.end.toFixed(2))))
      return {
        start,
        end,
        duration: Number((end - start).toFixed(2)),
        source: 'shot',
        shotId: shot.id,
        shotName: shot.name
      }
    }
  }

  if (customPlaybackRange) {
    const rawStart = Number.isFinite(customPlaybackRange.start) ? customPlaybackRange.start : 0
    const rawEnd = Number.isFinite(customPlaybackRange.end) ? customPlaybackRange.end : compDur
    const start = Math.max(0, Math.min(compDur, Number(rawStart.toFixed(2))))
    const end = Math.max(start + 0.1, Math.min(compDur, Number(rawEnd.toFixed(2))))
    return {
      start,
      end,
      duration: Number((end - start).toFixed(2)),
      source: 'custom'
    }
  }

  return {
    start: 0,
    end: compDur,
    duration: compDur,
    source: 'custom'
  }
}
