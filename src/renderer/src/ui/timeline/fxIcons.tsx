import React from 'react'
import {
  IconFxBlink,
  IconFxBreathe,
  IconFxFadeIn,
  IconFxFadeOut,
  IconFxPopIn,
  IconFxPulse,
  IconFxShake,
  IconSparkles
} from '../icons'

/**
 * Returns a clean, semantically accurate SVG icon for animation presets.
 */
export function renderFxIcon(presetId: string, size = 14, customColor?: string): React.ReactNode {
  switch (presetId) {
    case 'blink':
      return <IconFxBlink width={size} height={size} style={{ color: customColor || '#b45309' }} />
    case 'fadeOut':
      return <IconFxFadeOut width={size} height={size} style={{ color: customColor || '#475569' }} />
    case 'fadeIn':
      return <IconFxFadeIn width={size} height={size} style={{ color: customColor || '#0284c7' }} />
    case 'breathe':
      return <IconFxBreathe width={size} height={size} style={{ color: customColor || '#7e22ce' }} />
    case 'shake':
      return <IconFxShake width={size} height={size} style={{ color: customColor || '#b91c1c' }} />
    case 'popIn':
      return <IconFxPopIn width={size} height={size} style={{ color: customColor || '#047857' }} />
    case 'pulse':
      return <IconFxPulse width={size} height={size} style={{ color: customColor || '#c2410c' }} />
    case 'neonBreathe':
    case 'neonBlink':
    case 'neonFlicker':
    case 'neonSolid':
    case 'glow':
      return <IconSparkles width={size} height={size} style={{ color: customColor || '#0891b2' }} />
    default:
      if (presetId.startsWith('neon')) {
        return <IconSparkles width={size} height={size} style={{ color: customColor || '#0891b2' }} />
      }
      return <IconSparkles width={size} height={size} style={{ color: customColor || '#1d4ed8' }} />
  }
}

/**
 * Returns signature theme color for each effect preset.
 */
export function getFxColor(presetId: string): string {
  switch (presetId) {
    case 'blink':
      return '#b45309'
    case 'fadeOut':
      return '#475569'
    case 'fadeIn':
      return '#0284c7'
    case 'breathe':
      return '#7e22ce'
    case 'shake':
      return '#b91c1c'
    case 'popIn':
      return '#047857'
    case 'pulse':
      return '#c2410c'
    case 'neonBreathe':
    case 'neonBlink':
    case 'neonFlicker':
    case 'neonSolid':
    case 'glow':
      return '#0891b2'
    default:
      if (presetId.startsWith('neon')) return '#0891b2'
      return '#1d4ed8'
  }
}

/**
 * Short identifier name for compact keyframe tooltips.
 */
export function getFxShortName(presetId: string): string {
  switch (presetId) {
    case 'blink':
      return 'Chớp tắt (Blink)'
    case 'fadeOut':
      return 'Mờ dần (Fade Out)'
    case 'fadeIn':
      return 'Hiện dần (Fade In)'
    case 'breathe':
      return 'Thở (Breathe)'
    case 'shake':
      return 'Rung (Shake)'
    case 'popIn':
      return 'Nảy vào (Pop In)'
    case 'pulse':
      return 'Co giãn (Pulse)'
    case 'neonBreathe':
    case 'neonBlink':
    case 'neonFlicker':
    case 'neonSolid':
    case 'glow':
      return 'Viền Neon'
    default:
      return 'Hiệu ứng'
  }
}
