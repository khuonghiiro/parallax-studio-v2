import { useEffect, useRef, useState, type ReactNode } from 'react'
import { nanoid } from 'nanoid'
import type { AnimValue, Vec3 } from '@shared/types'
import { evaluate, keyAt, removeKeyframe, addKeyframe, setValueAt, toggleAnimated } from '../animation/keyframes'
import { frameTolerance, getAnimatable, getDraftAnimatable, propRefKey, useEditor, type PropRef } from '../store/editor'
import { IconStopwatch } from './icons'

// ------------------------------------------------------------------ number

interface NumberInputProps {
  value: number
  onChange: (v: number, mergeKey: string) => void
  step?: number
  precision?: number
  min?: number
  max?: number
  axis?: 'x' | 'y' | 'z' | string
  animated?: boolean
  suffix?: string
  id?: string
}

/** Numeric field with AE-style drag-to-scrub on axis and value, plus instant click-to-type. */
export function NumberInput({
  value,
  onChange,
  step = 1,
  precision = 1,
  min = -Infinity,
  max = Infinity,
  axis,
  animated,
  suffix,
  id
}: NumberInputProps) {
  const [text, setText] = useState<string | null>(null)
  const [scrubbing, setScrubbing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const clamp = (v: number): number => Math.min(max, Math.max(min, v))
  const shown = text ?? `${Number(value.toFixed(precision))}${suffix ?? ''}`

  const startScrub = (e: React.PointerEvent): void => {
    // If input is currently focused for text editing, don't hijack typing/text selection
    if (document.activeElement === inputRef.current && e.target === inputRef.current) {
      return
    }
    if (e.button !== 0) return // Left click only
    e.preventDefault()

    const startX = e.clientX
    const start = value
    const key = `scrub-${nanoid(6)}`
    const target = e.currentTarget as HTMLElement
    let hasDragged = false
    target.setPointerCapture(e.pointerId)

    const move = (ev: PointerEvent): void => {
      const dx = ev.clientX - startX
      if (!hasDragged && Math.abs(dx) > 2) {
        hasDragged = true
        setScrubbing(true)
        document.body.style.cursor = 'ew-resize'
      }
      if (hasDragged) {
        const mult = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1
        onChange(clamp(start + dx * step * mult), key)
      }
    }

    const up = (): void => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
      document.body.style.cursor = ''
      setScrubbing(false)
      if (!hasDragged) {
        // Single click: focus and select all for fast numeric typing
        if (inputRef.current) {
          setText(String(Number(value.toFixed(precision))))
          inputRef.current.focus()
          requestAnimationFrame(() => inputRef.current?.select())
        }
      }
    }

    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }

  const commit = (): void => {
    if (text === null) return
    const v = parseFloat(text.replace(',', '.'))
    if (!Number.isNaN(v)) onChange(clamp(v), `edit-${nanoid(6)}`)
    setText(null)
  }

  return (
    <label
      className={`num${animated ? ' animated' : ''}${scrubbing ? ' scrubbing' : ''}`}
      onPointerDown={startScrub}
      title="Kéo ngang để đổi giá trị (Shift: x10, Alt: x0.1) · Click để nhập số"
    >
      {axis && (
        <span className={`axis ${axis}`}>
          {axis.toUpperCase()}
        </span>
      )}
      <input
        ref={inputRef}
        id={id}
        value={shown}
        onFocus={(e) => {
          setText(String(Number(value.toFixed(precision))))
          requestAnimationFrame(() => e.target.select())
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            setText(null)
            ;(e.target as HTMLInputElement).blur()
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const dir = e.key === 'ArrowUp' ? 1 : -1
            const mult = e.shiftKey ? 10 : 1
            const v = clamp(value + dir * step * mult)
            onChange(v, 'arrow')
            setText(String(Number(v.toFixed(precision))))
          }
          e.stopPropagation()
        }}
      />
    </label>
  )
}

// ------------------------------------------------------------------ animatable row

type DisplayKind = 'vec3' | 'vec2' | 'number'

interface AnimRowProps {
  label: string
  refp: PropRef
  kind: DisplayKind
  step?: number
  precision?: number
  /** Multiply for display (e.g. 100 for %). */
  displayScale?: number
  min?: number
  max?: number
  suffix?: string
  linkable?: boolean
}

export function AnimRow({
  label,
  refp,
  kind,
  step = 1,
  precision = 1,
  displayScale = 1,
  min,
  max,
  suffix,
  linkable
}: AnimRowProps) {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const update = useEditor((s) => s.update)
  const setTime = useEditor((s) => s.setTime)
  const [linked, setLinked] = useState(true)
  const a = getAnimatable(project, refp)
  if (!a) return null

  const tol = frameTolerance(project)
  const animated = a.keyframes.length > 0
  const val = evaluate(a, time)
  const atKey = animated ? keyAt(a, time, tol) : undefined
  const refKey = propRefKey(refp)

  const write = (v: AnimValue, mergeKey: string): void => {
    update((d) => {
      const da = getDraftAnimatable(d, refp)
      if (da) setValueAt(da, time, v as never, tol)
    }, `${refKey}-${mergeKey}`)
  }

  const setComponent = (i: number, display: number, mergeKey: string): void => {
    const v = [...(val as Vec3)] as Vec3
    const next = display / displayScale
    if (linkable && linked && kind === 'vec2' && (i === 0 || i === 1)) {
      const other = 1 - i
      const ratio = v[i] !== 0 ? next / v[i] : 1
      v[other] = v[i] !== 0 ? v[other] * ratio : next
    }
    v[i] = next
    write(v, mergeKey)
  }

  const prevKey = a.keyframes.filter((k) => k.t < time - tol).pop()
  const nextKey = a.keyframes.find((k) => k.t > time + tol)

  const toggleKeyHere = (): void => {
    update((d) => {
      const da = getDraftAnimatable(d, refp)
      if (!da) return
      const existing = keyAt(da, time, tol)
      if (existing) removeKeyframe(da, existing.id)
      else addKeyframe(da, time, evaluate(da, time) as never)
    })
  }

  const axes = ['x', 'y', 'z']
  const fieldCount = kind === 'vec3' ? 3 : kind === 'vec2' ? 2 : 1

  return (
    <div className="row">
      <button
        className={`stopwatch${animated ? ' on' : ''}`}
        title={animated ? 'Tắt animation (giữ giá trị hiện tại)' : 'Bật animation (tạo keyframe)'}
        onClick={() =>
          update((d) => {
            const da = getDraftAnimatable(d, refp)
            if (da) toggleAnimated(da, time)
          })
        }
      >
        <IconStopwatch />
      </button>
      <span className="row-label" title={label}>
        {label}
        {linkable && (
          <button
            className="stopwatch"
            style={{ display: 'inline-grid', marginLeft: 2, verticalAlign: 'middle', color: linked ? 'var(--accent)' : undefined }}
            title="Khoá tỉ lệ"
            onClick={() => setLinked((l) => !l)}
          >
            {linked ? '∞' : '·'}
          </button>
        )}
      </span>
      <div className="fields">
        {fieldCount === 1 ? (
          <NumberInput
            value={(val as number) * displayScale}
            onChange={(v, k) => write(v / displayScale, k)}
            step={step}
            precision={precision}
            min={min}
            max={max}
            animated={animated}
            suffix={suffix}
            axis="•"
          />
        ) : (
          Array.from({ length: fieldCount }, (_, i) => (
            <NumberInput
              key={i}
              axis={axes[i]}
              value={(val as Vec3)[i] * displayScale}
              onChange={(v, k) => setComponent(i, v, k)}
              step={step}
              precision={precision}
              animated={animated}
            />
          ))
        )}
        {animated && (
          <div className="keynav">
            <button title="Keyframe trước" disabled={!prevKey} onClick={() => prevKey && setTime(prevKey.t)}>
              ◀
            </button>
            <button
              className={`diamond${atKey ? ' on' : ''}`}
              title={atKey ? 'Xoá keyframe' : 'Thêm keyframe'}
              onClick={toggleKeyHere}
            >
              ◆
            </button>
            <button title="Keyframe sau" disabled={!nextKey} onClick={() => nextKey && setTime(nextKey.t)}>
              ▶
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ simple controls

export function Row({ label, children, title }: { label: string; children: ReactNode; title?: string }) {
  return (
    <div className="row plain" title={title}>
      <span className="row-label">{label}</span>
      <div className="fields">{children}</div>
    </div>
  )
}

export function Switch({ on, onChange, id }: { on: boolean; onChange: (v: boolean) => void; id?: string }) {
  return <button id={id} className={`switch${on ? ' on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on} />
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 0.01,
  format = (v: number) => v.toFixed(2),
  id
}: {
  value: number
  onChange: (v: number, mergeKey: string) => void
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  id?: string
}) {
  const keyRef = useRef(`slider-${nanoid(6)}`)
  return (
    <div className="slider">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={() => (keyRef.current = `slider-${nanoid(6)}`)}
        onChange={(e) => onChange(parseFloat(e.target.value), keyRef.current)}
      />
      <span className="val">{format(value)}</span>
    </div>
  )
}

export function ColorInput({ value, onChange, id }: { value: string; onChange: (v: string, mergeKey: string) => void; id?: string }) {
  const keyRef = useRef(`color-${nanoid(6)}`)
  return (
    <div className="color">
      <input
        id={id}
        type="color"
        value={value}
        onFocus={() => (keyRef.current = `color-${nanoid(6)}`)}
        onChange={(e) => onChange(e.target.value, keyRef.current)}
      />
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{value}</span>
    </div>
  )
}

export function TextInput({
  value,
  onCommit,
  multiline,
  id
}: {
  value: string
  onCommit: (v: string) => void
  multiline?: boolean
  id?: string
}) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const props = {
    id,
    value: text,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setText(e.target.value)
      onCommit(e.target.value)
    },
    onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation()
  }
  return multiline ? <textarea className="textarea" {...props} /> : <input className="input" {...props} />
}
