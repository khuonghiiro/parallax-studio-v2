const paths: Record<string, string> = {
  motionDrift: 'M3 7h15m-4-4 4 4-4 4M21 17H6m4-4-4 4 4 4',
  motionWind: 'M3 8h12c5 0 5-6 1-6M3 12h17M3 16h10c5 0 5 6 1 6',
  motionSway: 'M12 21V5M4 10a8 8 0 0 1 16 0M4 10V6m0 4h4M20 10V6m0 4h-4',
  motionFloat: 'M4 17c3-4 5 4 8 0s5 4 8 0M12 3v9m-4-5 4-4 4 4',
  motionWiggle: 'M2 12l3-7 4 14 4-14 4 14 3-7h2',
  motionPulse: 'M7 3H3v4m14-4h4v4M3 17v4h4m14-4v4h-4M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0'
}
export function MotionFxIcon({ presetId, size, color }: { presetId: string; size: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: color ?? 'var(--accent-cyan)', flexShrink: 0 }}>
    <path d={paths[presetId]} />
  </svg>
}
