import { useEffect, useMemo, useState } from 'react'
import { applyCameraPath, useToast } from '../actions'
import {
  STEP_ANGLES,
  STEP_MOTIONS,
  TRANSITIONS,
  type PathStep,
  type StepAngle,
  type StepMotion,
  type TransitionType
} from '../animation/cameraPath'
import { useEditor } from '../store/editor'
import { useView } from '../store/view'
import { NumberInput, Row, Select, Slider, Switch } from './controls'
import { IconDown, IconPlus, IconRefresh, IconRoute, IconTrash, IconUp, IconX } from './icons'

const DEFAULT_HOLD = 2.5
const DEFAULT_TRANSITION = 1.6

function createDefaultSteps(shots: { id: string; visible: boolean }[]): PathStep[] {
  const active = shots.filter((s) => s.visible)
  const source = active.length > 0 ? active : shots
  return source.map((s, i, arr) => ({
    shotId: s.id,
    hold: DEFAULT_HOLD,
    type: i % 2 === 0 ? 'arc' : 'fly',
    transition: i < arr.length - 1 ? DEFAULT_TRANSITION : 0,
    angle: 'front' as StepAngle,
    motion: 'push' as StepMotion
  }))
}

/** Build a camera tour through shots: hold on each, then fly / arc / cut / fade to the next. */
export function CameraPathDialog() {
  const shots = useEditor((s) => s.project.shots)
  const fps = useEditor((s) => s.project.comp.fps)
  const close = (): void => useView.getState().openDialog(null)
  const [steps, setSteps] = useState<PathStep[]>(() => createDefaultSteps(shots))
  const [pushIn, setPushIn] = useState(0.08)
  const [fit, setFit] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
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

  const patch = (i: number, p: Partial<PathStep>): void =>
    setSteps((arr) => arr.map((s, j) => (j === i ? { ...s, ...p } : s)))

  const move = (i: number, d: -1 | 1): void =>
    setSteps((arr) => {
      const j = i + d
      if (j < 0 || j >= arr.length) return arr
      const next = [...arr]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const shotOf = (id: string) => shots.find((s) => s.id === id)

  const applyPresetStyle = (preset: 'cinematic' | 'fly' | 'cut'): void => {
    setSteps((arr) =>
      arr.map((s, i): PathStep => {
        const isLast = i === arr.length - 1
        if (preset === 'cinematic') {
          return {
            ...s,
            hold: 2.5,
            type: 'arc',
            transition: isLast ? 0 : 1.8,
            angle: i % 2 === 0 ? 'front' : 'left30',
            motion: 'push'
          }
        }
        if (preset === 'fly') {
          return {
            ...s,
            hold: 2.0,
            type: 'fly',
            transition: isLast ? 0 : 1.4,
            angle: 'front',
            motion: 'orbit-left'
          }
        }
        return {
          ...s,
          hold: 1.8,
          type: 'cut',
          transition: 0,
          angle: 'front',
          motion: 'pull'
        }
      })
    )
  }

  const reverseSteps = (): void => {
    setSteps((arr) => {
      const rev = [...arr].reverse()
      return rev.map((s, i) => ({
        ...s,
        transition: i < rev.length - 1 ? s.transition || DEFAULT_TRANSITION : 0
      }))
    })
  }

  const apply = (): void => {
    setErrorMsg(null)
    try {
      const end = applyCameraPath(steps, { pushIn, fitDuration: fit })
      useToast.getState().show(`Đã tạo lộ trình camera ${end.toFixed(2)}s qua ${steps.length} cảnh`)
      close()
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err)
      setErrorMsg(msg)
      useToast.getState().show(`⚠️ ${msg}`)
    }
  }

  const shotOptions = useMemo(() => shots.map((s) => ({ value: s.id, label: s.name })), [shots])
  const angleOptions = useMemo(() => STEP_ANGLES.map((a) => ({ value: a.id, label: a.label })), [])
  const motionOptions = useMemo(() => STEP_MOTIONS.map((m) => ({ value: m.id, label: m.label })), [])
  const transOptions = useMemo(() => TRANSITIONS.map((t) => ({ value: t.id, label: t.label })), [])

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal wide camera-path-modal" role="dialog" aria-labelledby="path-title">
        <div className="modal-head modal-head-row">
          <div className="modal-head-title-group">
            <span className="modal-head-badge">
              <IconRoute width={15} height={15} />
            </span>
            <div>
              <h2 id="path-title">Đạo diễn lộ trình Camera qua các Cảnh (Camera Tour)</h2>
              <p>
                Camera tự động di chuyển và dừng ở từng cảnh với góc quay & chuyển động điện ảnh. Keyframe cũ sẽ được thay thế.
              </p>
            </div>
          </div>
          <button type="button" className="btn icon ghost sm modal-close-btn" onClick={close} title="Đóng (Esc)">
            <IconX width={14} height={14} />
          </button>
        </div>

        <div className="modal-body">
          {/* Quick Style Presets Bar */}
          <div className="path-preset-bar">
            <span className="path-preset-label">Mẫu đạo diễn nhanh:</span>
            <button
              type="button"
              className="btn xs"
              onClick={() => applyPresetStyle('cinematic')}
              disabled={steps.length === 0}
              title="Bay vòng cung 3D kết hợp đẩy chậm Ken Burns"
            >
              🎬 Điện ảnh Vòng cung
            </button>
            <button
              type="button"
              className="btn xs"
              onClick={() => applyPresetStyle('fly')}
              disabled={steps.length === 0}
              title="Bay thẳng mượt mà kết hợp lướt ngang nhẹ"
            >
              🚀 Bay lướt mượt
            </button>
            <button
              type="button"
              className="btn xs"
              onClick={() => applyPresetStyle('cut')}
              disabled={steps.length === 0}
              title="Chuyển cảnh cắt trực tiếp nhịp độ nhanh"
            >
              ⚡ Cắt cảnh nhanh
            </button>
            <span className="spacer" />
            <button
              type="button"
              className="btn xs"
              onClick={reverseSteps}
              disabled={steps.length < 2}
              title="Đảo ngược thứ tự các trạm dừng"
            >
              ⇅ Đảo chiều
            </button>
            <button
              type="button"
              className="btn xs"
              onClick={() => setSteps(createDefaultSteps(shots))}
              disabled={shots.length === 0}
              title="Khôi phục danh sách trạm theo toàn bộ các cảnh đang hiển thị"
            >
              <IconRefresh width={11} height={11} /> Nạp lại cảnh
            </button>
          </div>

          {shots.length === 0 ? (
            <div className="dialog-empty-box">
              Chưa có cảnh (Shot) nào trong dự án. Hãy tạo ít nhất 1 cảnh ở bảng bên trái trước khi lập lộ trình.
            </div>
          ) : (
            <div className="path-steps">
              {steps.map((step, i) => {
                const shot = shotOf(step.shotId)
                const last = i === steps.length - 1
                return (
                  <div key={`${step.shotId}-${i}`}>
                    <div className="path-step" style={{ ['--c' as string]: shot?.color }}>
                      <span className="num-badge">{i + 1}</span>
                      <Select
                        size="sm"
                        value={step.shotId}
                        options={shotOptions}
                        onChange={(val) => patch(i, { shotId: String(val) })}
                        title="Chọn cảnh dừng"
                      />
                      <Select
                        size="sm"
                        value={step.angle ?? 'front'}
                        options={angleOptions}
                        onChange={(val) => patch(i, { angle: val as StepAngle })}
                        title="Góc quay của camera vào cảnh này"
                      />
                      <Select
                        size="sm"
                        value={step.motion ?? 'push'}
                        options={motionOptions}
                        onChange={(val) => patch(i, { motion: val as StepMotion })}
                        title="Cử động của camera trong lúc dừng ở cảnh"
                      />
                      <label className="labeled" title="Thời gian dừng ở cảnh (giây)">
                        <NumberInput
                          value={step.hold}
                          onChange={(v) => patch(i, { hold: v })}
                          step={0.05}
                          precision={2}
                          min={0}
                          suffix="s"
                          axis="⏱"
                        />
                      </label>
                      <button type="button" className="mini" title="Đưa lên" disabled={i === 0} onClick={() => move(i, -1)}>
                        <IconUp />
                      </button>
                      <button type="button" className="mini" title="Đưa xuống" disabled={last} onClick={() => move(i, 1)}>
                        <IconDown />
                      </button>
                      <button
                        type="button"
                        className="mini danger"
                        title="Bỏ bước này"
                        disabled={steps.length <= 1}
                        onClick={() => setSteps((a) => a.filter((_, j) => j !== i))}
                      >
                        <IconTrash />
                      </button>
                    </div>
                    {!last && (
                      <div className="path-trans">
                        <span className="line" />
                        <div className="fields">
                          <Select
                            size="sm"
                            value={step.type}
                            options={transOptions}
                            onChange={(val) => patch(i, { type: val as TransitionType })}
                            title="Kiểu bay chuyển tiếp sang cảnh kế tiếp"
                          />
                        </div>
                        {step.type !== 'cut' ? (
                          <label className="labeled" title="Thời gian chuyển cảnh (giây)">
                            <NumberInput
                              value={step.transition}
                              onChange={(v) => patch(i, { transition: v })}
                              step={0.05}
                              precision={2}
                              min={0.05}
                              suffix="s"
                              axis="↝"
                            />
                          </label>
                        ) : (
                          <span className="path-cut-tag">Chuyển tức thì (0s)</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <button
            type="button"
            className="btn sm"
            style={{ justifySelf: 'start' }}
            disabled={shots.length === 0}
            onClick={() =>
              setSteps((a) => {
                if (shots.length === 0) return a
                const prev = a[a.length - 1]
                const idx = shots.findIndex((s) => s.id === prev?.shotId)
                const nextShot = shots[(idx + 1 + shots.length) % shots.length]
                const fixed = a.map((s, j) =>
                  j === a.length - 1 && s.transition === 0 ? { ...s, transition: DEFAULT_TRANSITION } : s
                )
                return [
                  ...fixed,
                  {
                    shotId: nextShot.id,
                    hold: DEFAULT_HOLD,
                    type: 'fly',
                    transition: 0,
                    angle: 'front',
                    motion: 'push'
                  }
                ]
              })
            }
          >
            <IconPlus width={12} height={12} /> Thêm trạm dừng cảnh
          </button>

          <Row label="Đẩy vào khi dừng" title="Camera tiến chậm vào cảnh trong lúc dừng (Ken Burns 3D)">
            <Slider
              value={pushIn}
              min={0}
              max={0.3}
              step={0.01}
              onChange={setPushIn}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          </Row>
          <Row label="Khớp thời lượng">
            <Switch on={fit} onChange={setFit} />
            <span className="hint-text">Tự động cập nhật độ dài composition khớp với tổng lộ trình ({total.toFixed(2)}s)</span>
          </Row>

          {errorMsg && <div className="error-box">{errorMsg}</div>}

          <div className="path-summary">
            <span>
              {steps.length} trạm dừng · {Math.round(total * fps)} frame ({fps} fps)
            </span>
            <b>Tổng: {total.toFixed(2)}s</b>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={close}>
            Huỷ
          </button>
          <button
            type="button"
            id="path-apply"
            className="btn primary"
            onClick={apply}
            disabled={steps.length === 0 || shots.length === 0}
          >
            <IconRoute /> Tạo lộ trình Camera
          </button>
        </div>
      </div>
    </div>
  )
}

