export type CameraLineStyle = 'smoothstep' | 'bezier'

export interface Point2D {
  x: number
  y: number
}

/**
 * Generates an orthogonal path with smooth rounded corners inspired by ReactFlow's SmoothStep edge.
 * Automatically adapts whether the path flows primarily horizontally (shot-to-shot trajectory)
 * or vertically (callout bubble tether to camera frame).
 */
export function buildReactFlowSmoothStepPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  mode: 'horizontal' | 'vertical' | 'auto' = 'auto',
  borderRadius = 14
): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  if (absDx < 2 && absDy < 2) {
    return `M ${x1} ${y1} L ${x2} ${y2}`
  }

  // If horizontal mode with almost identical Y, create a ReactFlow-style orthogonal rounded bridge
  // so horizontal shot-to-shot transitions clearly show the rounded orthogonal step geometry
  const effectiveMode =
    mode === 'auto' ? (absDy > absDx * 1.15 ? 'vertical' : 'horizontal') : mode

  if (effectiveMode === 'horizontal' && absDy < 18 && absDx > 28) {
    const bridgeY = Math.min(y1, y2) - Math.min(32, Math.max(16, absDx * 0.07))
    const r = Math.min(borderRadius, absDx / 4, Math.abs(y1 - bridgeY) / 2)
    const sx = dx >= 0 ? 1 : -1
    if (r < 2) {
      return `M ${x1} ${y1} L ${x2} ${y2}`
    }
    return [
      `M ${x1} ${y1}`,
      `L ${x1} ${bridgeY + r}`,
      `Q ${x1} ${bridgeY} ${x1 + sx * r} ${bridgeY}`,
      `L ${x2 - sx * r} ${bridgeY}`,
      `Q ${x2} ${bridgeY} ${x2} ${bridgeY + r}`,
      `L ${x2} ${y2}`
    ].join(' ')
  }

  if (absDx < 3 || absDy < 3) {
    return `M ${x1} ${y1} L ${x2} ${y2}`
  }

  if (effectiveMode === 'vertical') {
    // Vertical-first dogleg: (x1, y1) -> (x1, midY) -> (x2, midY) -> (x2, y2)
    const midY = y1 + dy * 0.5
    const r = Math.min(borderRadius, absDx / 2, Math.abs(midY - y1), Math.abs(y2 - midY))
    const sy = dy >= 0 ? 1 : -1
    const sx = dx >= 0 ? 1 : -1

    if (r < 2) {
      return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`
    }

    return [
      `M ${x1} ${y1}`,
      `L ${x1} ${midY - sy * r}`,
      `Q ${x1} ${midY} ${x1 + sx * r} ${midY}`,
      `L ${x2 - sx * r} ${midY}`,
      `Q ${x2} ${midY} ${x2} ${midY + sy * r}`,
      `L ${x2} ${y2}`
    ].join(' ')
  }

  // Horizontal-first dogleg: (x1, y1) -> (midX, y1) -> (midX, y2) -> (x2, y2)
  const midX = x1 + dx * 0.5
  const r = Math.min(borderRadius, absDy / 2, Math.abs(midX - x1), Math.abs(x2 - midX))
  const sx = dx >= 0 ? 1 : -1
  const sy = dy >= 0 ? 1 : -1

  if (r < 2) {
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`
  }

  return [
    `M ${x1} ${y1}`,
    `L ${midX - sx * r} ${y1}`,
    `Q ${midX} ${y1} ${midX} ${y1 + sy * r}`,
    `L ${midX} ${y2 - sy * r}`,
    `Q ${midX} ${y2} ${midX + sx * r} ${y2}`,
    `L ${x2} ${y2}`
  ].join(' ')
}

/**
 * Generates a smooth curved Bezier / Arc path inspired by ReactFlow's Bezier edge.
 * For horizontal camera trajectories with small Y delta, adds a graceful upward/downward arc
 * so consecutive waypoints on the same horizontal line remain clearly visible and distinct.
 */
export function buildReactFlowBezierPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  mode: 'horizontal' | 'vertical' | 'auto' = 'auto',
  curvature = 0.38
): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const dist = Math.hypot(dx, dy)

  if (dist < 4) {
    return `M ${x1} ${y1} L ${x2} ${y2}`
  }

  const effectiveMode =
    mode === 'auto' ? (Math.abs(dy) > Math.abs(dx) * 1.15 ? 'vertical' : 'horizontal') : mode

  if (effectiveMode === 'vertical') {
    const offset = Math.max(24, Math.abs(dy) * curvature)
    const sy = dy >= 0 ? 1 : -1
    const cx1 = x1
    const cy1 = y1 + sy * offset
    const cx2 = x2
    const cy2 = y2 - sy * offset
    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`
  }

  // Horizontal trajectory or arc: if points are nearly on the same horizontal line,
  // lift the control points into a clean arch so the curve doesn't collapse into a flat line
  const absDy = Math.abs(dy)
  const absDx = Math.abs(dx)
  if (absDy < 28 && absDx > 24) {
    const archLift = Math.min(44, Math.max(18, absDx * 0.18))
    const cx1 = x1 + dx * 0.28
    const cy1 = y1 - archLift
    const cx2 = x1 + dx * 0.72
    const cy2 = y2 - archLift
    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`
  }

  const offset = Math.max(28, absDx * curvature)
  const sx = dx >= 0 ? 1 : -1
  const cx1 = x1 + sx * offset
  const cy1 = y1
  const cx2 = x2 - sx * offset
  const cy2 = y2
  return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`
}

/**
 * Computes the attachment point on the outer edge of a callout bubble so that
 * when the user drags the bubble around (above, below, left, or right of the camera frame),
 * the tether line always exits cleanly from the side facing the camera anchor.
 */
export function computeBubbleAnchorAttachment(
  bubbleX: number,
  bubbleY: number,
  anchorX: number,
  anchorY: number,
  radius = 18
): { startX: number; startY: number; flowMode: 'horizontal' | 'vertical' } {
  const dx = anchorX - bubbleX
  const dy = anchorY - bubbleY

  if (Math.abs(dy) >= Math.abs(dx) * 0.75) {
    // Primarily above or below
    return {
      startX: bubbleX,
      startY: dy < 0 ? bubbleY - radius : bubbleY + radius + 12,
      flowMode: 'vertical'
    }
  }

  // Primarily left or right
  return {
    startX: dx < 0 ? bubbleX - radius : bubbleX + radius,
    startY: bubbleY - 4,
    flowMode: 'horizontal'
  }
}
