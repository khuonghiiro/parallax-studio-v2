import { findNearestShotByStage2D, type ShotStageBox } from './animateCameraMath'
import type { CameraWaypointItem } from './animateCameraRouteLogic'

export interface BubbleStageOffset {
  dx: number
  dy: number
}

export interface CalloutBubbleNode {
  idx: number
  wp: CameraWaypointItem
  bubbleX: number
  bubbleY: number
  anchorX: number
  anchorY: number
  frameLeft: number
  frameTop: number
  frameW: number
  frameH: number
  isCustomMoved: boolean
  isFirstOfShot: boolean
}

interface ScreenRect {
  left: number
  top: number
  right: number
  bottom: number
}

const BUBBLE_HALF_W = 30
const BUBBLE_HALF_H = 26
const MIN_SPACING_X = 64
const MIN_SPACING_Y = 58
const HEADER_HEIGHT_PX = 36

function rectsOverlap(a: ScreenRect, b: ScreenRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

function bubbleRect(cx: number, cy: number): ScreenRect {
  return {
    left: cx - BUBBLE_HALF_W,
    top: cy - BUBBLE_HALF_H,
    right: cx + BUBBLE_HALF_W,
    bottom: cy + BUBBLE_HALF_H
  }
}

/**
 * Pushes a bubble center `(cx, cy)` out of any overlapping Shot Canvas or Shot Title Header rect.
 */
function pushOutOfObstacles(
  cx: number,
  cy: number,
  obstacles: ScreenRect[],
  preferAbove: boolean
): { x: number; y: number } {
  let x = cx
  let y = cy

  for (let pass = 0; pass < 3; pass++) {
    let moved = false
    for (const obs of obstacles) {
      const br = bubbleRect(x, y)
      if (!rectsOverlap(br, obs)) continue

      const pushUpY = obs.top - BUBBLE_HALF_H - 12
      const pushDownY = obs.bottom + BUBBLE_HALF_H + 12
      const pushLeftX = obs.left - BUBBLE_HALF_W - 14
      const pushRightX = obs.right + BUBBLE_HALF_W + 14

      const dyUp = Math.abs(y - pushUpY)
      const dyDown = Math.abs(pushDownY - y)
      const dxLeft = Math.abs(x - pushLeftX)
      const dxRight = Math.abs(pushRightX - x)

      // Prefer vertical escape above/below the shot & header unless horizontal is much closer
      const bestVertY = preferAbove
        ? dyUp <= dyDown * 1.6
          ? pushUpY
          : pushDownY
        : dyDown <= dyUp * 1.6
          ? pushDownY
          : pushUpY
      const bestVertCost = Math.abs(bestVertY - y)
      const bestHorizX = dxLeft <= dxRight ? pushLeftX : pushRightX
      const bestHorizCost = Math.abs(bestHorizX - x)

      if (bestVertCost <= bestHorizCost * 1.35) {
        y = Math.round(bestVertY)
      } else {
        x = Math.round(bestHorizX)
      }
      moved = true
    }
    if (!moved) break
  }

  return { x, y }
}

/**
 * Computes collision-free screen coordinates for all 2D Camera Stage callout bubbles (`#1`, `#2`, ...),
 * automatically avoiding Shot canvases, Shot title headers (`.anim2d-shot-header`), and neighboring bubbles.
 */
export function computeCalloutBubbleNodes(
  stageLayout: ShotStageBox[],
  waypoints: CameraWaypointItem[],
  zoom: number,
  stageToScreen: (sx: number, sy: number) => { x: number; y: number },
  bubbleOffsets: Record<number, BubbleStageOffset>
): CalloutBubbleNode[] {
  if (waypoints.length === 0) return []

  // Build obstacle rectangles for every Shot (including its top title bar `.anim2d-shot-header`)
  const shotObstacles: ScreenRect[] = stageLayout.map((b) => {
    const tl = stageToScreen(b.stageX - b.width / 2, b.stageY - b.height / 2)
    const br = stageToScreen(b.stageX + b.width / 2, b.stageY + b.height / 2)
    return {
      left: Math.min(tl.x, br.x) - 8,
      top: Math.min(tl.y, br.y) - HEADER_HEIGHT_PX - 12,
      right: Math.max(tl.x, br.x) + 8,
      bottom: Math.max(tl.y, br.y) + 8
    }
  })

  const byShot = new Map<
    string,
    { box: ShotStageBox; items: { idx: number; wp: CameraWaypointItem }[] }
  >()

  waypoints.forEach((wp, idx) => {
    const box =
      stageLayout.find((b) => b.shotId === wp.shotId) ??
      findNearestShotByStage2D(stageLayout, wp.stageX, wp.stageY)
    const key = box?.shotId ?? 'global'
    if (!byShot.has(key)) {
      byShot.set(key, {
        box: box ?? {
          shotId: null,
          name: 'Cảnh',
          color: '#3b82f6',
          index: 0,
          visible: true,
          worldOrigin: [0, 0, 0],
          stageX: 0,
          stageY: 0,
          width: 1920,
          height: 1080
        },
        items: []
      })
    }
    byShot.get(key)!.items.push({ idx, wp })
  })

  const result: (CalloutBubbleNode & { preferAbove: boolean })[] = []

  for (const { box, items } of byShot.values()) {
    const shotTL = stageToScreen(box.stageX - box.width / 2, box.stageY - box.height / 2)
    const shotBR = stageToScreen(box.stageX + box.width / 2, box.stageY + box.height / 2)
    const shotScreenW = Math.max(96, shotBR.x - shotTL.x)
    const shotCenterX = (shotTL.x + shotBR.x) / 2

    // Check if another shot is stacked below `box` in roughly the same column
    const hasShotBelow = stageLayout.some(
      (other) =>
        other.shotId !== box.shotId &&
        other.stageY > box.stageY + box.height * 0.25 &&
        other.stageY - box.stageY < box.height * 2.4 &&
        Math.abs(other.stageX - box.stageX) < box.width * 1.15
    )
    const hasShotAbove = stageLayout.some(
      (other) =>
        other.shotId !== box.shotId &&
        other.stageY < box.stageY - box.height * 0.25 &&
        box.stageY - other.stageY < box.height * 2.4 &&
        Math.abs(other.stageX - box.stageX) < box.width * 1.15
    )

    const dockAbove = hasShotBelow && !hasShotAbove

    let maxBottomY = shotBR.y
    let minTopY = shotTL.y - HEADER_HEIGHT_PX - 12
    for (const { wp } of items) {
      const fBottom = stageToScreen(wp.stageX, wp.stageY + wp.height / 2).y
      const fTop = stageToScreen(wp.stageX, wp.stageY - wp.height / 2).y
      if (fBottom > maxBottomY) maxBottomY = fBottom
      if (fTop < minTopY) minTopY = fTop
    }

    const useTwoRows = items.length >= 3 && items.length * MIN_SPACING_X > shotScreenW + 24

    const prepared = items.map(({ idx, wp }, localIdx) => {
      const anchor = stageToScreen(wp.stageX, wp.stageY)
      const tl = stageToScreen(wp.stageX - wp.width / 2, wp.stageY - wp.height / 2)
      const row = useTwoRows ? localIdx % 2 : 0
      const bubbleY = dockAbove
        ? Math.round(minTopY - 44 - row * MIN_SPACING_Y)
        : Math.round(maxBottomY + 46 + row * MIN_SPACING_Y)

      return {
        idx,
        wp,
        row,
        preferAbove: dockAbove,
        anchorX: anchor.x,
        anchorY: anchor.y,
        desiredX: anchor.x,
        bubbleX: anchor.x,
        bubbleY,
        frameLeft: tl.x,
        frameTop: tl.y,
        frameW: Math.max(8, wp.width * zoom),
        frameH: Math.max(6, wp.height * zoom),
        isCustomMoved: false,
        isFirstOfShot: wp.isFirstOfShot ?? localIdx === 0
      }
    })

    for (const r of [0, 1]) {
      const rowItems = prepared.filter((p) => p.row === r)
      if (rowItems.length === 0) continue

      rowItems.sort((a, b) => {
        if (Math.abs(a.desiredX - b.desiredX) > 25) return a.desiredX - b.desiredX
        return a.idx - b.idx
      })

      const step = useTwoRows ? MIN_SPACING_X + 6 : MIN_SPACING_X
      const totalW = (rowItems.length - 1) * step
      const rowOffset = useTwoRows ? (r === 1 ? step * 0.35 : -step * 0.15) : 0
      const startX = shotCenterX - totalW / 2 + rowOffset

      rowItems.forEach((item, i) => {
        item.bubbleX = Math.round(startX + i * step)
      })
    }

    result.push(...prepared)
  }

  // Apply custom user drag offsets first, then run obstacle & bubble-to-bubble collision resolution
  for (const node of result) {
    const custom = bubbleOffsets[node.idx]
    if (custom && (Math.abs(custom.dx) > 0.5 || Math.abs(custom.dy) > 0.5)) {
      node.bubbleX = Math.round(node.bubbleX + custom.dx * zoom)
      node.bubbleY = Math.round(node.bubbleY + custom.dy * zoom)
      node.isCustomMoved = true
    }

    const pushed = pushOutOfObstacles(node.bubbleX, node.bubbleY, shotObstacles, node.preferAbove)
    node.bubbleX = pushed.x
    node.bubbleY = pushed.y
  }

  // Resolve bubble-to-bubble collisions across all bubbles
  for (let pass = 0; pass < 4; pass++) {
    result.sort((a, b) => a.bubbleY - b.bubbleY || a.bubbleX - b.bubbleX || a.idx - b.idx)
    let anyOverlap = false
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i]
        const b = result[j]
        const dx = b.bubbleX - a.bubbleX
        const dy = b.bubbleY - a.bubbleY
        if (Math.abs(dx) < MIN_SPACING_X && Math.abs(dy) < MIN_SPACING_Y - 4) {
          anyOverlap = true
          const overlapX = MIN_SPACING_X - Math.abs(dx)
          const dir = dx >= 0 ? 1 : -1
          const shift = Math.ceil(overlapX / 2) + 1
          a.bubbleX -= dir * shift
          b.bubbleX += dir * shift
        }
      }
    }
    if (!anyOverlap) break
  }

  // Final check so horizontal separation never pushes a bubble into a shot obstacle
  for (const node of result) {
    const pushed = pushOutOfObstacles(node.bubbleX, node.bubbleY, shotObstacles, node.preferAbove)
    node.bubbleX = pushed.x
    node.bubbleY = pushed.y
  }

  return result.sort((a, b) => a.idx - b.idx)
}
