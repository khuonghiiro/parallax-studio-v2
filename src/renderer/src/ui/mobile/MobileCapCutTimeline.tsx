import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AudioTrackItem, Layer, Shot } from '@shared/types'
import { flyToShot } from '../../actions'
import { shotAtTime } from '../../animation/cameraPath'
import { evaluate } from '../../animation/keyframes'
import { usePinchPanGesture } from '../../hooks/usePinchPanGesture'
import { assetStore } from '../../project/assets'
import { getProjectAudioTracks } from '../../project/audioTracks'
import { listTimelineLogicNodes } from '../../project/timelineLogic'
import { ensureProjectWorkflow } from '../../project/workflowEngine'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import {
  buildTimelineClusters,
  getCleanLayerSubName,
  type TimelineClusterGroup
} from '../timeline/timelineClusters'
import { TimelineLogicPickerV2 } from '../timeline/TimelineLogicPickerV2'
import { MobileActionStrip, type MobileQuickSheetMode } from './MobileActionStrip'
import { MobileQuickSheet } from './MobileQuickSheet'
import { MobileTransportBar } from './MobileTransportBar'
import '../../styles/mobileCapCutTimeline.css'

interface ShotSegment {
  shot: Shot
  index: number
  start: number
  end: number
}

function computeShotSegments(shots: Shot[], duration: number, project: ReturnType<typeof useEditor.getState>['project']): ShotSegment[] {
  if (shots.length === 0) return []
  if (shots.length === 1) return [{ shot: shots[0], index: 0, start: 0, end: duration }]
  const samples = 120
  const spans = new Map<string, { min: number; max: number }>()
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * duration
    const sid = shotAtTime(project, t)
    if (sid) {
      const cur = spans.get(sid)
      if (!cur) spans.set(sid, { min: t, max: t })
      else {
        cur.min = Math.min(cur.min, t)
        cur.max = Math.max(cur.max, t)
      }
    }
  }
  const slice = duration / shots.length
  return shots.map((shot, index) => {
    const found = spans.get(shot.id)
    const start = found ? found.min : index * slice
    const end = found ? Math.max(found.min + 0.4, found.max) : (index + 1) * slice
    return { shot, index, start, end }
  })
}

function collectLayerKeyTimes(layers: Layer[]): number[] {
  const set = new Set<number>()
  for (const l of layers) {
    for (const prop of ['position', 'rotation', 'scale', 'opacity'] as const) {
      for (const k of l.transform[prop].keyframes) {
        set.add(Math.round(k.t * 100) / 100)
      }
    }
  }
  return Array.from(set).sort((a, b) => a - b)
}

export const MobileCapCutTimeline: React.FC = () => {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const playing = useEditor((s) => s.playing)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)
  const selectedShotId = useEditor((s) => s.selectedShotId)
  const selectedAudioTrackId = useEditor((s) => s.selectedAudioTrackId)

  const duration = Math.max(1, project.comp.duration || 10)
  const [pxPerSec, setPxPerSec] = useState<number>(56)
  const [viewportW, setViewportW] = useState<number>(360)
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(() => new Set())
  const [sheetMode, setSheetMode] = useState<MobileQuickSheetMode>(null)
  const [logicPickerOpen, setLogicPickerOpen] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const isProgrammaticScrollRef = useRef(false)
  const isUserScrubbingRef = useRef(false)
  const scrubIdleTimerRef = useRef<number | null>(null)

  const halfW = Math.max(120, Math.round(viewportW / 2))
  const spanPx = Math.max(140, Math.round(duration * pxPerSec))

  // Measure visible width so center playhead sits at exact 50%
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const update = (): void => {
      const w = Math.floor(el.clientWidth)
      if (w > 80) setViewportW((prev) => (Math.abs(prev - w) < 4 ? prev : w))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Keep scroll position locked to currentTime during playback, external seek, or zoom
  useEffect(() => {
    const el = scrollRef.current
    if (!el || isUserScrubbingRef.current) return
    const targetLeft = Math.round((time / duration) * spanPx)
    if (Math.abs(el.scrollLeft - targetLeft) >= 1.5) {
      isProgrammaticScrollRef.current = true
      el.scrollLeft = targetLeft
      window.requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false
      })
    }
  }, [time, duration, spanPx, playing])

  // Pinch-to-zoom anchored at current playhead time
  usePinchPanGesture(scrollRef, ({ scaleFactor }) => {
    if (Math.abs(scaleFactor - 1) > 0.005) {
      setPxPerSec((prev) => Math.max(28, Math.min(240, Number((prev * scaleFactor).toFixed(2)))))
    }
  })

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (isProgrammaticScrollRef.current) return
      const el = e.currentTarget
      const ratio = Math.max(0, Math.min(1, el.scrollLeft / Math.max(1, spanPx)))
      const nextTime = Number((ratio * duration).toFixed(3))
      const st = useEditor.getState()
      if (isUserScrubbingRef.current) {
        if (st.playing) st.setPlaying(false)
        if (Math.abs(st.time - nextTime) >= 0.004) {
          st.setTime(nextTime)
        }
      }
    },
    [spanPx, duration]
  )

  const beginTouchScrub = (): void => {
    isUserScrubbingRef.current = true
    if (scrubIdleTimerRef.current !== null) window.clearTimeout(scrubIdleTimerRef.current)
  }

  const endTouchScrub = (): void => {
    if (scrubIdleTimerRef.current !== null) window.clearTimeout(scrubIdleTimerRef.current)
    // Allow momentum inertia scroll on iOS Safari to continue updating playhead smoothly
    scrubIdleTimerRef.current = window.setTimeout(() => {
      isUserScrubbingRef.current = false
    }, 420)
  }

  const seekTo = useCallback((t: number) => {
    const clamped = Math.max(0, Math.min(duration, Number(t.toFixed(3))))
    isUserScrubbingRef.current = false
    useEditor.getState().setPlaying(false)
    useEditor.getState().setTime(clamped)
  }, [duration])

  // Start touch trim handle drag (In-point or Out-point) for single layer or composite cluster
  const startTrimDrag = (
    e: React.PointerEvent,
    targetLayerIds: string[],
    edge: 'in' | 'out',
    initIn: number,
    initOut: number
  ): void => {
    e.stopPropagation()
    e.preventDefault()
    isUserScrubbingRef.current = false
    const startX = e.clientX
    const minLen = Math.max(0.1, 1 / (project.comp.fps || 30))
    const onMove = (ev: PointerEvent): void => {
      const dt = (ev.clientX - startX) / Math.max(10, pxPerSec)
      if (edge === 'in') {
        const nextIn = Math.max(0, Math.min(initOut - minLen, Number((initIn + dt).toFixed(2))))
        useEditor.getState().update((draft) => {
          for (const l of draft.layers) {
            if (targetLayerIds.includes(l.id) && !l.locked) l.inPoint = nextIn
          }
        })
        useEditor.getState().setTime(nextIn)
      } else {
        const nextOut = Math.min(duration, Math.max(initIn + minLen, Number((initOut + dt).toFixed(2))))
        useEditor.getState().update((draft) => {
          for (const l of draft.layers) {
            if (targetLayerIds.includes(l.id) && !l.locked) l.outPoint = nextOut
          }
        })
        useEditor.getState().setTime(nextOut)
      }
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Drag a gold keyframe diamond horizontally to retime all keys at `origT` on `targetLayers`
  const startKeyDiamondDrag = (e: React.PointerEvent, targetLayerIds: string[], origT: number): void => {
    e.stopPropagation()
    e.preventDefault()
    isUserScrubbingRef.current = false
    const startX = e.clientX
    let moved = false
    let curT = origT
    const onMove = (ev: PointerEvent): void => {
      if (Math.abs(ev.clientX - startX) > 4) moved = true
      if (!moved) return
      const nextT = Math.max(0, Math.min(duration, Number((origT + (ev.clientX - startX) / pxPerSec).toFixed(2))))
      if (Math.abs(nextT - curT) < 0.01) return
      const prevT = curT
      curT = nextT
      useEditor.getState().update((draft) => {
        for (const l of draft.layers) {
          if (!targetLayerIds.includes(l.id) || l.locked) continue
          for (const prop of ['position', 'rotation', 'scale', 'opacity'] as const) {
            for (const k of l.transform[prop].keyframes) {
              if (Math.abs(k.t - prevT) < 0.025) k.t = nextT
            }
            l.transform[prop].keyframes.sort((a, b) => a.t - b.t)
          }
        }
      })
      useEditor.getState().setTime(nextT)
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (!moved) seekTo(origT)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const rulerTicks = useMemo(() => {
    const steps = [0.5, 1, 2, 5, 10, 15, 30]
    const major = steps.find((s) => s * pxPerSec >= 52) ?? 30
    const minor = major / 2
    const list: { t: number; major: boolean }[] = []
    for (let i = 0; i * minor <= duration + 1e-4; i++) {
      list.push({ t: Number((i * minor).toFixed(2)), major: i % 2 === 0 })
    }
    return list
  }, [duration, pxPerSec])

  const shotSegments = useMemo(
    () => computeShotSegments(project.shots, duration, project),
    [project, duration]
  )

  const cameraWaypoints = useMemo(
    () => project.camera.position.keyframes.map((k, idx) => ({ id: k.id, t: k.t, index: idx + 1 })),
    [project.camera.position.keyframes]
  )

  const audioTracks = useMemo(
    () => getProjectAudioTracks(project),
    [project]
  )

  const workflow = useMemo(() => ensureProjectWorkflow(project), [project])

  // Filter layers to active/selected shot (or show all with shot tag) so phone timeline stays clean & focused
  const activeShotId = useMemo(
    () => selectedShotId ?? shotAtTime(project, time) ?? project.shots[0]?.id ?? null,
    [selectedShotId, project, time]
  )

  const visibleClusters = useMemo(() => {
    const scopedLayers = project.shots.length > 1 && activeShotId
      ? project.layers.filter((l) => !l.shotId || l.shotId === activeShotId)
      : project.layers
    return buildTimelineClusters(scopedLayers, audioTracks)
  }, [project.layers, project.shots.length, activeShotId, audioTracks])

  const selectedLayer = selectedLayerId
    ? project.layers.find((l) => l.id === selectedLayerId) ?? null
    : null
  const activeShotObj = project.shots.find((s) => s.id === activeShotId)

  const toggleClusterExpand = (instId: string, e: React.MouseEvent): void => {
    e.stopPropagation()
    setExpandedClusters((prev) => {
      const next = new Set(prev)
      if (next.has(instId)) next.delete(instId)
      else next.add(instId)
      return next
    })
  }

  const handleToggleSheet = (mode: Exclude<MobileQuickSheetMode, null>): void => {
    setSheetMode((prev) => (prev === mode ? null : mode))
  }

  const renderClipBar = (
    key: string,
    title: string,
    badgeIcon: string,
    layersInClip: Layer[],
    inPt: number,
    outPt: number,
    isCluster: boolean,
    clusterGroup?: TimelineClusterGroup,
    isSubLayer = false
  ) => {
    const primary = clusterGroup?.layers.find((l) => l.id === clusterGroup.rootLayerId) ?? layersInClip[0]
    const isSel = layersInClip.some((l) => l.id === selectedLayerId)
    const leftPx = halfW + inPt * pxPerSec
    const widthPx = Math.max(32, (outPt - inPt) * pxPerSec)
    const zVal = Math.round(evaluate(primary.transform.position, time)[2])
    const keyTimes = collectLayerKeyTimes(layersInClip)
    const logicCount = listTimelineLogicNodes(project, workflow, primary, primary.shotId ?? 'all').length
    const isExpanded = clusterGroup ? expandedClusters.has(clusterGroup.instanceId) : false
    const layerIds = layersInClip.map((l) => l.id)

    return (
      <div key={key} className={`cc-track-row${isSubLayer ? ' is-sub' : ''}`}>
        <div
          className={`cc-clip-bar type-${isCluster ? clusterGroup!.clusterType : primary.type}${isSel ? ' selected' : ''}${primary.visible === false ? ' hidden-layer' : ''}`}
          style={{ left: leftPx, width: widthPx }}
          onClick={(e) => {
            e.stopPropagation()
            useEditor.getState().selectAudioTrack(null)
            useEditor.getState().selectLayer(primary.id)
          }}
        >
          {isSel && (
            <div
              className="cc-trim-handle left"
              onPointerDown={(e) => startTrimDrag(e, layerIds, 'in', inPt, outPt)}
              title="Kéo để cắt điểm bắt đầu (In)"
            >
              <span className="cc-trim-grip" />
            </div>
          )}

          <div className="cc-clip-sticky-content">
            <span className="cc-clip-ico">{badgeIcon}</span>
            <span className="cc-clip-name">{title}</span>
            <span className="cc-clip-z">Z:{zVal}</span>
            {logicCount > 0 && (
              <span
                className="cc-clip-logic-tag"
                onClick={(e) => {
                  e.stopPropagation()
                  useEditor.getState().selectLayer(primary.id)
                  useEditor.getState().setInspectorTab('node')
                  useView.getState().setRightCollapsed(false)
                  useView.getState().setMobileTab('right')
                }}
              >
                ✨{logicCount}
              </span>
            )}
            {clusterGroup && (
              <button
                type="button"
                className={`cc-cluster-expand-pill${isExpanded ? ' open' : ''}`}
                onClick={(e) => toggleClusterExpand(clusterGroup.instanceId, e)}
              >
                {clusterGroup.layers.length} lớp {isExpanded ? '▴' : '▾'}
              </button>
            )}
          </div>

          {keyTimes
            .filter((kt) => kt >= inPt - 0.02 && kt <= outPt + 0.02)
            .map((kt) => (
              <div
                key={kt}
                className={`cc-key-diamond${Math.abs(kt - time) < 0.04 ? ' at-playhead' : ''}`}
                style={{ left: (kt - inPt) * pxPerSec }}
                onPointerDown={(e) => startKeyDiamondDrag(e, layerIds, kt)}
                title={`Mốc Keyframe ${kt.toFixed(2)}s (Chạm để nhảy tới · Kéo để dời thời gian)`}
              />
            ))}

          {isSel && (
            <div
              className="cc-trim-handle right"
              onPointerDown={(e) => startTrimDrag(e, layerIds, 'out', inPt, outPt)}
              title="Kéo để cắt điểm kết thúc (Out)"
            >
              <span className="cc-trim-grip" />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="cc-mobile-timeline" data-mcp-region="mobile_timeline">
      <MobileTransportBar pxPerSec={pxPerSec} onZoomChange={setPxPerSec} />

      {/* Center-Playhead Scrollable Multi-Track Viewport */}
      <div className="cc-tracks-viewport">
        {/* Fixed CapCut Center Playhead Needle */}
        <div className="cc-center-playhead" aria-hidden="true">
          <div className="cc-playhead-head" />
          <div className="cc-playhead-line" />
        </div>

        <div
          ref={scrollRef}
          className="cc-tracks-scroll"
          onScroll={handleScroll}
          onTouchStart={beginTouchScrub}
          onTouchEnd={endTouchScrub}
          onTouchCancel={endTouchScrub}
          onPointerDown={(e) => {
            if (e.pointerType !== 'touch') beginTouchScrub()
          }}
          onPointerUp={(e) => {
            if (e.pointerType !== 'touch') endTouchScrub()
          }}
          onClick={() => {
            if (selectedLayerId) useEditor.getState().selectLayer(null)
          }}
        >
          <div
            className="cc-tracks-canvas"
            style={{ width: halfW * 2 + spanPx }}
          >
            {/* 1. Time Ruler Lane */}
            <div className="cc-ruler-lane" onClick={(e) => {
              e.stopPropagation()
              const rect = e.currentTarget.getBoundingClientRect()
              const clickX = e.clientX - rect.left - halfW
              seekTo((clickX / spanPx) * duration)
            }}>
              {rulerTicks.map((tk) => (
                <div
                  key={tk.t}
                  className={`cc-ruler-tick${tk.major ? ' major' : ' minor'}`}
                  style={{ left: halfW + tk.t * pxPerSec }}
                >
                  {tk.major && (
                    <span className="cc-ruler-label">
                      {Number.isInteger(tk.t) ? `${tk.t}s` : `${tk.t.toFixed(1)}s`}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* 2. Shots & Camera Waypoints Lane */}
            <div className="cc-camera-lane">
              {shotSegments.map(({ shot, index, start, end }) => {
                const isActive = shot.id === activeShotId
                return (
                  <div
                    key={shot.id}
                    className={`cc-shot-block${isActive ? ' active' : ''}`}
                    style={{
                      left: halfW + start * pxPerSec,
                      width: Math.max(44, (end - start) * pxPerSec - 2),
                      ['--shot-c' as string]: shot.color
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      useEditor.getState().selectLayer(null)
                      useEditor.getState().selectShot(shot.id)
                      flyToShot(shot.id)
                    }}
                  >
                    <span className="cc-shot-badge">🎬 #{index + 1}</span>
                    <span className="cc-shot-name">{shot.name}</span>
                  </div>
                )
              })}

            </div>

            {cameraWaypoints.length > 0 && (
              <div className="cc-cam-waypoints-lane">
                {cameraWaypoints.map((wp) => (
                  <button
                    key={wp.id}
                    type="button"
                    className={`cc-cam-wp-chip${Math.abs(wp.t - time) < 0.05 ? ' active' : ''}`}
                    style={{ left: halfW + wp.t * pxPerSec }}
                    onClick={(e) => {
                      e.stopPropagation()
                      seekTo(wp.t)
                      setSheetMode('camera')
                    }}
                    title={`Mốc Camera #${wp.index} (${wp.t.toFixed(2)}s)`}
                  >
                    🎥{wp.index}
                  </button>
                ))}
              </div>
            )}

            {/* 3. 2.5D Layers & Character Clusters Lanes */}
            <div className="cc-layer-lanes">
              {visibleClusters.map((item) => {
                if (item.kind === 'cluster') {
                  const ico = item.clusterType === 'composite' ? '🎭' : '🧊'
                  const expanded = expandedClusters.has(item.instanceId)
                  return (
                    <React.Fragment key={`cl-${item.instanceId}`}>
                      {renderClipBar(
                        `cluster-${item.instanceId}`,
                        item.name,
                        ico,
                        item.layers,
                        item.inPoint,
                        item.outPoint,
                        true,
                        item
                      )}
                      {expanded &&
                        item.layers.map((sub) =>
                          renderClipBar(
                            sub.id,
                            getCleanLayerSubName(sub, item.name),
                            '↳',
                            [sub],
                            sub.inPoint,
                            sub.outPoint,
                            false,
                            undefined,
                            true
                          )
                        )}
                    </React.Fragment>
                  )
                }
                const l = item.layer
                const ico =
                  l.type === 'text'
                    ? '🔤'
                    : l.type === 'particles'
                      ? '✨'
                      : l.type === 'solid'
                        ? '🟦'
                        : '🖼'
                return renderClipBar(l.id, l.name, ico, [l], l.inPoint, l.outPoint, false)
              })}

              {visibleClusters.length === 0 && (
                <div className="cc-empty-hint" style={{ left: halfW + 8 }}>
                  Chạm [+ Thêm Layer] bên dưới để thêm nhân vật, ảnh 2.5D hoặc mô hình 3D
                </div>
              )}
            </div>

            {/* 4. Audio Tracks Lane */}
            {audioTracks.length > 0 && (
              <div className="cc-audio-lane">
                {audioTracks.map((tr: AudioTrackItem) => {
                  const start = tr.offset ?? 0
                  const assetDur = assetStore.get(tr.assetId)?.meta?.duration ?? 0
                  const dur = Math.max(0.8, assetDur > 0 ? assetDur : Math.max(0.8, duration - start))
                  const isSel = tr.id === selectedAudioTrackId
                  return (
                    <div
                      key={tr.id}
                      className={`cc-audio-bar${isSel ? ' selected' : ''}`}
                      style={{
                        left: halfW + start * pxPerSec,
                        width: Math.max(48, Math.min(duration - start, dur) * pxPerSec)
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        useEditor.getState().selectLayer(null)
                        useEditor.getState().selectAudioTrack(tr.id)
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        useEditor.getState().selectAudioTrack(tr.id)
                        useView.getState().openAudioDialog('waveform')
                      }}
                    >
                      <span className="cc-audio-ico">🎵</span>
                      <span className="cc-audio-name">{tr.name || 'Âm thanh'}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CapCut Contextual Bottom Action Strip */}
      <MobileActionStrip
        sheetMode={sheetMode}
        onToggleSheet={handleToggleSheet}
        onOpenLogicPicker={() => setLogicPickerOpen(true)}
      />

      {/* Half-Screen Live Touch Adjustment Sheet (leaves top 2.5D Viewer visible!) */}
      {sheetMode && (
        <MobileQuickSheet mode={sheetMode} onClose={() => setSheetMode(null)} />
      )}

      {/* Unified Timeline ⇄ Workflow V2 Logic Picker */}
      {logicPickerOpen && (
        <TimelineLogicPickerV2
          layer={selectedLayer ?? undefined}
          targetName={selectedLayer ? selectedLayer.name : activeShotObj ? activeShotObj.name : 'Toàn dự án'}
          scopeKind={selectedLayer ? 'LAYER' : activeShotObj ? 'CẢNH' : 'DỰ ÁN'}
          initialCategory="all"
          onClose={() => setLogicPickerOpen(false)}
          onAdded={(nodeId) => {
            if (nodeId) {
              useEditor.getState().setSelectedWorkflowNodeId(nodeId)
            }
          }}
        />
      )}
    </div>
  )
}
