/** Keep a usable canvas above the timeline, including short laptop windows. */
export function timelineBounds(viewportHeight: number) {
  const max = Math.max(80, Math.floor(viewportHeight * 0.45))
  return { min: Math.min(160, max), max }
}

export function clampTimelineHeight(height: number, viewportHeight: number): number {
  const { min, max } = timelineBounds(viewportHeight)
  return Math.min(max, Math.max(min, height))
}
