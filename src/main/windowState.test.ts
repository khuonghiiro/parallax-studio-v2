import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import type { BrowserWindow } from 'electron'
import {
  DEFAULT_WINDOW_STATE,
  WindowStateManager,
  isWindowVisibleOnDisplays,
  sanitizeWindowState,
  type DisplayWorkArea
} from './windowState'

describe('WindowStateManager & sanitizeWindowState', () => {
  const tempDir = join(tmpdir(), `pxs-winstate-test-${Date.now()}`)
  const storageFile = join(tempDir, 'window-state.json')

  const primaryDisplay: DisplayWorkArea = {
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 }
  }

  beforeEach(() => {
    if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true })
  })

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup error
    }
  })

  it('returns default window state when input is invalid or empty', () => {
    expect(sanitizeWindowState(null)).toEqual(DEFAULT_WINDOW_STATE)
    expect(sanitizeWindowState({ width: 120, height: 80 })).toEqual(DEFAULT_WINDOW_STATE)
  })

  it('preserves valid coordinates, dimensions, maximized, and fullscreen flags', () => {
    const state = sanitizeWindowState(
      { x: 100, y: 60, width: 1440, height: 900, isMaximized: true, isFullScreen: false },
      [primaryDisplay]
    )
    expect(state).toEqual({
      x: 100,
      y: 60,
      width: 1440,
      height: 900,
      isMaximized: true,
      isFullScreen: false
    })
  })

  it('resets off-screen coordinates when a secondary monitor is disconnected', () => {
    expect(
      isWindowVisibleOnDisplays({ x: 3200, y: 100, width: 1400, height: 900 }, [primaryDisplay])
    ).toBe(false)

    const sanitized = sanitizeWindowState(
      { x: 3200, y: 100, width: 2200, height: 1200, isMaximized: false, isFullScreen: false },
      [primaryDisplay]
    )
    expect(sanitized.x).toBeUndefined()
    expect(sanitized.y).toBeUndefined()
    expect(sanitized.width).toBe(1920)
    expect(sanitized.height).toBe(1040)
  })

  it('tracks window resize, move, maximize, and persists state to disk across restarts', () => {
    const manager = new WindowStateManager(storageFile)
    const listeners: Record<string, () => void> = {}
    let maximized = false
    let fullScreen = false
    let bounds = { x: 140, y: 80, width: 1520, height: 920 }

    const mockWin = {
      isDestroyed: () => false,
      isMaximized: () => maximized,
      isFullScreen: () => fullScreen,
      isMinimized: () => false,
      getBounds: () => ({ ...bounds }),
      getNormalBounds: () => ({ ...bounds }),
      maximize: () => {
        maximized = true
      },
      setFullScreen: (flag: boolean) => {
        fullScreen = flag
      },
      on: (event: string, cb: () => void) => {
        listeners[event] = cb
      }
    } as unknown as BrowserWindow

    manager.trackWindow(mockWin)

    // Simulate resize & move, followed by maximize and close
    bounds = { x: 220, y: 95, width: 1720, height: 980 }
    listeners['resize']?.()
    maximized = true
    listeners['maximize']?.()
    listeners['close']?.()

    // Reload from a fresh manager instance (simulating app restart)
    const nextManager = new WindowStateManager(storageFile)
    const restored = nextManager.load()
    expect(restored).toEqual({
      x: 220,
      y: 95,
      width: 1720,
      height: 980,
      isMaximized: true,
      isFullScreen: false
    })

    let maximizeCalled = false
    const nextWin = {
      isDestroyed: () => false,
      maximize: () => {
        maximizeCalled = true
      },
      setFullScreen: () => {}
    } as unknown as BrowserWindow

    nextManager.applyRestoredState(nextWin)
    expect(maximizeCalled).toBe(true)
  })
})
