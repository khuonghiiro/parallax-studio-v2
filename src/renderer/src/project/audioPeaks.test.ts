import { describe, it, expect } from 'vitest'
import { getAudioPeaks, getAudioPeaksFromBlob } from './audioPeaks'

describe('audioPeaks helper', () => {
  it('trả về mảng rỗng nếu assetId không tồn tại', async () => {
    const peaks = await getAudioPeaks('non-existent-asset-id')
    expect(peaks).toBeInstanceOf(Float32Array)
    expect(peaks.length).toBe(0)
  })

  it('hỗ trợ cache key và xử lý blob không hợp lệ trả về mảng rỗng không làm sập app', async () => {
    // Giả lập blob không phải audio data
    const invalidBlob = new Blob(['not-an-audio-file'], { type: 'text/plain' })
    const peaks = await getAudioPeaksFromBlob(invalidBlob, 'invalid-test', 100)
    expect(peaks).toBeInstanceOf(Float32Array)
    expect(peaks.length).toBe(0)
  })
})
