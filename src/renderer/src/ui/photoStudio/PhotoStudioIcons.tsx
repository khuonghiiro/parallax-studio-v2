import React, { type SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number | string }

const base = ({ size, width, height, ...props }: P): SVGProps<SVGSVGElement> => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  width: size ?? width ?? 16,
  height: size ?? height ?? 16,
  ...props
})

/** Di chuyển (Hand / Pan) */
export const IconToolPan = (p: P) => (
  <svg {...base(p)}>
    <path d="M18 11V6a2 2 0 0 0-4 0v5" />
    <path d="M14 10V4a2 2 0 0 0-4 0v7" />
    <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.7-2.3L3.6 17a1.7 1.7 0 0 1 2.4-2.4L8 16" />
  </svg>
)

/** Khung chữ nhật (Marquee Box) */
export const IconToolMarquee = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2" />
    <path d="M4 12v1" />
    <path d="M4 16v2a2 2 0 0 0 2 2h2" />
    <path d="M12 4h1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v2" />
    <path d="M20 12v1" />
    <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
    <path d="M12 20h1" />
  </svg>
)

/** Lasso đa giác */
export const IconToolLasso = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 22a5 5 0 0 1-2-4c0-3.5 2.5-6 6.5-6s6.5 2.5 6.5 6a5 5 0 0 1-2 4" />
    <path d="M3.3 14A9 9 0 0 1 12 3a9 9 0 0 1 8.7 11" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
)

/** Độ nhạy (Tolerance / Target) */
export const IconTolerance = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
)

/** Mềm biên (Feather) */
export const IconFeather = (p: P) => (
  <svg {...base(p)}>
    <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L3 12.5V21h8.5l8.74-8.76z" />
    <line x1="16" y1="8" x2="2" y2="22" />
    <line x1="17.5" y1="15" x2="9" y2="15" />
  </svg>
)

/** Gọt viền (Edge Choke / Scissor) */
export const IconEdgeChoke = (p: P) => (
  <svg {...base(p)}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
)

/** Viền nét (Stroke / Contour) */
export const IconContourStroke = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />
    <circle cx="12" cy="12" r="5" fill="none" strokeWidth="2.5" />
  </svg>
)

/** Khử lem viền & Đốm rác (Defringe / Clean Shield) */
export const IconShieldClean = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)

/** Bộ lọc ảnh (Palette) */
export const IconPalette = (p: P) => (
  <svg {...base(p)}>
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.4-.4-.8-.4-1.4 0-1.1.9-2 2-2h2.3c3.9 0 7-3.1 7-7 0-5-4.5-9-10-9z" />
  </svg>
)

/** Tương phản (Contrast) */
export const IconContrast = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
  </svg>
)

/** Độ bão hòa (Saturation / Drop) */
export const IconSaturation = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    <path d="M12 22.7v-14" strokeDasharray="2 2" />
  </svg>
)

/** Nhiệt độ màu (Warmth / Flame) */
export const IconWarmth = (p: P) => (
  <svg {...base(p)}>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
)

/** Tông màu (Hue Shift) */
export const IconHue = (p: P) => (
  <svg {...base(p)}>
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
  </svg>
)

/** Phơi sáng (Exposure) */
export const IconExposure = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="21" x2="21" y2="3" />
    <path d="M7 6v4M5 8h4" />
    <path d="M15 16h4" />
  </svg>
)

/** Nền caro (Checkerboard) */
export const IconCheckerboard = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <rect x="3" y="3" width="9" height="9" fill="currentColor" opacity="0.35" />
    <rect x="12" y="12" width="9" height="9" fill="currentColor" opacity="0.35" />
  </svg>
)
