import { app, screen, type BrowserWindow, type Rectangle } from 'electron'
import { dirname, join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

export interface WindowStateRecord {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
  isFullScreen: boolean
}

export interface DisplayWorkArea {
  bounds: Rectangle
  workArea: Rectangle
}

export const MIN_WINDOW_WIDTH = 480
export const MIN_WINDOW_HEIGHT = 360

export const DEFAULT_WINDOW_STATE: WindowStateRecord = {
  width: 1600,
  height: 960,
  isMaximized: false,
  isFullScreen: false
}

/**
 * Kiểm tra cửa sổ có nằm trong vùng nhìn thấy được của ít nhất một màn hình đang kết nối hay không.
 */
export function isWindowVisibleOnDisplays(
  rect: { x: number; y: number; width: number; height: number },
  displays: DisplayWorkArea[]
): boolean {
  if (!displays || displays.length === 0) return true
  const minOverlapW = 120
  const minOverlapH = 80

  for (const d of displays) {
    const area = d.workArea || d.bounds
    if (!area) continue
    const overlapX =
      Math.min(rect.x + rect.width, area.x + area.width) - Math.max(rect.x, area.x)
    const overlapY =
      Math.min(rect.y + rect.height, area.y + area.height) - Math.max(rect.y, area.y)
    if (overlapX >= minOverlapW && overlapY >= minOverlapH) {
      return true
    }
  }
  return false
}

/**
 * Chuẩn hoá và kẹp trạng thái cửa sổ hợp lệ theo danh sách màn hình hiện tại.
 */
export function sanitizeWindowState(
  raw: unknown,
  displays: DisplayWorkArea[] = []
): WindowStateRecord {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_WINDOW_STATE }
  }
  const obj = raw as Partial<WindowStateRecord>
  const rawW = Number(obj.width)
  const rawH = Number(obj.height)

  let width =
    Number.isFinite(rawW) && rawW >= MIN_WINDOW_WIDTH
      ? Math.round(rawW)
      : DEFAULT_WINDOW_STATE.width
  let height =
    Number.isFinite(rawH) && rawH >= MIN_WINDOW_HEIGHT
      ? Math.round(rawH)
      : DEFAULT_WINDOW_STATE.height

  const isMaximized = Boolean(obj.isMaximized)
  const isFullScreen = Boolean(obj.isFullScreen)

  const rawX = Number(obj.x)
  const rawY = Number(obj.y)
  const hasPosition = Number.isFinite(rawX) && Number.isFinite(rawY)

  if (hasPosition) {
    const x = Math.round(rawX)
    const y = Math.round(rawY)
    if (isWindowVisibleOnDisplays({ x, y, width, height }, displays)) {
      return { x, y, width, height, isMaximized, isFullScreen }
    }
  }

  // Nếu toạ độ cũ nằm ngoài màn hình (ví dụ rút màn hình phụ), kẹp kích thước vừa màn hình chính và bỏ x/y để căn giữa
  if (displays.length > 0) {
    const primary = displays[0].workArea || displays[0].bounds
    if (primary && primary.width >= MIN_WINDOW_WIDTH && primary.height >= MIN_WINDOW_HEIGHT) {
      width = Math.min(width, primary.width)
      height = Math.min(height, primary.height)
    }
  }

  return { width, height, isMaximized, isFullScreen }
}

export class WindowStateManager {
  private customPath?: string
  private state: WindowStateRecord = { ...DEFAULT_WINDOW_STATE }
  private isLoaded = false
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor(customPath?: string) {
    this.customPath = customPath
  }

  private getStoragePath(): string | null {
    if (this.customPath) return this.customPath
    try {
      if (app && typeof app.getPath === 'function') {
        return join(app.getPath('userData'), 'window-state.json')
      }
    } catch {
      // Running outside Electron main process
    }
    return null
  }

  private getConnectedDisplays(): DisplayWorkArea[] {
    try {
      if (screen && typeof screen.getAllDisplays === 'function') {
        return screen.getAllDisplays()
      }
    } catch {
      // screen module not ready
    }
    return []
  }

  load(): WindowStateRecord {
    const displays = this.getConnectedDisplays()
    if (this.isLoaded) {
      this.state = sanitizeWindowState(this.state, displays)
      return { ...this.state }
    }
    this.isLoaded = true
    const storagePath = this.getStoragePath()
    if (!storagePath || !existsSync(storagePath)) {
      this.state = sanitizeWindowState(DEFAULT_WINDOW_STATE, displays)
      return { ...this.state }
    }

    try {
      const raw = readFileSync(storagePath, 'utf-8')
      const parsed = JSON.parse(raw)
      this.state = sanitizeWindowState(parsed, displays)
    } catch (err) {
      console.warn('[WindowState] Failed to read window state:', err)
      this.state = sanitizeWindowState(DEFAULT_WINDOW_STATE, displays)
    }
    return { ...this.state }
  }

  saveNow(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    const storagePath = this.getStoragePath()
    if (!storagePath) return

    try {
      const dir = dirname(storagePath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(storagePath, JSON.stringify(this.state, null, 2), 'utf-8')
    } catch (err) {
      console.warn('[WindowState] Failed to save window state:', err)
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      this.saveNow()
    }, 220)
  }

  updateFromWindow(win: BrowserWindow): void {
    if (!win || win.isDestroyed()) return
    try {
      const isMaximized = win.isMaximized()
      const isFullScreen = win.isFullScreen()
      const isMinimized = win.isMinimized()

      if (!isMaximized && !isFullScreen && !isMinimized) {
        const bounds = win.getBounds()
        if (bounds.width >= MIN_WINDOW_WIDTH && bounds.height >= MIN_WINDOW_HEIGHT) {
          this.state.x = bounds.x
          this.state.y = bounds.y
          this.state.width = bounds.width
          this.state.height = bounds.height
        }
      } else if (typeof win.getNormalBounds === 'function' && !isMinimized) {
        const normal = win.getNormalBounds()
        if (normal.width >= MIN_WINDOW_WIDTH && normal.height >= MIN_WINDOW_HEIGHT) {
          this.state.x = normal.x
          this.state.y = normal.y
          this.state.width = normal.width
          this.state.height = normal.height
        }
      }

      this.state.isMaximized = isMaximized
      this.state.isFullScreen = isFullScreen
    } catch {
      // ignore if window is closing
    }
  }

  trackWindow(win: BrowserWindow): void {
    this.load()

    const onResizeOrMove = (): void => {
      this.updateFromWindow(win)
      this.scheduleSave()
    }

    const onStateChangeImmediate = (): void => {
      this.updateFromWindow(win)
      this.saveNow()
    }

    win.on('resize', onResizeOrMove)
    win.on('move', onResizeOrMove)
    win.on('maximize', onStateChangeImmediate)
    win.on('unmaximize', onStateChangeImmediate)
    win.on('enter-full-screen', onStateChangeImmediate)
    win.on('leave-full-screen', onStateChangeImmediate)
    win.on('close', onStateChangeImmediate)
  }

  applyRestoredState(win: BrowserWindow): void {
    if (!win || win.isDestroyed()) return
    const current = this.load()
    if (current.isFullScreen) {
      win.setFullScreen(true)
    } else if (current.isMaximized) {
      win.maximize()
    }
  }

  getState(): WindowStateRecord {
    return { ...this.load() }
  }
}

export const windowState = new WindowStateManager()
