import { useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import type { Animatable, AnimValue, Layer } from '@shared/types'
import { formatTimecode, snapToFrame } from '../animation/math'
import { evaluate } from '../animation/keyframes'
import { deleteSelectedLayer, duplicateSelectedLayer, moveLayer } from '../actions'
import { getAudioPeaks } from '../project/audioPeaks'
import { assetStore } from '../project/assets'
import { getAnimatable, getDraftAnimatable, useEditor, type CameraProp, type LayerProp, type PropRef } from '../store/editor'
import {
  IconCamera,
  IconCaret,
  IconCopy,
  IconDown,
  IconEye,
  IconLock,
  IconLoop,
  IconMusic,
  IconPause,
  IconPlay,
  IconSkipEnd,
  IconSkipStart,
  IconStepBack,
  IconStepFwd,
  IconTrash,
  IconUp
} from './icons'
import { TYPE_COLORS } from './TopView'

const NAME_W = 268
const PAD = 10

const LAYER_PROPS: { prop: LayerProp; label: string }[] = [
  { prop: 'position', label: 'Vị trí' },
  { prop: 'rotation', label: 'Xoay' },
  { prop: 'scale', label: 'Scale' },
  { prop: 'opacity', label: 'Opacity' }
]
const CAMERA_PROPS: { prop: CameraProp; label: string }[] = [
  { prop: 'position', label: 'Vị trí' },
  { prop: 'target', label: 'Điểm nhìn' },
  { prop: 'fov', label: 'FOV' },
  { prop: 'focusDistance', label: 'Khoảng focus' },
  { prop: 'aperture', label: 'Khẩu độ' }
]
const TYPE_LETTER: Record<Layer['type'], string> = { image: 'IMG', text: 'T', solid: 'S', particles: '✦' }

export function Timeline() {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const playing = useEditor((s) => s.playing)
  const loop = useEditor((s) => s.loop)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)
  const { setTime, setPlaying, setLoop, selectLayer } = useEditor.getState()
  const { comp } = project

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [trackW, setTrackW] = useState(800)

  useEffect(() => {
    const el = trackRef.current!
    const ro = new ResizeObserver(() => setTrackW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const x = (t: number): number => PAD + (t / comp.duration) * (trackW - PAD * 2)
  const tAt = (px: number): number => ((px - PAD) / (trackW - PAD * 2)) * comp.duration
  const toggle = (id: string): void =>
    setExpanded((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

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

  // ---------------------------------------------------------------- ticks

  const ticks = useMemo(() => {
    const pxPerSec = (trackW - PAD * 2) / comp.duration
    const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60]
    const major = steps.find((s) => s * pxPerSec >= 70) ?? 60
    const out: { t: number; major: boolean }[] = []
    const minor = major / 5
    for (let t = 0; t <= comp.duration + 1e-6; t += minor) {
      out.push({ t, major: Math.abs(t / major - Math.round(t / major)) < 1e-4 })
    }
    return out
  }, [trackW, comp.duration])

  // ---------------------------------------------------------------- keyframe drag

  const startKeyDrag = (e: React.PointerEvent, ref: PropRef, keyId: string): void => {
    e.stopPropagation()
    const st = useEditor.getState()
    st.selectKey({ ref, keyId })
    if (ref.kind === 'layer') st.selectLayer(ref.layerId)
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
      const dt = ((ev.clientX - startX) / (trackW - PAD * 2)) * comp.duration
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

  // ---------------------------------------------------------------- layer bar drag

  const startBarDrag = (e: React.PointerEvent, layer: Layer, mode: 'move' | 'in' | 'out'): void => {
    e.stopPropagation()
    selectLayer(layer.id)
    if (layer.locked) return
    const startX = e.clientX
    const { inPoint, outPoint } = layer
    const key = `bar-${nanoid(6)}`
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent): void => {
      const dt = snapToFrame(((ev.clientX - startX) / (trackW - PAD * 2)) * comp.duration, comp.fps)
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
    const up = (): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
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

  return (
    <section className="panel timeline">
      <div className="transport">
        <button id="tl-start" className="btn ghost icon" title="Về đầu (Home)" onClick={() => setTime(0)}>
          <IconSkipStart />
        </button>
        <button id="tl-prev" className="btn ghost icon" title="Lùi 1 frame (←)" onClick={() => setTime(snapToFrame(time - 1 / comp.fps, comp.fps))}>
          <IconStepBack />
        </button>
        <button
          id="tl-play"
          className="btn primary icon"
          title="Phát / Dừng (Space)"
          onClick={() => {
            if (!playing && time >= comp.duration - 1e-3) setTime(0)
            setPlaying(!playing)
          }}
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <button id="tl-next" className="btn ghost icon" title="Tiến 1 frame (→)" onClick={() => setTime(snapToFrame(time + 1 / comp.fps, comp.fps))}>
          <IconStepFwd />
        </button>
        <button id="tl-end" className="btn ghost icon" title="Về cuối (End)" onClick={() => setTime(comp.duration)}>
          <IconSkipEnd />
        </button>
        <button id="tl-loop" className={`btn ghost icon${loop ? ' active' : ''}`} title="Lặp lại" onClick={() => setLoop(!loop)}>
          <IconLoop />
        </button>
        <div className="timecode">
          {formatTimecode(time, comp.fps)}
          <small>
            {Math.round(time * comp.fps)} / {Math.round(comp.duration * comp.fps)}f
          </small>
        </div>
        <span style={{ flex: 1 }} />
        <span className="hint-text">Kéo ◆ để đổi thời điểm · Double-click ◆ để nhảy tới · Del để xoá</span>
      </div>

      <div className="tl-body" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* header */}
        <div style={{ display: 'flex', flex: 'none' }}>
          <div className="tl-names-head" style={{ width: NAME_W, borderRight: '1px solid var(--line-soft)' }}>
            Layer · Z
          </div>
          <div className="tl-ruler" ref={trackRef} style={{ flex: 1 }} onPointerDown={scrub}>
            {ticks.map((tk, i) => (
              <div key={i} className="tick" style={{ left: x(tk.t), height: tk.major ? 10 : 5 }}>
                {tk.major && <span className="tick-label">{tk.t % 1 === 0 ? `${tk.t}s` : `${tk.t.toFixed(1)}s`}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* rows */}
        <div className="tl-scroll" style={{ flex: 1 }}>
          {/* camera */}
          <Row
            selected={false}
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
              <Row
                key={p.prop}
                sub
                name={<div className="tl-name sub">{p.label}</div>}
                track={renderKeys(project.camera[p.prop] as Animatable<AnimValue>, { kind: 'camera', prop: p.prop })}
              />
            ))}

          {project.audio && <AudioRow x={x} trackW={trackW} />}

          {project.layers.map((layer) => {
            const open = expanded.has(layer.id)
            const sel = layer.id === selectedLayerId
            const anims = LAYER_PROPS.map((p) => layer.transform[p.prop] as Animatable<AnimValue>)
            const color = TYPE_COLORS[layer.type]
            return (
              <div key={layer.id}>
                <Row
                  selected={sel}
                  onClick={() => selectLayer(layer.id)}
                  name={
                    <div className="tl-name">
                      <button className="mini" onClick={(e) => (e.stopPropagation(), toggle(layer.id))}>
                        <IconCaret className={`caret${open ? ' open' : ''}`} />
                      </button>
                      <span className="ico" style={{ background: color }}>
                        {TYPE_LETTER[layer.type]}
                      </span>
                      <span className="label" onDoubleClick={() => setRenaming(layer.id)}>
                        {renaming === layer.id ? (
                          <input
                            autoFocus
                            defaultValue={layer.name}
                            onKeyDown={(e) => {
                              e.stopPropagation()
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                              if (e.key === 'Escape') setRenaming(null)
                            }}
                            onBlur={(e) => {
                              const v = e.target.value.trim()
                              if (v) useEditor.getState().update((d) => void (d.layers.find((l) => l.id === layer.id)!.name = v))
                              setRenaming(null)
                            }}
                          />
                        ) : (
                          layer.name
                        )}
                      </span>
                      <span className="row-actions">
                        <button className="mini" title="Lên trên" onClick={(e) => (e.stopPropagation(), moveLayer(layer.id, -1))}>
                          <IconUp />
                        </button>
                        <button className="mini" title="Xuống dưới" onClick={(e) => (e.stopPropagation(), moveLayer(layer.id, 1))}>
                          <IconDown />
                        </button>
                        <button
                          className="mini"
                          title="Nhân bản (Ctrl+D)"
                          onClick={(e) => {
                            e.stopPropagation()
                            selectLayer(layer.id)
                            duplicateSelectedLayer()
                          }}
                        >
                          <IconCopy />
                        </button>
                        <button
                          className="mini"
                          title="Xoá (Del)"
                          onClick={(e) => {
                            e.stopPropagation()
                            selectLayer(layer.id)
                            deleteSelectedLayer()
                          }}
                        >
                          <IconTrash />
                        </button>
                      </span>
                      <span className="depth">{Math.round(evaluate(layer.transform.position, time)[2])}</span>
                      <button
                        className={`mini${layer.visible ? '' : ' off'}`}
                        title="Ẩn / hiện"
                        onClick={(e) => {
                          e.stopPropagation()
                          useEditor.getState().update((d) => {
                            const l = d.layers.find((q) => q.id === layer.id)!
                            l.visible = !l.visible
                          })
                        }}
                      >
                        <IconEye />
                      </button>
                      <button
                        className={`mini${layer.locked ? '' : ' off'}`}
                        title="Khoá"
                        onClick={(e) => {
                          e.stopPropagation()
                          useEditor.getState().update((d) => {
                            const l = d.layers.find((q) => q.id === layer.id)!
                            l.locked = !l.locked
                          })
                        }}
                      >
                        <IconLock />
                      </button>
                    </div>
                  }
                  track={
                    <>
                      <div
                        className="tl-bar"
                        style={{
                          left: x(layer.inPoint),
                          width: Math.max(4, x(layer.outPoint) - x(layer.inPoint)),
                          background: `linear-gradient(180deg, ${color}55, ${color}30)`,
                          border: `1px solid ${color}${sel ? 'ff' : '66'}`,
                          opacity: layer.visible ? 0.95 : 0.35
                        }}
                        onPointerDown={(e) => startBarDrag(e, layer, 'move')}
                      >
                        <div className="handle l" onPointerDown={(e) => startBarDrag(e, layer, 'in')} />
                        <div className="handle r" onPointerDown={(e) => startBarDrag(e, layer, 'out')} />
                      </div>
                      {summaryKeys(anims)}
                    </>
                  }
                />
                {open &&
                  LAYER_PROPS.map((p) => (
                    <Row
                      key={p.prop}
                      sub
                      selected={sel}
                      name={<div className="tl-name sub">{p.label}</div>}
                      track={renderKeys(layer.transform[p.prop] as Animatable<AnimValue>, {
                        kind: 'layer',
                        layerId: layer.id,
                        prop: p.prop
                      })}
                    />
                  ))}
              </div>
            )
          })}
          {project.layers.length === 0 && (
            <div className="empty">Chưa có layer. Thêm ảnh, text, solid hoặc particles từ thanh công cụ.</div>
          )}
        </div>

        {/* playhead */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: NAME_W, right: 0, pointerEvents: 'none' }}>
          <div className="playhead" style={{ left: x(time) }} />
        </div>
      </div>
    </section>
  )
}

function Row({
  name,
  track,
  sub,
  selected,
  onClick
}: {
  name: React.ReactNode
  track: React.ReactNode
  sub?: boolean
  selected?: boolean
  onClick?: () => void
}) {
  return (
    <div className={`tl-row${sub ? ' sub' : ''}${selected ? ' selected' : ''}`} onPointerDown={onClick}>
      <div style={{ width: NAME_W, flex: 'none', height: '100%', display: 'flex', alignItems: 'center', borderRight: '1px solid var(--line-soft)' }}>
        {name}
      </div>
      <div style={{ flex: 1, position: 'relative', height: '100%' }}>{track}</div>
    </div>
  )
}

function AudioRow({ x, trackW }: { x: (t: number) => number; trackW: number }) {
  const audio = useEditor((s) => s.project.audio)!
  const duration = useEditor((s) => s.project.comp.duration)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const meta = assetStore.get(audio.assetId)?.meta
  const audioDur = meta?.duration ?? 0
  const left = x(audio.offset)
  const width = Math.max(4, x(audio.offset + audioDur) - left)

  useEffect(() => {
    let alive = true
    getAudioPeaks(audio.assetId).then((peaks) => {
      const c = canvasRef.current
      if (!alive || !c || peaks.length === 0) return
      const w = Math.max(1, Math.min(8000, Math.round(width)))
      const h = 20
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')!
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#3dd6f5'
      for (let i = 0; i < w; i++) {
        const v = peaks[Math.floor((i / w) * peaks.length)] * audio.volume
        const bh = Math.max(1, v * h)
        ctx.fillRect(i, (h - bh) / 2, 1, bh)
      }
    })
    return () => {
      alive = false
    }
  }, [audio.assetId, audio.volume, width])

  const drag = (e: React.PointerEvent): void => {
    const startX = e.clientX
    const start = audio.offset
    const key = `audio-${nanoid(6)}`
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent): void => {
      const dt = ((ev.clientX - startX) / (trackW - PAD * 2)) * duration
      useEditor.getState().update((d) => void (d.audio && (d.audio.offset = Math.round((start + dt) * 100) / 100)), key)
    }
    const up = (): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  return (
    <Row
      name={
        <div className="tl-name">
          <span style={{ width: 20 }} />
          <span className="ico" style={{ background: '#4ade80' }}>
            <IconMusic width={11} height={11} />
          </span>
          <span className="label">{meta?.name ?? 'Audio'}</span>
        </div>
      }
      track={
        <div
          className="tl-bar"
          title="Kéo để dời thời điểm bắt đầu nhạc"
          style={{ left, width, background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.4)', overflow: 'hidden' }}
          onPointerDown={drag}
        >
          <canvas ref={canvasRef} className="audio-wave" style={{ width: '100%', height: 'calc(100% - 6px)' }} />
        </div>
      }
    />
  )
}
