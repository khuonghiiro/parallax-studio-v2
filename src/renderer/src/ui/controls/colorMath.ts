/**
 * Color math utilities for HEX, RGB, and HSV conversions.
 * Pure functions with zero dependencies for high performance in animations & color pickers.
 */

export interface RgbColor {
  r: number
  g: number
  b: number
}

export interface HsvColor {
  h: number // 0 - 360
  s: number // 0 - 1
  v: number // 0 - 1
}

export function isValidHex(hex: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim())
}

export function normalizeHex(hex: string, fallback = '#ffffff'): string {
  const trimmed = hex.trim()
  if (!isValidHex(trimmed)) return fallback
  let clean = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('')
  }
  return `#${clean.toLowerCase()}`
}

export function hexToRgb(hex: string): RgbColor {
  const norm = normalizeHex(hex, '#000000').slice(1)
  const num = parseInt(norm, 16)
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  }
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function rgbToHsv(r: number, g: number, b: number): HsvColor {
  const rn = Math.max(0, Math.min(255, r)) / 255
  const gn = Math.max(0, Math.min(255, g)) / 255
  const bn = Math.max(0, Math.min(255, b)) / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === rn) {
      h = ((gn - bn) / delta) % 6
    } else if (max === gn) {
      h = (bn - rn) / delta + 2
    } else {
      h = (rn - gn) / delta + 4
    }
    h = Math.round(h * 60)
    if (h < 0) h += 360
  }

  const s = max === 0 ? 0 : delta / max
  const v = max

  return { h, s, v }
}

export function hsvToRgb(h: number, s: number, v: number): RgbColor {
  const normH = ((h % 360) + 360) % 360
  const normS = Math.max(0, Math.min(1, s))
  const normV = Math.max(0, Math.min(1, v))

  const c = normV * normS
  const x = c * (1 - Math.abs(((normH / 60) % 2) - 1))
  const m = normV - c
  let r = 0,
    g = 0,
    b = 0

  if (normH >= 0 && normH < 60) {
    r = c
    g = x
    b = 0
  } else if (normH >= 60 && normH < 120) {
    r = x
    g = c
    b = 0
  } else if (normH >= 120 && normH < 180) {
    r = 0
    g = c
    b = x
  } else if (normH >= 180 && normH < 240) {
    r = 0
    g = x
    b = c
  } else if (normH >= 240 && normH < 300) {
    r = x
    g = 0
    b = c
  } else {
    r = c
    g = 0
    b = x
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  }
}

export function hexToHsv(hex: string): HsvColor {
  const rgb = hexToRgb(hex)
  return rgbToHsv(rgb.r, rgb.g, rgb.b)
}

export function hsvToHex(h: number, s: number, v: number): string {
  const rgb = hsvToRgb(h, s, v)
  return rgbToHex(rgb.r, rgb.g, rgb.b)
}
