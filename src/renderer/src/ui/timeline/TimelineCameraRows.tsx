import React, { memo, useEffect, useMemo } from 'react'
import type { Animatable, AnimValue, Project, Shot } from '@shared/types'
import { snapToFrame } from '../../animation/math'
import { frameTolerance, useEditor, type PropRef } from '../../store/editor'
import { IconCamera, IconCaret, IconFilm, IconRoute } from '../icons'
import {
  computeShotStageLayout,
  extractCameraFrames2D
} from '../viewer/animateCamera/animateCameraMath'
import {
  enrichCameraWaypoints,
  findActiveWaypointIndexAtTime,
  syncCompDurationToCameraRoute
} from '../viewer/animateCamera/animateCameraRouteLogic'
import { TimelineRow } from './TimelineRow'
import { CAMERA_PROPS, shotSegments } from './timelineTypes'

interface TimelineCameraRowsProps {
  project: Project
  camOpen: boolean
  contentW: number
  shotById: Map<string, Shot>
  x: (t: number) => number
  onToggleCamOpen: () => void
  onTrackPointerDown: (e: React.PointerEvent) => void
  onStartCameraWaypointDrag: (e: React.PointerEvent, waypointTime: number, shotId: string | null) => void
  renderKeys: (a: Animatable<AnimValue>, ref: PropRef) => React.ReactNode
}

export const TimelineCameraRows = memo(function TimelineCameraRows({
  project,
  camOpen,
  contentW,
  shotById,
  x,
  onToggleCamOpen,
  onTrackPointerDown,
  onStartCameraWaypointDrag,
  renderKeys
}: TimelineCameraRowsProps) {
  const inspectorTab = useEditor((s) => s.inspectorTab)
  const { setTime, selectShot, setInspectorTab } = useEditor.getState()
  const tol = Math.max(frameTolerance(project), 0.015)

  const stageLayout = useMemo(() => computeShotStageLayout(project, 0), [project])
  const waypoints = useMemo(
    () => enrichCameraWaypoints(extractCameraFrames2D(project, stageLayout)),
    [project, stageLayout]
  )
  const activeWpIdx = useEditor((s) => findActiveWaypointIndexAtTime(waypoints, s.time, tol))
  const segments = useMemo(
    () => (project.shots.length ? shotSegments(project) : []),
    [project]
  )

  const lastWpTime = waypoints.length >= 2 ? waypoints[waypoints.length - 1].time : null

  // Tự động đồng bộ nếu dự án đang có comp.duration lệch/thừa khoảng trống so với mốc cuối của lộ trình Camera 2D
  useEffect(() => {
    if (lastWpTime === null || lastWpTime < 0.5) return
    const diff = project.comp.duration - lastWpTime
    if (diff > 0.05 && diff <= 3.0) {
      const maxAudioEnd = (project.audioTracks ?? []).reduce((acc, tr) => {
        const end = (tr.offset ?? 0) + (tr.duration ?? 0)
        return end > acc ? end : acc
      }, 0)
      if (maxAudioEnd <= lastWpTime + 0.05) {
        useEditor.getState().update((d) => {
          syncCompDurationToCameraRoute(d)
        }, 'sync-cam-route-duration')
      }
    }
  }, [lastWpTime, project.comp.duration, project.audioTracks])

  return (
    <>
      {/* 1. Adobe Animate / After Effects Camera Waypoint & Motion Tween Track */}
      <TimelineRow
        selected={inspectorTab === 'route' || inspectorTab === 'camera'}
        className="tl-camera-master-row"
        trackWidth={contentW}
        onTrackPointerDown={onTrackPointerDown}
        name={
          <div
            className="tl-name tl-cam-name"
            onClick={() => setInspectorTab('route')}
          >
            <button
              type="button"
              className="mini"
              title="Mở/Đóng chi tiết thuộc tính keyframe Camera"
              onClick={(e) => {
                e.stopPropagation()
                onToggleCamOpen()
              }}
            >
              <IconCaret className={`caret${camOpen ? ' open' : ''}`} />
            </button>
            <span className="tl-index-col">CAM</span>
            <span className="ico" style={{ background: '#2563eb' }} title="Lộ trình Camera 2D / 3D">
              <IconCamera width={11} height={11} strokeWidth={2.2} />
            </span>
            <span className="label">Camera · Lộ trình</span>
            <span
              className="tl-cam-wp-count"
              title={`Tổng số mốc lộ trình Camera · Tổng thời gian: ${(lastWpTime ?? project.comp.duration).toFixed(1)}s`}
            >
              {waypoints.length} mốc · {(lastWpTime ?? project.comp.duration).toFixed(1)}s
            </span>
            <button
              type="button"
              className={`mini tl-cam-route-btn${inspectorTab === 'route' ? ' active' : ''}`}
              title="Mở tab Lộ trình Camera (Inspector)"
              onClick={(e) => {
                e.stopPropagation()
                setInspectorTab('route')
              }}
            >
              <IconRoute width={12} height={12} />
            </button>
          </div>
        }
        track={
          <div className="tl-cam-track-strip">
            {/* Tween Spans chỉ vẽ cho các đoạn chuyển thực tế giữa 2 mốc [wp.time ➔ next.time], tuyệt đối không vẽ thừa sau mốc cuối */}
            {waypoints.map((wp, idx) => {
              const next = waypoints[idx + 1]
              if (!next && waypoints.length > 1) return null
              const endT = next ? next.time : Math.min(project.comp.duration, wp.endTime)
              const segDur = next
                ? Math.max(0.1, Math.round((next.time - wp.time) * 100) / 100)
                : wp.stepDuration
              const targetLabel = next ? next.displayLabel : wp.displayLabel
              const x0 = x(wp.time)
              const x1 = x(endT)
              const spanW = Math.max(2, x1 - x0)
              const isHold = (next?.actionMode ?? wp.actionMode) === 'hold' || wp.ease === 'hold'
              const isCut = (next?.actionMode ?? wp.actionMode) === 'cut'
              const shotIdForColor = next?.shotId ?? wp.shotId
              const shotColor =
                (shotIdForColor ? shotById.get(shotIdForColor)?.color : undefined) ?? 'var(--accent-cyan)'
              return (
                <div
                  key={`cam-span-${idx}`}
                  className={`tl-cam-tween-span${isHold ? ' is-hold' : ''}${isCut ? ' is-cut' : ''}`}
                  style={{
                    left: x0,
                    width: spanW,
                    ['--cam-span-color' as string]: shotColor
                  }}
                  title={
                    next
                      ? `Chuyển từ #${wp.displayLabel} ➔ #${next.displayLabel} (${wp.time.toFixed(2)}s ➔ ${next.time.toFixed(2)}s · ${segDur.toFixed(1)}s): ${next.tagLabel}`
                      : `Mốc #${wp.displayLabel} (${wp.time.toFixed(2)}s ➔ ${endT.toFixed(2)}s · ${segDur.toFixed(1)}s): ${wp.tagLabel}`
                  }
                >
                  {spanW > 52 && (
                    <span className="tl-cam-tween-label">
                      {isHold
                        ? `⏸ #${targetLabel} (${segDur.toFixed(1)}s)`
                        : isCut
                          ? `⚡ #${targetLabel}`
                          : `#${targetLabel} · ${segDur.toFixed(1)}s`}
                    </span>
                  )}
                </div>
              )
            })}

            {/* Numbered Camera Waypoint Nodes (#1, #2, #5.1...) */}
            {waypoints.map((wp, idx) => {
              const isAtPlayhead = idx === activeWpIdx
              const prev = idx > 0 ? waypoints[idx - 1] : null
              const dispDur = prev ? prev.stepDuration : wp.stepDuration
              const shotColor =
                (wp.shotId ? shotById.get(wp.shotId)?.color : undefined) ?? '#38bdf8'
              return (
                <div
                  key={`cam-wp-${idx}-${wp.time}`}
                  className={`tl-cam-wp-node${wp.isFirstOfShot ? ' first-of-shot' : ''}${isAtPlayhead ? ' active' : ''}${wp.actionMode === 'hold' ? ' hold' : ''}`}
                  style={{
                    left: x(wp.time),
                    ['--wp-color' as string]: shotColor
                  }}
                  title={`${wp.isFirstOfShot ? `⚑ MỐC MỞ ĐẦU CẢNH: ${wp.shotName}\n` : ''}Mốc Camera #${wp.displayLabel} @ ${wp.time.toFixed(2)}s (${prev ? `Chuyển ${dispDur.toFixed(1)}s` : 'Mốc gốc 0.0s'}) · ${wp.shotName} · ${wp.tagLabel}\n💡 Click để chọn & mở Lộ trình, kéo ngang để dời thời gian mốc`}
                  onPointerDown={(e) => onStartCameraWaypointDrag(e, wp.time, wp.shotId)}
                >
                  {wp.isFirstOfShot && <span className="tl-cam-wp-flag">⚑</span>}
                  <span className="tl-cam-wp-num">#{wp.displayLabel}</span>
                </div>
              )
            })}
          </div>
        }
      />

      {/* Expanded Camera Property Sub-rows */}
      {camOpen &&
        CAMERA_PROPS.map((p) => (
          <TimelineRow
            key={p.prop}
            sub
            trackWidth={contentW}
            onTrackPointerDown={onTrackPointerDown}
            name={<div className="tl-name sub">{p.label}</div>}
            track={renderKeys(project.camera[p.prop] as Animatable<AnimValue>, {
              kind: 'camera',
              prop: p.prop
            })}
          />
        ))}

      {/* 2. Active Scene Strip (Premiere / After Effects Scene Switcher Row) */}
      {segments.length > 0 && (
        <TimelineRow
          className="tl-shot-switcher-row"
          trackWidth={contentW}
          onTrackPointerDown={onTrackPointerDown}
          name={
            <div className="tl-name">
              <span style={{ width: 20 }} />
              <span className="tl-index-col">SCN</span>
              <span className="ico" style={{ background: '#a78bfa' }}>
                <IconFilm width={11} height={11} />
              </span>
              <span className="label">Cảnh đang quay</span>
            </div>
          }
          track={
            <div className="tl-shot-strip">
              {segments.map((seg, i) => {
                const s = seg.id ? shotById.get(seg.id) : undefined
                const shotIdx = s ? project.shots.findIndex((sh) => sh.id === s.id) : -1
                const segW = Math.max(2, x(seg.t1) - x(seg.t0))
                return (
                  <div
                    key={i}
                    className={`tl-shot-seg${s ? '' : ' transition-bridge'}`}
                    style={{
                      left: x(seg.t0),
                      width: segW,
                      ...(s ? { ['--c' as string]: s.color } : {})
                    }}
                    title={`${s ? `Cảnh ${shotIdx + 1}: ${s.name}` : 'Đang lia chuyển cảnh'} · ${seg.t0.toFixed(2)}s → ${seg.t1.toFixed(2)}s`}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      setTime(snapToFrame(seg.t0, project.comp.fps))
                      if (s) selectShot(s.id)
                    }}
                  >
                    {s ? (
                      <>
                        <span className="tl-shot-seg-idx">#{shotIdx + 1}</span>
                        <span className="tl-shot-seg-name">{s.name}</span>
                      </>
                    ) : (
                      segW > 28 && <span className="tl-shot-seg-trans">⇄ Lia</span>
                    )}
                  </div>
                )
              })}
            </div>
          }
        />
      )}
    </>
  )
})
