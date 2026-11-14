import { spawnSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import JSZip from 'jszip'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FfmpegEncoder, ffmpegPath } from '../../../main/ffmpeg'
import { ensureWasmAccelLoaded, isWasmAccelReady } from '../engine/wasmAccel'
import { wasmPackPxsZip } from '../engine/wasm/wasmZipBridge'
import { assetStore } from './assets'
import {
  encodeChannelsToPcm16Wav,
  encodeChannelsToPcm16WavJs,
  mixDecodedAudioClipsToWav
} from './audioMixdown'
import { computeNormalizedPeaksFromSamples, computeNormalizedPeaksFromSamplesJs } from './audioPeaks'
import { createImageLayer, createProject } from './factory'
import {
  bakeLipSyncToCharacterLayerSync,
  bakeLipSyncToCharacterLayerSyncJs,
  seedAudioPeaksCache
} from './lipSync'
import { deserializeProject, serializeProject } from './serialize'

const origAudio = (globalThis as Record<string, unknown>).Audio

beforeAll(async () => {
  await ensureWasmAccelLoaded()
  if (typeof (globalThis as Record<string, unknown>).Audio === 'undefined') {
    ;(globalThis as Record<string, unknown>).Audio = class MockAudio {
      duration = 2.5
      onloadedmetadata: (() => void) | null = null
      onerror: (() => void) | null = null
      set preload(_v: string) {}
      set src(_v: string) {
        queueMicrotask(() => this.onloadedmetadata?.())
      }
    }
  }
})

afterAll(() => {
  assetStore.clear()
  if (origAudio === undefined) {
    delete (globalThis as Record<string, unknown>).Audio
  } else {
    ;(globalThis as Record<string, unknown>).Audio = origAudio
  }
})

describe('Stage 4B Serialize & Audio DSP & CPU YUV Export', () => {
  it('round-trips serializeProject and deserializeProject for WASM STORE and legacy JSZip DEFLATE', async () => {
    expect(isWasmAccelReady()).toBe(true)
    assetStore.clear()

    const imgBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82])
    const audioBytes = new Uint8Array(64).fill(0x5a)
    const imgAsset = await assetStore.add('hero.png', 'image/png', imgBytes, 'image', {
      id: 'img_hero_1',
      name: 'hero.png',
      kind: 'image',
      mime: 'image/png',
      width: 120,
      height: 180
    })
    const audAsset = await assetStore.add('voice.wav', 'audio/wav', audioBytes, 'audio', {
      id: 'aud_voice_1',
      name: 'voice.wav',
      kind: 'audio',
      mime: 'audio/wav',
      duration: 2.5
    })

    const project = createProject({ name: 'Cảnh Stage 4 Test' })
    project.assets.push(imgAsset.meta, audAsset.meta)
    project.layers.push(createImageLayer(imgAsset.meta, project.comp, 0))
    project.audio = {
      id: 'track-1',
      name: 'Voice',
      assetId: audAsset.meta.id,
      offset: 0,
      volume: 1
    }
    project.audioTracks = [
      {
        id: 'track-1',
        name: 'Voice',
        assetId: audAsset.meta.id,
        offset: 0,
        volume: 0.9,
        tone: 'vocal'
      }
    ]

    const packedStore = await serializeProject(project)
    // Xác minh header PKZIP local file header (PK\x03\x04)
    expect(packedStore[0]).toBe(0x50)
    expect(packedStore[1]).toBe(0x4b)

    // Đảm bảo wasmPackPxsZip tạo đúng số byte
    const roundDirect = wasmPackPxsZip([
      { name: 'a.txt', data: new TextEncoder().encode('hello') }
    ])
    expect(roundDirect).not.toBeNull()

    assetStore.clear()
    const restored = await deserializeProject(packedStore)
    expect(restored.comp.name).toBe('Cảnh Stage 4 Test')
    expect(restored.layers.length).toBe(1)
    expect(Array.from((await assetStore.getBytes('img_hero_1'))!)).toEqual(Array.from(imgBytes))
    expect(Array.from((await assetStore.getBytes('aud_voice_1'))!)).toEqual(Array.from(audioBytes))

    // Test backward compatibility with JSZip DEFLATE package
    const jszip = new JSZip()
    jszip.file('project.json', JSON.stringify(project))
    jszip.file('assets/img_hero_1.png', imgBytes)
    jszip.file('assets/aud_voice_1.wav', audioBytes)
    const legacyZip = await jszip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })

    assetStore.clear()
    const restoredLegacy = await deserializeProject(legacyZip)
    expect(restoredLegacy.comp.name).toBe('Cảnh Stage 4 Test')
    expect(Array.from((await assetStore.getBytes('img_hero_1'))!)).toEqual(Array.from(imgBytes))
  })

  it('matches WASM vs JS parity for peaks, PCM16 WAV encoding, mixdown DSP & lipSync bake', () => {
    const samples = new Float32Array(16000)
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(i * 0.05) * (0.2 + 0.8 * (i / samples.length))
    }

    const peaksWasm = computeNormalizedPeaksFromSamples(samples, 200)
    const peaksJs = computeNormalizedPeaksFromSamplesJs(samples, 200)
    expect(peaksWasm.length).toBe(200)
    for (let i = 0; i < peaksWasm.length; i++) {
      expect(Math.abs(peaksWasm[i] - peaksJs[i])).toBeLessThan(1e-5)
    }

    const wavL = samples.subarray(0, 512)
    const wavR = samples.subarray(512, 1024)
    const wavWasm = encodeChannelsToPcm16Wav([wavL, wavR], 44100)
    const wavJs = encodeChannelsToPcm16WavJs([wavL, wavR], 44100)
    expect(Array.from(wavWasm)).toEqual(Array.from(wavJs))

    const mixed = mixDecodedAudioClipsToWav(
      [
        {
          track: {
            id: 't1',
            name: 'Bass',
            assetId: 'a1',
            offset: 0,
            volume: 0.8,
            playbackRate: 1.25,
            tone: 'bass'
          },
          sampleRate: 44100,
          channels: [wavL]
        },
        {
          track: {
            id: 't2',
            name: 'Vocal',
            assetId: 'a2',
            offset: -0.002,
            volume: 0.7,
            tone: 'vocal'
          },
          sampleRate: 44100,
          channels: [wavL, wavR]
        },
        {
          track: {
            id: 't3',
            name: 'Muted',
            assetId: 'a3',
            offset: 0,
            volume: 1,
            muted: true
          },
          sampleRate: 44100,
          channels: [wavL]
        }
      ],
      0.05,
      0,
      44100
    )
    expect(mixed).not.toBeNull()
    expect(new TextDecoder().decode(mixed!.subarray(0, 4))).toBe('RIFF')
    expect(new TextDecoder().decode(mixed!.subarray(8, 12))).toBe('WAVE')
    expect(mixed!.byteLength).toBe(44 + Math.ceil(0.05 * 44100) * 4)

    // LipSync bake WASM vs JS parity
    const projA = createProject({ fps: 30, duration: 2 })
    const projB = createProject({ fps: 30, duration: 2 })
    const layerA = createImageLayer(
      { id: 'mouth_tex', name: 'mouth', kind: 'image', mime: 'image/png', width: 64, height: 64 },
      projA.comp,
      0
    )
    const layerB = createImageLayer(
      { id: 'mouth_tex', name: 'mouth', kind: 'image', mime: 'image/png', width: 64, height: 64 },
      projB.comp,
      0
    )
    layerA.id = 'mouth-layer'
    layerB.id = 'mouth-layer'
    projA.layers.push(layerA)
    projB.layers.push(layerB)
    const audMeta = { id: 'aud_lip_1', name: 'line.wav', kind: 'audio' as const, mime: 'audio/wav', duration: 0.5 }
    projA.assets.push(audMeta)
    projB.assets.push({ ...audMeta })
    const tr = {
      id: 'tr_lip',
      name: 'Voice',
      assetId: 'aud_lip_1',
      offset: 0,
      volume: 1.0,
      targetType: 'layer' as const,
      targetId: 'mouth-layer',
      lipSyncEnabled: true,
      lipSyncIntensity: 1.1
    }
    projA.audioTracks = [{ ...tr }]
    projB.audioTracks = [{ ...tr }]

    seedAudioPeaksCache('aud_lip_1', peaksWasm)
    const resWasm = bakeLipSyncToCharacterLayerSync(projA, 'tr_lip', { fps: 30 })
    const resJs = bakeLipSyncToCharacterLayerSyncJs(projB, 'tr_lip', { fps: 30 })
    expect(resWasm.success).toBe(true)
    expect(resWasm.bakedKeyframeCount).toBe(resJs.bakedKeyframeCount)
    expect(layerA.transform.scale.keyframes).toEqual(layerB.transform.scale.keyframes)
    expect(layerA.transform.position.keyframes).toEqual(layerB.transform.position.keyframes)
  })

  it('encodes MP4 via FfmpegEncoder with cpuYuvFallback Rust YUV420p packing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pxs-cpu-yuv-'))
    const out = join(dir, 'cpu-yuv.mp4')
    const w = 64
    const h = 36
    try {
      const rgba = new Uint8Array(w * h * 4)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4
          // Nửa dưới (top của ảnh khi flipY) đỏ sáng, nửa trên xanh dương
          const isBottomRow = y < h / 2
          rgba[i] = isBottomRow ? 220 : 20
          rgba[i + 1] = 40
          rgba[i + 2] = isBottomRow ? 30 : 220
          rgba[i + 3] = 255
        }
      }

      const enc = new FfmpegEncoder({
        width: w,
        height: h,
        fps: 30,
        crf: 10,
        preset: 'ultrafast',
        outPath: out,
        cpuYuvFallback: true
      })
      for (let f = 0; f < 6; f++) await enc.writeFrame(rgba)
      const res = await enc.finish()
      expect(res.ok, res.error).toBe(true)

      const probe = spawnSync(ffmpegPath(), ['-hide_banner', '-i', out], { encoding: 'utf8' })
      const info = probe.stderr || probe.stdout || ''
      expect(info).toMatch(/Video: h264/)
      expect(info).toMatch(/yuv420p/)
      expect(info).toMatch(/64x36/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 30000)
})
