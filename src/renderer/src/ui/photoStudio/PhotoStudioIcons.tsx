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

/* ──────────────────────────────────────────────────────────────────────────
   1. Left Rail Tools (Photoshop Editing & Selection Tools)
   ────────────────────────────────────────────────────────────────────────── */

/** Di chuyển (Pan / Open Hand Tool) */
export const IconToolPan = (p: P) => (
  <svg {...base(p)}>
    <path d="M18 11V6a2 2 0 0 0-4 0v5" />
    <path d="M14 10V4a2 2 0 0 0-4 0v7" />
    <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.7-2.3L3.6 17a1.7 1.7 0 0 1 2.4-2.4L8 16" />
  </svg>
)

/** Đũa thần (Magic Wand Tool) */
export const IconToolWand = (p: P) => (
  <svg {...base(p)}>
    <path d="m15 4 5 5L7.5 21.5a2.12 2.12 0 0 1-3-3L15 4z" />
    <path d="M12 2v2M20 10h2M3 10.5l1.5 1.5M10.5 3l1.5 1.5" />
    <circle cx="19" cy="5" r="0.75" fill="currentColor" />
  </svg>
)

/** Cọ tẩy (Eraser Tool) */
export const IconToolEraser = (p: P) => (
  <svg {...base(p)}>
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
    <path d="M22 21H7" />
    <path d="m5 11 7 7" />
  </svg>
)

/** Khôi phục điểm ảnh gốc (History / Healing Brush Tool) */
export const IconToolRestore = (p: P) => (
  <svg {...base(p)}>
    {/* Cọ vẽ với mũi tên khôi phục vòng tròn ↺ */}
    <path d="M18 3l3 3-9.5 9.5a2 2 0 0 1-1.4.6H7v-3.1a2 2 0 0 1 .6-1.4L18 3z" />
    <path d="M3 13a7 7 0 0 1 11.9-5" />
    <path d="M15 4h-4v4" />
    <path d="M3 21c2-1 4-1 4 0s-2 2-4 0z" fill="currentColor" />
  </svg>
)

/** Khung chữ nhật chọn vùng (Marquee Tool) */
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

/** Lasso đa giác (Lasso Tool) */
export const IconToolLasso = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 22a5 5 0 0 1-2-4c0-3.5 2.5-6 6.5-6s6.5 2.5 6.5 6a5 5 0 0 1-2 4" />
    <path d="M3.3 14A9 9 0 0 1 12 3a9 9 0 0 1 8.7 11" />
    <path d="M14 18l4 3M17 17l3 4" />
  </svg>
)

/** Kính lúp hút màu (Eyedropper Pipette Tool) */
export const IconToolEyedropper = (p: P) => (
  <svg {...base(p)}>
    <path d="m14 7 3 3m-9 9 9-9a2.12 2.12 0 0 0 0-3l-2-2a2.12 2.12 0 0 0-3 0l-9 9a2 2 0 0 0-.58 1.42V19h3.58a2 2 0 0 0 1.42-.58Z" />
    <path d="M19 11 21 9a2.12 2.12 0 0 0 0-3l-2-2a2.12 2.12 0 0 0-3 0l-2 2" />
    <circle cx="4" cy="20" r="1" fill="currentColor" />
  </svg>
)

/* ──────────────────────────────────────────────────────────────────────────
   2. Right Rail Chroma Tools (Tách Phông & Xử Lý Biên)
   ────────────────────────────────────────────────────────────────────────── */

/** Phông màu nền cần tách (Chroma Studio Backdrop) */
export const IconChromaBackdrop = (p: P) => (
  <svg {...base(p)}>
    {/* Màn phông studio phía sau và nhân vật đứng trước */}
    <rect x="3" y="3" width="18" height="14" rx="2" strokeDasharray="3 2" />
    <path d="M3 21h18M6 17v4M18 17v4" />
    <circle cx="12" cy="10" r="3" fill="currentColor" opacity="0.3" />
  </svg>
)

/** Độ nhạy tách nền (Chroma Tolerance / Sensitivity) */
export const IconChromaTolerance = (p: P) => (
  <svg {...base(p)}>
    {/* Vạch đo độ nhạy sóng màu lan toả */}
    <path d="M12 2v20" strokeDasharray="2 2" />
    <path d="M8 6c-2.5 1.5-4 4-4 6s1.5 4.5 4 6" />
    <path d="M16 6c2.5 1.5 4 4 4 6s-1.5 4.5-4 6" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
  </svg>
)

/** Mềm biên khử răng cưa (Feather Edge Smoothing) */
export const IconFeatherSmooth = (p: P) => (
  <svg {...base(p)}>
    {/* Lông vũ mềm mại (Feather) */}
    <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L3 12.5V21h8.5l8.74-8.76z" />
    <line x1="16" y1="8" x2="2" y2="22" strokeWidth="2" />
    <line x1="17.5" y1="15" x2="9" y2="15" />
    <line x1="14" y1="11" x2="6.5" y2="11" />
  </svg>
)

/** Gọt viền lem bám màu (Edge Choke / Matte Contract) */
export const IconEdgeChoke = (p: P) => (
  <svg {...base(p)}>
    {/* Khung viền ngoài với các mũi tên thu hẹp vào trong →[ ]← */}
    <rect x="2" y="2" width="20" height="20" rx="3" strokeDasharray="2 2" opacity="0.5" />
    <rect x="6" y="6" width="12" height="12" rx="2" strokeWidth="2" />
    <path d="M2 12h3M22 12h-3M12 2v3M12 22v-3" strokeWidth="2" />
  </svg>
)

/** Viền nét mịn nhân vật (Contour Outline Stroke) */
export const IconContourStroke = (p: P) => (
  <svg {...base(p)}>
    {/* Vòng nhân vật ở tâm và viền stroke nổi bật bên ngoài */}
    <circle cx="12" cy="12" r="9" strokeWidth="2.2" />
    <circle cx="12" cy="12" r="4.5" fill="currentColor" opacity="0.35" />
    <path d="M12 3a9 9 0 0 1 9 9" strokeWidth="3" />
  </svg>
)

/** Lọc đốm rác, khử viền lem & hạt sạn (Clean Artifacts / Despeckle) */
export const IconCleanArtifacts = (p: P) => (
  <svg {...base(p)}>
    {/* Chổi quét & tia sáng lung linh làm sạch đốm rác */}
    <path d="m14 4 6 6-9 9a2 2 0 0 1-1.4.6H5v-4.6a2 2 0 0 1 .6-1.4L14 4z" />
    <path d="M3 21c1.5-1 3-1 3 0" />
    <path d="M19 2l.7 1.5L21 4.2l-1.3.7-.7 1.5-.7-1.5L17 4.2l1.3-.7z" fill="currentColor" />
    <path d="M6 3l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5z" fill="currentColor" />
  </svg>
)

/* ──────────────────────────────────────────────────────────────────────────
   3. Right Rail Color Grading Tools (Chỉnh Màu Sắc & Ánh Sáng)
   ────────────────────────────────────────────────────────────────────────── */

/** Bộ lọc màu sắc (Color Presets / Palette) */
export const IconColorPresets = (p: P) => (
  <svg {...base(p)}>
    <circle cx="13.5" cy="6.5" r=".75" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".75" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".75" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".75" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.4-.4-.8-.4-1.4 0-1.1.9-2 2-2h2.3c3.9 0 7-3.1 7-7 0-5-4.5-9-10-9z" />
  </svg>
)

/** Độ sáng (Brightness / Sun) */
export const IconBrightness = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.3" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
)

/** Độ tương phản (Contrast / Half-filled) */
export const IconContrast = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
  </svg>
)

/** Độ bão hòa màu (Saturation / Vivid Droplet) */
export const IconSaturation = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    <path d="M12 8a4 4 0 0 1 4 4" strokeDasharray="2 2" />
    <circle cx="12" cy="14" r="2" fill="currentColor" />
  </svg>
)

/** Nhiệt độ màu (Warmth / Flame Temperature) */
export const IconWarmth = (p: P) => (
  <svg {...base(p)}>
    {/* Ngọn lửa & giọt nhiệt độ */}
    <path d="M12 2c1.5 3 4 5 4 8a6 6 0 0 1-12 0c0-3 2.5-5 4-8 0 2 1.5 3.5 4 0z" />
    <path d="M12 14a2 2 0 0 0 2-2c0-1.5-1-2.5-2-4-1 1.5-2 2.5-2 4a2 2 0 0 0 2 2z" fill="currentColor" />
  </svg>
)

/** Tông màu (Hue Shift / Spectrum Wheel) */
export const IconHue = (p: P) => (
  <svg {...base(p)}>
    {/* Vòng tròn 360 độ xoay đổi tông màu */}
    <path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8 1 6.5 2.7L21 8" />
    <path d="M21 3v5h-5" />
    <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.35" />
  </svg>
)

/** Phơi sáng máy ảnh (Exposure [+/-]) */
export const IconExposure = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="21" x2="21" y2="3" />
    {/* Dấu + góc trên trái */}
    <path d="M7 6v4M5 8h4" strokeWidth="2" />
    {/* Dấu - góc dưới phải */}
    <path d="M15 16h4" strokeWidth="2" />
  </svg>
)

/** Khôi phục toàn bộ thông số màu (Reset All Colors) */
export const IconResetAll = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
)

/* ──────────────────────────────────────────────────────────────────────────
   4. Toolbar Icons (Thanh Điều Hướng)
   ────────────────────────────────────────────────────────────────────────── */

/** Nền caro (Checkerboard) */
export const IconCheckerboard = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <rect x="3" y="3" width="9" height="9" fill="currentColor" opacity="0.4" />
    <rect x="12" y="12" width="9" height="9" fill="currentColor" opacity="0.4" />
  </svg>
)

/** Tải ảnh lên (Image Upload) */
export const IconImageUpload = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
    <path d="m21 15-5-5L5 21" />
    <path d="M12 11v6M9 14l3-3 3 3" strokeWidth="2" />
  </svg>
)
