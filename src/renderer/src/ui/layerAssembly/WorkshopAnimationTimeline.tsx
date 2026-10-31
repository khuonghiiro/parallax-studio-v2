import { useEffect, useMemo, useState, type PointerEvent } from 'react'
import type { BoneEasing, LayerRig } from '@shared/layerRig'
import type { useLayerWorkshop } from './useLayerWorkshop'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import { applyRigAction, ensureRigClips, type RigAction } from './workshopRig'
import { sameKeyTime } from './workshopAnimation'
import { adjacentKeyTime, timelineTime } from './workshopTimeline'
import {
  dedupeTimelineKeys,
  sameTimelineKey,
  useWorkshopKeyDrag,
  type TimelineKey
} from './useWorkshopKeyDrag'
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

function collectPoseKeysAtTime(rig: LayerRig, time: number): TimelineKey[] {
  const out: TimelineKey[] = []
  for (const b of rig.bones) {
    const found = (rig.tracks[b.id] ?? []).find((k) => sameKeyTime(k.time, time))
    if (found) out.push({ boneId: b.id, time: found.time })
  }
  return out
}

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
  const [selectedKeys, setSelectedKeys] = useState<TimelineKey[]>([])
  const [editTimeDraft, setEditTimeDraft] = useState<string>('')

  // Lọc bỏ các key đã bị xóa khỏi rig
  const validSelectedKeys = useMemo(
    () =>
      selectedKeys.filter((sk) =>
        (rig.tracks[sk.boneId] ?? []).some((k) => sameKeyTime(k.time, sk.time))
      ),
    [selectedKeys, rig.tracks]
  )

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
    (nextSel, primaryBone) => {
      setSelectedKeys(nextSel)
      if (primaryBone) selectBone(primaryBone)
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

  const effectiveDeleteTargets = useMemo<TimelineKey[]>(() => {
    if (validSelectedKeys.length > 0) return validSelectedKeys
    if (boneId && selectedKey) return [{ boneId, time: selectedKey.time }]
    return []
  }, [validSelectedKeys, boneId, selectedKey])

  // Nếu các key đang chọn cùng nằm tại 1 mốc thời gian (1 key lẻ hoặc 1 cột Tư thế toàn thân), cho phép nhập trực tiếp giây mới (VD 1.00s -> 0.50s)
  const commonSelectedTime = useMemo<number | null>(() => {
    const list = effectiveDeleteTargets
    if (!list.length) return null
    const t0 = list[0].time
    return list.every((k) => sameKeyTime(k.time, t0)) ? t0 : null
  }, [effectiveDeleteTargets])

  useEffect(() => {
    if (commonSelectedTime !== null) {
      setEditTimeDraft(commonSelectedTime.toFixed(2))
    }
  }, [commonSelectedTime])

  const commitSelectedTimeInput = () => {
    if (commonSelectedTime === null || !effectiveDeleteTargets.length) return
    const parsed = Number(editTimeDraft)
    if (!Number.isFinite(parsed)) {
      setEditTimeDraft(commonSelectedTime.toFixed(2))
      return
    }
    const clamped = Number(Math.max(0, Math.min(rig.duration, parsed)).toFixed(4))
    if (sameKeyTime(clamped, commonSelectedTime)) {
      setEditTimeDraft(commonSelectedTime.toFixed(2))
      return
    }
    const moves = effectiveDeleteTargets.map((k) => ({
      boneId: k.boneId,
      time: k.time,
      targetTime: clamped
    }))
    if (run({ action: 'move-keys', overwrite: true, moves })) {
      setSelectedKeys(moves.map((m) => ({ boneId: m.boneId, time: m.targetTime })))
      seek(clamped)
    }
  }

  const remove = () => {
    if (!effectiveDeleteTargets.length) return
    if (run({ action: 'delete-keys', keys: effectiveDeleteTargets })) {
      setSelectedKeys([])
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
    } else {
      run({
        action: 'set-pose',
        time: playback.time,
        poses: rig.bones.map((b) => ({ boneId: b.id }))
      })
    }
  }

  const holdThreeFrames = () => {
    const holdSeconds = Number((3 / Math.max(4, fps)).toFixed(4))
    if (run({ action: 'hold-frames', time: playback.time, holdSeconds, boneId: boneId ?? undefined })) {
      playback.setTime(Math.min(120, Number((playback.time + holdSeconds).toFixed(4))))
    }
  }

  const applyQuickEasing = (easing: BoneEasing) => {
    if (validSelectedKeys.length > 1) {
      run({
        action: 'batch',
        operations: validSelectedKeys.map((k) => ({
          action: 'set-interpolation' as const,
          boneId: k.boneId,
          time: k.time,
          easing
        }))
      })
      return
    }
    if (!boneId) return
    if (selectedKey) {
      run({ action: 'set-interpolation', boneId, time: selectedKey.time, easing })
    } else {
      run({ action: 'set-key', boneId, key: { time: playback.time, easing } })
    }
  }

  const handleBoneKeyPointerDown = (e: PointerEvent<HTMLButtonElement>, key: TimelineKey) => {
    const isToggle = e.ctrlKey || e.metaKey
    const isRange = e.shiftKey
    selectBone(key.boneId)

    if (isToggle) {
      const exists = validSelectedKeys.some((k) => sameTimelineKey(k, key))
      const next = exists
        ? validSelectedKeys.filter((k) => !sameTimelineKey(k, key))
        : [...validSelectedKeys, key]
      setSelectedKeys(next)
      seek(key.time)
      e.stopPropagation()
      return
    }

    if (isRange && validSelectedKeys.length > 0) {
      const last = validSelectedKeys[validSelectedKeys.length - 1]
      const lo = Math.min(last.time, key.time) - 1e-4
      const hi = Math.max(last.time, key.time) + 1e-4
      const targetBones = last.boneId === key.boneId ? [key.boneId] : rig.bones.map((b) => b.id)
      const ranged: TimelineKey[] = []
      for (const bid of targetBones) {
        for (const kf of rig.tracks[bid] ?? []) {
          if (kf.time >= lo && kf.time <= hi) ranged.push({ boneId: bid, time: kf.time })
        }
      }
      const merged = dedupeTimelineKeys([...validSelectedKeys, ...ranged])
      setSelectedKeys(merged)
      drag.start(e, key, merged)
      return
    }

    const alreadyInMulti = validSelectedKeys.length > 1 && validSelectedKeys.some((k) => sameTimelineKey(k, key))
    if (alreadyInMulti) {
      drag.start(e, key, validSelectedKeys, () => setSelectedKeys([key]))
    } else {
      setSelectedKeys([key])
      drag.start(e, key, [key])
    }
  }

  const handleMasterPosePointerDown = (e: PointerEvent<HTMLButtonElement>, poseTime: number) => {
    const columnKeys = collectPoseKeysAtTime(rig, poseTime)
    if (!columnKeys.length) return
    const anchor = columnKeys.find((k) => k.boneId === boneId) ?? columnKeys[0]
    const isToggle = e.ctrlKey || e.metaKey
    const isRange = e.shiftKey

    if (isToggle) {
      const allSelected = columnKeys.every((ck) => validSelectedKeys.some((sk) => sameTimelineKey(sk, ck)))
      const next = allSelected
        ? validSelectedKeys.filter((sk) => !columnKeys.some((ck) => sameTimelineKey(sk, ck)))
        : dedupeTimelineKeys([...validSelectedKeys, ...columnKeys])
      setSelectedKeys(next)
      seek(poseTime)
      e.stopPropagation()
      return
    }

    if (isRange && validSelectedKeys.length > 0) {
      const lastTime = validSelectedKeys[validSelectedKeys.length - 1].time
      const lo = Math.min(lastTime, poseTime) - 1e-4
      const hi = Math.max(lastTime, poseTime) + 1e-4
      const ranged: TimelineKey[] = []
      for (const b of rig.bones) {
        for (const kf of rig.tracks[b.id] ?? []) {
          if (kf.time >= lo && kf.time <= hi) ranged.push({ boneId: b.id, time: kf.time })
        }
      }
      const merged = dedupeTimelineKeys([...validSelectedKeys, ...ranged])
      setSelectedKeys(merged)
      drag.start(e, anchor, merged)
      return
    }

    const columnAlreadyInLargerSelection =
      validSelectedKeys.length > columnKeys.length &&
      columnKeys.every((ck) => validSelectedKeys.some((sk) => sameTimelineKey(sk, ck)))
    if (columnAlreadyInLargerSelection) {
      drag.start(e, anchor, validSelectedKeys, () => setSelectedKeys(columnKeys))
    } else {
      setSelectedKeys(columnKeys)
      drag.start(e, anchor, columnKeys)
    }
  }

  const scrub = (event: PointerEvent<HTMLDivElement>) => {
    if (event.type === 'pointermove' && !(event.buttons & 1)) return
    if (event.type === 'pointerdown') {
      if (!event.ctrlKey && !event.metaKey && !event.shiftKey) setSelectedKeys([])
      event.currentTarget.setPointerCapture(event.pointerId)
    }
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
        const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
        if (tag === 'input') return
        if (e.key === 'Escape') {
          e.stopPropagation()
          drag.cancel()
          setSelectedKeys([])
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
          <button type="button" className="btn xs" onClick={() => stepFrame(-1)} title="Lùi 1 Frame" aria-label="Lùi 1 Frame">
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
          <button type="button" className="btn xs" onClick={() => stepFrame(1)} title="Tiến 1 Frame" aria-label="Tiến 1 Frame">
            F▶
          </button>
          <button type="button" className="btn xs" onClick={() => jump(-1)} title="Nhảy tới Key trước" aria-label="Key trước">
            ◀◆
          </button>
          <button type="button" className="btn xs" onClick={() => jump(1)} title="Nhảy tới Key sau" aria-label="Key sau">
            ◆▶
          </button>
          <span className="lw-animation-timecode">
            {drag.ghost
              ? `Kéo ${drag.ghost.group.length} key → F${Math.round(drag.ghost.targetAnchorTime * fps)} · ${drag.ghost.targetAnchorTime.toFixed(2)}s (${drag.ghost.delta >= 0 ? '+' : ''}${drag.ghost.delta.toFixed(2)}s)`
              : `F${Math.round(playback.time * fps)}/${totalFrames} · ${playback.time.toFixed(2)}s`}
          </span>
        </div>

        <div className="lw-dope-cluster lw-dope-center-cluster">
          <button
            type="button"
            className="btn xs primary"
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
            className={`btn xs${effectiveDeleteTargets.length > 0 ? ' lw-dope-del-active' : ''}`}
            disabled={effectiveDeleteTargets.length === 0}
            onClick={remove}
            title="Xóa 1 hoặc nhiều Keyframe đang chọn (Ctrl/Shift+Click chọn nhiều · Delete / F7)"
          >
            {effectiveDeleteTargets.length > 1 ? `Xóa (${effectiveDeleteTargets.length})` : 'Xóa'}
          </button>

          {commonSelectedTime !== null && (
            <label
              className="lw-dope-keytime-box"
              title="Nhập trực tiếp mốc giây mới cho Key / Tư thế đang chọn (VD đổi từ 1.00s về 0.50s mà vẫn giữ nguyên các key khác)"
            >
              <span>Mốc</span>
              <input
                type="number"
                min={0}
                max={rig.duration}
                step={0.05}
                value={editTimeDraft}
                onChange={(e) => setEditTimeDraft(e.target.value)}
                onBlur={commitSelectedTimeInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                    commitSelectedTimeInput()
                  }
                }}
              />
              <small>s</small>
            </label>
          )}

          <button
            type="button"
            className={`lw-autokey-pill compact${assist.autoKey ? ' active' : ''}`}
            onClick={() => setAnimAssist({ autoKey: !assist.autoKey })}
            title="Bật/tắt Auto-Key khi kéo xương"
          >
            <IconAutoKeyRec width={10} height={10} />
            <span>Auto</span>
          </button>

          <div className="lw-dope-seg" role="group" aria-label="Kiểu nội suy Tween">
            {QUICK_EASINGS.map((item) => {
              const active = selectedKey?.easing === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!boneId && validSelectedKeys.length === 0}
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
            {/* Thước Frame + Giây */}
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

            {/* Hàng tổng hợp tư thế toàn thân (Moho Consolidated Master Channel: kéo hoặc chọn xóa cả cột tư thế) */}
            <div className="lw-animation-track-row lw-master-pose-row">
              <span
                className="lw-animation-track-name lw-master-track-label"
                title="Kéo thoi ◆ để dời cả tư thế toàn thân (VD từ 1.0s về 0.5s) · Ctrl/Shift+Click chọn nhiều mốc để kéo hoặc xóa cùng lúc"
              >
                <span>◆ TẤT CẢ KHỚP</span>
                <small>{masterPoseTimes.length}</small>
              </span>
              <div className="lw-animation-track-lane lw-master-track-lane" onPointerDown={scrub} onPointerMove={scrub}>
                <span className="lw-animation-playhead" style={{ left: `${playheadPct}%` }} />
                {masterPoseTimes.map((t) => {
                  const colKeys = collectPoseKeysAtTime(rig, t)
                  const isColSelected =
                    colKeys.length > 0 &&
                    colKeys.every((ck) => validSelectedKeys.some((sk) => sameTimelineKey(sk, ck)))
                  const isAtPlayhead = sameKeyTime(t, playback.time)
                  const ghostT = colKeys.length ? drag.ghostTimeFor(colKeys[0].boneId, colKeys[0].time) : null
                  return (
                    <button
                      key={`master-${t}`}
                      type="button"
                      className={`lw-animation-key master-key${isAtPlayhead || isColSelected ? ' active' : ''}${isColSelected ? ' multi-selected' : ''}${ghostT !== null ? ' dragging' : ''}`}
                      style={{ left: `${((ghostT ?? t) / rig.duration) * 100}%` }}
                      title={`Tư thế toàn thân tại F${Math.round(t * fps)} (${t.toFixed(2)}s) · Kéo trái/phải để đổi khoảng cách thời gian · Ctrl/Shift+Click chọn nhiều · Delete để xóa`}
                      onPointerDown={(e) => handleMasterPosePointerDown(e, t)}
                      onPointerMove={(e) => {
                        e.stopPropagation()
                        drag.move(e)
                      }}
                      onPointerUp={drag.end}
                      onPointerCancel={drag.cancel}
                      onLostPointerCapture={drag.cancel}
                    />
                  )
                })}
              </div>
            </div>

            {/* Từng hàng xương kèm thanh khoảng nội suy Tween Span */}
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
                      const ghostT = drag.ghostTimeFor(bone.id, key.time)
                      const isMultiSelected = validSelectedKeys.some(
                        (sk) => sk.boneId === bone.id && sameKeyTime(sk.time, key.time)
                      )
                      const isActive = isMultiSelected || (bone.id === boneId && sameKeyTime(key.time, playback.time))
                      const easeClass =
                        key.easing === 'hold' ? 'ease-hold' : key.easing === 'linear' ? 'ease-linear' : 'ease-motion'
                      return (
                        <button
                          key={key.time}
                          type="button"
                          className={`lw-animation-key ${easeClass}${isActive ? ' active' : ''}${isMultiSelected ? ' multi-selected' : ''}${ghostT !== null ? ' dragging' : ''}`}
                          data-bone-id={bone.id}
                          data-key-time={key.time}
                          aria-label={`${bone.name} · ${key.time.toFixed(4)}s · ${key.easing}`}
                          title={`${bone.name} · F${Math.round(key.time * fps)} (${key.time.toFixed(3)}s) · ${key.easing} · Kéo để dời key · Ctrl/Shift+Click chọn nhiều · Alt bỏ bắt frame`}
                          style={{ left: `${((ghostT ?? key.time) / rig.duration) * 100}%` }}
                          onPointerDown={(e) => handleBoneKeyPointerDown(e, { boneId: bone.id, time: key.time })}
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
                              setSelectedKeys([{ boneId: bone.id, time: key.time }])
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
