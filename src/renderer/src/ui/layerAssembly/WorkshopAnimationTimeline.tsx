import { useMemo, useState, type PointerEvent } from 'react'
import type { BoneEasing, LayerRig } from '@shared/layerRig'
import type { useLayerWorkshop } from './useLayerWorkshop'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import { applyRigAction, ensureRigClips, type RigAction } from './workshopRig'
import { sameKeyTime } from './workshopAnimation'
import { adjacentKeyTime, timelineTime } from './workshopTimeline'
import { useWorkshopKeyDrag } from './useWorkshopKeyDrag'
import { useEditor } from '../../store/editor'
import { setAnimAssist, useAnimAssist, type DopeSheetTrackFilter } from './animAssistStore'
import {
  classifyBoneSide,
  collectMasterPoseTimes,
  computeBoneDepthMap,
  computeTweenSpans
} from './mohoRigHelpers'
import { IconAutoKeyRec } from './LayerWorkshopStudioIcons'
import '../../styles/layerWorkshopTimeline.css'

interface Props {
  state: ReturnType<typeof useLayerWorkshop>
  playback: ReturnType<typeof useWorkshopPlayback>
  boneId: string | null
  selectBone: (id: string | null) => void
}

const QUICK_EASINGS: Array<{ id: BoneEasing; label: string; title: string }> = [
  { id: 'smooth', label: 'Mượt', title: 'Motion Tween mượt tự nhiên (Smooth Spline)' },
  { id: 'linear', label: 'Đều', title: 'Chuyển động tốc độ đều (Linear Tween)' },
  { id: 'ease-out', label: 'Giảm tốc', title: 'Nhanh đầu, chậm dần cuối (Ease Out)' },
  { id: 'ease-in', label: 'Tăng tốc', title: 'Chậm đầu, nhanh dần cuối (Ease In)' },
  { id: 'hold', label: 'Giữ bậc', title: 'Giữ nguyên tư thế đến mốc kế tiếp (Step / Hold Frame)' }
]

const FILTER_OPTIONS: Array<{ id: DopeSheetTrackFilter; label: string; title: string }> = [
  { id: 'all', label: 'Tất cả', title: 'Hiện toàn bộ xương trên Dope Sheet' },
  { id: 'keyed', label: 'Có Key', title: 'Chỉ hiện các xương đã có Keyframe' },
  { id: 'selected', label: 'Đang chọn', title: 'Chỉ hiện xương đang chọn' }
]

export function WorkshopAnimationTimeline(props: Props) {
  const rig = props.state.composite.rig
  if (!rig?.bones.length) return null
  return (
    <AnimationTimeline
      key={`${props.state.composite.id}:${rig.activeClipId}`}
      {...props}
      rig={ensureRigClips(rig).rig}
    />
  )
}

function AnimationTimeline({ state, playback, boneId, selectBone, rig }: Props & { rig: LayerRig }) {
  const projectFps = useEditor((s) => s.project.comp.fps) || 30
  const fps = rig.fps || projectFps
  const assist = useAnimAssist()
  const [zoom, setZoom] = useState(1)
  const [collapsed, setCollapsed] = useState(false)
  const [error, setError] = useState('')

  const seek = (time: number) => {
    playback.setIsPlaying(false)
    playback.setTime(Math.max(0, Math.min(rig.duration, Number(time.toFixed(4)))))
  }

  const stepFrame = (deltaFrames: -1 | 1) => {
    const dt = 1 / Math.max(1, fps)
    const curFrame = Math.round(playback.time * fps)
    seek((curFrame + deltaFrames) * dt)
  }

  const run = (action: RigAction) => {
    try {
      state.setComposite((c) => applyRigAction(c, action))
      setError('')
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  const drag = useWorkshopKeyDrag(
    rig.duration,
    fps,
    seek,
    (key) => {
      selectBone(key.boneId)
      seek(key.time)
    },
    run
  )

  const depthMap = useMemo(() => computeBoneDepthMap(rig.bones), [rig.bones])
  const masterPoseTimes = useMemo(() => collectMasterPoseTimes(rig), [rig])

  const bones = useMemo(() => {
    if (assist.dopeFilter === 'selected') {
      return boneId ? rig.bones.filter((b) => b.id === boneId) : rig.bones
    }
    if (assist.dopeFilter === 'keyed') {
      const keyed = rig.bones.filter((b) => (rig.tracks[b.id]?.length ?? 0) > 0 || b.id === boneId)
      return keyed.length > 0 ? keyed : rig.bones
    }
    return rig.bones
  }, [rig.bones, rig.tracks, assist.dopeFilter, boneId])

  const selectedKey = boneId ? rig.tracks[boneId]?.find((k) => sameKeyTime(k.time, playback.time)) : undefined

  const remove = () => {
    if (boneId && selectedKey) {
      run({ action: 'delete-key', boneId, time: selectedKey.time })
    }
  }

  const jump = (direction: -1 | 1) => {
    const targetBone = assist.dopeFilter === 'selected' ? boneId : undefined
    const time = adjacentKeyTime(rig, playback.time, direction, targetBone)
    if (time !== undefined) seek(time)
  }

  const rewind = () => seek(0)

  const addKey = () => {
    if (boneId) {
      run({ action: 'set-key', boneId, key: { time: playback.time } })
    }
  }

  const holdThreeFrames = () => {
    const holdSeconds = Number((3 / Math.max(4, fps)).toFixed(4))
    if (run({ action: 'hold-frames', time: playback.time, holdSeconds, boneId: boneId ?? undefined })) {
      playback.setTime(Math.min(120, Number((playback.time + holdSeconds).toFixed(4))))
    }
  }

  const applyQuickEasing = (easing: BoneEasing) => {
    if (!boneId) return
    if (selectedKey) {
      run({ action: 'set-interpolation', boneId, time: selectedKey.time, easing })
    } else {
      run({ action: 'set-key', boneId, key: { time: playback.time, easing } })
    }
  }

  const scrub = (event: PointerEvent<HTMLDivElement>) => {
    if (event.type === 'pointermove' && !(event.buttons & 1)) return
    if (event.type === 'pointerdown') event.currentTarget.setPointerCapture(event.pointerId)
    const rect = event.currentTarget.getBoundingClientRect()
    seek(timelineTime(event.clientX, rect.left, rect.width, rig.duration, fps, !event.altKey))
  }

  const playheadPct = Math.max(0, Math.min(100, (playback.time / rig.duration) * 100))
  const totalFrames = Math.max(2, Math.round(rig.duration * fps))
  const rulerTicks = 8

  return (
    <section
      className={`lw-animation-timeline${collapsed ? ' is-collapsed' : ''}`}
      data-mcp-region="layer_assembly_dopesheet"
      aria-label="Dope Sheet Timeline từng xương"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          drag.cancel()
        } else if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'F7') {
          e.preventDefault()
          e.stopPropagation()
          remove()
        } else if (e.key === 'F6') {
          e.preventDefault()
          e.stopPropagation()
          addKey()
        } else if (e.key === 'F5') {
          e.preventDefault()
          e.stopPropagation()
          holdThreeFrames()
        }
      }}
    >
      {/* Thanh công cụ Dope Sheet chuẩn Moho Pro & Adobe Animate */}
      <div className="lw-animation-timeline-toolbar">
        <div className="lw-dope-cluster">
          <button type="button" className="btn xs" onClick={rewind} title="Về Frame 0 (0.00s)" aria-label="Về đầu">
            ⏮
          </button>
          <button
            type="button"
            className="btn xs"
            onClick={() => stepFrame(-1)}
            title="Lùi 1 Frame"
            aria-label="Lùi 1 Frame"
          >
            ◀F
          </button>
          <button
            type="button"
            className={`btn xs${playback.isPlaying ? ' primary' : ''}`}
            onClick={playback.toggle}
            title="Phát / Tạm dừng (Space)"
          >
            {playback.isPlaying ? '⏸' : '▶'}
          </button>
          <button
            type="button"
            className="btn xs"
            onClick={() => stepFrame(1)}
            title="Tiến 1 Frame"
            aria-label="Tiến 1 Frame"
          >
            F▶
          </button>
          <button type="button" className="btn xs" onClick={() => jump(-1)} title="Nhảy tới Key trước" aria-label="Key trước">
            ◀◆
          </button>
          <button type="button" className="btn xs" onClick={() => jump(1)} title="Nhảy tới Key sau" aria-label="Key sau">
            ◆▶
          </button>
          <span className="lw-animation-timecode">
            F{Math.round(playback.time * fps)}/{totalFrames} · {playback.time.toFixed(2)}s
          </span>
        </div>

        <div className="lw-dope-cluster lw-dope-center-cluster">
          <button
            type="button"
            className="btn xs primary"
            disabled={!boneId}
            onClick={addKey}
            title="Đặt Keyframe tại đầu phát hiện tại (Adobe Animate F6)"
          >
            + Key
          </button>
          <button
            type="button"
            className="btn xs"
            onClick={holdThreeFrames}
            title="Giữ nguyên tư thế thêm +3 Frame và đẩy các key sau lùi lại (Adobe Animate F5)"
          >
            +3F
          </button>
          <button
            type="button"
            className="btn xs"
            disabled={!selectedKey}
            onClick={remove}
            title="Xóa Keyframe đang đứng (F7 / Delete)"
          >
            Xóa
          </button>
          <button
            type="button"
            className={`lw-autokey-pill compact${assist.autoKey ? ' active' : ''}`}
            onClick={() => setAnimAssist({ autoKey: !assist.autoKey })}
            title="Bật/tắt Auto-Key khi kéo xương"
          >
            <IconAutoKeyRec width={10} height={10} />
            <span>Auto</span>
          </button>

          {/* 1-Click Tween Easing Pills (Adobe Animate / Moho) */}
          <div className="lw-dope-seg" role="group" aria-label="Kiểu nội suy Tween">
            {QUICK_EASINGS.map((item) => {
              const active = selectedKey?.easing === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!boneId}
                  className={`lw-dope-seg-btn${active ? ' active' : ''}`}
                  onClick={() => applyQuickEasing(item.id)}
                  title={item.title}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="lw-dope-cluster lw-dope-right-cluster">
          <div className="lw-dope-seg" role="group" aria-label="Lọc hàng xương">
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`lw-dope-seg-btn${assist.dopeFilter === f.id ? ' active' : ''}`}
                onClick={() => setAnimAssist({ dopeFilter: f.id })}
                title={f.title}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="lw-dope-zoom">
            <button
              type="button"
              className="btn xs"
              disabled={zoom === 1}
              onClick={() => setZoom(Math.max(1, zoom / 2))}
              aria-label="Thu timeline"
            >
              −
            </button>
            <span>{zoom}×</span>
            <button
              type="button"
              className="btn xs"
              disabled={zoom === 8}
              onClick={() => setZoom(Math.min(8, zoom * 2))}
              aria-label="Phóng timeline"
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="btn xs"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? 'Mở rộng bảng rãnh Dope Sheet' : 'Thu gọn bảng rãnh Dope Sheet để nhường không gian sân khấu'}
          >
            {collapsed ? '▴ Rãnh' : '▾ Gọn'}
          </button>
        </div>
      </div>

      {error && (
        <div className="lw-error" role="alert">
          {error}
        </div>
      )}

      {!collapsed && (
        <div className="lw-animation-track-scroll">
          <div className="lw-animation-track-content" style={{ width: `${zoom * 100}%` }}>
            {/* Thước Frame + Giây (Dual Frame & Timecode Ruler) */}
            <div className="lw-animation-track-row lw-animation-ruler-row">
              <span className="lw-animation-track-name lw-ruler-corner">
                KHỚP ({bones.length}/{rig.bones.length}) · {fps}fps
              </span>
              <div className="lw-animation-track-lane lw-animation-ruler" onPointerDown={scrub} onPointerMove={scrub}>
                {Array.from({ length: rulerTicks + 1 }, (_, i) => {
                  const t = (rig.duration * i) / rulerTicks
                  const f = Math.round(t * fps)
                  return (
                    <span key={i} className="lw-ruler-tick" style={{ left: `${(i / rulerTicks) * 100}%` }}>
                      <b>F{f}</b>
                      <small>{t.toFixed(1)}s</small>
                    </span>
                  )
                })}
                <span className="lw-animation-playhead-cap" style={{ left: `${playheadPct}%` }} />
              </div>
            </div>

            {/* Hàng tổng hợp tư thế toàn thân (Moho Consolidated Master Channel: TẤT CẢ KHỚP) */}
            <div className="lw-animation-track-row lw-master-pose-row">
              <span className="lw-animation-track-name lw-master-track-label" title="Tổng hợp mọi mốc tư thế của toàn bộ khung xương">
                <span>◆ TẤT CẢ KHỚP</span>
                <small>{masterPoseTimes.length}</small>
              </span>
              <div className="lw-animation-track-lane lw-master-track-lane" onPointerDown={scrub} onPointerMove={scrub}>
                <span className="lw-animation-playhead" style={{ left: `${playheadPct}%` }} />
                {masterPoseTimes.map((t) => {
                  const isAtPlayhead = sameKeyTime(t, playback.time)
                  return (
                    <button
                      key={`master-${t}`}
                      type="button"
                      className={`lw-animation-key master-key${isAtPlayhead ? ' active' : ''}`}
                      style={{ left: `${(t / rig.duration) * 100}%` }}
                      title={`Tư thế toàn thân tại F${Math.round(t * fps)} (${t.toFixed(2)}s) — Bấm để nhảy tới`}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        seek(t)
                      }}
                    />
                  )
                })}
              </div>
            </div>

            {/* Từng hàng xương kèm thanh khoảng nội suy Tween Span kiểu Adobe Animate */}
            {bones.map((bone) => {
              const track = rig.tracks[bone.id] ?? []
              const side = classifyBoneSide(bone)
              const depth = Math.min(5, depthMap.get(bone.id) ?? 0)
              const spans = computeTweenSpans(track, rig.duration)

              return (
                <div
                  className={`lw-animation-track-row side-${side}${bone.id === boneId ? ' selected' : ''}`}
                  key={bone.id}
                >
                  <button
                    type="button"
                    className="lw-animation-track-name"
                    title={bone.name}
                    style={{ paddingLeft: `${8 + depth * 9}px` }}
                    onClick={() => selectBone(bone.id)}
                  >
                    <span className="lw-dope-bone-title">
                      <span className={`lw-bone-side-dot side-${side}`} />
                      <span className="lw-dope-bone-text">{bone.name}</span>
                    </span>
                    <small>{track.length}</small>
                  </button>
                  <div
                    className="lw-animation-track-lane"
                    onPointerDown={(e) => {
                      selectBone(bone.id)
                      scrub(e)
                    }}
                    onPointerMove={scrub}
                  >
                    {spans.map((span) => (
                      <span
                        key={`span-${span.startTime}`}
                        className={`lw-tween-span kind-${span.kind}`}
                        style={{ left: `${span.leftPct}%`, width: `${span.widthPct}%` }}
                        title={`Tween ${span.easing}: ${span.startTime.toFixed(2)}s → ${span.endTime.toFixed(2)}s`}
                      />
                    ))}

                    <span className="lw-animation-playhead" style={{ left: `${playheadPct}%` }} />

                    {track.map((key) => {
                      const ghost =
                        drag.ghost?.boneId === bone.id && sameKeyTime(drag.ghost.time, key.time) ? drag.ghost : null
                      const isActive = bone.id === boneId && sameKeyTime(key.time, playback.time)
                      const easeClass =
                        key.easing === 'hold' ? 'ease-hold' : key.easing === 'linear' ? 'ease-linear' : 'ease-motion'
                      return (
                        <button
                          key={key.time}
                          type="button"
                          className={`lw-animation-key ${easeClass}${isActive ? ' active' : ''}${ghost ? ' dragging' : ''}`}
                          data-bone-id={bone.id}
                          data-key-time={key.time}
                          aria-label={`${bone.name} · ${key.time.toFixed(4)}s · ${key.easing}`}
                          title={`${bone.name} · F${Math.round(key.time * fps)} (${key.time.toFixed(3)}s) · ${key.easing} · Kéo để dời key, Alt bỏ bắt frame`}
                          style={{ left: `${((ghost?.target ?? key.time) / rig.duration) * 100}%` }}
                          onPointerDown={(e) => drag.start(e, { boneId: bone.id, time: key.time })}
                          onPointerMove={(e) => {
                            e.stopPropagation()
                            drag.move(e)
                          }}
                          onPointerUp={drag.end}
                          onPointerCancel={drag.cancel}
                          onLostPointerCapture={drag.cancel}
                          onClick={(e) => {
                            if (e.detail === 0) {
                              selectBone(bone.id)
                              seek(key.time)
                            }
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
