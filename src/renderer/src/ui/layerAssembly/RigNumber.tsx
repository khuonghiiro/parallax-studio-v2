/** Ô nhập số gọn cho thông số xương / keyframe (dùng chung các panel Tạo xương & Animation). */
export function RigNumber({
  label,
  value,
  onChange,
  min,
  max,
  step = 1
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div className="lw-num-field">
      <span className="lw-num-label">{label}</span>
      <input
        type="number"
        className="lw-field-input"
        aria-label={label}
        value={Number(value.toFixed(2))}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = e.target.valueAsNumber
          if (Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)) {
            onChange(n)
          }
        }}
      />
    </div>
  )
}
