import type { SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement> & { size?: number | string }
type P = IconProps
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

export const IconPlay = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 5v14l11-7z" fill="currentColor" />
  </svg>
)
export const IconPause = (p: P) => (
  <svg {...base(p)}>
    <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
    <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
  </svg>
)
export const IconGround = (p: P) => (
  <svg {...base(p)}>
    <path d="M2 17l10 5 10-5M2 12l10 5 10-5M12 2L2 7l10 5 10-5-10-5z" />
  </svg>
)
export const IconSkipStart = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 5v14M18 5 9 12l9 7z" />
  </svg>
)
export const IconSkipEnd = (p: P) => (
  <svg {...base(p)}>
    <path d="M18 5v14M6 5l9 7-9 7z" />
  </svg>
)
export const IconStepBack = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
)
export const IconStepFwd = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
)
export const IconLoop = (p: P) => (
  <svg {...base(p)}>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
)
export const IconPen = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
)
export const IconUndo = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
)
export const IconRedo = (p: P) => (
  <svg {...base(p)}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </svg>
)
export const IconFile = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
  </svg>
)
export const IconFolder = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
)
export const IconSave = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M7 3v5h8M7 21v-7h10v7" />
  </svg>
)
export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconImage = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="m21 16-5-5-9 9" />
  </svg>
)
export const IconText = (p: P) => (
  <svg {...base({ strokeWidth: 2.2, ...p })}>
    <path d="M4 6V4h16v2M12 4v16" />
  </svg>
)
export const IconSquare = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
  </svg>
)
export const IconSparkles = (p: P) => (
  <svg {...base({ strokeWidth: 1.5, ...p })}>
    <path d="M12 3l1.8 4.6L18 9.5l-4.2 1.9L12 16l-1.8-4.6L6 9.5l4.2-1.9z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />
    <path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />
  </svg>
)
export const IconMusic = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
)
export const IconCamera = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 10l5-3v10l-5-3z" />
    <rect x="3" y="6" width="12" height="12" rx="2" />
  </svg>
)
export const IconExport = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v12M7 8l5-5 5 5" />
    <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
  </svg>
)
export const IconEye = (p: P) => (
  <svg {...base(p)}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
export const IconLock = (p: P) => (
  <svg {...base(p)}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)
export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </svg>
)
export const IconCopy = (p: P) => (
  <svg {...base(p)}>
    <rect x="8" y="8" width="13" height="13" rx="2" />
    <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
  </svg>
)
export const IconUp = (p: P) => (
  <svg {...base(p)}>
    <path d="m6 15 6-6 6 6" />
  </svg>
)
export const IconDown = (p: P) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)
export const IconCaret = (p: P) => (
  <svg {...base(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
)
export const IconStopwatch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="14" r="7" />
    <path d="M12 10v4l2 2M10 3h4M12 3v4" />
  </svg>
)
export const IconWand = (p: P) => (
  <svg {...base(p)}>
    <path d="m15 4 5 5L9 20H4v-5z" />
    <path d="M13 6l5 5" />
  </svg>
)
export const IconLayers = (p: P) => (
  <svg {...base(p)}>
    <path d="m12 3 9 5-9 5-9-5z" />
    <path d="m3 13 9 5 9-5" />
  </svg>
)
export const IconChevronDown = (p: P) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)
export const IconFolderOpen = IconFolder
export const IconCube = (p: P) => (
  <svg {...base(p)}>
    <path d="m12 2 9 5v10l-9 5-9-5V7z" />
    <path d="m3 7 9 5 9-5M12 12v10" />
  </svg>
)
export const IconSplit = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M12 5v14" />
  </svg>
)
export const IconSingle = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
  </svg>
)
export const IconPlane = (p: P) => (
  <svg {...base(p)}>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4z" />
  </svg>
)
export const IconFocus = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
export const IconFilm = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4" />
  </svg>
)
export const IconRoute = (p: P) => (
  <svg {...base(p)}>
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="5" r="2" />
    <path d="M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16" />
  </svg>
)
export const IconPlug = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4" />
  </svg>
)
export const IconMemory = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="7" width="18" height="10" rx="1.5" />
    <path d="M7 7v10M11 7v10M15 7v10M6 17v3M18 17v3M6 4v3M18 4v3" />
  </svg>
)

export const IconSun = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
)

export const IconMoon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
  </svg>
)

export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

export const IconX = (p: P) => (
  <svg {...base(p)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

export const IconCity = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3" />
    <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
  </svg>
)

export const IconGrid = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
)

export const IconCode = (p: P) => (
  <svg {...base(p)}>
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
)

export const IconRefresh = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 21h5v-5" />
  </svg>
)

export const IconInfo = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
)

export const IconSettings = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

export const IconScissors = (p: P) => (
  <svg {...base(p)}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" />
  </svg>
)

export const IconKeyframe = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 2L2 12l10 10 10-10L12 2z" />
  </svg>
)

export const IconTrimLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 4v16M8 12h12M14 6l-6 6 6 6" />
  </svg>
)

export const IconTrimRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 4v16M16 12H4M10 6l6 6-6 6" />
  </svg>
)

export const IconZoomIn = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
  </svg>
)

export const IconZoomOut = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.35-4.35M8 11h6" />
  </svg>
)

export const IconFitWidth = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6v12M20 6v12M8 12h8M11 9l-3 3 3 3M13 9l3 3-3 3" />
  </svg>
)

/* ================================================================
   Specialized Animation & FX Icons
   ================================================================ */

/** Chớp tắt (Blink / Strobe) - Tia chớp đặc ruột sáng bừng */
export const IconFxBlink = (p: P) => (
  <svg {...base({ strokeWidth: 2, ...p })}>
    <path d="M13 2L3 14h8l-1 8 11-12h-8l1-8z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
)

/** Mờ dần (Fade Out) - nét liền chuyển sang nét đứt giảm dần */
export const IconFxFadeOut = (p: P) => (
  <svg {...base({ strokeWidth: 2.2, ...p })}>
    <path d="M4 12a8 8 0 0 1 8-8" />
    <path d="M4 12a8 8 0 0 0 8 8" />
    <path d="M12 4a8 8 0 0 1 8 8" strokeDasharray="2 2.5" />
    <path d="M12 20a8 8 0 0 0 8-8" strokeDasharray="2 2.5" />
    <path d="M10 12h6M13 9l3 3-3 3" />
  </svg>
)

/** Hiện dần (Fade In) - mờ chuyển sang rõ nét */
export const IconFxFadeIn = (p: P) => (
  <svg {...base({ strokeWidth: 2.2, ...p })}>
    <path d="M4 12a8 8 0 0 1 8-8" strokeDasharray="2 2.5" />
    <path d="M4 12a8 8 0 0 0 8 8" strokeDasharray="2 2.5" />
    <path d="M12 4a8 8 0 0 1 8 8" />
    <path d="M12 20a8 8 0 0 0 8-8" />
    <path d="M8 12h6M11 9l3 3-3 3" />
  </svg>
)

/** Nhịp thở huyền ảo (Breathe) - sóng sin điều hòa mượt nét đậm */
export const IconFxBreathe = (p: P) => (
  <svg {...base({ strokeWidth: 2.6, ...p })}>
    <path d="M2 12c3-6 5-6 8 0s5 6 8 0 3-3 4-3" />
  </svg>
)

/** Rung chấn (Shake) - rung giật đối xứng có sóng chấn động */
export const IconFxShake = (p: P) => (
  <svg {...base({ strokeWidth: 2.2, ...p })}>
    <rect x="7" y="5" width="10" height="14" rx="2" fill="currentColor" fillOpacity="0.25" />
    <path d="M3 8v8M21 8v8M1 10v4M23 10v4" strokeWidth="2.4" />
  </svg>
)

/** Nảy xuất hiện đàn hồi (Pop In) - bung nở từ tâm */
export const IconFxPopIn = (p: P) => (
  <svg {...base({ strokeWidth: 2.2, ...p })}>
    <circle cx="12" cy="12" r="3.5" fill="currentColor" />
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.34 6.34l2.5 2.5M15.16 15.16l2.5 2.5M6.34 17.66l2.5-2.5M15.16 8.84l2.5-2.5" />
  </svg>
)

/** Nhịp đập co giãn (Pulse Scale) - co giãn theo tỷ lệ */
export const IconFxPulse = (p: P) => (
  <svg {...base({ strokeWidth: 2.2, ...p })}>
    <path d="M15 3h6v6M9 21H3v-6M21 3l-6 6M3 21l6-6" />
    <rect x="8.5" y="8.5" width="7" height="7" rx="1.5" fill="currentColor" />
  </svg>
)

export const IconSliders = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
  </svg>
)

export const IconVolume = (p: P) => (
  <svg {...base(p)}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
)

export const IconMerge = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 6h10a2 2 0 0 1 2 2v2" />
    <path d="M8 18h10a2 2 0 0 0 2-2v-2" />
    <line x1="4" y1="6" x2="8" y2="6" />
    <line x1="4" y1="18" x2="8" y2="18" />
    <path d="M16 12h5M18 9l3 3-3 3" />
  </svg>
)

export const IconHome = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)

export const IconReplace = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 17l6-6M4 17h8M4 17v-8M20 7l-6 6M20 7h-8M20 7v8" />
  </svg>
)

export const IconMarquee = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7V4h3M17 4h3v3M4 17v3h3M17 20h3v-3" />
    <path d="M9 4h2M13 4h2M9 20h2M13 20h2M4 9v2M4 13v2M20 9v2M20 13v2" strokeDasharray="2 2" />
  </svg>
)

export const IconPin = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 17v5M5 5l14 14M9 3l6 6M15 9l4 4-2 2-7-7 2-2M9 15l-3 3" />
  </svg>
)



export const IconHand = (p: P) => (
  <svg {...base(p)}>
    <path d="M18 11V6a2 2 0 0 0-4 0v4M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6v-3a2 2 0 0 0-4 0v2" />
  </svg>
)

export const IconLightning = (p: P) => (
  <svg {...base(p)}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" fillOpacity="0.2" />
  </svg>
)

export const IconMeshGrid = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
  </svg>
)

export const IconSplitView = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M12 3v18" />
  </svg>
)

export const IconAxisMove = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
  </svg>
)

export const IconAxisRotate = (p: P) => (
  <svg {...base(p)}>
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-1.19" />
  </svg>
)

export const IconWireframe = (p: P) => (
  <svg {...base(p)}>
    <polygon points="12 2 2 8.5 12 15 22 8.5 12 2" />
    <polygon points="12 15 2 8.5 2 15.5 12 22 22 15.5 22 8.5 12 15" />
    <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="2 2" />
  </svg>
)



export const IconWarpGrid = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9c6 1 12-1 18 0M3 15c6 1 12-1 18 0M9 3c1 6-1 12 0 18M15 3c1 6-1 12 0 18" />
    <circle cx="9" cy="9" r="1.5" fill="currentColor" />
    <circle cx="15" cy="9" r="1.5" fill="currentColor" />
    <circle cx="9" cy="15" r="1.5" fill="currentColor" />
    <circle cx="15" cy="15" r="1.5" fill="currentColor" />
  </svg>
)

export const IconOrigamiFold = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 20L14 3l7 14-8 4-10-1z" />
    <path d="M14 3v18" strokeDasharray="3 2" />
    <path d="M9 13l5-3 5 3" />
  </svg>
)

export const IconFit = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  </svg>
)


