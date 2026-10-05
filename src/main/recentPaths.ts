import { app } from 'electron'
import { dirname, join } from 'path'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'

export type PathCategory = 'image' | 'audio' | 'project' | 'export'

export interface RecentPathsRecord {
  image?: string
  audio?: string
  project?: string
  export?: string
}

export class RecentPathsManager {
  private customPath?: string
  private cache: RecentPathsRecord = {}
  private isLoaded = false

  constructor(customPath?: string) {
    this.customPath = customPath
  }

  private getStoragePath(): string | null {
    if (this.customPath) return this.customPath
    try {
      if (app && typeof app.getPath === 'function') {
        return join(app.getPath('userData'), 'recent-paths.json')
      }
    } catch {
      // Electron app not ready or running outside Electron environment
    }
    return null
  }

  private load(): void {
    if (this.isLoaded) return
    this.isLoaded = true
    const storagePath = this.getStoragePath()
    if (!storagePath || !existsSync(storagePath)) return

    try {
      const raw = readFileSync(storagePath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        this.cache = { ...parsed }
      }
    } catch (err) {
      console.warn('[RecentPaths] Failed to read recent paths:', err)
    }
  }

  private save(): void {
    const storagePath = this.getStoragePath()
    if (!storagePath) return

    try {
      const dir = dirname(storagePath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(storagePath, JSON.stringify(this.cache, null, 2), 'utf-8')
    } catch (err) {
      console.warn('[RecentPaths] Failed to save recent paths:', err)
    }
  }

  private isDirectory(p: string): boolean {
    try {
      return existsSync(p) && statSync(p).isDirectory()
    } catch {
      return false
    }
  }

  getRecentDir(category: PathCategory): string | undefined {
    this.load()
    const dir = this.cache[category]
    if (dir && this.isDirectory(dir)) {
      return dir
    }

    // Fallback: for media assets (image/audio), borrow the active project directory if known
    if ((category === 'image' || category === 'audio') && this.cache.project && this.isDirectory(this.cache.project)) {
      return this.cache.project
    }

    return undefined
  }

  setRecentDir(category: PathCategory, dirPath: string): void {
    this.load()
    if (!dirPath || typeof dirPath !== 'string') return
    this.cache[category] = dirPath
    this.save()
  }

  setRecentFromFile(category: PathCategory, filePath: string): void {
    if (!filePath || typeof filePath !== 'string') return
    const dir = this.isDirectory(filePath) ? filePath : dirname(filePath)
    this.setRecentDir(category, dir)
  }

  resolveDefaultPath(category: PathCategory, defaultFileName?: string): string | undefined {
    const recentDir = this.getRecentDir(category)
    if (!recentDir) {
      return defaultFileName
    }
    return defaultFileName ? join(recentDir, defaultFileName) : recentDir
  }
}

export const recentPaths = new RecentPathsManager()
