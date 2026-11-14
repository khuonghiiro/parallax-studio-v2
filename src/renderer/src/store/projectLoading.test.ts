import { describe, expect, it, vi } from 'vitest'
import { assetStore } from '../project/assets'
import { runWithProjectLoading, useProjectLoading } from './projectLoading'

describe('useProjectLoading & assetStore.runBatch', () => {
  it('tracks loading stages and resets active state on completion or error', async () => {
    const snapshots: Array<{ phase: string; percent: number; loadedCount: number }> = []
    const unsub = useProjectLoading.subscribe((st) => {
      if (st.active) {
        snapshots.push({
          phase: st.phase,
          percent: st.percent,
          loadedCount: st.loadedCount
        })
      }
    })

    const out = await runWithProjectLoading('Đang tải mẫu thử…', async (report) => {
      report({
        phase: 'assets',
        stageLabel: 'Đang nạp ảnh (3/6)…',
        loadedCount: 3,
        totalCount: 6,
        percent: 50
      })
      report({
        phase: 'workflow',
        stageLabel: 'Đang đồng bộ sơ đồ…',
        percent: 88
      })
      return 'ok'
    })

    unsub()
    expect(out).toBe('ok')
    expect(useProjectLoading.getState().active).toBe(false)
    expect(useProjectLoading.getState().percent).toBe(100)
    expect(snapshots.some((s) => s.phase === 'assets' && s.loadedCount === 3)).toBe(true)
    expect(snapshots.some((s) => s.phase === 'workflow' && s.percent >= 88)).toBe(true)
  })

  it('coalesces assetStore listener notifications inside runBatch', async () => {
    assetStore.clear()
    const listener = vi.fn()
    const unsub = assetStore.subscribe(listener)

    const tinyPng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82
    ])

    await assetStore.runBatch(async () => {
      await assetStore.add('a.png', 'image/png', tinyPng, 'image')
      await assetStore.add('b.png', 'image/png', tinyPng, 'image')
      await assetStore.add('c.png', 'image/png', tinyPng, 'image')
      expect(listener).toHaveBeenCalledTimes(0)
    })

    expect(listener).toHaveBeenCalledTimes(1)
    unsub()
    assetStore.clear()
  })
})
