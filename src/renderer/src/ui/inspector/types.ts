import type { Layer } from '@shared/types'

export type Setter = (fn: (l: Layer) => void, mergeKey?: string) => void

export const FONTS = ['Montserrat', 'Inter', 'Playfair Display', 'Bebas Neue', 'JetBrains Mono']

export const SIZE_PRESETS: { label: string; w: number; h: number }[] = [
  { label: '1920×1080 · 16:9', w: 1920, h: 1080 },
  { label: '1080×1920 · 9:16 (Reels/TikTok)', w: 1080, h: 1920 },
  { label: '1080×1080 · 1:1', w: 1080, h: 1080 },
  { label: '1080×1350 · 4:5', w: 1080, h: 1350 },
  { label: '2560×1440 · QHD', w: 2560, h: 1440 },
  { label: '3840×2160 · 4K', w: 3840, h: 2160 }
]
