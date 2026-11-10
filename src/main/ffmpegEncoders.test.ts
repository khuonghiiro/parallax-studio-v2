import { describe, expect, it } from 'vitest'
import { resetEncoderProbeCache, resolveVideoEncoder, videoCodecArgs } from './ffmpegEncoders'

describe('videoCodecArgs', () => {
  it('giữ nguyên tham số libx264 (crf / preset / yuv420p)', () => {
    expect(videoCodecArgs('libx264', 'medium', 18)).toEqual([
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p'
    ])
  })

  it('quy đổi preset và chất lượng sang NVENC / Quick Sync / AMF', () => {
    expect(videoCodecArgs('h264_nvenc', 'slow', 20)).toEqual(
      expect.arrayContaining(['h264_nvenc', '-preset', 'p7', '-cq', '20'])
    )
    const qsv = videoCodecArgs('h264_qsv', 'ultrafast', 22)
    expect(qsv).toEqual(expect.arrayContaining(['h264_qsv', '-preset', 'veryfast', '-global_quality', '22', 'nv12']))
    expect(videoCodecArgs('h264_amf', 'medium', 18)).toEqual(
      expect.arrayContaining(['h264_amf', '-quality', 'balanced', '-qp_i', '18', '-qp_p', '18'])
    )
  })

  it('kẹp chất lượng vào khoảng hợp lệ 1..51', () => {
    expect(videoCodecArgs('libx264', 'medium', 99)).toContain('51')
    expect(videoCodecArgs('libx264', 'medium', -3)).toContain('1')
  })
})

describe('resolveVideoEncoder', () => {
  it('cpu / libx264 luôn chọn libx264 mà không cần dò', async () => {
    expect(await resolveVideoEncoder('không-tồn-tại', 'cpu', 64, 36)).toBe('libx264')
    expect(await resolveVideoEncoder('không-tồn-tại', 'libx264', 64, 36)).toBe('libx264')
  })

  it('lùi về libx264 khi không chạy được encoder GPU nào', async () => {
    resetEncoderProbeCache()
    expect(await resolveVideoEncoder('pxs-ffmpeg-khong-ton-tai.exe', 'auto', 64, 36)).toBe('libx264')
    expect(await resolveVideoEncoder('pxs-ffmpeg-khong-ton-tai.exe', 'h264_nvenc', 64, 36)).toBe('libx264')
  })
})
