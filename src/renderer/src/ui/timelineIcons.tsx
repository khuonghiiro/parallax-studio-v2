import type { SVGProps } from 'react'

export type TimelineIconProps = SVGProps<SVGSVGElement> & { size?: number | string }
type P = TimelineIconProps

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

/* ================================================================
   Property Identity Icons (Vị trí, Xoay, Tỉ lệ, Độ mờ)
   ================================================================ */

/** Vị trí (Position X/Y/Z) - Mũi tên dịch chuyển 4 hướng từ tâm */
export const IconPropPosition = (p: P) => (
  <svg {...base({ strokeWidth: 2, ...p })}>
    <path d="M12 3v18M3 12h18" />
    <path d="m9 6 3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
  </svg>
)

/** Xoay (Rotation °) - Vòng cung xoay quanh tâm 3D */
export const IconPropRotation = (p: P) => (
  <svg {...base({ strokeWidth: 2, ...p })}>
    <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4" />
    <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
  </svg>
)

/** Tỉ lệ (Scale %) - Khung phóng to thu nhỏ 2 chiều chéo */
export const IconPropScale = (p: P) => (
  <svg {...base({ strokeWidth: 2, ...p })}>
    <rect x="3" y="3" width="18" height="18" rx="2.5" strokeOpacity="0.45" />
    <path d="M14 5h5v5M19 5l-6 6" />
    <path d="M10 19H5v-5M5 19l6-6" />
  </svg>
)

/** Độ mờ (Opacity %) - Hình tròn nửa đặc nửa caro trong suốt */
export const IconPropOpacity = (p: P) => (
  <svg {...base({ strokeWidth: 2, ...p })}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none" />
    <circle cx="15.2" cy="9" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15.2" cy="15" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="17.8" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)

/* ================================================================
   Timeline Keyframe & Interpolation Curve Icons
   ================================================================ */

/** Mốc Keyframe (Diamond) - Rõ ràng trạng thái đã đặt mốc hay chưa */
export const IconKeyframeDiamond = ({ active, ...p }: P & { active?: boolean }) => (
  <svg {...base({ strokeWidth: 2, ...p })}>
    <path
      d="M12 3 21 12 12 21 3 12Z"
      fill={active ? 'currentColor' : 'none'}
      fillOpacity={active ? 0.28 : 0}
    />
    {active ? (
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
    ) : (
      <path d="M12 9v6M9 12h6" strokeWidth="1.8" />
    )}
  </svg>
)

/** Đi mượt (Ease In-Out) - Đường cong uốn lượn mượt mà (Sine / Bezier Curve) */
export const IconMotionSmooth = (p: P) => (
  <svg {...base({ strokeWidth: 2.2, ...p })}>
    <path d="M2 16C6.5 4 17.5 20 22 8" />
    <circle cx="2.5" cy="15.5" r="1.8" fill="currentColor" stroke="none" />
    <circle cx="21.5" cy="8.5" r="1.8" fill="currentColor" stroke="none" />
  </svg>
)

/** Đi đều (Linear) - Đường thẳng chéo tốc độ đều có mũi tên hướng tiến */
export const IconMotionLinear = (p: P) => (
  <svg {...base({ strokeWidth: 2.1, ...p })}>
    <path d="M4 20 20 4" />
    <polyline points="13 4 20 4 20 11" />
    <circle cx="4" cy="20" r="1.8" fill="currentColor" stroke="none" />
  </svg>
)

/** Giữ rồi nhảy (Hold Step) - Đồ thị bậc thang giữ nguyên giá trị rồi nhảy bậc */
export const IconMotionHold = (p: P) => (
  <svg {...base({ strokeWidth: 2.1, ...p })}>
    <path d="M4 17h9V7h7" />
    <circle cx="4" cy="17" r="2.2" fill="currentColor" stroke="none" />
    <circle cx="20" cy="7" r="2.2" fill="currentColor" stroke="none" />
  </svg>
)

/** Nhịp đập (Pulse) - Sóng nhịp tim dao động lên xuống liên hồi */
export const IconMotionPulse = (p: P) => (
  <svg {...base({ strokeWidth: 2.1, ...p })}>
    <path d="M2 12h3.5l3-7 4.5 14 3.5-10 2 3H22" />
  </svg>
)

/** Nhấp nháy (Blink Strobe) - Xung vuông bật/tắt kèm tia chớp */
export const IconMotionBlink = (p: P) => (
  <svg {...base({ strokeWidth: 2.1, ...p })}>
    <path d="M2 18h4V6h5v12h4V6h5v12h2" />
  </svg>
)

/** Nút mở bảng cấu hình đồ thị chuyển động chi tiết */
export const IconMotionTuning = (p: P) => (
  <svg {...base({ strokeWidth: 2, ...p })}>
    <path d="M4 16c4 0 6-8 10-8h6" />
    <circle cx="9" cy="12" r="2.3" fill="currentColor" />
    <path d="M4 7h4M14 17h6" strokeOpacity="0.65" />
    <circle cx="17" cy="17" r="1.8" fill="currentColor" stroke="none" />
  </svg>
)

/* ================================================================
   Timeline Transport & Preset FX Icons
   ================================================================ */

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
