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

/** Độ sâu 2.5D: 3 mặt phẳng layer xếp lớp theo trục chiều sâu Z */
export const IconDepth25D = (p: P) => (
  <svg {...base(p)}>
    <polygon points="4 8 11 4 11 14 4 18" />
    <polyline points="9 6.5 15 3.5 15 13.5 11 15.5" />
    <polyline points="14 5 20 2 20 12 15 14.5" />
    <path d="M4 21l16-8" strokeDasharray="2 2" />
  </svg>
)

/** Đường bay Camera 3D: Đường cong quỹ đạo nối các điểm keyframe kim cương */
export const IconFlightPath3D = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 18C6 10 11 15 14 8s5-4 6-4" />
    <polygon points="4 15.5 6.5 18 4 20.5 1.5 18" fill="currentColor" />
    <polygon points="12.5 8.5 14.5 10.5 12.5 12.5 10.5 10.5" fill="currentColor" />
    <polyline points="17 3 20.5 4 19.5 7.5" />
  </svg>
)

/** Chỉ hiện nội dung trong tầm nhìn Camera (Camera Frustum Culling) */
export const IconCameraFrustumCull = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="19" r="2" fill="currentColor" />
    <path d="M10.5 17.5 3 6h18l-7.5 11.5" />
    <line x1="6.5" y1="11" x2="17.5" y2="11" strokeDasharray="2 2" />
    <rect x="8.5" y="5.5" width="7" height="4" rx="0.8" />
  </svg>
)

/** Focus khung hình vào vùng chọn 3D (4 góc ngắm + khối hộp 3D ở tâm) */
export const IconFocusTarget3D = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 8V5a2 2 0 0 1 2-2h3" />
    <path d="M16 3h3a2 2 0 0 1 2 2v3" />
    <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
    <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
    <polygon points="12 7.5 16.5 10 16.5 14.5 12 17 7.5 14.5 7.5 10" />
    <polyline points="7.5 10 12 12.5 16.5 10" />
    <line x1="12" y1="12.5" x2="12" y2="17" />
  </svg>
)

/** Khung viền Bounding Box kèm 4 chốt kéo giãn ở 4 góc */
export const IconGizmoBbox = (p: P) => (
  <svg {...base(p)}>
    <rect x="5" y="5" width="14" height="14" strokeDasharray="3 2.5" />
    <rect x="3" y="3" width="4" height="4" rx="0.8" fill="currentColor" />
    <rect x="17" y="3" width="4" height="4" rx="0.8" fill="currentColor" />
    <rect x="3" y="17" width="4" height="4" rx="0.8" fill="currentColor" />
    <rect x="17" y="17" width="4" height="4" rx="0.8" fill="currentColor" />
  </svg>
)

/** Gizmo Trục Di Chuyển 3D (3 mũi tên trực giao X-Y-Z xuất phát từ tâm) */
export const IconGizmoTranslate3D = (p: P) => (
  <svg {...base(p)}>
    <line x1="12" y1="13" x2="12" y2="3" />
    <polyline points="9.5 5.5 12 3 14.5 5.5" />
    <line x1="12" y1="13" x2="21" y2="13" />
    <polyline points="18.5 10.5 21 13 18.5 15.5" />
    <line x1="12" y1="13" x2="4.5" y2="19.5" />
    <polyline points="4.5 16 4.5 19.5 8 19.5" />
    <circle cx="12" cy="13" r="1.6" fill="currentColor" />
  </svg>
)

/** Gizmo Vòng Xoay 3D (Các quỹ đạo cầu xoay Gimbal 3 trục) */
export const IconGizmoRotate3D = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <ellipse cx="12" cy="12" rx="9" ry="3.8" />
    <ellipse cx="12" cy="12" rx="3.8" ry="9" />
    <polyline points="15 7.2 17.2 8.8 14.8 10.2" />
  </svg>
)

/** Đường nối vuông góc bo tròn (Smoothstep Connector) */
export const IconLineSmoothstep = (p: P) => (
  <svg {...base(p)}>
    <circle cx="4.5" cy="18" r="2.2" fill="currentColor" />
    <circle cx="19.5" cy="6" r="2.2" fill="currentColor" />
    <path d="M6.7 18H10a2 2 0 0 0 2-2V8a2 2 0 0 1 2-2h3.3" />
  </svg>
)

/** Đường nối vòng cung mượt (Bezier Arc Connector) */
export const IconLineBezier = (p: P) => (
  <svg {...base(p)}>
    <circle cx="4.5" cy="18" r="2.2" fill="currentColor" />
    <circle cx="19.5" cy="6" r="2.2" fill="currentColor" />
    <path d="M4.5 16C4.5 6 19.5 18 19.5 8" />
    <line x1="6.5" y1="17" x2="12" y2="17" strokeDasharray="1.5 2" opacity="0.6" />
    <line x1="12" y1="7" x2="17.5" y2="7" strokeDasharray="1.5 2" opacity="0.6" />
  </svg>
)

/** Lưới bố cục 1/3 (Rule of Thirds 3x3 Viewfinder Grid) */
export const IconRuleOfThirds = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="4" width="19" height="16" rx="2" />
    <line x1="9" y1="4" x2="9" y2="20" />
    <line x1="15" y1="4" x2="15" y2="20" />
    <line x1="2.5" y1="9.3" x2="21.5" y2="9.3" />
    <line x1="2.5" y1="14.7" x2="21.5" y2="14.7" />
  </svg>
)

/** Đặt lại vị trí khung thoại về mặc định (Bubble Reset) */
export const IconResetBubbles = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6l-4 3.5V16H6a2 2 0 0 1-2-2V6Z" />
    <path d="M9.5 10a2.5 2.5 0 1 1 2.5 2.5H9" />
    <polyline points="10.8 8 9 10 11 11.5" />
  </svg>
)

/** Căn vừa toàn bộ sân khấu 2D (Fit Stage to View) */
export const IconFitStage2D = (p: P) => (
  <svg {...base(p)}>
    <rect x="6.5" y="7.5" width="11" height="9" rx="1.2" strokeDasharray="2.5 2" />
    <polyline points="3 9 3 4 8 4" />
    <polyline points="16 4 21 4 21 9" />
    <polyline points="21 15 21 20 16 20" />
    <polyline points="8 20 3 20 3 15" />
  </svg>
)

/** Bảng Chi tiết Lộ trình Camera (Camera Waypoint Route Inspector) */
export const IconRouteInspector = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="7.5" cy="8" r="1.4" fill="currentColor" />
    <circle cx="7.5" cy="12" r="1.4" fill="currentColor" />
    <circle cx="7.5" cy="16" r="1.4" fill="currentColor" />
    <line x1="7.5" y1="9.4" x2="7.5" y2="14.6" />
    <line x1="11" y1="8" x2="17.5" y2="8" />
    <line x1="11" y1="12" x2="17.5" y2="12" />
    <line x1="11" y1="16" x2="15.5" y2="16" />
  </svg>
)

/** Góc xoay ngang Camera 3D: Chính diện 0° */
export const IconOrbitCenter0 = (p: P) => (
  <svg {...base(p)}>
    <rect x="6" y="4" width="12" height="8" rx="1.5" />
    <line x1="12" y1="12" x2="12" y2="20" />
    <polyline points="9.5 15 12 12.5 14.5 15" />
  </svg>
)

/** Góc xoay ngang Camera 3D: Nghiêng trái -25° */
export const IconOrbitLeft25 = (p: P) => (
  <svg {...base(p)}>
    <path d="M19 16A8 8 0 0 1 5 11" />
    <polyline points="5 15 5 10.5 9.5 11.5" />
    <rect x="9" y="4" width="10" height="6.5" rx="1.2" />
  </svg>
)

/** Góc xoay ngang Camera 3D: Nghiêng phải +25° */
export const IconOrbitRight25 = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 16a8 8 0 0 0 14-5" />
    <polyline points="19 15 19 10.5 14.5 11.5" />
    <rect x="5" y="4" width="10" height="6.5" rx="1.2" />
  </svg>
)

/** Công cụ Lia (Pan) & Co dãn Khung Camera 2D (Khung ngắm 16:9 + 4 mũi tên hướng) */
export const IconCamPanZoom2D = (p: P) => (
  <svg {...base(p)}>
    <rect x="5.5" y="6.5" width="13" height="11" rx="1.5" />
    <polyline points="9.5 3.5 12 1.5 14.5 3.5" />
    <polyline points="9.5 20.5 12 22.5 14.5 20.5" />
    <polyline points="3 9.5 1 12 3 14.5" />
    <polyline points="21 9.5 23 12 21 14.5" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
  </svg>
)

/** Công cụ Xoay Góc Nghiêng Camera 3D (Yaw/Pitch Orbit trên Sân khấu 2D) */
export const IconCamOrbitTilt = (p: P) => (
  <svg {...base(p)}>
    <rect x="6.5" y="7.5" width="11" height="8" rx="1.5" />
    <path d="M3 12c0-5 4-8.5 9-8.5s9 3.5 9 8.5" strokeDasharray="2.5 2" />
    <path d="M4.5 17.5c2 2 5 3 7.5 3s5.5-1 7.5-3" />
    <polyline points="17.5 15 19.8 17.5 17 19.5" />
  </svg>
)

/** Màn Khung 2D Chỉnh Node (Sân khấu 2D trực quan kéo BBox, Hành động & Quỹ đạo Node) */
export const IconNodeStage2D = (p: P) => (
  <svg {...base(p)}>
    <rect x="2" y="3.5" width="20" height="17" rx="2" />
    <circle cx="6.8" cy="15.2" r="1.8" fill="currentColor" stroke="none" />
    <path d="M8.2 14c1.6-2.8 3.6-3.4 5.8-3.6" />
    <rect x="13.5" y="6.8" width="6" height="5.2" rx="0.9" strokeDasharray="2 1.5" />
    <rect x="18.2" y="5.8" width="2.2" height="2.2" rx="0.5" fill="currentColor" stroke="none" />
  </svg>
)

/** Căn tâm đối tượng vào chính giữa khung cảnh 16:9 */
export const IconAlignStageCenter = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="4" width="19" height="16" rx="2" />
    <rect x="8.5" y="8.5" width="7" height="7" rx="1" />
    <line x1="12" y1="2" x2="12" y2="5.5" />
    <line x1="12" y1="18.5" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5.5" y2="12" />
    <line x1="18.5" y1="12" x2="22" y2="12" />
  </svg>
)

/** Đặt chân đối tượng chạm đường mặt đất cảnh 2D */
export const IconAlignStageGround = (p: P) => (
  <svg {...base(p)}>
    <rect x="7" y="4" width="10" height="9" rx="1.5" />
    <line x1="12" y1="13" x2="12" y2="18.2" />
    <polyline points="9.2 15.8 12 18.5 14.8 15.8" />
    <line x1="3" y1="20.5" x2="21" y2="20.5" />
  </svg>
)

/** Căn đối tượng sang vùng trái khung cảnh */
export const IconAlignStageLeft = (p: P) => (
  <svg {...base(p)}>
    <line x1="4" y1="4" x2="4" y2="20" />
    <rect x="7.5" y="6.5" width="9" height="5" rx="1" />
    <rect x="7.5" y="13.5" width="12" height="4" rx="1" opacity="0.7" />
  </svg>
)

/** Căn đối tượng sang vùng phải khung cảnh */
export const IconAlignStageRight = (p: P) => (
  <svg {...base(p)}>
    <line x1="20" y1="4" x2="20" y2="20" />
    <rect x="7.5" y="6.5" width="9" height="5" rx="1" />
    <rect x="4.5" y="13.5" width="12" height="4" rx="1" opacity="0.7" />
  </svg>
)

/** Đưa đối tượng lại gần Camera hơn (giảm Z — Tiền cảnh) */
export const IconDepthBringFront = (p: P) => (
  <svg {...base(p)}>
    <rect x="8.5" y="3.5" width="11" height="9" rx="1.5" strokeDasharray="2.5 2" opacity="0.65" />
    <rect x="4" y="10" width="12" height="10" rx="1.5" />
    <polyline points="7.5 15.5 10 13 12.5 15.5" />
    <line x1="10" y1="13.2" x2="10" y2="18" />
  </svg>
)

/** Đẩy đối tượng lùi sâu ra xa Camera (tăng Z — Hậu cảnh) */
export const IconDepthPushBack = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="10.5" width="11" height="9" rx="1.5" strokeDasharray="2.5 2" opacity="0.65" />
    <rect x="8" y="4" width="12" height="10" rx="1.5" />
    <polyline points="11.5 8.5 14 11 16.5 8.5" />
    <line x1="14" y1="6" x2="14" y2="10.8" />
  </svg>
)

/** Thêm mốc Đẩy cận Camera (Push-In / Zoom In Viewfinder) */
export const IconCamPushIn = (p: P) => (
  <svg {...base(p)}>
    <rect x="7.5" y="8" width="9" height="8" rx="1.2" />
    <polyline points="3 4 7 8" />
    <polyline points="4.5 8 7 8 7 5.5" />
    <polyline points="21 4 17 8" />
    <polyline points="19.5 8 17 8 17 5.5" />
    <polyline points="3 20 7 16" />
    <polyline points="21 20 17 16" />
  </svg>
)

/** Thêm mốc Kéo rộng Camera (Pull-Out / Wide Viewfinder) */
export const IconCamPullOut = (p: P) => (
  <svg {...base(p)}>
    <rect x="7.5" y="8" width="9" height="8" rx="1.2" strokeDasharray="2 1.8" />
    <polyline points="7 8 3 4" />
    <polyline points="3 6.8 3 4 5.8 4" />
    <polyline points="17 8 21 4" />
    <polyline points="18.2 4 21 4 21 6.8" />
    <polyline points="7 16 3 20" />
    <polyline points="17 16 21 20" />
  </svg>
)

/** Mở Menu Ngữ Cảnh Công Cụ (3 chấm ngang trong khung vuông bo góc) */
export const IconContextDots = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="8" cy="12" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="16" cy="12" r="1.25" fill="currentColor" stroke="none" />
  </svg>
)

