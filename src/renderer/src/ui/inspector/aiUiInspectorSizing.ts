import { resolveDeviceBreakpoint, type DeviceBreakpoint } from '../primitives/useResponsiveViewport'

export interface ScannedComputedSizing {
  fontSize: string
  fontSizePx: number
  lineHeight: string
  fontWeight: string
  width: number
  height: number
  boxSizing: string
  display: string
  padding: string
  gap: string
  parentTagName: string | null
  parentWidth: number | null
  parentHeight: number | null
  widthPercentOfParent: number | null
  isTouchCompliant: boolean
  warnings: string[]
  recommendations: string[]
}

export interface InspectorViewportInfo {
  width: number
  height: number
  breakpoint: DeviceBreakpoint
  breakpointLabel: string
}

export function getBreakpointLabel(bp: DeviceBreakpoint): string {
  switch (bp) {
    case 'phone':
      return '📱 Phone (≤768px)'
    case 'tablet':
      return '📱 Tablet (769–1120px)'
    case 'laptop':
      return '💻 Laptop (1121–1366px)'
    case 'desktop':
      return '🖥️ Desktop (>1366px)'
  }
}

export function getCurrentInspectorViewport(): InspectorViewportInfo {
  const width = typeof window !== 'undefined' ? window.innerWidth || 1440 : 1440
  const height = typeof window !== 'undefined' ? window.innerHeight || 900 : 900
  const breakpoint = resolveDeviceBreakpoint(width, height)
  return {
    width,
    height,
    breakpoint,
    breakpointLabel: getBreakpointLabel(breakpoint)
  }
}

function isInteractiveElement(el: Element, tagName: string, classes: string[]): boolean {
  if (['button', 'input', 'select', 'textarea', 'a'].includes(tagName)) return true
  const role = el.getAttribute?.('role')
  if (role === 'button' || role === 'tab' || role === 'menuitem' || role === 'checkbox') return true
  return classes.some(
    (c) =>
      c.includes('btn') ||
      c.includes('action') ||
      c.includes('tab') ||
      c.includes('clickable') ||
      c.includes('select') ||
      c.includes('picker')
  )
}

function parsePx(value: string): number {
  if (!value) return 0
  const match = value.match(/^([\d.]+)px$/)
  return match ? parseFloat(match[1]) : 0
}

function deriveWarnings(
  fontSizePx: number,
  width: number,
  height: number,
  isInteractive: boolean,
  parentWidth: number | null,
  widthPercentOfParent: number | null,
  tagName: string
): string[] {
  const warnings: string[] = []
  const isHeading = ['h1', 'h2', 'h3'].includes(tagName)

  if (fontSizePx > 20 && !isHeading) {
    warnings.push(`⚠️ Cỡ chữ ${fontSizePx}px quá lớn đối với control/nội dung giao diện (dễ gây thô và phá vỡ bố cục).`)
  } else if (fontSizePx > 16 && !isHeading) {
    warnings.push(`⚠️ Cỡ chữ ${fontSizePx}px hơi lớn cho control (chuẩn: 12–14px cho controls/body, 10–11px cho badges).`)
  }

  if (isInteractive && height > 0 && height < 34) {
    warnings.push(`⚠️ Chiều cao vùng bấm (${height}px) dưới chuẩn công thái học 36px cho nút/cảm ứng.`)
  }

  if (parentWidth && parentWidth > 800 && widthPercentOfParent && widthPercentOfParent > 92) {
    warnings.push(`⚠️ Phần tử trải rộng ${width}px (${widthPercentOfParent}% container) dễ gây "sa mạc trống trải" trên màn hình lớn.`)
  }

  return warnings
}

function deriveRecommendations(tagName: string, classes: string[], isInteractive: boolean): string[] {
  const recs: string[] = []
  const isBadge = classes.some((c) => c.includes('badge') || c.includes('pill') || c.includes('count') || c.includes('tag'))
  const isHeading = ['h1', 'h2', 'h3'].includes(tagName) || classes.some((c) => c.includes('title') || c.includes('header'))

  if (isBadge) {
    recs.push('Badge / Tag: font-size 10–11px, line-height 1.2–1.3, padding 2px 6px, bo góc var(--radius-sm) (4px)')
  } else if (isHeading) {
    recs.push('Tiêu đề: font-size 14–18px (tối đa 20px), font-weight 600, color var(--text)')
  } else if (isInteractive) {
    recs.push('Nút / Control: font-size 12–14px, min-height ≥36px (khuyến nghị 40px), padding 6px 12px, gap ≥6px')
  } else {
    recs.push('Nội dung / Label: font-size 12–14px (label phụ 11–12px), line-height 1.4–1.5, color var(--text) / var(--text-dim)')
  }

  recs.push('Responsive: dùng % / auto / minmax(320px, 1fr) / clamp() thay vì gán width cứng px lớn; tuân thủ 4 breakpoints')
  return recs
}

/**
 * Đo đạc thông số CSS computed (kích thước, typography, container) và đưa ra cảnh báo / khuyến nghị an toàn.
 */
export function extractComputedSizing(
  el: Element,
  rect: { width: number; height: number }
): ScannedComputedSizing | null {
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return null

  try {
    const cs = window.getComputedStyle(el)
    if (!cs) return null

    const fontSize = cs.fontSize || '13px'
    const fontSizePx = parsePx(fontSize)
    const lineHeight = cs.lineHeight || 'normal'
    const fontWeight = cs.fontWeight || '400'
    const boxSizing = cs.boxSizing || 'content-box'
    const display = cs.display || 'block'
    const padding = `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`.trim()
    const gap = cs.gap && cs.gap !== 'normal' ? cs.gap : ''

    const tagName = (el.tagName || 'div').toLowerCase()
    const classes = Array.from(el.classList || [])
    const isInteractive = isInteractiveElement(el, tagName, classes)

    const parentEl = el.parentElement
    let parentTagName: string | null = null
    let parentWidth: number | null = null
    let parentHeight: number | null = null
    let widthPercentOfParent: number | null = null

    if (parentEl && typeof parentEl.getBoundingClientRect === 'function') {
      parentTagName = (parentEl.tagName || 'div').toLowerCase()
      const pRect = parentEl.getBoundingClientRect()
      parentWidth = Math.round(pRect.width)
      parentHeight = Math.round(pRect.height)
      if (parentWidth > 0 && rect.width > 0) {
        widthPercentOfParent = Math.min(100, Math.round((rect.width / parentWidth) * 100))
      }
    }

    const isTouchCompliant = !isInteractive || (rect.width >= 34 && rect.height >= 34)
    const warnings = deriveWarnings(
      fontSizePx,
      rect.width,
      rect.height,
      isInteractive,
      parentWidth,
      widthPercentOfParent,
      tagName
    )
    const recommendations = deriveRecommendations(tagName, classes, isInteractive)

    return {
      fontSize,
      fontSizePx,
      lineHeight,
      fontWeight,
      width: rect.width,
      height: rect.height,
      boxSizing,
      display,
      padding,
      gap,
      parentTagName,
      parentWidth,
      parentHeight,
      widthPercentOfParent,
      isTouchCompliant,
      warnings,
      recommendations
    }
  } catch {
    return null
  }
}
