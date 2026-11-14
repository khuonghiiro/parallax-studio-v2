import { wasmExtractAudioPeaks } from '../engine/wasm/wasmAudioBridge'
import { assetStore } from './assets'

const cache = new Map<string, Promise<Float32Array>>()

export function computeNormalizedPeaksFromSamplesJs(
  ch: Float32Array,
  buckets = 2000
): Float32Array {
  if (ch.length === 0 || buckets <= 0) return new Float32Array(0)
  const peaks = new Float32Array(buckets)
  const step = Math.max(1, Math.floor(ch.length / buckets))
  let max = 0
  for (let i = 0; i < buckets; i++) {
    let m = 0
    const start = i * step
    for (let j = start; j < Math.min(ch.length, start + step); j += 8) {
      m = Math.max(m, Math.abs(ch[j]))
    }
    peaks[i] = m
    max = Math.max(max, m)
  }
  if (max > 0) for (let i = 0; i < buckets; i++) peaks[i] /= max
  return peaks
}

/** Rút trích và chuẩn hoá biên độ đỉnh âm thanh (ưu tiên Rust WASM). */
export function computeNormalizedPeaksFromSamples(
  ch: Float32Array,
  buckets = 2000
): Float32Array {
  const wasmPeaks = wasmExtractAudioPeaks(ch, buckets, 8)
  if (wasmPeaks) return wasmPeaks
  return computeNormalizedPeaksFromSamplesJs(ch, buckets)
}

/** Decode a raw audio Blob and compute normalized peak amplitudes (cached). */
export function getAudioPeaksFromBlob(blob: Blob, cacheKey: string, buckets = 2000): Promise<Float32Array> {
  const key = `blob:${cacheKey}:${buckets}`
  let p = cache.get(key)
  if (!p) {
    p = (async () => {
      if (typeof AudioContext === 'undefined') {
        return new Float32Array(0)
      }
      const ctx = new AudioContext()
      try {
        const buf = await ctx.decodeAudioData(await blob.arrayBuffer())
        return computeNormalizedPeaksFromSamples(buf.getChannelData(0), buckets)
      } catch (err) {
        console.warn('[audioPeaks] Failed to decode audio blob:', err)
        return new Float32Array(0)
      } finally {
        ctx.close()
      }
    })()
    cache.set(key, p)
  }
  return p
}

/** Decode an audio asset and compute normalized peak amplitudes (cached). */
export function getAudioPeaks(assetId: string, buckets = 2000): Promise<Float32Array> {
  const asset = assetStore.get(assetId)
  if (!asset) return Promise.resolve(new Float32Array(0))
  return getAudioPeaksFromBlob(asset.blob, assetId, buckets)
}
