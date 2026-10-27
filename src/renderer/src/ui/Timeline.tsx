import { TimelineLogic } from './timeline/TimelineLogic'
import { TimelineMotionPopup } from './timeline/TimelineMotionPopup'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Animatable, AnimValue, AudioTrackItem, Layer, Shot } from '@shared/types'
import { useEditor, type PropRef } from '../store/editor'
import { useView } from '../store/view'
import { IconCaret, IconFilm } from './icons'
import { PAD, SHOT_PROPS, NAME_W } from './timeline/timelineTypes'
import { TimelineRow } from './timeline/TimelineRow'
import { AudioRow } from './timeline/AudioRow'
import { addAudioTrackToProject, getProjectAudioTracks } from '../project/audioTracks'
import { isMouthLayer } from '../project/lipSync'
import { AudioTargetModal } from './timeline/AudioTargetModal'
import { TimelineToolbar } from './timeline/TimelineToolbar'
import { TimelineLayerRow } from './timeline/TimelineLayerRow'
import { TimelineClusterRow } from './timeline/TimelineClusterRow'
import { buildTimelineClusters, type TimelineClusterGroup } from './timeline/timelineClusters'
import { TimelineCameraRows } from './timeline/TimelineCameraRows'
import { useTimelineInteractions } from './timeline/useTimelineInteractions'
import { WorkflowStudioPanel } from './workflow/WorkflowStudioPanel'
import { resolveWorkflowV2 } from '../project/workflowV2Rebuild'

const TimelineRulerPlayhead = memo(function TimelineRulerPlayhead({
  x
}: {
  x: (t: number) => number
}) {
  const time = useEditor((s) => s.time)
  return (
    <div className="tl-ruler-playhead" style={{ left: x(time) }}>
      <span className="tl-playhead-cap-badge">{time.toFixed(1)}s</span>
    </div>
  )
})

const TimelinePlayhead = memo(function TimelinePlayhead({ x }: { x: (t: number) => number }) {
  const time = useEditor((s) => s.time)
  return <div className="playhead" style={{ left: x(time) }} />
})

export function Timeline() {
  const project = useEditor((s) => s.project)
  const playing = useEditor((s) => s.playing)
  const loop = useEditor((s) => s.loop)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)
  const selectedShotId = useEditor((s) => s.selectedShotId)
  const timelineTab = useView((s) => s.timelineTab)
  const { setTime, setPlaying, setLoop, selectLayer, selectShot } = useEditor.getState()
  const { comp } = project

  // MỘT LOGIC CHUNG: mỗi khi Project đổi (ở Timeline, Inspector, Viewport, MCP...), đồ thị Workflow được suy ra lại
  // từ dữ liệu thật và ghi vào Project (dữ liệu dẫn xuất → không tạo bước Undo).
  // Debounce 90ms khi kéo thanh trượt liên tục để tránh nhân đôi chu kỳ render trên mỗi khung hình.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = useEditor.getState().project
      const next = resolveWorkflowV2(current)
      if (next !== current.workflow) {
        useEditor.getState().patchDerived((draft) => {
          draft.workflow = next
        })
      }
    }, 90)
    return () => window.clearTimeout(timer)
  }, [project])

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [collapsedClusters, setCollapsedClusters] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)
  const [zoom, setZoom] = useState<number>(1)
  const [modalTrack, setModalTrack] = useState<AudioTrackItem | null>(null)

  const trackRef = useRef<HTMLDivElement>(null)
  const rulerScrollRef = useRef<HTMLDivElement>(null)
  const rowsScrollRef = useRef<HTMLDivElement>(null)
  const isSyncingScrollRef = useRef(false)
  const [trackW, setTrackW] = useState(800)
  const [nameW, setNameW] = useState(NAME_W)
  const [scrollbarW, setScrollbarW] = useState(0)

  // Measure visible track area from rows container to account for vertical scrollbar
  useEffect(() => {
    const el = rowsScrollRef.current
    if (!el) return
    const update = () => {
      const sw = el.offsetWidth - el.clientWidth
      const nw = el.clientWidth < 560 ? 244 : el.clientWidth < 860 ? 300 : NAME_W
      setScrollbarW(sw)
      setNameW(nw)
      setTrackW(Math.max(100, el.clientWidth - nw))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [timelineTab])

  const contentW = Math.max(trackW, Math.round((trackW - PAD * 2) * zoom + PAD * 2))
  const x = useCallback(
    (t: number): number => PAD + (t / comp.duration) * (contentW - PAD * 2),
    [comp.duration, contentW]
  )
  const tAt = useCallback(
    (px: number): number => ((px - PAD) / (contentW - PAD * 2)) * comp.duration,
    [contentW, comp.duration]
  )

  const toggle = useCallback(
    (id: string): void =>
      setExpanded((s) => {
        const n = new Set(s)
        if (n.has(id)) n.delete(id)
        else n.add(id)
        return n
      }),
    []
  )

  const onRowsScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    if (isSyncingScrollRef.current) return
    if (rulerScrollRef.current) {
      isSyncingScrollRef.current = true
      rulerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
      isSyncingScrollRef.current = false
    }
  }

  const onRulerScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    if (isSyncingScrollRef.current) return
    if (rowsScrollRef.current) {
      isSyncingScrollRef.current = true
      rowsScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
      isSyncingScrollRef.current = false
    }
  }

  const {
    handleTimelineWheel,
    scrub,
    handleTimelineDragOver,
    handleTimelineDrop,
    handleTrackPointerDown,
    handleLayerContextMenu,
    startKeyDrag,
    startCameraWaypointDrag,
    startBarDrag
  } = useTimelineInteractions({
    project,
    contentW,
    tAt,
    trackRef,
    setZoom,
    setTime,
    setPlaying,
    selectLayer
  })

  // Time Ruler Ticks (Major seconds + Minor frame subdivisions)
  const ticks = useMemo(() => {
    const pxPerSec = (contentW - PAD * 2) / comp.duration
    const steps = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60]
    const major = steps.find((s) => s * pxPerSec >= 72) ?? 60
    const out: { t: number; major: boolean }[] = []
    const minor = major >= 0.5 ? major / 5 : major / 2
    for (let t = 0; t <= comp.duration + 1e-6; t += minor) {
      out.push({ t, major: Math.abs(t / major - Math.round(t / major)) < 1e-4 })
    }
    return out
  }, [contentW, comp.duration])

  /** Mốc chính liền trước tick thứ `i` (để ẩn nhãn cuối thước nếu sẽ đè lên nhãn trước đó) */
  const prevMajorT = (i: number): number => {
    for (let j = i - 1; j >= 0; j--) if (ticks[j].major) return ticks[j].t
    return 0
  }

  const selectedKey = useEditor((s) => s.selectedKey)
  const renderKeys = useCallback(
    (a: Animatable<AnimValue>, ref: PropRef) => {
      const ks = a.keyframes
      if (ks.length === 0) return null
      let lastPx = -9999
      const visibleKeys = ks.filter((k) => {
        if (selectedKey?.keyId === k.id) return true
        const px = x(k.t)
        if (px - lastPx >= 5) {
          lastPx = px
          return true
        }
        return false
      })
      return (
        <>
          {visibleKeys.map((k, idx) => {
            const next = visibleKeys[idx + 1]
            if (!next) return null
            const x0 = x(k.t)
            const x1 = x(next.t)
            if (x1 - x0 < 8) return null
            return (
              <div
                key={`tween-${k.id}`}
                className={`tl-tween-line${k.ease === 'hold' ? ' hold' : ''}`}
                style={{ left: x0, width: x1 - x0 }}
              />
            )
          })}
          {visibleKeys.map((k) => (
            <div
              key={k.id}
              className={`tl-key${k.ease === 'hold' ? ' hold' : ''}${selectedKey?.keyId === k.id ? ' selected' : ''}`}
              style={{ left: x(k.t) }}
              title={`${k.t.toFixed(2)}s`}
              onPointerDown={(e) => startKeyDrag(e, ref, k.id)}
              onDoubleClick={() => setTime(k.t)}
            />
          ))}
        </>
      )
    },
    [selectedKey, x, setTime, startKeyDrag]
  )

  const summaryKeys = useCallback(
    (anims: Animatable<AnimValue>[]) => {
      if (anims.length === 0) return null
      const timeSet = new Set<number>()
      for (let i = 0; i < anims.length; i++) {
        const kfs = anims[i].keyframes
        for (let j = 0; j < kfs.length; j++) {
          timeSet.add(Math.round(kfs[j].t * 100) / 100)
        }
      }
      if (timeSet.size === 0) return null
      const times = Array.from(timeSet).sort((a, b) => a - b)
      let lastPx = -9999
      const decimated: number[] = []
      for (let i = 0; i < times.length; i++) {
        const t = times[i]
        const px = x(t)
        if (px - lastPx >= 7) {
          decimated.push(t)
          lastPx = px
        }
      }
      return (
        <>
          {decimated.map((t, idx) => {
            const next = decimated[idx + 1]
            if (next === undefined) return null
            const x0 = x(t)
            const x1 = x(next)
            if (x1 - x0 < 8) return null
            return (
              <div
                key={`sum-tween-${t}`}
                className="tl-tween-line summary-tween"
                style={{ left: x0, width: x1 - x0 }}
              />
            )
          })}
          {decimated.map((t) => (
            <div
              key={t}
              className="tl-key summary"
              style={{ left: x(t) }}
              onPointerDown={(e) => {
                e.stopPropagation()
                setTime(t)
              }}
            />
          ))}
        </>
      )
    },
    [x, setTime]
  )

  const camOpen = expanded.has('camera')
  const shotById = useMemo(() => new Map(project.shots.map((s) => [s.id, s])), [project.shots])

  const groups = useMemo(() => {
    const out: { shot: Shot | null; layers: Layer[] }[] = []
    const globals = project.layers.filter((l) => !l.shotId || !shotById.has(l.shotId))
    if (globals.length || project.shots.length === 0) out.push({ shot: null, layers: globals })
    for (const s of project.shots) out.push({ shot: s, layers: project.layers.filter((l) => l.shotId === s.id) })
    return out
  }, [project.layers, project.shots, shotById])

  const allAudioTracks = useMemo(
    () => getProjectAudioTracks(project),
    [project.audioTracks, project.audio]
  )

  const globalAudioTracks = useMemo(() => {
    return allAudioTracks.filter((t) => {
      if (!t.targetId || t.targetType === 'ambient') return true
      if (t.targetType === 'character' || t.targetType === 'model3d') {
        const hasTarget = project.layers.some(
          (l) => l.composite?.instanceId === t.targetId || l.model3d?.instanceId === t.targetId || l.id === t.targetId
        )
        return !hasTarget
      }
      if (t.targetType === 'layer') {
        const layerExists = project.layers.some((l) => l.id === t.targetId)
        return !layerExists
      }
      return true
    })
  }, [allAudioTracks, project.layers])

  const clusteredGroups = useMemo(() => {
    return groups.map((g) => ({
      ...g,
      items: buildTimelineClusters(g.layers, allAudioTracks)
    }))
  }, [groups, allAudioTracks])

  // Global 1-based layer index map (like After Effects 01, 02, 03...)
  const layerOrderMap = useMemo(() => {
    const map = new Map<string, number>()
    project.layers.forEach((l, idx) => map.set(l.id, idx + 1))
    return map
  }, [project.layers])

  const handleOpenAttachAudioForCluster = (cluster: TimelineClusterGroup) => {
    if (cluster.audioTracks && cluster.audioTracks.length > 0) {
      setModalTrack(cluster.audioTracks[0])
      return
    }
    const mouthLayer = cluster.layers.find((l) => {
      const n = (l.name || '').toLowerCase()
      return n.includes('mouth') || n.includes('mieng') || n.includes('miệng') || n.includes('lips')
    })
    const audioAssets = project.assets.filter((a) => a.kind === 'audio')
    const firstAudio = audioAssets[0]

    let createdId: string | null = null
    useEditor.getState().update((d) => {
      const tr = addAudioTrackToProject(
        d,
        firstAudio?.id || '',
        `Thoại - ${cluster.name}`,
        cluster.inPoint,
        {
          targetType: cluster.clusterType === 'composite' ? 'character' : 'model3d',
          targetId: cluster.instanceId,
          targetName: cluster.name,
          targetShotId: cluster.layers[0]?.shotId || undefined,
          characterRole: 'voice',
          lipSyncEnabled: true,
          lipSyncLayerId: mouthLayer?.id
        }
      )
      createdId = tr.id
    }, `Gắn audio cho nhân vật: ${cluster.name}`)

    if (createdId) {
      const found = getProjectAudioTracks(useEditor.getState().project).find((t) => t.id === createdId)
      if (found) setModalTrack(found)
    }
  }

  const handleOpenAttachAudioForLayer = (layer: Layer) => {
    const existing = allAudioTracks.find((t) => t.targetType === 'layer' && t.targetId === layer.id)
    if (existing) {
      setModalTrack(existing)
      return
    }
    const audioAssets = project.assets.filter((a) => a.kind === 'audio')
    const firstAudio = audioAssets[0]

    let createdId: string | null = null
    useEditor.getState().update((d) => {
      const tr = addAudioTrackToProject(
        d,
        firstAudio?.id || '',
        `Thoại - ${layer.name}`,
        layer.inPoint,
        {
          targetType: 'layer',
          targetId: layer.id,
          targetName: layer.name,
          targetShotId: layer.shotId || undefined,
          characterRole: isMouthLayer(layer) ? 'voice' : 'sfx',
          lipSyncEnabled: isMouthLayer(layer)
        }
      )
      createdId = tr.id
    }, `Gắn audio cho layer: ${layer.name}`)

    if (createdId) {
      const found = getProjectAudioTracks(useEditor.getState().project).find((t) => t.id === createdId)
      if (found) setModalTrack(found)
    }
  }

  const toggleGroup = (id: string): void =>
    setCollapsed((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const toggleCluster = (id: string): void =>
    setCollapsedClusters((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  if (timelineTab === 'workflow') {
    return (
      <section
        className="panel timeline wf-mode-active"
        data-mcp-region="timeline"
        style={{ ['--tl-name-w' as string]: `${nameW}px` }}
      >
        <WorkflowStudioPanel />
      </section>
    )
  }

  return (
    <section
      className="panel timeline"
      data-mcp-region="timeline"
      style={{ ['--tl-name-w' as string]: `${nameW}px` }}
    >
      <TimelineToolbar
        fps={comp.fps}
        duration={comp.duration}
        playing={playing}
        loop={loop}
        zoom={zoom}
        hasSelectedLayer={!!selectedLayerId}
        setTime={setTime}
        setPlaying={setPlaying}
        setLoop={setLoop}
        setZoom={setZoom}
      />

      <TimelineLogic />
      <TimelineMotionPopup />
      <div className="tl-body" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Header: After Effects / Adobe Animate Layer Column Header & Time Ruler Viewport */}
        <div className="tl-header-row">
          <div className="tl-names-head" style={{ width: nameW }}>
            <span className="tl-names-head-left">
              <span className="tl-head-col-idx">#</span>
              <span>TÊN LAYER / CẢNH</span>
            </span>
            <span className="tl-names-head-meta">
              <span title="Độ sâu 3D (Z depth)">Z</span>
              <span title="Ẩn / Hiện (Visibility)">👁</span>
              <span title="Khóa layer (Lock)">🔒</span>
            </span>
          </div>

          <div
            className="tl-ruler-viewport"
            ref={rulerScrollRef}
            onScroll={onRulerScroll}
            onWheel={handleTimelineWheel}
          >
            <div
              className="tl-ruler"
              ref={trackRef}
              style={{ width: contentW }}
              onPointerDown={scrub}
              onDragOver={handleTimelineDragOver}
              onDrop={handleTimelineDrop}
            >
              {/* After Effects Work Area Bar */}
              <div
                className="tl-work-area-bar"
                style={{ left: x(0), width: Math.max(8, x(comp.duration) - x(0)) }}
                title={`Work Area: 0.0s → ${comp.duration.toFixed(1)}s (${Math.round(comp.duration * comp.fps)} frames @ ${comp.fps}fps)`}
              >
                <span className="tl-work-area-cap l" />
                <span className="tl-work-area-cap r" />
              </div>

              {ticks.map((tk, i) => (
                <div
                  key={i}
                  className={`tick ${tk.major ? 'major' : ''}`}
                  style={{ left: x(tk.t), height: tk.major ? 10 : 5 }}
                >
                  {tk.major && (x(tk.t) <= contentW - 72 || i === 0 || x(tk.t) - x(prevMajorT(i)) >= 140) && (
                    <span className={`tick-label${x(tk.t) > contentW - 72 ? ' end' : ''}`}>
                      <span className="tick-sec">
                        {tk.t % 1 === 0 ? `${tk.t}s` : `${tk.t.toFixed(1)}s`}
                      </span>
                      <span className="tick-frame">{Math.round(tk.t * comp.fps)}f</span>
                    </span>
                  )}
                </div>
              ))}
              <TimelineRulerPlayhead x={x} />
            </div>
          </div>

          {scrollbarW > 0 && (
            <div
              style={{
                width: scrollbarW,
                flex: 'none',
                background: 'var(--bg-1)',
                borderLeft: '1px solid var(--line-soft)'
              }}
            />
          )}
        </div>

        {/* Rows Scroll Area */}
        <div
          className="tl-scroll"
          ref={rowsScrollRef}
          onScroll={onRowsScroll}
          onWheel={handleTimelineWheel}
          onDragOver={handleTimelineDragOver}
          onDrop={handleTimelineDrop}
          style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative' }}
        >
          <div style={{ width: nameW + contentW, minWidth: '100%', position: 'relative' }}>
            {/* Vertical Time & Frame Grid Lines (Adobe After Effects / Animate Grid) */}
            <div
              className="tl-grid-overlay"
              style={{ left: nameW, width: contentW }}
              aria-hidden="true"
            >
              {ticks.map((tk, i) => (
                <div
                  key={i}
                  className={`tl-grid-line${tk.major ? ' major' : ''}`}
                  style={{ left: x(tk.t) }}
                />
              ))}
            </div>

            {/* Camera Waypoints & Active Scene Strip */}
            <TimelineCameraRows
              project={project}
              camOpen={camOpen}
              contentW={contentW}
              shotById={shotById}
              x={x}
              onToggleCamOpen={() => toggle('camera')}
              onTrackPointerDown={handleTrackPointerDown}
              onStartCameraWaypointDrag={startCameraWaypointDrag}
              renderKeys={renderKeys}
            />

            {globalAudioTracks.map((track, idx) => (
              <AudioRow
                key={track.id}
                track={track}
                trackIndex={idx}
                totalTracks={globalAudioTracks.length}
                x={x}
                trackW={contentW}
              />
            ))}

            {clusteredGroups.map((g) => {
              const shot = g.shot
              const gid = shot?.id ?? '__global'
              const isCollapsed = collapsed.has(gid)
              const shotOpen = shot ? expanded.has('shotkeys:' + shot.id) : false
              const shotAnims = shot ? SHOT_PROPS.map((p) => shot[p.prop] as Animatable<AnimValue>) : []
              return (
                <div key={gid} className="tl-group" style={shot ? ({ ['--c' as string]: shot.color } as React.CSSProperties) : undefined}>
                  {project.shots.length > 0 && (
                    <TimelineRow
                      className="group"
                      trackWidth={contentW}
                      onTrackPointerDown={handleTrackPointerDown}
                      selected={!!shot && shot.id === selectedShotId}
                      onClick={() => selectShot(shot ? shot.id : null)}
                      name={
                        <div className="tl-name group" id={`tl-group-${gid}`}>
                          <button className="mini" onClick={(e) => (e.stopPropagation(), toggleGroup(gid))}>
                            <IconCaret className={`caret${isCollapsed ? '' : ' open'}`} />
                          </button>
                          <span className="tl-index-col">
                            {shot ? `C${project.shots.findIndex((s) => s.id === shot.id) + 1}` : 'GLB'}
                          </span>
                          <span className="ico" style={{ background: shot?.color ?? '#64748b' }}>
                            <IconFilm width={11} height={11} />
                          </span>
                          <span className="label">{shot ? shot.name : 'Layer chung'}</span>
                          {shot && (
                            <button
                              className={`mini${shotOpen ? ' active' : ''}`}
                              title="Keyframe vị trí / xoay của cảnh"
                              onClick={(e) => (e.stopPropagation(), toggle('shotkeys:' + shot.id))}
                            >
                              ◆
                            </button>
                          )}
                          <span className="depth" title="Số layer trong cảnh">
                            {g.layers.length} lớp
                          </span>
                        </div>
                      }
                      track={
                        shot ? (
                          <>
                            <div className="tl-group-track-ribbon">
                              <span className="tl-group-ribbon-label">
                                🎬 {shot.name} · {g.layers.length} lớp 2.5D
                              </span>
                              <button
                                type="button"
                                className="tl-group-add-logic-btn"
                                title={`Thêm Logic cho toàn bộ "${shot.name}"`}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  selectShot(shot.id)
                                  window.dispatchEvent(
                                    new CustomEvent('pxs:open-timeline-logic-picker', {
                                      detail: { category: 'all' }
                                    })
                                  )
                                }}
                              >
                                + Logic cảnh
                              </button>
                            </div>
                            {summaryKeys(shotAnims)}
                          </>
                        ) : null
                      }
                    />
                  )}
                  {shot &&
                    shotOpen &&
                    SHOT_PROPS.map((p) => (
                      <TimelineRow
                        key={p.prop}
                        sub
                        trackWidth={contentW}
                        onTrackPointerDown={handleTrackPointerDown}
                        name={<div className="tl-name sub">{p.label}</div>}
                        track={renderKeys(shot[p.prop] as Animatable<AnimValue>, { kind: 'shot', shotId: shot.id, prop: p.prop })}
                      />
                    ))}
                  {!isCollapsed &&
                    g.items.map((item) => {
                      if (item.kind === 'cluster') {
                        const isClusterCollapsed = collapsedClusters.has(item.instanceId)
                        return (
                          <div key={`cluster-${item.instanceId}`} className="tl-cluster-group">
                            <TimelineClusterRow
                              cluster={item}
                              isCollapsed={isClusterCollapsed}
                              isSelected={item.layers.some((l) => l.id === selectedLayerId)}
                              trackWidth={contentW}
                              x={x}
                              onToggleCollapse={() => toggleCluster(item.instanceId)}
                              onSelect={() => {
                                if (item.rootLayerId) selectLayer(item.rootLayerId)
                                else if (item.layers[0]) selectLayer(item.layers[0].id)
                              }}
                              onManageAudio={(tr) => setModalTrack(tr)}
                              onOpenAttachAudio={() => handleOpenAttachAudioForCluster(item)}
                              onTrackPointerDown={handleTrackPointerDown}
                              summaryKeys={summaryKeys}
                            />
                            {!isClusterCollapsed && (
                              <>
                                {item.audioTracks?.map((aTrack) => (
                                  <AudioRow
                                    key={aTrack.id}
                                    track={aTrack}
                                    nested={true}
                                    clusterRole="child"
                                    x={x}
                                    trackW={contentW}
                                  />
                                ))}
                                {item.layers.map((layer) => (
                                  <TimelineLayerRow
                                    key={layer.id}
                                    layer={layer}
                                    layerIndex={layerOrderMap.get(layer.id)}
                                    nested={project.shots.length > 0 && !!shot}
                                    clusterRole="child"
                                    clusterType={item.clusterType}
                                    clusterName={item.name}
                                    isOpen={expanded.has(layer.id)}
                                    isSelected={layer.id === selectedLayerId}
                                    isRenaming={renaming === layer.id}
                                    x={x}
                                    trackWidth={contentW}
                                    onTrackPointerDown={handleTrackPointerDown}
                                    onBarContextMenu={handleLayerContextMenu}
                                    onToggleOpen={() => toggle(layer.id)}
                                    onSelect={() => selectLayer(layer.id)}
                                    setRenaming={setRenaming}
                                    startBarDrag={startBarDrag}
                                    startKeyDrag={startKeyDrag}
                                    renderKeys={renderKeys}
                                    summaryKeys={summaryKeys}
                                  />
                                ))}
                              </>
                            )}
                          </div>
                        )
                      }

                      const layer = item.layer
                      return (
                        <div key={layer.id} className="tl-single-layer-group">
                          <TimelineLayerRow
                            layer={layer}
                            layerIndex={layerOrderMap.get(layer.id)}
                            nested={project.shots.length > 0 && !!shot}
                            isOpen={expanded.has(layer.id)}
                            isSelected={layer.id === selectedLayerId}
                            isRenaming={renaming === layer.id}
                            hasAudio={Boolean(item.audioTracks && item.audioTracks.length > 0)}
                            audioCount={item.audioTracks?.length || 0}
                            audioTracks={item.audioTracks}
                            onManageAudio={(tr) => setModalTrack(tr || (item.audioTracks?.[0] ?? null))}
                            onOpenAttachAudio={() => handleOpenAttachAudioForLayer(layer)}
                            x={x}
                            trackWidth={contentW}
                            onTrackPointerDown={handleTrackPointerDown}
                            onBarContextMenu={handleLayerContextMenu}
                            onToggleOpen={() => toggle(layer.id)}
                            onSelect={() => selectLayer(layer.id)}
                            setRenaming={setRenaming}
                            startBarDrag={startBarDrag}
                            startKeyDrag={startKeyDrag}
                            renderKeys={renderKeys}
                            summaryKeys={summaryKeys}
                          />
                          {item.audioTracks?.map((aTrack) => (
                            <AudioRow
                              key={aTrack.id}
                              track={aTrack}
                              nested={true}
                              clusterRole="child"
                              x={x}
                              trackW={contentW}
                            />
                          ))}
                        </div>
                      )
                    })}
                </div>
              )
            })}
            {project.layers.length === 0 && (
              <div className="empty">Chưa có layer. Thêm ảnh, text, solid hoặc particles từ thanh công cụ.</div>
            )}

            {/* Playhead vertical line passing through all tracks */}
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: nameW, width: contentW, pointerEvents: 'none' }}>
              <TimelinePlayhead x={x} />
            </div>
          </div>
        </div>
      </div>

      {modalTrack && (
        <AudioTargetModal track={modalTrack} onClose={() => setModalTrack(null)} />
      )}
    </section>
  )
}
