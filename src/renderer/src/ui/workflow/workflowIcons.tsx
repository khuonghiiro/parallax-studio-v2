import type { SVGProps } from 'react'
import type { WorkflowNodeType } from '@shared/types'

export type WfIconProps = SVGProps<SVGSVGElement> & { size?: number | string }

const base = ({ size, width, height, ...props }: WfIconProps): SVGProps<SVGSVGElement> => ({
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

/** Icon Tab 1: Timeline Tracks (Các rãnh thời gian + Playhead + Keyframe thoi) */
export const IconTimelineTracks = (p: WfIconProps) => (
  <svg {...base(p)}>
    <line x1="12" y1="2" x2="12" y2="22" strokeWidth={1.6} />
    <polygon points="9.5 2 14.5 2 12 5" fill="currentColor" />
    <rect x="3" y="7" width="11" height="3.2" rx="1" />
    <rect x="8" y="12.5" width="13" height="3.2" rx="1" />
    <path d="M6 17.5 8 19.5 6 21.5 4 19.5Z" fill="currentColor" />
    <line x1="10" y1="19.5" x2="20" y2="19.5" />
  </svg>
)

/** Icon Tab 2: Workflow Node-Port Graph (Các khối chức năng nối cổng Bezier) */
export const IconWorkflowGraph = (p: WfIconProps) => (
  <svg {...base(p)}>
    <rect x="2" y="4" width="6.5" height="6" rx="1.5" />
    <rect x="15.5" y="3" width="6.5" height="6" rx="1.5" />
    <rect x="15.5" y="15" width="6.5" height="6" rx="1.5" />
    <circle cx="8.5" cy="7" r="1.3" fill="currentColor" />
    <circle cx="15.5" cy="6" r="1.3" fill="currentColor" />
    <circle cx="15.5" cy="18" r="1.3" fill="currentColor" />
    <path d="M8.5 7C12 7 12 6 15.5 6" />
    <path d="M8.5 7C12 7 11.5 18 15.5 18" />
  </svg>
)

/** Icon Tự động nối Port (Auto-Wire) */
export const IconWfAutoWire = (p: WfIconProps) => (
  <svg {...base(p)}>
    <circle cx="5" cy="6" r="2.5" />
    <circle cx="19" cy="6" r="2.5" />
    <circle cx="19" cy="18" r="2.5" />
    <path d="M7.5 6h9" />
    <path d="M7 7.5c3.5 3.5 5.5 9 9.5 10" />
  </svg>
)

/** Icon JSON & AI Blueprint ({ }) */
export const IconWfJsonCode = (p: WfIconProps) => (
  <svg {...base(p)}>
    <path d="M8 4H6a2 2 0 0 0-2 2v3.5a2.5 2.5 0 0 1-2 2.5 2.5 2.5 0 0 1 2 2.5V18a2 2 0 0 0 2 2h2" />
    <path d="M16 4h2a2 2 0 0 1 2 2v3.5a2.5 2.5 0 0 0 2 2.5 2.5 2.5 0 0 0-2 2.5V18a2 2 0 0 1-2 2h-2" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
  </svg>
)

/** Node 1: Phân cảnh & Độ sâu 2.5D */
export const IconWfSceneShot = (p: WfIconProps) => (
  <svg {...base(p)}>
    <rect x="2" y="6" width="12" height="10" rx="1.5" />
    <path d="M7 4h11a1.5 1.5 0 0 1 1.5 1.5V13" />
    <path d="M11 2h9.5A1.5 1.5 0 0 1 22 3.5V10" />
    <path d="M4.5 13l3-3 2.5 2.5 2-1.5" />
  </svg>
)

/** Node 2: Lắp ráp Nhân vật 2.5D & Mô hình 3D */
export const IconWfLayerAssembly = (p: WfIconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="5.5" r="2.5" />
    <path d="M12 8v6" />
    <path d="M7 10.5h10" />
    <path d="M12 14l-3.5 6M12 14l3.5 6" />
    <circle cx="12" cy="11" r="1.2" fill="currentColor" />
  </svg>
)

/** Node 3: Chuyển động & Hoạt họa */
export const IconWfMotion = (p: WfIconProps) => (
  <svg {...base(p)}>
    <path d="M3 16c2.5-6 5.5-6 8 0s5.5 6 8-2" />
    <polyline points="16 11 19.5 13.5 17 17" />
    <circle cx="7" cy="12" r="1.5" fill="currentColor" />
  </svg>
)

/** Node 4: Vật lý, Ánh sáng Ảo & FX */
export const IconWfPhysicsFx = (p: WfIconProps) => (
  <svg {...base(p)}>
    <path d="M12 3l1.6 4.2L18 8.8l-4.4 1.6L12 14.6l-1.6-4.2L6 8.8l4.4-1.6z" />
    <path d="M5 18c3 2.5 11 2.5 14 0" />
    <path d="M7.5 21c2.2 1.5 6.8 1.5 9 0" />
  </svg>
)

/** Node 5: Đạo diễn Camera 3D */
export const IconWfCamera = (p: WfIconProps) => (
  <svg {...base(p)}>
    <rect x="2.5" y="7" width="11" height="9" rx="1.8" />
    <polygon points="13.5 9.5 19.5 6.5 19.5 16.5 13.5 13.5" />
    <path d="M4 19.5c4 2 11 2 16-1.5" strokeDasharray="2 2" />
  </svg>
)

/** Node 6: Âm thanh & Nhép môi Lip-Sync */
export const IconWfAudioLipSync = (p: WfIconProps) => (
  <svg {...base(p)}>
    <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10v4" />
  </svg>
)

/** Node 7: Màu sắc Điện ảnh & Xuất bản */
export const IconWfLookOutput = (p: WfIconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3.5" />
    <line x1="12" y1="3" x2="12" y2="8.5" />
    <line x1="19.8" y1="7.5" x2="15" y2="10.2" />
    <line x1="19.8" y1="16.5" x2="15" y2="13.8" />
  </svg>
)

export function renderWorkflowNodeIcon(type: WorkflowNodeType, props?: WfIconProps) {
  switch (type) {
    case 'scene_shot':
      return <IconWfSceneShot {...props} />
    case 'layer_assembly':
      return <IconWfLayerAssembly {...props} />
    case 'motion_choreography':
      return <IconWfMotion {...props} />
    case 'physics_fx':
      return <IconWfPhysicsFx {...props} />
    case 'camera_director':
      return <IconWfCamera {...props} />
    case 'audio_lipsync':
      return <IconWfAudioLipSync {...props} />
    case 'look_output':
      return <IconWfLookOutput {...props} />
  }
}
