import type { ReactElement } from 'react'

export type MotionToolIcon = 'select' | 'straight' | 'draw' | 'clear' | 'play' | 'stop' | 'target'
const paths: Record<MotionToolIcon, ReactElement> = {
  select: <><path d="m5 3 13 9-6 1-3 6Z"/><path d="m12 13 4 7"/></>,
  straight: <><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="m7 16 10-8"/></>,
  draw: <><path d="M3 17C3 3 15 22 18 7M15 5l4-2 2 4M3 21h6"/><circle cx="3" cy="17" r="1"/></>,
  clear: <><path d="m4 15 9-11 7 6-9 11H9Zm4-5 7 6M12 21h9"/></>,
  play: <path d="m8 4 12 8-12 8Z"/>,
  stop: <rect x="5" y="5" width="14" height="14" rx="1"/>,
  target: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8M12 8v8"/></>
}
export function WorkflowMotionIcon({ name }: { name: MotionToolIcon }): ReactElement {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
