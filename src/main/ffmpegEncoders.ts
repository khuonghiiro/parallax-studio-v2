import { spawn } from 'child_process'
import type { ExportEncoderPreference, ExportStartOptions, ExportVideoEncoder } from '@shared/ipc'

/** Thứ tự ưu tiên encoder phần cứng khi `encoder = 'auto'`. */
export const HARDWARE_ENCODERS: readonly ExportVideoEncoder[] = ['h264_nvenc', 'h264_qsv', 'h264_amf']

const NVENC_PRESET: Record<ExportStartOptions['preset'], string> = {
  ultrafast: 'p1',
  veryfast: 'p3',
  medium: 'p5',
  slow: 'p7'
}

const AMF_QUALITY: Record<ExportStartOptions['preset'], string> = {
  ultrafast: 'speed',
  veryfast: 'speed',
  medium: 'balanced',
  slow: 'quality'
}

const clampQ = (crf: number): number => Math.max(1, Math.min(51, Math.round(crf)))

/**
 * Tham số mã hoá video cho từng encoder, quy đổi `crf` / `preset` của x264 sang thang chất lượng
 * tương đương của NVENC (CQ), Quick Sync (ICQ) và AMF (CQP).
 */
export function videoCodecArgs(
  encoder: ExportVideoEncoder,
  preset: ExportStartOptions['preset'],
  crf: number
): string[] {
  const q = String(clampQ(crf))
  switch (encoder) {
    case 'h264_nvenc':
      return ['-c:v', 'h264_nvenc', '-preset', NVENC_PRESET[preset], '-rc', 'vbr', '-cq', q, '-b:v', '0', '-pix_fmt', 'yuv420p']
    case 'h264_qsv':
      return ['-c:v', 'h264_qsv', '-preset', preset === 'ultrafast' ? 'veryfast' : preset, '-global_quality', q, '-pix_fmt', 'nv12']
    case 'h264_amf':
      return ['-c:v', 'h264_amf', '-quality', AMF_QUALITY[preset], '-rc', 'cqp', '-qp_i', q, '-qp_p', q, '-pix_fmt', 'nv12']
    default:
      return ['-c:v', 'libx264', '-preset', preset, '-crf', q, '-pix_fmt', 'yuv420p']
  }
}

/** Chạy thử encoder trên vài frame đen đúng độ phân giải xuất để chắc chắn driver/GPU dùng được. */
function probeEncoder(bin: string, encoder: ExportVideoEncoder, width: number, height: number): Promise<boolean> {
  return new Promise((resolve) => {
    const args = [
      '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', `color=c=black:s=${width}x${height}:r=30`,
      '-frames:v', '3',
      ...videoCodecArgs(encoder, 'veryfast', 23),
      '-f', 'null', '-'
    ]
    let settled = false
    const done = (ok: boolean): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(ok)
    }
    const proc = spawn(bin, args, { windowsHide: true })
    const timer = setTimeout(() => {
      proc.kill('SIGKILL')
      done(false)
    }, 8000)
    proc.on('error', () => done(false))
    proc.on('close', (code) => done(code === 0))
  })
}

const probeCache = new Map<string, Promise<boolean>>()

function cachedProbe(bin: string, encoder: ExportVideoEncoder, width: number, height: number): Promise<boolean> {
  const key = `${bin}|${encoder}|${width}x${height}`
  let p = probeCache.get(key)
  if (!p) {
    p = probeEncoder(bin, encoder, width, height)
    probeCache.set(key, p)
  }
  return p
}

/** Chỉ dùng cho test: xoá cache kết quả dò encoder. */
export function resetEncoderProbeCache(): void {
  probeCache.clear()
}

/**
 * Chọn encoder thực tế theo yêu cầu: `cpu` → libx264; tên encoder cụ thể → dùng nếu chạy được;
 * `auto` → encoder phần cứng đầu tiên chạy được (NVENC → Quick Sync → AMF), nếu không có thì libx264.
 */
export async function resolveVideoEncoder(
  bin: string,
  preference: ExportEncoderPreference | undefined,
  width: number,
  height: number
): Promise<ExportVideoEncoder> {
  const pref = preference ?? 'auto'
  if (pref === 'cpu' || pref === 'libx264') return 'libx264'
  const candidates = pref === 'auto' ? HARDWARE_ENCODERS : [pref]
  for (const enc of candidates) {
    if (await cachedProbe(bin, enc, width, height)) return enc
  }
  return 'libx264'
}
