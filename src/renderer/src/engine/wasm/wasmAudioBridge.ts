import { allocScratchViews, getWasmExports, resolveSlotView } from './wasmRuntime'

export type AudioToneMode = 'normal' | 'bass' | 'treble' | 'vocal' | 'warm'

const TONE_MODE_CODE: Record<AudioToneMode, number> = {
  normal: 0,
  bass: 1,
  treble: 2,
  vocal: 3,
  warm: 4
}

export function wasmExtractAudioPeaks(
  samples: Float32Array,
  buckets: number,
  sampleStride = 8
): Float32Array | null {
  const exp = getWasmExports()
  if (!exp?.rust_extract_audio_peaks) return null
  if (samples.length <= 0 || buckets <= 0) return new Float32Array(0)

  const slots = allocScratchViews(exp, {
    samples: { kind: 'f32', length: samples.length },
    peaks: { kind: 'f32', length: buckets }
  })
  slots.samples.view.set(samples)
  const ok = exp.rust_extract_audio_peaks(
    slots.samples.ptr,
    samples.length,
    buckets,
    sampleStride,
    slots.peaks.ptr
  )
  if (!ok) return null
  return new Float32Array(resolveSlotView(exp, slots.peaks, 'f32', buckets))
}

export function wasmEncodePcm16Wav(
  channels: Float32Array[],
  sampleRate: number
): Uint8Array | null {
  const exp = getWasmExports()
  if (!exp?.rust_encode_pcm16_wav || channels.length === 0) return null
  const numChannels = Math.min(2, channels.length)
  const frameLen = channels[0].length
  const totalBytes = 44 + frameLen * numChannels * 2

  const slots = allocScratchViews(exp, {
    c0: { kind: 'f32', length: frameLen },
    c1: { kind: 'f32', length: numChannels === 2 ? frameLen : 0 },
    wav: { kind: 'u8', length: totalBytes }
  })
  if (frameLen > 0) {
    slots.c0.view.set(channels[0].subarray(0, frameLen))
    if (numChannels === 2 && channels[1]) {
      slots.c1.view.set(channels[1].subarray(0, frameLen))
    }
  }

  const written =
    exp.rust_encode_pcm16_wav(
      frameLen > 0 ? slots.c0.ptr : 0,
      numChannels === 2 && frameLen > 0 ? slots.c1.ptr : 0,
      numChannels,
      sampleRate,
      frameLen,
      slots.wav.ptr,
      totalBytes
    ) >>> 0
  if (written !== totalBytes) return null
  return new Uint8Array(resolveSlotView(exp, slots.wav, 'u8', totalBytes))
}

export function wasmApplyToneBiquad(
  samples: Float32Array,
  sampleRate: number,
  tone: AudioToneMode
): boolean {
  const code = TONE_MODE_CODE[tone] ?? 0
  if (code === 0 || samples.length === 0) return true
  const exp = getWasmExports()
  if (!exp?.rust_apply_tone_biquad_in_place) return false

  const slots = allocScratchViews(exp, {
    samples: { kind: 'f32', length: samples.length }
  })
  slots.samples.view.set(samples)
  const ok = exp.rust_apply_tone_biquad_in_place(slots.samples.ptr, samples.length, sampleRate, code)
  if (!ok) return false
  samples.set(resolveSlotView(exp, slots.samples, 'f32', samples.length))
  return true
}

export function wasmMixAudioClipF32(
  src: Float32Array,
  dst: Float32Array,
  dstStart: number,
  srcStartSample: number,
  stepPerOutFrame: number,
  gain: number,
  maxOutFrames: number
): boolean {
  const exp = getWasmExports()
  if (!exp?.rust_mix_audio_clip_f32) return false
  if (src.length === 0 || dst.length === 0 || dstStart >= dst.length || maxOutFrames <= 0) {
    return true
  }

  const slots = allocScratchViews(exp, {
    src: { kind: 'f32', length: src.length },
    dst: { kind: 'f32', length: dst.length }
  })
  slots.src.view.set(src)
  slots.dst.view.set(dst)
  exp.rust_mix_audio_clip_f32(
    slots.src.ptr,
    src.length,
    slots.dst.ptr,
    dst.length,
    dstStart,
    srcStartSample,
    stepPerOutFrame,
    gain,
    maxOutFrames
  )
  dst.set(resolveSlotView(exp, slots.dst, 'f32', dst.length))
  return true
}

export interface WasmLipSyncEvalResult {
  scales: Float64Array
  positions: Float64Array
}

export function wasmEvalLipSyncFrames(
  peaks: Float32Array,
  params17: Float64Array,
  frameCount: number
): WasmLipSyncEvalResult | null {
  const exp = getWasmExports()
  if (!exp?.rust_eval_lipsync_frames || frameCount <= 0) return null

  const slots = allocScratchViews(exp, {
    peaks: { kind: 'f32', length: peaks.length },
    params: { kind: 'f64', length: 17 },
    scales: { kind: 'f64', length: frameCount * 3 },
    positions: { kind: 'f64', length: frameCount * 3 }
  })
  if (peaks.length > 0) slots.peaks.view.set(peaks)
  slots.params.view.set(params17.subarray(0, 17))
  const written = exp.rust_eval_lipsync_frames(
    peaks.length > 0 ? slots.peaks.ptr : 0,
    peaks.length,
    slots.params.ptr,
    frameCount,
    slots.scales.ptr,
    slots.positions.ptr
  )
  if (written !== frameCount) return null
  return {
    scales: new Float64Array(resolveSlotView(exp, slots.scales, 'f64', frameCount * 3)),
    positions: new Float64Array(resolveSlotView(exp, slots.positions, 'f64', frameCount * 3))
  }
}
