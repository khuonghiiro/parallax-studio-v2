import { describe, expect, it, afterAll, beforeAll } from 'vitest'
import { existsSync } from 'fs'
import { readFile, rm, mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  saveLoopAnimationPackageToDisk,
  loadLoopAnimationPackageFromDisk
} from './loopAnimationPackages'

describe('loopAnimationPackages', () => {
  const root = join(tmpdir(), 'parallax_loop_test_' + Date.now())

  beforeAll(async () => {
    await mkdir(join(root, 'manifests'), { recursive: true })
    await writeFile(join(root, 'manifest.json'), JSON.stringify({ version: '2.0.0', assets: {} }, null, 2))
    await writeFile(join(root, 'manifests', 'loop-animator.json'), JSON.stringify({ module: 'loop_animator', assets: {} }, null, 2))
  })

  afterAll(async () => {
    if (existsSync(root)) {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('saves frames and animation.json into an unaccented folder on disk', async () => {
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    const dummyBuffer = Buffer.from(pngBase64, 'base64')

    const jsonContent = JSON.stringify({
      version: '1.0',
      name: 'Ánh Lửa Cháy',
      fps: 14,
      loopMode: 'loop',
      colorConfig: {
        tintColor: '#ff5500',
        tintIntensity: 0.8,
        brightness: 1.1
      },
      frames: [
        { index: 0, file: 'frame_000.png', durationRatio: 1.0 },
        { index: 1, file: 'frame_001.png', durationRatio: 1.0 }
      ]
    })

    const res = await saveLoopAnimationPackageToDisk(root, {
      folderName: 'Ánh Lửa Cháy',
      name: 'Ánh Lửa Cháy',
      category: 'fire',
      jsonContent,
      frames: [
        { fileName: 'frame_000.png', data: dummyBuffer },
        { fileName: 'frame_001.png', data: dummyBuffer }
      ],
      thumbnail: { fileName: 'thumbnail.png', data: dummyBuffer }
    })

    expect(res.ok).toBe(true)
    expect(res.folderName).toBe('anh_lua_chay')
    expect(res.jsonRelPath).toBe('loop_animations/anh_lua_chay/animation.json')

    const savedDir = res.folderPath!
    expect(existsSync(join(savedDir, 'frame_000.png'))).toBe(true)
    expect(existsSync(join(savedDir, 'frame_001.png'))).toBe(true)
    expect(existsSync(join(savedDir, 'thumbnail.png'))).toBe(true)
    expect(existsSync(join(savedDir, 'animation.json'))).toBe(true)

    // Test load
    const loadRes = await loadLoopAnimationPackageFromDisk(root, res.jsonRelPath!)
    expect(loadRes.ok).toBe(true)
    expect(loadRes.data?.name).toBe('Ánh Lửa Cháy')
    expect(loadRes.data?.fps).toBe(14)
    expect(loadRes.data?.colorConfig?.tintColor).toBe('#ff5500')
    expect(loadRes.data?.frames).toHaveLength(2)
  })
})
