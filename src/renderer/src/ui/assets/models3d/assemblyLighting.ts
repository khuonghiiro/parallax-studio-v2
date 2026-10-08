import type { AssemblyLighting, SunPreset } from './types'

/**
 * Pure lighting model of the Assembly workshop (no three.js): presets, sun direction and
 * the colours / intensities of the light rig. Faces use a diffuse-only (Lambert) material,
 * so the sun tints and shades the image pixels without any specular glare.
 */

export const DEFAULT_LIGHTING: AssemblyLighting = {
  sun: true,
  shadows: true,
  azimuth: 35,
  elevation: 50,
  intensity: 1,
  preset: 'auto'
}

export interface SunPresetInfo {
  id: SunPreset
  label: string
  title: string
  /** Sun angles applied when the preset is picked (auto keeps the current angles). */
  azimuth?: number
  elevation?: number
}

export const SUN_PRESETS: SunPresetInfo[] = [
  { id: 'auto', label: 'Tự động', title: 'Màu nắng tự đổi theo độ cao mặt trời (thấp = ấm, cao = trắng)' },
  { id: 'morning', label: 'Bình minh', title: 'Nắng sớm vàng nhạt, chiếu xiên từ bên trái', azimuth: -55, elevation: 22 },
  { id: 'noon', label: 'Trưa', title: 'Nắng trưa trắng, bóng ngắn', azimuth: 25, elevation: 68 },
  { id: 'sunset', label: 'Hoàng hôn', title: 'Nắng cam ấm sát chân trời, bóng dài', azimuth: 115, elevation: 8 },
  { id: 'overcast', label: 'Trời râm', title: 'Ánh sáng tản dịu, bóng mờ', azimuth: 20, elevation: 70 },
  { id: 'night', label: 'Đêm trăng', title: 'Ánh trăng xanh lạnh', azimuth: -30, elevation: 40 }
]

export interface LightRigSpec {
  /** Unit vector (three space) pointing from the model towards the sun. */
  direction: [number, number, number]
  sunColor: string
  /** Physical intensity (already multiplied by π for Lambert materials). */
  sunIntensity: number
  ambientColor: string
  ambientIntensity: number
  shadows: boolean
  /** Opacity of the ground shadow catcher. */
  shadowOpacity: number
  /** Whether the sun marker is drawn. */
  showSun: boolean
}

interface Mood {
  sun: string
  sunI: number
  amb: string
  ambI: number
  shadow: number
}

const MOODS: Record<Exclude<SunPreset, 'auto'>, Mood> = {
  morning: { sun: '#ffd9a8', sunI: 0.72, amb: '#d3defa', ambI: 0.42, shadow: 0.34 },
  noon: { sun: '#fff6e6', sunI: 0.75, amb: '#e3eaf7', ambI: 0.45, shadow: 0.38 },
  sunset: { sun: '#ff9550', sunI: 0.85, amb: '#9a88c2', ambI: 0.38, shadow: 0.3 },
  overcast: { sun: '#f1f3f6', sunI: 0.25, amb: '#e8ecf2', ambI: 0.78, shadow: 0.14 },
  night: { sun: '#a4b8ff', sunI: 0.38, amb: '#3c4b7a', ambI: 0.36, shadow: 0.26 }
}

export interface SkyAtmosphere {
  /** Background color for 3D scene canvas (Three.js Color) */
  background: string
  /** Sun light color */
  sunColor: string
  /** Ambient light color */
  ambientColor: string
  /** Human friendly label */
  label: string
  /** Emoji icon for HUD / badges */
  icon: string
  /** Whether the 3D scene should be treated as dark (for high-contrast grid lines) */
  isDarkScene: boolean
}

interface SkyThemeColors {
  light: string
  dark: string
  icon: string
  label: string
  isDarkScene?: boolean
}

const SKY_PRESETS: Record<Exclude<SunPreset, 'auto'>, SkyThemeColors> = {
  morning: {
    light: '#e2e9f2',
    dark: '#1c2436',
    icon: '🌅',
    label: 'Bình minh'
  },
  noon: {
    light: '#dce8f8',
    dark: '#162234',
    icon: '☀️',
    label: 'Trưa'
  },
  sunset: {
    light: '#ebd7d1',
    dark: '#2c1922',
    icon: '🌇',
    label: 'Hoàng hôn'
  },
  overcast: {
    light: '#dbe0e8',
    dark: '#1e232b',
    icon: '☁️',
    label: 'Trời râm'
  },
  night: {
    light: '#111728',
    dark: '#0a0e1c',
    icon: '🌙',
    label: 'Đêm trăng',
    isDarkScene: true
  }
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, '0')).join('')}`
}

export function mixHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a)
  const pb = hexToRgb(b)
  const k = clamp(t, 0, 1)
  return rgbToHex([pa[0] + (pb[0] - pa[0]) * k, pa[1] + (pb[1] - pa[1]) * k, pa[2] + (pb[2] - pa[2]) * k])
}

/** Automatic mood: warm and dim near the horizon, neutral white high in the sky. */
function autoMood(elevation: number): Mood {
  const warm = 1 - clamp(elevation / 45, 0, 1)
  return {
    sun: mixHex('#fff4e2', '#ff9a52', warm),
    sunI: 0.75 + 0.1 * warm,
    amb: mixHex('#e2e9f6', '#a593c4', warm),
    ambI: 0.45 - 0.07 * warm,
    shadow: 0.38 - 0.08 * warm
  }
}

/** Direction (three space: +x right, +y up, +z towards the front viewer) towards the sun. */
export function sunDirection(azimuthDeg: number, elevationDeg: number): [number, number, number] {
  const az = (azimuthDeg * Math.PI) / 180
  const el = (clamp(elevationDeg, 1, 89.5) * Math.PI) / 180
  return [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)]
}

/** Fills missing / invalid fields with defaults (older saved models have no lighting). */
export function normalizeLighting(l?: Partial<AssemblyLighting> | null): AssemblyLighting {
  const base = { ...DEFAULT_LIGHTING, ...(l || {}) }
  return {
    sun: Boolean(base.sun),
    shadows: Boolean(base.shadows),
    azimuth: clamp(Number(base.azimuth) || 0, -180, 180),
    elevation: clamp(Number(base.elevation) || 0, 1, 89),
    intensity: clamp(Number.isFinite(base.intensity) ? base.intensity : 1, 0, 2),
    preset: SUN_PRESETS.some((p) => p.id === base.preset) ? base.preset : 'auto'
  }
}

/** Picks a preset: applies its sun angles (auto keeps the current ones). */
export function applySunPreset(l: AssemblyLighting, preset: SunPreset): AssemblyLighting {
  const info = SUN_PRESETS.find((p) => p.id === preset)
  return {
    ...l,
    preset,
    sun: true,
    azimuth: info?.azimuth ?? l.azimuth,
    elevation: info?.elevation ?? l.elevation
  }
}

/**
 * Light rig for the viewport. With the sun off a neutral "studio" rig is used: soft, even
 * light from the front so the images keep their own colours (no shadows, no glare).
 */
export function resolveLightRig(input?: Partial<AssemblyLighting> | null): LightRigSpec {
  const l = normalizeLighting(input)
  if (!l.sun) {
    return {
      direction: sunDirection(20, 35),
      sunColor: '#ffffff',
      sunIntensity: 0.3 * Math.PI,
      ambientColor: '#ffffff',
      ambientIntensity: 0.78 * Math.PI,
      shadows: false,
      shadowOpacity: 0,
      showSun: false
    }
  }
  const mood = l.preset === 'auto' ? autoMood(l.elevation) : MOODS[l.preset]
  return {
    direction: sunDirection(l.azimuth, l.elevation),
    sunColor: mood.sun,
    sunIntensity: mood.sunI * l.intensity * Math.PI,
    ambientColor: mood.amb,
    ambientIntensity: mood.ambI * Math.PI,
    shadows: l.shadows,
    shadowOpacity: mood.shadow,
    showSun: true
  }
}

/**
 * Resolves the atmospheric 3D scene background color, sun indicator label and icon
 * based on the active lighting preset or sun elevation angle.
 */
export function resolveSkyAtmosphere(
  input?: Partial<AssemblyLighting> | null,
  isLight = true,
  fallbackBackground?: string
): SkyAtmosphere {
  const l = normalizeLighting(input)
  if (!l.sun) {
    const bg = fallbackBackground || (isLight ? '#dbe0e8' : '#141414')
    return {
      background: bg,
      sunColor: '#ffffff',
      ambientColor: '#ffffff',
      label: 'Studio',
      icon: '💡',
      isDarkScene: !isLight
    }
  }

  const themeKey = isLight ? 'light' : 'dark'
  if (l.preset !== 'auto') {
    const spec = SKY_PRESETS[l.preset]
    const mood = MOODS[l.preset]
    return {
      background: spec[themeKey],
      sunColor: mood.sun,
      ambientColor: mood.amb,
      label: spec.label,
      icon: spec.icon,
      isDarkScene: Boolean(spec.isDarkScene || !isLight)
    }
  }

  // Auto preset: smooth interpolation based on sun elevation angle
  const warm = 1 - clamp(l.elevation / 45, 0, 1)
  const bg = mixHex(SKY_PRESETS.noon[themeKey], SKY_PRESETS.sunset[themeKey], warm)
  const mood = autoMood(l.elevation)
  return {
    background: bg,
    sunColor: mood.sun,
    ambientColor: mood.amb,
    label: `Tự động (${l.elevation}°)`,
    icon: warm > 0.4 ? '🌅' : '☀️',
    isDarkScene: !isLight
  }
}

