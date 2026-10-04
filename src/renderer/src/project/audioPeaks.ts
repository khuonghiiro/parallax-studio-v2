import { assetStore } from './assets'

const cache = new Map<string, Promise<Float32Array>>()

/** Decode an audio asset and compute normalized peak amplitudes (cached). */
export function getAudioPeaks(assetId: string, buckets = 2000): Promise<Float32Array> {
  const key = `${assetId}:${buckets}`
  let p = cache.get(key)
  if (!p) {
    p = (async () => {
      const asset = assetStore.get(assetId)
      if (!asset) return new Float32Array(0)
      const ctx = new AudioContext()
      try {
        const buf = await ctx.decodeAudioData(await asset.blob.arrayBuffer())
        const ch = buf.getChannelData(0)
        const peaks = new Float32Array(buckets)
        const step = Math.max(1, Math.floor(ch.length / buckets))
        let max = 0
        for (let i = 0; i < buckets; i++) {
          let m = 0
          const start = i * step
          for (let j = start; j < Math.min(ch.length, start + step); j += 8) m = Math.max(m, Math.abs(ch[j]))
          peaks[i] = m
          max = Math.max(max, m)
        }
        if (max > 0) for (let i = 0; i < buckets; i++) peaks[i] /= max
        return peaks
      } finally {
        ctx.close()
      }
    })()
    cache.set(key, p)
  }
  return p
}
