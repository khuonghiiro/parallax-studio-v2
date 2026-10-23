import type { PrimaryView, ViewState } from '../../store/view'
import type { Rect } from '../../engine/SceneRenderer'
import { fitRect, type Layout } from './viewerLayout'

export const VIEW_ORDER: PrimaryView[] = ['camera', 'editor', 'animate2d', 'topview']
export function selectedViews(view: Pick<ViewState, 'activeViews' | 'primary' | 'split' | 'animate2dSplit'>): PrimaryView[] {
  const valid = VIEW_ORDER.filter((id) => view.activeViews?.includes(id))
  if (valid.length) return valid
  if (view.primary === 'animate2d') return view.animate2dSplit ? ['camera', 'editor', 'animate2d'] : ['animate2d']
  return view.split ? ['camera', 'editor'] : [view.primary]
}

/** Two balanced columns; drafting and depth always share a column when both are active. */
export function computeTaggedLayout(w: number, h: number, aspect: number, views: PrimaryView[], dpr = 1, toolbarHeight = 34): Layout {
  const result: Layout = { dpr, cam: null, ed: null, stage2d: null, depth: null }
  const active = VIEW_ORDER.filter((id) => views.includes(id))
  if (!active.length) active.push('camera')
  const left = active.filter((id) => id === 'camera' || id === 'editor')
  const right = active.filter((id) => id === 'animate2d' || id === 'topview')
  const columns = active.length === 2 && !(active.includes('animate2d') && active.includes('topview')) ? active.map((id) => [id])
    : left.length && right.length ? [left, right] : [active]
  // At narrow widths stack the panes instead of silently hiding enabled tags.
  const groups = w < 620 ? [active] : columns
  const top = Math.min(Math.max(34, toolbarHeight), Math.max(0, h - 32))
  groups.forEach((group, col) => group.forEach((id, row) => {
    const area: Rect = { x: col * w / groups.length, y: top + row * (h - top) / group.length,
      w: Math.max(1, w / groups.length - 1), h: Math.max(1, (h - top) / group.length - 1) }
    if (id === 'camera') result.cam = fitRect(area, aspect, 8)
    else if (id === 'editor') result.ed = area
    else if (id === 'animate2d') result.stage2d = area
    else result.depth = area
  }))
  return result
}
