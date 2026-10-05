import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { RecentPathsManager } from './recentPaths'

describe('RecentPathsManager', () => {
  it('returns undefined when no previous path exists', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'pxs-recent-test-'))
    try {
      const storageFile = join(tempDir, 'recent.json')
      const mgr = new RecentPathsManager(storageFile)
      expect(mgr.getRecentDir('image')).toBeUndefined()
      expect(mgr.resolveDefaultPath('image', 'test.png')).toBe('test.png')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('remembers and persists recent directory from file selection', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'pxs-recent-test-'))
    try {
      const storageFile = join(tempDir, 'recent.json')
      const subFolder = join(tempDir, 'my-photos')
      mkdirSync(subFolder, { recursive: true })
      const fakeImage = join(subFolder, 'photo1.png')
      writeFileSync(fakeImage, 'fake')

      const mgr1 = new RecentPathsManager(storageFile)
      mgr1.setRecentFromFile('image', fakeImage)
      expect(mgr1.getRecentDir('image')).toBe(subFolder)
      expect(mgr1.resolveDefaultPath('image', 'photo2.png')).toBe(join(subFolder, 'photo2.png'))

      // Second instance loading from the same storage file
      const mgr2 = new RecentPathsManager(storageFile)
      expect(mgr2.getRecentDir('image')).toBe(subFolder)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('falls back to project directory if media directory is not yet chosen', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'pxs-recent-test-'))
    try {
      const storageFile = join(tempDir, 'recent.json')
      const projectDir = join(tempDir, 'project-workspace')
      mkdirSync(projectDir, { recursive: true })
      const fakeProject = join(projectDir, 'scene.pxs')
      writeFileSync(fakeProject, 'data')

      const mgr = new RecentPathsManager(storageFile)
      mgr.setRecentFromFile('project', fakeProject)

      expect(mgr.getRecentDir('project')).toBe(projectDir)
      // Since 'image' has not been set yet, it falls back to 'project' directory
      expect(mgr.getRecentDir('image')).toBe(projectDir)

      // Once 'image' is specifically set, 'image' directory takes precedence
      const imageDir = join(tempDir, 'assets')
      mkdirSync(imageDir, { recursive: true })
      mgr.setRecentFromFile('image', join(imageDir, 'hero.png'))
      expect(mgr.getRecentDir('image')).toBe(imageDir)
      expect(mgr.getRecentDir('project')).toBe(projectDir)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('discards non-existent or deleted directories safely', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'pxs-recent-test-'))
    try {
      const storageFile = join(tempDir, 'recent.json')
      const deletedFolder = join(tempDir, 'deleted-folder')
      const mgr = new RecentPathsManager(storageFile)
      mgr.setRecentDir('image', deletedFolder)

      expect(mgr.getRecentDir('image')).toBeUndefined()
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
