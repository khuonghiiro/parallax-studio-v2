import { useEffect, useMemo, useState } from 'react'
import { applyCameraPath, useToast } from '../actions'
import { TRANSITIONS, type PathStep, type TransitionType } from '../animation/cameraPath'
import { useEditor } from '../store/editor'
import { useView } from '../store/view'
import { NumberInput, Row, Slider, Switch } from './controls'
import { IconDown, IconRoute, IconTrash, IconUp } from './icons'

const DEFAULT_HOLD = 2.5
const DEFAULT_TRANSITION = 1.6

/** Build a camera tour through shots: hold on each, then fly / arc / cut / fade to the next. */
export function CameraPathDialog() {
  const shots = useEditor((s) => s.project.shots)
  const fps = useEditor((s) => s.project.comp.fps)
  const close = (): void => useView.getState().openDialog(null)
  const [steps, setSteps] = useState<PathStep[]>(() =>
    shots
      .filter((s) => s.visible)
      .map((s, i, arr) => ({ shotId: s.id, hold: DEFAULT_HOLD, type: i % 2 === 0 ? 'arc' : 'fly', transition: i < arr.length - 1 ? DEFAULT_TRANSITION : 0 }))
  )
  const [pushIn, setPushIn] = useState(0.08)
  const [fit, setFit] = useState(true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const total = useMemo(() => {
    let t = 0
    steps.forEach((s, i) => {
      t += s.hold
      if (i < steps.length - 1) t += s.type === 'cut' ? 0 : s.transition
    })
    return t
  }, [steps])

  const patch = (i: number, p: Partial<PathStep>): void => setSteps((arr) => arr.map((s, j) => (j === i ? { ...s, ...p } : s)))
  const move = (i: number, d: -1 | 1): void =>
    setSteps((arr) => {
      const j = i + d
      if (j < 0 || j >= arr.length) return arr
      const next = [...arr]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const shotOf = (id: string) => shots.find((s) => s.id === id)

  const apply = (): void => {
    try {
      const end = applyCameraPath(steps, { pushIn, fitDuration: fit })
      useToast.getState().show(`Đã tạo lộ trình camera ${end.toFixed(2)}s qua ${steps.length} cảnh`)
      close()
    } catch (err) {
      window.alert(String(err instanceof Error ? err.message : err))
    }
  }

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal wide" role="dialog" aria-labelledby="path-title">
        <div className="modal-head">
          <h2 id="path-title">Lộ trình camera</h2>
          <p>Camera dừng ở từng cảnh rồi chuyển sang cảnh kế tiếp. Keyframe camera hiện có sẽ được thay thế (có thể Ctrl+Z).</p>
        </div>
        <div className="modal-body">
          <div className="path-steps">
            {steps.map((step, i) => {
              const shot = shotOf(step.shotId)
              const last = i === steps.length - 1
              return (
                <div key={`${step.shotId}-${i}`}>
                  <div className="path-step" style={{ ['--c' as string]: shot?.color }}>
                    <span className="num-badge">{i + 1}</span>
                    <select className="select" value={step.shotId} onChange={(e) => patch(i, { shotId: e.target.value })}>
                      {shots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <label className="labeled" title="Thời gian dừng ở cảnh (giây)">
                      <NumberInput value={step.hold} onChange={(v) => patch(i, { hold: v })} step={0.05} precision={2} min={0} suffix="s" axis="⏱" />
                    </label>
                    <button className="mini" title="Lên" disabled={i === 0} onClick={() => move(i, -1)}>
                      <IconUp />
                    </button>
                    <button className="mini" title="Xuống" disabled={last} onClick={() => move(i, 1)}>
                      <IconDown />
                    </button>
                    <button className="mini danger" title="Bỏ bước" disabled={steps.length <= 1} onClick={() => setSteps((a) => a.filter((_, j) => j !== i))}>
                      <IconTrash />
                    </button>
                  </div>
                  {!last && (
                    <div className="path-trans">
                      <span className="line" />
                      <div className="fields">
                        <select className="select sm" value={step.type} onChange={(e) => patch(i, { type: e.target.value as TransitionType })}>
                          {TRANSITIONS.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {step.type !== 'cut' ? (
                        <label className="labeled" title="Thời gian chuyển cảnh (giây)">
                          <NumberInput value={step.transition} onChange={(v) => patch(i, { transition: v })} step={0.05} precision={2} min={0.05} suffix="s" axis="↝" />
                        </label>
                      ) : (
                        <span />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <button
            className="btn sm"
            style={{ justifySelf: 'start' }}
            onClick={() =>
              setSteps((a) => {
                const prev = a[a.length - 1]
                const idx = shots.findIndex((s) => s.id === prev?.shotId)
                const nextShot = shots[(idx + 1) % shots.length]
                const fixed = a.map((s, j) => (j === a.length - 1 && s.transition === 0 ? { ...s, transition: DEFAULT_TRANSITION } : s))
                return [...fixed, { shotId: nextShot.id, hold: DEFAULT_HOLD, type: 'fly', transition: 0 }]
              })
            }
          >
            + Thêm bước
          </button>
          <Row label="Đẩy vào khi dừng" title="Camera tiến chậm vào cảnh trong lúc dừng (Ken Burns 3D)">
            <Slider value={pushIn} min={0} max={0.3} step={0.01} onChange={setPushIn} format={(v) => `${Math.round(v * 100)}%`} />
          </Row>
          <Row label="Khớp thời lượng">
            <Switch on={fit} onChange={setFit} />
            <span className="hint-text">Đặt thời lượng composition = độ dài lộ trình</span>
          </Row>
          <div className="path-summary">
            <span>
              {steps.length} cảnh · {Math.round(total * fps)} frame
            </span>
            <b>{total.toFixed(2)}s</b>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={close}>
            Huỷ
          </button>
          <button id="path-apply" className="btn primary" onClick={apply} disabled={steps.length === 0}>
            <IconRoute /> Tạo lộ trình
          </button>
        </div>
      </div>
    </div>
  )
}
