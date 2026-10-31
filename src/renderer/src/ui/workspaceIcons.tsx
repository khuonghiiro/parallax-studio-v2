import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = (p: P): P => ({
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...p
})

/** Ống kính khẩu độ Camera (Tab Camera trong Inspector — phân biệt rõ với IconCamera & IconFilm) */
export const IconCameraLens = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9.5" />
    <circle cx="12" cy="12" r="3.4" />
    <line x1="14.4" y1="9.6" x2="19.8" y2="7.5" />
    <line x1="9.6" y1="9.6" x2="13.5" y2="2.7" />
    <line x1="8.6" y1="12.5" x2="4.2" y2="7.5" />
    <line x1="9.6" y1="14.4" x2="4.2" y2="16.5" />
    <line x1="14.4" y1="14.4" x2="10.5" y2="21.3" />
    <line x1="15.4" y1="11.5" x2="19.8" y2="16.5" />
  </svg>
)

/** Lộ trình Waypoint Camera (Đường cong nối 3 mốc thoi Keyframe — Tab Lộ trình) */
export const IconRouteWaypoints = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.5 18.5C7 11 11.5 15 14 9.5S17.5 5 19.5 5" />
    <polygon points="4.5 16 7 18.5 4.5 21 2 18.5" fill="currentColor" />
    <polygon points="12.2 10 14.4 12.2 12.2 14.4 10 12.2" fill="currentColor" />
    <polygon points="19.5 2.5 22 5 19.5 7.5 17 5" fill="currentColor" />
  </svg>
)

/** Khung Composition & Thiết lập Dự án 16:9 (Tab Dự án trong Inspector) */
export const IconCompFrame = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
    <polyline points="6 9.5 6 7.5 8.5 7.5" />
    <polyline points="18 9.5 18 7.5 15.5 7.5" />
    <polyline points="6 14.5 6 16.5 8.5 16.5" />
    <polyline points="18 14.5 18 16.5 15.5 16.5" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
  </svg>
)

/** Mạch Node & Bộ chỉnh Logic (Tab Thuộc tính Node — phân biệt rõ với IconSliders) */
export const IconNodeCircuit = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="7" height="7" rx="1.6" />
    <circle cx="10" cy="7.5" r="1.3" fill="currentColor" />
    <path d="M11.3 7.5H16a2 2 0 0 1 2 2V12" />
    <line x1="4" y1="15.5" x2="20" y2="15.5" />
    <circle cx="14.5" cy="15.5" r="1.8" fill="currentColor" />
    <line x1="4" y1="19.5" x2="20" y2="19.5" />
    <circle cx="8.5" cy="19.5" r="1.8" fill="currentColor" />
  </svg>
)

/** Cặp ngoặc JSON Cảnh & Main ({ }) */
export const IconJsonBraces = (p: P) => (
  <svg {...base(p)}>
    <path d="M8.5 4H6.8A1.8 1.8 0 0 0 5 5.8v3.7A2.3 2.3 0 0 1 2.8 12 2.3 2.3 0 0 1 5 14.5v3.7A1.8 1.8 0 0 0 6.8 20h1.7" />
    <path d="M15.5 4h1.7A1.8 1.8 0 0 1 19 5.8v3.7a2.3 2.3 0 0 0 2.2 2.5A2.3 2.3 0 0 0 19 14.5v3.7a1.8 1.8 0 0 1-1.8 1.8h-1.7" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" />
  </svg>
)

/** Thu gọn Cột trái thành thanh Rail dọc */
export const IconSidebarLeftCollapse = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3.5" width="18" height="17" rx="2" />
    <line x1="9" y1="3.5" x2="9" y2="20.5" />
    <polyline points="15.5 9.5 12.5 12 15.5 14.5" />
  </svg>
)

/** Mở rộng lại Cột trái từ thanh Rail dọc */
export const IconSidebarLeftExpand = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3.5" width="18" height="17" rx="2" />
    <line x1="9" y1="3.5" x2="9" y2="20.5" />
    <polyline points="12.5 9.5 15.5 12 12.5 14.5" />
  </svg>
)

/** Thu gọn Cột phải thành thanh Rail dọc */
export const IconSidebarRightCollapse = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3.5" width="18" height="17" rx="2" />
    <line x1="15" y1="3.5" x2="15" y2="20.5" />
    <polyline points="8.5 9.5 11.5 12 8.5 14.5" />
  </svg>
)

/** Mở rộng lại Cột phải từ thanh Rail dọc */
export const IconSidebarRightExpand = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3.5" width="18" height="17" rx="2" />
    <line x1="15" y1="3.5" x2="15" y2="20.5" />
    <polyline points="11.5 9.5 8.5 12 11.5 14.5" />
  </svg>
)

/** Mở rộng 1 vùng chiếm trọn chiều dọc cột Inspector */
export const IconPaneMaximizeV = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="3" width="17" height="18" rx="2" />
    <polyline points="9.5 8.5 12 6 14.5 8.5" />
    <polyline points="9.5 15.5 12 18 14.5 15.5" />
    <line x1="12" y1="6.5" x2="12" y2="17.5" />
  </svg>
)

/** Chia đôi cột Inspector thành 2 ngăn trên/dưới song song */
export const IconPaneSplitH = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="3" width="17" height="18" rx="2" />
    <line x1="3.5" y1="12" x2="20.5" y2="12" />
    <line x1="8" y1="7.5" x2="16" y2="7.5" />
    <line x1="8" y1="16.5" x2="16" y2="16.5" />
  </svg>
)

/** Hình chiếu bằng từ trên xuống Top-down (X-Z) */
export const IconTopDownXZ = (p: P) => (
  <svg {...base(p)}>
    <line x1="12" y1="3" x2="12" y2="11" />
    <polyline points="9 8.5 12 11.5 15 8.5" />
    <polygon points="12 13.5 20.5 17 12 20.5 3.5 17" />
  </svg>
)

/** Hình chiếu cạnh nhìn ngang Side-elevation (Z-Y) */
export const IconSideElevationZY = (p: P) => (
  <svg {...base(p)}>
    <line x1="3" y1="12" x2="10.5" y2="12" />
    <polyline points="8 9 11 12 8 15" />
    <polyline points="14 5 14 19 21 19" />
    <line x1="14" y1="14" x2="20" y2="10" strokeDasharray="2 2" />
  </svg>
)

/** Mở rộng sơ đồ ra khung Viewport trung tâm */
export const IconExpandToStage = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 4h6v6" />
    <line x1="20" y1="4" x2="12" y2="12" />
    <path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
  </svg>
)

/** Tự động tạo đường bay Camera điện ảnh qua các cảnh (Auto Fly Tour) */
export const IconAutoFlyTour = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 18c2.5-7 7.5-9 17-12" />
    <polyline points="15.5 4.5 20.2 5.8 18 10.2" />
    <path d="M8.5 4.5 9.4 7l2.6.9-2.6.9-.9 2.5-.9-2.5-2.6-.9 2.6-.9Z" fill="currentColor" stroke="none" />
  </svg>
)

/** Tạo Node nguồn thời gian chung (+ Time Node) */
export const IconTimeNodePlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M19.5 10.5A8 8 0 1 0 13 19.9" />
    <polyline points="11.5 7.5 11.5 12 14.5 13.8" />
    <line x1="18" y1="15" x2="18" y2="21" />
    <line x1="15" y1="18" x2="21" y2="18" />
  </svg>
)

/** Bàn điều khiển không gian 2.5D (2.5D Spatial Pad) */
export const IconPad25D = (p: P) => (
  <svg {...base(p)}>
    <polygon points="12 3.5 21 8.5 12 13.5 3 8.5" />
    <polyline points="3 14 12 19 21 14" strokeDasharray="2.2 2" />
    <circle cx="12" cy="8.5" r="1.8" fill="currentColor" />
  </svg>
)
