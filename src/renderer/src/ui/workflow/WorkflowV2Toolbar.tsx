import React, { useMemo } from 'react'
import type { Shot } from '@shared/types'
import { computeShotRoute, getShotTimeRange } from '../../project/workflowV2Scope'
import { useEditor } from '../../store/editor'
import { CustomSelect } from '../controls/CustomSelect'
import { IconJsonBraces, IconLightning, IconTimeNodePlus, IconTree } from '../icons'
import { TimelineModeTabs } from './TimelineModeTabs'
import { IconWorkflowCardsList, IconWorkflowGraph } from './workflowIcons'

const ALL = '__all__'

export type WorkflowV2ViewMode = 'graph' | 'cards'

export interface WorkflowV2ToolbarProps {
  layerCount: number
  enabledNodeCount: number
  totalNodeCount: number
  stats: { shots: number; layers: number; logic: number }
  /** Cảnh theo thứ tự camera đi qua */
  shots: { shot: Shot; index: number }[]
  activeShotId: string | null
  focusedShotId: string | null
  jsonMode?: boolean
  viewMode?: WorkflowV2ViewMode
  onChangeViewMode?: (mode: WorkflowV2ViewMode) => void
  onFocusShot: (shotId: string | null) => void
  onToggleJsonMode?: () => void
  onRelayout: () => void
  onApplyAll: () => void
  onAddTime: () => void
}

export const WorkflowV2Toolbar: React.FC<WorkflowV2ToolbarProps> = (props) => {
  const project = useEditor((s) => s.project)
  const currentTime = useEditor((s) => s.time)
  const setTime = useEditor((s) => s.setTime)
  const isolateShotPlayback = useEditor((s) => s.isolateShotPlayback)
  const customPlaybackRange = useEditor((s) => s.customPlaybackRange)
  const setIsolateShotPlayback = useEditor((s) => s.setIsolateShotPlayback)
  const setCustomPlaybackRange = useEditor((s) => s.setCustomPlaybackRange)

  const route = useMemo(() => computeShotRoute(project), [project])
  const compDur = Math.max(0.1, Number((project.comp.duration || 10).toFixed(2)))

  const current = props.focusedShotId ?? ALL
  const isAll = current === ALL

  const options = useMemo(
    () => [
      { value: ALL, label: 'Toàn cảnh' },
      ...props.shots.map(({ shot, index }) => ({
        value: shot.id,
        label: `#${index + 1} ${shot.name}`,
        icon: shot.id === props.activeShotId ? <span className="wf-v2-live-dot" aria-hidden="true" /> : undefined
      }))
    ],
    [props.shots, props.activeShotId]
  )

  const activeShotItem = useMemo(
    () => (isAll ? null : props.shots.find((s) => s.shot.id === current) ?? null),
    [isAll, props.shots, current]
  )

  const shotRange = useMemo(() => {
    if (!activeShotItem) return null
    return route.ranges.get(activeShotItem.shot.id) ?? getShotTimeRange(project, activeShotItem.shot)
  }, [activeShotItem, route.ranges, project])

  const customStart = customPlaybackRange?.start ?? 0
  const customEnd = customPlaybackRange?.end ?? compDur

  const handleSelectShot = (v: string) => {
    const nextShotId = v === ALL ? null : v
    props.onFocusShot(nextShotId)
    if (isolateShotPlayback) {
      if (nextShotId) {
        const target = props.shots.find((s) => s.shot.id === nextShotId)?.shot
        if (target) {
          const r = route.ranges.get(target.id) ?? getShotTimeRange(project, target)
          setTime(r.start)
        }
      } else if (customPlaybackRange) {
        setTime(customPlaybackRange.start)
      }
    }
  }

  const handleToggleIsolate = () => {
    const next = !isolateShotPlayback
    setIsolateShotPlayback(next)
    if (next) {
      if (!isAll && shotRange) {
        if (currentTime < shotRange.start || currentTime >= shotRange.end) {
          setTime(shotRange.start)
        }
      } else {
        const start = customPlaybackRange?.start ?? 0
        const end = customPlaybackRange?.end ?? compDur
        if (currentTime < start || currentTime >= end) {
          setTime(start)
        }
      }
    }
  }

  const handleStartChange = (valStr: string) => {
    const val = parseFloat(valStr)
    if (!Number.isFinite(val)) return
    const clampedStart = Math.max(0, Math.min(compDur, Number(val.toFixed(2))))
    const validEnd = Math.max(clampedStart + 0.1, customEnd)
    setCustomPlaybackRange({ start: clampedStart, end: validEnd })
    if (isolateShotPlayback && (currentTime < clampedStart || currentTime >= validEnd)) {
      setTime(clampedStart)
    }
  }

  const handleEndChange = (valStr: string) => {
    const val = parseFloat(valStr)
    if (!Number.isFinite(val)) return
    const clampedEnd = Math.max(customStart + 0.1, Math.min(compDur, Number(val.toFixed(2))))
    setCustomPlaybackRange({ start: customStart, end: clampedEnd })
    if (isolateShotPlayback && (currentTime < customStart || currentTime >= clampedEnd)) {
      setTime(customStart)
    }
  }

  const isolateTitle = !isAll && activeShotItem
    ? isolateShotPlayback
      ? `Đang BẬT chạy duy nhất cảnh #${activeShotItem.index + 1} "${activeShotItem.shot.name}" (${shotRange ? `${shotRange.start}s – ${shotRange.end}s` : ''}) — Nhấn để tắt và chạy toàn bộ dự án`
      : `Bật chạy duy nhất cảnh #${activeShotItem.index + 1} "${activeShotItem.shot.name}" (${shotRange ? `${shotRange.start}s – ${shotRange.end}s` : ''}) để test logic cảnh mà không phải tua toàn bộ dự án`
    : isolateShotPlayback
      ? `Đang BẬT chạy khoanh vùng từ ${customStart}s đến ${customEnd}s — Nhấn để tắt và chạy toàn bộ dự án`
      : `Bật chạy khoanh vùng thời gian đã nhập (${customStart}s – ${customEnd}s) khi xem Toàn cảnh`

  return (
    <div className="wf-toolbar wf-v2-toolbar" data-mcp-region="workflow_toolbar">
      <TimelineModeTabs
        layerCount={props.layerCount}
        connectedNodeCount={props.enabledNodeCount}
        totalNodeCount={props.totalNodeCount}
      />
      <div className="tl-toolbar-divider" />

      <div className="wf-v2-scope" role="group" aria-label="Đi tới cảnh và khoanh vùng phát trong không gian Workflow">
        <span className="wf-v2-scope-label">Đi tới</span>
        <CustomSelect
          size="sm"
          value={current}
          options={options}
          onChange={handleSelectShot}
          style={{ minWidth: 160, maxWidth: 220 }}
        />

        <button
          type="button"
          className={`wf-v2-scope-isolate-btn${isolateShotPlayback ? ' active' : ''}`}
          aria-pressed={isolateShotPlayback}
          title={isolateTitle}
          onClick={handleToggleIsolate}
        >
          <span className={`wf-v2-scope-dot${isolateShotPlayback ? ' active' : ''}`} />
          <span className="wf-v2-scope-isolate-txt">
            {isAll ? '⏱️ Chạy khoảng time' : '🎯 Duy nhất cảnh'}
          </span>
        </button>

        {isAll ? (
          <div className="wf-v2-scope-range" role="group" aria-label="Khoảng thời gian phát toàn cảnh">
            <span className="wf-v2-scope-range-lbl">Từ</span>
            <input
              type="number"
              className="wf-v2-scope-time-input"
              min={0}
              max={compDur}
              step={0.1}
              value={customPlaybackRange?.start ?? 0}
              onChange={(e) => handleStartChange(e.target.value)}
              title="Thời gian bắt đầu phát (giây)"
            />
            <span className="wf-v2-scope-range-sep">→</span>
            <span className="wf-v2-scope-range-lbl">Đến</span>
            <input
              type="number"
              className="wf-v2-scope-time-input"
              min={0}
              max={compDur}
              step={0.1}
              value={customPlaybackRange?.end ?? compDur}
              onChange={(e) => handleEndChange(e.target.value)}
              title="Thời gian kết thúc phát (giây)"
            />
            <span className="wf-v2-scope-unit">s</span>
          </div>
        ) : shotRange ? (
          <div
            className="wf-v2-scope-shot-range"
            role="button"
            tabIndex={0}
            title={`Cảnh #${activeShotItem ? activeShotItem.index + 1 : ''}: ${shotRange.start.toFixed(1)}s – ${shotRange.end.toFixed(1)}s. Nhấp để nhảy về đầu cảnh.`}
            onClick={() => setTime(shotRange.start)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setTime(shotRange.start)
            }}
          >
            <span className="wf-v2-scope-time-badge">
              {shotRange.start.toFixed(1)}s – {shotRange.end.toFixed(1)}s
            </span>
            <span className="wf-v2-scope-time-dur">
              ({(shotRange.end - shotRange.start).toFixed(1)}s)
            </span>
          </div>
        ) : null}
      </div>

      <div className="wf-v2-toolbar-actions">
        {props.onChangeViewMode && (
          <div className="wf-v2-view-switch" role="group" aria-label="Chế độ hiển thị Workflow">
            <button
              type="button"
              id="wf-v2-view-graph"
              className={`wf-v2-view-btn${(props.viewMode ?? 'graph') === 'graph' ? ' active' : ''}`}
              aria-pressed={(props.viewMode ?? 'graph') === 'graph'}
              onClick={() => props.onChangeViewMode!('graph')}
              title="Chế độ Sơ đồ Node 2D (Vuốt 1 ngón để di chuyển, chụm 2 ngón để thu phóng)"
            >
              <IconWorkflowGraph width={12} height={12} />
              <span>Sơ đồ</span>
            </button>
            <button
              type="button"
              id="wf-v2-view-cards"
              className={`wf-v2-view-btn${props.viewMode === 'cards' ? ' active' : ''}`}
              aria-pressed={props.viewMode === 'cards'}
              onClick={() => props.onChangeViewMode!('cards')}
              title="Chế độ Danh sách Thẻ gọn (Tối ưu thao tác cảm ứng trên Điện thoại & Máy tính bảng)"
            >
              <IconWorkflowCardsList width={12} height={12} />
              <span>Thẻ</span>
            </button>
          </div>
        )}

        <button
          type="button"
          className="btn ghost sm wf-v2-tool-btn wf-v2-time-btn"
          onClick={props.onAddTime}
          title="Tạo nguồn thời gian chung rồi kéo dây tới các node"
        >
          <IconTimeNodePlus width={13} height={13} />
          <span className="wf-v2-btn-txt">Time</span>
        </button>

        <span className="wf-v2-stats" title="Số cảnh / layer / node logic trong toàn dự án">
          <b>{props.stats.shots}</b> cảnh · <b>{props.stats.layers}</b> layer · <b>{props.stats.logic}</b> logic
        </span>

        {props.onToggleJsonMode && (
          <button
            type="button"
            className={`btn ghost sm wf-v2-tool-btn wf-v2-json-toggle${props.jsonMode ? ' active' : ''}`}
            aria-pressed={Boolean(props.jsonMode)}
            onClick={props.onToggleJsonMode}
            title="Mở bảng JSON độc lập (main.json kết nối + shot-N.json cho từng cảnh)"
          >
            <IconJsonBraces width={13} height={13} />
            <span className="wf-v2-btn-txt">JSON</span>
          </button>
        )}

        <button
          type="button"
          className="btn ghost sm wf-v2-tool-btn"
          onClick={props.onRelayout}
          title="Xếp lại toàn bộ không gian gọn gàng (bỏ ghim các thẻ đã kéo tay)"
        >
          <IconTree width={13} height={13} />
          <span className="wf-v2-btn-txt">Sắp xếp</span>
        </button>

        <button
          type="button"
          className="btn primary sm wf-v2-tool-btn primary-apply"
          onClick={props.onApplyAll}
          title="Áp dụng lại toàn bộ logic của cây xuống cảnh"
        >
          <IconLightning width={13} height={13} />
          <span className="wf-v2-btn-txt">Áp dụng vào cảnh</span>
        </button>
      </div>
    </div>
  )
}
