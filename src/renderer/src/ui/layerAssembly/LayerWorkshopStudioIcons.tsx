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

/** Pose-to-pose & Nhịp: Đồng hồ bấm nhịp Keyframe */
export const IconTimingClock = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="13" r="8" />
    <polyline points="12 8.8 12 13 15.2 14.8" />
    <line x1="9.5" y1="2.5" x2="14.5" y2="2.5" />
  </svg>
)

/** Khép vòng lặp mượt (Close Loop Cycle) */
export const IconLoopCycle = (p: P) => (
  <svg {...base(p)}>
    <polyline points="17 2.8 20.5 6.3 17 9.8" />
    <path d="M3.5 11.5V9.8a3.5 3.5 0 0 1 3.5-3.5h13.5" />
    <polyline points="7 21.2 3.5 17.7 7 14.2" />
    <path d="M20.5 12.5v1.7a3.5 3.5 0 0 1-3.5 3.5H3.5" />
  </svg>
)

/** Đảo ngược chiều động tác (Reverse Keyframes) */
export const IconReverseTime = (p: P) => (
  <svg {...base(p)}>
    <polyline points="7.5 4.5 3.5 8.5 7.5 12.5" />
    <line x1="3.5" y1="8.5" x2="20.5" y2="8.5" />
    <polyline points="16.5 11.5 20.5 15.5 16.5 19.5" />
    <line x1="20.5" y1="15.5" x2="3.5" y2="15.5" />
  </svg>
)

/** Giãn chậm nhịp ×1.25 (Slow / Expand Timing) */
export const IconRetimeSlow = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="14" r="7.5" />
    <line x1="12" y1="14" x2="8.6" y2="10.8" />
    <path d="M6.5 3.8h11" strokeDasharray="2.2 2.2" />
  </svg>
)

/** Nén nhanh nhịp ×0.8 (Fast / Compress Timing — thay thế hoàn toàn icon ô vuông lỗi font) */
export const IconRetimeFast = (p: P) => (
  <svg {...base(p)}>
    <polygon points="3.5 6.5 11.8 12 3.5 17.5" />
    <polygon points="12.2 6.5 20.5 12 12.2 17.5" />
  </svg>
)

/** Chèn thêm khoảng thời gian (+0.25s) */
export const IconTimeInsert = (p: P) => (
  <svg {...base(p)}>
    <line x1="4" y1="5" x2="4" y2="19" />
    <line x1="20" y1="5" x2="20" y2="19" />
    <line x1="12" y1="8.5" x2="12" y2="15.5" />
    <line x1="8.5" y1="12" x2="15.5" y2="12" />
  </svg>
)

/** Rút bớt khoảng thời gian (-0.25s) */
export const IconTimeRemove = (p: P) => (
  <svg {...base(p)}>
    <line x1="4" y1="5" x2="4" y2="19" />
    <line x1="20" y1="5" x2="20" y2="19" />
    <line x1="8.2" y1="12" x2="15.8" y2="12" />
  </svg>
)

/** Thứ tự lớp Z-Index theo Keyframe (Animated Bone Layer Order: nổi trước / lùi sau lưng) */
export const IconLayerDepthOrder = (p: P) => (
  <svg {...base(p)}>
    <polygon points="9.5 4.2 16.5 8 9.5 11.8 2.5 8" />
    <polyline points="2.5 13 9.5 16.8 16.5 13" />
    <polyline points="2.5 17.5 9.5 21 16.5 17.5" />
    <line x1="19.5" y1="4" x2="19.5" y2="20" />
    <polyline points="17 6.8 19.5 4 22 6.8" />
    <polyline points="17 17.2 19.5 20 22 17.2" />
  </svg>
)

/** Sub-tab Dựng xương thủ công: chuỗi đốt xương nối tiếp (Adobe Animate Bone Tool) */
export const IconBoneChainBuild = (p: P) => (
  <svg {...base(p)}>
    <circle cx="4.5" cy="18.5" r="2" />
    <path d="M6 17l4-4" />
    <circle cx="11.5" cy="11.5" r="2" />
    <path d="M13.2 10.2l3.6-2.6" />
    <circle cx="18.5" cy="6.5" r="2" />
    <path d="M18 14v6M15 17h6" />
  </svg>
)

/** Nhân bản nhánh xương sang bên đối diện (trục X = 0 + 2 xương phản chiếu) */
export const IconBoneDuplicateLR = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v18" strokeDasharray="2.5 2.5" />
    <path d="M9 7L4 12l5 5" />
    <path d="M15 7l5 5-5 5" />
  </svg>
)

/** Giới hạn góc khớp (cung min–max quanh khớp xoay) */
export const IconJointLimitArc = (p: P) => (
  <svg {...base(p)}>
    <circle cx="6" cy="18" r="2" />
    <path d="M7.6 16.6L18 8" />
    <path d="M6 9.5a8.5 8.5 0 0 1 8.5 8.5" />
    <path d="M6 9.5v2.6M14.5 18h-2.6" />
  </svg>
)

/* ============================================================================
 * Các Biểu Tượng Tab Dọc Cho Cột Phải Xưởng Layer 2.5D (Vertical Sub-Tab Icons)
 * ============================================================================ */

/** 1. Tab dọc Layer: Xếp chồng các lớp */
export const IconSubTabLayerStack = (p: P) => (
  <svg {...base(p)}>
    <polygon points="12 2 22 7 12 12 2 7" />
    <polyline points="2 12 12 17 22 12" />
    <polyline points="2 17 12 22 22 17" />
  </svg>
)

/** 2. Tab dọc Layer: Biến đổi 2.5D (Toạ độ, Tỷ lệ, Lật, Xoay) */
export const IconSubTabTransform = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M19 9l3 3-3 3M9 19l3 3 3-3" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="12" y1="2" x2="12" y2="22" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
)

/** 3. Tab dọc Layer: Chiều sâu Z & Không gian 2.5D */
export const IconSubTabDepth = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="12" height="12" rx="2" strokeDasharray="2.5 2.5" />
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <line x1="3" y1="15" x2="9" y2="21" />
    <line x1="15" y1="3" x2="21" y2="9" />
  </svg>
)

/** 4. Tab dọc Layer: Bộ phận & Hoán đổi biến thể */
export const IconSubTabParts = (p: P) => (
  <svg {...base(p)}>
    <path d="M19 11h-4a1 1 0 0 1-1-1V6a2 2 0 0 0-4 0v4a1 1 0 0 1-1 1H5a2 2 0 0 0 0 4h4a1 1 0 0 1 1 1v4a2 2 0 0 0 4 0v-4a1 1 0 0 1 1-1h4a2 2 0 0 0 0-4Z" />
  </svg>
)

/** 5. Tab dọc Layer: Khung xương & Nhãn vải mềm đung đưa */
export const IconSubTabCloth = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="4" r="2" />
    <path d="M12 6v4" />
    <path d="M8 10h8l3 10c-3 1.5-6-1-11 1l3-11Z" />
    <path d="M10 14c2 .8 4 .8 6 0" />
  </svg>
)

/** 6. Tab dọc Xương: Cây phân cấp xương cha - con */
export const IconSubTabBoneTree = (p: P) => (
  <svg {...base(p)}>
    <circle cx="6" cy="6" r="2.5" />
    <line x1="8.5" y1="6" x2="15" y2="6" />
    <circle cx="17.5" cy="6" r="2.5" />
    <path d="M6 8.5v8.5a2 2 0 0 0 2 2h7" />
    <circle cx="17.5" cy="19" r="2.5" />
  </svg>
)

/** 7. Tab dọc Xương: Dựng kết cấu xương thủ công */
export const IconSubTabBoneBuild = (p: P) => (
  <svg {...base(p)}>
    <circle cx="5" cy="19" r="2" />
    <path d="M6.5 17.5l7-7" />
    <circle cx="15" cy="9" r="2" />
    <path d="M16.5 7.5L20 4" />
    <circle cx="20" cy="4" r="1.5" />
    <line x1="14" y1="18" x2="20" y2="18" />
    <line x1="17" y1="15" x2="17" y2="21" />
  </svg>
)

/** 8. Tab dọc Xương: Gắn Mesh & Uốn mềm Flexi-Bind */
export const IconSubTabMeshBind = (p: P) => (
  <svg {...base(p)}>
    <polygon points="12 3 20 9 17 19 7 19 4 9" />
    <circle cx="12" cy="12" r="2" />
    <line x1="12" y1="3" x2="12" y2="10" />
    <line x1="20" y1="9" x2="13.7" y2="11" />
    <line x1="17" y1="19" x2="13.2" y2="13.5" />
    <line x1="7" y1="19" x2="10.8" y2="13.5" />
    <line x1="4" y1="9" x2="10.3" y2="11" />
  </svg>
)

/** 9. Tab dọc Xương: Tự động hoá (Thư viện sinh vật, Mixamo, Mẫu chi) */
export const IconSubTabAutoRig = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 2l1.8 4.2L18 8l-4.2 1.8L12 14l-1.8-4.2L6 8l4.2-1.8L12 2Z" />
    <circle cx="16" cy="17" r="1.5" />
    <path d="M16 18.5v3" />
    <path d="M14 20h4" />
    <path d="M6 16l2 5M10 16l-2 5" />
    <circle cx="8" cy="15" r="1.5" />
  </svg>
)

/** 10. Tab dọc Anim: Tạo dáng & Keyframe (Bẻ khớp & Dope Sheet) */
export const IconSubTabAnimPose = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="5" r="2.2" />
    <path d="M12 7.2v6l4 4M12 10l-4-2-2 3M12 10l4-2 2 3M12 13.2l-3 5.8" />
    <polygon points="19 14 22 17 19 20 16 17" fill="currentColor" fillOpacity="0.25" />
  </svg>
)

/** 11. Tab dọc Anim: Hành động & Thư viện Clips */
export const IconSubTabAnimClips = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="8" y1="4" x2="6.5" y2="9" />
    <line x1="13" y1="4" x2="11.5" y2="9" />
    <line x1="18" y1="4" x2="16.5" y2="9" />
    <polygon points="10 12 15 15 10 18" fill="currentColor" fillOpacity="0.3" />
  </svg>
)

/** 12. Tab dọc Anim: Vật lý đàn hồi & Rung lắc */
export const IconSubTabAnimPhysics = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6h4l2 4 4-8 4 8 2-4h4" />
    <circle cx="12" cy="17" r="3" />
    <path d="M6 17c0-2 1-3 2.5-3.5M18 17c0-2-1-3-2.5-3.5" />
  </svg>
)

/** 13. Tab dọc Gió: Danh sách trục sống thực vật */
export const IconSubTabPlantList = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 21c2-6 5-11 11-15" />
    <circle cx="8" cy="18" r="1.5" />
    <circle cx="11" cy="13" r="1.5" />
    <circle cx="15" cy="9" r="1.5" />
    <path d="M11 13c3-1 5 1 6 3M15 9c2-2 4-1 5 1" />
  </svg>
)

/** 14. Tab dọc Gió: Thêm trục sống & Hướng mọc */
export const IconSubTabPlantAdd = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 20c2-5 6-10 10-12" />
    <path d="M12 4v6M9 7h6" />
    <circle cx="16" cy="8" r="2" />
  </svg>
)

/** 15. Tab dọc Gió: Hòa sắc & Nhịp sóng gió */
export const IconSubTabPlantHarmony = (p: P) => (
  <svg {...base(p)}>
    <path d="M2 9c4-3 7-3 10 0s6 3 10 0" />
    <path d="M2 15c4-3 7-3 10 0s6 3 10 0" />
    <circle cx="12" cy="9" r="2" />
    <circle cx="12" cy="15" r="2" />
  </svg>
)

/** 16. Tab dọc Loop: Mẫu hoạt ảnh từ kho */
export const IconSubTabLoopTemplate = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="14" rx="2" />
    <path d="M7 10l3 3 5-5" />
    <path d="M17 19a4 4 0 0 1-5 2l2-2-2-2" />
  </svg>
)

/** 17. Tab dọc Loop: Phát lặp & Tốc độ FPS */
export const IconSubTabLoopPlay = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <polygon points="10 8 16 12 10 16" fill="currentColor" fillOpacity="0.3" />
    <path d="M12 3a9 9 0 0 1 9 9" strokeDasharray="3 3" />
  </svg>
)

/** 18. Tab dọc Loop: Nhịp điệu & Ánh sáng ảo Virtual Light */
export const IconSubTabLoopRhythm = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 13h4l2-4 3 8 2-6 2 2h5" />
    <circle cx="12" cy="5" r="1.5" />
    <path d="M12 2v1M9.5 3.5l.7.7M14.5 3.5l-.7.7" />
  </svg>
)

/** 19. Nét vẽ trục gió / sống cây Motion (Plant Wind Spine Stroke) */
export const IconWindSpineStroke = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 20c2-5 5.5-8.5 7.5-12.5C13.5 5 15.5 3.5 19 3" />
    <circle cx="5" cy="20" r="1.8" fill="currentColor" />
    <circle cx="12.5" cy="7.5" r="1.5" />
    <circle cx="19" cy="3" r="1.5" fill="currentColor" />
    <path d="M8.5 4.5c2.2-1.2 5-1.2 7.5 0" />
    <path d="M3 13.5c2.5-1.5 5.8-1.5 8.5 0" />
    <path d="M11 17c3-1.6 6.5-1.4 9.5.5" />
  </svg>
)
