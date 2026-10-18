import { useEffect, useState } from 'react'
import type { LayerRig } from '@shared/layerRig'
import type { RigAction } from './workshopRig'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import { canBreakdown, keyTimes, neighborKeyTime, type AnimToolOp } from './workshopAnimTools'
import { sameKeyTime } from './workshopAnimation'
import '../../styles/layerWorkshopPoseTools.css'

type Playback = ReturnType<typeof useWorkshopPlayback>
type ToolFn = (op: AnimToolOp) => void

const FAVOR_PRESETS: Array<[number, string, string]> = [
  [0.25, '¼', 'Dáng trung gian nghiêng về key TRƯỚC (giữ lâu ở dáng cũ — ease out)'],
  [0.5, '½', 'Dáng chính giữa 2 key'],
  [0.75, '¾', 'Dáng trung gian nghiêng về key SAU (tới dáng mới sớm — ease in)']
]
const OVERLAP_DELAYS = [0.04, 0.08, 0.12]
const SHIFT_STEP = 0.25

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (['input', 'textarea', 'select'].includes(el.tagName?.toLowerCase()) || el.isContentEditable)
}

function PoseNav({ rig, time, scopeBone, boneId, onlyBone, setOnlyBone, jump }: {
  rig: LayerRig; time: number; scopeBone: string | null; boneId: string | null
  onlyBone: boolean; setOnlyBone: (v: boolean) => void; jump: (t: number | null) => void
}) {
  const times = keyTimes(rig, scopeBone)
  const index = times.findIndex((t) => sameKeyTime(t, time))
  const prev = neighborKeyTime(rig, time, -1, scopeBone)
  const next = neighborKeyTime(rig, time, 1, scopeBone)
  return (
    <div className="lw-pose-nav" role="group" aria-label="Điều hướng keyframe">
      <button type="button" className="lw-pose-nav-btn" disabled={prev === null} onClick={() => jump(prev)} title="Nhảy tới key trước (phím ,)">
        ◀ <kbd>,</kbd>
      </button>
      <span className="lw-pose-nav-readout" title="Thời điểm đầu phát · thứ tự key">
        {index >= 0 ? `◆ Key ${index + 1}/${times.length}` : '◇ Giữa 2 key'} · {time.toFixed(2)}s
      </span>
      <button type="button" className="lw-pose-nav-btn" disabled={next === null} onClick={() => jump(next)} title="Nhảy tới key sau (phím .)">
        <kbd>.</kbd> ▶
      </button>
      <label className="lw-pose-nav-scope" title="Chỉ nhảy giữa các key của xương đang chọn">
        <input type="checkbox" checked={onlyBone} disabled={!boneId} onChange={(e) => setOnlyBone(e.target.checked)} />
        <span>Chỉ xương này</span>
      </label>
    </div>
  )
}

function BreakdownBlock({ rig, time, tool }: { rig: LayerRig; time: number; tool: ToolFn }) {
  const [favor, setFavor] = useState(0.5)
  const ready = canBreakdown(rig, time)
  return (
    <div className="lw-pose-block">
      <div className="lw-pose-block-head">
        <span>Dáng trung gian (Breakdown)</span>
        <span className="lw-pose-block-val">{Math.round(favor * 100)}% → key sau</span>
      </div>
      <div className="lw-pose-row">
        {FAVOR_PRESETS.map(([v, label, hint]) => (
          <button key={v} type="button" className={`lw-pose-chip${Math.abs(favor - v) < 0.01 ? ' active' : ''}`} title={hint} onClick={() => setFavor(v)}>
            {label}
          </button>
        ))}
        <input type="range" min={0} max={1} step={0.05} value={favor} aria-label="Mức nghiêng về key sau" onChange={(e) => setFavor(Number(e.target.value))} />
        <button type="button" className="btn xs primary" disabled={!ready} onClick={() => tool({ op: 'breakdown', time, favor })}
          title="Ghi dáng trung gian cho mọi xương đang nằm giữa 2 key tại đầu phát">
          ◆ Chèn
        </button>
      </div>
      {!ready && <p className="lw-pose-hint">Đặt đầu phát vào giữa 2 key (dùng ◀ ▶ rồi tua) để chèn dáng trung gian.</p>}
    </div>
  )
}

function TimingBlock({ rig, time, tool }: { rig: LayerRig; time: number; tool: ToolFn }) {
  const items: Array<[string, string, AnimToolOp]> = [
    ['🔁 Khép vòng lặp', 'Đặt key cuối clip trùng dáng đầu clip → lặp lại không giật', { op: 'close-loop' }],
    ['⇄ Đảo ngược', 'Đảo ngược thứ tự toàn bộ động tác (đổi ease-in ↔ ease-out)', { op: 'reverse' }],
    ['🐢 Chậm ×1.25', 'Giãn toàn bộ key: động tác chậm hơn 25%', { op: 'retime', factor: 1.25 }],
    ['🐇 Nhanh ×0.8', 'Nén toàn bộ key: động tác nhanh hơn 20%', { op: 'retime', factor: 0.8 }],
    [`＋ Chèn ${SHIFT_STEP}s`, `Chèn ${SHIFT_STEP}s khoảng lặng tại đầu phát (đẩy các key phía sau)`, { op: 'shift-time', from: time, delta: SHIFT_STEP }],
    [`－ Bớt ${SHIFT_STEP}s`, `Bớt ${SHIFT_STEP}s ngay sau đầu phát (kéo các key phía sau lại gần)`, { op: 'shift-time', from: time, delta: -SHIFT_STEP }]
  ]
  return (
    <div className="lw-pose-block">
      <div className="lw-pose-block-head"><span>Nhịp &amp; vòng lặp</span><span className="lw-pose-block-val">{rig.duration.toFixed(2)}s</span></div>
      <div className="lw-pose-grid">
        {items.map(([label, hint, op]) => (
          <button key={label} type="button" className="btn xs" title={hint} onClick={() => tool(op)}>{label}</button>
        ))}
      </div>
    </div>
  )
}

function OverlapBlock({ rig, boneId, tool }: { rig: LayerRig; boneId: string | null; tool: ToolFn }) {
  const [delay, setDelay] = useState(0.08)
  const bone = rig.bones.find((b) => b.id === boneId)
  const hasChildren = !!bone && rig.bones.some((b) => b.parentId === bone.id)
  return (
    <div className="lw-pose-block">
      <div className="lw-pose-block-head"><span>Lệch pha nhánh (follow-through)</span><span className="lw-pose-block-val">{delay.toFixed(2)}s/cấp</span></div>
      <div className="lw-pose-row lw-pose-row-wrap">
        {OVERLAP_DELAYS.map((d) => (
          <button key={d} type="button" className={`lw-pose-chip${Math.abs(delay - d) < 0.001 ? ' active' : ''}`} onClick={() => setDelay(d)} title={`Mỗi cấp xương con trễ ${d}s so với xương cha`}>
            {d.toFixed(2)}s
          </button>
        ))}
        <button type="button" className="btn xs primary lw-pose-grow" disabled={!hasChildren} onClick={() => bone && tool({ op: 'overlap', rootBoneId: bone.id, delay })}
          title="Các xương con của xương đang chọn trễ nhịp theo cấp → cử động lan dần như roi (tay, tóc, đuôi)">
          <span>〰 Lệch pha {bone ? `“${bone.name}”` : 'nhánh'}</span>
        </button>
      </div>
      {!hasChildren && <p className="lw-pose-hint">Chọn một xương có xương con (VD vai, gốc tóc, gốc đuôi) để lệch pha cả nhánh.</p>}
    </div>
  )
}

/**
 * Thẻ "Pose-to-pose & Nhịp": điều hướng key (phím , .), chèn dáng trung gian (Tween Machine),
 * khép vòng lặp, lệch pha nhánh xương (follow-through), co giãn / đảo ngược / chèn – bớt thời gian.
 */
export function WorkshopAnimToolsCard({ rig, boneId, playback, run }: {
  rig: LayerRig
  boneId: string | null
  playback: Playback
  run: (action: RigAction) => void
}) {
  const [onlyBone, setOnlyBone] = useState(false)
  const time = Math.min(rig.duration, playback.time)
  const scopeBone = onlyBone ? boneId : null
  const jump = (t: number | null) => {
    if (t === null) return
    playback.setIsPlaying(false)
    playback.setTime(t)
  }
  const tool: ToolFn = (op) => {
    playback.setIsPlaying(false)
    run({ action: 'anim-tool', tool: op })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key !== ',' && e.key !== '.') return
      e.preventDefault()
      jump(neighborKeyTime(rig, playback.time, e.key === ',' ? -1 : 1, scopeBone))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="lw-card-section lw-pose-tools" data-mcp-region="layer_assembly_pose_tools">
      <div className="lw-card-header">
        <span className="lw-card-title">⏱ Pose-to-pose &amp; Nhịp</span>
        <span className="lw-card-badge">{keyTimes(rig).length} mốc key</span>
      </div>
      <PoseNav rig={rig} time={time} scopeBone={scopeBone} boneId={boneId} onlyBone={onlyBone} setOnlyBone={setOnlyBone} jump={jump} />
      <BreakdownBlock rig={rig} time={time} tool={tool} />
      <TimingBlock rig={rig} time={time} tool={tool} />
      <OverlapBlock rig={rig} boneId={boneId} tool={tool} />
    </div>
  )
}
