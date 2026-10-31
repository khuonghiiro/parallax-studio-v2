import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = (p: P): P => ({
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.85,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...p
})

/** Tab Lớp 2.5D: các mặt phẳng xếp chồng theo chiều sâu */
export const IconTabLayersStack = (p: P) => (
  <svg {...base(p)}>
    <polygon points="12 2.5 21.5 7.5 12 12.5 2.5 7.5" />
    <polyline points="2.5 12.5 12 17.5 21.5 12.5" />
    <polyline points="2.5 17 12 21.5 21.5 17" />
  </svg>
)

/** Tab Tạo xương (Moho Octahedral Bone) */
export const IconTabBoneRig = (p: P) => (
  <svg {...base(p)}>
    <circle cx="6.2" cy="17.8" r="2.6" />
    <polygon points="8 16 11.2 9.5 19.2 4.8 14.5 12.8" />
    <circle cx="19.2" cy="4.8" r="2" />
  </svg>
)

/** Tab Animate (Mốc thoi Keyframe + cung chuyển động) */
export const IconTabAnimateFilm = (p: P) => (
  <svg {...base(p)}>
    <polygon points="12 3.2 17.8 9 12 14.8 6.2 9" />
    <path d="M4 18.5c4.2 2.6 11.8 2.6 16 0" />
    <polyline points="17.5 16.5 20.3 18.5 18 21" />
  </svg>
)

/** Tab Gió / Motion thực vật (Sống lá uốn cong + làn gió) */
export const IconTabWindMotion = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 20c0-7.5 4.5-13 12.5-15.5C18 12.5 13.5 18 6 20Z" />
    <path d="M6 20c2.5-4.5 6.2-8.2 11-11" />
    <path d="M3 10.5c2.2-1.2 4.6-1.2 6.8 0" />
  </svg>
)

/** Moho Tool S: Chọn & Chỉnh khớp xương */
export const IconBoneSelect = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 3.5l12.5 6.8-5.3 1.6-2.4 5.6L5 3.5Z" />
    <circle cx="17.5" cy="17.5" r="3" />
  </svg>
)

/** Moho Tool A: Vẽ thêm chuỗi xương / Pin Bone trên sân khấu */
export const IconBoneAdd = (p: P) => (
  <svg {...base(p)}>
    <circle cx="5.8" cy="18.2" r="2.4" />
    <polygon points="7.5 16.5 10.2 10.6 16.8 6.8 13.2 13.4" />
    <line x1="18.5" y1="14" x2="18.5" y2="20" />
    <line x1="15.5" y1="17" x2="21.5" y2="17" />
  </svg>
)

/** Moho Tool T: Vùng ảnh hưởng xương (Bone Strength Capsule Envelope) */
export const IconBoneStrength = (p: P) => (
  <svg {...base(p)}>
    <rect
      x="3.2"
      y="7.2"
      width="17.6"
      height="9.6"
      rx="4.8"
      transform="rotate(-35 12 12)"
      strokeDasharray="2.6 2.2"
    />
    <circle cx="8.2" cy="14.7" r="1.9" />
    <line x1="9.8" y1="13.5" x2="15.8" y2="9.3" />
    <circle cx="16.2" cy="9" r="1.5" />
  </svg>
)

/** Moho Tool Z: Thử bẻ khớp trực tiếp (Manipulate Bones IK/FK Test) */
export const IconBoneManipulate = (p: P) => (
  <svg {...base(p)}>
    <circle cx="6" cy="18" r="2.2" />
    <line x1="7.6" y1="16.4" x2="12.5" y2="11.5" />
    <circle cx="12.5" cy="11.5" r="1.8" />
    <line x1="12.5" y1="11.5" x2="18.5" y2="12.5" />
    <path d="M14.5 5.2a6.5 6.5 0 0 1 5.3 4.8" />
    <polyline points="17.6 9.8 19.9 10.3 20.6 8" />
  </svg>
)

/** Moho Symmetry: Đối xứng xương Trái ⇄ Phải */
export const IconBoneMirror = (p: P) => (
  <svg {...base(p)}>
    <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="2.5 2.5" />
    <polyline points="8.5 7 4.2 12 8.5 17" />
    <circle cx="4.2" cy="12" r="1.6" />
    <polyline points="15.5 7 19.8 12 15.5 17" />
    <circle cx="19.8" cy="12" r="1.6" />
  </svg>
)

/** Rig Sub-Tab 1: Cây phân cấp xương */
export const IconBoneHierarchy = (p: P) => (
  <svg {...base(p)}>
    <circle cx="6" cy="5.5" r="2.2" />
    <circle cx="17.5" cy="11.5" r="2.2" />
    <circle cx="17.5" cy="18.5" r="2.2" />
    <path d="M6 7.8v7.7a3 3 0 0 0 3 3h6.2" />
    <path d="M6 11.5h9.2" />
  </svg>
)

/** Rig Sub-Tab 2: Flexi-Bind Mesh Mềm & Gắn Lớp */
export const IconFlexiMeshBind = (p: P) => (
  <svg {...base(p)}>
    <polygon points="4 5 19.5 5 17 19 6.5 19" />
    <line x1="4" y1="5" x2="17" y2="19" />
    <line x1="19.5" y1="5" x2="6.5" y2="19" />
    <circle cx="12" cy="12" r="2.2" fill="currentColor" />
  </svg>
)

/** Rig Sub-Tab 3: Auto-Rig & Mẫu khung xương */
export const IconAutoRigSpark = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="5" r="2.2" />
    <line x1="12" y1="7.5" x2="12" y2="14.5" />
    <line x1="6" y1="10" x2="18" y2="10" />
    <line x1="12" y1="14.5" x2="8" y2="20.5" />
    <line x1="12" y1="14.5" x2="16" y2="20.5" />
    <path d="M18.8 3.2l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7.7-1.6Z" />
  </svg>
)

/** Animate Sub-Tab 1: Tạo dáng & Keyframe */
export const IconPoseKey = (p: P) => (
  <svg {...base(p)}>
    <polygon points="12 3.5 20.5 12 12 20.5 3.5 12" />
    <circle cx="12" cy="12" r="2.4" fill="currentColor" />
  </svg>
)

/** Animate Sub-Tab 2: Clips động tác & Biểu cảm */
export const IconClipsAction = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <line x1="3" y1="9.5" x2="21" y2="9.5" />
    <line x1="8" y1="5" x2="10.5" y2="9.5" />
    <line x1="14" y1="5" x2="16.5" y2="9.5" />
    <polygon points="10.2 12.2 15.2 14.8 10.2 17.4" fill="currentColor" />
  </svg>
)

/** Animate Sub-Tab 3: Vật lý thứ cấp, IK & 2.5D */
export const IconPhysicsSpring = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 12c1.6-4.5 3.4-4.5 5 0s3.4 4.5 5 0 3.4-4.5 5 0" />
    <circle cx="19.5" cy="12" r="2" fill="currentColor" />
  </svg>
)

/** Auto-Key Record Indicator */
export const IconAutoKeyRec = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.2" fill="currentColor" />
  </svg>
)

/** Onion Skin Ghost Frames */
export const IconOnionSkin = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8.5" cy="12" r="5" strokeDasharray="2.2 2" />
    <circle cx="15.5" cy="12" r="5" strokeDasharray="2.2 2" />
    <circle cx="12" cy="12" r="5" />
  </svg>
)

/** Moho Weld / Snap Connected Joints: hàn khít tâm khớp cha - con */
export const IconBoneWeld = (p: P) => (
  <svg {...base(p)}>
    <line x1="4" y1="19.5" x2="9.8" y2="14.2" />
    <line x1="14.2" y1="9.8" x2="20" y2="4.5" />
    <circle cx="12" cy="12" r="3.4" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    <circle cx="4" cy="19.5" r="1.5" />
    <circle cx="20" cy="4.5" r="1.5" />
  </svg>
)

/** Retime / Scale Keyframes Proportionally */
export const IconRetimeStretch = (p: P) => (
  <svg {...base(p)}>
    <polyline points="6.5 8.5 3 12 6.5 15.5" />
    <polyline points="17.5 8.5 21 12 17.5 15.5" />
    <line x1="3.5" y1="12" x2="20.5" y2="12" />
    <polygon points="12 8.8 14.8 12 12 15.2 9.2 12" fill="currentColor" />
  </svg>
)

/** Wind Sub-Tab 1: Danh sách sống cây & lực gió */
export const IconPlantSpineBranch = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 21V6" />
    <path d="M12 15c-3.5 0-6-2.2-6.5-5.5 3.3-.5 6 1.5 6.5 5.5Z" />
    <path d="M12 11c3.5 0 6-2.2 6.5-5.5-3.3-.5-6 1.5-6.5 5.5Z" />
    <circle cx="12" cy="21" r="1.6" fill="currentColor" />
  </svg>
)

/** Wind Sub-Tab 2: Tạo mới trục sống cây */
export const IconPlantAddSpine = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 20c0-6 2.5-11 8-14" />
    <circle cx="9" cy="20" r="1.8" />
    <circle cx="17" cy="6" r="1.8" />
    <line x1="17.5" y1="14" x2="17.5" y2="20" />
    <line x1="14.5" y1="17" x2="20.5" y2="17" />
  </svg>
)

/** Wind Sub-Tab 3: Hòa âm chuyển động Layer 2.5D */
export const IconMotionHarmonyWave = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.5 9.5c2.4-3 4.8-3 7.2 0s4.8 3 7.2 0 3.2-2 4.6-.5" />
    <path d="M2.5 15.5c2.4-3 4.8-3 7.2 0s4.8 3 7.2 0 3.2-2 4.6-.5" />
  </svg>
)
