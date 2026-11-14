import type { AudioTrackItem } from '@shared/types'
import { isWasmAccelReady } from '../engine/wasmAccel'
import {
  wasmApplyToneBiquad,
  wasmEncodePcm16Wav,
  wasmMixAudioClipF32,
  type AudioToneMode
} from '../engine/wasm/wasmAudioBridge'
import { assetStore } from './assets'

export interface DecodedAudioClip {
  track: AudioTrackItem
  sampleRate: number
  channels: Float32Array[]
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

export function encodeChannelsToPcm16WavJs(
  channels: Float32Array[],
  sampleRate: number
): Uint8Array {
  if (channels.length === 0) return new Uint8Array(44)
  const numChannels = Math.min(2, channels.length)
  const length = channels[0].length
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = length * blockAlign
  const wavBytes = new Uint8Array(44 + dataSize)
  const view = new DataView(wavBytes.buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bytesPerSample * 8, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]))
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, int16, true)
      offset += 2
    }
  }
  return wavBytes
}

export function encodeChannelsToPcm16Wav(
  channels: Float32Array[],
  sampleRate: number
): Uint8Array {
  const wasmWav = wasmEncodePcm16Wav(channels, sampleRate)
  if (wasmWav) return wasmWav
  return encodeChannelsToPcm16WavJs(channels, sampleRate)
}

function encodeAudioBufferToWav(buffer: AudioBuffer): Uint8Array {
  const numChannels = Math.min(2, buffer.numberOfChannels)
  const channels: Float32Array[] = []
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch))
  }
  return encodeChannelsToPcm16Wav(channels, buffer.sampleRate)
}

function resolveBiquadCoeffsJs(tone: AudioToneMode, sr: number): number[] | null {
  const safeSr = Math.max(8000, sr)
  const pi = Math.PI
  let b0 = 1
  let b1 = 0
  let b2 = 0
  let a0 = 1
  let a1 = 0
  let a2 = 0
  if (tone === 'bass') {
    const a = Math.pow(10, 6 / 40)
    const w0 = (2 * pi * 150) / safeSr
    const cosW = Math.cos(w0)
    const sqrtA2 = Math.sqrt(a) * Math.sin(w0) * Math.SQRT2
    b0 = a * (a + 1 - (a - 1) * cosW + sqrtA2)
    b1 = 2 * a * (a - 1 - (a + 1) * cosW)
    b2 = a * (a + 1 - (a - 1) * cosW - sqrtA2)
    a0 = a + 1 + (a - 1) * cosW + sqrtA2
    a1 = -2 * (a - 1 + (a + 1) * cosW)
    a2 = a + 1 + (a - 1) * cosW - sqrtA2
  } else if (tone === 'treble') {
    const a = Math.pow(10, 6 / 40)
    const w0 = (2 * pi * 3500) / safeSr
    const cosW = Math.cos(w0)
    const sqrtA2 = Math.sqrt(a) * Math.sin(w0) * Math.SQRT2
    b0 = a * (a + 1 + (a - 1) * cosW + sqrtA2)
    b1 = -2 * a * (a - 1 + (a + 1) * cosW)
    b2 = a * (a + 1 + (a - 1) * cosW - sqrtA2)
    a0 = a + 1 - (a - 1) * cosW + sqrtA2
    a1 = 2 * (a - 1 - (a + 1) * cosW)
    a2 = a + 1 - (a - 1) * cosW - sqrtA2
  } else if (tone === 'vocal') {
    const a = Math.pow(10, 4 / 40)
    const w0 = (2 * pi * 1500) / safeSr
    const cosW = Math.cos(w0)
    const alpha = Math.sin(w0) / 2
    b0 = 1 + alpha * a
    b1 = -2 * cosW
    b2 = 1 - alpha * a
    a0 = 1 + alpha / a
    a1 = -2 * cosW
    a2 = 1 - alpha / a
  } else if (tone === 'warm') {
    const w0 = (2 * pi * 4500) / safeSr
    const cosW = Math.cos(w0)
    const alpha = Math.sin(w0) / (2 * Math.SQRT1_2)
    b0 = (1 - cosW) / 2
    b1 = 1 - cosW
    b2 = (1 - cosW) / 2
    a0 = 1 + alpha
    a1 = -2 * cosW
    a2 = 1 - alpha
  } else {
    return null
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0]
}

function applyToneBiquadJs(samples: Float32Array, sr: number, tone: AudioToneMode): void {
  const c = resolveBiquadCoeffsJs(tone, sr)
  if (!c) return
  const [b0, b1, b2, a1, a2] = c
  let z1 = 0
  let z2 = 0
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i]
    const y = b0 * x + z1
    z1 = b1 * x - a1 * y + z2
    z2 = b2 * x - a2 * y
    samples[i] = y
  }
}

function mixClipChannelJs(
  src: Float32Array,
  dst: Float32Array,
  dstStart: number,
  srcStartSample: number,
  stepPerOutFrame: number,
  gain: number,
  maxOutFrames: number
): void {
  const limit = Math.min(maxOutFrames, dst.length - dstStart)
  for (let k = 0; k < limit; k++) {
    const pos = srcStartSample + k * stepPerOutFrame
    if (pos < 0) continue
    const idx = Math.floor(pos)
    if (idx >= src.length) break
    const s0 = src[idx]
    const s1 = idx + 1 < src.length ? src[idx + 1] : s0
    const frac = pos - idx
    dst[dstStart + k] += (s0 + (s1 - s0) * frac) * gain
  }
}

export function mixDecodedAudioClipsToWav(
  clips: DecodedAudioClip[],
  totalDuration: number,
  start = 0,
  sampleRate = 44100
): Uint8Array | null {
  if (clips.length === 0 || totalDuration <= 0) return null
  const frameCount = Math.max(1, Math.ceil(totalDuration * sampleRate))
  const outL = new Float32Array(frameCount)
  const outR = new Float32Array(frameCount)
  let mixedCount = 0

  for (const clip of clips) {
    const { track } = clip
    if (track.muted || clip.channels.length === 0) continue
    const trackStartSec = track.offset - start
    const dstStartFrame = trackStartSec >= 0 ? Math.floor(trackStartSec * sampleRate) : 0
    if (dstStartFrame >= frameCount) continue

    const rate = track.playbackRate || 1
    const trimIn = Math.max(0, track.trimIn || 0)
    const skipSec = trackStartSec < 0 ? -trackStartSec : 0
    const actualTrimSec = trimIn + skipSec
    const dur = track.duration !== undefined ? Math.max(0, track.duration - skipSec) : undefined
    const remainingOut = frameCount - dstStartFrame
    const maxOutFrames =
      dur !== undefined ? Math.min(remainingOut, Math.max(0, Math.ceil(dur * sampleRate))) : remainingOut
    if (maxOutFrames <= 0) continue

    const srcStartSample = actualTrimSec * clip.sampleRate
    const stepPerOutFrame = (rate * clip.sampleRate) / sampleRate
    const gain = Math.max(0, Math.min(2, track.volume))
    const tone: AudioToneMode = track.tone ?? 'normal'

    const srcCh0 = new Float32Array(clip.channels[0])
    if (!wasmApplyToneBiquad(srcCh0, clip.sampleRate, tone)) {
      applyToneBiquadJs(srcCh0, clip.sampleRate, tone)
    }
    const srcCh1 =
      clip.channels.length > 1
        ? (() => {
            const copy = new Float32Array(clip.channels[1])
            if (!wasmApplyToneBiquad(copy, clip.sampleRate, tone)) {
              applyToneBiquadJs(copy, clip.sampleRate, tone)
            }
            return copy
          })()
        : srcCh0

    if (!wasmMixAudioClipF32(srcCh0, outL, dstStartFrame, srcStartSample, stepPerOutFrame, gain, maxOutFrames)) {
      mixClipChannelJs(srcCh0, outL, dstStartFrame, srcStartSample, stepPerOutFrame, gain, maxOutFrames)
    }
    if (!wasmMixAudioClipF32(srcCh1, outR, dstStartFrame, srcStartSample, stepPerOutFrame, gain, maxOutFrames)) {
      mixClipChannelJs(srcCh1, outR, dstStartFrame, srcStartSample, stepPerOutFrame, gain, maxOutFrames)
    }
    mixedCount++
  }

  if (mixedCount === 0) return null
  return encodeChannelsToPcm16Wav([outL, outR], sampleRate)
}

function applyOfflineTrackToneFilter(
  actx: OfflineAudioContext,
  source: AudioBufferSourceNode,
  tone: AudioTrackItem['tone']
): AudioNode {
  if (!tone || tone === 'normal') return source
  const filter = actx.createBiquadFilter()
  if (tone === 'bass') {
    filter.type = 'lowshelf'
    filter.frequency.value = 150
    filter.gain.value = 6
  } else if (tone === 'treble') {
    filter.type = 'highshelf'
    filter.frequency.value = 3500
    filter.gain.value = 6
  } else if (tone === 'vocal') {
    filter.type = 'peaking'
    filter.frequency.value = 1500
    filter.Q.value = 1
    filter.gain.value = 4
  } else if (tone === 'warm') {
    filter.type = 'lowpass'
    filter.frequency.value = 4500
  }
  source.connect(filter)
  return filter
}

async function mixTracksWithOfflineContext(
  decoded: Array<{ track: AudioTrackItem; buffer: AudioBuffer }>,
  totalDuration: number,
  start: number,
  sampleRate: number
): Promise<Uint8Array | null> {
  const frameCount = Math.max(1, Math.ceil(totalDuration * sampleRate))
  const actx = new OfflineAudioContext(2, frameCount, sampleRate)
  for (const { track, buffer } of decoded) {
    const source = actx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = track.playbackRate || 1
    const gainNode = actx.createGain()
    gainNode.gain.value = Math.max(0, Math.min(2, track.volume))
    const lastNode = applyOfflineTrackToneFilter(actx, source, track.tone)
    lastNode.connect(gainNode)
    gainNode.connect(actx.destination)

    const trackStart = track.offset - start
    const trimIn = Math.max(0, track.trimIn || 0)
    const dur = track.duration
    if (trackStart >= 0) {
      if (dur) source.start(trackStart, trimIn, dur)
      else source.start(trackStart, trimIn)
    } else {
      const skip = -trackStart
      if (dur) source.start(0, trimIn + skip, Math.max(0, dur - skip))
      else source.start(0, trimIn + skip)
    }
  }
  const rendered = await actx.startRendering()
  return encodeAudioBufferToWav(rendered)
}

/**
 * Mixes multiple audio tracks into a single WAV audio buffer (ưu tiên DSP Rust WASM, fallback OfflineAudioContext).
 */
export async function mixAudioTracksToWav(
  tracks: AudioTrackItem[],
  totalDuration: number,
  start = 0
): Promise<Uint8Array | null> {
  if (tracks.length === 0 || totalDuration <= 0) return null
  const sampleRate = 44100
  const baseAudioCtx = new AudioContext({ sampleRate })
  const decoded: Array<{ track: AudioTrackItem; buffer: AudioBuffer }> = []

  try {
    for (const track of tracks) {
      if (track.muted) continue
      const data = await assetStore.getBytes(track.assetId)
      if (!data || data.byteLength === 0) continue
      try {
        const buffer = await baseAudioCtx.decodeAudioData(data.buffer.slice(0) as ArrayBuffer)
        decoded.push({ track, buffer })
      } catch (err) {
        console.warn(`[mixAudioTracks] Failed to decode audio for track ${track.id}:`, err)
      }
    }
    if (decoded.length === 0) return null

    if (isWasmAccelReady()) {
      const clips: DecodedAudioClip[] = decoded.map(({ track, buffer }) => {
        const channels: Float32Array[] = [buffer.getChannelData(0)]
        if (buffer.numberOfChannels > 1) channels.push(buffer.getChannelData(1))
        return { track, sampleRate: buffer.sampleRate, channels }
      })
      const rustWav = mixDecodedAudioClipsToWav(clips, totalDuration, start, sampleRate)
      if (rustWav) return rustWav
    }

    return await mixTracksWithOfflineContext(decoded, totalDuration, start, sampleRate)
  } catch (err) {
    console.error('[mixAudioTracksToWav] Mixing failed:', err)
    return null
  } finally {
    baseAudioCtx.close().catch(() => undefined)
  }
}
