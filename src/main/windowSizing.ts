/** Electron dimensions are device-independent pixels, including OS scaling. */
export function initialWindowSize(workArea: { width: number; height: number }) {
  const width = Math.min(1600, workArea.width)
  const height = Math.min(960, workArea.height)
  return { width, height, minWidth: Math.min(640, width), minHeight: Math.min(480, height) }
}
