import type { EaseOptions } from '@shared/types'

export function parseEaseOptions(value: unknown): EaseOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('ease_options phải là object')
  const source = value as Record<string, unknown>
  const result: EaseOptions = {}
  for (const [name, min, max] of [['cycles', 1, 30], ['strength', 0, 1], ['holdUntil', .01, 1], ['duty', .05, .95]] as const) {
    const n = source[name]
    if (n === undefined) continue
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max || (name === 'cycles' && !Number.isInteger(n))) {
      throw new Error(`${name}: yêu cầu số ${min}–${max}${name === 'cycles' ? ' nguyên' : ''}`)
    }
    result[name] = n
  }
  return result
}
