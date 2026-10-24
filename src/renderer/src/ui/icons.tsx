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
export const IconGlobe = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
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
export const IconBriefcase = (p: P) => (
  <svg {...base(p)}>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M2 12h20" />
    <path d="M10 12v2.5h4V12" />
  </svg>
)
export const IconProject = IconBriefcase
export const IconLayerAssembly = (p: P) => (
  <svg {...base(p)}>
    <path d="m12 2 9 4.5-9 4.5-9-4.5z" />
    <path d="m3 11.5 9 4.5 9-4.5" />
    <path d="m3 16.5 9 4.5 9-4.5" />
  </svg>
)
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
export const IconAim = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" />
    <path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></svg>
)

export {
  IconPropPosition,
  IconPropRotation,
  IconPropScale,
  IconPropOpacity,
  IconKeyframeDiamond,
  IconMotionSmooth,
  IconMotionLinear,
  IconMotionHold,
  IconMotionPulse,
  IconMotionBlink,
  IconMotionTuning,
  IconKeyframe,
  IconTrimLeft,
  IconTrimRight,
  IconZoomIn,
  IconZoomOut,
  IconFitWidth,
  IconFxBlink,
  IconFxFadeOut,
  IconFxFadeIn,
  IconFxBreathe,
  IconFxShake,
  IconFxPopIn,
  IconFxPulse
} from './timelineIcons'

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

export const IconVolumeOff = (p: P) => (
  <svg {...base(p)}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
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



export const IconFit = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  </svg>
)

export const IconEyeOff = (p: P) => (
  <svg {...base(p)}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

export const IconLink = (p: P) => (
  <svg {...base(p)}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
)

export const IconUnlock = (p: P) => (
  <svg {...base(p)}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 7.8-1.2" />
  </svg>
)

export const IconLayersStack = (p: P) => (
  <svg {...base(p)}>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
)

export const IconAnchor = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="5" r="3" />
    <line x1="12" y1="8" x2="12" y2="21" />
    <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
  </svg>
)

export const IconBoundingBox = (p: P) => (
  <svg {...base(p)}>
    <rect x="5" y="5" width="14" height="14" rx="1" strokeDasharray="2.5 2.5" />
    <rect x="3" y="3" width="4" height="4" fill="currentColor" />
    <rect x="17" y="3" width="4" height="4" fill="currentColor" />
    <rect x="3" y="17" width="4" height="4" fill="currentColor" />
    <rect x="17" y="17" width="4" height="4" fill="currentColor" />
    <rect x="10" y="3" width="4" height="4" fill="currentColor" />
    <rect x="10" y="17" width="4" height="4" fill="currentColor" />
    <rect x="3" y="10" width="4" height="4" fill="currentColor" />
    <rect x="17" y="10" width="4" height="4" fill="currentColor" />
  </svg>
)

export const IconTree = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 2l-5 6h3l-4 6h5v6h2v-6h5l-4-6h3l-5-6z" />
  </svg>
)

export const IconUser = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

export const IconArmchair = (p: P) => (
  <svg {...base(p)}>
    <path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3" />
    <path d="M3 11v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-1a2 2 0 0 0-2 2v1H8v-1a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z" />
    <path d="M6 18v3M18 18v3" />
  </svg>
)

export const IconDecor = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3a3 3 0 0 0-3 3c0 2 3 4 3 4s3-2 3-4a3 3 0 0 0-3-3z" />
    <path d="M12 21a3 3 0 0 0 3-3c0-2-3-4-3-4s-3 2-3 4a3 3 0 0 0 3 3z" />
    <path d="M3 12a3 3 0 0 0 3 3c2 0 4-3 4-3s-2-3-4-3a3 3 0 0 0-3 3z" />
    <path d="M21 12a3 3 0 0 0-3-3c-2 0-4 3-4 3s2 3 4 3a3 3 0 0 0 3-3z" />
  </svg>
)

export const IconUserMale = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="7" r="4" />
    <path d="M5.5 21v-1.5a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5V21" />
    <path d="M12 15l-1.5 2.5h3L12 15z" />
  </svg>
)

export const IconUserFemale = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="7" r="3.5" />
    <path d="M8 8c-.8 2.5-1.5 5.5-.8 8.5M16 8c.8 2.5 1.5 5.5.8 8.5" />
    <path d="M6 21v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" />
    <path d="M9.5 5c1-1 2-1.5 3-1.5s2 .5 2.5 1.5" />
  </svg>
)

export const IconGrid3D = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
)

export const IconPropLamp = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 3h6v2H9zM7 7h10l-1.5 8H8.5L7 7z" />
    <path d="M6 15h12v4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19v-4z" />
    <path d="M12 1v2M12 10v2" />
  </svg>
)

export const IconSelectPointer = (p: P) => (
  <svg {...base(p)}>
    <path d="m3 3 7 18 3-7 7-3L3 3z" />
  </svg>
)

export const IconEraser = (p: P) => (
  <svg {...base(p)}>
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
    <path d="M22 21H7" />
    <path d="m5 11 9 9" />
  </svg>
)

export const IconBrush = (p: P) => (
  <svg {...base(p)}>
    <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
    <path d="M7.07 14.94c-1.66 0-3 1.34-3 3 0 1.5 1.5 3 3 3s3-1.5 3-3c0-1.66-1.34-3-3-3Z" />
  </svg>
)

export const IconPerspective2D = (p: P) => (
  <svg {...base(p)}>
    <polygon points="4 6 20 2 20 22 4 18 4 6" />
    <line x1="12" y1="4" x2="12" y2="20" />
    <line x1="4" y1="12" x2="20" y2="12" />
  </svg>
)

export const IconCrop = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 2v14a2 2 0 0 0 2 2h14" />
    <path d="M18 22V8a2 2 0 0 0-2-2H2" />
  </svg>
)

export const IconBone = (p: P) => (
  <svg {...base(p)}>
    <path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z" />
  </svg>
)

export const IconMeshWireframe = (p: P) => (
  <svg {...base(p)}>
    <polygon points="12 2 2 9 12 16 22 9 12 2" />
    <polygon points="12 16 2 9 2 15 12 22 22 15 22 9 12 16" />
    <line x1="12" y1="2" x2="12" y2="16" />
    <line x1="12" y1="16" x2="12" y2="22" />
  </svg>
)

export const IconDownload = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

export const IconUpload = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

/* Các icon phân loại thể loại âm thanh độc nhất (Audio Categories) */
export const IconAudioLibrary = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 6h18M3 12h18M3 18h18" />
    <circle cx="8" cy="6" r="2" fill="currentColor" />
    <circle cx="16" cy="12" r="2" fill="currentColor" />
    <circle cx="9" cy="18" r="2" fill="currentColor" />
  </svg>
)

export const IconWindAmbience = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9h11a3 3 0 1 0-3-3" />
    <path d="M2 14h15a3 3 0 1 1-3 3" />
    <path d="M5 19h7a2 2 0 1 0-2-2" />
  </svg>
)

export const IconActionFx = (p: P) => (
  <svg {...base(p)}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)

export const IconVoiceDialogue = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
)

export const IconCinematicClapper = (p: P) => (
  <svg {...base(p)}>
    <rect width="20" height="15" x="2" y="5" rx="2" />
    <path d="M2 9.5h20" />
    <path d="m6 5 2.5 4.5" />
    <path d="m11 5 2.5 4.5" />
    <path d="m16 5 2.5 4.5" />
  </svg>
)

export const IconAiSparkle = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
)

export const IconLipSync = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 11c2.5-3 5.5-4 9-4s6.5 1 9 4c-2.5 4-5.5 6-9 6s-6.5-2-9-6Z" />
    <path d="M7 11.5c1.5 1.5 3 2.5 5 2.5s3.5-1 5-2.5" />
    <path d="M9 10c1 .8 2 1.2 3 1.2s2-.4 3-1.2" />
  </svg>
)

export const IconReadout = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
    <path d="M6 15V9h2a1.5 1.5 0 0 1 0 3H6" />
    <path d="M12.5 15v-6h2a1.5 1.5 0 0 1 1.5 1.5c0 .7-.5 1.3-1.2 1.4l1.7 3.1h-1.5L13.5 12" />
  </svg>
)

export const IconDropper = (p: P) => (
  <svg {...base(p)}>
    <path d="m14 7 3 3m-3-3L6 15l-1 4 4-1 8-8m-3-3 2-2a2.12 2.12 0 1 1 3 3l-2 2" />
  </svg>
)

export const IconEyedropper = IconDropper

export const IconArrowUp = (p: P) => (
  <svg {...base(p)}>
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
)

export const IconArrowDown = (p: P) => (
  <svg {...base(p)}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </svg>
)

export const IconFlipHorizontal = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 7 3 12l5 5V7zm8 0 5 5-5 5V7zM12 2v20" />
  </svg>
)

export const IconUserQuarter = (p: P) => (
  <svg {...base(p)}>
    <circle cx="13" cy="7.5" r="4" />
    <path d="M13 6.5h2M14 9.2c.8.3 1.6.2 2.2-.2" />
    <path d="M5.5 20.5c.8-4.2 3.8-6.5 7.5-6.5 2.8 0 5.2 1.5 6.3 4.2" />
    <path d="M18 4l3 3-3 3" />
  </svg>
)

export const IconUserBack = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="4.2" />
    <path d="M8.5 6.8c1.5-2 5.5-2 7 0M9.2 10.2c1.5 1 4.1 1 5.6 0" />
    <path d="M5 20.5v-1.8A4.7 4.7 0 0 1 9.7 14h4.6a4.7 4.7 0 0 1 4.7 4.7v1.8" />
    <line x1="12" y1="14" x2="12" y2="20.5" />
  </svg>
)

export const IconAnimalPaw = (p: P) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="15.5" rx="4.2" ry="3.5" />
    <circle cx="6.5" cy="10.5" r="1.8" />
    <circle cx="10" cy="7.5" r="1.8" />
    <circle cx="14" cy="7.5" r="1.8" />
    <circle cx="17.5" cy="10.5" r="1.8" />
  </svg>
)

export const IconCameraStage = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="4" width="12" height="9" rx="1.5" />
    <rect x="9.5" y="11" width="12" height="9" rx="1.5" strokeDasharray="2.5 2" />
    <path d="M8.5 8.5 15.5 15.5" />
    <path d="M12.5 15.5h3v-3" />
  </svg>
)

export const IconLayout2D3D = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M11 4v16M3 12h8" />
  </svg>
)

export const IconLasso = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 22a5 5 0 0 1-2-4" />
    <path d="M3.3 14A6.8 6.8 0 0 1 2 10c0-4.4 4.5-8 10-8s10 3.6 10 8-4.5 8-10 8a12 12 0 0 1-5-1" />
    <circle cx="7" cy="18" r="2" />
  </svg>
)

export const IconColumns4 = (p: P) => (
  <svg {...base(p)}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <line x1="7" y1="4" x2="7" y2="20" />
    <line x1="12" y1="4" x2="12" y2="20" />
    <line x1="17" y1="4" x2="17" y2="20" />
  </svg>
)

/** Gỡ liên kết nhóm bộ phận (mắt xích đứt) */
export const IconUnlink = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 17H7a5 5 0 0 1 0-10h2" />
    <path d="M15 7h2a5 5 0 0 1 4 8" />
    <line x1="8" y1="12" x2="11" y2="12" />
    <line x1="3" y1="3" x2="21" y2="21" />
  </svg>
)

/** Bộ phận lắp ghép (mảnh ghép puzzle) */
export const IconPuzzle = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h3a2 2 0 1 1 4 0h3v3a2 2 0 1 1 0 4v3h-3a2 2 0 1 0-4 0H4v-3a2 2 0 1 0 0-4z" />
    <path d="M18 10h2v10h-8v-2" />
  </svg>
)

/** Biến thể khuôn mặt / đổi biểu cảm (2 khuôn mặt chồng nhau) */
export const IconFaceSwap = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="10" r="6" />
    <path d="M7 9h.01M11 9h.01M7 12.5a2.6 2.6 0 0 0 4 0" />
    <path d="M15.5 6.2A6 6 0 1 1 13 19.6" />
    <path d="M17 15.5a2.6 2.6 0 0 0-2-1" />
  </svg>
)


