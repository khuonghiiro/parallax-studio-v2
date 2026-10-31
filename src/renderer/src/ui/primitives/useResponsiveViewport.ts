import { useEffect, useState } from 'react'

export type DeviceBreakpoint = 'phone' | 'tablet' | 'laptop' | 'desktop'

export function resolveDeviceBreakpoint(width: number, height: number): DeviceBreakpoint {
  if (width <= 768 || (height <= 520 && width <= 960)) return 'phone'
  if (width <= 1120) return 'tablet'
  if (width <= 1366) return 'laptop'
  return 'desktop'
}

export interface ResponsiveViewportInfo {
  width: number
  height: number
  breakpoint: DeviceBreakpoint
  /** True when sidebars act as tabbed drawers (Phone / Tablet) and must never collapse to a 40px rail. */
  isDrawerMode: boolean
  isPhone: boolean
  isTablet: boolean
}

function readViewport(): ResponsiveViewportInfo {
  const width = typeof window !== 'undefined' ? window.innerWidth || 1440 : 1440
  const height = typeof window !== 'undefined' ? window.innerHeight || 900 : 900
  const breakpoint = resolveDeviceBreakpoint(width, height)
  return {
    width,
    height,
    breakpoint,
    isDrawerMode: breakpoint === 'phone' || breakpoint === 'tablet',
    isPhone: breakpoint === 'phone',
    isTablet: breakpoint === 'tablet'
  }
}

export function useResponsiveViewport(): ResponsiveViewportInfo {
  const [info, setInfo] = useState<ResponsiveViewportInfo>(readViewport)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let raf = 0
    const onResize = (): void => {
      window.cancelAnimationFrame(raf)
      raf = window.requestAnimationFrame(() => {
        setInfo((prev) => {
          const next = readViewport()
          if (
            prev.breakpoint === next.breakpoint &&
            Math.abs(prev.width - next.width) < 8 &&
            Math.abs(prev.height - next.height) < 8
          ) {
            return prev
          }
          return next
        })
      })
    }
    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return info
}
