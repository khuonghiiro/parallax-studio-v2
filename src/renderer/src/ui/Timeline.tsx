import { useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import type { Animatable, AnimValue, Layer, Shot } from '@shared/types'
import { snapToFrame } from '../animation/math'
import { getAnimatable, getDraftAnimatable, useEditor, type PropRef } from '../store/editor'
import { IconCamera, IconCaret, IconFilm } from './icons'
import { CAMERA_PROPS, PAD, SHOT_PROPS, NAME_W, shotSegments } from './timeline/timelineTypes'
import { TimelineRow } from './timeline/TimelineRow'
import { AudioRow } from './timeline/AudioRow'
import { TimelineToolbar } from './timeline/TimelineToolbar'
import { TimelineLayerRow } from './timeline/TimelineLayerRow'
import { openFxPresetMenu } from './timeline/FxPresetMenu'
import {
  addKeyframeForSelectedLayer,
  setSelectedLayerInPoint,
  setSelectedLayerOutPoint,
  splitSelectedLayer
} from './timeline/timelineActions'

export function Timeline() {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const playing = useEditor((s) => s.playing)
  const loop = useEditor((s) => s.loop)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)
  const selectedShotId = useEditor((s) => s.selectedShotId)
  const { setTime, setPlaying, setLoop, selectLayer, selectShot } = useEditor.getState()
  const { comp } = project

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)
  const [zoom, setZoom] = useState<number>(1)

  const trackRef = useRef<HTMLDivElement>(null)
  const rulerScrollRef = useRef<HTMLDivElement>(null)
  const rowsScrollRef = useRef<HTMLDivElement>(null)
  const [trackW, setTrackW] = useState(800)

  useEffect(() => {
    const el = rulerScrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setTrackW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const contentW = Math.max(trackW, Math.round((trackW - PAD * 2) * zoom + PAD * 2))
  const x = (t: number): number => PAD + (t / comp.duration) * (contentW - PAD * 2)
  const tAt = (px: number): number => ((px - PAD) / (contentW - PAD * 2)) * comp.duration

  const toggle = (id: string): void =>
    setExpanded((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  // Synchronize horizontal scrolling between Ruler and Rows Track Viewport
  const onRowsScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    if (rulerScrollRef.current) {
      rulerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  // Alt + MouseWheel zoom on timeline
  const handleTimelineWheel = (e: React.WheelEvent): void => {
    if (e.altKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.25 : 0.25
      setZoom((z) => Math.max(1, Math.min(6, Math.round((z + delta) * 100) / 100)))
    }
  }

  // Global Timeline Keyboard Shortcuts: [ (In), ] (Out), Ctrl+Shift+D or S (Split), K (Keyframe), +/- (Zoom)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }

      if (e.key === '[') {
        e.preventDefault()
        setSelectedLayerInPoint()
      } else if (e.key === ']') {
        e.preventDefault()
        setSelectedLayerOutPoint()
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        splitSelectedLayer()
      } else if (e.key === 's' || e.key === 'S') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          splitSelectedLayer()
        }
      } else if (e.key === 'k' || e.key === 'K') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          addKeyframeForSelectedLayer()
        }
      } else if (e.key === '=' || e.key === '+') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          setZoom((z) => Math.min(6, Math.round((z + 0.25) * 100) / 100))
        }
      } else if (e.key === '-' || e.key === '_') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          setZoom((z) => Math.max(1, Math.round((z - 0.25) * 100) / 100))
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ---------------------------------------------------------------- scrubbing

  const scrub = (e: React.PointerEvent): void => {
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    const apply = (cx: number): void => setTime(snapToFrame(tAt(cx - rect.left), comp.fps))
    setPlaying(false)
    apply(e.clientX)
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent): void => apply(ev.clientX)
    const up = (): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  // Click on any track empty background to jump playhead
  const handleTrackPointerDown = (e: React.PointerEvent): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickedTime = Math.max(0, Math.min(comp.duration, snapToFrame(tAt(clickX), comp.fps)))
    setTime(clickedTime)
  }

  // Right-click on layer bar or track to open FX preset popup at that exact time
  const handleLayerContextMenu = (e: React.MouseEvent, layer: Layer): void => {
    e.preventDefault()
    e.stopPropagation()
    selectLayer(layer.id)

    const trackCol = (e.currentTarget as HTMLElement).closest('.tl-row-track-col')
    let clickedTime = time
    if (trackCol) {
      const rect = trackCol.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      clickedTime = Math.max(0, Math.min(comp.duration, snapToFrame(tAt(clickX), comp.fps)))
    } else {
      clickedTime = Math.max(layer.inPoint, Math.min(layer.outPoint, time))
    }

    setTime(clickedTime)

    openFxPresetMenu({
      x: e.clientX,
      y: e.clientY,
      targetTime: clickedTime,
      from: 'context',
      layerName: layer.name
    })
  }

  // ---------------------------------------------------------------- ticks

  const ticks = useMemo(() => {
    const pxPerSec = (contentW - PAD * 2) / comp.duration
    const steps = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60]
    const major = steps.find((s) => s * pxPerSec >= 70) ?? 60
    const out: { t: number; major: boolean }[] = []
    const minor = major >= 0.5 ? major / 5 : major / 2
    for (let t = 0; t <= comp.duration + 1e-6; t += minor) {
      out.push({ t, major: Math.abs(t / major - Math.round(t / major)) < 1e-4 })
    }
    return out
  }, [contentW, comp.duration])

  // ---------------------------------------------------------------- keyframe drag

  const startKeyDrag = (e: React.PointerEvent, ref: PropRef, keyId: string): void => {
    e.stopPropagation()
    const st = useEditor.getState()
    st.selectKey({ ref, keyId })
    if (ref.kind === 'layer') st.selectLayer(ref.layerId)
    if (ref.kind === 'shot') st.selectShot(ref.shotId)
    st.selectKey({ ref, keyId })
    st.setInspectorTab(ref.kind === 'camera' ? 'camera' : 'layer')
    const a = getAnimatable(st.project, ref)
    const k = a?.keyframes.find((kk) => kk.id === keyId)
    if (!k) return
    const startT = k.t
    const startX = e.clientX
    const key = `keydrag-${nanoid(6)}`
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent): void => {
      const dt = ((ev.clientX - startX) / (contentW - PAD * 2)) * comp.duration
      const nt = Math.max(0, Math.min(comp.duration, snapToFrame(startT + dt, comp.fps)))
      useEditor.getState().update((d) => {
        const da = getDraftAnimatable(d, ref)
        const kk = da?.keyframes.find((q) => q.id === keyId)
        if (da && kk) {
          kk.t = nt
          da.keyframes.sort((p, q) => p.t - q.t)
        }
      }, key)
    }
    const up = (): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  // ---------------------------------------------------------------- layer bar drag with click-to-playhead

  const startBarDrag = (e: React.PointerEvent, layer: Layer, mode: 'move' | 'in' | 'out'): void => {
    e.stopPropagation()
    selectLayer(layer.id)
    if (layer.locked) return
    const startX = e.clientX
    const { inPoint, outPoint } = layer
    const key = `bar-${nanoid(6)}`
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    let moved = false
    const move = (ev: PointerEvent): void => {
      if (Math.abs(ev.clientX - startX) > 3) {
        moved = true
      }
      if (!moved) return
      const dt = snapToFrame(((ev.clientX - startX) / (contentW - PAD * 2)) * comp.duration, comp.fps)
      useEditor.getState().update((d) => {
        const l = d.layers.find((q) => q.id === layer.id)
        if (!l) return
        if (mode === 'in') l.inPoint = Math.max(0, Math.min(outPoint - 1 / comp.fps, inPoint + dt))
        else if (mode === 'out') l.outPoint = Math.min(comp.duration, Math.max(inPoint + 1 / comp.fps, outPoint + dt))
        else {
          const shift = Math.max(-inPoint, Math.min(comp.duration - outPoint, dt))
          l.inPoint = inPoint + shift
          l.outPoint = outPoint + shift
        }
      }, key)
    }
    const up = (ev: PointerEvent): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      if (!moved && mode === 'move') {
        const rulerEl = trackRef.current
        if (rulerEl) {
          const rect = rulerEl.getBoundingClientRect()
          const clickedTime = Math.max(0, Math.min(comp.duration, snapToFrame(tAt(ev.clientX - rect.left), comp.fps)))
          setTime(clickedTime)
        }
      }
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  // ---------------------------------------------------------------- render helpers


  const selectedKey = useEditor((s) => s.selectedKey)
  const renderKeys = (a: Animatable<AnimValue>, ref: PropRef) =>
    a.keyframes.map((k) => (
      <div
        key={k.id}
        className={`tl-key${k.ease === 'hold' ? ' hold' : ''}${selectedKey?.keyId === k.id ? ' selected' : ''}`}
        style={{ left: x(k.t) }}
        title={`${k.t.toFixed(2)}s`}
        onPointerDown={(e) => startKeyDrag(e, ref, k.id)}
        onDoubleClick={() => setTime(k.t)}
      />
    ))

  const summaryKeys = (anims: Animatable<AnimValue>[]) => {
    const times = [...new Set(anims.flatMap((a) => a.keyframes.map((k) => Math.round(k.t * 1000) / 1000)))]
    return times.map((t) => (
      <div
        key={t}
        className="tl-key summary"
        style={{ left: x(t) }}
        onPointerDown={(e) => {
          e.stopPropagation()
          setTime(t)
        }}
      />
    ))
  }

  const cameraAnims = CAMERA_PROPS.map((p) => project.camera[p.prop] as Animatable<AnimValue>)
  const camOpen = expanded.has('camera')
  const segments = useMemo(() => (project.shots.length ? shotSegments(project) : []), [project])
  const shotById = useMemo(() => new Map(project.shots.map((s) => [s.id, s])), [project.shots])

  // Group layers: global first, then each shot in order (stack order kept inside a group).
  const groups = useMemo(() => {
    const out: { shot: Shot | null; layers: Layer[] }[] = []
    const globals = project.layers.filter((l) => !l.shotId || !shotById.has(l.shotId))
    if (globals.length || project.shots.length === 0) out.push({ shot: null, layers: globals })
    for (const s of project.shots) out.push({ shot: s, layers: project.layers.filter((l) => l.shotId === s.id) })
    return out
  }, [project.layers, project.shots, shotById])

  const toggleGroup = (id: string): void =>
    setCollapsed((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <section className="panel timeline">
      <TimelineToolbar
        time={time}
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

      <div className="tl-body" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Header: Layer names column & Time Ruler Viewport */}
        <div className="tl-header-row">
          <div
            className="tl-names-head"
            style={{ width: NAME_W }}
          >
            <span>Layer</span>
            <span style={{ display: 'inline-flex', gap: 7, color: 'var(--text-faint)', fontSize: 9.5, fontWeight: 700 }}>
              <span title="Độ sâu 3D (Z depth)">Z-Depth</span>
              <span title="Ẩn / Hiện (Visibility)">👁</span>
              <span title="Khóa layer (Lock)">🔒</span>
            </span>
          </div>

          <div
            className="tl-ruler-viewport"
            ref={rulerScrollRef}
            onWheel={handleTimelineWheel}
          >
            <div
              className="tl-ruler"
              ref={trackRef}
              style={{ width: contentW }}
              onPointerDown={scrub}
            >
              {ticks.map((tk, i) => (
                <div key={i} className={`tick ${tk.major ? 'major' : ''}`} style={{ left: x(tk.t), height: tk.major ? 9 : 5 }}>
                  {tk.major && <span className="tick-label">{tk.t % 1 === 0 ? `${tk.t}s` : `${tk.t.toFixed(1)}s`}</span>}
                </div>
              ))}
              <div className="tl-ruler-playhead" style={{ left: x(time) }} />
            </div>
          </div>
        </div>

        {/* Rows Scroll Area */}
        <div
          className="tl-scroll"
          ref={rowsScrollRef}
          onScroll={onRowsScroll}
          onWheel={handleTimelineWheel}
          style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative' }}
        >
          <div style={{ width: NAME_W + contentW, minWidth: '100%', position: 'relative' }}>
            {/* camera */}
            <TimelineRow
              selected={false}
              trackWidth={contentW}
              onTrackPointerDown={handleTrackPointerDown}
              name={
                <div className="tl-name" onClick={() => useEditor.getState().setInspectorTab('camera')}>
                  <button className="mini" onClick={(e) => (e.stopPropagation(), toggle('camera'))}>
                    <IconCaret className={`caret${camOpen ? ' open' : ''}`} />
                  </button>
                  <span className="ico" style={{ background: '#3dd6f5' }}>
                    <IconCamera width={11} height={11} />
                  </span>
                  <span className="label">Camera</span>
                </div>
              }
              track={summaryKeys(cameraAnims)}
            />
            {camOpen &&
              CAMERA_PROPS.map((p) => (
                <TimelineRow
                  key={p.prop}
                  sub
                  trackWidth={contentW}
                  onTrackPointerDown={handleTrackPointerDown}
                  name={<div className="tl-name sub">{p.label}</div>}
                  track={renderKeys(project.camera[p.prop] as Animatable<AnimValue>, { kind: 'camera', prop: p.prop })}
                />
              ))}

            {segments.length > 0 && (
              <TimelineRow
                trackWidth={contentW}
                onTrackPointerDown={handleTrackPointerDown}
                name={
                  <div className="tl-name">
                    <span style={{ width: 20 }} />
                    <span className="ico" style={{ background: '#a78bfa' }}>
                      <IconFilm width={11} height={11} />
                    </span>
                    <span className="label">Camera đang quay</span>
                  </div>
                }
                track={
                  <div className="tl-shot-strip">
                    {segments.map((seg, i) => {
                      const s = seg.id ? shotById.get(seg.id) : undefined
                      return (
                        <div
                          key={i}
                          className={`tl-shot-seg${s ? '' : ' dark'}`}
                          style={{
                            left: x(seg.t0),
                            width: Math.max(2, x(seg.t1) - x(seg.t0)),
                            ...(s ? { ['--c' as string]: s.color } : {})
                          }}
                          title={`${s ? s.name : 'Không cảnh nào'} · ${seg.t0.toFixed(2)}s → ${seg.t1.toFixed(2)}s`}
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            setTime(snapToFrame(seg.t0, comp.fps))
                            if (s) selectShot(s.id)
                          }}
                        >
                          {s ? s.name : '—'}
                        </div>
                      )
                    })}
                  </div>
                }
              />
            )}

            {project.audio && <AudioRow x={x} trackW={contentW} />}

            {groups.map((g) => {
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
                          <span className="depth" title="Số layer">
                            {g.layers.length}
                          </span>
                        </div>
                      }
                      track={shot ? summaryKeys(shotAnims) : null}
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
                    g.layers.map((layer) => (
                      <TimelineLayerRow
                        key={layer.id}
                        layer={layer}
                        isOpen={expanded.has(layer.id)}
                        isSelected={layer.id === selectedLayerId}
                        isRenaming={renaming === layer.id}
                        time={time}
                        x={x}
                        trackWidth={contentW}
                        onTrackPointerDown={handleTrackPointerDown}
                        onBarContextMenu={handleLayerContextMenu}
                        onToggleOpen={() => toggle(layer.id)}
                        onSelect={() => selectLayer(layer.id)}
                        setRenaming={setRenaming}
                        startBarDrag={startBarDrag}
                        renderKeys={renderKeys}
                        summaryKeys={summaryKeys}
                      />
                    ))}
                </div>
              )
            })}
            {project.layers.length === 0 && (
              <div className="empty">Chưa có layer. Thêm ảnh, text, solid hoặc particles từ thanh công cụ.</div>
            )}

            {/* Playhead vertical line passing through all tracks */}
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: NAME_W, width: contentW, pointerEvents: 'none' }}>
              <div className="playhead" style={{ left: x(time) }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

