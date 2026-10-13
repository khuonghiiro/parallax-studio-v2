import { useState } from 'react'
import type { AnimationClip, BoneKeyframe, LayerBone, LayerRig } from '@shared/layerRig'
import { sampleBonePose } from '../../engine/layerRig'
import { RigNumber, type RigPanelProps } from './WorkshopRigPanel'
import { emptyRig, ensureRigClips } from './workshopRig'
import { sameKeyTime } from './workshopAnimation'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import { Select } from '../controls'
import { WorkshopClipBar } from './WorkshopClipBar'
import { WorkshopRetargetDialog } from './WorkshopRetargetDialog'
import { WorkshopInterpolation } from './WorkshopInterpolation'

type Props = RigPanelProps & { playback: ReturnType<typeof useWorkshopPlayback> }

export function WorkshopAnimationPanel({ composite, boneId, selectBone, run, playback }: Props) {
  const { rig, activeClip } = ensureRigClips(composite.rig ?? emptyRig())
  const bone = rig.bones.find((b) => b.id === boneId)
  const time = Math.min(rig.duration, playback.time)
  const keys = bone ? rig.tracks[bone.id] ?? [] : []
  const exact = keys.find((k) => sameKeyTime(k.time, time))
  const previous = keys.filter((k) => k.time <= time).at(-1)
  const pose = bone ? sampleBonePose({ ...rig, loop: false }, bone.id, time) : { x: 0, y: 0, rotation: 0 }
  const key: BoneKeyframe = { ...pose, time, easing: exact?.easing ?? previous?.easing ?? 'smooth', bezier: exact?.bezier ?? previous?.bezier }
  const [isRetargetOpen, setIsRetargetOpen] = useState(false)
  const setKey = (patch: Partial<BoneKeyframe> = {}) => {
    if (!bone) return
    playback.setIsPlaying(false)
    run({ action: 'set-key', boneId: bone.id, key: { time, ...patch } })
  }
  const inherit = (sourceClip: AnimationClip, sourceBones: LayerBone[], clipName?: string) => {
    playback.setIsPlaying(false); playback.setTime(0)
    run({ action: 'inherit-clip', sourceClip, sourceBones, clipName })
  }
  return <div className="lw-rig-panel lw-animation-panel">
    <WorkshopClipBar rig={rig} activeClip={activeClip} run={(action) => {
      playback.setIsPlaying(false)
      if (['switch-clip', 'add-clip', 'duplicate-clip', 'delete-clip'].includes(action.action)) playback.setTime(0)
      run(action)
    }} onOpenRetarget={() => setIsRetargetOpen(true)} />
    <WorkshopRetargetDialog isOpen={isRetargetOpen} onClose={() => setIsRetargetOpen(false)} targetComposite={composite} onInherit={inherit} />
    <AnimationSettings rig={rig} playback={playback} run={run} />
    <div className="lw-card-section lw-animation-pose">
      <div className="lw-card-header"><span className="lw-card-title">Tạo dáng xương</span><span className="lw-card-badge">{exact ? '◆ Có key' : 'Chưa ghi key'}</span></div>
      <Select size="sm" value={bone?.id ?? ''} options={[{ value: '', label: 'Chọn xương trên hình hoặc timeline' }, ...rig.bones.map((b) => ({ value: b.id, label: b.name }))]}
        onChange={(value) => selectBone(String(value) || null)} />
      {bone ? <>
        <p>Kéo thân xương để xoay; kéo khớp gốc để dời. Thay đổi thông số sẽ ghi key tại {time.toFixed(3)}s.</p>
        <PoseFields keyframe={key} setKey={setKey} />
        <WorkshopInterpolation keyframe={key} onChange={(patch) => {
          if (exact && patch.easing) run({ action: 'set-interpolation', boneId: bone.id, time: exact.time, easing: patch.easing, bezier: patch.bezier })
          else setKey(patch)
        }} />
        <div className="lw-rig-actions">
          <button className="btn sm primary" onClick={() => setKey()}>◆ Ghi tư thế</button>
          <button className="btn sm" onClick={() => setKey({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })}>Về tư thế gốc</button>
        </div>
        <AnimationPoseActions rig={rig} time={time} run={run} playback={playback} />
        <AnimationKeyList bone={bone} keys={keys} time={time} playback={playback} run={run} />
      </> : <p>Chọn một xương để chỉnh pose. Mỗi hàng timeline bên dưới khung hình là một xương.</p>}
    </div>
  </div>
}

function AnimationSettings({ rig, playback, run }: { rig: LayerRig; playback: Props['playback']; run: Props['run'] }) {
  return <div className="lw-card-section lw-animation-settings">
    <div className="lw-card-header"><span className="lw-card-title">Thời gian & phát thử</span></div>
    <div className="lw-rig-actions">
      <button className="btn sm primary" onClick={playback.toggle}>{playback.isPlaying ? 'Tạm dừng' : 'Phát thử'}</button>
      <button className="btn sm" onClick={() => { playback.setIsPlaying(false); playback.setTime(0) }}>Về đầu</button>
    </div>
    <div className="lw-rig-grid">
      <RigNumber label="Thời lượng (s)" value={rig.duration} min={0.1} max={120} step={0.1} onChange={(duration) => run({ action: 'settings', duration })} />
      <RigNumber label="Thời gian (s)" value={playback.time} min={0} max={rig.duration} step={0.01} onChange={(time) => { playback.setIsPlaying(false); playback.setTime(time) }} />
    </div>
    <label className="lw-rig-check"><input type="checkbox" checked={rig.loop} onChange={(e) => run({ action: 'settings', loop: e.target.checked })} /> Lặp khi phát</label>
  </div>
}

function PoseFields({ keyframe: pose, setKey }: { keyframe: BoneKeyframe; setKey: (patch: Partial<BoneKeyframe>) => void }) {
  return <div className="lw-rig-grid">
    <RigNumber label="Góc xoay (°)" value={pose.rotation} onChange={(rotation) => setKey({ rotation })} />
    <RigNumber label="Dời X (px)" value={pose.x} onChange={(x) => setKey({ x })} />
    <RigNumber label="Dời Y (px)" value={pose.y} onChange={(y) => setKey({ y })} />
    <RigNumber label="Co giãn X" value={pose.scaleX ?? 1} step={0.05} onChange={(scaleX) => setKey({ scaleX })} />
    <RigNumber label="Co giãn Y" value={pose.scaleY ?? 1} step={0.05} onChange={(scaleY) => setKey({ scaleY })} />
  </div>
}

function AnimationPoseActions({ rig, time, run, playback }: { rig: LayerRig; time: number; run: Props['run']; playback: Props['playback'] }) {
  return <div className="lw-animation-pose-actions">
    <div className="lw-rig-actions">
      <button className="btn sm" onClick={() => { playback.setIsPlaying(false); run({ action: 'set-pose', time, poses: rig.bones.map((b) => ({ boneId: b.id })) }) }}>Ghi dáng toàn thân</button>
      <button className="btn sm" onClick={() => { playback.setIsPlaying(false); run({ action: 'mirror-pose', time }) }}>Lật dáng</button>
    </div>
    <p>Tạo clip mới từ chuyển động mẫu:</p>
    <div className="lw-rig-presets-row">{([['walk', 'Đi bộ'], ['idle', 'Đứng thở'], ['wave', 'Vẫy tay'], ['jump', 'Nhảy']] as const).map(([preset, title]) =>
      <button key={preset} className="btn sm" onClick={() => { playback.setIsPlaying(false); playback.setTime(0); run({ action: 'apply-preset-animation', preset, asNewClip: true }) }}>{title}</button>)}
    </div>
  </div>
}

function AnimationKeyList({ bone, keys, time, playback, run }: { bone: LayerBone; keys: BoneKeyframe[]; time: number; playback: Props['playback']; run: Props['run'] }) {
  return <details className="lw-animation-key-list"><summary>{bone.name} · {keys.length} keyframe</summary>
    <div className="lw-key-list">{keys.map((key) => <div key={key.time}>
      <button className={`btn xs ${sameKeyTime(key.time, time) ? 'active' : ''}`} onClick={() => { playback.setIsPlaying(false); playback.setTime(key.time) }}>◆ {key.time.toFixed(4)}s · {key.rotation.toFixed(1)}°</button>
      <button className="btn xs" aria-label={`Xóa keyframe ${key.time}s`} onClick={() => run({ action: 'delete-key', boneId: bone.id, time: key.time })}>×</button>
    </div>)}</div>
  </details>
}
