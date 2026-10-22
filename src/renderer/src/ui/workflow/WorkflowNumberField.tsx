import React, { useEffect, useState } from 'react'

type Props = { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }

/** Keep intermediate text (empty, decimal separator) local while authoring a number. */
export function WorkflowNumberField({ label, value, min, max, step, onChange }: Props) {
  const [text, setText] = useState(String(value))
  useEffect(() => { setText(String(value)) }, [value])
  const commit = () => {
    const number = Number(text)
    const next = text.trim() && Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : value
    setText(String(next)); if (next !== value) onChange(next)
  }
  return <label className="wf-operation-field"><span>{label}</span><input type="number" min={min} max={max} step={step}
    value={text} onChange={(event) => {
      setText(event.target.value)
      const number = event.target.valueAsNumber
      if (Number.isFinite(number) && number >= min && number <= max) onChange(number)
    }} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit() } }} /></label>
}
