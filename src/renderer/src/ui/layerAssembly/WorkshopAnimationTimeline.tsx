import { useState, type PointerEvent } from 'react'
import type { LayerRig } from '@shared/layerRig'
import type { useLayerWorkshop } from './useLayerWorkshop'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import { applyRigAction, ensureRigClips, type RigAction } from './workshopRig'
import { sameKeyTime } from './workshopAnimation'
import { adjacentKeyTime, timelineTime } from './workshopTimeline'
import { useWorkshopKeyDrag } from './useWorkshopKeyDrag'
import { useEditor } from '../../store/editor'
import '../../styles/layerWorkshopTimeline.css'

interface Props {
  state: ReturnType<typeof useLayerWorkshop>; playback: ReturnType<typeof useWorkshopPlayback>
  boneId: string | null; selectBone: (id: string | null) => void
}

export function WorkshopAnimationTimeline(props: Props) {
  const rig = props.state.composite.rig
  if (!rig?.bones.length) return null
  return <AnimationTimeline key={`${props.state.composite.id}:${rig.activeClipId}`} {...props} rig={ensureRigClips(rig).rig} />
}

function AnimationTimeline({ state, playback, boneId, selectBone, rig }: Props & { rig: LayerRig }) {
  const fps = useEditor((s) => s.project.comp.fps)
  const [zoom, setZoom] = useState(1), [onlySelected, setOnlySelected] = useState(false)
  const [error, setError] = useState('')
  const seek = (time: number) => { playback.setIsPlaying(false); playback.setTime(time) }
  const run = (action: RigAction) => {
    try { state.setComposite((c) => applyRigAction(c, action)); setError(''); return true }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); return false }
  }
  const drag = useWorkshopKeyDrag(rig.duration, fps, seek, (key) => { selectBone(key.boneId); seek(key.time) }, run)
  const bones = rig.bones.filter((b) => !onlySelected || b.id === boneId)
  const selectedKey = boneId && rig.tracks[boneId]?.find((k) => sameKeyTime(k.time, playback.time))
  const remove = () => { if (boneId && selectedKey) run({ action: 'delete-key', boneId, time: selectedKey.time }) }
  const jump = (direction: -1 | 1) => { const time = adjacentKeyTime(rig, playback.time, direction); if (time !== undefined) seek(time) }
  const scrub = (event: PointerEvent<HTMLDivElement>) => {
    if (event.type === 'pointermove' && !(event.buttons & 1)) return
    if (event.type === 'pointerdown') event.currentTarget.setPointerCapture(event.pointerId)
    const rect = event.currentTarget.getBoundingClientRect()
    seek(timelineTime(event.clientX, rect.left, rect.width, rig.duration, fps, !event.altKey))
  }
  return <section className="lw-animation-timeline" aria-label="Timeline từng xương" tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Escape') { e.stopPropagation(); drag.cancel() }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); remove() }
    }}>
    <TimelineToolbar playback={playback} fps={fps} zoom={zoom} setZoom={setZoom} jump={jump}
      canDelete={!!selectedKey} remove={remove} onlySelected={onlySelected} setOnlySelected={setOnlySelected} />
    {error && <div className="lw-error" role="alert">{error}</div>}
    <div className="lw-animation-track-scroll">
      <div className="lw-animation-track-content" style={{ width: `${zoom * 100}%` }}>
        <div className="lw-animation-track-row lw-animation-ruler-row">
          <span className="lw-animation-track-name">XƯƠNG · {rig.bones.length}</span>
          <div className="lw-animation-track-lane lw-animation-ruler" onPointerDown={scrub} onPointerMove={scrub}>
            {Array.from({ length: 9 }, (_, i) => <span key={i} style={{ left: `${i * 12.5}%` }}>{(rig.duration * i / 8).toFixed(2)}s</span>)}
          </div>
        </div>
        {bones.map((bone) => <div className={`lw-animation-track-row ${bone.id === boneId ? 'selected' : ''}`} key={bone.id}>
          <button className="lw-animation-track-name" title={bone.name} onClick={() => selectBone(bone.id)}>{bone.name}<small>{rig.tracks[bone.id]?.length ?? 0}</small></button>
          <div className="lw-animation-track-lane" onPointerDown={(e) => { selectBone(bone.id); scrub(e) }} onPointerMove={scrub}>
            <span className="lw-animation-playhead" style={{ left: `${playback.time / rig.duration * 100}%` }} />
            {(rig.tracks[bone.id] ?? []).map((key) => {
              const ghost = drag.ghost?.boneId === bone.id && sameKeyTime(drag.ghost.time, key.time) ? drag.ghost : null
              return <button key={key.time} className={`lw-animation-key ${bone.id === boneId && sameKeyTime(key.time, playback.time) ? 'active' : ''} ${ghost ? 'dragging' : ''}`}
                data-bone-id={bone.id} data-key-time={key.time} aria-label={`${bone.name} · ${key.time.toFixed(4)}s · ${key.easing}`}
                title={`${key.time.toFixed(4)}s · ${key.easing} · Kéo để dời key, Alt để bỏ bắt frame`}
                style={{ left: `${(ghost?.target ?? key.time) / rig.duration * 100}%` }}
                onPointerDown={(e) => drag.start(e, { boneId: bone.id, time: key.time })}
                onPointerMove={(e) => { e.stopPropagation(); drag.move(e) }} onPointerUp={drag.end} onPointerCancel={drag.cancel}
                onLostPointerCapture={drag.cancel} onClick={(e) => { if (e.detail === 0) { selectBone(bone.id); seek(key.time) } }} />
            })}
          </div>
        </div>)}
      </div>
    </div>
    <div className="lw-animation-timeline-hint">Kéo ◆ để dời key · Alt: không bắt frame · Delete: xóa key · Esc: hủy kéo</div>
  </section>
}

function TimelineToolbar({ playback, fps, zoom, setZoom, jump, canDelete, remove, onlySelected, setOnlySelected }: {
  playback: Props['playback']; fps: number; zoom: number; setZoom: (v: number) => void
  jump: (v: -1 | 1) => void; canDelete: boolean; remove: () => void
  onlySelected: boolean; setOnlySelected: (v: boolean) => void
}) {
  return <div className="lw-animation-timeline-toolbar">
    <strong>Animation</strong>
    <button className="btn xs" onClick={() => jump(-1)} aria-label="Key trước">◀◆</button>
    <button className="btn xs" onClick={playback.toggle}>{playback.isPlaying ? 'Tạm dừng' : 'Phát thử'}</button>
    <button className="btn xs" onClick={() => jump(1)} aria-label="Key sau">◆▶</button>
    <span className="lw-animation-timecode">{playback.time.toFixed(3)}s · F{Math.round(playback.time * fps)} · {fps} fps</span>
    <label><input type="checkbox" checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} /> Xương đang chọn</label>
    <button className="btn xs" disabled={!canDelete} onClick={remove}>Xóa key</button>
    <button className="btn xs" disabled={zoom === 1} onClick={() => setZoom(Math.max(1, zoom / 2))} aria-label="Thu timeline">−</button>
    <span>{zoom}×</span>
    <button className="btn xs" disabled={zoom === 8} onClick={() => setZoom(Math.min(8, zoom * 2))} aria-label="Phóng timeline">+</button>
  </div>
}
