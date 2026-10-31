import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number | string }

const base = ({ size, width, height, ...props }: P): SVGProps<SVGSVGElement> => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  width: size ?? width ?? 15,
  height: size ?? height ?? 15,
  ...props
})

export const IconDeviceAuto = (p: P) => (
  <svg {...base(p)}>
    <rect x="2" y="4" width="14" height="10" rx="2" />
    <rect x="15" y="9" width="7" height="11" rx="1.6" />
    <path d="M6 18h5M8.5 14v4M18.5 17.5h.01" />
  </svg>
)

export const IconDevicePhone = (p: P) => (
  <svg {...base(p)}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
    <path d="M10.5 5.5h3M12 18.5h.01" />
  </svg>
)

export const IconDeviceTablet = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="2.5" width="16" height="19" rx="2.4" />
    <circle cx="12" cy="18.5" r="0.8" fill="currentColor" />
  </svg>
)

export const IconDeviceLaptop = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="4.5" width="16" height="11" rx="1.8" />
    <path d="M2 18.5h20" />
  </svg>
)

export const IconDeviceDesktop = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="3.5" width="19" height="13" rx="2" />
    <path d="M8 20.5h8M12 16.5v4" />
  </svg>
)

export const IconTouchpadRemote = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M3 14.5h18M12 14.5V20" />
    <circle cx="12" cy="9.2" r="2.1" />
  </svg>
)

export const IconFullscreenExpand = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
)
