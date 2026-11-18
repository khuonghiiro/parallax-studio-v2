import type { ReactElement } from 'react'

export type MotionToolIcon =
  | 'select'
  | 'straight'
  | 'draw'
  | 'free_draw'
  | 'clear'
  | 'play'
  | 'stop'
  | 'target'
  | 'gimbal'

const paths: Record<MotionToolIcon, ReactElement> = {
  select: (
    <>
      <path d="m5 3 13 9-6 1-3 6Z" />
      <path d="m12 13 4 7" />
    </>
  ),
  straight: (
    <>
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="6" r="2" />
      <path d="m7 16 10-8" />
    </>
  ),
  /* Đường cong Bezier chuẩn Studio nối 2 chốt neo #1 → #2 kèm thanh tiếp tuyến đỉnh */
  draw: (
    <>
      <path d="M4.8 17.5C5.2 6.8 18.8 6.8 19.2 17.5" />
      <line x1="7" y1="6.8" x2="17" y2="6.8" strokeDasharray="1.8 1.8" opacity="0.7" />
      <circle cx="12" cy="6.8" r="1.7" fill="currentColor" stroke="none" />
      <rect x="2.8" y="16.2" width="3.8" height="3.8" rx="0.8" fill="currentColor" stroke="none" />
      <rect x="17.4" y="16.2" width="3.8" height="3.8" rx="0.8" />
    </>
  ),
  /* Ngòi bút vẽ quỹ đạo tự do */
  free_draw: (
    <>
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z" />
      <path d="M3 20.5c3.2.6 5.8-2.2 9.2-1.6s4.8 2.4 8.8.8" strokeDasharray="2.2 2" />
    </>
  ),
  clear: (
    <>
      <path d="m4 15 9-11 7 6-9 11H9Zm4-5 7 6M12 21h9" />
    </>
  ),
  play: <path d="m8 4 12 8-12 8Z" />,
  stop: <rect x="5" y="5" width="14" height="14" rx="1" />,
  target: (
    <>
      <rect x="4.5" y="4.5" width="15" height="15" rx="1.5" strokeDasharray="3 2.2" />
      <rect x="2.8" y="2.8" width="3.6" height="3.6" rx="0.7" fill="currentColor" stroke="none" />
      <rect x="17.6" y="2.8" width="3.6" height="3.6" rx="0.7" fill="currentColor" stroke="none" />
      <rect x="2.8" y="17.6" width="3.6" height="3.6" rx="0.7" fill="currentColor" stroke="none" />
      <rect x="17.6" y="17.6" width="3.6" height="3.6" rx="0.7" fill="currentColor" stroke="none" />
    </>
  ),
  gimbal: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" />
      <ellipse cx="12" cy="12" rx="3.8" ry="9" />
      <polyline points="15 7.2 17.2 8.8 14.8 10.2" />
    </>
  )
}

export function WorkflowMotionIcon({ name }: { name: MotionToolIcon }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
