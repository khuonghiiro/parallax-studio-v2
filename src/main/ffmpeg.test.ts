import { describe, expect, it } from 'vitest'
import { spawnSync } from 'child_process'
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import ffmpegStatic from 'ffmpeg-static'
import { FfmpegEncoder } from './ffmpeg'

const W = 64
const H = 36
const FPS = 30
const FRAMES = 45

function frame(i: number): Uint8Array {
  const px = new Uint8Array(W * H * 4)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4
      px[o] = (x * 4 + i * 5) & 255
      px[o + 1] = (y * 7) & 255
      px[o + 2] = (i * 9) & 255
      px[o + 3] = 255
    }
  return px
}

/** Read stream info via `ffmpeg -i` (ffmpeg-static ships without ffprobe). */
function probe(path: string): string {
  const r = spawnSync(ffmpegStatic as unknown as string, ['-hide_banner', '-i', path], { encoding: 'utf8' })
  return r.stderr
}

/** Make a short silent WAV so we can test audio muxing. */
function silentWav(seconds: number): Uint8Array {
  const rate = 8000
  const n = Math.floor(rate * seconds)
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 2, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 2, 40)
  return new Uint8Array(buf)
}

describe('FfmpegEncoder', () => {
  it('encodes raw RGBA frames into an H.264 MP4', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pxs-test-'))
    const out = join(dir, 'out.mp4')
    try {
      const enc = new FfmpegEncoder({ width: W, height: H, fps: FPS, crf: 23, preset: 'ultrafast', outPath: out })
      for (let i = 0; i < FRAMES; i++) await enc.writeFrame(frame(i))
      const res = await enc.finish()
      expect(res.ok, res.error).toBe(true)
      expect(existsSync(out)).toBe(true)
      expect(statSync(out).size).toBeGreaterThan(500)
      const info = probe(out)
      expect(info).toMatch(/Video: h264/)
      expect(info).toMatch(/yuv420p/)
      expect(info).toMatch(/64x36/)
      expect(info).toMatch(/Duration: 00:00:01\.5/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 30000)

  it('muxes an audio track trimmed to the video length', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pxs-test-'))
    const out = join(dir, 'out-audio.mp4')
    const wav = join(dir, 'a.wav')
    writeFileSync(wav, silentWav(5))
    try {
      const duration = FRAMES / FPS
      const enc = new FfmpegEncoder(
        {
          width: W,
          height: H,
          fps: FPS,
          crf: 23,
          preset: 'ultrafast',
          outPath: out,
          audio: { data: new Uint8Array(), ext: 'wav', offset: 0.2, volume: 0.8, duration }
        },
        wav
      )
      for (let i = 0; i < FRAMES; i++) await enc.writeFrame(frame(i))
      const res = await enc.finish()
      expect(res.ok, res.error).toBe(true)
      const info = probe(out)
      expect(info).toMatch(/Audio: aac/)
      expect(info).toMatch(/Duration: 00:00:01\.5/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 30000)

  it('rejects frames with the wrong size', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pxs-test-'))
    try {
      const enc = new FfmpegEncoder({ width: W, height: H, fps: FPS, crf: 23, preset: 'ultrafast', outPath: join(dir, 'x.mp4') })
      await expect(enc.writeFrame(new Uint8Array(10))).rejects.toThrow(/Frame size mismatch/)
      enc.cancel()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
