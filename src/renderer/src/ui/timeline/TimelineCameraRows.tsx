import React, { useMemo } from 'react'
import type { Animatable, AnimValue, Project, Shot } from '@shared/types'
import { snapToFrame } from '../../animation/math'
import { frameTolerance, useEditor, type PropRef } from '../../store/editor'
import { IconCamera, IconCaret, IconFilm, IconRoute } from '../icons'
import {
  computeShotStageLayout,
  extractCameraFrames2D
} from '../viewer/animateCamera/animateCameraMath'
import { enrichCameraWaypoints } from '../viewer/animateCamera/animateCameraRouteLogic'
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

export function TimelineCameraRows({
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
  const time = useEditor((s) => s.time)
  const inspectorTab = useEditor((s) => s.inspectorTab)
  const { setTime, selectShot, setInspectorTab } = useEditor.getState()
  const tol = Math.max(frameTolerance(project), 0.04)

  const stageLayout = useMemo(() => computeShotStageLayout(project, 0), [project])
  const waypoints = useMemo(
    () => enrichCameraWaypoints(extractCameraFrames2D(project, stageLayout)),
    [project, stageLayout]
  )
  const segments = useMemo(
    () => (project.shots.length ? shotSegments(project) : []),
    [project]
  )

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
            <span className="tl-cam-wp-count" title="Tổng số mốc lộ trình Camera">
              {waypoints.length} mốc
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
            {/* Tween Spans connecting consecutive Camera Waypoints (Adobe Animate Classic/Motion Tween style) */}
            {waypoints.map((wp, idx) => {
              const next = waypoints[idx + 1]
              if (!next) return null
              const x0 = x(wp.time)
              const x1 = x(next.time)
              const spanW = Math.max(2, x1 - x0)
              const isHold = next.actionMode === 'hold' || wp.ease === 'hold'
              const isCut = next.actionMode === 'cut'
              const shotColor =
                (wp.shotId ? shotById.get(wp.shotId)?.color : undefined) ?? 'var(--accent-cyan)'
              return (
                <div
                  key={`cam-span-${idx}`}
                  className={`tl-cam-tween-span${isHold ? ' is-hold' : ''}${isCut ? ' is-cut' : ''}`}
                  style={{
                    left: x0,
                    width: spanW,
                    ['--cam-span-color' as string]: shotColor
                  }}
                  title={`Đoạn #${idx + 1} → #${idx + 2}: ${next.tagLabel} (${(next.time - wp.time).toFixed(2)}s)`}
                >
                  {spanW > 52 && (
                    <span className="tl-cam-tween-label">
                      {isHold ? '⏸ Giữ khung' : isCut ? '⚡ Cắt' : '━━▶ Lia'}
                    </span>
                  )}
                </div>
              )
            })}

            {/* Numbered Camera Waypoint Nodes (#1, #2, #3...) */}
            {waypoints.map((wp, idx) => {
              const isAtPlayhead = Math.abs(wp.time - time) <= tol
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
                  title={`${wp.isFirstOfShot ? `⚑ MỐC MỞ ĐẦU CẢNH: ${wp.shotName}\n` : ''}Mốc Camera #${idx + 1} @ ${wp.time.toFixed(2)}s · ${wp.shotName} · ${wp.tagLabel}\n💡 Click để chọn & mở Lộ trình, kéo ngang để dời thời gian mốc`}
                  onPointerDown={(e) => onStartCameraWaypointDrag(e, wp.time, wp.shotId)}
                >
                  {wp.isFirstOfShot && <span className="tl-cam-wp-flag">⚑</span>}
                  <span className="tl-cam-wp-num">#{idx + 1}</span>
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
}
