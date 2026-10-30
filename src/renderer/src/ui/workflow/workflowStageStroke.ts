export type StagePoint = [number, number]

/** Pixels on the stage -> world offsets, anchored to the layer's current start pose. */
export function stageStrokeToMotionPath(points: StagePoint[], zoom: number, perspective: number): StagePoint[] {
  if (points.length < 2) return []
  const [x0, y0] = points[0]
  const scale = Math.max(0.001, zoom * perspective)
  const path = points.map(([x, y]): StagePoint => [Number(((x - x0) / scale).toFixed(3)), Number(((y0 - y) / scale).toFixed(3))])
  // The legacy path format uses values <= 1.2 as normalized coordinates; discard imperceptible strokes.
  return path.some(([x, y]) => Math.abs(x) > 1.2 || Math.abs(y) > 1.2) ? path : []
}
